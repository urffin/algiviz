import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { port: { type: 'string', default: '8766' }, output: { type: 'string' } } });
const root = process.cwd(), hashes = {};
for (const file of ['src/playback/async-source.ts', 'src/player/async-session.ts', 'src/player/async-controller.ts',
    'src/player/controller.ts', 'src/player/types.ts', 'src/player/mount.ts', 'src/player/close-report.ts',
    'dist/player/async-session.js', 'dist/player/async-controller.js', 'dist/player/mount.js', 'test/player-async-browser.mjs'])
    hashes[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
http.createServer(async (req, res) => {
    try {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'GET' && pathname === '/__provenance') {
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(hashes)); return;
        }
        if (req.method === 'POST' && pathname === '/__report' && values.output) {
            let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) throw Error('Report too large'); }
            const report = JSON.parse(body);
            if (JSON.stringify(report.provenance) !== JSON.stringify(hashes)) throw Error('Provenance mismatch');
            await fs.writeFile(values.output, JSON.stringify(report, null, 2)); res.end('saved'); return;
        }
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const file = path.resolve(root, '.' + decodeURIComponent(pathname));
        if (!['test', 'dist'].some(dir => file.startsWith(path.join(root, dir) + path.sep))) { res.writeHead(403); res.end(); return; }
        res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' }[path.extname(file)] ?? 'application/octet-stream');
        res.end(await fs.readFile(file));
    } catch (error) { res.writeHead(500); res.end(error.message); }
}).listen(Number(values.port), '127.0.0.1', () => console.log('http://127.0.0.1:' + values.port + '/test/player-async-browser.html'));
