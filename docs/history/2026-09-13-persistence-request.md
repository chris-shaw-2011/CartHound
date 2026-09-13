Implement CartHound's foundational PostgreSQL persistence layer based on the existing canonical Protobuf domain model.

Read `AGENTS.md`, all existing decision records, all relevant history records, and the current `.proto` definitions before making changes.

The existing Protobuf model is authoritative. Do not redesign the domain model around database convenience.

## Core architectural rule

CartHound Protobuf messages plus their Protovalidate rules are the canonical representation of domain data.

The PostgreSQL model is a relational persistence projection of those canonical models.

The relationship is:

`canonical Protobuf + validation -> persistence mapping -> Drizzle relational schema -> migrations -> PostgreSQL`

The database must not become a competing domain model.

A valid canonical Protobuf value must have a lossless persistence representation.

PostgreSQL may enforce relational constraints that cannot be expressed inside a single Protobuf message, such as:

* primary keys
* foreign keys
* uniqueness across records
* indexes
* relational referential integrity

For constraints applying to an individual domain value, PostgreSQL must not silently become more restrictive than Protobuf.

If persistence requires a legitimate representational restriction, add that restriction to the Protobuf validation first and document it.

Do NOT build a general-purpose automatic Proto-to-SQL or Proto-to-Drizzle generator.

Do NOT build automatic schema migration behavior that watches Protobuf changes.

Instead, build contract tests that fail when the canonical Protobuf model and persistence projection diverge.

## Technology choices

Target the latest stable PostgreSQL release.

At the time of this request the target is PostgreSQL 18.6. Verify the current stable release from PostgreSQL's official documentation before implementation. Use the latest stable patch release of PostgreSQL 18; do not target PostgreSQL 19 prereleases.

Document the PostgreSQL major/minor target.

Use:

* Drizzle ORM
* Drizzle Kit
* `node-postgres` / `pg`
* stable package releases only

Do not use Drizzle RC/prerelease packages merely to obtain newer APIs.

Do not introduce Prisma, TypeORM, Sequelize, Postgres.js, or another persistence abstraction.

Use normal `pg` connection pooling when runtime database connectivity is eventually needed.

Create a new workspace package equivalent to:

`packages/persistence`

The browser application must never depend on this package.

The package may depend on:

* `@carthound/proto`
* `@carthound/core`
* Protovalidate runtime where appropriate
* Drizzle
* `pg`

Database row representations are internal persistence concerns and must not become another domain-model layer.

## Scope

This task should implement:

* relational schema
* Drizzle schema definitions
* committed SQL migrations
* Proto <-> persistence mapping
* persistence-boundary validation
* Proto/DB contract tests
* migration/schema drift verification
* appropriate indexes
* tag-search projection infrastructure
* documentation/history

Do NOT implement:

* retailer API integrations
* background price collection
* API RPC services
* shopping lists
* saved searches
* frontend features
* Docker deployment
* production connection configuration
* authentication

Docker-based PostgreSQL integration testing can be added in the next infrastructure task. Do not broaden this task into the Docker work unless an existing repository convention makes a very small piece unavoidable.

## Deletion semantics

Use real hard deletion.

Do not add:

* `deleted_at`
* `is_deleted`
* active/inactive flags
* tombstone records
* soft-delete infrastructure

Use foreign-key cascades for data that is genuinely dependent on its parent.

Expected behavior:

* deleting a Retailer removes its Stores, RetailerListings, and dependent Offers
* deleting a Product removes its RetailerListings and dependent Offers
* deleting a Store removes its current/historical Offers
* deleting a RetailerListing removes its current/historical Offers

Do not delete Products merely because a Retailer is deleted.

## Relational tables

The expected foundational tables are:

* `retailers`
* `products`
* `stores`
* `retailer_listings`
* `current_offers`
* `offer_history`
* `tag_projection`

There must NOT be:

* a `tags` canonical table
* a `product_tags` join table

### Retailers

Map canonical `Retailer`.

Use:

* native PostgreSQL UUID for CartHound ID
* stable unique slug
* name

The application supplies the UUIDv7 defined by the canonical Proto.

Do not have PostgreSQL generate domain entity IDs.

Where practical, add a database CHECK verifying UUID version 7 using PostgreSQL 18's UUID functionality.

`slug` is unique.

Do not invent arbitrary varchar length limits.

Use `text` unless the canonical Protobuf model has an explicit length constraint that justifies a database limit.

### Products

Map canonical `Product`.

Expected fields include:

* UUID id
* nullable normalized GTIN
* name
* nullable brand
* nullable item count
* required exact item size
* required measurement-unit enum numeric value
* tags as native PostgreSQL `text[]`

Do not decompose tags into relational tag rows.

Create an appropriate GIN index on `products.tags` to support containment and overlap queries.

The intended query patterns include:

* products containing one tag
* products containing all specified tags
* products containing any specified tags
* exclusion of specified tags

The canonical Proto requires Product tags to be normalized and unique. Persistence-boundary validation must enforce that before writing.

Do not create an elaborate SQL function solely to duplicate Protovalidate's array-uniqueness rule.

### Tags persistence strategy

Lock in this design:

`Product.tags` is stored directly as `products.tags text[]`.

The array is canonical persisted Product data.

Create a separate derived table:

`tag_projection`

with approximately:

* `tag text PRIMARY KEY`
* `product_count bigint NOT NULL`

`tag_projection` is NOT a Tag domain entity.

It is derived/search-index data that can always be rebuilt completely from `products.tags`.

Its source of truth is `products.tags`.

Use a PostgreSQL trigger to keep it automatically synchronized whenever Products are:

* inserted
* deleted
* updated such that `tags` changes

The trigger should:

* increment counts for newly introduced tags
* decrement counts for removed tags
* delete projection rows when their count reaches zero
* avoid modifying unchanged tags

The trigger must correctly handle a Product changing from one tag set to another.

Use database-level maintenance rather than application code so consistency does not depend on every caller remembering to update the projection.

The initial migration must correctly populate/rebuild the projection from existing Product rows if any exist.

The projection should be deterministically rebuildable from `products`.

Enable PostgreSQL's `pg_trgm` extension and create an appropriate trigram index on `tag_projection.tag`.

The projection must efficiently support:

* retrieving the list of unique currently used tags
* exact tag lookup
* substring autocomplete such as `%but%`
* potentially ranking suggestions by `product_count`

Do not use a materialized view. PostgreSQL materialized views require refreshes and are not automatically incrementally maintained.

Do not use JSONB for Product tags.

### GTIN

Store GTIN as text, preserving leading zeros.

Use a unique constraint when non-null.

The canonical Protobuf validation remains authoritative for:

* exactly 14 digits
* valid GTIN checksum

Do not parse GTIN as a number.

### uint32 fields

Audit every Protobuf `uint32`.

Do not map a valid uint32 domain value into PostgreSQL `integer`, because PostgreSQL signed `integer` cannot represent the full uint32 range.

Use a lossless PostgreSQL representation such as `BIGINT` plus appropriate constraints.

Mapping code must safely convert between the generated Protobuf number and database bigint/string representation without precision loss.

Examples currently include:

* Product item count
* Offer availability quantity

### Measurement-unit enum

Store the canonical Protobuf enum numeric value rather than defining a PostgreSQL ENUM.

Protobuf owns the enum definition.

Because the current Proto validation uses `defined_only`, the persistence schema may mirror the currently defined numeric values with a CHECK constraint.

The Proto/database contract tests must fail when a new enum value is added but the persistence constraint has not been updated.

Do not use PostgreSQL ENUM types for Protobuf-owned enums.

## Exact Product Decimal

`Product.item_size` uses `google.type.Decimal`.

Persistence must remain exact.

The existing domain decision explicitly requires future PostgreSQL persistence to avoid silent rounding and to account for PostgreSQL NUMERIC limits.

Prefer PostgreSQL `NUMERIC` if every valid CartHound Decimal can be proven to round-trip losslessly.

Before implementing this mapping, inspect:

* the actual current Google Decimal representation
* CartHound Decimal normalization logic
* PostgreSQL 18 unconstrained NUMERIC limits

If PostgreSQL NUMERIC imposes a legitimate bound that the current canonical Protobuf model does not impose, add the corresponding CartHound validation restriction to the Proto FIRST.

Do not silently accept a smaller database value domain.

Do not introduce arbitrary low precision such as `NUMERIC(20,6)`.

Any precision/exponent bound chosen must:

1. be justified by PostgreSQL's actual representation limits
2. be expressed in canonical Protobuf validation
3. be covered by boundary tests
4. preserve ordinary grocery measurements with ample room
5. be documented as a durable domain decision

Never convert Decimal through JavaScript floating-point numbers.

Use exact string/bigint manipulation consistent with the existing `@carthound/core` utilities.

## Stores

Map canonical `Store`.

Use:

* UUID id
* retailer UUID FK
* retailer-specific store ID
* name
* optional flattened `google.type.PostalAddress`
* optional flattened `google.type.LatLng`

Add a uniqueness constraint for:

`(retailer_id, retailer_store_id)`

because a retailer-specific store identifier identifies a store within that retailer.

Do not introduce a separate Address domain/entity table.

Flatten the complete Google PostalAddress representation losslessly.

Inspect the pinned Google schema and make sure every field that can be represented by the canonical `PostalAddress` has an intentional persistence representation.

Repeated PostalAddress string collections may use PostgreSQL `text[]` when appropriate.

Because current CartHound validation requires a valid region code whenever an address message exists, it is acceptable for address presence to be represented by nullable address columns as long as reconstruction preserves absent-vs-present semantics.

Map location using PostgreSQL double-precision latitude/longitude columns.

Both location coordinates must be null together or non-null together.

Mirror latitude/longitude bounds with a straightforward database CHECK where practical.

Do not use PostGIS yet. Current requirements do not justify that dependency.

## Retailer listings

Map canonical `RetailerListing`.

Use:

* UUID id
* retailer UUID FK
* product UUID FK
* retailer product/listing identifier
* optional retailer-facing name
* optional raw package description

Add uniqueness for:

`(retailer_id, retailer_product_id)`

unless inspection of current architecture reveals a concrete reason retailer IDs are not unique within one retailer.

Do not introduce arbitrary maximum string lengths.

## Money

Offer prices use `google.type.Money`.

Preserve the canonical representation directly rather than converting it into another monetary abstraction.

For required current price, use relational fields equivalent to:

* currency code
* units
* nanos

For optional regular price, use a nullable all-or-nothing group with the same components.

Use a PostgreSQL type capable of losslessly representing the full Protobuf int64 `units`.

Do not convert Money through JavaScript floating point.

The database may mirror straightforward Proto invariants such as:

* uppercase three-character currency-code shape
* nanos range
* positive current price
* optional regular-price group is all present or all absent
* regular and current currencies match
* regular price is not lower than effective price

Protovalidate remains authoritative; do not attempt to translate arbitrary CEL into SQL mechanically.

## Offer availability

The canonical Offer availability is a required oneof containing either:

* categorical status
* exact positive quantity

Represent this relationally using nullable columns equivalent to:

* `availability_status`
* `availability_quantity`

Add a CHECK requiring exactly one representation to be present.

Store the Protobuf enum numeric status rather than a PostgreSQL enum.

Quantity must use the lossless uint32 mapping described above.

Do not add a redundant derived status when quantity is stored.

## Offer timestamps

Canonical `Offer.observed_at` uses `google.protobuf.Timestamp`, whose precision exceeds PostgreSQL timestamp precision.

A valid persisted canonical Offer must round-trip without losing timestamp information.

PostgreSQL `timestamptz` supports microsecond precision.

Add canonical Protobuf validation requiring persisted Offer timestamps to be microsecond-aligned:

`nanos % 1000 == 0`

This restriction belongs in the Proto FIRST because PostgreSQL persistence requires it.

Continue enforcing the existing observation-time domain rules.

Store Offer observation time using:

`TIMESTAMPTZ(6)`

Use a Drizzle/pg representation that preserves all six fractional digits.

Do not pass the value through JavaScript `Date` if that would truncate microseconds to milliseconds.

Use a string or other exact representation appropriate to the current stable Drizzle/pg APIs.

Add boundary tests proving a timestamp containing non-zero microseconds survives Proto -> persistence representation -> Proto exactly.

## Current offers and history

Continue the previously accepted architecture:

* `current_offers`
* `offer_history`

Both relational structures represent the SAME canonical `Offer` message.

Do not introduce:

* Offer UUIDs
* OfferSnapshot canonical messages
* separate domain models

`current_offers` should have one row per:

`(retailer_listing_id, store_id)`

Use that as the primary key.

`offer_history` should be append-only and uniquely identify an observation by:

`(retailer_listing_id, store_id, observed_at)`

Use a composite primary key unless a concrete PostgreSQL/Drizzle limitation requires otherwise.

Current and history rows should use the same canonical Offer mapping logic wherever practical.

Future ingestion will insert history and upsert current state transactionally, but do not implement retailer ingestion in this task.

## Proto boundary validation

Persistence accepts canonical messages only after Protovalidate succeeds.

Use the generated `*Valid` types where the existing architecture provides them.

Do not assume generated constructors or Protobuf decoding automatically execute validation.

For writes:

`untrusted/ordinary Proto -> Protovalidate -> Valid type -> persistence mapper`

For reads:

`database rows -> canonical Proto -> Protovalidate -> validated canonical object returned from persistence`

A corrupt/incompatible database row must not silently escape the persistence boundary as a valid domain object.

## Proto/persistence mapping registry

Create a small explicit persistence-mapping/coverage mechanism.

Do NOT create a generic ORM generator.

Every field of every canonical persisted CartHound message must have an intentional persistence disposition.

Use classifications equivalent to:

* direct column
* flattened value object
* relation/reference
* array
* oneof projection
* derived/not directly persisted

The exact TypeScript API is implementation judgment; keep it simple.

Contract tests must enumerate current Protobuf descriptors and fail when a new canonical field is added without a persistence disposition.

For example, adding:

`Product.manufacturer`

must cause persistence contract tests to fail until someone explicitly decides how that field is persisted.

Likewise, if a canonical field is removed or structurally changed, stale persistence mappings must fail tests.

Imported Google value objects used by CartHound must also have complete intentional coverage where they are flattened.

Avoid a giant abstraction framework. The goal is exhaustive accountability, not automatic relational modeling.

## Constraint agreement

Implement tests enforcing this principle:

`Proto owns field-level domain constraints.`

Where simple constraints are represented in both layers, test their agreement.

Examples include:

* UUID representation/version
* enum allowed values
* GTIN representation
* uint32 database bounds
* exact Decimal supported domain
* Timestamp persistence precision
* Money component ranges
* oneof/nullability representation

Do not try to compile arbitrary Protovalidate CEL expressions into SQL.

Database relational constraints may exceed what Protobuf can express only when the constraint concerns relationships across persisted records rather than the validity of one canonical object.

Avoid arbitrary `varchar(n)` constraints.

When a database field genuinely needs a size or length restriction:

1. verify that the canonical Proto already contains the same restriction
2. if not, update Proto first
3. then apply the database restriction
4. add a contract test

## Indexes

Design indexes from known CartHound query requirements rather than indexing every column.

At minimum consider appropriate indexes for:

* Product GTIN
* Product tags GIN
* Retailer slug
* Store lookup by retailer + retailer_store_id
* RetailerListing lookup by retailer + retailer_product_id
* RetailerListing lookup by product
* current Offer lookup by listing/store
* historical Offer lookup by listing/store/time
* historical price analysis ordered by observation time
* tag projection exact lookup
* tag projection trigram autocomplete

Avoid redundant indexes that PostgreSQL already gets from PK/unique constraints.

Document why non-obvious indexes exist.

## Drizzle schema versus migrations

Drizzle TypeScript schema is the maintained relational schema definition.

SQL migrations are committed historical artifacts.

This differs deliberately from generated Protobuf TypeScript, which remains ignored/reproducible build output.

Do not delete or regenerate historical migrations merely because the current schema changes later.

Use Drizzle Kit to generate normal schema migrations where practical.

Custom PostgreSQL features such as:

* `pg_trgm`
* tag projection trigger/function

may use reviewed custom SQL migrations when Drizzle's declarative schema cannot express them cleanly.

Do not contort the TypeScript schema solely to avoid a small amount of explicit PostgreSQL migration SQL.

## Migration drift verification

Add a repository check proving the committed migrations represent the current Drizzle schema.

Do not rely on `drizzle-kit check` alone if it does not detect a schema change that simply needs a new migration.

Implement a deterministic verification flow that effectively asks:

"Would the current Drizzle schema generate an additional migration relative to the committed migration snapshot?"

and fails when the answer is yes.

Do this in a temporary location/context so normal verification does not dirty the repository.

Do not automatically generate and commit migrations during tests.

A developer should explicitly generate/review a migration after intentionally changing persistence schema.

## Tag projection verification

Add focused tests for projection semantics.

At minimum cover logically:

* adding a Product with tags introduces projection rows
* a second Product using the same tag increments `product_count`
* removing a Product decrements counts
* a tag disappears when its count becomes zero
* updating Product tags adjusts only added/removed tags
* tag projection is rebuildable entirely from `products.tags`

If these require a live PostgreSQL instance, structure the SQL and test boundary now and defer the actual Docker-backed execution to the Docker infrastructure task rather than introducing Docker here.

Pure unit/schema tests should still verify the intended trigger/migration definitions where useful.

## Mapper tests

Add meaningful mapper tests without requiring live network services.

At minimum cover representative round trips for:

* Retailer
* Product
* Store with and without PostalAddress
* Store with and without LatLng
* RetailerListing
* Offer with categorical availability
* Offer with quantity availability
* Offer with regular price
* Offer without regular price
* Money values outside JavaScript safe-integer range where legal
* exact Decimal values
* microsecond timestamp preservation
* Product tags including multiple normalized values

The result reconstructed from persistence representation must validate with Protovalidate.

Do not create tests that merely mirror implementation line-by-line without protecting an architectural property.

## Repository scripts/checks

Integrate persistence validation into the existing root verification workflow.

Do not weaken:

* Proto clean generation
* Proto lint/style verification
* ESLint
* Knip
* Sherif
* TypeScript checking
* existing tests

Ensure command ordering still works from a fresh checkout after normal `npm install`.

Provide explicit scripts for intentional persistence operations where useful, for example equivalents of:

* schema/migration generation
* migration consistency verification

Do not require globally installed Drizzle tools.

## Documentation/history

Follow `AGENTS.md` exactly.

Update chronological history with the material user instructions and decisions from this persistence-design session.

Create or update durable decision records as appropriate.

Document at least these decisions:

* Protobuf/Protovalidate remains authoritative over persistence
* relational topology is intentionally hand-designed rather than Proto-generated
* persistence contract tests detect divergence
* latest stable PostgreSQL 18 target
* Drizzle ORM + Drizzle Kit + `pg`
* hard deletion only
* native UUID columns with application-supplied UUIDv7
* no PostgreSQL ENUM for Proto enums
* tags stored directly on Product as `text[]`
* no `tags` table
* no `product_tags` table
* GIN index on Product tag arrays
* derived `tag_projection` table
* database trigger maintains projection automatically
* `product_count`
* `pg_trgm` autocomplete index
* tag projection is rebuildable and not canonical data
* direct lossless Google Money mapping
* exact Decimal/PostgreSQL NUMERIC compatibility decision
* microsecond Timestamp restriction added to Proto
* flattened PostalAddress/LatLng
* current Offer versus historical Offer relational projection
* committed migrations versus ignored generated Proto code
* schema/migration drift verification approach

Do not rewrite historical decision records to pretend superseded designs never existed. Add new records or explicit superseding decisions where appropriate.

## Implementation judgment and verification

Inspect current official documentation and installed package behavior before relying on specific Drizzle APIs.

If current stable Drizzle/PostgreSQL behavior differs from an assumption in this prompt:

1. preserve the architectural intent
2. use the simplest current supported mechanism
3. do not silently change domain semantics
4. document the discrepancy and resulting implementation choice

Do not broaden the domain model to satisfy ORM convenience.

Do not introduce a new abstraction unless it removes a concrete duplication/problem visible in this implementation.

Prefer plain PostgreSQL features and explicit mapping code over clever framework machinery.

## Completion criteria

This task is complete when:

* `packages/persistence` exists and follows workspace conventions
* current canonical Protobuf messages have complete persistence mappings
* Product tags are stored directly as PostgreSQL `text[]`
* no canonical tags/product_tags tables exist
* `tag_projection` and automatic maintenance SQL exist
* tag array and autocomplete indexes exist
* Drizzle schema exists
* initial committed migration exists
* required PostgreSQL extensions are represented in migration history
* hard-delete/cascade semantics are defined
* current/historical Offer schemas exist
* Money, Decimal, Timestamp, UUID, uint32, oneof, address and location mappings are lossless
* any legitimate persistence bound is first reflected in canonical Proto validation
* persistence validates canonical messages at its boundaries
* descriptor-based field coverage catches new/unmapped Proto fields
* Proto/persistence contract tests pass
* migration drift verification is integrated
* all existing repository checks continue to pass
* no Docker or retailer implementation has been pulled into scope
* development history and architecture decisions are recorded
