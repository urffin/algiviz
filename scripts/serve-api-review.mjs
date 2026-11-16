// Local native reproduction for the 0.16.0 API audit; no library changes.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values: { verify = false } } = parseArgs({ options: { verify: { type: 'boolean' } } });
const modules = ['data', 'error', 'index', 'protocol', 'runtime', 'types'];
const files = [...modules.map(f => 'src/worker/' + f + '.ts'), ...modules.map(f => 'dist/worker/' + f + '.js'),
    'src/playback/async-source.ts', 'dist/playback/async-source.js', 'test/api-review-worker-browser.html'];
const provenance = Object.fromEntries(await Promise.all(files.map(async file =>
    [file, createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')])));
const headers = { 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/provenance') {
            response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); response.end(JSON.stringify(provenance)); return;
        }
        if (request.method === 'POST' && url.pathname === '/report') {
            if (request.headers.origin !== 'http://' + request.headers.host) throw new Error('Unexpected report origin');
            let body = '';
            for await (const part of request) { body += part; if (body.length > 1000000) throw new Error('Report too large'); }
            const report = JSON.parse(body);
            if (JSON.stringify(report.provenance) !== JSON.stringify(provenance)) throw new Error('Provenance mismatch');
            const filename = verify ? 'worker-memory-fix-browser-2026-11-14.json' : 'api-review-worker-native-2026-11-14.json';
            await writeFile(resolve(root, 'docs/checks', filename), JSON.stringify(report, null, 2) + '\n');
            response.writeHead(200, headers); response.end('saved'); return;
        }
        if (request.method !== 'GET') throw new Error('Unsupported method');
        const name = url.pathname === '/' ? 'test/api-review-worker-browser.html' : decodeURIComponent(url.pathname).slice(1);
        const target = resolve(root, name), child = relative(root, target);
        if (!child || child.startsWith('..') || isAbsolute(child) || !(name === 'test/api-review-worker-browser.html' || /^dist\/(worker|playback)\/[^/]+\.js$/.test(name)))
            throw new Error('Not found');
        const bytes = await readFile(target);
        response.writeHead(200, { ...headers, 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' }); response.end(bytes);
    } catch (error) { response.writeHead(400, headers); response.end(error.message); }
});
server.listen(0, '127.0.0.1', () => console.log('API audit: http://127.0.0.1:' + server.address().port + '/' + (verify ? '?verify=1' : '')));
