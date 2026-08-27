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
  const proposedParamMinus123 = cellFromBase64('te6cckECFAEAAxUAART/APSkE/S88sgLAQIBIAIQAgFIAwkCAs8ECAP3IMI1xjtRNDXCweS8AHe7UTQ1ywIBPK/0x/TH9cL/yPIzvkWVBBV+RCSXwThAtcsIxxLc6SOMNMf0x/TH9MH10xRJbry4IVRNbry4IYB+CO88uCIAqTIz4QCyx8Tyx8Ty//J7VT7AODXLCOcS3Ok4wLXLCfd1M484wKED4AUGBwCg0x/TH9MfURS68uCFUSS68uCG+CO88uCIAaTIz4QCyx8Syx8Sy//J7VRwAdMH9AWOFdD0BCDXSlFEoASW0wfUAvsA5NEgbuYwIfLgk7ry4JMAuNMf0x/TH9P/10xRJbry4IVRNbry4IYB+CO88uCIUUG98uCU+Cj6RMiLxLRVlfUk9UQVRJT06M8WEsoHy//5FgTQgwjXGNFUFAT5EPLglaTIz4QCyx/LH8v/ye1UAATy8AABIAIBIAoPAgEgCw4CAW4MDQA9rc52omhrhYPJeADvdqJoa5YEAnlf6Y+Y6Y+Y64X/wAA3rx32omhrhYPJeADvdqJoa5YEAnlf6Y+Y64WPwAAxuMl+1E0NcLB5LwAd7tRNDXLAgE8r/XCx+AARvjcvaiaGuFg8AvjygwjXGO1E0NcLB5LwAd7tRNDXLAgE8r/TH9Mf1wv/I8jO+RZUEFX5EJPywIfhAtcsIxxLc6yOOtMf0x/TH9MH10xRJbry4IVRNbry4IYB+CO88uCI+AACpMjPhALLHxPLHxPL/8ntVPgPIHKw8uCJ+wDg1ywjnEtzrOMCERIAtNMf0x/TH1EUuvLghVEkuvLghvgjvPLgiPgAAaTIz4QCyx8Syx8Sy//J7VT4D3AB0wf0BY4b0PQEINdKUUSgBJzTB9QicrDy4IkC+wDk0SBu5jAh8uCTuvLgkwHQidcnjl7TH9Mf0x/T/9dMUSW68uCFUTW68uCGAfgjvPLgiFFBvfLglPgo+kTIi8S0VZX1JPVEFUSU9OjPFhLKB8v/+RYE0IMI1xjRVBQE+RDy4JX4AKTIz4QCyx/LH8v/ye1U4IQP8vATAAj7upnIsNvU9A==');

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

  it('recognizes the latest config proposals as MTONGA proposals', () => {
    const hashes = [
      'cea2327f6b84fca2afb616ed45c042350b80106ece94e5530dac72cbb03b1b98',
      'e5e148027499276e65c48749129ca014bb4e53279b1ac6314d124f4e30166076'
    ];

    expect(hashes.map((hash) => getProposalSource(hash))).toEqual(hashes.map(() => ({
      kind: 'mtonga',
      label: 'MTONGA plan'
    })));
  });

  it('renders the Telegram Wallet contract proposal with source and code hash', () => {
    const rows = buildConfigChangeRows(-123, undefined, proposedParamMinus123);

    expect(rows).toEqual([
      {
        label: 'Shared contract bytecode',
        current: {
          kind: 'contract-code',
          stage: 'Param before',
          title: 'Param not set',
          detail: 'No contract bytecode is currently stored in config[-123].'
        },
        proposed: {
          kind: 'contract-code',
          stage: 'Param after',
          title: 'Telegram Wallet · WalletTg',
          detail: 'Shared contract bytecode loaded by Telegram Wallet contracts from config[-123].',
          codeHash: '6f177fd863213d7bd3b24a694b0b7efb7425721ed1d21490d052ae93276c4406',
          source: {
            label: 'View WalletTg source on GitHub',
            url: 'https://github.com/tolk-vm/tg-wallet-v6/blob/76d7ee5b6882354ffe3a5785eabdc47b76859ce2/contracts/WalletTg/WalletTg.tolk'
          }
        }
      }
    ]);
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
