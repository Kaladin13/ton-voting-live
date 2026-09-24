import { Address, Cell, Dictionary, TupleItem, TupleReader } from '@ton/core';
import { Buffer } from 'buffer';

const ENDPOINT = 'https://toncenter.com/api/v2';
const UNAUTHENTICATED_REQUEST_INTERVAL_MS = 1_100;
// Toncenter's free mainnet key allows 10 requests/s. Keep a little headroom.
const AUTHENTICATED_REQUEST_INTERVAL_MS = 110;
const REQUEST_TIMEOUT_MS = 15_000;

export class ToncenterError extends Error {
    constructor(
        message: string,
        readonly status: number | null = null,
        readonly retryAfterMs = 0,
    ) {
        super(message);
        this.name = 'ToncenterError';
    }
}

export function parseRetryAfter(value: string | null, now = Date.now()): number {
    if (!value) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : 0;
}

// Tonlib expands Lisp lists into arrays. Rebuild the cons cells expected by
// @ton/core, including null for an empty list and nested lists of voters.
export function parseToncenterStackEntry(entry: any): TupleItem {
    if (!entry || typeof entry !== 'object') throw new ToncenterError('Invalid Toncenter stack entry.');
    switch (entry['@type']) {
        case 'tvm.stackEntryNumber':
            return { type: 'int', value: BigInt(entry.number.number) };
        case 'tvm.stackEntryCell':
            return { type: 'cell', cell: Cell.fromBase64(entry.cell.bytes) };
        case 'tvm.stackEntrySlice':
            return { type: 'slice', cell: Cell.fromBase64(entry.slice.bytes) };
        case 'tvm.stackEntryTuple':
            return { type: 'tuple', items: entry.tuple.elements.map(parseToncenterStackEntry) };
        case 'tvm.stackEntryList': {
            const elements: TupleItem[] = entry.list.elements.map(parseToncenterStackEntry);
            let tail: TupleItem = { type: 'null' };
            for (let index = elements.length - 1; index >= 0; index -= 1) {
                tail = { type: 'tuple', items: [elements[index], tail] };
            }
            return tail;
        }
        default:
            throw new ToncenterError(`Unsupported Toncenter stack type: ${entry['@type']}.`);
    }
}

export class ToncenterClient {
    private apiKey = '';
    private nextRequestAt = 0;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}

    setApiKey(apiKey: string) {
        this.apiKey = apiKey.trim();
    }

    async getConfig(address: Address) {
        const result = await this.request('getAddressInformation', { address: address.toRawString() });
        if (result.state !== 'active' || typeof result.data !== 'string' || !result.data) {
            throw new ToncenterError('Toncenter returned no active config contract data.');
        }
        const data = Cell.fromBoc(Buffer.from(result.data, 'base64'))[0];
        if (!data?.refs[0] || !Number.isInteger(result.block_id?.seqno)) {
            throw new ToncenterError('Toncenter returned incomplete config contract data.');
        }
        return {
            config: Dictionary.loadDirect(Dictionary.Keys.Int(32), Dictionary.Values.Cell(), data.refs[0]),
            seqno: result.block_id.seqno as number,
        };
    }

    async runGetMethod(address: Address, method: string, seqno: number, args: bigint[] = []) {
        const result = await this.request('runGetMethodStd', {
            address: address.toRawString(),
            method,
            seqno,
            stack: args.map((value) => ({
                '@type': 'tvm.stackEntryNumber',
                number: { '@type': 'tvm.numberDecimal', number: value.toString() },
            })),
        });
        if (result.exit_code !== 0 && result.exit_code !== 1) {
            throw new ToncenterError(`${method} failed with TVM exit code ${result.exit_code}.`);
        }
        if (!Array.isArray(result.stack)) throw new ToncenterError('Toncenter returned an invalid TVM stack.');
        return new TupleReader(result.stack.map(parseToncenterStackEntry));
    }

    private request(method: string, params: Record<string, unknown>): Promise<any> {
        const task = this.queue.then(() => this.sendRequest(method, params));
        this.queue = task.catch(() => undefined);
        return task;
    }

    private async sendRequest(method: string, params: Record<string, unknown>) {
        const wait = this.nextRequestAt - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.nextRequestAt = Date.now() + (this.apiKey
            ? AUTHENTICATED_REQUEST_INTERVAL_MS
            : UNAUTHENTICATED_REQUEST_INTERVAL_MS);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const headers: Record<string, string> = {};
            if (this.apiKey) headers['X-API-Key'] = this.apiKey;
            const isGet = method === 'getAddressInformation';
            const query = isGet ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
            if (!isGet) headers['Content-Type'] = 'application/json';
            const response = await this.fetcher(`${ENDPOINT}/${method}${query}`, {
                method: isGet ? 'GET' : 'POST',
                headers,
                ...(isGet ? {} : { body: JSON.stringify(params) }),
                signal: controller.signal,
                cache: 'no-store',
                credentials: 'omit',
            });
            const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
            // Rate-limit and gateway responses may be HTML or have an empty body.
            const payload = await response.json().catch((error) => {
                if (controller.signal.aborted) throw error;
                return null;
            });
            if (!response.ok || payload?.ok === false) {
                const status = response.ok ? Number(payload.code) || null : response.status;
                const message = status === 429
                    ? 'Toncenter rate limit reached (429).'
                    : status === 401 || status === 403
                        ? `Toncenter rejected the API key (${status}). A valid mainnet API key is required.`
                        : `Toncenter request failed${status ? ` (${status})` : ''}.`;
                this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + retryAfterMs);
                throw new ToncenterError(message, status, retryAfterMs);
            }
            if (payload?.ok !== true || !payload.result || typeof payload.result !== 'object') {
                throw new ToncenterError('Toncenter returned an invalid response.');
            }
            return payload.result;
        } catch (error) {
            if (error instanceof ToncenterError) throw error;
            if (controller.signal.aborted) throw new ToncenterError('Toncenter request timed out.');
            throw new ToncenterError('Could not reach Toncenter. Check your internet connection.');
        } finally {
            clearTimeout(timeout);
        }
    }
}

export const toncenter = new ToncenterClient();
