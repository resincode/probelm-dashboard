# Native target builds: podman build -t localhost/probelm-dashboard:latest -f Containerfile .
# For a different architecture, use --platform linux/amd64 or linux/arm64 on a
# matching builder (or configure QEMU). Never copy host-native node_modules.
FROM docker.io/library/rust:1.94-bookworm AS probelm
ARG PROBELM_REV=2ddbafb60c78a05f9ad4be49f507ffcc857a2f52
WORKDIR /src
RUN git init . && git remote add origin https://github.com/resincode/probelm.git \
    && git fetch --depth 1 origin master && git checkout --detach FETCH_HEAD \
    && CARGO_BUILD_JOBS=1 cargo build --locked --release --bin probelm --bin mtest
# Nuxt requires Node >=24.11 within the 24 LTS line; better-sqlite3 requires >=22.
FROM docker.io/library/node:24-bookworm-slim AS app-build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM docker.io/library/node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data && chown node:node /data
WORKDIR /app
COPY --from=probelm /src/target/release/probelm /usr/local/bin/probelm
COPY --from=probelm /src/target/release/mtest /usr/local/bin/mtest
COPY --from=app-build /app/.output ./.output
COPY --from=app-build /app/node_modules ./node_modules
COPY --from=app-build /app/package.json ./package.json
COPY --from=app-build /app/server/utils ./server/utils
COPY --from=app-build /app/shared ./shared
COPY --from=app-build /app/scripts ./scripts
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 \
    PROBE_DB=/data/dashboard.db \
    PROBE_MASTER_KEY_FILE=/run/secrets/probe_master_key \
    PROBELM_BIN=/usr/local/bin/probelm \
    MTEST_BIN=/usr/local/bin/probelm
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", ".output/server/index.mjs"]
