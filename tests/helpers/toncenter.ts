import { beginCell, Cell, Dictionary } from '@ton/core';
import { ValidatorDescriptionValue } from '../../wrappers/ValidatorUtils';

const number = (value: bigint | number) => ({
    '@type': 'tvm.stackEntryNumber',
    number: { '@type': 'tvm.numberDecimal', number: value.toString() },
});
const tuple = (...elements: unknown[]) => ({ '@type': 'tvm.stackEntryTuple', tuple: { '@type': 'tvm.tuple', elements } });
const list = (...elements: unknown[]) => ({ '@type': 'tvm.stackEntryList', list: { '@type': 'tvm.list', elements } });
const cell = (value: Cell) => ({ '@type': 'tvm.stackEntryCell', cell: { '@type': 'tvm.cell', bytes: value.toBoc().toString('base64') } });

export function votingResponses() {
    const rules = beginCell().storeUint(0x36, 8)
        .storeUint(2, 8).storeUint(3, 8).storeUint(2, 8).storeUint(1, 8)
        .storeUint(60, 32).storeUint(3600, 32).storeUint(1, 32).storeUint(1, 32).endCell();
    const validators = Dictionary.empty(Dictionary.Keys.Uint(16), ValidatorDescriptionValue);
    validators.set(0, { type: 'adnl', public_key: Buffer.alloc(32, 1), weight: 50n, adnl: 123n });
    validators.set(1, { type: 'simple', public_key: Buffer.alloc(32, 2), weight: 50n });
    const vset = beginCell().storeUint(0x12, 8).storeUint(1_790_000_000, 32).storeUint(1_790_100_000, 32)
        .storeUint(2, 16).storeUint(1, 16).storeUint(100n, 64).storeDict(validators).endCell();
    const config = Dictionary.empty(Dictionary.Keys.Int(32), Dictionary.Values.Cell());
    config.set(8, beginCell().storeUint(0xc4, 8).storeUint(14, 32).storeUint(1006n, 64).endCell());
    config.set(11, beginCell().storeUint(0x91, 8).storeRef(rules).storeRef(rules).endCell());
    config.set(15, beginCell().storeUint(1000, 32).storeUint(100, 32).storeUint(10, 32).storeUint(100, 32).endCell());
    config.set(16, beginCell().storeUint(2, 16).storeUint(1, 16).storeUint(1, 16).endCell());
    config.set(34, vset);
    const data = beginCell().storeRef(beginCell().storeDictDirect(config)).endCell();
    const value = beginCell().storeUint(0xc4, 8).storeUint(15, 32).storeUint(1006n, 64).endCell();
    // A full 256-bit hash and a negative integer must survive JSON decoding.
    const hash = (1n << 255n) + 42n;
    const proposal = tuple(number(hash), tuple(
        number(1_790_100_000), number(-1), tuple(number(8), cell(value), number(0)),
        number(BigInt(`0x${vset.hash().toString('hex')}`)), list(number(0)),
        number(25), number(2), number(0), number(0),
    ));
    return {
        account: { ok: true, result: { state: 'active', data: data.toBoc().toString('base64'), block_id: { seqno: 12345 } } },
        proposals: { ok: true, result: { exit_code: 0, stack: [list(proposal)] } },
        empty: { ok: true, result: { exit_code: 0, stack: [list()] } },
        hash: hash.toString(16),
    };
}

export function response(payload: unknown, status = 200, retryAfter: string | null = null): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => name.toLowerCase() === 'retry-after' ? retryAfter : null },
        json: async () => payload,
    } as Response;
}
