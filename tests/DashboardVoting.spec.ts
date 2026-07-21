import { beginCell, Cell, Dictionary } from '@ton/core';
import { buildConfigChangeRows } from '../dashboard/mainnetVoting';

function buildSimplexV2(protocolVersion: number): Cell {
  const noncritical = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Uint(32));
  noncritical.set(0, 400);
  noncritical.set(1, 700);
  noncritical.set(13, 300);

  return beginCell()
    .storeUint(0x22, 8)
    .storeUint(0, 5)
    .storeUint(protocolVersion, 2)
    .storeBit(true)
    .storeUint(4, 32)
    .storeDict(noncritical)
    .endCell();
}

function buildParam30(masterchainVersion: number, shardchainVersion: number): Cell {
  return beginCell()
    .storeUint(0x10, 8)
    .storeBit(true)
    .storeBit(true)
    .storeRef(buildSimplexV2(masterchainVersion))
    .storeRef(buildSimplexV2(shardchainVersion))
    .endCell();
}

function buildParam8(version: number, capabilities: bigint): Cell {
  return beginCell()
    .storeUint(0xc4, 8)
    .storeUint(version, 32)
    .storeUint(capabilities, 64)
    .endCell();
}

describe('voting dashboard config diffs', () => {
  it('decodes the current param 30 proposal as protocol upgrades, not flags', () => {
    const rows = buildConfigChangeRows(30, buildParam30(0, 1), buildParam30(2, 2));

    expect(rows).toEqual([
      {
        label: 'Masterchain · Protocol version',
        current: '0 — baseline Simplex protocol',
        proposed: '2 — new DB identity, private-overlay observers, and Plumtree block broadcast'
      },
      {
        label: 'Shardchains · Protocol version',
        current: '1 — dedicated block-sync overlay',
        proposed: '2 — new DB identity, private-overlay observers, and Plumtree block broadcast'
      }
    ]);
    expect(rows.some((row) => /flags|Raw cell hash/i.test(row.label))).toBe(false);
  });

  it('shows only the changed field for the current param 8 proposal', () => {
    const rows = buildConfigChangeRows(8, buildParam8(14, 1006n), buildParam8(15, 1006n));

    expect(rows).toEqual([
      {
        label: 'TVM/network version',
        current: '14',
        proposed: '15'
      }
    ]);
  });
});
