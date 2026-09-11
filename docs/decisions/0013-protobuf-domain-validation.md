# 0013: Protobuf domain validation

Status: Accepted
Date: 2026-09-11

## Context

The Protobuf schemas documented required domain facts and value conventions, but generated constructors and parsers accepted partial or malformed messages. The only schema validation was the required `Offer.availability` oneof. The Product flattening also made package-size coherence a cross-field invariant instead of a structural property.

Validation belongs at each untrusted ingestion and persistence boundary so retailer payload mistakes, invalid API input, and malformed assembled messages do not enter domain processing or storage.

## Decision

Declare domain invariants with Protovalidate annotations in every CartHound schema. Required annotations apply to facts without which the message has no valid domain identity:

- Product ID, name, item size, and item-size unit
- Retailer ID, slug, and name
- RetailerListing ID, retailer and product references, and retailer product ID
- Store ID, retailer reference, retailer store ID, and name
- Offer retailer-listing reference, store reference, current price, availability selection, and observation time

Keep facts that a retailer may genuinely omit optional. These include GTIN, brand, package item count, regular price, listing display/package text, address, and coordinates. An optional field is still validated whenever it is explicitly supplied.

CartHound IDs and references must pass Protovalidate's UUID rule and a lowercase, hyphenated UUIDv7 pattern. GTINs must contain exactly 14 digits and pass the GTIN check-digit calculation. Required display names and opaque retailer identifiers must contain a non-whitespace character; retailer slugs use lowercase ASCII words separated by single hyphens.

Product item size and unit are required. Size must be a positive Google Decimal, and unit must be a defined value. `EACH` is the default semantic unit when no physical measurement is known: it represents one purchasable item and must be paired with an item size of exactly `1`. Optional package item counts must be positive when supplied. Product tags must be unique and use the lowercase, trimmed, single-space representation expected of managed tag natural keys.

Offer price is required and must be positive and nonzero. Money values must use a three-letter uppercase currency code and nonnegative Google Money components with nanos no greater than 999,999,999. Zero units with positive nanos is valid and represents a positive price below one whole currency unit. When regular price is present, its currency must match current price and it must not be less than current price. Availability status rejects unknown numeric enum values. Quantity must be positive when selected; zero availability is represented by the out-of-stock status. Observation timestamps are required to precede validation time.

A supplied postal address must have a two-letter uppercase CLDR region-code shape. Supplied coordinates must be within the latitude and longitude bounds defined by `google.type.LatLng`.

Executable schema tests use `@bufbuild/protovalidate`. The package is a development dependency of `@carthound/proto` for those tests. Each future API, adapter-ingestion, and persistence boundary must depend on and invoke a Protovalidate runtime before accepting a message; annotations do not run automatically during `create()`, decoding, or transport.

Enable Protobuf-ES's experimental `valid_types=protovalidate_required` generation mode. Each schema exports a corresponding `*Valid` type, and a successful Protovalidate result returns that type through `MessageValidType`. Required message fields such as `Offer.observed_at` are non-optional in `OfferValid`, so application code validates once at its boundary and then carries the validated type without repeated `undefined` checks.

## Consequences and limits

The schema now rejects partial domain entities and common malformed values consistently across languages that use Protovalidate. Cross-message facts still require the database or domain layer: schema validation cannot prove referenced records exist, enforce uniqueness across records, or verify that a retailer actually uses an identifier.

The currency rule validates ISO-style shape without embedding a currency registry. The address rule validates region-code shape without embedding CLDR data. Tag rules enforce the ASCII casing and whitespace portion of normalization; Unicode NFC normalization and controlled tag existence remain boundary and persistence responsibilities.

Valid types currently reflect required message-field optionality. Protobuf scalar properties were already non-optional in the normal generated shape, and Protobuf-ES does not narrow a Protovalidate-required oneof: `OfferValid.availability` still includes its unset case. Runtime validation guarantees that the case is selected, but TypeScript cannot express that particular guarantee through the built-in generator option yet.

This decision fulfills the pending validation work identified in [Product and Offer schema refinement](0012-product-and-offer-schema-refinement.md) while retaining its warning that annotations need runtime invocation.

## Related

- [Foundational domain values](0007-foundational-domain-values.md)
- [Product and Offer schema refinement](0012-product-and-offer-schema-refinement.md)
- [Google common types](0008-google-common-types.md)
- [Implementation history](../history/2026-09-11-product-offer-schema-review.md)
