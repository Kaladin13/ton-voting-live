import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fetchMainnetVotingSnapshot } from './mainnetVoting';

const PORT = Number(process.env.PORT ?? 3000);
const INDEX_HTML = join(__dirname, 'index.html');
const SNAPSHOT_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS ?? 15000);
const CLIENT_CACHE_TTL_S = Number(process.env.DASHBOARD_CLIENT_CACHE_TTL_S ?? 5);

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

type CachedSnapshot = {
    body: string,
    refreshedAt: number,
    expiresAt: number
};

let cachedSnapshot: CachedSnapshot | null = null;
let snapshotRefresh: Promise<CachedSnapshot> | null = null;

async function refreshSnapshotCache(): Promise<CachedSnapshot> {
    const snapshot = await fetchMainnetVotingSnapshot();
    const now = Date.now();
    const nextValue = {
        body: JSON.stringify(snapshot),
        refreshedAt: now,
        expiresAt: now + SNAPSHOT_CACHE_TTL_MS
    };
    cachedSnapshot = nextValue;
    return nextValue;
}

function triggerSnapshotRefresh() {
    if (!snapshotRefresh) {
        snapshotRefresh = refreshSnapshotCache().finally(() => {
            snapshotRefresh = null;
        });
    }
    return snapshotRefresh;
}

async function getSnapshotResponse() {
    const now = Date.now();

    if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
        return {
            cacheStatus: 'hit',
            snapshot: cachedSnapshot
        } as const;
    }

    if (cachedSnapshot) {
        triggerSnapshotRefresh().catch(() => {
            return;
        });
        return {
            cacheStatus: 'stale',
            snapshot: cachedSnapshot
        } as const;
    }

    return {
        cacheStatus: 'miss',
        snapshot: await triggerSnapshotRefresh()
    } as const;
}

const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    try {
        if (url === '/api/status') {
            const { snapshot, cacheStatus } = await getSnapshotResponse();
            res.writeHead(200, {
                'Content-Type': CONTENT_TYPES['.json'],
                'Cache-Control': `public, max-age=${CLIENT_CACHE_TTL_S}, stale-while-revalidate=${Math.max(CLIENT_CACHE_TTL_S, Math.ceil(SNAPSHOT_CACHE_TTL_MS / 1000))}`,
                'X-Cache': cacheStatus,
                'X-Cache-Refreshed-At': String(snapshot.refreshedAt)
            });
            res.end(snapshot.body);
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
            if (cachedSnapshot) {
                res.writeHead(200, {
                    'Content-Type': CONTENT_TYPES['.json'],
                    'Cache-Control': `public, max-age=${CLIENT_CACHE_TTL_S}, stale-while-revalidate=${Math.max(CLIENT_CACHE_TTL_S, Math.ceil(SNAPSHOT_CACHE_TTL_MS / 1000))}`,
                    'X-Cache': 'stale-if-error',
                    'X-Cache-Refreshed-At': String(cachedSnapshot.refreshedAt)
                });
                res.end(cachedSnapshot.body);
                return;
            }

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
