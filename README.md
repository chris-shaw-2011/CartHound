# CartHound

CartHound is a self-hosted grocery price comparison application. The repository contains the TypeScript monorepo, canonical Protobuf domain models, and foundational PostgreSQL persistence. Retailer integrations remain future work.

## Requirements

- Node.js 26 or newer
- npm 11 or newer

## Commands

```sh
npm install
npm run check
```

Package installation requires a `GITHUB_TOKEN` that can read GitHub Packages, as described in `.npmrc`.

`npm install` automatically generates the Protobuf TypeScript using pinned repository-local tools. No global Buf, protoc, or generator installation is needed.

`npm run check` first removes generated Protobuf output, checks the schemas with Buf STANDARD and the shared Protobuf style rules, and regenerates TypeScript. It verifies persistence migration drift, then runs ESLint, Knip, Sherif, every workspace build/type check, and the repository test suite against that fresh output.

Individual commands are also available:

```sh
npm run build
npm test
npm run lint
npm run knip
npm run sherif
npm run format
```

Run the web development server with `npm run dev --workspace @carthound/web`.

The API and worker run TypeScript directly with Node.js type stripping:

```sh
npm start --workspace @carthound/api
npm start --workspace @carthound/worker
```

All apps declare dependencies on `@carthound/core`, `@carthound/proto`, and `@carthound/retailers`. Placeholder imports exercise those connections until real exports are introduced.

Backend and shared-package build commands only type-check; packages export their TypeScript sources directly. Node resolves npm workspace symlinks to real `packages/*` paths and strips types there. Only the web app produces a bundled build.

Deploy the workspace directories with their npm links intact; do not copy these TypeScript packages into physical `node_modules` directories or enable `--preserve-symlinks`. Relative backend/package imports must use `.ts` extensions and erasable syntax. Generated Protobuf TypeScript uses these same constraints. Browser imports must exclude retailer secrets and Node-only implementations.

## Protobuf development

CartHound Edition 2024 schemas use `carthound.v1` under `packages/proto/proto/`. Google common types are imported from `buf.build/googleapis/googleapis`, pinned by `packages/proto/buf.lock`. Buf downloads them automatically when its cache is cold; setup then requires access to the Buf Schema Registry. Code generation still uses the locally installed generator.
Generated files under `packages/proto/src/gen/` are ignored build output: never edit or commit them.
Import public message types, schemas, and enums through `@carthound/proto`. Its entrypoint, `src/gen/index.ts`, is also generated automatically from Protobuf-ES output; adding or removing a model requires no handwritten export updates.

```sh
npm run proto:generate      # Regenerate after editing schemas; removes stale output
npm run proto:clean         # Remove generated output
npm run proto:lint          # Buf STANDARD and shared schema style checks
npm run proto:check         # Clean, lint, regenerate
npm exec --workspace @carthound/proto -- buf dep update # Intentionally update schema lock
```

After explicitly cleaning output, regenerate before running consumer-only commands such as build or test. Normal installation does this automatically; runtime startup never generates code. Disabling npm lifecycle scripts skips automatic generation. Production packaging must include generated output prepared with development dependencies and preserve workspace links.

Use `create`, `toBinary`, and `fromBinary` from `@bufbuild/protobuf` with the exported schemas. Google Money uses bigint whole `units` plus bounded integer `nanos`; Google Decimal uses an exact `value` string. Postal addresses and coordinates use Google `PostalAddress` and `LatLng`. `Decimal.normalize` from `@carthound/core` produces canonical exact Decimal values without mutating the input. Unit-price calculations are not implemented.

CartHound singular fields use Edition 2024's default explicit wire presence; the schemas do not restate that default. Protobuf's documented `has_*` API is language-specific. Protobuf-ES uses plain objects and the generic `isFieldSet(message, fieldDescriptor)` helper instead, for example `isFieldSet(product, ProductSchema.field.gtin)`. Scalar properties still read as their default values when absent, so presence must not be inferred by comparing `product.gtin` with an empty string. Use `clearField(message, fieldDescriptor)` to remove presence. Imported Google common types retain their proto3 scalar defaults; check presence on an optional containing message, such as `product.itemSize`, to distinguish unknown from known zero. Absent nested messages are `undefined`; Product tag strings contain normalized names stored directly in the Product tag array.

Protovalidate annotations enforce required domain facts, UUIDv7 and GTIN validity, required positive Product item sizes and units, normalized tag shape, positive nonzero Offer prices, valid availability, observation time, and supplied address/location bounds. Use item size `1` with measurement unit `EACH` when no physical measurement is known. Generated constructors and parsers do not invoke these rules automatically. API, retailer-ingestion, and persistence boundaries must run a Protovalidate validator before accepting a message. Protobuf-ES also generates `ProductValid`, `OfferValid`, and corresponding Valid types for every message. A successful validator result returns the Valid type, where required message fields such as `ProductValid.itemSize`, `OfferValid.price`, and `OfferValid.observedAt` are non-optional; downstream code should retain this validated type rather than repeatedly checking the ordinary decoded shape.

See [generation decision](docs/decisions/0006-protobuf-generation.md), [domain conventions](docs/decisions/0007-foundational-domain-values.md), [Product and Offer refinement](docs/decisions/0012-product-and-offer-schema-refinement.md), [domain validation](docs/decisions/0013-protobuf-domain-validation.md), and [Google common types decision](docs/decisions/0008-google-common-types.md), which supersedes the original custom value definitions. See also the [foundation history](docs/history/2026-09-07-protobuf-foundation.md), [schema review](docs/history/2026-09-11-product-offer-schema-review.md), and [Google types follow-up](docs/history/2026-09-07-google-common-types.md).

## Numeric utility lint boundary

Use `Money.toNumber`, `Money.toString`, and `Decimal.toNumber` from `@carthound/core` for numeric conversion and display. The type-aware `carthound/no-raw-protobuf-numeric-fields` error prohibits reading Google's Money `units`/`nanos` and Decimal `value` outside their approved utility implementations and the exact persistence mapper. Identically named fields on unrelated types are allowed. See [the enforcement decision](docs/decisions/0011-numeric-field-lint.md) for exact exemptions and limitations.

Local rule tooling lives in `packages/eslint`, with TypeScript 6 matching the shared lint parser; applications continue using TypeScript 7. Run its tests with `npm test -- packages/eslint/src`. The existing repository check includes those tests and the plugin's type check.

## PostgreSQL persistence

`packages/persistence` targets PostgreSQL 18.6 (UTF-8, standard 8 KiB pages) with stable Drizzle ORM/Kit and pg. Schema and mappers remain package internals; the browser must never depend on this workspace. Database tooling uses `DATABASE_URL`; ingestion services remain deferred.

```sh
npm run persistence:generate        # Intentionally generate and review schema migrations
npm run persistence:check           # Read-only, in-memory schema/snapshot drift check
npm run persistence:test:postgres   # Explicit live test; requires CARTHOUND_TEST_DATABASE_URL
```

Normal `npm run check` includes persistence contract/mapper tests and drift verification without requiring PostgreSQL. The explicit live command requires an empty disposable PostgreSQL 18.6 database, applies the actual migrations and leaves that database for the caller to dispose of. It does not start Docker. The disposable Docker wrapper below supplies and cleans up its database.

Maintain `src/schema.ts`; commit reviewed SQL and metadata under `packages/persistence/migrations/`. Never rewrite applied migrations. For custom PostgreSQL changes use `npm run persistence:generate -- --custom --name=description`, then write/review the SQL. Update explicit field coverage and validation fingerprints only after reviewing the persistence impact of a canonical change; do not regenerate them blindly to make checks green.

Products store tags in `text[]` with a GIN index. The trigger-maintained `tag_projection` counts currently used tags and supports exact and trigram substring searches. Rebuild it transactionally with `SELECT rebuild_tag_projection()`; Products remain authoritative. Current and immutable historical observations both reconstruct the same Offer. Deletion is real and dependent records cascade.

Persistence preserves Decimal spelling as well as numeric value, Money bigint components, all Google address fields, optional presence and Timestamp microseconds. Proto rules explicitly bound NUMERIC digit positions, require microsecond-aligned observations, exclude PostgreSQL-incompatible NUL text and bound indexed UTF-8 strings to their physical index capacity.

See [persistence design](docs/decisions/0014-postgresql-persistence-foundation.md), [exact value bounds](docs/decisions/0015-persistence-value-representation.md), and [implementation history](docs/history/2026-09-13-persistence.md).

## Database infrastructure

Docker is optional. Host and container processes use the same PostgreSQL interface
and `DATABASE_URL`, whether the database is in Compose or external. API, web and
worker images are deferred. See [decision 0016](docs/decisions/0016-optional-docker-database-infrastructure.md).

Copy `.env.example` to ignored `.env`, set your own local initialization password,
and set `DATABASE_URL` with matching credentials and the appropriate hostname.
Percent-encode special characters in URL credentials. Compose reads `.env`; host
npm commands use exported environment variables (they do not automatically load it).
`CARTHOUND_POSTGRES_USER`, `CARTHOUND_POSTGRES_PASSWORD` and `CARTHOUND_POSTGRES_DB`
only initialize the optional container; they never construct the connection URL.
A missing local password causes the official image to refuse initialization.

| Consumer / database | Connection URL pattern |
| --- | --- |
| Host / Compose PostgreSQL | `postgresql://USER:PASSWORD@127.0.0.1:5432/carthound` |
| Compose tooling / Compose PostgreSQL | `postgresql://USER:PASSWORD@postgres:5432/carthound` |
| Host or Compose tooling / external PostgreSQL | `postgresql://USER:PASSWORD@database.example.internal:5432/carthound` |

These URLs are placeholders. `localhost` inside a container refers to that container.
External names must resolve and be reachable from the consuming process; normal pg
URL options such as `sslmode` remain supported.

```sh
npm run docker:db:up       # Starts local-db profile; waits for health
npm run docker:migrate     # Builds tooling and runs the host migration implementation
npm run docker:db:down     # Stops services; retains the development volume
npm run docker:test:persistence # Fresh isolated database; automatically cleaned up
npm run docker:db:reset    # DESTRUCTIVE: deletes the local database volume and all its data
```

The equivalent direct start is `docker compose --profile local-db up -d postgres`.
External migrations need no local database profile or Docker database service:
set `DATABASE_URL` to the external server and run `npm run docker:migrate`, or run
on the host after `npm ci`:

```sh
# Export DATABASE_URL securely in your environment first.
npm run persistence:migrate
```

Migrations use Drizzle's committed migration journal and are repeatable; run one
migration job at a time. The runner independently probes connectivity with bounded
startup retries, checks server compatibility, applies only pending migrations and
closes connections. It never uses image initialization scripts for schema upgrades.
Errors return a nonzero status without dumping connection URLs or raw driver errors.
For SQL failures, inspect PostgreSQL server logs for details.

PostgreSQL must be stable 18.x, at least 18.6, with UTF8 encoding and 8192-byte blocks.
The migration user must own/manage the target schema and be permitted to create
`pg_trgm`, or a DBA must enable that extension in the CartHound database beforehand.
The local image is `postgres:18.6-bookworm`, with explicit checksum initialization,
a healthcheck, loopback-only port and named `postgres_data` volume mounted at
`/var/lib/postgresql`. Initialization credentials/options affect only a new data
directory; changing `.env` does not change existing roles/passwords or rewrite data.
Back up valuable data before reset. Normal down/up retains it.

Builds use `node:current-bookworm-slim` (verified as 26.8.2 when introduced).
Docker tracks current stable Node; `.node-version` remains the intentionally
validated repository major. A future Docker tag advance does not silently update
that file. The convenience build commands pull the current base before building.
Export the same `GITHUB_TOKEN` needed for npm installation before Docker builds;
Compose passes it as a BuildKit secret, without embedding it in the image. Clean
builds require access to npm, GitHub Packages and the Buf Schema Registry. They
install workspace dependencies and generate the uncommitted Proto output. No host
source mounts or generated JavaScript are needed.

The integration wrapper requires Docker Compose with `--wait`, BuildKit and a POSIX
shell. It creates a unique Compose project, random temporary credentials and tmpfs
PostgreSQL storage without published ports. It ignores local `.env`, runs the existing
`persistence:test:postgres` harness, preserves its exit status and cleans up even on
failure or handled interruption. Forced termination or host failure can prevent traps;
remove a leftover `carthound-test-*` project with `docker compose -p PROJECT --profile test down --volumes`.
It never uses the development volume. Ordinary `npm run check` requires neither
Docker nor a live database; CI can explicitly add `npm run docker:test:persistence`.
