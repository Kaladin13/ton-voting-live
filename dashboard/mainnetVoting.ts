import { TonApiClient } from '@ton-api/client';
import { ContractAdapter } from '@ton-api/ton-adapter';
import { Address, Cell, Dictionary, DictionaryValue, Slice, TupleReader } from '@ton/core';
import { Config, type ConfigProposalStatus } from '../wrappers/Config';
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

type SimplexConsensusConfig = {
    version: 'simplex_config',
    flags: number,
    use_quic: boolean,
    target_rate_ms: number,
    slots_per_leader_window: number,
    first_block_timeout_ms: number,
    max_leader_window_desync: number
};

type SimplexConsensusConfigV2 = {
    version: 'simplex_config_v2',
    flags: number,
    protocol_version: number,
    use_quic: boolean,
    slots_per_leader_window: number,
    noncritical: Record<number, number>
};

type ConsensusConfig = SimplexConsensusConfig | SimplexConsensusConfigV2;

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

type GlobalVersion = {
    version: number,
    capabilities: bigint
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

type BlockConsensusConfig = {
    version: 'consensus_config' | 'consensus_config_new' | 'consensus_config_v3' | 'consensus_config_v4',
    flags: number | null,
    use_quic: boolean | null,
    new_catchain_ids: boolean | null,
    round_candidates: number,
    next_candidate_delay_ms: number,
    consensus_timeout_ms: number,
    fast_attempts: number,
    attempt_duration: number,
    catchain_max_deps: number,
    max_block_bytes: number,
    max_collated_bytes: number,
    proto_version: number | null,
    catchain_max_blocks_coeff: number | null
};

type SizeLimitsConfig = {
    version: 'size_limits_config' | 'size_limits_config_v2',
    max_msg_bits: number,
    max_msg_cells: number,
    max_library_cells: number,
    max_vm_data_depth: number,
    max_ext_msg_size: number,
    max_ext_msg_depth: number,
    max_acc_state_cells: number | null,
    max_mc_acc_state_cells: number | null,
    max_acc_public_libraries: number | null,
    defer_out_queue_size_limit: number | null,
    max_msg_extra_currencies: number | null,
    max_acc_fixed_prefix_length: number | null,
    acc_state_cells_for_storage_dict: number | null,
    max_transaction_library_loads: number | null
};

type ValidatorRegistryConfig = {
    contract_address: bigint,
    max_collators_per_validator: number,
    new_code_hash: bigint | null
};

type OracleBridgeParams = {
    bridge_address: bigint,
    oracle_multisig_address: bigint,
    oracle_count: number,
    external_chain_address: bigint
};

type JettonBridgePrices = {
    bridge_burn_fee: bigint,
    bridge_mint_fee: bigint,
    wallet_min_tons_for_storage: bigint,
    wallet_gas_consumption: bigint,
    minter_min_tons_for_storage: bigint,
    discover_gas_consumption: bigint
};

type JettonBridgeParams = {
    version: 'jetton_bridge_params_v0' | 'jetton_bridge_params_v1',
    bridge_address: bigint,
    oracles_address: bigint,
    oracle_count: number,
    state_flags: number,
    burn_bridge_fee: bigint | null,
    prices: JettonBridgePrices | null,
    external_chain_address: bigint | null
};

type WorkchainFormat = {
    kind: 'basic',
    vm_version: number,
    vm_mode: bigint
} | {
    kind: 'extended',
    min_addr_len: number,
    max_addr_len: number,
    addr_len_step: number,
    workchain_type_id: number
};

type WorkchainSplitMergeTimings = {
    split_merge_delay: number,
    split_merge_interval: number,
    min_split_merge_interval: number,
    max_split_merge_delay: number
};

type WorkchainDescription = {
    version: 'workchain' | 'workchain_v2',
    enabled_since: number,
    actual_min_split: number,
    min_split: number,
    max_split: number,
    basic: boolean,
    active: boolean,
    accept_msgs: boolean,
    flags: number,
    zerostate_root_hash: string,
    zerostate_file_hash: string,
    workchain_version: number,
    format: WorkchainFormat,
    split_merge_timings: WorkchainSplitMergeTimings | null,
    persistent_state_split_depth: number | null
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
    publicKey: string,
    adnlAddress: string | null,
    weight: bigint
};

type IndexedValidatorSet = {
    utime_since: number,
    utime_until: number,
    total: number,
    main: number,
    total_weight: bigint,
    list: VsetEntry[]
};

type ProposalVoter = {
    index: number,
    publicKey: string | null,
    adnlAddress: string | null,
    role: 'main' | 'shard' | null,
    weight: string | null,
    weightPercentOfSet: string | null
};

type ActiveProposal = {
    hash: string,
    paramId: number,
    paramLabel: string,
    source: ProposalSource,
    critical: boolean,
    expiresAt: number,
    validatorSetMatchesCurrent: boolean,
    voterSetResolved: boolean,
    voterCount: number,
    voters: ProposalVoter[],
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
    resolvedProposals: ResolvedProposal[],
    proposals: ActiveProposal[]
};

type KnownConfigResolvedProposal = {
    hash: string,
    paramId: number,
    paramLabel: string,
    previousValue?: Cell,
    acceptedValue?: Cell,
    acceptedValueHash?: string,
    summary: string,
    closedBecause: string
};

const MAINNET_CONFIG_ADDRESS = Address.parse('Ef9VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVbxn');
const TONVIEWER_CONFIG_URL = 'https://tonviewer.com/config';
type SimplexNoncriticalParam = {
    label: string,
    kind: 'milliseconds' | 'float32' | 'bytes_per_second' | 'count',
    defaultValue: number
};

const SIMPLEX_NONCRITICAL_PARAMS: Record<number, SimplexNoncriticalParam> = {
    0: { label: 'Target block interval', kind: 'milliseconds', defaultValue: 2_400 },
    1: { label: 'First block timeout', kind: 'milliseconds', defaultValue: 1_000 },
    2: { label: 'First block timeout multiplier', kind: 'float32', defaultValue: 1.2 },
    3: { label: 'First block timeout cap', kind: 'milliseconds', defaultValue: 100_000 },
    4: { label: 'Candidate resolve timeout', kind: 'milliseconds', defaultValue: 1_000 },
    5: { label: 'Candidate resolve timeout multiplier', kind: 'float32', defaultValue: 1.2 },
    6: { label: 'Candidate resolve timeout cap', kind: 'milliseconds', defaultValue: 10_000 },
    7: { label: 'Candidate resolve cooldown', kind: 'milliseconds', defaultValue: 10 },
    8: { label: 'Standstill timeout', kind: 'milliseconds', defaultValue: 10_000 },
    9: { label: 'Standstill max egress', kind: 'bytes_per_second', defaultValue: 6_553_600 },
    10: { label: 'Max leader-window desync', kind: 'count', defaultValue: 250 },
    11: { label: 'Bad-signature ban duration', kind: 'milliseconds', defaultValue: 5_000 },
    12: { label: 'Candidate resolve rate limit', kind: 'count', defaultValue: 10 },
    13: { label: 'Minimum block interval', kind: 'milliseconds', defaultValue: 0 },
    14: { label: 'Empty-block fallback timeout', kind: 'milliseconds', defaultValue: 15_000 }
};
const PARAM_LABELS: Record<number, string> = {
    8: 'Network version',
    11: 'Voting rules',
    12: 'Workchain config',
    14: 'Block reward',
    15: 'Election timing',
    16: 'Validator limits',
    17: 'Stake limits',
    18: 'Storage prices',
    20: 'Masterchain gas prices',
    21: 'Basechain gas prices',
    24: 'Masterchain message prices',
    25: 'Basechain message prices',
    29: 'Block consensus config',
    30: 'Consensus config',
    31: 'Fundamental smart contracts',
    34: 'Current validator set',
    43: 'Account and message limits',
    46: 'Validator registry',
    71: 'ETH-TON outbound bridge',
    72: 'BSC-TON outbound bridge',
    73: 'Polygon-TON outbound bridge',
    79: 'ETH-TON inbound bridge',
    81: 'BNB-TON inbound bridge',
    82: 'Polygon-TON inbound bridge'
};

const tonApi = new TonApiClient({ baseUrl: 'https://tonapi.io' });
const adapter = new ContractAdapter(tonApi);
const config = adapter.open(Config.createFromAddress(MAINNET_CONFIG_ADDRESS));

const LAST_KNOWN_PROPOSAL_HASH = 'ea1c88dac0a979fa5c4f52037418d8f77f8ef08a73278809bd5879af4c58004f';
const MTONGA_PROPOSAL_HASHES = [
    '1abefa459593ee1eb5dffc43d2d671dfbc27b451fafc19651bde057e2a0f52bc',
    '4ba153570713eaa0c34d8ea60efd656bfba7008617bf42d7c3cf758bc975fb10',
    '678358ddbb13b1f32b1486543fb64a0dab2d7deb0f63e2477fc7499edb3b980a',
    '605a9cc212207d676413260df968a9af3d431ba592d76ba0445668cadd57b57c',
    '31a196cd2a43438009e1856d8ede081f4923ee27856b6adbcae5f141cae8d218',
    LAST_KNOWN_PROPOSAL_HASH,
    'b9fc3e68609931713760d0596a3482d9a084c90062d697aee7b420fc1b32a6e5',
    '5ef02b3ad2eb630e050850e88b9eb025a683f73d1f154ecef0a9e8168606d92a',
    '8fb9e0904ed7fc276e2d43e559a6a502f8295a36331e15162207884d207f5685',
    '15e455281b1624cc75ea853b15c640bd40d348b8043606b7b4e52214ee6f6f1d',
    '2f976d7a1954cc6105e0801910b6fbc6fedd9a5c91ef38cd5d9108ae7464781c',
    '3848920af070889fa220749347ec50e160c22b94bbbc430d32a5717b9be2718b',
    '3da811d2b66a9440830c558cebd61d689f1ccec0736b76d82ea37aa2d4876546',
    '68271d5c602dcaef63ff2da1e34b035283b7f109520eb1c7b5f9dff7c4296693',
    'caa1e83282b5ae11f6c0dcd7a8d488c4bd57dd00424e6985f1c2a10e81a70a06',
    'd781f91a71c07870ee7f3fc1847e80919e62bb5096553e6c32aba2f98d7733d8',
    'e9127c318513a711a4c2335d7da4507334bd8385c6a8aabee414de86d87a7c7a',
    '8bd2fc0b4c5b8e50b9d69599cf0cefe50283f22a65cc5ca7ef4c88e0714e781b',
    'eb942bffeb937bc18cec457864e980e4e08e44de9fca48513ccb27d138a545e8'
];
const MTONGA_PROPOSAL_HASH_SET = new Set(MTONGA_PROPOSAL_HASHES);
const KNOWN_PROPOSAL_FETCH_DELAY_MS = 250;

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
            protocol_version: 0,
            use_quic: false,
            slots_per_leader_window: 4,
            noncritical: {
                0: 800,
                1: 1600
            }
        }
    },
    acceptedValue: {
        hasMc: true,
        hasShard: true,
        mc: {
            version: 'simplex_config_v2' as const,
            flags: 0,
            protocol_version: 0,
            use_quic: true,
            slots_per_leader_window: 4,
            noncritical: {
                0: 400,
                1: 700,
                13: 300
            }
        },
        shard: {
            version: 'simplex_config_v2' as const,
            flags: 0,
            protocol_version: 0,
            use_quic: true,
            slots_per_leader_window: 4,
            noncritical: {
                0: 400,
                1: 700,
                13: 300
            }
        }
    }
};

const RECENT_ACCEPTED_CONFIG_PROPOSALS: KnownConfigResolvedProposal[] = [
    {
        hash: 'b9fc3e68609931713760d0596a3482d9a084c90062d697aee7b420fc1b32a6e5',
        paramId: 18,
        paramLabel: PARAM_LABELS[18],
        previousValue: cellFromBase64('te6cckEBAQEAKQAATdBmAAAAAAAAAAAAAAAAgAAAAAAAAPoAAAAAAAAB9AAAAAAAA9CQQJVLVZs='),
        acceptedValue: cellFromBase64('te6cckEBAwEAWQACAUgBAgBM3swAAAAAAAAAAAAAAAEAAAAAAAAB9AAAAAAAAAPoAAAAAAAHoSAAU71Pk/sGY0+T+wAAAAAAAAAAAAAAAAAAAAQ4AAAAAAAAH0AAAAAAAD0JBPXsekg='),
        summary: 'This proposal was accepted and applied on-chain. Param 18 now matches the MTONGA storage price reduction payload.',
        closedBecause: 'Acceptance was observed on 2026-05-01 07:08 UTC; the proposal is gone from the active get-method list, and the live config value now matches its proposed state.'
    },
    {
        hash: '8fb9e0904ed7fc276e2d43e559a6a502f8295a36331e15162207884d207f5685',
        paramId: 25,
        paramLabel: PARAM_LABELS[25],
        previousValue: cellFromBase64('te6cckEBAQEAIwAAQuoAAAAAAAYagAAAAAABkAAAAAAAAJxAAAAAAYAAVVVVVXYlR3Q='),
        acceptedValue: cellFromBase64('te6cckEBAQEAIwAAQuoAAAAAAAEEawAAAAAAQqqrAAAAABoKqqsAAYAAVVVVVXUQ/H0='),
        summary: 'This proposal was accepted and applied on-chain. Param 25 now matches the MTONGA basechain message price reduction payload.',
        closedBecause: 'Acceptance was observed on 2026-05-01 07:08 UTC; the proposal is gone from the active get-method list, and the live config value now matches its proposed state.'
    },
    {
        hash: '5ef02b3ad2eb630e050850e88b9eb025a683f73d1f154ecef0a9e8168606d92a',
        paramId: 21,
        paramLabel: PARAM_LABELS[21],
        previousValue: cellFromBase64('te6cckEBAQEATAAAlNEAAAAAAAAAZAAAAAAAAJxA3gAAAAABkAAAAAAAAAAPQkAAAAAAAA9CQAAAAAAAACcQAAAAAACYloAAAAAABfXhAAAAAAA7msoAGR7wcQ=='),
        acceptedValue: cellFromBase64('te6cckEBAQEATAAAlNEAAAAAAAAAZAAAAAAAABoL3gAAAAAAQqqrAAAAAAAPQkAAAAAAAA9CQAAAAAAAACcQAAAAAACYloAAAAAABfXhAAAAAAA7msoAgyFv5Q=='),
        summary: 'This proposal was accepted and applied on-chain. Param 21 now matches the MTONGA basechain gas price reduction payload.',
        closedBecause: 'Acceptance was observed on 2026-05-01 07:08 UTC; the proposal is gone from the active get-method list, and the live config value now matches its proposed state.'
    },
    {
        hash: '2f976d7a1954cc6105e0801910b6fbc6fedd9a5c91ef38cd5d9108ae7464781c',
        paramId: 8,
        paramLabel: PARAM_LABELS[8],
        previousValue: cellFromBase64('te6cckEBAQEADwAAGsQAAAANAAAAAAAAAe7JzL0K'),
        acceptedValueHash: 'b09a9e25aea9b7427e8de6518535fe969fa28f585e01c6f5ed0e99c299a25662',
        summary: 'This proposal was accepted and applied on-chain. Param 8 now matches the MTONGA network version payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: '15e455281b1624cc75ea853b15c640bd40d348b8043606b7b4e52214ee6f6f1d',
        paramId: 72,
        paramLabel: PARAM_LABELS[72],
        previousValue: cellFromBase64('te6cckECEgEAAucAAcFNXAIQs12t2qIZ+sRZ26D977H65Ol6DQeXc5/gUNaUyg69f/nKcOBuniKoki9a51IRqdajSoCU6OFYe2Br27ZigAAAAAAAAAAAAAAAO1PL0s3RYLuTRLS7W9m6Pf6OkQfAAQIBIAILAgEgAwgCASAEBwIBSAUGAIG+2+c2GpWbVn11TX/3iY2ow5IoK2QRejDqKka8qkWtXfAAAAAAAAAAAAAAAAZ6U+Eww1UgnIcSN9AgitAkqELVzACBvslVY8EfLiBF3Kwp1PMarGQNwJ0+Fu7zZm/EqUQAi8MgAAAAAAAAAAAAAAAAvuVY2KQLCHtj09TGeBuG4HY4JTQAgb9fQALD8DkE8UHukzDGYbnFRUFMGcV0l0Q088+ngxMjDAAAAAAAAAAAAAAAAGQsWVXaTtzv3sYykECw2ShAE1LFAgFuCQoAgb79Epa1UOp1wKSZ05JSzPBuGJtX4hZXPP8P8rRp6uGLgAAAAAAAAAAAAAAAB/og/MRNUjrs6djjHGLNwmKLzCNsAIG+wXzu1Ifh9xAdJtcgc9OpkGwWc1E/tBtcjRFdrPfo4sgAAAAAAAAAAAAAAAfi41FoDUwl1PVb58PTaLTVS5BgZAIBWAwNAIG/X7BE4d+cHa1Ku+INz+IhIOcCQYgWeItfGbthwsz7nP4AAAAAAAAAAAAAAAGJk3sG1XFojKMubCzSM8esSSPAgwIBSA4PAIG+0oey6UWcFXU4bSHcKMaJNFcDgYDr4mCubGHFM9hSGJgAAAAAAAAAAAAAAABJm5w0zuOZ4jUGpl9e0XwhcNY+zAIBWBARAIG+aYwydA0xxrx9kg/7HTI3yBavpTkHIZC7xWAN4S/DESAAAAAAAAAAAAAAAA/ld1WCnh4wac2gQz8Qq0vsM/xYkACBvkSqmmnQp43vR38TXzS4pU9PitmGaxTlJLfDL3uUkQBgAAAAAAAAAAAAAAAAc+nRDIZXqeeWoMXzDD395+1bRRDMu9CA'),
        acceptedValueHash: '33a68e52eadfaa0dd577bfd1d252bc4064b07c957b7ba107a064e34ef699b102',
        summary: 'This proposal was accepted and applied on-chain. Param 72 now matches the MTONGA BSC-TON outbound bridge payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: '3848920af070889fa220749347ec50e160c22b94bbbc430d32a5717b9be2718b',
        paramId: 79,
        paramLabel: PARAM_LABELS[79],
        previousValue: cellFromBase64('te6cckECEwEAAwUAAsUBtSXrWzxfbm3NYGvue6B6DsgwNSEoSbfgVZSZwPa61U0hHxV0v2I9FHh3CMX91WXjKaJav6SQlemEQm8ZvPBJdIAAAAAAAAAAAAAAAABZkbSVtqbctXj6lyJM0V6G9s154sABEgIBIAIRAgEgAwwCASAECwIBIAUGAIG/CbgwhUMYn2yHU343dcezKkvme3cyFJB7SHVY3FXhU9gAAAAAAAAAAAAAAAIsGpdN2JfQe6dn1Q0grZWLGV+pvgIBIAcKAgEgCAkAgb6wTxxyKMBuaRoElV/J+Cpjml/hBI75zkgUZUL1bCVj8AAAAAAAAAAAAAAAB6DTxC95W6LbcH1CGt0x3tqfH+wYAIG+rHBg7ICT4fRgYFzvSBkUlzqipS9wfLBT7Ik0F9I2H4AAAAAAAAAAAAAAAAMVTmQMVtAjqYiQQmok0ady9aOLKACBvuPG9uJvTJvcMq9AENwcv+F2Ds2MK6qNRDT23yGCaFWgAAAAAAAAAAAAAAAEQakxkag0h3kXzSwHNaCeOj4A/ZQAgb9cGndssE4S7bcVNIHMFrkiUrizWnT5vI9yfOYIEc45BgAAAAAAAAAAAAAAAdcS6yzbXhkM5DgpcXb79xP5dzOVAgEgDRACASAODwCBvw9fhTm/NqURBT4FuwJczZWe39F575hmpFtt8KVniCwIAAAAAAAAAAAAAAABDkxuMKeNKjBZpVAjNVjJ/URzwhoAgb8RuD3rFDyNUpuXtBAnWTykKVAuY7UKLrye419st2b25AAAAAAAAAAAAAAAAlUrmS7Amiwb/77tvRUhnpfLLMXeAIG/acxhhr+dznhtppGVCg+kFqjL65rOddHn1mwyRj1rYgQAAAAAAAAAAAAAAACRfpTwfZ9v81WVbRpRYN+1/m9YhwCDv9Puq7M91Ok9wKCG3vFOmiL6D1LDuC2RgNLJo6HSodzQAAAAAAAAAAAAAAAANq8bD78K9dOfIMgnp9lT6WUCKLFAADBDuaygBDuaygA3oSAD5OHAQF9eEAOYloB3RfSM'),
        acceptedValueHash: 'dc78c8af83ae38e7ff6dba29945e52f1311b65e4aae4249be965fc068ac1ecc1',
        summary: 'This proposal was accepted and applied on-chain. Param 79 now matches the MTONGA ETH-TON inbound bridge payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: '68271d5c602dcaef63ff2da1e34b035283b7f109520eb1c7b5f9dff7c4296693',
        paramId: 43,
        paramLabel: PARAM_LABELS[43],
        acceptedValueHash: '78106e91fe6acabc49c5e3d0387e7b0ccd39010b13c9373399f36f000bf723f7',
        summary: 'This proposal was accepted and applied on-chain. Param 43 now matches the MTONGA account and message limits payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: 'caa1e83282b5ae11f6c0dcd7a8d488c4bd57dd00424e6985f1c2a10e81a70a06',
        paramId: 29,
        paramLabel: PARAM_LABELS[29],
        previousValue: cellFromBase64('te6cckEBAQEAJwAAStkBAwAAB9AAAD6AAAAAAwAAAAgAAAAEACAAAAAgAAAABQAAJxAn4FSj'),
        acceptedValueHash: '3fdebb33c922ab4eae67d3ad349eda3e9dcd5da965d86138a6f8e678e1523c64',
        summary: 'This proposal was accepted and applied on-chain. Param 29 now matches the MTONGA block consensus config payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: 'd781f91a71c07870ee7f3fc1847e80919e62bb5096553e6c32aba2f98d7733d8',
        paramId: 30,
        paramLabel: PARAM_LABELS[30],
        previousValue: cellFromBase64('te6cckEBBwEALwACAxDgAQEBDSIBAAAABMACAgHJAwYCAdQEBQAJAAAAZCAACQAAAK8gAAm6AAACWSmlmc8='),
        acceptedValueHash: 'def936322a753aa4deb2d9a9184e5cb572fcd25db60e182f020b4dae00c77ba3',
        summary: 'This proposal was accepted and applied on-chain. Param 30 now matches the MTONGA consensus config payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: 'e9127c318513a711a4c2335d7da4507334bd8385c6a8aabee414de86d87a7c7a',
        paramId: 71,
        paramLabel: PARAM_LABELS[71],
        previousValue: cellFromBase64('te6cckECEgEAAucAAcHdJMSh8riPi3BTUTtcxsWjG8RLKnLctNjAM4rw8NN+xTubv9CtUzi5cA8IMzgO4X1GPlHBrmce5vCJAb3ombICgAAAAAAAAAAAAAAALBbDlQ2Ep+JHrvGOnbn5bN8j73jAAQIBIAILAgEgAwgCASAEBwIBSAUGAIG+2+c2GpWbVn11TX/3iY2ow5IoK2QRejDqKka8qkWtXfAAAAAAAAAAAAAAAAZ6U+Eww1UgnIcSN9AgitAkqELVzACBvslVY8EfLiBF3Kwp1PMarGQNwJ0+Fu7zZm/EqUQAi8MgAAAAAAAAAAAAAAAAvuVY2KQLCHtj09TGeBuG4HY4JTQAgb9fQALD8DkE8UHukzDGYbnFRUFMGcV0l0Q088+ngxMjDAAAAAAAAAAAAAAAAGQsWVXaTtzv3sYykECw2ShAE1LFAgFuCQoAgb79Epa1UOp1wKSZ05JSzPBuGJtX4hZXPP8P8rRp6uGLgAAAAAAAAAAAAAAAB/og/MRNUjrs6djjHGLNwmKLzCNsAIG+wXzu1Ifh9xAdJtcgc9OpkGwWc1E/tBtcjRFdrPfo4sgAAAAAAAAAAAAAAAfi41FoDUwl1PVb58PTaLTVS5BgZAIBWAwNAIG/X7BE4d+cHa1Ku+INz+IhIOcCQYgWeItfGbthwsz7nP4AAAAAAAAAAAAAAAGJk3sG1XFojKMubCzSM8esSSPAgwIBSA4PAIG+0oey6UWcFXU4bSHcKMaJNFcDgYDr4mCubGHFM9hSGJgAAAAAAAAAAAAAAABJm5w0zuOZ4jUGpl9e0XwhcNY+zAIBWBARAIG+aYwydA0xxrx9kg/7HTI3yBavpTkHIZC7xWAN4S/DESAAAAAAAAAAAAAAAA/ld1WCnh4wac2gQz8Qq0vsM/xYkACBvkSqmmnQp43vR38TXzS4pU9PitmGaxTlJLfDL3uUkQBgAAAAAAAAAAAAAAAAc+nRDIZXqeeWoMXzDD395+1bRRBbD7T+'),
        acceptedValueHash: '2dd37d01b16a08b692d9e6fe052a8ac7313f27dc02739d309849cb8291ac6242',
        summary: 'This proposal was accepted and applied on-chain. Param 71 now matches the MTONGA ETH-TON outbound bridge payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    },
    {
        hash: '8bd2fc0b4c5b8e50b9d69599cf0cefe50283f22a65cc5ca7ef4c88e0714e781b',
        paramId: 31,
        paramLabel: PARAM_LABELS[31],
        previousValue: cellFromBase64('te6cckEBDgEA+AABAcABAgEgAgsCASADCgIBIAQHAgFIBQYAA99wAEG+9ev/zlOHA3TxFUSRetc6kI1OtRpUBKdHCsPbA17dsxQCAVgICQBBvtmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmcAEG+3N3+hWqZxcuAeEGZwHcL6jHyjg1zOPc3hEgN70TNkBQAQr+NXAIQs12t2qIZ+sRZ26D977H65Ol6DQeXc5/gUNaUygIBWAwNAEG/ekmJQ+VxHxbgpqJ2uY2LRjeIllTluWmxgGcV4eGm/YsAQb9Vr7RxN7xi+L9lCwD5yg91WmOGv8qmlniDDwvSA+yY0R+B460='),
        acceptedValueHash: '424dbee8b8162c4801636b9aaf982344281c5a210c05865c634ab60c2d6f1ae4',
        summary: 'This proposal was accepted and applied on-chain. Param 31 now matches the MTONGA fundamental smart contracts payload.',
        closedBecause: 'Acceptance was observed on 2026-06-05; the proposal is gone from get_proposal, and the live config value now matches its proposed state.'
    }
];

export async function fetchMainnetVotingSnapshot(): Promise<VotingSnapshot> {
    const cfg = await config.getConfig();
    const proposals = await fetchActiveConfigProposals();
    const voteSetup = parseVoteSetup(getRequiredParam(cfg, 11));
    const elections = getElectionsConf(cfg);
    const validatorLimits = getValidatorsConf(cfg);
    const currentVsetCell = getRequiredParam(cfg, 34);
    const currentVsetHash = currentVsetCell.hash().toString('hex');
    const currentVset = parseVsetWithIndexes(currentVsetCell);
    const validatorSetsByHash = collectIndexedValidatorSets(cfg);
    const thresholdWeight = (currentVset.total_weight * 3n) / 4n;
    const activeProposalHashes = new Set(proposals.map((proposal) => toHex(proposal.proposalHash)));
    const activeProposals = proposals.map((proposal) => {
        const hash = toHex(proposal.proposalHash);
        const yesWeight = thresholdWeight - proposal.weight_remaining;
        const neededWeight = proposal.weight_remaining > 0n ? proposal.weight_remaining : 0n;
        const rule = proposal.critical ? voteSetup.critical : voteSetup.normal;
        const changeRows = buildConfigChangeRows(proposal.param_id, cfg.get(proposal.param_id), proposal.value);
        const validatorSetMatchesCurrent = toHex(proposal.vset_id) === currentVsetHash;
        const proposalValidatorSet = validatorSetsByHash.get(toHex(proposal.vset_id)) ?? null;
        const voters = buildProposalVoters(
            proposal.voters,
            proposalValidatorSet
        );

        return {
            hash,
            paramId: proposal.param_id,
            paramLabel: PARAM_LABELS[proposal.param_id] ?? `Config param ${proposal.param_id}`,
            source: getProposalSource(hash),
            critical: proposal.critical,
            expiresAt: proposal.expires,
            validatorSetMatchesCurrent,
            voterSetResolved: proposalValidatorSet !== null,
            voterCount: proposal.voters.length,
            voters,
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
    const resolvedProposals = buildResolvedProposals(activeProposalHashes, cfg);

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
        resolvedProposal: resolvedProposals[0] ?? null,
        resolvedProposals,
        proposals: activeProposals
    };
}

async function fetchActiveConfigProposals(): Promise<ConfigProposalStatus[]> {
    try {
        return await config.getListedProposals();
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`list_proposals failed (${reason}); falling back to known proposal hashes`);
        return fetchKnownActiveConfigProposals();
    }
}

async function fetchKnownActiveConfigProposals(): Promise<ConfigProposalStatus[]> {
    const proposals: ConfigProposalStatus[] = [];

    for (const [index, hash] of MTONGA_PROPOSAL_HASHES.entries()) {
        const proposal = await fetchKnownConfigProposalWithRetry(hash);

        if (proposal) {
            proposals.push(proposal);
        }

        if (index < MTONGA_PROPOSAL_HASHES.length - 1) {
            await delay(KNOWN_PROPOSAL_FETCH_DELAY_MS);
        }
    }

    return proposals;
}

async function fetchKnownConfigProposalWithRetry(hash: string): Promise<ConfigProposalStatus | null> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await fetchKnownConfigProposal(hash);
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }

            await delay(1_000 * attempt);
        }
    }

    return null;
}

async function fetchKnownConfigProposal(hash: string): Promise<ConfigProposalStatus | null> {
    const result = await tonApi.blockchain.execGetMethodForBlockchainAccount(
        MAINNET_CONFIG_ADDRESS,
        'get_proposal',
        { args: [`0x${hash}`] }
    );

    if (!result.success || result.exitCode !== 0) {
        throw new Error(`get_proposal ${hash} failed with exit code ${result.exitCode}`);
    }

    const stack = new TupleReader(result.stack);
    const proposalTuple = stack.readTupleOpt();

    if (!proposalTuple) {
        return null;
    }

    return parseConfigProposalStatus(hash, proposalTuple);
}

function parseConfigProposalStatus(hash: string, proposalTuple: TupleReader): ConfigProposalStatus {
    const expires = proposalTuple.readNumber();
    const critical = proposalTuple.readBoolean();
    const paramTuple = proposalTuple.readTuple();
    const paramId = paramTuple.readNumber();
    const value = paramTuple.readCell();
    const curHash = paramTuple.readBigNumber();
    const vsetId = proposalTuple.readBigNumber();
    const voters = proposalTuple.readLispList().map((voter) => {
        if (voter.type !== 'int') {
            throw new Error(`Unexpected voter tuple item type: ${voter.type}`);
        }

        return Number(voter.value);
    });
    const weightRemaining = proposalTuple.readBigNumber();
    const roundsRemaining = proposalTuple.readNumber();
    const wins = proposalTuple.readNumber();
    const losses = proposalTuple.readNumber();

    return {
        proposalHash: BigInt(`0x${hash}`),
        expires,
        critical,
        param_id: paramId,
        value,
        cur_hash: curHash,
        vset_id: vsetId,
        voters,
        weight_remaining: weightRemaining,
        rounds_remaining: roundsRemaining,
        wins,
        losses
    };
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function buildResolvedProposals(
    activeProposalHashes: Set<string>,
    currentConfig: MapLikeConfig
): ResolvedProposal[] {
    const resolved = RECENT_ACCEPTED_CONFIG_PROPOSALS
        .map((proposal) => buildResolvedConfigProposal(proposal, activeProposalHashes, currentConfig))
        .filter((proposal): proposal is ResolvedProposal => proposal !== null);
    const consensusProposal = buildResolvedConsensusProposal(activeProposalHashes);

    if (consensusProposal) {
        resolved.push(consensusProposal);
    }

    return resolved;
}

function buildResolvedConfigProposal(
    proposal: KnownConfigResolvedProposal,
    activeProposalHashes: Set<string>,
    currentConfig: MapLikeConfig
): ResolvedProposal | null {
    if (activeProposalHashes.has(proposal.hash)) {
        return null;
    }

    const currentValue = currentConfig.get(proposal.paramId);
    const acceptedValue = proposal.acceptedValue ?? currentValue;
    const acceptedValueHash = proposal.acceptedValueHash ?? proposal.acceptedValue?.hash().toString('hex');

    if (!currentValue || !acceptedValue || !acceptedValueHash) {
        return null;
    }

    if (currentValue.hash().toString('hex') !== acceptedValueHash) {
        return null;
    }

    return {
        hash: proposal.hash,
        paramId: proposal.paramId,
        paramLabel: proposal.paramLabel,
        source: getProposalSource(proposal.hash),
        status: 'accepted',
        summary: proposal.summary,
        closedBecause: proposal.closedBecause,
        changeRows: buildConfigChangeRows(proposal.paramId, proposal.previousValue, acceptedValue)
    };
}

function buildResolvedConsensusProposal(activeProposalHashes: Set<string>): ResolvedProposal | null {
    if (activeProposalHashes.has(LAST_KNOWN_PROPOSAL.hash)) {
        return null;
    }

    return {
        hash: LAST_KNOWN_PROPOSAL.hash,
        paramId: LAST_KNOWN_PROPOSAL.paramId,
        paramLabel: LAST_KNOWN_PROPOSAL.paramLabel,
        source: getProposalSource(LAST_KNOWN_PROPOSAL.hash),
        status: 'accepted',
        summary: 'This proposal was accepted and applied on-chain. It is kept as a historical outcome even though Param 30 has since been updated again.',
        closedBecause: 'The proposal is gone from get_proposal, so it is no longer an active voting item.',
        changeRows: buildConsensusChangeRows(LAST_KNOWN_PROPOSAL.previousValue, LAST_KNOWN_PROPOSAL.acceptedValue)
    };
}

function cellFromBase64(boc: string): Cell {
    return Cell.fromBoc(Buffer.from(boc, 'base64'))[0];
}

export function getProposalSource(hash: string): ProposalSource {
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

function buildProposalVoters(voterIndexes: number[], validatorSet: IndexedValidatorSet | null): ProposalVoter[] {
    const validatorsByIndex = new Map(
        validatorSet?.list.map((validator) => [validator.idx, validator]) ?? []
    );

    return [...voterIndexes]
        .sort((left, right) => left - right)
        .map((index) => {
            const validator = validatorsByIndex.get(index);

            return {
                index,
                publicKey: validator?.publicKey ?? null,
                adnlAddress: validator?.adnlAddress ?? null,
                role: validator && validatorSet
                    ? (index < validatorSet.main ? 'main' : 'shard')
                    : null,
                weight: validator?.weight.toString() ?? null,
                weightPercentOfSet: validator && validatorSet
                    ? formatPercent(validator.weight, validatorSet.total_weight, 4)
                    : null
            };
        });
}

function collectIndexedValidatorSets(configDict: MapLikeConfig): Map<string, IndexedValidatorSet> {
    const validatorSets = new Map<string, IndexedValidatorSet>();

    for (const paramId of [32, 34, 36]) {
        const cell = configDict.get(paramId);
        if (cell) {
            validatorSets.set(cell.hash().toString('hex'), parseVsetWithIndexes(cell));
        }
    }

    return validatorSets;
}

export function buildConfigChangeRows(paramId: number, current: Cell | undefined, proposed: Cell): ChangeRow[] {
    try {
        switch (paramId) {
            case 8:
                return buildGlobalVersionChangeRows(current ? parseGlobalVersion(current) : null, parseGlobalVersion(proposed));
            case 11:
                return buildVoteSetupChangeRows(current ? parseVoteSetup(current) : null, parseVoteSetup(proposed));
            case 12:
                return buildWorkchainChangeRows(current ? parseWorkchains(current) : null, parseWorkchains(proposed));
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
            case 29:
                return buildBlockConsensusChangeRows(current ? parseBlockConsensusConfig(current) : null, parseBlockConsensusConfig(proposed));
            case 30:
                return buildConsensusChangeRows(current ? parseNewConsensusConfigAll(current) : null, parseNewConsensusConfigAll(proposed));
            case 31:
                return buildFundamentalSmcChangeRows(current ? parseFundamentalSmcAddresses(current) : null, parseFundamentalSmcAddresses(proposed));
            case 43:
                return buildSizeLimitsChangeRows(current ? parseSizeLimitsConfig(current) : null, parseSizeLimitsConfig(proposed));
            case 46:
                return buildValidatorRegistryChangeRows(current ? parseValidatorRegistryConfig(current) : null, parseValidatorRegistryConfig(proposed));
            case 71:
            case 72:
            case 73:
                return buildOracleBridgeChangeRows(current ? parseOracleBridgeParams(current) : null, parseOracleBridgeParams(proposed));
            case 79:
            case 81:
            case 82:
                return buildJettonBridgeChangeRows(current ? parseJettonBridgeParams(current) : null, parseJettonBridgeParams(proposed));
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

const FUNDAMENTAL_SMC_VALUE: DictionaryValue<boolean> = {
    serialize: (_source, _builder) => {},
    parse: (_source) => true
};

const WORKCHAIN_DESCRIPTION_VALUE: DictionaryValue<WorkchainDescription> = {
    serialize: () => {
        throw new Error('Workchain description serialization is not used');
    },
    parse: parseWorkchainDescription
};

function parseWorkchains(cell: Cell): Dictionary<number, WorkchainDescription> {
    return cell.beginParse().loadDict(Dictionary.Keys.Int(32), WORKCHAIN_DESCRIPTION_VALUE);
}

function parseWorkchainDescription(source: Slice): WorkchainDescription {
    const tag = source.loadUint(8);
    if (tag !== 0xa6 && tag !== 0xa7) {
        throw new Error(`Unexpected workchain description tag: ${tag}`);
    }

    const enabled_since = source.loadUint(32);
    const actual_min_split = source.loadUint(8);
    const min_split = source.loadUint(8);
    const max_split = source.loadUint(8);
    const basic = source.loadBit();
    const active = source.loadBit();
    const accept_msgs = source.loadBit();
    const flags = source.loadUint(13);
    const zerostate_root_hash = source.loadBuffer(32).toString('hex');
    const zerostate_file_hash = source.loadBuffer(32).toString('hex');
    const workchain_version = source.loadUint(32);
    const format = parseWorkchainFormat(source, basic);

    let split_merge_timings: WorkchainSplitMergeTimings | null = null;
    let persistent_state_split_depth: number | null = null;

    if (tag === 0xa7) {
        const timingsTag = source.loadUint(4);
        if (timingsTag !== 0) {
            throw new Error(`Unexpected workchain split/merge timings tag: ${timingsTag}`);
        }

        split_merge_timings = {
            split_merge_delay: source.loadUint(32),
            split_merge_interval: source.loadUint(32),
            min_split_merge_interval: source.loadUint(32),
            max_split_merge_delay: source.loadUint(32)
        };
        persistent_state_split_depth = source.loadUint(8);
    }

    return {
        version: tag === 0xa7 ? 'workchain_v2' : 'workchain',
        enabled_since,
        actual_min_split,
        min_split,
        max_split,
        basic,
        active,
        accept_msgs,
        flags,
        zerostate_root_hash,
        zerostate_file_hash,
        workchain_version,
        format,
        split_merge_timings,
        persistent_state_split_depth
    };
}

function parseWorkchainFormat(source: Slice, basic: boolean): WorkchainFormat {
    const tag = source.loadUint(4);

    if (basic) {
        if (tag !== 1) {
            throw new Error(`Unexpected basic workchain format tag: ${tag}`);
        }

        return {
            kind: 'basic',
            vm_version: source.loadInt(32),
            vm_mode: source.loadUintBig(64)
        };
    }

    if (tag !== 0) {
        throw new Error(`Unexpected extended workchain format tag: ${tag}`);
    }

    return {
        kind: 'extended',
        min_addr_len: source.loadUint(12),
        max_addr_len: source.loadUint(12),
        addr_len_step: source.loadUint(12),
        workchain_type_id: source.loadUint(32)
    };
}

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

function parseGlobalVersion(cell: Cell): GlobalVersion {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    if (tag !== 0xc4) {
        throw new Error(`Unexpected global version tag: ${tag}`);
    }

    return {
        version: slice.loadUint(32),
        capabilities: slice.loadUintBig(64)
    };
}

function parseFundamentalSmcAddresses(cell: Cell): string[] {
    const dictionary = cell.beginParse().loadDict(Dictionary.Keys.BigUint(256), FUNDAMENTAL_SMC_VALUE);
    return dictionary.keys()
        .map((address) => formatMasterchainAddress(address))
        .sort();
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

function parseBlockConsensusConfig(cell: Cell): BlockConsensusConfig {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);

    if (tag === 0xd6) {
        return {
            version: 'consensus_config',
            flags: null,
            use_quic: null,
            new_catchain_ids: null,
            round_candidates: slice.loadUint(32),
            next_candidate_delay_ms: slice.loadUint(32),
            consensus_timeout_ms: slice.loadUint(32),
            fast_attempts: slice.loadUint(32),
            attempt_duration: slice.loadUint(32),
            catchain_max_deps: slice.loadUint(32),
            max_block_bytes: slice.loadUint(32),
            max_collated_bytes: slice.loadUint(32),
            proto_version: null,
            catchain_max_blocks_coeff: null
        };
    }

    if (tag === 0xd7) {
        return {
            version: 'consensus_config_new',
            flags: slice.loadUint(7),
            use_quic: null,
            new_catchain_ids: slice.loadBit(),
            round_candidates: slice.loadUint(8),
            next_candidate_delay_ms: slice.loadUint(32),
            consensus_timeout_ms: slice.loadUint(32),
            fast_attempts: slice.loadUint(32),
            attempt_duration: slice.loadUint(32),
            catchain_max_deps: slice.loadUint(32),
            max_block_bytes: slice.loadUint(32),
            max_collated_bytes: slice.loadUint(32),
            proto_version: null,
            catchain_max_blocks_coeff: null
        };
    }

    if (tag === 0xd8) {
        return {
            version: 'consensus_config_v3',
            flags: slice.loadUint(7),
            use_quic: null,
            new_catchain_ids: slice.loadBit(),
            round_candidates: slice.loadUint(8),
            next_candidate_delay_ms: slice.loadUint(32),
            consensus_timeout_ms: slice.loadUint(32),
            fast_attempts: slice.loadUint(32),
            attempt_duration: slice.loadUint(32),
            catchain_max_deps: slice.loadUint(32),
            max_block_bytes: slice.loadUint(32),
            max_collated_bytes: slice.loadUint(32),
            proto_version: slice.loadUint(16),
            catchain_max_blocks_coeff: null
        };
    }

    if (tag === 0xd9) {
        return {
            version: 'consensus_config_v4',
            flags: slice.loadUint(6),
            use_quic: slice.loadBit(),
            new_catchain_ids: slice.loadBit(),
            round_candidates: slice.loadUint(8),
            next_candidate_delay_ms: slice.loadUint(32),
            consensus_timeout_ms: slice.loadUint(32),
            fast_attempts: slice.loadUint(32),
            attempt_duration: slice.loadUint(32),
            catchain_max_deps: slice.loadUint(32),
            max_block_bytes: slice.loadUint(32),
            max_collated_bytes: slice.loadUint(32),
            proto_version: slice.loadUint(16),
            catchain_max_blocks_coeff: slice.loadUint(32)
        };
    }

    throw new Error(`Unexpected block consensus config tag: ${tag}`);
}

function parseSizeLimitsConfig(cell: Cell): SizeLimitsConfig {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);
    const base = {
        max_msg_bits: slice.loadUint(32),
        max_msg_cells: slice.loadUint(32),
        max_library_cells: slice.loadUint(32),
        max_vm_data_depth: slice.loadUint(16),
        max_ext_msg_size: slice.loadUint(32),
        max_ext_msg_depth: slice.loadUint(16)
    };

    if (tag === 0x01) {
        return {
            version: 'size_limits_config',
            ...base,
            max_acc_state_cells: null,
            max_mc_acc_state_cells: null,
            max_acc_public_libraries: null,
            defer_out_queue_size_limit: null,
            max_msg_extra_currencies: null,
            max_acc_fixed_prefix_length: null,
            acc_state_cells_for_storage_dict: null,
            max_transaction_library_loads: null
        };
    }

    if (tag === 0x02) {
        return {
            version: 'size_limits_config_v2',
            ...base,
            max_acc_state_cells: slice.loadUint(32),
            max_mc_acc_state_cells: slice.loadUint(32),
            max_acc_public_libraries: slice.loadUint(32),
            defer_out_queue_size_limit: slice.loadUint(32),
            max_msg_extra_currencies: slice.loadUint(32),
            max_acc_fixed_prefix_length: slice.loadUint(8),
            acc_state_cells_for_storage_dict: slice.loadUint(32),
            max_transaction_library_loads: slice.loadMaybeUint(32)
        };
    }

    throw new Error(`Unexpected size limits config tag: ${tag}`);
}

function parseValidatorRegistryConfig(cell: Cell): ValidatorRegistryConfig {
    const slice = cell.beginParse();
    const tag = slice.loadUint(32);
    if (tag !== 0x3601163e) {
        throw new Error(`Unexpected validator registry config tag: ${tag.toString(16)}`);
    }

    const contract_address = slice.loadUintBig(256);
    const max_collators_per_validator = slice.loadUint(32);
    const hasNewCodeHash = slice.loadBit();

    return {
        contract_address,
        max_collators_per_validator,
        new_code_hash: hasNewCodeHash ? slice.loadUintBig(256) : null
    };
}

function parseOracleBridgeParams(cell: Cell): OracleBridgeParams {
    const slice = cell.beginParse();
    const bridge_address = slice.loadUintBig(256);
    const oracle_multisig_address = slice.loadUintBig(256);
    const oracles = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(256));
    const external_chain_address = slice.loadUintBig(256);

    return {
        bridge_address,
        oracle_multisig_address,
        oracle_count: oracles.size,
        external_chain_address
    };
}

function parseJettonBridgeParams(cell: Cell): JettonBridgeParams {
    const slice = cell.beginParse();
    const tag = slice.loadUint(8);

    if (tag !== 0x00 && tag !== 0x01) {
        throw new Error(`Unexpected jetton bridge params tag: ${tag}`);
    }

    const bridge_address = slice.loadUintBig(256);
    const oracles_address = slice.loadUintBig(256);
    const oracles = slice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(256));
    const state_flags = slice.loadUint(8);

    if (tag === 0x00) {
        return {
            version: 'jetton_bridge_params_v0',
            bridge_address,
            oracles_address,
            oracle_count: oracles.size,
            state_flags,
            burn_bridge_fee: slice.loadCoins(),
            prices: null,
            external_chain_address: null
        };
    }

    return {
        version: 'jetton_bridge_params_v1',
        bridge_address,
        oracles_address,
        oracle_count: oracles.size,
        state_flags,
        burn_bridge_fee: null,
        prices: parseJettonBridgePrices(slice.loadRef()),
        external_chain_address: slice.loadUintBig(256)
    };
}

function parseJettonBridgePrices(cell: Cell): JettonBridgePrices {
    const slice = cell.beginParse();

    return {
        bridge_burn_fee: slice.loadCoins(),
        bridge_mint_fee: slice.loadCoins(),
        wallet_min_tons_for_storage: slice.loadCoins(),
        wallet_gas_consumption: slice.loadCoins(),
        minter_min_tons_for_storage: slice.loadCoins(),
        discover_gas_consumption: slice.loadCoins()
    };
}

function parseVsetWithIndexes(cell: Cell): IndexedValidatorSet {
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
            ([idx, entry]) => ({
                idx,
                publicKey: entry.public_key.toString('hex'),
                adnlAddress: entry.adnl !== undefined
                    ? entry.adnl.toString(16).padStart(64, '0')
                    : null,
                weight: entry.weight
            })
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
    if (tag === 0x21) {
        return {
            version: 'simplex_config',
            flags: slice.loadUint(7),
            use_quic: slice.loadBit(),
            target_rate_ms: slice.loadUint(32),
            slots_per_leader_window: slice.loadUint(32),
            first_block_timeout_ms: slice.loadUint(32),
            max_leader_window_desync: slice.loadUint(32)
        };
    }

    if (tag !== 0x22) {
        throw new Error(`Unexpected new consensus tag: ${tag}`);
    }
    const flags = slice.loadUint(5);
    const protocol_version = slice.loadUint(2);
    const use_quic = slice.loadBit();
    const slots_per_leader_window = slice.loadUint(32);
    const noncritical = Object.fromEntries(
        Array.from(
            slice.loadDict(Dictionary.Keys.Uint(8), Dictionary.Values.Uint(32)),
            ([key, value]) => [key, Number(value)]
        )
    );

    return {
        version: 'simplex_config_v2',
        flags,
        protocol_version,
        use_quic,
        slots_per_leader_window,
        noncritical
    };
}

function buildWorkchainChangeRows(
    current: Dictionary<number, WorkchainDescription> | null,
    proposed: Dictionary<number, WorkchainDescription>
): ChangeRow[] {
    const workchainIds = Array.from(new Set([
        ...(current ? Array.from(current.keys()) : []),
        ...Array.from(proposed.keys())
    ])).sort((left, right) => left - right);
    const rows: ChangeRow[] = [];

    for (const workchainId of workchainIds) {
        const currentWorkchain = current?.get(workchainId);
        const proposedWorkchain = proposed.get(workchainId);
        const labelPrefix = `Workchain ${workchainId}`;

        if (!currentWorkchain && proposedWorkchain) {
            rows.push({
                label: labelPrefix,
                current: 'Not configured',
                proposed: describeWorkchain(proposedWorkchain)
            });
            continue;
        }

        if (currentWorkchain && !proposedWorkchain) {
            rows.push({
                label: labelPrefix,
                current: describeWorkchain(currentWorkchain),
                proposed: 'Removed from config'
            });
            continue;
        }

        if (!currentWorkchain || !proposedWorkchain) {
            continue;
        }

        const fields: Array<{ label: string, current: string, proposed: string }> = [
            {
                label: 'Descriptor format',
                current: formatWorkchainDescriptionVersion(currentWorkchain.version),
                proposed: formatWorkchainDescriptionVersion(proposedWorkchain.version)
            },
            {
                label: 'Enabled since',
                current: formatWorkchainEnabledSince(currentWorkchain.enabled_since),
                proposed: formatWorkchainEnabledSince(proposedWorkchain.enabled_since)
            },
            {
                label: 'Actual minimum split depth',
                current: formatWorkchainSplitDepth(currentWorkchain.actual_min_split),
                proposed: formatWorkchainSplitDepth(proposedWorkchain.actual_min_split)
            },
            {
                label: 'Configured minimum split depth',
                current: formatWorkchainSplitDepth(currentWorkchain.min_split),
                proposed: formatWorkchainSplitDepth(proposedWorkchain.min_split)
            },
            {
                label: 'Maximum shard split depth',
                current: formatWorkchainSplitDepth(currentWorkchain.max_split),
                proposed: formatWorkchainSplitDepth(proposedWorkchain.max_split)
            },
            {
                label: 'Basic workchain',
                current: formatEnabled(currentWorkchain.basic),
                proposed: formatEnabled(proposedWorkchain.basic)
            },
            {
                label: 'Active',
                current: formatEnabled(currentWorkchain.active),
                proposed: formatEnabled(proposedWorkchain.active)
            },
            {
                label: 'Accepts messages',
                current: formatEnabled(currentWorkchain.accept_msgs),
                proposed: formatEnabled(proposedWorkchain.accept_msgs)
            },
            {
                label: 'Flags',
                current: formatCount(currentWorkchain.flags),
                proposed: formatCount(proposedWorkchain.flags)
            },
            {
                label: 'Zerostate root hash',
                current: currentWorkchain.zerostate_root_hash,
                proposed: proposedWorkchain.zerostate_root_hash
            },
            {
                label: 'Zerostate file hash',
                current: currentWorkchain.zerostate_file_hash,
                proposed: proposedWorkchain.zerostate_file_hash
            },
            {
                label: 'Workchain version',
                current: formatCount(currentWorkchain.workchain_version),
                proposed: formatCount(proposedWorkchain.workchain_version)
            },
            {
                label: 'Workchain format',
                current: describeWorkchainFormat(currentWorkchain.format),
                proposed: describeWorkchainFormat(proposedWorkchain.format)
            },
            {
                label: 'Split/merge timings',
                current: describeWorkchainSplitMergeTimings(currentWorkchain.split_merge_timings),
                proposed: describeWorkchainSplitMergeTimings(proposedWorkchain.split_merge_timings)
            },
            {
                label: 'Persistent state split depth',
                current: formatNullableWorkchainSplitDepth(currentWorkchain.persistent_state_split_depth),
                proposed: formatNullableWorkchainSplitDepth(proposedWorkchain.persistent_state_split_depth)
            }
        ];

        for (const field of fields) {
            if (field.current !== field.proposed) {
                rows.push({
                    label: `${labelPrefix}: ${field.label}`,
                    current: field.current,
                    proposed: field.proposed
                });
            }
        }
    }

    if (rows.length === 0) {
        rows.push({
            label: 'Decoded workchain config',
            current: current ? formatPlural(current.size, 'workchain') : 'Param not set',
            proposed: `No decoded field changes across ${formatPlural(proposed.size, 'workchain')}`
        });
    }

    return rows;
}

function describeWorkchain(workchain: WorkchainDescription): string {
    return [
        formatWorkchainDescriptionVersion(workchain.version),
        workchain.active ? 'active' : 'inactive',
        workchain.accept_msgs ? 'accepting messages' : 'not accepting messages',
        `split depth ${workchain.min_split}-${workchain.max_split}`,
        describeWorkchainFormat(workchain.format)
    ].join(', ');
}

function formatWorkchainDescriptionVersion(version: WorkchainDescription['version']): string {
    return version === 'workchain_v2' ? 'Workchain v2 (#a7)' : 'Workchain v1 (#a6)';
}

function formatWorkchainEnabledSince(unixTime: number): string {
    return unixTime === 0 ? 'Not enabled' : formatUnixUtc(unixTime);
}

function formatWorkchainSplitDepth(depth: number): string {
    return `${formatCount(depth)} (up to ${formatCount(1n << BigInt(depth))} shards)`;
}

function formatNullableWorkchainSplitDepth(depth: number | null): string {
    return depth === null ? 'Not set' : formatWorkchainSplitDepth(depth);
}

function formatEnabled(value: boolean): string {
    return value ? 'Enabled' : 'Disabled';
}

function describeWorkchainFormat(format: WorkchainFormat): string {
    if (format.kind === 'basic') {
        return `Basic TVM, VM version ${format.vm_version}, mode ${formatCount(format.vm_mode)}`;
    }

    return `Extended, address ${format.min_addr_len}-${format.max_addr_len} bits in steps of ${format.addr_len_step}, type ${format.workchain_type_id}`;
}

function describeWorkchainSplitMergeTimings(timings: WorkchainSplitMergeTimings | null): string {
    if (!timings) {
        return 'Not set';
    }

    return [
        `delay ${formatDuration(timings.split_merge_delay)}`,
        `interval ${formatDuration(timings.split_merge_interval)}`,
        `minimum interval ${formatDuration(timings.min_split_merge_interval)}`,
        `maximum delay ${formatDuration(timings.max_split_merge_delay)}`
    ].join(', ');
}

function buildConsensusChangeRows(current: ConsensusConfigAll | null, proposed: ConsensusConfigAll): ChangeRow[] {
    const rows = [
        ...buildConsensusSideChangeRows('Masterchain', current?.mc ?? null, proposed.mc),
        ...buildConsensusSideChangeRows('Shardchains', current?.shard ?? null, proposed.shard)
    ];

    if (rows.length > 0) {
        return rows;
    }

    return [{
        label: 'Decoded consensus config',
        current: 'No semantic field changes',
        proposed: 'No semantic field changes'
    }];
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

function buildGlobalVersionChangeRows(current: GlobalVersion | null, proposed: GlobalVersion): ChangeRow[] {
    const rows: ChangeRow[] = [];

    if (!current || current.version !== proposed.version) {
        rows.push({
            label: 'TVM/network version',
            current: current ? String(current.version) : 'Param not set',
            proposed: String(proposed.version)
        });
    }

    if (!current || current.capabilities !== proposed.capabilities) {
        rows.push({
            label: 'Capability mask',
            current: current ? describeCapabilityMask(current.capabilities) : 'Param not set',
            proposed: describeCapabilityMask(proposed.capabilities)
        });
        rows.push({
            label: 'Capability delta',
            current: current ? describeCapabilityDelta(current.capabilities, proposed.capabilities, false) : 'Param not set',
            proposed: describeCapabilityDelta(current?.capabilities ?? 0n, proposed.capabilities, true)
        });
    }

    return rows.length > 0 ? rows : [{
        label: 'Decoded network version',
        current: 'No semantic field changes',
        proposed: 'No semantic field changes'
    }];
}

function buildFundamentalSmcChangeRows(current: string[] | null, proposed: string[]): ChangeRow[] {
    const currentSet = new Set(current ?? []);
    const proposedSet = new Set(proposed);
    const added = proposed.filter((address) => !currentSet.has(address));
    const removed = (current ?? []).filter((address) => !proposedSet.has(address));

    return [
        {
            label: 'Fundamental address count',
            current: current ? formatPlural(current.length, 'address', 'addresses') : 'Param not set',
            proposed: formatPlural(proposed.length, 'address', 'addresses')
        },
        {
            label: 'Added addresses',
            current: 'None',
            proposed: added.length ? added.join('\n') : 'None'
        },
        {
            label: 'Removed addresses',
            current: removed.length ? removed.join('\n') : 'None',
            proposed: 'None'
        },
        {
            label: 'Full address set',
            current: current ? current.join('\n') : 'Param not set',
            proposed: proposed.join('\n')
        }
    ];
}

function buildBlockConsensusChangeRows(current: BlockConsensusConfig | null, proposed: BlockConsensusConfig): ChangeRow[] {
    const rows: ChangeRow[] = [
        {
            label: 'Consensus schema',
            current: current ? formatConfigVersion(current.version) : 'Param not set',
            proposed: formatConfigVersion(proposed.version)
        },
        {
            label: 'QUIC transport',
            current: current ? formatNullableBoolean(current.use_quic) : 'Param not set',
            proposed: formatNullableBoolean(proposed.use_quic)
        },
        {
            label: 'New catchain IDs',
            current: current ? formatNullableBoolean(current.new_catchain_ids) : 'Param not set',
            proposed: formatNullableBoolean(proposed.new_catchain_ids)
        },
        {
            label: 'Round candidates',
            current: current ? formatCount(current.round_candidates) : 'Param not set',
            proposed: formatCount(proposed.round_candidates)
        },
        {
            label: 'Next candidate delay',
            current: current ? formatMilliseconds(current.next_candidate_delay_ms) : 'Param not set',
            proposed: formatMilliseconds(proposed.next_candidate_delay_ms)
        },
        {
            label: 'Consensus timeout',
            current: current ? formatMilliseconds(current.consensus_timeout_ms) : 'Param not set',
            proposed: formatMilliseconds(proposed.consensus_timeout_ms)
        },
        {
            label: 'Fast attempts',
            current: current ? formatCount(current.fast_attempts) : 'Param not set',
            proposed: formatCount(proposed.fast_attempts)
        },
        {
            label: 'Attempt duration',
            current: current ? formatCount(current.attempt_duration) : 'Param not set',
            proposed: formatCount(proposed.attempt_duration)
        },
        {
            label: 'Catchain max deps',
            current: current ? formatCount(current.catchain_max_deps) : 'Param not set',
            proposed: formatCount(proposed.catchain_max_deps)
        },
        {
            label: 'Max block bytes',
            current: current ? formatBytes(current.max_block_bytes) : 'Param not set',
            proposed: formatBytes(proposed.max_block_bytes)
        },
        {
            label: 'Max collated bytes',
            current: current ? formatBytes(current.max_collated_bytes) : 'Param not set',
            proposed: formatBytes(proposed.max_collated_bytes)
        }
    ];

    if ((current?.proto_version ?? null) !== null || proposed.proto_version !== null) {
        rows.push({
            label: 'Protocol version',
            current: current ? formatNullableNumber(current.proto_version) : 'Param not set',
            proposed: formatNullableNumber(proposed.proto_version)
        });
    }

    if ((current?.catchain_max_blocks_coeff ?? null) !== null || proposed.catchain_max_blocks_coeff !== null) {
        rows.push({
            label: 'Catchain max blocks coeff',
            current: current ? formatNullableNumber(current.catchain_max_blocks_coeff) : 'Param not set',
            proposed: formatNullableNumber(proposed.catchain_max_blocks_coeff)
        });
    }

    return rows;
}

function buildSizeLimitsChangeRows(current: SizeLimitsConfig | null, proposed: SizeLimitsConfig): ChangeRow[] {
    return [
        {
            label: 'Limits schema',
            current: current ? formatConfigVersion(current.version) : 'Param not set (defaults)',
            proposed: formatConfigVersion(proposed.version)
        },
        {
            label: 'Max message bits',
            current: current ? formatCount(current.max_msg_bits) : 'Param not set (defaults)',
            proposed: formatCount(proposed.max_msg_bits)
        },
        {
            label: 'Max message cells',
            current: current ? formatCount(current.max_msg_cells) : 'Param not set (defaults)',
            proposed: formatCount(proposed.max_msg_cells)
        },
        {
            label: 'Max library cells',
            current: current ? formatCount(current.max_library_cells) : 'Param not set (defaults)',
            proposed: formatCount(proposed.max_library_cells)
        },
        {
            label: 'Max VM data depth',
            current: current ? formatCount(current.max_vm_data_depth) : 'Param not set (defaults)',
            proposed: formatCount(proposed.max_vm_data_depth)
        },
        {
            label: 'Max external message size',
            current: current ? formatBytes(current.max_ext_msg_size) : 'Param not set (defaults)',
            proposed: formatBytes(proposed.max_ext_msg_size)
        },
        {
            label: 'Max external message depth',
            current: current ? formatCount(current.max_ext_msg_depth) : 'Param not set (defaults)',
            proposed: formatCount(proposed.max_ext_msg_depth)
        },
        {
            label: 'Max account state cells',
            current: current ? formatNullableCount(current.max_acc_state_cells, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_acc_state_cells, 'Not set in v1')
        },
        {
            label: 'Max MC account state cells',
            current: current ? formatNullableCount(current.max_mc_acc_state_cells, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_mc_acc_state_cells, 'Not set in v1')
        },
        {
            label: 'Max account public libraries',
            current: current ? formatNullableCount(current.max_acc_public_libraries, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_acc_public_libraries, 'Not set in v1')
        },
        {
            label: 'Deferred out queue limit',
            current: current ? formatNullableCount(current.defer_out_queue_size_limit, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.defer_out_queue_size_limit, 'Not set in v1')
        },
        {
            label: 'Max message extra currencies',
            current: current ? formatNullableCount(current.max_msg_extra_currencies, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_msg_extra_currencies, 'Not set in v1')
        },
        {
            label: 'Max account fixed prefix length',
            current: current ? formatNullableCount(current.max_acc_fixed_prefix_length, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_acc_fixed_prefix_length, 'Not set in v1')
        },
        {
            label: 'Storage dict accounting cells',
            current: current ? formatNullableCount(current.acc_state_cells_for_storage_dict, 'Not set in v1') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.acc_state_cells_for_storage_dict, 'Not set in v1')
        },
        {
            label: 'Max transaction library loads',
            current: current ? formatNullableCount(current.max_transaction_library_loads, 'Not set') : 'Param not set (defaults)',
            proposed: formatNullableCount(proposed.max_transaction_library_loads, 'Not set')
        }
    ];
}

function buildValidatorRegistryChangeRows(
    current: ValidatorRegistryConfig | null,
    proposed: ValidatorRegistryConfig
): ChangeRow[] {
    return [
        {
            label: 'Registry contract',
            current: current ? formatMasterchainAddress(current.contract_address) : 'Param not set',
            proposed: formatMasterchainAddress(proposed.contract_address)
        },
        {
            label: 'Max collators per validator',
            current: current ? formatCount(current.max_collators_per_validator) : 'Param not set',
            proposed: formatCount(proposed.max_collators_per_validator)
        },
        {
            label: 'Registry code upgrade',
            current: current ? formatOptionalCodeHash(current.new_code_hash) : 'Param not set',
            proposed: formatOptionalCodeHash(proposed.new_code_hash)
        }
    ];
}

function buildOracleBridgeChangeRows(current: OracleBridgeParams | null, proposed: OracleBridgeParams): ChangeRow[] {
    return [
        {
            label: 'Bridge address',
            current: current ? formatMasterchainAddress(current.bridge_address) : 'Param not set',
            proposed: formatMasterchainAddress(proposed.bridge_address)
        },
        {
            label: 'Oracle multisig address',
            current: current ? formatMasterchainAddress(current.oracle_multisig_address) : 'Param not set',
            proposed: formatMasterchainAddress(proposed.oracle_multisig_address)
        },
        {
            label: 'Oracle keys',
            current: current ? formatPlural(current.oracle_count, 'oracle') : 'Param not set',
            proposed: formatPlural(proposed.oracle_count, 'oracle')
        },
        {
            label: 'External chain address',
            current: current ? formatExternalChainAddress(current.external_chain_address) : 'Param not set',
            proposed: formatExternalChainAddress(proposed.external_chain_address)
        }
    ];
}

function buildJettonBridgeChangeRows(current: JettonBridgeParams | null, proposed: JettonBridgeParams): ChangeRow[] {
    const rows: ChangeRow[] = [
        {
            label: 'Bridge schema',
            current: current ? formatConfigVersion(current.version) : 'Param not set',
            proposed: formatConfigVersion(proposed.version)
        },
        {
            label: 'Bridge address',
            current: current ? formatMasterchainAddress(current.bridge_address) : 'Param not set',
            proposed: formatMasterchainAddress(proposed.bridge_address)
        },
        {
            label: 'Oracle multisig address',
            current: current ? formatMasterchainAddress(current.oracles_address) : 'Param not set',
            proposed: formatMasterchainAddress(proposed.oracles_address)
        },
        {
            label: 'Oracle keys',
            current: current ? formatPlural(current.oracle_count, 'oracle') : 'Param not set',
            proposed: formatPlural(proposed.oracle_count, 'oracle')
        },
        {
            label: 'State flags',
            current: current ? formatCount(current.state_flags) : 'Param not set',
            proposed: formatCount(proposed.state_flags)
        }
    ];

    if ((current?.burn_bridge_fee ?? null) !== null || proposed.burn_bridge_fee !== null) {
        rows.push({
            label: 'Burn bridge fee',
            current: current ? formatNullableTonAmount(current.burn_bridge_fee) : 'Param not set',
            proposed: formatNullableTonAmount(proposed.burn_bridge_fee)
        });
    }

    if (current?.prices || proposed.prices) {
        rows.push(
            {
                label: 'Bridge burn fee',
                current: current?.prices ? formatTonAmount(current.prices.bridge_burn_fee) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.bridge_burn_fee) : 'Not set'
            },
            {
                label: 'Bridge mint fee',
                current: current?.prices ? formatTonAmount(current.prices.bridge_mint_fee) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.bridge_mint_fee) : 'Not set'
            },
            {
                label: 'Wallet storage reserve',
                current: current?.prices ? formatTonAmount(current.prices.wallet_min_tons_for_storage) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.wallet_min_tons_for_storage) : 'Not set'
            },
            {
                label: 'Wallet gas consumption',
                current: current?.prices ? formatTonAmount(current.prices.wallet_gas_consumption) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.wallet_gas_consumption) : 'Not set'
            },
            {
                label: 'Minter storage reserve',
                current: current?.prices ? formatTonAmount(current.prices.minter_min_tons_for_storage) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.minter_min_tons_for_storage) : 'Not set'
            },
            {
                label: 'Discover gas consumption',
                current: current?.prices ? formatTonAmount(current.prices.discover_gas_consumption) : 'Not set',
                proposed: proposed.prices ? formatTonAmount(proposed.prices.discover_gas_consumption) : 'Not set'
            }
        );
    }

    if ((current?.external_chain_address ?? null) !== null || proposed.external_chain_address !== null) {
        rows.push({
            label: 'External chain address',
            current: current?.external_chain_address !== null && current?.external_chain_address !== undefined
                ? formatExternalChainAddress(current.external_chain_address)
                : 'Not set',
            proposed: proposed.external_chain_address !== null
                ? formatExternalChainAddress(proposed.external_chain_address)
                : 'Not set'
        });
    }

    return rows;
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

type ConsensusDisplayField = {
    key: string,
    label: string,
    value: string
};

function buildConsensusSideChangeRows(
    scope: 'Masterchain' | 'Shardchains',
    current: ConsensusConfig | null,
    proposed: ConsensusConfig | null
): ChangeRow[] {
    if (!current || !proposed) {
        if (current === proposed) {
            return [];
        }

        return [{
            label: `${scope} · Consensus mode`,
            current: describeConsensusMode(current),
            proposed: describeConsensusMode(proposed)
        }];
    }

    const currentFields = new Map(getConsensusDisplayFields(current).map((field) => [field.key, field]));
    const proposedFields = new Map(getConsensusDisplayFields(proposed).map((field) => [field.key, field]));
    const fieldKeys = Array.from(new Set([...currentFields.keys(), ...proposedFields.keys()]));

    return fieldKeys.flatMap((key) => {
        const currentField = currentFields.get(key);
        const proposedField = proposedFields.get(key);
        const currentValue = currentField?.value ?? describeMissingConsensusField(key);
        const proposedValue = proposedField?.value ?? describeMissingConsensusField(key);

        if (currentValue === proposedValue) {
            return [];
        }

        return [{
            label: `${scope} · ${currentField?.label ?? proposedField?.label ?? key}`,
            current: currentValue,
            proposed: proposedValue
        }];
    });
}

function getConsensusDisplayFields(config: ConsensusConfig): ConsensusDisplayField[] {
    const fields: ConsensusDisplayField[] = [
        {
            key: 'format',
            label: 'Config format',
            value: config.version === 'simplex_config'
                ? 'Simplex v1 (fixed layout)'
                : 'Simplex v2 (extensible layout)'
        },
        {
            key: 'reserved_flags',
            label: 'Reserved flags',
            value: describeReservedConsensusFlags(config.flags)
        },
        {
            key: 'transport',
            label: 'Transport',
            value: config.use_quic ? 'QUIC' : 'RLDP2'
        },
        {
            key: 'slots_per_leader_window',
            label: 'Slots per leader window',
            value: formatPlural(config.slots_per_leader_window, 'slot')
        }
    ];

    if (config.version === 'simplex_config') {
        fields.push(
            {
                key: 'target_rate',
                label: 'Target block interval',
                value: formatMilliseconds(config.target_rate_ms)
            },
            {
                key: 'first_block_timeout',
                label: 'First block timeout',
                value: formatMilliseconds(config.first_block_timeout_ms)
            },
            {
                key: 'max_leader_window_desync',
                label: 'Max leader-window desync',
                value: formatCount(config.max_leader_window_desync)
            }
        );
        return fields;
    }

    fields.splice(1, 0, {
        key: 'protocol_version',
        label: 'Protocol version',
        value: describeSimplexProtocolVersion(config.protocol_version)
    });

    for (const [idText, rawValue] of Object.entries(config.noncritical).sort(([left], [right]) => Number(left) - Number(right))) {
        const id = Number(idText);
        fields.push({
            key: `noncritical:${id}`,
            label: SIMPLEX_NONCRITICAL_PARAMS[id]?.label ?? `Noncritical param ${id}`,
            value: describeSimplexNoncriticalValue(id, rawValue, true)
        });
    }

    return fields;
}

function describeConsensusMode(config: ConsensusConfig | null): string {
    if (!config) {
        return 'Legacy Catchain path (Simplex config absent)';
    }

    return config.version === 'simplex_config'
        ? 'Simplex enabled (fixed-layout v1 config)'
        : 'Simplex enabled (extensible v2 config)';
}

function describeMissingConsensusField(key: string): string {
    if (key.startsWith('noncritical:')) {
        return describeSimplexNoncriticalValue(Number(key.slice('noncritical:'.length)), undefined, false);
    }

    return 'Not part of this config format';
}

function describeReservedConsensusFlags(flags: number): string {
    return flags === 0
        ? '0 (none)'
        : `${flags} (${formatHex(BigInt(flags))}; meaning not defined by the current node)`;
}

function describeSimplexProtocolVersion(version: number): string {
    if (version === 0) {
        return '0 — baseline Simplex protocol';
    }
    if (version === 1) {
        return '1 — dedicated block-sync overlay';
    }

    return `${version} — new DB identity, private-overlay observers, and Plumtree block broadcast`;
}

function describeSimplexNoncriticalValue(id: number, rawValue: number | undefined, explicit: boolean): string {
    const metadata = SIMPLEX_NONCRITICAL_PARAMS[id];
    if (!metadata) {
        return rawValue === undefined ? 'Not set; node default' : `${formatCount(rawValue)} (raw uint32)`;
    }

    const value = rawValue === undefined ? metadata.defaultValue : rawValue;
    let formatted: string;

    switch (metadata.kind) {
        case 'milliseconds':
            formatted = formatMilliseconds(value);
            break;
        case 'float32':
            formatted = formatFloat32(rawValue === undefined ? value : reinterpretUint32AsFloat32(value));
            break;
        case 'bytes_per_second':
            formatted = `${formatBytes(value)}/s`;
            break;
        case 'count':
            formatted = formatCount(value);
            break;
    }

    return `${formatted} (${explicit ? 'explicit override' : 'node default'})`;
}

function reinterpretUint32AsFloat32(value: number): number {
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, value);
    return view.getFloat32(0);
}

function formatFloat32(value: number): string {
    return Number.isFinite(value) ? String(Number(value.toPrecision(7))) : String(value);
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

const CAPABILITY_BIT_LABELS: Record<number, string> = {
    9: 'full collated data'
};

function describeCapabilityMask(value: bigint): string {
    const bits = getSetBitPositions(value);
    const bitList = bits.length ? `bits ${bits.join(', ')}` : 'no bits set';
    return `${formatCount(value)} (${formatHex(value)}, ${bitList})`;
}

function describeCapabilityDelta(current: bigint, proposed: bigint, proposedColumn: boolean): string {
    const changed = current ^ proposed;

    if (changed === 0n) {
        return 'No capability mask change';
    }

    const added = proposed & changed;
    const removed = current & changed;
    const parts: string[] = [];

    if (added !== 0n) {
        parts.push(`adds ${describeCapabilityBits(added)}`);
    }
    if (removed !== 0n) {
        parts.push(`removes ${describeCapabilityBits(removed)}`);
    }

    return proposedColumn ? parts.join('; ') : `Changed bits: ${describeCapabilityBits(changed)}`;
}

function describeCapabilityBits(mask: bigint): string {
    return getSetBitPositions(mask)
        .map((bit) => {
            const numeric = 1n << BigInt(bit);
            const label = CAPABILITY_BIT_LABELS[bit];
            return label ? `+${numeric.toString()} ${label}` : `+${numeric.toString()} (bit ${bit})`;
        })
        .join(', ');
}

function getSetBitPositions(value: bigint): number[] {
    const bits: number[] = [];

    for (let bit = 0; bit < 64; bit += 1) {
        if ((value & (1n << BigInt(bit))) !== 0n) {
            bits.push(bit);
        }
    }

    return bits;
}

function formatConfigVersion(value: string) {
    return value.replace(/_/g, ' ');
}

function formatNullableBoolean(value: boolean | null) {
    if (value === null) {
        return 'Not set';
    }
    return value ? 'Enabled' : 'Disabled';
}

function formatNullableNumber(value: number | null) {
    return value === null ? 'Not set' : formatCount(value);
}

function formatNullableCount(value: number | null, emptyLabel: string) {
    return value === null ? emptyLabel : formatCount(value);
}

function formatNullableTonAmount(value: bigint | null) {
    return value === null ? 'Not set' : formatTonAmount(value);
}

function formatMilliseconds(value: number) {
    return `${formatCount(value)} ms`;
}

function formatBytes(value: number) {
    const bytes = formatCount(value);

    if (value >= 1024 * 1024 && value % 1024 === 0) {
        return `${bytes} bytes (${formatFixedRatio(BigInt(value), 1024n * 1024n, 2)} MiB)`;
    }

    return `${bytes} bytes`;
}

function formatMasterchainAddress(value: bigint) {
    return new Address(-1, Buffer.from(formatBits256(value), 'hex')).toRawString();
}

function formatExternalChainAddress(value: bigint) {
    return `0x${formatBits256(value)}`;
}

function formatBits256(value: bigint) {
    return value.toString(16).padStart(64, '0').toUpperCase();
}

function formatOptionalCodeHash(value: bigint | null) {
    return value === null ? 'Not scheduled' : `0x${formatBits256(value)}`;
}

function formatHex(value: bigint) {
    return `0x${value.toString(16)}`;
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

function formatPlural(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
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
