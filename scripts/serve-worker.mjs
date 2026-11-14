import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values: options } = parseArgs({ options: { player: { type: 'boolean', default: false } } });
const fixtures = ['worker-browser.html', 'worker-browser.mjs', 'worker-native-fixture.mjs', 'worker-silent-fixture.mjs'];
const playerFixtures = ['player-worker-browser.html', 'player-worker-browser.mjs', 'player-worker-native.mjs'];
const files = ['types', 'error', 'protocol', 'data', 'index', 'runtime'];
const provenanceFiles = [...files.map(name => 'src/worker/' + name + '.ts'), ...files.map(name => 'dist/worker/' + name + '.js'),
    ...fixtures.map(name => 'test/' + name), 'src/playback/async-source.ts', 'dist/playback/async-source.js'];
const playerFiles = ['player', 'controller', 'async-controller', 'async-session', 'mount', 'types', 'close-report'];
const playerProvenanceFiles = [...provenanceFiles.filter(file => !file.startsWith('test/')),
    ...playerFiles.map(name => 'src/player/' + name + '.ts'), ...playerFiles.map(name => 'dist/player/' + name + '.js'),
    ...playerFixtures.map(name => 'test/' + name)];
async function hashes(files) {
    return Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')])));
}
const playerHashes = await hashes(playerProvenanceFiles);
const server = createServer(async (request, response) => {
    const headers = { 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
    try {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'POST' && url.pathname === '/__player_worker_report') {
            if (request.headers.origin !== 'http://' + request.headers.host) throw new Error('Unexpected report origin');
            let body = ''; for await (const part of request) { body += part; if (body.length > 1000000) throw new Error('Report too large'); }
            const report = JSON.parse(body);
            if (JSON.stringify(report.provenance) !== JSON.stringify(playerHashes)) throw new Error('Player/Worker provenance mismatch');
            await mkdir(resolve(root, 'docs/checks'), { recursive: true });
            await writeFile(resolve(root, 'docs/checks/player-worker-browser-2026-11-14.json'), JSON.stringify(report, null, 2) + '\n');
            response.writeHead(200, headers); response.end('saved'); return;
        }
        if (request.method !== 'GET') { response.writeHead(405, headers); response.end(); return; }
        if (url.pathname === '/__player_worker_provenance') {
            response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); response.end(JSON.stringify(playerHashes)); return;
        }
        if (url.pathname === '/provenance') {
            response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); response.end(JSON.stringify(await hashes(provenanceFiles))); return;
        }
        const pathname = decodeURIComponent(url.pathname === '/' ? '/test/' + (options.player ? 'player-worker-browser.html' : 'worker-browser.html') : url.pathname);
        const target = resolve(root, '.' + pathname), child = relative(root, target);
        if (!child || child.startsWith('..') || isAbsolute(child) ||
            !(pathname.startsWith('/dist/worker/') || pathname.startsWith('/dist/playback/') || pathname.startsWith('/dist/player/') ||
                [...fixtures, ...playerFixtures].some(name => pathname === '/test/' + name))) {
            response.writeHead(404, headers); response.end(); return;
        }
        const bytes = await readFile(target);
        response.writeHead(200, { ...headers, 'Content-Type': target.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' }); response.end(bytes);
    } catch (error) { response.writeHead(400, headers); response.end(error.message); }
});
server.listen(0, '127.0.0.1', () => console.log('Worker verification: http://127.0.0.1:' + server.address().port + '/test/' + (options.player ? 'player-worker-browser.html' : 'worker-browser.html')));
