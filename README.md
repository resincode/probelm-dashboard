# ProbeLM dashboard

Public model monitoring and historical comparisons, with private provider administration. Nuxt/Vue serves the UI; a separate worker schedules the pinned [`probelm` / `mtest`](https://github.com/keton-id/probelm) CLI. The web process never executes probes.

## Podman: Mac, then Linux

Requires Podman and a Compose provider (`podman-compose` or Docker Compose). On macOS, start your Podman machine first. Monitoring stops while the Mac or VM sleeps.

```sh
podman machine start                    # macOS only, if stopped
./deploy/init.sh                        # creates external encryption key once
podman compose up -d --build
```

Open **http://localhost:3000**. The default port binds only to localhost.
1. Sign in at `/login` with your administrator account.
2. Set your secure password (minimum 12 characters). Admin operations require setting a new password on first login.
3. Open `/admin/providers`, add/edit a gateway and its API key, then test the connection.
4. Open `/admin/models`, sync the catalog, select models, and explicitly confirm canonical identities and revisions.
5. Set the interval and probe profile in `/admin/settings`.

Initial credentials can be set via `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` before first start. Existing accounts/passwords are never reset on restart. Public deployments require HTTPS, `COOKIE_SECURE=true`, and `APP_ORIGIN=https://your-dashboard.example` at the reverse proxy's canonical origin.

### Provider URLs and secrets

Enter an OpenAI-compatible **API base URL**, e.g. `https://openrouter.ai/api/v1` or `http://host.containers.internal:20128`. If your endpoint does not use `/v1`, enter the exact base URL without `/v1` and the dashboard preserves it. API keys are encrypted with AES-256-GCM and never returned by APIs. `.secrets/master-key` is 32 raw random bytes, mounted independently of the image/database. Keep this key backed up separately; losing it prevents recovery of stored provider credentials.

Private addresses are blocked unless explicitly allowlisted through `PROBE_ALLOWED_PRIVATE_HOSTS` (comma-separated exact hostnames/IPs). Compose allows `host.containers.internal` for a host-running 9Router; use e.g. `http://host.containers.internal:20128`, not `localhost` inside a container. Host gateway reachability and binding/firewall settings must permit the Podman VM. Set the allowlist to an empty string to disallow all private targets. DNS is validated and pinned; redirects are refused. Do not allowlist untrusted hosts or metadata services.
`Test connection` verifies authenticated catalog access, not model generation. A catalog entry does not guarantee that a model can be called with your account. New catalog models are not automatically monitored.

### Worker behavior

- `web` and `worker` share a local SQLite named volume, `probelm-dashboard-data` by default.
- The worker reads persisted settings; changes need no container restart.
- An active run retains its profile; new settings apply to the next run. Intervals are measured after completion, not fixed cron wall-clock slots.
- A fenced SQLite lease prevents overlaps across process/container PID namespaces. Crashed runs recover after their bounded lease expires; the child watchdog prevents lingering probes past the lease.
- Missed scheduled slots are recorded, not replayed as a burst. Provider/model enabled periods determine which targets were expected.
- Worker heartbeat is independent of the last model result. A stopped worker and stale measurements are visible.
- `mtest` remains the only measurement engine. A DNS-pinned local streaming relay isolates credentials, rejects redirects/unselected models, and checks stream termination. CLI subprocesses cannot inherit global `ROUTER_URL`, `ROUTER_KEY`, proxy settings, or other provider secrets.
- Default interval: 60 minutes. The current CLI makes a non-streaming availability call and a streaming measurement call per target, plus catalog discovery. Plan quota/cost accordingly; shorter intervals increase requests.

Inspect services:

```sh
podman compose ps
podman compose logs --tail=100 worker
podman compose down                     # keeps data; do not add -v
```

For Linux rootless autostart, see the installation comments and matching configuration in `deploy/quadlet/`. Import the same encryption key and use the same rootless account/data volume. Do not run Compose and Quadlet instances against that volume simultaneously. Native Linux ARM64 and AMD64 builds are supported by the multi-stage recipe; cross-architecture builds require a matching builder or emulation.

## Existing data, backup and restore

The web/worker schema migration preserves legacy runs/results and archives replaced mappings. Before first container startup, import the existing database using SQLite online backup (including committed WAL):

```sh
podman build -t localhost/probelm-dashboard:latest -f Containerfile .
./deploy/init.sh
./deploy/database.sh migrate "$HOME/.config/probelm/dashboard.db"
podman compose up -d
```

Migration refuses a populated or running destination volume. The original host database is not modified. Old external config-file credentials are not contained in a database backup: enter them once through the admin UI, and adjust host-local URLs for the container. Existing legacy environment references can be encrypted lazily if their values are explicitly supplied to the worker; new providers use UI-managed encrypted keys only.

```sh
./deploy/database.sh backup ./backups/dashboard.db
podman compose down
./deploy/database.sh restore ./backups/dashboard.db probelm-dashboard-restored
PROBE_DATA_VOLUME=probelm-dashboard-restored podman compose up -d
```

Persist a custom `PROBE_DATA_VOLUME`, `PORT`, `APP_ORIGIN`, and other deployment overrides in a private `.env`. Restore the matching master key separately. Neither backup nor restore overwrites existing destinations. Do not copy only a live `.db` file and omit its WAL. SQLite is for one host with local storage, not NFS or multi-host replicas.

## Monitoring workspace

- `/`: full-height split workspace, independently scrolling model selector and historical detail panel, resizable model panel, list/cards and density preferences.
- `/compare`: canonical-model comparison across selected gateways.
- `/models/:id/history`: historical permalink with range/profile query parameters; 24h, 7d, 30d or custom range (up to 366 days).
- TTFT/total/throughput tabs, gateway overlays, Uptime Kuma-style status blocks, sample drilldown and accessible sample table.
- Profile and model revision cohorts are kept separate; disabled/replaced mappings retain history. Public responses exclude endpoints, credentials and raw internal errors.

This is **sampled availability**, not continuous uptime or an SLA. Missing observations are not successful probes. Aggregated blocks retain failure/missing counts. TTFT includes content or reasoning and local relay overhead. Throughput is tokens divided by total request time, not isolated decoding speed. `mtest` may estimate tokens and does not identify exact versus estimated counts in its output; short replies are not reliable throughput benchmarks. Legacy profiles have no recoverable parameter snapshot. Historical queries flag truncation above 100,000 samples; choose a narrower range for complete samples/statistics.

Google/Microsoft Entra ID login, non-OpenAI-compatible native APIs, and upstream selection within OpenRouter are not implemented in this scope.

## Local development and verification

Requires Node 24 LTS and `mtest` in PATH or `MTEST_BIN` for the worker. Containers build their own pinned Linux binary.

```sh
npm ci
./deploy/init.sh
export PROBE_MASTER_KEY_FILE="$PWD/.secrets/master-key"
export COOKIE_SECURE=false
npm run dev
# Separate terminal with the same PROBE_DB/key/network configuration:
npm run worker
# Optional external one-shot execution (never through public dashboard):
npm run worker:once

npm run typecheck
node --import tsx --test test/history.test.ts test/scheduler.test.ts
npm run build
```

Keep local development data separate from production via `PROBE_DB`. Production web command: `node .output/server/index.mjs`. Public API: `/api/overview`, `/api/models/:id/history`, `/api/health`; all provider, credential, mapping and settings APIs live under authenticated `/api/admin/`.
