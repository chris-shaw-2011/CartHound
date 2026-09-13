# 0014: Canonical Protobuf projected into PostgreSQL

Status: Accepted  
Date: 2026-09-13

## Decision

Protobuf and Protovalidate remain authoritative over individual domain values. The maintained Drizzle TypeScript schema is an explicitly designed relational projection, not another domain model. No Proto-to-SQL generator or automatic migration watcher is introduced. Descriptor-based coverage records every persisted field, including flattened Google fields; structural signatures, reviewed validation fingerprints, enum/constraint tests and round trips detect divergence.

Target PostgreSQL **18.6**, verified against the official versioning page on 2026-09-13. Use the PostgreSQL 18 stable line, standard 8 KiB pages and UTF-8 encoding, not PostgreSQL 19 prereleases. Pin stable Drizzle ORM 0.45.2, Drizzle Kit 0.31.10, pg 8.23.0 and pg types 8.23.1. Zod 3.25.76 is a development-only declaration dependency: Kit's exported snapshot type references Zod 3, but its package does not install that dependency. No alternative ORM/driver is introduced.

`packages/persistence` follows the native TypeScript workspace convention. Its package export has a Node condition only. The web app must not depend on it. Schema and inferred row types remain private; future repository APIs will accept and return canonical validated messages. Runtime connectivity and production configuration are deferred; the explicit integration harness uses a normal `pg.Pool` with Drizzle's node-postgres driver.

## Relational topology

- `retailers`: application-supplied native UUIDv7, unique stable slug, name.
- `products`: native UUIDv7, nullable unique GTIN text, name, optional brand/count, exact size, numeric Protobuf unit and ordered tag array. GTIN retains leading zeros and nullable presence.
- `stores`: native UUIDv7, retailer reference, unique retailer/store identifier pair, name, complete flattened PostalAddress and LatLng.
- `retailer_listings`: native UUIDv7, retailer/product references, unique retailer/listing identifier pair, optional display/package text.
- `current_offers`: primary key `(retailer_listing_id, store_id)`.
- `offer_history`: primary key `(retailer_listing_id, store_id, observed_at)`; the same Offer mapping and columns as current state. An update-rejection trigger makes observations immutable; real deletion remains allowed.
- `tag_projection`: derived tag/count search data, not a canonical Tag entity.

UUID entity columns have no database generator/default. Their CHECK uses `(uuid_extract_version(id) = 7) IS TRUE`, rejecting both wrong versions and non-RFC variants for which PostgreSQL returns NULL. FK references inherit the target entity's UUID validity. Protobuf enums stay numeric integers; checks mirror their defined values, including enum gaps. No PostgreSQL ENUM is used. All uint32 fields use bigint and positive/full-uint32 bounds. All strings use text, with only canonical representational byte bounds where indexes require them.

Hard deletion only: retailer deletion cascades through stores/listings to both Offer tables; Product deletion cascades through listings to offers; Store or Listing deletion removes its current/history offers. Retailer deletion does not delete Products. No deletion flags, tombstones or soft-delete infrastructure exist.

## Tags: superseding the managed-table design

This explicitly supersedes the tags/product_tags persistence topology in decisions 0002, 0003 and 0012, and the managed-tag-existence claim in 0013. Historical records remain intact. The current user request authorizes this change to AGENTS.md.

`products.tags text[]` is canonical persisted Product data. Protovalidate enforces uniqueness and its defined normalized spelling before writes. There is no `tags` canonical table, `product_tags` join table, or Tag model. Retailer-provided labels still cannot bypass canonical validation; this task introduces no classification workflow.

A GIN index supports `tags @> ARRAY[...]` for all required tags and `tags && ARRAY[...]` for any required tag. Negated predicates express exclusion; negative-only searches may still scan a broad candidate set.

A PostgreSQL trigger maintains `tag_projection(tag text PRIMARY KEY, product_count bigint NOT NULL)` on Product inserts, deletes and tag changes. Set differences restrict work to introduced/removed tags. Counts increment for introductions, decrement for removals and disappear at zero. An unchanged tag is not modified. Per-tag transaction advisory locks also serialize transitions where the projection row does not yet exist; deterministic lock ordering reduces deadlocks. Multi-product transactions must still retry PostgreSQL deadlocks, as with other overlapping row updates. Hash collisions only serialize unrelated tags; hashes never define tag identity.

`rebuild_tag_projection()` locks Products against concurrent writers, replaces the projection from distinct tags per Product and counts Products. The custom migration invokes it, including for pre-existing Products. The projection is always disposable and rebuildable. `pg_trgm` is enabled in an earlier migration; the projection's GIN `gin_trgm_ops` index supports substring autocomplete. Its primary key supports exact lookup and listing unique tags, and the count supports popularity ordering. No materialized view or JSONB is involved. Rebuild and index maintenance are database operations, not requirements imposed on each application caller.

## Mapping and indexes

Money retains currency_code, bigint units and integer nanos directly, with nullable all-or-none regular-price components. No cent conversion, floating-point total or extra money abstraction exists. Availability has exactly one nullable status/quantity representation and no derived status beside quantity. Observation timestamps retain microseconds in string mode. Decimal's numeric value and original representation are both retained; see decision 0015.

PostalAddress has all 11 upstream fields, including revision, sorting code, recipients, organization and ordered address lines. An absent address has all 11 columns null; a present address retains Google's scalar defaults and required region code. No unannotated revision-zero restriction is imposed. Coordinates use double precision with all-or-none presence and bounds. No PostGIS or address table is introduced.

PK/unique indexes already cover GTIN, retailer slug, retailer-specific lookups, current listing/store and historical listing/store/time queries. A listing Product index supports Product joins and cascades. Store indexes on both Offer tables support store queries/deletion, since Store is not their leading PK column. Historical observation time has a BRIN index for time-window analysis of append-oriented data; this avoids another full B-tree over every historical row. BRIN does not guarantee sorted output. Product GIN and tag trigram indexes address known search requirements; no speculative price/brand/count indexes are added.

## Migration and boundary discipline

Commit SQL migrations and Kit metadata as historical artifacts. Generated Protobuf remains ignored reproducible output. Generate normal schema changes intentionally with `npm run persistence:generate`; use small reviewed custom migrations for extension/trigger/functions. Do not rewrite applied migrations.

`npm run persistence:check` uses stable Kit's `generateDrizzleJson` in an isolated in-memory context, compares the serialized schema with the latest committed snapshot (ignoring only random lineage IDs), and requires `generateMigration` to return no statements. Comparing before diffing also fails closed on potential renames instead of prompting. It neither connects to PostgreSQL nor changes repository files. Tests check additions/renames and compare the initial normal SQL migrations with their historical snapshot diffs. Custom SQL receives explicit definition checks and a separate live test boundary.

Writes check Protobuf wire representability and invoke Protovalidate, then map the returned generated Valid type. Reads reconstruct canonical messages and execute the same checks before returning them. A narrow numeric-lint allowance exists only in the mapper implementation to preserve Money/Decimal components exactly. No validation rule is compiled mechanically into SQL. Foreign keys and cross-record uniqueness are relational constraints; individual-value restrictions must originate in Proto.

## Verification scope and follow-up

Normal checks require no database or retailer network service. The separately invoked PostgreSQL test harness requires an empty disposable PostgreSQL 18.6 database and leaves its migrated test schema for the caller to dispose of. It covers migrations, actual driver values, projection deltas/rebuild, concurrent introduction of a tag, immutable history and retailer cascades. Docker-backed execution, production connectivity, ingestion transactions and RPC services are deferred to their own tasks.

## Sources and history

- [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html)
- [Drizzle migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [node-postgres types](https://node-postgres.com/features/types)
- [Exact persistence bounds](0015-persistence-value-representation.md)
- [Verbatim request](../history/2026-09-13-persistence-request.md)
- [Implementation history](../history/2026-09-13-persistence.md)

## Amendment: Zod 4 tooling metadata

On 2026-09-13, the user rejected the direct Zod 3 pin and requested migration to Zod 4.6.4. This supersedes the Zod 3 development-dependency choice above. Stable Drizzle versions and historical migrations remain unchanged.

Use Zod 4.6.4 to validate migration journal metadata and the snapshot lineage fields used by verification. The snapshot schema is a loose object: it preserves all relational-schema properties for full drift comparisons and Kit's own migration generation/validation. No hand-maintained relational schema validator or alternate domain-model layer is added. Remove imports of Kit's Zod-3-derived `DrizzleSnapshotJSON` type and the former Knip unused-dependency exception. No lint or compiler checks are disabled.

The installed stable Kit runtime bundles its own Zod 3.25.42 implementation, independently of the application dependency. Replacing CartHound's dependency does not replace that upstream bundled implementation. The user's original stable-only requirement remains in force; no Kit fork, dependency patch, prerelease upgrade or `zod/v3` import is introduced. CartHound-owned tooling uses Zod 4, while domain validation continues to use Protobuf/Protovalidate.

See the Zod migration follow-up in the [history record](../history/2026-09-13-persistence.md).
