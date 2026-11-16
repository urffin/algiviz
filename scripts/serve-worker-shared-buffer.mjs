import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/worker/data.ts', 'test/worker-shared-buffer-browser.html',
    ...['data', 'error', 'index', 'protocol', 'runtime', 'types'].map(name => `dist/worker/${name}.js`),
    'dist/playback/async-source.js', 'dist/playback/index.js'];
const provenance = Object.fromEntries(await Promise.all(files.map(async path =>
    [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')])));
const headers = { 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'GET' && url.pathname === '/provenance') {
            response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }); response.end(JSON.stringify(provenance)); return;
        }
        if (request.method === 'POST' && url.pathname === '/report-f2') {
            if (request.headers.origin !== 'http://' + request.headers.host) throw new Error('Unexpected report origin');
            let body = ''; for await (const part of request) { body += part; if (body.length > 1000000) throw new Error('Report too large'); }
            const report = JSON.parse(body);
            if (JSON.stringify(report.provenance) !== JSON.stringify(provenance)) throw new Error('Provenance mismatch');
            await writeFile(resolve(root, 'docs/checks/worker-shared-buffer-fix-browser-2026-11-14.json'), JSON.stringify(report, null, 2) + '\n');
            response.writeHead(200, headers); response.end('saved'); return;
        }
        if (request.method !== 'GET') throw new Error('Unsupported method');
        const name = url.pathname === '/' ? 'test/worker-shared-buffer-browser.html' : decodeURIComponent(url.pathname).slice(1);
        const target = resolve(root, name), child = relative(root, target);
        if (!child || child.startsWith('..') || isAbsolute(child) || !(name === 'test/worker-shared-buffer-browser.html' || /^dist\/(worker|playback)\/[^/]+\.js$/.test(name))) throw new Error('Not found');
        response.writeHead(200, { ...headers, 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
        response.end(await readFile(target));
    } catch (error) { response.writeHead(400, headers); response.end(error.message); }
});
server.listen(0, '127.0.0.1', () => console.log('F2 browser check: http://127.0.0.1:' + server.address().port + '/'));
