# Blockchain Config Smart Contract

## Install Dependencies

`npm install`

## Compile Contracts

`npm run build`

## Run Tests

`npm run test`

## Run Live Voting Dashboard

`npm run dashboard`

Then open `http://localhost:3000`. This serves static files for development; all network reads, cell decoding, and vote calculations run in the browser. No backend is needed.

Put your Toncenter **mainnet** key into `TONCENTER_API_KEY` in [`dashboard/settings.ts`](dashboard/settings.ts), then rebuild. The key will be visible in the published JavaScript. Requests are serialized, with a minimum interval between starts of 110 ms with a key or 1.1 seconds without one. The second request uses the first response's block number so configuration and votes come from the same network state.

The browser refreshes immediately on page load and every **30 seconds** thereafter. Requests never overlap. The last successful snapshot is kept in memory and local storage. HTTP 429, API-level errors, timeouts, malformed responses, and network failures show a visible error without removing saved data. Automatic retries back off from 30 seconds to 5 minutes and respect `Retry-After` when the API exposes it through CORS. A successful refresh restores the normal interval.

Toncenter replacements (API v2):

| Data | Toncenter method |
| --- | --- |
| Config account state and all configuration parameters | `getAddressInformation`, decode the config dictionary from the account data |
| All active proposals, vote weights and voters | `runGetMethodStd` → `list_proposals`, at the same masterchain `seqno` as the account state |
| Single-proposal lookup, if needed | `runGetMethodStd` → `get_proposal`, with a typed integer hash argument |

The previous per-hash fallback is unnecessary with Toncenter's typed tuple/list results. API failures are retried rather than presenting a partial list of known proposals as a complete snapshot.

References: [TON Center API v2](https://docs.ton.org/api/v2/overview), [account state](https://docs.ton.org/api/v2/accounts/get-address-information), [typed get methods](https://docs.ton.org/api/v2/run-method/run-get-method-standard), [rate limits](https://docs.ton.org/api/rate-limit).

## Deploy to GitHub Pages

1. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. Push to `main`, or run the **Deploy dashboard to GitHub Pages** workflow manually.

The workflow type-checks the project, runs `npm run dashboard:test`, builds the site, then publishes `dashboard-dist`. For a manual build, run `npm run dashboard:build` and upload the **entire** directory to any static host. Relative asset paths work both at the domain root and under a GitHub Pages repository path. Node.js is only used for building/development, not on the deployed site.

The existing canonical URL, social-preview URLs and sitemap still target `https://vote.lagus.cooking/`. If deploying on a different public URL, update them in `dashboard/index.html`, `dashboard/robots.txt` and `dashboard/sitemap.xml`.

## Manual Build

Install FunC 4.6.0 binaries and related Fift binaries.

Compile: `func -SPA -o config.fif stdlib.fc config-code.fc`. Compiled Fift code will be in `config.fif`.

Print: `fift -s print-hex.fif` - Print code hash and BOC data in HEX.
