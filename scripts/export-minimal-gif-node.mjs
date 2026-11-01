// Offline fallback: run the browser recipe with native Canvas, without a browser.
// Usage: node scripts/export-minimal-gif-node.mjs <node_modules containing @napi-rs/canvas> <node_modules containing gifenc>
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createStatePlayer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';
const require = createRequire(import.meta.url);
const { createCanvas } = require(resolve(process.argv[2], '@napi-rs/canvas'));
const { GIFEncoder, quantize, applyPalette } = require(resolve(process.argv[3], 'gifenc'));
const html = await readFile('examples/visualization-pipeline.html', 'utf8');
const recipe = await readFile('docs/assets/minimal-export.html', 'utf8');
const output = createCanvas(1100, 700);
const script = recipe.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*;\r?\n/gm, '').split('draw(frames[0]);')[0];
const document = {
    querySelector: () => output,
    createElement: () => createCanvas(600, 160),
};
class DOMParser {
    parseFromString() {
        return { querySelector: () => ({ textContent: html.match(/id="example">([\s\S]*?)<\/script>/)[1] }) };
    }
}
const run = new (Object.getPrototypeOf(async function() {}).constructor)(
    'createStatePlayer', 'createSceneRenderer', 'document', 'DOMParser', 'fetch',
    script + '\nreturn { frames, draw };');
const { frames, draw } = await run(createStatePlayer, createSceneRenderer, document, DOMParser,
    async () => ({ text: async () => html }));
const gif = GIFEncoder();
for (const frame of frames) {
    draw(frame);
    const pixels = output.getContext('2d').getImageData(0, 0, 1100, 700).data;
    const palette = quantize(pixels, 128);
    gif.writeFrame(applyPalette(pixels, palette), 1100, 700, { palette, delay: frame.duration, repeat: 0 });
}
gif.finish();
await writeFile('docs/assets/minimal.gif', gif.bytes());
draw(frames.find(frame => frame.kind === 'exhausted'));
await writeFile(resolve(process.env.TEMP, 'algiviz-state-gif.png'), output.toBuffer('image/png'));
console.log(JSON.stringify({ frames: frames.length, durationMs: frames.reduce((n, f) => n + f.duration, 0),
    bytes: gif.bytes().length, positions: frames.filter(f => f.kind === 'drawing').map(f => f.x),
    preview: resolve(process.env.TEMP, 'algiviz-state-gif.png') }));
