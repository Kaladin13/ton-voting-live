import { beginCell, Cell, Dictionary } from '@ton/core';
import { buildConfigChangeRows, getProposalSource } from '../dashboard/mainnetVoting';

function cellFromBase64(boc: string): Cell {
  return Cell.fromBoc(Buffer.from(boc, 'base64'))[0];
}

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
  const currentParam29 = cellFromBase64('te6cckEBAQEAJwAAStkBAwAAB9AAAD6AAAAAAwAAAAgAAAAEACAAAACgAAAABQAAJxDM5TwF');
  const proposedParam29 = cellFromBase64('te6cckEBAQEAJwAAStkBAwAAB9AAAD6AAAAAAwAAAAgAAAAEAEAAAACgAAAABQAAJxBGqk4P');
  const currentParam31 = cellFromBase64('te6cckECEAEAASAAAQHAAQIBIAIHAgEgAwYCASAEBQAD37AAQb9mZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZwBCv41cAhCzXa3aohn6xFnboP3vsfrk6XoNB5dzn+BQ1pTKAgEgCAsCAVgJCgBBvyM5sNqqLpTaypagzCYpsGPmuNSPctEPwrDhxfa3YxBGAEG/HTdlZP5vY6qLFFCESWKDqOMcSUuv4djYlFLx3QsjfrYCASAMDwIBIA0OAEG/FD4kDZsgfXEaQxoPYlMKUCnZ//0famrsKSjwSXUmWv4AQb80kxKHyuI+LcFNRO1zGxaMbxEsqcty02MAzivDw037FgBBv1WvtHE3vGL4v2ULAPnKD3VaY4a/yqaWeIMPC9ID7JjRtEus9Q==');
  const proposedParam31 = cellFromBase64('te6cckECEgEAAUgAAQHAAQIBIAIHAgEgAwYCASAEBQAD37AAQb9mZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZwBCv41cAhCzXa3aohn6xFnboP3vsfrk6XoNB5dzn+BQ1pTKAgEgCA0CASAJCgBBv2RpATa2BDDdBnoQVxR7dwRLZGF06VOA3eSZ5mmPQDRpAgEgCwwAQb8jObDaqi6U2sqWoMwmKbBj5rjUj3LRD8Kw4cX2t2MQRgBBvx03ZWT+b2OqixRQhElig6jjHElLr+HY2JRS8d0LI362AgEgDhECASAPEABBvxQ+JA2bIH1xGkMaD2JTClAp2f/9H2pq7Cko8El1Jlr+AEG/NJMSh8riPi3BTUTtcxsWjG8RLKnLctNjAM4rw8NN+xYAQb9Vr7RxN7xi+L9lCwD5yg91WmOGv8qmlniDDwvSA+yY0Zprwv0=');
  const proposedParam46 = cellFromBase64('te6cckEBAQEAKwAAUTYBFj6SNICbWwIYboM9CCuKPbuCJbIwunSpwG7yTPM0x6AaNAAAAARAqAj+qQ==');

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

  it('recognizes the three collator proposals as MTONGA proposals', () => {
    const hashes = [
      '1abefa459593ee1eb5dffc43d2d671dfbc27b451fafc19651bde057e2a0f52bc',
      '4ba153570713eaa0c34d8ea60efd656bfba7008617bf42d7c3cf758bc975fb10',
      '678358ddbb13b1f32b1486543fb64a0dab2d7deb0f63e2477fc7499edb3b980a'
    ];

    expect(hashes.map((hash) => getProposalSource(hash))).toEqual(hashes.map(() => ({
      kind: 'mtonga',
      label: 'MTONGA plan'
    })));
  });

  it('decodes the MTONGA block-size proposal without a raw-cell fallback', () => {
    const rows = buildConfigChangeRows(29, currentParam29, proposedParam29);

    expect(rows).toContainEqual({
      label: 'Max block bytes',
      current: '2,097,152 bytes (2 MiB)',
      proposed: '4,194,304 bytes (4 MiB)'
    });
    expect(rows.some((row) => /Raw cell hash|Preview status/i.test(row.label))).toBe(false);
  });

  it('decodes the MTONGA fundamental-contract proposal without a raw-cell fallback', () => {
    const rows = buildConfigChangeRows(31, currentParam31, proposedParam31);

    expect(rows).toContainEqual({
      label: 'Fundamental address count',
      current: '8 addresses',
      proposed: '9 addresses'
    });
    expect(rows).toContainEqual({
      label: 'Added addresses',
      current: 'None',
      proposed: '-1:9234809b5b02186e833d082b8a3dbb8225b230ba74a9c06ef24cf334c7a01a34'
    });
    expect(rows.some((row) => /Raw cell hash|Preview status/i.test(row.label))).toBe(false);
  });

  it('decodes the MTONGA validator-registry proposal without a raw-cell fallback', () => {
    const rows = buildConfigChangeRows(46, undefined, proposedParam46);

    expect(rows).toEqual([
      {
        label: 'Registry contract',
        current: 'Param not set',
        proposed: '-1:9234809b5b02186e833d082b8a3dbb8225b230ba74a9c06ef24cf334c7a01a34'
      },
      {
        label: 'Max collators per validator',
        current: 'Param not set',
        proposed: '4'
      },
      {
        label: 'Registry code upgrade',
        current: 'Param not set',
        proposed: 'Not scheduled'
      }
    ]);
    expect(rows.some((row) => /Raw cell hash|Preview status/i.test(row.label))).toBe(false);
  });
});
