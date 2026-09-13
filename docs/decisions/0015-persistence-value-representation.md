# 0015: Lossless PostgreSQL value representation

Status: Accepted  
Date: 2026-09-13

## Decision and justification

Canonical validation owns every persistence-induced restriction. These rules were added to Proto before the corresponding database implementation. This amends decisions 0008 and 0013 without changing Google's imported schemas.

### Decimal

PostgreSQL 18 unconstrained NUMERIC supports at most 131072 digits before the decimal point and 16383 after it. Product's positive Decimal must fit those significant digit positions after accounting for the exponent. CEL uses exact integer position arithmetic over decimal text; it does not parse the value as a float. It finds the first/last occurrence of each nonzero digit so redundant leading/trailing zeros do not reduce the valid numeric domain. An exponent outside CEL int64 cannot describe an in-range nonzero value within Protobuf's finite message size and fails validation.

The core normalizer remains general and exact. It does not acquire PostgreSQL-specific bounds; the bound belongs to Product's item-size annotation. The mapper normalizes only the value supplied to unconstrained `numeric`, with no declared precision/scale and no JavaScript floating-point conversion. Boundaries `1e131071` and `1e-16383` are accepted; `1e131072` and `1e-16384` are rejected. Equivalent spellings with zeros and offsetting exponents remain valid.

Google Decimal's string representation is itself observable. NUMERIC cannot distinguish `1.20`, `1.2`, or `12e-1`. Store `item_size_decimal text` alongside `item_size numeric` to preserve the original string exactly, including plus signs, zeros and exponent notation. This is explicit persistence representation metadata, not a second domain model. Reads check that both columns represent the same exact value before returning the original Decimal. This avoids imposing a new canonical-spelling restriction merely for database convenience. No numeric value passes through Money/Decimal `toNumber` utilities.

### Timestamp and Money

Offer observation time must remain in the existing past-time domain and satisfy `nanos % 1000 == 0`. CEL treats Timestamp as a native value and Buf rejects direct `.nanos` field selection, so the canonical rule checks the exact RFC3339 fractional representation: digits after the sixth must be zero. Tests prove equivalence to the modulo rule. PostgreSQL uses `timestamp(6) with time zone`. The installed stable Drizzle node-postgres session supplies an identity parser for timestamp OIDs; its timestamp column string mode preserves the returned six fractional digits. No global pg parser override is needed. Future connections must use ISO DateStyle; the test pool explicitly selects ISO and UTC.

The write mapper uses Date only for integral-second calendar formatting and separately appends exact microseconds. The fractional component never enters Date. Read parsing uses Protobuf's Timestamp JSON parser after normalizing PostgreSQL's ISO separator/offset syntax. Tests cover nonzero microseconds, pre-epoch observations and year 0001. The SQL range mirrors Protobuf Timestamp years 0001–9999; the changing `lt_now` rule stays at the validation boundary.

Money preserves the full nonnegative int64 units range and integer nanos, including values beyond Number's safe-integer range. Explicit upper bounds on units and uint32 fields reinforce the wire limits for ordinary JavaScript messages: Protovalidate does not automatically validate every underlying wire type. The boundary also serializes to Protobuf to check representability; that temporary serialization is validation only and is never persisted as a blob.

### Text and physical index limits

PostgreSQL text cannot represent U+0000. Canonical CartHound message-level validation rejects it in directly persisted text and nested PostalAddress strings/arrays; constrained UUID/currency/Decimal syntax already excludes it where applicable. Names/addresses have no invented varchar length limits.

The supported PostgreSQL build uses standard 8192-byte pages. PostgreSQL 18's B-tree maximum index tuple is 2704 bytes on this layout. An uncompressed single text key needs an 8-byte index tuple header and 4-byte varlena header, leaving **2692 UTF-8 bytes** for retailer slugs and individual tags. A `(retailer UUID, opaque identifier)` key additionally needs 16 UUID bytes, leaving **2676 bytes** for retailer store/listing identifiers. Tag GIN entries also fit this limit: their 2704-byte key tuple leaves room for a posting pointer in the 2712-byte GIN entry limit. These are byte limits derived from actual index representation, not product naming preferences or arbitrary varchar sizes. Compression must not be required for a valid value to fit.

Add matching canonical `string.max_bytes` rules, retain text columns, and mirror simple bounds with `octet_length` checks on the directly indexed columns/projection. Product tag uniqueness and item byte bounds remain Protovalidate rules rather than an elaborate SQL array-validation function. Tests exercise ASCII and multibyte endpoints. Future changes to index key composition, page size or PostgreSQL internals must revisit these calculations; live testing must verify incompressible boundary values on the selected PostgreSQL build. Standard finite PostgreSQL datum/message/resource limits remain operational limits, not a promise of unbounded allocation.

## Alternatives

Fixed small NUMERIC precision would silently round valid measurements. Normalizing away the original Decimal spelling would lose canonical field content. A JavaScript Date for the complete observation would lose microseconds. Storing tags in unindexed blobs or hashing tag identity would defeat the accepted query/identity design. Silent driver coercion or persistence-only rejection would make the database a competing value model. Each alternative is rejected.

## Sources and related records

- [PostgreSQL 18 numeric limits](https://www.postgresql.org/docs/18/datatype-numeric.html)
- [PostgreSQL date/time precision](https://www.postgresql.org/docs/18/datatype-datetime.html)
- [PostgreSQL character types](https://www.postgresql.org/docs/18/datatype-character.html)
- [PostgreSQL 18 B-tree layout](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/access/nbtree.h)
- [PostgreSQL 18 index tuple layout](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/access/itup.h)
- [PostgreSQL 18 GIN layout](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/include/access/ginblock.h)
- [Persistence design](0014-postgresql-persistence-foundation.md)
- [Request and work history](../history/2026-09-13-persistence.md)
