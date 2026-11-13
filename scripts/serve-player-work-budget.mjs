import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { port: { type: 'string', default: '8765' }, output: { type: 'string' } } });
const root = process.cwd(), hashes = {};
for (const file of ['src/playback/player.ts', 'src/playback/state-player.ts', 'src/playback/state-steps.ts',
    'src/player/controller.ts', 'src/player/rewind-session.ts', 'src/player/stream-playback.ts', 'src/player/types.ts', 'src/player/mount.ts',
    'dist/playback/player.js', 'dist/player/controller.js', 'test/player-work-budget-browser.mjs'])
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
            await fs.writeFile(values.output, JSON.stringify(report, null, 2)); res.end('saved');
            console.log('Saved ' + values.output); return;
        }
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const file = path.resolve(root, '.' + decodeURIComponent(pathname));
        if (!['test', 'dist', 'examples'].some(dir => file.startsWith(path.join(root, dir) + path.sep))) {
            res.writeHead(403); res.end(); return;
        }
        res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' }[path.extname(file)] ?? 'application/octet-stream');
        res.end(await fs.readFile(file));
    } catch (error) { res.writeHead(500); res.end(error.message); }
}).listen(Number(values.port), '127.0.0.1', () => console.log('http://127.0.0.1:' + values.port + '/test/player-work-budget-browser.html'));
