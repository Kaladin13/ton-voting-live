import { SnapshotPoller } from '../dashboard/polling';
import { ToncenterError } from '../dashboard/toncenter';

describe('client-side snapshot polling', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    it('refreshes every 30 seconds, with no cache-induced skipped refresh', async () => {
        const fetchSnapshot = jest.fn().mockResolvedValue({ proposalCount: 1 });
        const onSnapshot = jest.fn();
        const poller = new SnapshotPoller(fetchSnapshot, onSnapshot, jest.fn());
        await poller.refresh();
        await jest.advanceTimersByTimeAsync(29_999);
        expect(fetchSnapshot).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(onSnapshot).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(30_000);
        expect(fetchSnapshot).toHaveBeenCalledTimes(3);
        poller.stop();
    });

    it('deduplicates manual refresh while loading and never overlaps slow requests', async () => {
        let finish!: (value: number) => void;
        const fetchSnapshot = jest.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
        const poller = new SnapshotPoller(fetchSnapshot, jest.fn(), jest.fn());
        const first = poller.refresh();
        expect(poller.refresh()).toBe(first);
        await jest.advanceTimersByTimeAsync(90_000);
        expect(fetchSnapshot).toHaveBeenCalledTimes(1);
        finish(1);
        await first;
        await jest.advanceTimersByTimeAsync(29_999);
        expect(fetchSnapshot).toHaveBeenCalledTimes(1);
        poller.stop();
    });

    it('keeps the last snapshot, honors Retry-After even for manual refresh, then returns to 30 seconds', async () => {
        const fetchSnapshot = jest.fn().mockResolvedValueOnce('saved')
            .mockRejectedValueOnce(new ToncenterError('Rate limit', 429, 90_000)).mockResolvedValue('new');
        const onSnapshot = jest.fn();
        const onState = jest.fn();
        const poller = new SnapshotPoller(fetchSnapshot, onSnapshot, onState);
        await poller.refresh();
        await jest.advanceTimersByTimeAsync(30_000);
        expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'error', message: 'Rate limit' }));
        expect(onSnapshot.mock.calls).toEqual([['saved']]);
        await poller.refresh();
        await jest.advanceTimersByTimeAsync(89_999);
        expect(fetchSnapshot).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(1);
        expect(onSnapshot).toHaveBeenLastCalledWith('new');
        await jest.advanceTimersByTimeAsync(30_000);
        expect(fetchSnapshot).toHaveBeenCalledTimes(4);
        poller.stop();
    });

    it('backs off repeated failures up to five minutes and recovers without a reload', async () => {
        const fetchSnapshot = jest.fn().mockRejectedValue(new Error('Offline'));
        const onState = jest.fn();
        const poller = new SnapshotPoller(fetchSnapshot, jest.fn(), onState);
        await poller.refresh();
        for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000]) {
            expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ retryAt: Date.now() + delay }));
            await jest.advanceTimersByTimeAsync(delay);
        }
        fetchSnapshot.mockResolvedValue('online');
        await jest.advanceTimersByTimeAsync(300_000);
        expect(onState).toHaveBeenLastCalledWith({ kind: 'ready' });
        const calls = fetchSnapshot.mock.calls.length;
        await jest.advanceTimersByTimeAsync(30_000);
        expect(fetchSnapshot).toHaveBeenCalledTimes(calls + 1);
        poller.stop();
    });
});
