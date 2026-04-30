import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { Address, Cell, Dictionary, DictionaryValue, Slice } from '@ton/core';
import { Config } from '../wrappers/Config';
import { getElectionsConf, getValidatorsConf, ValidatorDescriptionValue } from '../wrappers/ValidatorUtils';

type ProposalSetup = {
    min_tot_rounds: number,
    max_tot_rounds: number,
    min_wins: number,
    max_losses: number,
    min_store_sec: number,
    max_store_sec: number,
    bit_price: number,
    cell_price: number
};

type VoteSetup = {
    normal: ProposalSetup,
    critical: ProposalSetup
};

type ConsensusConfig = {
    version: 'simplex_config_v2',
    flags: number,
    use_quic: boolean,
    slots_per_leader_window: number,
    noncritical: Record<string, number>
};

type ConsensusConfigAll = {
    hasMc: boolean,
    hasShard: boolean,
    mc: ConsensusConfig | null,
    shard: ConsensusConfig | null
};

type BlockCreateFees = {
    masterchain_block_fee: bigint,
    basechain_block_fee: bigint
};

type ElectionsTiming = {
    validators_elected_for: number,
    elections_start_before: number,
    elections_end_before: number,
    stake_held_for: number
};

type ValidatorLimitsPreview = {
    max_validators: number,
    max_main_validators: number,
    min_validators: number
};

type StakeLimitsPreview = {
    min_stake: bigint,
    max_stake: bigint,
    min_total_stake: bigint,
    max_stake_factor: number
};

type StoragePrices = {
    utime_since: number,
    bit_price_ps: bigint,
    cell_price_ps: bigint,
    mc_bit_price_ps: bigint,
    mc_cell_price_ps: bigint
};

type StoragePriceEntry = StoragePrices & {
    key: number
};

type GasPrices = {
    kind: 'gas_prices',
    gas_price: bigint,
    gas_limit: bigint,
    gas_credit: bigint,
    block_gas_limit: bigint,
    freeze_due_limit: bigint,
    delete_due_limit: bigint
};

type GasPricesExt = {
    kind: 'gas_prices_ext',
    gas_price: bigint,
    gas_limit: bigint,
    special_gas_limit: bigint,
    gas_credit: bigint,
    block_gas_limit: bigint,
    freeze_due_limit: bigint,
    delete_due_limit: bigint
};

type GasFlatPrefix = {
    kind: 'gas_flat_pfx',
    flat_gas_limit: bigint,
    flat_gas_price: bigint,
    other: GasLimitsPrices
};

type GasLimitsPrices = GasPrices | GasPricesExt | GasFlatPrefix;

type MsgForwardPrices = {
    lump_price: bigint,
    bit_price: bigint,
    cell_price: bigint,
    ihr_price_factor: number,
    first_frac: number,
    next_frac: number
};

type ChangeRow = {
    label: string,
    current: string,
    proposed: string
};

type ProposalSource = {
    kind: 'mtonga' | 'independent',
    label: 'MTONGA plan' | 'Independent community proposal'
};

type ResolvedProposal = {
    hash: string,
    paramId: number,
    paramLabel: string,
    source: ProposalSource,
    status: 'accepted',
    summary: string,
    closedBecause: string,
    changeRows: ChangeRow[]
};

type VsetEntry = {
    idx: number,
    weight: bigint
};

type ActiveProposal = {
    hash: string,
    paramId: number,
    paramLabel: string,
    source: ProposalSource,
    critical: boolean,
    expiresAt: number,
    validatorSetMatchesCurrent: boolean,
    voterCount: number,
    neededValidatorCount: number | null,
    yesWeight: string,
    neededWeight: string,
    totalWeight: string,
    thresholdWeight: string,
    yesPercentOfTotal: string,
    yesPercentOfThreshold: string,
    neededPercentOfTotal: string,
    progressPercent: string,
    roundsRemaining: number,
    wins: number,
    losses: number,
    rule: ProposalSetup,
    summary: string,
    changeRows: ChangeRow[] | null
};

export type VotingSnapshot = {
    fetchedAt: string,
    configContract: {
        raw: string,
        friendly: string,
        tonviewerUrl: string
    },
    validatorRound: {
        currentSetStartsAt: number,
        currentSetEndsAt: number,
        totalValidators: number,
        mainValidators: number,
        totalWeight: string,
        thresholdWeight: string
    },
    votingRules: VoteSetup,
    elections: ReturnType<typeof getElectionsConf>,
    validatorLimits: ReturnType<typeof getValidatorsConf>,
    proposalCount: number,
    resolvedProposal: ResolvedProposal | null,
    proposals: ActiveProposal[]
};

const MAINNET_CONFIG_ADDRESS = Address.parse('Ef9VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVbxn');
const TONVIEWER_CONFIG_URL = 'https://tonviewer.com/config';
const NONCRITICAL_PARAM_NAMES: Record<number, string> = {
    0: 'target_rate_ms',
    1: 'first_block_timeout_ms',
    2: 'first_block_timeout_multiplier_x1000',
    3: 'first_block_timeout_cap_ms',
    4: 'candidate_resolve_timeout_ms',
    5: 'candidate_resolve_timeout_multiplier_x1000',
    6: 'candidate_resolve_timeout_cap_ms',
    7: 'candidate_resolve_cooldown_ms',
    8: 'standstill_timeout_ms',
    9: 'standstill_max_egress_bytes_per_s',
    10: 'max_leader_window_desync',
    11: 'bad_signature_ban_duration_ms',
    12: 'candidate_resolve_rate_limit',
    13: 'min_block_interval_ms',
    14: 'no_empty_blocks_on_error_timeout_ms'
};
const PARAM_LABELS: Record<number, string> = {
    11: 'Voting rules',
    14: 'Block reward',
    15: 'Election timing',
    16: 'Validator limits',
    17: 'Stake limits',
    18: 'Storage prices',
    20: 'Masterchain gas prices',
    21: 'Basechain gas prices',
    24: 'Masterchain message prices',
    25: 'Basechain message prices',
    30: 'Consensus config',
    34: 'Current validator set'
};

const tonApi = new TonApiClient({ baseUrl: 'https://tonapi.io' });
const adapter = new ContractAdapter(tonApi);
const config = adapter.open(Config.createFromAddress(MAINNET_CONFIG_ADDRESS));

const LAST_KNOWN_PROPOSAL_HASH = 'ea1c88dac0a979fa5c4f52037418d8f77f8ef08a73278809bd5879af4c58004f';
const MTONGA_PROPOSAL_HASHES = [
    LAST_KNOWN_PROPOSAL_HASH,
    'b9fc3e68609931713760d0596a3482d9a084c90062d697aee7b420fc1b32a6e5',
    '5ef02b3ad2eb630e050850e88b9eb025a683f73d1f154ecef0a9e8168606d92a',
    '8fb9e0904ed7fc276e2d43e559a6a502f8295a36331e15162207884d207f5685'
];
const MTONGA_PROPOSAL_HASH_SET = new Set(MTONGA_PROPOSAL_HASHES);

const LAST_KNOWN_PROPOSAL = {
    hash: LAST_KNOWN_PROPOSAL_HASH,
    paramId: 30,
    paramLabel: 'Consensus config',
    previousValue: {
        hasMc: false,
        hasShard: true,
        mc: null,
        shard: {
            version: 'simplex_config_v2' as const,
            flags: 0,
            use_quic: false,
            slots_per_leader_window: 4,
            noncritical: {
                target_rate_ms: 800,
                first_block_timeout_ms: 1600
            }
        }
    },
    acceptedValue: {
        hasMc: true,
        hasShard: true,
        mc: {
            version: 'simplex_config_v2' as const,
            flags: 0,
            use_quic: true,
            slots_per_leader_window: 4,
            noncritical: {
                target_rate_ms: 400,
                first_block_timeout_ms: 700,
                min_block_interval_ms: 300
            }
        },
        shard: {
            version: 'simplex_config_v2' as const,
            flags: 0,
            use_quic: true,
            slots_per_leader_window: 4,
            noncritical: {
                target_rate_ms: 400,
                first_block_timeout_ms: 700,
                min_block_interval_ms: 300
            }
        }
    }
};

export async function fetchMainnetVotingSnapshot(): Promise<VotingSnapshot> {
    const cfg = await config.getConfig();
    const proposals = await config.getListedProposals();
    const voteSetup = parseVoteSetup(getRequiredParam(cfg, 11));
    const elections = getElectionsConf(cfg);
    const validatorLimits = getValidatorsConf(cfg);
    const currentVsetCell = getRequiredParam(cfg, 34);
    const currentVsetHash = currentVsetCell.hash().toString('hex');
    const currentVset = parseVsetWithIndexes(currentVsetCell);
    const thresholdWeight = (currentVset.total_weight * 3n) / 4n;
    const currentConsensus = parseNewConsensusConfigAll(getRequiredParam(cfg, 30));
    const activeProposalHashes = new Set(proposals.map((proposal) => toHex(proposal.proposalHash)));
    const activeProposals = proposals.map((proposal) => {
        const hash = toHex(proposal.proposalHash);
        const yesWeight = thresholdWeight - proposal.weight_remaining;
        const neededWeight = proposal.weight_remaining > 0n ? proposal.weight_remaining : 0n;
        const rule = proposal.critical ? voteSetup.critical : voteSetup.normal;
        const changeRows = buildConfigChangeRows(proposal.param_id, cfg.get(proposal.param_id), proposal.value);
        const validatorSetMatchesCurrent = toHex(proposal.vset_id) === currentVsetHash;

        return {
            hash,
            paramId: proposal.param_id,
            paramLabel: PARAM_LABELS[proposal.param_id] ?? `Config param ${proposal.param_id}`,
            source: getProposalSource(hash),
            critical: proposal.critical,
            expiresAt: proposal.expires,
            validatorSetMatchesCurrent,
            voterCount: proposal.voters.length,
            neededValidatorCount: validatorSetMatchesCurrent
                ? countValidatorsNeededForWeight(currentVset.list, proposal.voters, neededWeight)
                : null,
            yesWeight: yesWeight.toString(),
            neededWeight: neededWeight.toString(),
            totalWeight: currentVset.total_weight.toString(),
            thresholdWeight: thresholdWeight.toString(),
            yesPercentOfTotal: formatPercent(yesWeight, currentVset.total_weight),
            yesPercentOfThreshold: formatPercent(yesWeight, thresholdWeight),
            neededPercentOfTotal: formatPercent(neededWeight, currentVset.total_weight),
            progressPercent: clampPercent(formatPercent(yesWeight, thresholdWeight)),
            roundsRemaining: proposal.rounds_remaining,
            wins: proposal.wins,
            losses: proposal.losses,
            rule,
            summary: buildSummary({
                critical: proposal.critical,
                paramLabel: PARAM_LABELS[proposal.param_id] ?? `config param ${proposal.param_id}`,
                voterCount: proposal.voters.length,
                totalValidators: currentVset.total,
                yesPercentOfTotal: formatPercent(yesWeight, currentVset.total_weight),
                neededPercentOfTotal: formatPercent(neededWeight, currentVset.total_weight),
                wins: proposal.wins,
                minWins: rule.min_wins,
                losses: proposal.losses,
                maxLosses: rule.max_losses
            }),
            changeRows
        };
    }).sort(compareProposalPriority);

    return {
        fetchedAt: new Date().toISOString(),
        configContract: {
            raw: MAINNET_CONFIG_ADDRESS.toRawString(),
            friendly: MAINNET_CONFIG_ADDRESS.toString(),
            tonviewerUrl: TONVIEWER_CONFIG_URL
        },
        validatorRound: {
            currentSetStartsAt: currentVset.utime_since,
            currentSetEndsAt: currentVset.utime_until,
            totalValidators: currentVset.total,
            mainValidators: currentVset.main,
            totalWeight: currentVset.total_weight.toString(),
            thresholdWeight: thresholdWeight.toString()
        },
        votingRules: voteSetup,
        elections,
        validatorLimits,
        proposalCount: proposals.length,
        resolvedProposal: buildResolvedProposal(activeProposalHashes, currentConsensus),
        proposals: activeProposals
    };
}

function buildResolvedProposal(activeProposalHashes: Set<string>, currentConsensus: ConsensusConfigAll): ResolvedProposal | null {
    if (activeProposalHashes.has(LAST_KNOWN_PROPOSAL.hash)) {
        return null;
    }

    if (!consensusConfigAllEquals(currentConsensus, LAST_KNOWN_PROPOSAL.acceptedValue)) {
        return null;
    }

    return {
        hash: LAST_KNOWN_PROPOSAL.hash,
        paramId: LAST_KNOWN_PROPOSAL.paramId,
        paramLabel: LAST_KNOWN_PROPOSAL.paramLabel,
        source: getProposalSource(LAST_KNOWN_PROPOSAL.hash),
        status: 'accepted',
        summary: 'This proposal was accepted and applied on-chain. Param 30 now matches the payload that previously appeared in active voting.',
        closedBecause: 'The proposal is gone from the active get-method list, and the live config value now matches its proposed state.',
        changeRows: buildConsensusChangeRows(LAST_KNOWN_PROPOSAL.previousValue, LAST_KNOWN_PROPOSAL.acceptedValue)
    };
}

function getProposalSource(hash: string): ProposalSource {
    if (MTONGA_PROPOSAL_HASH_SET.has(hash)) {
        return {
            kind: 'mtonga',
            label: 'MTONGA plan'
        };
    }

    return {
        kind: 'independent',
        label: 'Independent community proposal'
    };
}

function compareProposalPriority(left: ActiveProposal, right: ActiveProposal) {
    return proposalSourcePriority(left.source) - proposalSourcePriority(right.source);
}

function proposalSourcePriority(source: ProposalSource) {
    return source.kind === 'mtonga' ? 0 : 1;
}

function countValidatorsNeededForWeight(vset: VsetEntry[], voters: number[], neededWeight: bigint) {
    if (neededWeight <= 0n) {
        return 0;
    }

    const voted = new Set(voters);
    let accumulated = 0n;
    let count = 0;
    const remaining = vset
        .filter((entry) => !voted.has(entry.idx))
        .sort((left, right) => compareBigintDesc(left.weight, right.weight));

    for (const entry of remaining) {
        accumulated += entry.weight;
        count += 1;

        if (accumulated >= neededWeight) {
            return count;
        }
    }

    return null;
}

function compareBigintDesc(left: bigint, right: bigint) {
    if (left === right) {
        return 0;
    }
    return left > right ? -1 : 1;
}

function buildConfigChangeRows(paramId: number, current: Cell | undefined, proposed: Cell): ChangeRow[] {
    try {
        switch (paramId) {
            case 11:
                return buildVoteSetupChangeRows(current ? parseVoteSetup(current) : null, parseVoteSetup(proposed));
            case 14:
                return buildBlockCreateFeeChangeRows(current ? parseBlockCreateFees(current) : null, parseBlockCreateFees(proposed));
            case 15:
                return buildElectionTimingChangeRows(current ? parseElectionsTiming(current) : null, parseElectionsTiming(proposed));
            case 16:
                return buildValidatorLimitsChangeRows(current ? parseValidatorLimits(current) : null, parseValidatorLimits(proposed));
            case 17:
                return buildStakeLimitChangeRows(current ? parseStakeLimits(current) : null, parseStakeLimits(proposed));
            case 18:
                return buildStoragePriceChangeRows(current ? parseStoragePrices(current) : null, parseStoragePrices(proposed));
            case 20:
            case 21:
                return buildGasLimitPriceChangeRows(current ? parseGasLimitsPrices(current) : null, parseGasLimitsPrices(proposed));
            case 24:
            case 25:
                return buildMsgForwardPriceChangeRows(current ? parseMsgForwardPrices(current) : null, parseMsgForwardPrices(proposed));
            case 30:
                return buildConsensusChangeRows(current ? parseNewConsensusConfigAll(current) : null, parseNewConsensusConfigAll(proposed));
            default:
                return buildFallbackChangeRows(current ?? null, proposed);
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown decode error';
        return buildFallbackChangeRows(current ?? null, proposed, `Structured preview unavailable: ${reason}`);
    }
}

function getRequiredParam(configDict: MapLikeConfig, id: number): Cell {
    const value = configDict.get(id);
    if (!value) {
        throw new Error(`Missing config param ${id}`);
    }
    return value;
}

type MapLikeConfig = {
    get(key: number): Cell | undefined
};

function parseVoteSetup(cell: Cell): VoteSetup {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0x91) {
        throw new Error(`Unexpected vote setup tag: ${tag}`);
    }
    return {
        normal: parseProposalSetup(slice.loadRef()),
        critical: parseProposalSetup(slice.loadRef())
    };
}

function parseProposalSetup(cell: Cell): ProposalSetup {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0x36) {
        throw new Error(`Unexpected proposal setup tag: ${tag}`);
    }
    return {
        min_tot_rounds: slice.loadUint(8),
        max_tot_rounds: slice.loadUint(8),
        min_wins: slice.loadUint(8),
        max_losses: slice.loadUint(8),
        min_store_sec: slice.loadUint(32),
        max_store_sec: slice.loadUint(32),
        bit_price: slice.loadUint(32),
        cell_price: slice.loadUint(32)
    };
}

function parseBlockCreateFees(cell: Cell): BlockCreateFees {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0x6b) {
        throw new Error(`Unexpected config param 14 tag: ${tag}`);
    }

    return {
        masterchain_block_fee: slice.loadCoins(),
        basechain_block_fee: slice.loadCoins()
    };
}

function parseElectionsTiming(cell: Cell): ElectionsTiming {
    const slice = cell.beginParse();
    return {
        validators_elected_for: slice.loadUint(32),
        elections_start_before: slice.loadUint(32),
        elections_end_before: slice.loadUint(32),
        stake_held_for: slice.loadUint(32)
    };
}

function parseValidatorLimits(cell: Cell): ValidatorLimitsPreview {
    const slice = cell.beginParse();
    return {
        max_validators: slice.loadUint(16),
        max_main_validators: slice.loadUint(16),
        min_validators: slice.loadUint(16)
    };
}

function parseStakeLimits(cell: Cell): StakeLimitsPreview {
    const slice = cell.beginParse();
    return {
        min_stake: slice.loadCoins(),
        max_stake: slice.loadCoins(),
        min_total_stake: slice.loadCoins(),
        max_stake_factor: slice.loadUint(32)
    };
}

const StoragePricesValue: DictionaryValue<StoragePrices> = {
    serialize: () => {
        throw new Error('StoragePrices serialization is not used');
    },
    parse: (source) => {
        const tag = source.loadUint(8);
        if (tag !== 0xcc) {
            throw new Error(`Unexpected storage prices tag: ${tag}`);
        }

        return {
            utime_since: source.loadUint(32),
            bit_price_ps: source.loadUintBig(64),
            cell_price_ps: source.loadUintBig(64),
            mc_bit_price_ps: source.loadUintBig(64),
            mc_cell_price_ps: source.loadUintBig(64)
        };
    }
};

function parseStoragePrices(cell: Cell): StoragePriceEntry[] {
    return Array.from(
        cell.beginParse().loadDictDirect(Dictionary.Keys.Uint(32), StoragePricesValue),
        ([key, value]) => ({ key, ...value })
    ).sort((left, right) => left.utime_since - right.utime_since);
}

function parseGasLimitsPrices(cell: Cell): GasLimitsPrices {
    return parseGasLimitsPricesSlice(cell.beginParse());
}

function parseGasLimitsPricesSlice(slice: Slice): GasLimitsPrices {
    const tag = slice.loadUint(8);
    if (tag === 0xd1) {
        return {
            kind: 'gas_flat_pfx',
            flat_gas_limit: slice.loadUintBig(64),
            flat_gas_price: slice.loadUintBig(64),
            other: parseGasLimitsPricesSlice(slice)
        };
    }

    if (tag === 0xdd) {
        return {
            kind: 'gas_prices',
            gas_price: slice.loadUintBig(64),
            gas_limit: slice.loadUintBig(64),
            gas_credit: slice.loadUintBig(64),
            block_gas_limit: slice.loadUintBig(64),
            freeze_due_limit: slice.loadUintBig(64),
            delete_due_limit: slice.loadUintBig(64)
        };
    }

    if (tag === 0xde) {
        return {
            kind: 'gas_prices_ext',
            gas_price: slice.loadUintBig(64),
            gas_limit: slice.loadUintBig(64),
            special_gas_limit: slice.loadUintBig(64),
            gas_credit: slice.loadUintBig(64),
            block_gas_limit: slice.loadUintBig(64),
            freeze_due_limit: slice.loadUintBig(64),
            delete_due_limit: slice.loadUintBig(64)
        };
    }

    throw new Error(`Unexpected gas prices tag: ${tag}`);
}

function parseMsgForwardPrices(cell: Cell): MsgForwardPrices {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0xea) {
        throw new Error(`Unexpected message forward prices tag: ${tag}`);
    }

    return {
        lump_price: slice.loadUintBig(64),
        bit_price: slice.loadUintBig(64),
        cell_price: slice.loadUintBig(64),
        ihr_price_factor: slice.loadUint(32),
        first_frac: slice.loadUint(16),
        next_frac: slice.loadUint(16)
    };
}

function parseVsetWithIndexes(cell: Cell) {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0x12) {
        throw new Error(`Unexpected validator set tag: ${tag}`);
    }

    return {
        utime_since: slice.loadUint(32),
        utime_until: slice.loadUint(32),
        total: slice.loadUint(16),
        main: slice.loadUint(16),
        total_weight: slice.loadUintBig(64),
        list: Array.from(
            slice.loadDict(Dictionary.Keys.Uint(16), ValidatorDescriptionValue),
            ([idx, entry]) => ({ idx, weight: entry.weight })
        ) as VsetEntry[]
    };
}

function parseNewConsensusConfigAll(cell: Cell): ConsensusConfigAll {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0x10) {
        throw new Error(`Unexpected config param 30 tag: ${tag}`);
    }
    const hasMc = slice.loadBit();
    const hasShard = slice.loadBit();

    return {
        hasMc,
        hasShard,
        mc: hasMc ? parseNewConsensusConfig(slice.loadRef().beginParse()) : null,
        shard: hasShard ? parseNewConsensusConfig(slice.loadRef().beginParse()) : null
    };
}

function parseNewConsensusConfig(slice: Slice): ConsensusConfig {
    const tag = slice.loadUint(8);
    if (tag !== 0x22) {
        throw new Error(`Unexpected new consensus tag: ${tag}`);
    }
    const flags = slice.loadUint(7);
    const use_quic = slice.loadBit();
    const slots_per_leader_window = slice.loadUint(32);
    const noncritical = Object.fromEntries(
        Array.from(
            slice.loadDict(Dictionary.Keys.Uint(8), Dictionary.Values.Uint(32)),
            ([key, value]) => [NONCRITICAL_PARAM_NAMES[key] ?? `param_${key}`, Number(value)]
        )
    );

    return {
        version: 'simplex_config_v2',
        flags,
        use_quic,
        slots_per_leader_window,
        noncritical
    };
}

function buildConsensusChangeRows(current: ConsensusConfigAll | null, proposed: ConsensusConfigAll): ChangeRow[] {
    return [
        {
            label: 'Masterchain',
            current: describeConsensusSide(current?.mc ?? null),
            proposed: describeConsensusSide(proposed.mc)
        },
        {
            label: 'Shardchains',
            current: describeConsensusSide(current?.shard ?? null),
            proposed: describeConsensusSide(proposed.shard)
        }
    ];
}

function buildVoteSetupChangeRows(current: VoteSetup | null, proposed: VoteSetup): ChangeRow[] {
    return [
        {
            label: 'Normal proposal rules',
            current: current ? describeProposalSetup(current.normal) : 'Param not set',
            proposed: describeProposalSetup(proposed.normal)
        },
        {
            label: 'Critical proposal rules',
            current: current ? describeProposalSetup(current.critical) : 'Param not set',
            proposed: describeProposalSetup(proposed.critical)
        }
    ];
}

function buildBlockCreateFeeChangeRows(current: BlockCreateFees | null, proposed: BlockCreateFees): ChangeRow[] {
    return [
        {
            label: 'Masterchain block reward',
            current: current ? formatTonAmount(current.masterchain_block_fee) : 'Param not set',
            proposed: formatTonAmount(proposed.masterchain_block_fee)
        },
        {
            label: 'Basechain block reward',
            current: current ? formatTonAmount(current.basechain_block_fee) : 'Param not set',
            proposed: formatTonAmount(proposed.basechain_block_fee)
        }
    ];
}

function buildElectionTimingChangeRows(current: ElectionsTiming | null, proposed: ElectionsTiming): ChangeRow[] {
    return [
        {
            label: 'Validator set lifetime',
            current: current ? formatDuration(current.validators_elected_for) : 'Param not set',
            proposed: formatDuration(proposed.validators_elected_for)
        },
        {
            label: 'Elections start before round end',
            current: current ? formatDuration(current.elections_start_before) : 'Param not set',
            proposed: formatDuration(proposed.elections_start_before)
        },
        {
            label: 'Elections close before round end',
            current: current ? formatDuration(current.elections_end_before) : 'Param not set',
            proposed: formatDuration(proposed.elections_end_before)
        },
        {
            label: 'Stake hold period',
            current: current ? formatDuration(current.stake_held_for) : 'Param not set',
            proposed: formatDuration(proposed.stake_held_for)
        }
    ];
}

function buildValidatorLimitsChangeRows(current: ValidatorLimitsPreview | null, proposed: ValidatorLimitsPreview): ChangeRow[] {
    return [
        {
            label: 'Max validators',
            current: current ? String(current.max_validators) : 'Param not set',
            proposed: String(proposed.max_validators)
        },
        {
            label: 'Max main validators',
            current: current ? String(current.max_main_validators) : 'Param not set',
            proposed: String(proposed.max_main_validators)
        },
        {
            label: 'Min validators',
            current: current ? String(current.min_validators) : 'Param not set',
            proposed: String(proposed.min_validators)
        }
    ];
}

function buildStakeLimitChangeRows(current: StakeLimitsPreview | null, proposed: StakeLimitsPreview): ChangeRow[] {
    return [
        {
            label: 'Minimum stake',
            current: current ? formatTonAmount(current.min_stake) : 'Param not set',
            proposed: formatTonAmount(proposed.min_stake)
        },
        {
            label: 'Maximum stake',
            current: current ? formatTonAmount(current.max_stake) : 'Param not set',
            proposed: formatTonAmount(proposed.max_stake)
        },
        {
            label: 'Minimum total stake',
            current: current ? formatTonAmount(current.min_total_stake) : 'Param not set',
            proposed: formatTonAmount(proposed.min_total_stake)
        },
        {
            label: 'Max stake factor',
            current: current ? String(current.max_stake_factor) : 'Param not set',
            proposed: String(proposed.max_stake_factor)
        }
    ];
}

function buildStoragePriceChangeRows(current: StoragePriceEntry[] | null, proposed: StoragePriceEntry[]): ChangeRow[] {
    return [
        {
            label: 'Storage price periods',
            current: current ? formatPlural(current.length, 'period') : 'Param not set',
            proposed: formatPlural(proposed.length, 'period')
        },
        {
            label: 'Basechain storage prices',
            current: current ? describeStoragePriceSchedule(current, false) : 'Param not set',
            proposed: describeStoragePriceSchedule(proposed, false)
        },
        {
            label: 'Masterchain storage prices',
            current: current ? describeStoragePriceSchedule(current, true) : 'Param not set',
            proposed: describeStoragePriceSchedule(proposed, true)
        }
    ];
}

function buildGasLimitPriceChangeRows(current: GasLimitsPrices | null, proposed: GasLimitsPrices): ChangeRow[] {
    const currentFlat = current ? getGasFlatPrefix(current) : null;
    const proposedFlat = getGasFlatPrefix(proposed);
    const currentPrices = current ? unwrapGasLimitsPrices(current) : null;
    const proposedPrices = unwrapGasLimitsPrices(proposed);
    const rows: ChangeRow[] = [];

    if (currentFlat || proposedFlat) {
        rows.push({
            label: 'Flat gas package',
            current: currentFlat ? describeGasFlatPrefix(currentFlat) : 'Not set',
            proposed: proposedFlat ? describeGasFlatPrefix(proposedFlat) : 'Not set'
        });
    }

    rows.push(
        {
            label: 'Gas price',
            current: currentPrices ? formatScaledNanotonPerUnit(currentPrices.gas_price, 'gas') : 'Param not set',
            proposed: formatScaledNanotonPerUnit(proposedPrices.gas_price, 'gas')
        },
        {
            label: 'Transaction gas limit',
            current: currentPrices ? formatCount(currentPrices.gas_limit) : 'Param not set',
            proposed: formatCount(proposedPrices.gas_limit)
        },
        {
            label: 'Special contract gas limit',
            current: currentPrices ? describeSpecialGasLimit(currentPrices) : 'Param not set',
            proposed: describeSpecialGasLimit(proposedPrices)
        },
        {
            label: 'External message gas credit',
            current: currentPrices ? formatCount(currentPrices.gas_credit) : 'Param not set',
            proposed: formatCount(proposedPrices.gas_credit)
        },
        {
            label: 'Block gas limit',
            current: currentPrices ? formatCount(currentPrices.block_gas_limit) : 'Param not set',
            proposed: formatCount(proposedPrices.block_gas_limit)
        },
        {
            label: 'Freeze due limit',
            current: currentPrices ? formatNanotonAmount(currentPrices.freeze_due_limit) : 'Param not set',
            proposed: formatNanotonAmount(proposedPrices.freeze_due_limit)
        },
        {
            label: 'Delete due limit',
            current: currentPrices ? formatNanotonAmount(currentPrices.delete_due_limit) : 'Param not set',
            proposed: formatNanotonAmount(proposedPrices.delete_due_limit)
        }
    );

    return rows;
}

function buildMsgForwardPriceChangeRows(current: MsgForwardPrices | null, proposed: MsgForwardPrices): ChangeRow[] {
    return [
        {
            label: 'Base forwarding fee',
            current: current ? formatNanotonAmount(current.lump_price) : 'Param not set',
            proposed: formatNanotonAmount(proposed.lump_price)
        },
        {
            label: 'Bit forwarding price',
            current: current ? formatScaledNanotonPerUnit(current.bit_price, 'bit') : 'Param not set',
            proposed: formatScaledNanotonPerUnit(proposed.bit_price, 'bit')
        },
        {
            label: 'Cell forwarding price',
            current: current ? formatScaledNanotonPerUnit(current.cell_price, 'cell') : 'Param not set',
            proposed: formatScaledNanotonPerUnit(proposed.cell_price, 'cell')
        },
        {
            label: 'IHR price factor',
            current: current ? formatFractionFactor(current.ihr_price_factor) : 'Param not set',
            proposed: formatFractionFactor(proposed.ihr_price_factor)
        },
        {
            label: 'First route fee share',
            current: current ? formatFractionPercent(current.first_frac) : 'Param not set',
            proposed: formatFractionPercent(proposed.first_frac)
        },
        {
            label: 'Next route fee share',
            current: current ? formatFractionPercent(current.next_frac) : 'Param not set',
            proposed: formatFractionPercent(proposed.next_frac)
        }
    ];
}

function buildFallbackChangeRows(current: Cell | null, proposed: Cell, note?: string): ChangeRow[] {
    const rows: ChangeRow[] = [];

    if (note) {
        rows.push({
            label: 'Preview status',
            current: 'No parser for this config payload',
            proposed: note
        });
    }

    rows.push({
        label: 'Raw cell hash',
        current: current ? current.hash().toString('hex') : 'Param not set',
        proposed: proposed.hash().toString('hex')
    });

    rows.push({
        label: 'Serialized size',
        current: current ? `${current.toBoc().length} bytes` : 'Param not set',
        proposed: `${proposed.toBoc().length} bytes`
    });

    return rows;
}

function consensusConfigAllEquals(left: ConsensusConfigAll | null, right: ConsensusConfigAll | null) {
    if (!left || !right) {
        return left === right;
    }

    return left.hasMc === right.hasMc
        && left.hasShard === right.hasShard
        && consensusConfigEquals(left.mc, right.mc)
        && consensusConfigEquals(left.shard, right.shard);
}

function consensusConfigEquals(left: ConsensusConfig | null, right: ConsensusConfig | null) {
    if (!left || !right) {
        return left === right;
    }

    return left.version === right.version
        && left.flags === right.flags
        && left.use_quic === right.use_quic
        && left.slots_per_leader_window === right.slots_per_leader_window
        && recordEquals(left.noncritical, right.noncritical);
}

function recordEquals(left: Record<string, number>, right: Record<string, number>) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function describeConsensusSide(side: ConsensusConfig | null): string {
    if (!side) {
        return 'Not set';
    }

    const details = [
        `QUIC ${side.use_quic ? 'on' : 'off'}`,
        `${side.slots_per_leader_window} slots/window`
    ];

    if (typeof side.noncritical.target_rate_ms === 'number') {
        details.push(`${side.noncritical.target_rate_ms} ms target`);
    }
    if (typeof side.noncritical.first_block_timeout_ms === 'number') {
        details.push(`${side.noncritical.first_block_timeout_ms} ms first timeout`);
    }
    if (typeof side.noncritical.min_block_interval_ms === 'number') {
        details.push(`${side.noncritical.min_block_interval_ms} ms min interval`);
    }

    return details.join(', ');
}

function describeProposalSetup(setup: ProposalSetup): string {
    return `${setup.min_wins} wins, up to ${setup.max_tot_rounds} rounds, max ${setup.max_losses} losses, keep ${formatDuration(setup.min_store_sec)} to ${formatDuration(setup.max_store_sec)}`;
}

function describeStoragePriceSchedule(entries: StoragePriceEntry[], masterchain: boolean) {
    return entries
        .map((entry) => {
            const bitPrice = masterchain ? entry.mc_bit_price_ps : entry.bit_price_ps;
            const cellPrice = masterchain ? entry.mc_cell_price_ps : entry.cell_price_ps;
            return `${formatStoragePeriodStart(entry.utime_since)}: ${formatStoragePrice(bitPrice, 'bit')}, ${formatStoragePrice(cellPrice, 'cell')}`;
        })
        .join('\n');
}

function formatStoragePeriodStart(unixTime: number) {
    if (unixTime === 0) {
        return 'from genesis';
    }
    return `from ${formatUnixUtc(unixTime)}`;
}

function formatStoragePrice(value: bigint, unit: string) {
    return `${formatCount(value)} nanoton/${unit}/65536s`;
}

function describeGasFlatPrefix(config: GasFlatPrefix) {
    return `${formatCount(config.flat_gas_limit)} gas for ${formatNanotonAmount(config.flat_gas_price)}`;
}

function getGasFlatPrefix(config: GasLimitsPrices): GasFlatPrefix | null {
    return config.kind === 'gas_flat_pfx' ? config : null;
}

function unwrapGasLimitsPrices(config: GasLimitsPrices): GasPrices | GasPricesExt {
    return config.kind === 'gas_flat_pfx' ? unwrapGasLimitsPrices(config.other) : config;
}

function describeSpecialGasLimit(config: GasPrices | GasPricesExt) {
    return config.kind === 'gas_prices_ext' ? formatCount(config.special_gas_limit) : 'Not set';
}

function formatTonAmount(value: bigint): string {
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const whole = absolute / 1_000_000_000n;
    const fraction = (absolute % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
    const rendered = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
    return `${negative ? '-' : ''}${rendered} TON`;
}

function formatNanotonAmount(value: bigint): string {
    return `${formatCount(value)} nanoton (${formatTonAmount(value)})`;
}

function formatScaledNanotonPerUnit(value: bigint, unit: string): string {
    return `${formatFixedRatio(value, 65_536n, 6)} nanoton/${unit}`;
}

function formatFractionFactor(value: number): string {
    return `${formatFixedRatio(BigInt(value), 65_536n, 4)}x`;
}

function formatFractionPercent(value: number): string {
    return `${formatFixedRatio(BigInt(value) * 100n, 65_536n, 2)}%`;
}

function formatFixedRatio(numerator: bigint, denominator: bigint, decimals: number): string {
    if (denominator === 0n) {
        return '0';
    }

    const scale = 10n ** BigInt(decimals);
    const scaled = (numerator * scale + denominator / 2n) / denominator;
    const whole = scaled / scale;
    const fraction = (scaled % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? `${formatCount(whole)}.${fraction}` : formatCount(whole);
}

function formatCount(value: bigint | number) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPlural(count: number, singular: string) {
    return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatUnixUtc(unixTime: number) {
    const date = new Date(unixTime * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function formatDuration(seconds: number): string {
    if (seconds === 0) {
        return '0s';
    }

    const parts: string[] = [];
    let remaining = seconds;
    const units: Array<[string, number]> = [
        ['d', 86400],
        ['h', 3600],
        ['m', 60],
        ['s', 1]
    ];

    for (const [suffix, unitSeconds] of units) {
        if (remaining < unitSeconds) {
            continue;
        }

        const amount = Math.floor(remaining / unitSeconds);
        remaining %= unitSeconds;
        parts.push(`${amount}${suffix}`);

        if (parts.length === 2) {
            break;
        }
    }

    return parts.join(' ');
}

function buildSummary(args: {
    critical: boolean,
    paramLabel: string,
    voterCount: number,
    totalValidators: number,
    yesPercentOfTotal: string,
    neededPercentOfTotal: string,
    wins: number,
    minWins: number,
    losses: number,
    maxLosses: number
}) {
    const importance = args.critical ? 'Critical' : 'Non-critical';
    return `${importance} ${args.paramLabel.toLowerCase()} proposal. ${args.voterCount} of ${args.totalValidators} validators have voted so far, contributing ${args.yesPercentOfTotal}% of total validator weight. This round still needs ${args.neededPercentOfTotal}% more total weight. It has ${args.wins}/${args.minWins} required wins and ${args.losses}/${args.maxLosses} allowed losses.`;
}

function toHex(value: bigint) {
    return value.toString(16).padStart(64, '0');
}

function formatPercent(part: bigint, whole: bigint, decimals = 2) {
    if (whole === 0n) {
        return '0.00';
    }
    const negative = part < 0n;
    const absPart = negative ? -part : part;
    const scale = 10n ** BigInt(decimals);
    const scaled = (absPart * 100n * scale + whole / 2n) / whole;
    const integer = scaled / scale;
    const fraction = scaled % scale;
    return `${negative ? '-' : ''}${integer.toString()}.${fraction.toString().padStart(decimals, '0')}`;
}

function clampPercent(value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '0.00';
    }
    return Math.max(0, Math.min(100, numeric)).toFixed(2);
}
