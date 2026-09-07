# 0003: Relational PostgreSQL persistence

Status: Accepted  
Date: 2026-09-07

## Originating prompt

CartHound uses Protobuf as its canonical domain model, but persisted data must remain easy to query and index efficiently in PostgreSQL.

The question was whether Protobuf objects should be serialized directly into the database or mapped into a relational schema.

## Context

CartHound will frequently query data by:

- product
- UPC/GTIN
- retailer
- retailer-specific product identifier
- store
- tags
- current price
- price history
- availability
- package quantity and unit

These queries need effective PostgreSQL indexes, foreign keys, joins, uniqueness constraints, and aggregate operations.

Storing complete serialized Protobuf messages as opaque blobs would make reconstruction easy but would undermine those database capabilities.

Storing canonical data primarily as JSONB would improve inspectability but would still be less appropriate than typed relational columns for known and frequently queried fields.

## Decision

PostgreSQL uses a normalized relational schema optimized for querying, constraints, indexing, and historical analysis.

Canonical CartHound Protobuf messages are not stored as serialized Protobuf blobs.

The persistence layer converts between relational database data and canonical Protobuf messages.

Database implementation details and database row types must not leak outside the persistence layer.

Core queryable fields are stored in typed relational columns.

JSONB may be used for genuinely schemaless data such as:

- raw retailer API responses
- debugging metadata
- retailer-specific data that does not belong in the canonical domain model

Database schema design should prioritize effective PostgreSQL queries and indexes rather than attempting to mirror the serialized Protobuf wire representation.

## Rationale

This design preserves the main advantages of both technologies.

Protobuf provides:

- canonical application/domain models
- generated shared types
- stable API contracts

PostgreSQL provides:

- relational integrity
- foreign keys
- unique constraints
- efficient indexes
- joins
- aggregate queries
- flexible analytical queries
- efficient tag relationships
- efficient historical price queries

The mapping layer between them should remain explicit and intentionally simple.

## Relational mapping principles

A Protobuf message does not need to correspond to exactly one table.

For example, a `Product` message containing repeated Tags may be reconstructed from:

- `products`
- `tags`
- `product_tags`

Similarly, retailer listings, stores, current offers, and historical price snapshots are represented by separate relational structures even when assembled into larger Protobuf responses.

The persistence boundary should conceptually remain:

`relational rows <-> canonical Protobuf model`

Additional DTO or domain-model layers should not be added without a concrete need.

## Current offers and historical prices

Current price state and historical observations should be modeled separately.

A current-offer table should represent the latest known price and availability for a retailer listing at a specific store.

Historical price snapshots should be append-only observations.

When a new observation is collected, the worker may:

1. upsert the current offer
2. append a historical price snapshot

This allows current-price comparisons to avoid scanning large historical tables while preserving complete price history.

## Tags

Tags and product-tag relationships are stored relationally rather than as serialized arrays or JSON.

The expected model includes:

- `products`
- `tags`
- `product_tags`

Indexes should support efficient lookup in both directions as needed.

This is required because tag expressions are a core CartHound query pattern.

## Money

Monetary values must not use JavaScript floating-point numbers.

Prices should use integer minor units when practical.

The expected mapping is:

- Protobuf `int64`
- TypeScript `bigint`
- PostgreSQL `BIGINT`

For currencies that cannot be modeled correctly using a simple fixed minor-unit assumption, the model may be expanded explicitly rather than introducing floating-point storage.

## Measurements

Quantities requiring exact decimal representation should use PostgreSQL `NUMERIC` rather than floating-point database types.

The Protobuf representation should preserve exact decimal values without requiring JavaScript floating-point conversion.

Unit normalization and price-per-unit calculations remain domain-layer responsibilities.

## Enums

Protobuf enums are authoritative.

When practical, enum numeric values may be stored in PostgreSQL integer columns.

PostgreSQL-native ENUM types should generally be avoided for values already defined by Protobuf because that would create a second schema definition that must remain synchronized.

## Alternatives considered

### Serialized Protobuf blobs

This would provide direct round-trip serialization.

It was rejected because important CartHound fields would become difficult to query and index efficiently and relational constraints would be lost.

### JSONB as the primary domain storage format

This would preserve object-shaped records and provide some indexing capabilities.

It was rejected for core domain data because CartHound has a known schema with many relational and highly queryable fields.

JSONB remains appropriate for retailer-specific raw payloads and genuinely schemaless metadata.

### Duplicate persistence-domain entity classes

This would create database entities separate from the canonical Protobuf model.

It was rejected as a default architecture because simple explicit row-to-Protobuf mapping is sufficient and avoids another duplicate model layer.

Database row types may exist internally within the persistence implementation but are not domain objects and do not escape that boundary.

## Consequences

- Schema migrations are required when persisted domain structures change.
- Persistence code must explicitly assemble relational rows into Protobuf messages.
- PostgreSQL remains easy to inspect and query independently of application code.
- Database indexes can be designed around actual CartHound query patterns.
- Price history can scale independently from current-state queries.
- Raw retailer payloads can be retained without polluting the canonical domain model.

## Assumptions

This decision assumes:

- PostgreSQL remains the primary CartHound database
- CartHound continues to require relational queries across products, retailers, stores, offers, tags, and shopping lists
- queryability and index performance are more important than one-step Protobuf serialization
- the persistence mapper remains simple enough that a second domain-model layer is unnecessary

## Revisit when

Reconsider this decision if:

- relational mapping becomes a significant source of complexity
- major domain objects cannot be represented efficiently in a relational schema
- observed query patterns become primarily document-oriented
- PostgreSQL ceases to be the primary persistence technology
- serialized domain objects need to be preserved exactly for a concrete feature
- performance measurements show that the current relational design is the limiting factor

## Related

- `AGENTS.md`
- `packages/proto`
- `packages/core`
- Decision 0001: Protobuf as canonical domain models
- Decision 0002: Tag-based product classification and search
