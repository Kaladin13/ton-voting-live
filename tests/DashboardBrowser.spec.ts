/** @jest-environment jsdom */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { response, votingResponses } from './helpers/toncenter';

const root = path.resolve(__dirname, '..');
let bundle: string;

beforeAll(() => {
    // Build in Node, then execute the actual browser bundle without Node globals.
    bundle = execFileSync(process.execPath, ['-e', `
        const result = require('esbuild').buildSync({
            entryPoints: ['dashboard/client.js'], bundle: true, write: false,
            platform: 'browser', format: 'iife', target: 'es2020',
            inject: ['dashboard/buffer-shim.ts'],
        });
        process.stdout.write(result.outputFiles[0].text);
    `], { cwd: root, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
});

beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    document.documentElement.innerHTML = readFileSync(path.join(root, 'dashboard/index.html'), 'utf8');
});

afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('renders client-side data, keeps it on 429 and recovers automatically', async () => {
    const fixture = votingResponses();
    const fetcher = jest.fn()
        .mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals))
        .mockResolvedValueOnce(response(null, 429))
        .mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals));
    window.fetch = fetcher;
    window.eval(bundle);
    await jest.advanceTimersByTimeAsync(1100);
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(document.querySelector('#connection-status')?.textContent).toBe('');
    expect(document.querySelector('#proposal-list')?.textContent).toContain('Network version');
    const saved = localStorage.getItem('ton-config-voting:last-snapshot:v10');
    expect(saved).not.toBeNull();

    await jest.advanceTimersByTimeAsync(28_900);
    expect(document.querySelector('#connection-status')?.textContent).toContain('429');
    expect(document.querySelector('#connection-status')?.textContent).toContain('Showing last successful data');
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(localStorage.getItem('ton-config-voting:last-snapshot:v10')).toBe(saved);
    (document.querySelector('#refresh-button') as HTMLButtonElement).click();
    expect(fetcher).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(31_100);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(document.querySelector('#connection-status')?.textContent).toBe('');
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('https://toncenter.com/api/v2/'))).toBe(true);
});

it('shows a first-load network error and recovers even if the saved snapshot is corrupt', async () => {
    localStorage.setItem('ton-config-voting:last-snapshot:v10', JSON.stringify({ savedAt: Date.now(), snapshot: {} }));
    const fixture = votingResponses();
    window.fetch = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(response(fixture.account)).mockResolvedValueOnce(response(fixture.empty));
    window.eval(bundle);
    await jest.advanceTimersByTimeAsync(0);
    expect(document.querySelector('#connection-status')?.textContent).toContain('internet connection');
    expect(document.querySelector('#connection-status')?.textContent).toContain('Retrying automatically');
    await jest.advanceTimersByTimeAsync(31_100);
    expect(document.querySelector('#proposal-counter')?.textContent).toBe('0 live proposals');
    expect(document.querySelector('#status')?.textContent).toContain('No active config proposals');
});

it('continues polling and preserves rendered data when local storage is unavailable', async () => {
    const fixture = votingResponses();
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    window.fetch = jest.fn().mockResolvedValueOnce(response(fixture.account))
        .mockResolvedValueOnce(response(fixture.proposals)).mockResolvedValue(response(null, 503));
    try {
        window.eval(bundle);
        await jest.advanceTimersByTimeAsync(1100);
        expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
        await jest.advanceTimersByTimeAsync(28_900);
        expect(document.querySelector('#connection-status')?.textContent).toContain('503');
        expect(document.querySelector('#connection-status')?.textContent).toContain('Showing last successful data');
        expect(document.querySelector('#proposal-counter')?.textContent).toBe('1 live proposal');
    } finally {
        storage.mockRestore();
    }
});
