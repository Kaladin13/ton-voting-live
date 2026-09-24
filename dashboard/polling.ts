import { ToncenterError } from './toncenter';

export const REFRESH_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export type PollingState =
    | { kind: 'loading' }
    | { kind: 'ready' }
    | { kind: 'error'; message: string; retryAt: number };

export class SnapshotPoller<T> {
    private timer: ReturnType<typeof setTimeout> | undefined;
    private pending: Promise<void> | undefined;
    private failures = 0;
    private retryAt = 0;
    private stopped = false;

    constructor(
        private readonly fetchSnapshot: () => Promise<T>,
        private readonly onSnapshot: (snapshot: T) => void,
        private readonly onState: (state: PollingState) => void,
    ) {}

    refresh(): Promise<void> {
        if (this.stopped) return Promise.resolve();
        if (this.pending) return this.pending;
        // Manual refreshes and online events must also respect the API cooldown.
        if (Date.now() < this.retryAt) return Promise.resolve();
        clearTimeout(this.timer);
        this.pending = this.load().finally(() => { this.pending = undefined; });
        return this.pending;
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
    }

    private async load() {
        const startedAt = Date.now();
        this.onState({ kind: 'loading' });
        let nextAt = startedAt + REFRESH_INTERVAL_MS;
        try {
            const snapshot = await this.fetchSnapshot();
            if (this.stopped) return;
            this.onSnapshot(snapshot);
            this.failures = 0;
            this.retryAt = 0;
            this.onState({ kind: 'ready' });
        } catch (error) {
            if (this.stopped) return;
            this.failures += 1;
            const backoff = Math.min(MAX_BACKOFF_MS, REFRESH_INTERVAL_MS * 2 ** Math.min(this.failures - 1, 4));
            const retryAfter = error instanceof ToncenterError ? error.retryAfterMs : 0;
            this.retryAt = Date.now() + Math.max(backoff, retryAfter);
            nextAt = this.retryAt;
            this.onState({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Could not load live mainnet data.',
                retryAt: this.retryAt,
            });
        } finally {
            if (!this.stopped) {
                // A slow request never causes overlapping polls or a catch-up burst.
                const delay = nextAt > Date.now() ? nextAt - Date.now() : REFRESH_INTERVAL_MS;
                this.timer = setTimeout(() => { void this.refresh(); }, Math.min(delay, 2_147_483_647));
            }
        }
    }
}
