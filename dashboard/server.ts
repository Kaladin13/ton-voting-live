import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fetchMainnetVotingSnapshot } from './mainnetVoting';

const PORT = Number(process.env.PORT ?? 3000);
const INDEX_HTML = join(__dirname, 'index.html');

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    try {
        if (url === '/api/status') {
            const snapshot = await fetchMainnetVotingSnapshot();
            const body = JSON.stringify(snapshot);
            res.writeHead(200, {
                'Content-Type': CONTENT_TYPES['.json'],
                'Cache-Control': 'no-store'
            });
            res.end(body);
            return;
        }

        if (url === '/healthz') {
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store'
            });
            res.end('ok');
            return;
        }

        const filePath = url === '/' ? INDEX_HTML : join(__dirname, url);
        const content = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        res.end(content);
    } catch (error) {
        if (url === '/api/status') {
            const body = JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.writeHead(502, {
                'Content-Type': CONTENT_TYPES['.json'],
                'Cache-Control': 'no-store'
            });
            res.end(body);
            return;
        }

        res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store'
        });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    process.stdout.write(`Dashboard running at http://localhost:${PORT}\n`);
});
