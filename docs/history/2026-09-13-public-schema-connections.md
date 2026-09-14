# 2026-09-13: Deterministic public-schema connections

## User request

The user asked to fix PostgreSQL schema handling so migrations and future runtime
database connections consistently use `public`, without adding configurable schema
support. `DATABASE_URL` must remain the only database-location/configuration input;
there must be no `DATABASE_SCHEMA`, schema detection, `pgSchema("public")`, migration
rewrites, arbitrary-schema support, or unrelated persistence/container changes.

The request identified that Drizzle's unqualified `pgTable()` creation can follow an
external server's `search_path`, while generated foreign keys may explicitly refer to
`"public"`. It required CartHound-owned pg sessions to start with
`search_path=public`, preferably through connection options, while retaining URL SSL
and query parameters. It also required focused unit and integration protection,
documentation of external-server support and the fixed public-schema policy, full
repository checks, repeat migration verification, and preservation of historical
migrations.

## Decision and implementation

The existing migration runner was the production gap: it constructed a plain pool,
while the PostgreSQL integration harness independently supplied
`-c search_path=public`. Added one small persistence-local pool configuration helper
that preserves the supplied connection string unchanged and always supplies that pg
session option. Existing `options=` values are retained ahead of CartHound's fixed
setting, so other caller-supplied PostgreSQL session parameters continue to work but
cannot override the public-schema invariant. Both paths now use the helper. It does
not accept a schema argument and does not introduce a database connection framework.

The unit test protects preservation of a URL containing SSL and another query
parameter alongside the fixed connection option. The live integration harness now
checks `current_schema()` and the effective `search_path` before applying migrations,
uses the same Drizzle migrator as production twice to protect idempotency, then
exercises the existing database behavior. This verifies the resolved session behavior
rather than searching source text. No migration, Drizzle schema, table name,
environment variable, Docker topology, or application runtime pool was changed.

Updated decision 0016 and the README to record that external PostgreSQL remains
supported, arbitrary schema selection is not, owned objects live in `public`, owned
connections explicitly select it, and `DATABASE_URL` remains the sole configuration
input for database location and this concern.

## Verification

Focused database/setup and migration tests passed, as did the persistence TypeScript
build and `git diff --check`. `npm run check` passed migration drift verification,
lint, Knip, Sherif, all workspace builds, and 196 tests across 12 files.

The disposable Docker-backed PostgreSQL 18.6 workflow passed after using an isolated
empty Docker client configuration to avoid the host's unavailable Docker Desktop
credential helper. Before migration, the live session reported both
`current_schema()` and `search_path` as `public`. The production Drizzle migrator ran
twice successfully, then the existing exact round-trip, tag projection, concurrency,
immutability, cascade, and physical-boundary checks passed. The workflow removed its
container and network afterward. No historical migration or generated Proto file was
changed or added.

## Related records

- [Optional Docker database infrastructure](../decisions/0016-optional-docker-database-infrastructure.md)
- [PostgreSQL persistence foundation](../decisions/0014-postgresql-persistence-foundation.md)
