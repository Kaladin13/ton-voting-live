import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { Address, Cell, Dictionary, Slice } from '@ton/core';
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

type ChangeRow = {
    label: string,
    current: string,
    proposed: string
};

type VsetEntry = {
    idx: number,
    weight: bigint
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
    proposals: Array<{
        hash: string,
        paramId: number,
        paramLabel: string,
        critical: boolean,
        expiresAt: number,
        validatorSetMatchesCurrent: boolean,
        voterCount: number,
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
    }>
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
    15: 'Election timing',
    16: 'Validator limits',
    30: 'Consensus config',
    34: 'Current validator set'
};

const tonApi = new TonApiClient({ baseUrl: 'https://tonapi.io' });
const adapter = new ContractAdapter(tonApi);
const config = adapter.open(Config.createFromAddress(MAINNET_CONFIG_ADDRESS));

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
        proposals: proposals.map((proposal) => {
            const yesWeight = thresholdWeight - proposal.weight_remaining;
            const neededWeight = proposal.weight_remaining > 0n ? proposal.weight_remaining : 0n;
            const rule = proposal.critical ? voteSetup.critical : voteSetup.normal;
            const changeRows = proposal.param_id === 30
                ? buildConsensusChangeRows(cfg.get(30) ? parseNewConsensusConfigAll(getRequiredParam(cfg, 30)) : null, parseNewConsensusConfigAll(proposal.value))
                : null;

            return {
                hash: toHex(proposal.proposalHash),
                paramId: proposal.param_id,
                paramLabel: PARAM_LABELS[proposal.param_id] ?? `Config param ${proposal.param_id}`,
                critical: proposal.critical,
                expiresAt: proposal.expires,
                validatorSetMatchesCurrent: toHex(proposal.vset_id) === currentVsetHash,
                voterCount: proposal.voters.length,
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
        })
    };
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
