# 2026-09-13: Foundational PostgreSQL persistence

## User request

The complete originating request is preserved verbatim in [persistence-request](2026-09-13-persistence-request.md). It requires an explicit, lossless relational projection of the existing canonical Protobuf/Protovalidate model; stable PostgreSQL 18, Drizzle ORM/Kit and pg; schema/migrations, validated mapping, descriptor/constraint tests, migration drift verification and tag projection infrastructure. It explicitly excludes Docker deployment, retailer integrations/ingestion, RPC/API/frontend features, shopping lists/search models, production connections and authentication.

The new request explicitly replaces the previous managed tags/product_tags design with authoritative `products.tags text[]` and a derived trigger-maintained tag/count projection. Read AGENTS.md, existing decisions 0001–0013, prior history, current schemas, pinned generated Google values and core numeric utilities before implementation. The initial working tree was clean. Prior workspace memory was used only for orientation; current files and installed behavior were inspected before relying on it.

## Plan and initial conclusions

Saved the [implementation plan](../plans/2026-09-13-persistence.md) before implementing the persistence package. Communicated the tag-design conflict and the current request's explicit authorization to supersede it. No additional approval was needed.

Verified PostgreSQL's official version page: 18.6 is the stable PostgreSQL 18 patch. Registry metadata and installed packages confirmed stable Drizzle ORM 0.45.2, Drizzle Kit 0.31.10, pg 8.23.0 and pg types 8.23.1. No RC or alternate database abstraction was selected. Keep Node 26 native type stripping and npm workspace links.

PostgreSQL NUMERIC has finite significant digit-position bounds. The existing Google Decimal string/normalizer was unbounded and permits multiple representations of the same value. Decided to add the actual NUMERIC representability bound to Product validation and persist both the normalized numeric value and original Decimal string. This preserves canonical field content as well as exact numeric meaning without forcing an artificial spelling restriction.

PostgreSQL cannot store NUL text, and the requested B-tree/GIN indexes impose physical key limits. Added canonical NUL exclusions and UTF-8 byte limits derived from PostgreSQL 18's standard 8 KiB tuple layout before mirroring those restrictions in SQL. No arbitrary varchar limits or low numeric precision were introduced. These additional representational decisions were communicated during implementation and are recorded in [0015](../decisions/0015-persistence-value-representation.md).

## Implementation and discoveries

Added the native TypeScript `packages/persistence` workspace with a Node-only export condition, explicit Drizzle schema, inferred internal rows, five validated mappers, coverage registry, validation fingerprints, tests, migration scripts and an explicitly invoked PostgreSQL harness. No browser dependency or public database row/domain facade was added.

Drizzle Kit generated the normal relational schema and subsequent UUID-variant and indexed-text CHECK refinements. Custom migrations install pg_trgm before the trigram index and define tag maintenance/rebuild plus history immutability. All generated migration SQL and snapshots are retained; generated Protobuf remains ignored. Tags are canonical arrays; projection counts are database-maintained, deterministic to rebuild and serialized per changed tag, including first insertion races. Dependent relationships use hard-delete cascades. No Products cascade from Retailer deletion.

The initial focused tests passed 40 cases covering exact Decimal/Money values, uint32 endpoints, optional presence, microsecond timestamps and descriptor/schema expectations. A corrupt-read case exposed that Protovalidate's annotations alone do not enforce every underlying wire range on ordinary JavaScript objects. Added explicit uint32/int64 upper annotations and Protobuf serialization as a structural check at both mapper boundaries; the serialized bytes are never stored. The successful validator result supplies the generated Valid type for mapping.

Installed Drizzle node-postgres session code overrides timestamp parsing with an identity parser, and the timestamp column supports string mode. Calendar formatting uses Date only for integral seconds, appending exact microseconds separately. All Google PostalAddress fields, including revision and both string arrays, have intentional flattened mappings; no extra revision-zero constraint was invented.

The first subprocess-based migration probe returned empty child stdout in this execution environment, even for a minimal child printing a constant. Replaced that approach with the installed stable Kit API in an isolated in-memory context: compare its serialized current schema to the latest snapshot, then require no generated migration statements. Comparison precedes diffing to avoid rename prompts. Mutation tests exercise added/renamed columns, and normal migration SQL is checked against historical snapshot diffs. This also reduces filesystem/process machinery. The earlier 43-test pass was followed by further contract additions; final totals are recorded below.

Kit's exported snapshot types reference Zod 3 but its package does not install that declaration dependency. Added stable Zod 3.25.76 as development-only tooling with a documented Knip type-dependency exception. Do not install unrelated database drivers merely because Kit's declarations mention them. Existing skipLibCheck policy is unchanged. npm re-resolved the existing linked shared-lint dependency layout while adding persistence; no lint-package version change was requested or made.

## User continuation

> I ran out of tokens and then you stopped, continue where you left off and make sure you've done everything I've asked in the initial request as well as what's requred by the agents.md file

Continued the same task, preserving the original scope. Reported that implementation existed but full verification, history and final completion review remained.

## Full-check correction

The first aggregate clean-generation check caught a discrepancy that the TypeScript Protovalidate runtime tests did not: Buf's canonical CEL compiler rejects selecting `.nanos` on native CEL Timestamp values. Preserve the intended `nanos % 1000 == 0` rule using the exact RFC3339 string conversion and a fractional-digit pattern that allows only zeros after the sixth fractional digit. Added a source comment explaining the equivalent representation and table-driven tests covering aligned and unaligned nanoseconds. Buf's CEL compilation then passed. Explicitly enforce Timestamp's existing year-0001 lower bound because ordinary JavaScript messages also need that bound checked before persistence.

## Durable records and resulting scope

- [0014](../decisions/0014-postgresql-persistence-foundation.md): hand-designed relational projection, Proto authority and boundary types, stable toolchain, hard deletion, UUID/enums/uint32, Google flattening, Offer current/history topology, canonical tag arrays and derived trigger-maintained projection, indexes and migration/check discipline.
- [0015](../decisions/0015-persistence-value-representation.md): Decimal value/spelling and PostgreSQL bounds, Timestamp precision, Money components, text/index representability and implementation assumptions.
- Updated AGENTS.md and README to describe the now-authorized tag/persistence topology and commands. Earlier accepted records were not rewritten.
- Separate live harness covers actual SQL migrations, pg/Drizzle round trips, tag deltas/rebuild/concurrent introduction, each required parent cascade, immutable history and incompressible index-boundary values. It requires an empty disposable PostgreSQL 18.6 database; actual execution remains deferred to the Docker infrastructure task. No Docker files or live retailer tests were added.

## Validation

Final validation and completion review are appended after the repository checks finish.

## Final validation and completion review

Updated the two existing uint32 violation assertions from `uint32.gte` to Protovalidate's combined `uint32.gte_lte` diagnostic; the same invalid values remain rejected. Added explicit SQL/Proto constraint agreement assertions, browser dependency/export checks and the persistence workspace to the scaffold build test. The browser check handles dependency-free workspaces. The drift check also requires journal/snapshot agreement and nonempty SQL for every journal entry. Verified that root `persistence:generate` forwards custom/name flags to Kit by invoking its help through the root script.

`npm run check` passed completely after these changes: clean Protobuf removal, Buf STANDARD/CEL compilation and shared Proto style, regeneration, in-memory migration drift, ESLint, Knip, Sherif, root and workspace type checks, Vite build, and **184 tests across 11 files**. The existing generator localStorage notice remains informational. `git diff --check` passed, and generated Protobuf output remains ignored and untracked. No existing checks were disabled. `npm install` was run successfully with postinstall generation during dependency setup; this was not an independent empty-cache installation test.

`npm audit --omit=dev` reported zero production vulnerabilities. Installation reported four moderate development-tool findings; no forced dependency upgrades or prerelease packages were introduced to suppress them.

Completion review confirmed the seven required tables, both Offer projections, hard-delete FKs, complete field/value-object coverage, exact validated mappings, Product array and autocomplete indexes, database-maintained/rebuildable tag counts, committed-source migration artifacts and metadata, reproducible schema checks, explicit generation commands, updated current guidance and superseding decisions. The original rule against adapters automatically inventing tags remains in AGENTS.md despite the changed storage design.

All implementation work in the requested scope is complete. PostgreSQL-backed execution is intentionally not claimed: the separate integration command and its fixtures are ready for an empty disposable PostgreSQL 18.6 database in the next infrastructure task. Docker, retailer integrations, ingestion, RPC, application features and production connection configuration were not added. No commit or pull request was created; changes remain available for review in the working tree.

## Zod 4 migration request

> why is zod 3.25.76 used instead of 4.6.4?

Explained that stable Kit's public snapshot declarations referenced Zod 3 types and that the direct dependency had been added to support those declarations.

> well we shouldn't be using the old one, migrate everything

Plan: replace the direct Zod 3 dependency with Zod 4.6.4, remove reliance on Kit's Zod-3-derived snapshot types by validating external snapshot metadata with Zod 4, remove the Knip exception, and run the full check. Preserve the original stable-only Drizzle requirement and existing migration history. Domain validation remains canonical Protobuf/Protovalidate; Zod validates tooling metadata only.

### Zod 4 implementation and compatibility findings

Installed Zod 4.6.4 and migrated journal/snapshot metadata parsing to its `z.object`, `z.looseObject` and `z.int` APIs. Removed both imports of Kit's `DrizzleSnapshotJSON` and the Knip exception. A regression test verifies that snapshot validation rejects invalid lineage metadata while preserving the complete relational-schema payload. Existing migration comparison and generated-SQL tests remain in place.

The earlier statement that Zod 3 was needed applied to consuming Kit's exported Zod-3-derived snapshot declarations; it was not an unavoidable dependency of CartHound's verification design. Validating the external tooling values with Zod 4 removes that direct dependency without weakening checks or duplicating the relational schema.

Registry inspection still reports stable Kit 0.31.10. Its installed JavaScript contains an upstream bundled Zod 3.25.42 implementation, separate from CartHound's dependency. Communicated that this bundle remains under the original stable-only requirement. Removing it would require a different upstream Kit build or a fork, neither introduced here. `npm ls zod --all` shows CartHound persistence on 4.6.4 and the existing linked shared-lint toolchain already on Zod 4.4.3; no installed Zod 3 package remains in that dependency tree. The shared lint repository was not modified.

### Zod 4 verification

`npm run check` passed: clean Proto generation and validation, migration drift, ESLint, Knip, Sherif, all builds/type checks and **185 tests across 11 files**. `git diff --check` passed. A source/lockfile search found no `DrizzleSnapshotJSON` imports, `zod/v3` imports or Zod 3 dependency declarations. All historical SQL migrations and snapshots are unchanged by this follow-up. The only remaining Zod 3 use identified is the upstream implementation embedded inside stable Kit itself, as documented above.
