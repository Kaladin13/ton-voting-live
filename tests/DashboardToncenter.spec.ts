import { Address, TupleReader } from '@ton/core';
import { fetchMainnetVotingSnapshot } from '../dashboard/mainnetVoting';
import { parseRetryAfter, parseToncenterStackEntry, ToncenterClient, ToncenterError } from '../dashboard/toncenter';
import { response, votingResponses } from './helpers/toncenter';

const address = Address.parseRaw(`-1:${'55'.repeat(32)}`);

describe('Toncenter browser transport', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('loads config and active proposals at the same block, preserving hashes and voter lists', async () => {
        const fixture = votingResponses();
        const fetcher = jest.fn().mockResolvedValueOnce(response(fixture.account)).mockResolvedValueOnce(response(fixture.proposals));
        const client = new ToncenterClient(fetcher);
        client.setApiKey(' test-mainnet-key ');
        const pending = fetchMainnetVotingSnapshot(client);
        await jest.advanceTimersByTimeAsync(1100);
        const snapshot = await pending;
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls[0][0]).toMatch(/^https:\/\/toncenter.com\/api\/v2\/getAddressInformation\?/);
        expect(fetcher.mock.calls[0][1].headers['X-API-Key']).toBe('test-mainnet-key');
        expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ method: 'list_proposals', seqno: 12345, stack: [] });
        expect(snapshot.proposals).toHaveLength(1);
        expect(snapshot.proposals[0]).toMatchObject({
            hash: fixture.hash, critical: true, paramId: 8, voterCount: 1,
            yesWeight: '50', neededWeight: '25', totalWeight: '100', neededValidatorCount: 1,
            validatorSetMatchesCurrent: true, voterSetResolved: true,
            voters: [{ index: 0, publicKey: '01'.repeat(32), role: 'main', weight: '50' }],
            changeRows: [{ label: 'TVM/network version', current: '14', proposed: '15' }],
        });
    });

    it('turns Tonlib empty lists into TVM null', () => {
        const reader = new TupleReader(votingResponses().empty.result.stack.map(parseToncenterStackEntry));
        expect(reader.readLispList()).toEqual([]);
        expect(() => parseToncenterStackEntry({ '@type': 'tvm.stackEntryUnsupported' })).toThrow('Unsupported');
    });

    it('sends a single-proposal hash as a decimal string, without losing precision', async () => {
        const fetcher = jest.fn().mockResolvedValue(response(votingResponses().empty));
        const client = new ToncenterClient(fetcher);
        const hash = (1n << 255n) + 7n;
        const result = await client.runGetMethod(address, 'get_proposal', 123, [hash]);
        expect(result.readTupleOpt()).toBeNull();
        expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
            method: 'get_proposal', seqno: 123,
            stack: [{ '@type': 'tvm.stackEntryNumber', number: { number: hash.toString() } }],
        });
    });

    it.each([401, 403, 429, 502, 503])('reports HTTP %i even if the response is not JSON', async (status) => {
        const fetcher = jest.fn().mockResolvedValue({ ...response(null, status, '12'), json: async () => { throw new SyntaxError(); } });
        await expect(new ToncenterClient(fetcher).getConfig(address)).rejects.toMatchObject({ status, retryAfterMs: 12_000 });
    });

    it('handles rate-limit errors inside a successful HTTP response', async () => {
        const fetcher = jest.fn().mockResolvedValue(response({ ok: false, code: 429, result: 'Ratelimit exceed' }));
        await expect(new ToncenterClient(fetcher).getConfig(address)).rejects.toMatchObject({ status: 429 });
    });

    it('fails the whole snapshot when listing proposals fails, without querying known hashes', async () => {
        const fixture = votingResponses();
        const fetcher = jest.fn().mockResolvedValueOnce(response(fixture.account)).mockResolvedValue(response(null, 429));
        const outcome = expect(fetchMainnetVotingSnapshot(new ToncenterClient(fetcher))).rejects.toMatchObject({ status: 429 });
        await jest.advanceTimersByTimeAsync(1100);
        await outcome;
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('handles network errors, malformed success responses and nonzero VM failures', async () => {
        await expect(new ToncenterClient(jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))).getConfig(address))
            .rejects.toThrow('internet connection');
        await expect(new ToncenterClient(jest.fn().mockResolvedValue(response(null))).getConfig(address))
            .rejects.toThrow('invalid response');
        await expect(new ToncenterClient(jest.fn().mockResolvedValue(response({ ok: true, result: { exit_code: 11, stack: [] } })))
            .runGetMethod(address, 'list_proposals', 123)).rejects.toThrow('exit code 11');
    });

    it('aborts a hanging request after 15 seconds', async () => {
        const fetcher = jest.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }));
        const result = expect(new ToncenterClient(fetcher).getConfig(address)).rejects.toThrow('timed out');
        await jest.advanceTimersByTimeAsync(15_000);
        await result;
    });

    it('serializes requests and recovers its queue after a failure', async () => {
        const fetcher = jest.fn().mockResolvedValueOnce(response(null, 429, '5')).mockResolvedValue(response(votingResponses().account));
        const client = new ToncenterClient(fetcher);
        const first = client.getConfig(address).catch((error) => error);
        const second = client.getConfig(address);
        await jest.advanceTimersByTimeAsync(4999);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(await first).toBeInstanceOf(ToncenterError);
        await expect(second).resolves.toHaveProperty('seqno', 12345);
    });

    it.each([
        ['', 1100],
        ['mainnet-key', 110],
    ])('spaces requests according to the API key limit (%s)', async (key, interval) => {
        const fetcher = jest.fn().mockResolvedValue(response(votingResponses().account));
        const client = new ToncenterClient(fetcher);
        client.setApiKey(key);
        const first = client.getConfig(address);
        const second = client.getConfig(address);
        await jest.advanceTimersByTimeAsync(interval - 1);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(fetcher).toHaveBeenCalledTimes(2);
        await Promise.all([first, second]);
    });

    it('parses numeric and HTTP-date Retry-After values', () => {
        const now = Date.UTC(2026, 8, 24, 12);
        expect(parseRetryAfter('7', now)).toBe(7000);
        expect(parseRetryAfter(new Date(now + 10_000).toUTCString(), now)).toBe(10_000);
        expect(parseRetryAfter('invalid', now)).toBe(0);
        expect(parseRetryAfter('-1', now)).toBe(0);
    });
});
