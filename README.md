# Blockchain Config Smart Contract

## Install Dependencies

`npm install`

## Compile Contracts

`npm run build`

## Run Tests

`npm run test`

## Run Live Voting Dashboard

`npm run dashboard`

Then open `http://localhost:3000`. The page pulls current TON mainnet config-voting data from the live network on each refresh.

The `/api/status` endpoint now uses shared in-memory caching to reduce upstream load. You can tune it with:

- `DASHBOARD_CACHE_TTL_MS` - how long the server keeps one live snapshot before refreshing it. Default: `15000`
- `DASHBOARD_CLIENT_CACHE_TTL_S` - browser/CDN cache hint for `/api/status`. Default: `5`

## Manual Build

Install FunC 4.6.0 binaries and related Fift binaries.

Compile: `func -SPA -o config.fif stdlib.fc config-code.fc`. Compiled Fift code will be in `config.fif`.

Print: `fift -s print-hex.fif` - Print code hash and BOC data in HEX.
