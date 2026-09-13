# 2026-09-13: Initial Docker and database infrastructure

## User request

The complete originating request is preserved verbatim in
[docker-database-request](2026-09-13-docker-database-request.md). It asks for one
root Compose file supporting an optional persistent local PostgreSQL database,
external PostgreSQL, host and container migration execution, and a disposable
Docker-backed run of the existing persistence integration harness. Docker must
remain optional, ordinary checks must remain infrastructure independent, and API,
web and worker containers remain deferred.

After execution was interrupted, the user asked:

> looks like I ran out of tokens while you were doing this, continue where you
> left off and make sure you've completed everything that was asked

Work resumed from the existing implementation and completed its live verification,
review, documentation, and history requirements.

## Sources and starting state

Read `AGENTS.md`, the repository, persistence decisions 0003, 0014 and 0015, the
existing persistence request/implementation history, workspace-source history,
README, package scripts, lockfile, migration SQL/metadata, and the live PostgreSQL
test harness before implementation. Existing persistence topology and migrations
were preserved.

Official image metadata and PostgreSQL release documentation were checked on
2026-09-13. `node:current-bookworm-slim` mapped to Node 26.8.2;
`postgres:18.6-bookworm` existed and PostgreSQL 18.6 was the newest stable 18.x
patch. The PostgreSQL official image documentation confirmed the PostgreSQL 18
version-specific layout beneath a volume mounted at `/var/lib/postgresql` and the
supported `POSTGRES_INITDB_ARGS=--data-checksums` initialization mechanism.

The committed package lock unexpectedly represented
`@chris-shaw-2011/lint@1.4.0` as a machine-local `../lint` workspace link even
though `package.json` declares the published package. That path cannot exist in a
clean Docker build context. The lockfile was regenerated from the unchanged
published dependency version, using its authenticated GitHub Packages tarball.
No dependency version was intentionally upgraded for this repair.

## Implementation

Added one root `compose.yaml`. Its `local-db` profile supplies PostgreSQL 18.6
Bookworm with UTF-8 initialization, data checksums, a health check, loopback-only
port 5432, `unless-stopped` restart behavior, and named `postgres_data` storage at
`/var/lib/postgresql`. Docker initialization variables are separate from the
canonical `DATABASE_URL`; empty password defaults make accidental insecure local
initialization fail. The database service is not a dependency of migration tooling.

Added a root tooling Dockerfile based on `node:current-bookworm-slim`. It installs
CA certificates, copies the complete workspace, performs `npm ci`, and generates
the ignored Protobuf TypeScript during postinstall. The GitHub Packages token is
provided only through a required BuildKit secret, and npm cache/log storage is a
temporary mount. The final process runs as the existing non-root `node` user. No
application image, JavaScript transpilation, checked-in generated Proto, credential,
or source bind mount was added. `.node-version` remains 26 as the intentionally
validated repository version independently of the moving Docker tag.

Added the native TypeScript migration command under `packages/persistence`. It
requires `DATABASE_URL`, uses pg and Drizzle's node-postgres migrator over the
existing committed migration folder, checks PostgreSQL 18.6-or-newer stable 18.x,
UTF8 and 8192-byte pages, retries initial connectivity for a bounded 60 seconds,
and always closes its pool. Its failure output avoids echoing URLs or raw driver
details. The existing live harness now calls the same compatibility helper.
Unit tests cover accepted/newer patches, rejected major/old patch/encoding/page
size, immediate and retried readiness, timeout, and disposal of a failed client.

The Compose `migrate` service calls that same root migration script with runtime
`DATABASE_URL` and no dependency on `postgres`. The root host command calls the
same package script. Migrations continue to create `pg_trgm`; no image-entrypoint
schema initialization was introduced.

Added a disposable test profile and shell wrapper. Each invocation creates a unique
Compose project, random temporary database password, PostgreSQL tmpfs with no host
port, waits for database health, runs the unchanged `persistence:test:postgres`
harness, preserves its status, and tears down containers, network and volumes on
normal exit, failure, SIGINT, or SIGTERM. It does not read the developer `.env` or
reuse `postgres_data`.

Added root scripts for database up/down/reset, host/container migrations, and the
Docker persistence test. Normal down preserves data; reset announces that it is
destructive and passes `--volumes`. `npm run check` was not changed to invoke Docker
or PostgreSQL.

Added `.env.example`, `.dockerignore`, README setup/workflow/compatibility/security
documentation, and [decision 0016](../decisions/0016-optional-docker-database-infrastructure.md).
The documentation covers host, Compose and external connection URL shapes;
`pg_trgm` permissions; initialization-only settings; Node tag versus `.node-version`;
current limitations and cleanup behavior. No external PostgreSQL server was
available, so that route was verified structurally and through the host runner
against the normal loopback PostgreSQL interface. No code refers to the Compose
database hostname except documentation examples and disposable runtime configuration.

## Verification

`npm ci` succeeded from the corrected lockfile and regenerated ignored Proto output.
`npm run check` passed Proto clean/lint/generation, persistence migration drift,
ESLint, Knip, Sherif, every build/type check and **195 tests across 12 files**.
Compose configuration parsed with default, `local-db`, `tools`, and `test` profiles.
`git diff --check` passed. Generated Proto remained ignored and untracked.
`npm audit --omit=dev` reported zero production vulnerabilities.

The Docker tooling image built from the clean context and generated Proto during
installation. The disposable PostgreSQL 18.6 workflow reached healthy state, ran
the existing committed-migration integration harness successfully, and removed its
container and network afterward. The harness covered actual migrations, exact pg
round trips, tag projection/rebuild/concurrency, immutable offer history, cascades,
and physical index boundaries.

An isolated persistent Compose project then verified local database health and
applied all five committed migration journal entries. A second container migration
completed without reapplying migrations. Normal down/up retained all five journal
entries. The direct host `persistence:migrate` command connected over
`127.0.0.1:5432` and reported the same database current. PostgreSQL reported data
checksums `on`; Compose reported only `127.0.0.1:5432`. The isolated destructive
reset removed its exact named test volume. No existing development database or
volume was used or removed.

The host Docker client referenced an unavailable Docker Desktop credential helper.
Verification used a temporary empty client configuration at
`/tmp/carthound-docker-config`; this did not change repository or user Docker
configuration. The initial slim image also lacked CA certificates needed to verify
Buf's registry TLS certificate; installing Debian's `ca-certificates` in the image
fixed the clean build. These were environment/build discoveries, not persistence
architecture changes.

A final image audit reported Node 26.8.2, the non-root `node` user, and only the
base image PATH/NODE_VERSION environment entries; no credential environment value
was retained. `docker compose ls` showed no remaining CartHound verification or
disposable-test project after cleanup.
