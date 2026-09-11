# 0007: Foundational Protobuf domain values and relationships

Status: Accepted
Date: 2026-09-07

## Originating prompt

Define only the durable foundation for products, classification, retailers, stores, listings, and observed offers, with exact numbers, structured package sizes, intentional presence, UUIDv7 IDs, and normalized GTIN-14.

## Decision

Product, Tag, Retailer, Store, and RetailerListing have CartHound UUIDv7 identifiers represented as lowercase hyphenated strings. References use the same convention. Retailer identifiers remain opaque strings whose interpretation belongs to adapters. Product GTIN is absent when unknown; a known valid GTIN is a 14-digit string with its check digit, left-padded from a valid shorter GTIN. Leading zeros must survive. This task does not generate UUIDs or validate GTIN checksums.

Money contains signed int64 `minor_units` (TypeScript bigint) and uppercase ISO-4217 `currency_code`. Minor units follow the currency's exponent rather than assuming all currencies use cents. Unknown money is an absent message, distinct from a present zero amount.

Decimal contains signed int64 `coefficient` (bigint) and uint32 `scale` (an exactly representable integer number). Its exact value is coefficient times ten to the negative scale. Zero is always `(0, 0)`; nonzero coefficients have no trailing decimal zeros while scale is positive. For example, `(1237500, 5)` normalizes to `(12375, 3)` and `(1200, 1)` to `(120, 0)`. Negative values follow the same rule. `normalizeDecimal` in core works directly on the generated message, rejects missing fields and values outside the wire ranges, returns a new value, and uses bigint division/remainder. Decimal magnitudes never pass through JavaScript Number. This bounds representable precision to int64; future PostgreSQL NUMERIC mapping must preserve those bounds for canonical values.

Measurement nests a Decimal and a MeasurementUnit. Initial units cover mass, volume, and count; mass ounce differs from explicitly US customary fluid ounce. US pints, quarts, and gallons do not imply imperial equivalents. PackageSize independently represents a positive integer item count and an exact measurement of each item. `24 x 12 US fl oz` retains both factors. If only one component is confidently known, the other is absent; unknown item count must not be assumed to be one. Unit conversion and unit prices remain deferred domain logic.

Product is a specific real-world product with name, optional brand, optional package information, and repeated first-class Tags. Tag names are normalized as NFC, trimmed, lowercased, and whitespace-collapsed; names are unique and IDs are distinct in product classification. This defines an invariant, not a tag management implementation. Retailer is an entity with stable unique slug and display name, avoiding enum changes when adding a retailer.

Store references its retailer by ID and carries an opaque retailer store ID, name, and optional structured address and WGS84 location. Postal codes are strings; partial addresses retain absence on singular components. Approximate coordinates may use double. RetailerListing references retailer and product by IDs, carries its opaque retailer identifier, and optionally retains its retailer-facing name and original package description. No raw API payload belongs in these models.

Offer is one observation identified by listing ID, store ID, and observation time. It carries optional effective and regular Money, an extensible AvailabilityStatus, and `google.protobuf.Timestamp`. Current and historical persistence tables will reconstruct this same domain shape. No Offer ID or OfferSnapshot is introduced merely to mirror storage. This preserves Decision 0003's separate current/history persistence strategy without duplicating canonical models.

## Presence and validity

All singular fields use Edition 2024's default explicit presence; schemas do not repeat the default `features.field_presence = EXPLICIT` declaration. Repeated Tags and address lines use natural empty collections. Every enum starts at zero UNSPECIFIED, with stable explicit numbers and additive evolution.

In Protobuf-ES 2.14.1, absent scalar and enum fields read as prototype defaults (empty string, zero, or zero bigint); generated scalar properties are not optional TypeScript properties. Consumers must use `isFieldSet(message, Schema.field.name)` to test presence. `clearField` removes it. An explicitly assigned zero or empty value retains presence through binary serialization. Message fields use `undefined` when absent. Presence does not itself validate a value: an explicitly empty GTIN remains invalid as a known GTIN even though the wire format preserves it distinctly from absence.

Required domain facts (such as IDs, names, both Money/Decimal components, and Offer observation time) are documented invariants, not legacy required wire fields. The schema deliberately permits construction of partial messages. No generic validation framework is added. Only Decimal normalization adds runtime validation in this foundation; ingestion and persistence boundaries must later enforce other semantic invariants.

## Alternatives and consequences

Floating-point exact quantities lose precision. UUID wrappers, entity graphs, retailer enums, separate snapshot messages, generic timestamps, and persistence-only identifiers add complexity without current domain value. The chosen model keeps entity relationships shallow and value objects nested. Structured measurements preserve package meaning independently of raw retailer text.

Revisit when actual retailer data requires additional units or pricing capabilities, when exact values exceed int64 bounds, or when concrete ingestion requires stronger validation. This task does not define persistence, adapters, RPC services, shopping/search models, promotions, authentication, or UI behavior.

## Related

- [Canonical models](0001-protobuf-as-canonical-domain-models.md)
- [Tag classification](0002-tag-based-product-classification.md)
- [Relational persistence](0003-relational-postgresql-persistence.md)
- [Generation pipeline](0006-protobuf-generation.md)
- [Originating request and work history](../history/2026-09-07-protobuf-foundation.md)
