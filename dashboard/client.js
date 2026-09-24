import { fetchMainnetVotingSnapshot } from './mainnetVoting';
import { toncenter } from './toncenter';
import { SnapshotPoller } from './polling';
import { TONCENTER_API_KEY } from './settings';

const heroStats = document.getElementById('hero-stats');
const heroMeta = document.getElementById('hero-meta');
const proposalList = document.getElementById('proposal-list');
const proposalCounter = document.getElementById('proposal-counter');
const resolvedList = document.getElementById('resolved-list');
const resolvedCounter = document.getElementById('resolved-counter');
const statusNode = document.getElementById('status');
const connectionStatus = document.getElementById('connection-status');
const footerNote = document.getElementById('footer-note');
const refreshButton = document.getElementById('refresh-button');
const actonscanLink = document.getElementById('actonscan-link');
const MTONGA_PLAN_URL = 'https://t.me/durov/482';
const SNAPSHOT_STORAGE_KEY = 'ton-config-voting:last-snapshot:v10';
let lastSnapshot = null;
toncenter.setApiKey(TONCENTER_API_KEY);

const poller = new SnapshotPoller(fetchMainnetVotingSnapshot, (snapshot) => {
  renderSnapshot(snapshot);
  lastSnapshot = snapshot;
  writeStoredSnapshot(snapshot);
}, (state) => {
  refreshButton.disabled = state.kind === 'loading';
  refreshButton.textContent = state.kind === 'loading' ? 'Refreshing…' : 'Refresh now';
  if (state.kind === 'ready') {
    connectionStatus.textContent = '';
    connectionStatus.className = '';
    return;
  }
  connectionStatus.className = state.kind === 'error' ? 'error' : 'empty';
  if (state.kind === 'loading') {
    connectionStatus.textContent = lastSnapshot
      ? 'Refreshing live mainnet data…'
      : 'Loading live mainnet data…';
    return;
  }
  const retrySeconds = Math.max(1, Math.ceil((state.retryAt - Date.now()) / 1000));
  const saved = lastSnapshot ? ` Showing last successful data from ${formatTime(lastSnapshot.fetchedAt)}.` : '';
  connectionStatus.textContent = `${state.message}${saved} Retrying automatically in ${retrySeconds}s.`;
});

refreshButton.addEventListener('click', () => { void poller.refresh(); });
window.addEventListener('online', () => { void poller.refresh(); });

proposalList.addEventListener('click', copyHashFromClick);
proposalList.addEventListener('click', switchProposalTabFromClick);
proposalList.addEventListener('input', filterVotersFromInput);
resolvedList.addEventListener('click', copyHashFromClick);

function switchProposalTabFromClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const button = target ? target.closest('[data-proposal-tab]') : null;
  if (!button) {
    return;
  }

  const proposal = button.closest('.proposal');
  const panelId = button.dataset.tabTarget;
  if (!proposal || !panelId) {
    return;
  }

  proposal.querySelectorAll('[data-proposal-tab]').forEach((tab) => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
  });

  proposal.querySelectorAll('[data-proposal-tab-panel]').forEach((panel) => {
    panel.hidden = panel.id !== panelId;
  });
}

function filterVotersFromInput(event) {
  const target = event.target instanceof Element ? event.target : null;
  const input = target ? target.closest('[data-voter-search]') : null;
  if (!input) {
    return;
  }

  const panel = input.closest('[data-voter-panel]');
  if (!panel) {
    return;
  }

  const query = input.value.trim().toLowerCase().replace(/^0x/, '');
  const rows = Array.from(panel.querySelectorAll('[data-voter-row]'));
  let visible = 0;

  rows.forEach((row) => {
    const matches = !query || (row.dataset.search || '').includes(query);
    row.hidden = !matches;
    if (matches) {
      visible += 1;
    }
  });

  const count = panel.querySelector('[data-voter-match-count]');
  if (count) {
    count.textContent = query ? `${visible} of ${rows.length} voters` : `${rows.length} voters`;
  }

  const noResults = panel.querySelector('[data-voter-no-results]');
  if (noResults) {
    noResults.hidden = visible !== 0;
  }
}

async function copyHashFromClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const button = target ? target.closest('.copy-hash') : null;
  if (!button) {
    return;
  }

  const value = button.dataset.copyValue;
  if (!value) {
    return;
  }

  const copied = await copyText(value);
  if (!copied) {
    return;
  }

  const label = button.querySelector('.copy-label');
  const previous = label ? label.textContent : '';
  button.classList.add('copied');
  if (label) {
    label.textContent = 'Copied';
  }

  window.setTimeout(() => {
    button.classList.remove('copied');
    if (label) {
      label.textContent = previous || 'Copy';
    }
  }, 1200);
}

start();

function start() {
  const cached = readStoredSnapshot();
  if (cached) {
    try {
      renderSnapshot(cached.snapshot);
      lastSnapshot = cached.snapshot;
    } catch {
      // An incompatible or corrupt saved snapshot must not prevent live loading.
      heroStats.innerHTML = '';
      heroMeta.innerHTML = '';
      proposalList.innerHTML = '';
      resolvedList.innerHTML = '';
      setStatus('', '');
    }
  }
  void poller.refresh();
}

function readStoredSnapshot() {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.snapshot || typeof parsed.snapshot !== 'object') {
      window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function writeStoredSnapshot(snapshot) {
  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      snapshot,
    }));
  } catch (error) {
  }
}

function renderSnapshot(snapshot) {
  setStatus('', '');
  proposalList.innerHTML = '';
  resolvedList.innerHTML = '';
  actonscanLink.href = snapshot.configContract.actonscanConfigUrl;
  const resolvedProposals = getResolvedProposals(snapshot);
  proposalCounter.textContent = `${snapshot.proposalCount} live ${snapshot.proposalCount === 1 ? 'proposal' : 'proposals'}`;
  resolvedCounter.textContent = `${resolvedProposals.length} remembered ${resolvedProposals.length === 1 ? 'outcome' : 'outcomes'}`;

  const roundEnds = formatTime(snapshot.validatorRound.currentSetEndsAt);
  const fetchedAt = formatTime(snapshot.fetchedAt);

  heroStats.innerHTML = [
    statCard('Live proposals', String(snapshot.proposalCount)),
    statCard('Validators', `${snapshot.validatorRound.totalValidators}`),
    statCard('Main validators', `${snapshot.validatorRound.mainValidators}`),
    statCard('Round threshold', '75%'),
  ].join('');

  const configAddress = snapshot.configContract.friendly;
  const shortConfigAddress = shortenMiddle(configAddress, 10, 8);

  heroMeta.innerHTML = [
    `<span>Config contract <a class="meta-link mono" href="${snapshot.configContract.actonscanUrl}" target="_blank" rel="noreferrer" title="${escapeHtml(configAddress)}">${escapeHtml(shortConfigAddress)}</a></span>`,
    `<span>Validator round ends ${roundEnds}</span>`,
    `<span>Last pulled ${fetchedAt}</span>`,
  ].join('');

  footerNote.textContent =
    `Normal proposals need ${snapshot.votingRules.normal.min_wins} winning rounds. ` +
    `Critical proposals need ${snapshot.votingRules.critical.min_wins}. ` +
    `Data source: live mainnet config contract.`;

  renderResolvedSection(snapshot);

  if (!snapshot.proposals.length) {
    renderEmptyState(snapshot, roundEnds);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const proposal of snapshot.proposals) {
    const article = document.createElement('article');
    article.className = 'proposal';
    article.innerHTML = renderProposal(proposal, snapshot.validatorRound.totalValidators);
    fragment.appendChild(article);
  }

  proposalList.appendChild(fragment);
}

function renderEmptyState(snapshot, roundEnds) {
  setStatus('', '');
  statusNode.className = 'empty';
  statusNode.innerHTML = `
    <h3>No active config proposals right now</h3>
    <p>The dashboard is live. TON mainnet currently has zero open config proposals, so there are no active voting cards to show.</p>
    <div class="empty-grid">
      ${emptyMetric('Live proposals', String(snapshot.proposalCount))}
      ${emptyMetric('Validators', `${snapshot.validatorRound.totalValidators}`)}
      ${emptyMetric('Main validators', `${snapshot.validatorRound.mainValidators}`)}
      ${emptyMetric('Round ends', roundEnds)}
      ${emptyMetric('Normal wins needed', `${snapshot.votingRules.normal.min_wins}`)}
      ${emptyMetric('Critical wins needed', `${snapshot.votingRules.critical.min_wins}`)}
    </div>
  `;
}

function renderResolvedSection(snapshot) {
  const resolvedProposals = getResolvedProposals(snapshot);

  if (!resolvedProposals.length) {
    resolvedList.className = 'empty';
    resolvedList.innerHTML = '<p>No remembered resolved proposals yet.</p>';
    return;
  }

  resolvedList.className = '';
  resolvedList.innerHTML = resolvedProposals.map(renderResolvedProposal).join('');
}

function getResolvedProposals(snapshot) {
  if (Array.isArray(snapshot.resolvedProposals)) {
    return snapshot.resolvedProposals;
  }

  return snapshot.resolvedProposal ? [snapshot.resolvedProposal] : [];
}

function renderResolvedProposal(proposal) {
  const source = normalizeProposalSource(proposal.source);
  if (proposal.featured) {
    return renderFeaturedResolvedProposal(proposal, source);
  }

  return `
    <div class="resolved-card">
      <div class="chips">
        ${renderProposalSourceChip(source)}
        <span class="chip good">Accepted</span>
        <span class="chip">Param ${proposal.paramId}</span>
      </div>
      <h4>${escapeHtml(proposal.paramLabel)}</h4>
      <p>${escapeHtml(proposal.summary)}</p>
      <p>${escapeHtml(proposal.closedBecause)}</p>
      <div class="change-grid">
        ${proposal.changeRows.map((row) => `
          <div class="change-row">
            <div class="change-label"><strong>${escapeHtml(row.label)}</strong></div>
            <div class="change-box">${renderChangeValue(row.current)}</div>
            <div class="change-box proposed">${renderChangeValue(row.proposed)}</div>
          </div>
        `).join('')}
      </div>
      <div class="meta">
        <span>
          Proposal hash
          <button class="copy-hash" type="button" data-copy-value="${proposal.hash}">
            <span class="mono">${proposal.hash.slice(0, 16)}…${proposal.hash.slice(-10)}</span>
            <span class="copy-label">Copy</span>
          </button>
        </span>
      </div>
    </div>
  `;
}

function renderFeaturedResolvedProposal(proposal, source) {
  return `
    <div class="resolved-card featured-resolved proposal">
      <div class="proposal-head">
        <div>
          <p class="eyebrow">Param ${proposal.paramId}</p>
          <h3 class="proposal-title">${escapeHtml(proposal.paramLabel)}</h3>
        </div>
        <div class="chips">
          ${renderProposalSourceChip(source)}
          <span class="chip good">Accepted</span>
          <span class="chip good">Applied on-chain</span>
        </div>
      </div>

      <p class="summary">${escapeHtml(proposal.summary)}</p>

      <div class="resolved-status-panel">
        <span class="resolved-status-icon" aria-hidden="true">✓</span>
        <div class="resolved-status-copy">
          <strong>Accepted and applied</strong>
          <p>${escapeHtml(proposal.closedBecause)}</p>
        </div>
      </div>

      <div class="proposal-tabs resolved-proposal-tabs" aria-label="Proposal details">
        <button class="proposal-tab" type="button" aria-selected="true" disabled>Changes</button>
      </div>

      <section>
        <div class="change-grid">
          ${proposal.changeRows.map((row) => `
            <div class="change-row">
              <div class="change-label"><strong>${escapeHtml(row.label)}</strong></div>
              <div class="change-box">${renderChangeValue(row.current)}</div>
              <div class="change-box proposed">${renderChangeValue(row.proposed)}</div>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="meta">
        <span>
          Proposal hash
          <button class="copy-hash" type="button" data-copy-value="${proposal.hash}">
            <span class="mono">${proposal.hash.slice(0, 16)}…${proposal.hash.slice(-10)}</span>
            <span class="copy-label">Copy</span>
          </button>
        </span>
        <span>Resolved · accepted on mainnet</span>
      </div>
    </div>
  `;
}

function renderProposal(proposal, totalValidators) {
  const source = normalizeProposalSource(proposal.source);
  const severityClass = proposal.critical ? 'critical' : 'good';
  const severityLabel = proposal.critical ? 'Critical' : 'Non-critical';
  const deadline = formatTime(proposal.expiresAt);
  const proposalId = proposal.hash;
  const metrics = [
    metricCard('Voted validators', `${proposal.voterCount} / ${totalValidators}`),
    metricCard(
      'Min validators needed',
      formatNeededValidatorCount(proposal.neededValidatorCount),
      'Minimum additional validators needed if the largest remaining validators vote first.'
    ),
    metricCard('Weight in favor', `${proposal.yesPercentOfTotal}% of total`),
    metricCard('Needed this round', `${proposal.neededPercentOfTotal}% more`),
    metricCard('Round wins', `${proposal.wins} / ${proposal.rule.min_wins}`),
    metricCard('Losses', `${proposal.losses} / ${proposal.rule.max_losses}`),
    metricCard('Rounds left', `${proposal.roundsRemaining}`),
  ].join('');

  const changes = proposal.changeRows
    ? `
      <div class="change-grid">
        ${proposal.changeRows.map((row) => `
          <div class="change-row">
            <div class="change-label"><strong>${escapeHtml(row.label)}</strong></div>
            <div class="change-box">${renderChangeValue(row.current)}</div>
            <div class="change-box proposed">${renderChangeValue(row.proposed)}</div>
          </div>
        `).join('')}
      </div>
    `
    : '<p class="voter-empty">No structured parameter changes are available.</p>';

  const voters = renderVotersPanel(proposal);

  return `
    <div class="proposal-head">
      <div>
        <p class="eyebrow">Param ${proposal.paramId}</p>
        <h3 class="proposal-title">${escapeHtml(proposal.paramLabel)}</h3>
      </div>
      <div class="chips">
        ${renderProposalSourceChip(source)}
        <span class="chip ${severityClass}">${severityLabel}</span>
        <span class="chip">${proposal.validatorSetMatchesCurrent ? 'Current validator set' : 'Awaiting set rollover'}</span>
        <span class="chip">Deadline ${deadline}</span>
      </div>
    </div>

    <p class="summary">${escapeHtml(proposal.summary)}</p>

    <div class="progress-panel">
      <div class="progress-top">
        <span>Current round progress</span>
        <strong>${proposal.yesPercentOfTotal}% of total validator weight</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${proposal.yesPercentOfTotal}%"></div>
        <div class="progress-threshold" aria-hidden="true"></div>
      </div>
      <div class="progress-threshold-label">
        <span class="progress-threshold-dot" aria-hidden="true"></span>
        <span>Threshold at 75% of total validator weight</span>
      </div>
      <div class="metric-grid">${metrics}</div>
    </div>

    <div class="proposal-tabs" role="tablist" aria-label="Proposal details">
      <button
        class="proposal-tab"
        id="changes-tab-${proposalId}"
        type="button"
        role="tab"
        aria-selected="true"
        aria-controls="changes-${proposalId}"
        data-proposal-tab
        data-tab-target="changes-${proposalId}"
      >Changes</button>
      <button
        class="proposal-tab"
        id="voters-tab-${proposalId}"
        type="button"
        role="tab"
        aria-selected="false"
        aria-controls="voters-${proposalId}"
        tabindex="-1"
        data-proposal-tab
        data-tab-target="voters-${proposalId}"
      >Voters (${proposal.voterCount})</button>
    </div>

    <section
      id="changes-${proposalId}"
      role="tabpanel"
      aria-labelledby="changes-tab-${proposalId}"
      data-proposal-tab-panel
    >${changes}</section>
    <section
      id="voters-${proposalId}"
      role="tabpanel"
      aria-labelledby="voters-tab-${proposalId}"
      data-proposal-tab-panel
      hidden
    >${voters}</section>

    <div class="meta">
      <span>
        Proposal hash
        <button class="copy-hash" type="button" data-copy-value="${proposal.hash}">
          <span class="mono">${proposal.hash.slice(0, 16)}…${proposal.hash.slice(-10)}</span>
          <span class="copy-label">Copy</span>
        </button>
      </span>
      <span>Expires ${deadline}</span>
    </div>
  `;
}

function renderVotersPanel(proposal) {
  const voters = Array.isArray(proposal.voters) ? proposal.voters : [];
  const identityNote = proposal.voterSetResolved
    ? 'The config contract stores validator-set indexes, not owner wallets or operator names. Search by index, validator public key, or ADNL address.'
    : 'The validator set referenced by this proposal is no longer present in config params 32, 34, or 36. Vote indexes are available, but public keys and ADNL addresses cannot be resolved.';
  const rows = voters.map(renderVoterRow).join('');
  const table = rows
    ? `
      <div class="voter-table-wrap">
        <table class="voter-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Validator public key</th>
              <th>ADNL address</th>
              <th>Role</th>
              <th>Voting weight</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
    : '<p class="voter-empty">No validators have voted in the current round yet.</p>';

  return `
    <div class="voter-panel" data-voter-panel>
      <div class="voter-toolbar">
        <label class="voter-search-label">
          Find your validator
          <input
            class="voter-search"
            type="search"
            placeholder="Index, public key, or ADNL address"
            autocomplete="off"
            data-voter-search
          >
        </label>
        <span class="voter-match-count" data-voter-match-count>${voters.length} voters</span>
      </div>
      <p class="voter-note">${escapeHtml(identityNote)}</p>
      <p class="voter-no-results" data-voter-no-results hidden>No voted validators match this identifier.</p>
      ${table}
    </div>
  `;
}

function renderVoterRow(voter) {
  const publicKey = voter.publicKey || '';
  const adnlAddress = voter.adnlAddress || '';
  const searchValue = `${voter.index} ${publicKey} ${adnlAddress}`.toLowerCase();
  const publicKeyCell = publicKey
    ? renderVoterIdentity(publicKey)
    : '<span class="voter-id">Not available</span>';
  const adnlCell = adnlAddress
    ? renderVoterIdentity(adnlAddress)
    : '<span class="voter-id">Not available</span>';
  const role = voter.role === 'main'
    ? 'Masterchain'
    : voter.role === 'shard'
      ? 'Shardchain'
      : 'Unknown';
  const weight = voter.weight
    ? `${escapeHtml(voter.weightPercentOfSet || '0.0000')}%<small title="${escapeHtml(voter.weight)} raw weight">${escapeHtml(formatInteger(voter.weight))} raw</small>`
    : 'Not available';

  return `
    <tr data-voter-row data-search="${escapeHtml(searchValue)}">
      <td><strong>#${escapeHtml(voter.index)}</strong></td>
      <td>${publicKeyCell}</td>
      <td>${adnlCell}</td>
      <td><span class="voter-role">${role}</span></td>
      <td class="voter-weight">${weight}</td>
    </tr>
  `;
}

function renderVoterIdentity(value) {
  return `
    <button class="copy-hash voter-copy" type="button" data-copy-value="${escapeHtml(value)}" title="${escapeHtml(value)}">
      <span class="mono">${escapeHtml(shortenMiddle(value, 12, 10))}</span>
      <span class="copy-label">Copy</span>
    </button>
  `;
}

function formatInteger(value) {
  try {
    return new Intl.NumberFormat('en-US').format(BigInt(value));
  } catch (error) {
    return String(value);
  }
}

function statCard(label, value) {
  return `
    <div class="stat">
      <span class="stat-label">${label}</span>
      <strong class="stat-value">${value}</strong>
    </div>
  `;
}

function metricCard(label, value, tooltip) {
  const info = tooltip
    ? `<span class="info-dot" tabindex="0" aria-label="${escapeHtml(tooltip)}" data-tooltip="${escapeHtml(tooltip)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.25"></circle><path d="M9.6 9.2a2.55 2.55 0 0 1 4.85 1.1c0 1.85-2.45 2.25-2.45 3.7"></path><path d="M12 17.25h.01"></path></svg></span>`
    : '';
  return `
    <div class="metric">
      <span class="label">${label}${info}</span>
      <span class="value">${value}</span>
    </div>
  `;
}

function emptyMetric(label, value) {
  return `
    <div class="empty-metric">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>
  `;
}

function setStatus(message, kind) {
  if (!message) {
    statusNode.innerHTML = '';
    statusNode.className = '';
    return;
  }
  statusNode.className = kind;
  statusNode.textContent = message;
}

async function copyText(value) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
  }

  try {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    return copied;
  } catch (error) {
    return false;
  }
}

function formatTime(input) {
  const date = typeof input === 'string' ? new Date(input) : new Date(input * 1000);
  const absolute = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
  const relative = formatRelative(date);
  return `${absolute} (${relative})`;
}

function formatRelative(date) {
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) {
    return 'now';
  }
  if (Math.abs(diffMinutes) < 60) {
    return relativeLabel(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    return relativeLabel(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  return relativeLabel(diffDays, 'day');
}

function relativeLabel(amount, unit) {
  const abs = Math.abs(amount);
  const plural = abs === 1 ? unit : `${unit}s`;
  return amount > 0 ? `in ${abs} ${plural}` : `${abs} ${plural} ago`;
}

function formatNeededValidatorCount(count) {
  if (typeof count !== 'number') {
    return 'After set rollover';
  }
  return `${count} more`;
}

function shortenMiddle(value, startLength, endLength) {
  const text = String(value);
  if (text.length <= startLength + endLength + 1) {
    return text;
  }
  return `${text.slice(0, startLength)}…${text.slice(-endLength)}`;
}

function normalizeProposalSource(source) {
  if (source && source.kind === 'mtonga') {
    return {
      kind: 'mtonga',
      label: 'MTONGA plan',
    };
  }

  return {
    kind: 'independent',
    label: 'Independent community proposal',
  };
}

function renderProposalSourceChip(source) {
  const label = escapeHtml(source.label);
  if (source.kind === 'mtonga') {
    return `<a class="chip mtonga" href="${MTONGA_PLAN_URL}" target="_blank" rel="noreferrer">${label}</a>`;
  }

  return `<span class="chip independent">${label}</span>`;
}

function renderChangeValue(value) {
  if (value && typeof value === 'object' && value.kind === 'contract-code') {
    const source = value.source
      ? `<a class="contract-code-source" href="${escapeHtml(value.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(value.source.label)} <span aria-hidden="true">↗</span></a>`
      : '';
    const codeHash = value.codeHash
      ? `
        <div class="contract-code-hash">
          <span class="contract-code-hash-label">Code cell hash</span>
          <button class="copy-hash" type="button" data-copy-value="${escapeHtml(value.codeHash)}" title="${escapeHtml(value.codeHash)}">
            <span class="mono">${escapeHtml(shortenMiddle(value.codeHash, 12, 10))}</span>
            <span class="copy-label">Copy</span>
          </button>
        </div>
      `
      : '';

    return `
      <div class="contract-code-change">
        <span class="contract-code-stage">${escapeHtml(value.stage)}</span>
        <strong class="contract-code-title">${escapeHtml(value.title)}</strong>
        <span class="contract-code-detail">${escapeHtml(value.detail)}</span>
        ${source}
        ${codeHash}
      </div>
    `;
  }

  return String(value)
    .split('\n')
    .map((line) => {
      const match = line.match(/^(from .+?)(: .*)$/);
      if (!match) {
        return escapeHtml(line);
      }

      return `<strong class="change-prefix">${escapeHtml(match[1])}</strong>${escapeHtml(match[2])}`;
    })
    .join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
