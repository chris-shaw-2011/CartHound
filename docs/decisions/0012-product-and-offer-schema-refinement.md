# 0012: Product and Offer schema refinement

Status: Accepted
Date: 2026-09-11

## Context

The foundational schema introduced standalone `AvailabilityStatus`, `MeasurementUnit`, `Measurement`, `PackageSize`, and `Tag` declarations. Before a released compatibility baseline or persistence implementation existed, the model was reviewed for declarations that had only one consumer and for facts that could be derived from more authoritative retailer data.

## Decision

Nest `AvailabilityStatus` inside `Offer` and `MeasurementUnit` inside `Product`, because neither type currently has another domain consumer. Generated Protobuf-ES names consequently include their owner: `Offer_AvailabilityStatus` and `Product_MeasurementUnit`.

Remove the limited-availability state. An observation records in-stock, out-of-stock, or unknown status when a retailer supplies only a categorical answer.

Represent availability as an `Offer.availability` oneof containing either `status` or `quantity`. `quantity` is the exact nonnegative item count reported by a retailer. A zero quantity derives to out-of-stock and a positive quantity derives to in-stock; the derived status is not stored beside the source quantity. When only a categorical result is available, store `status`. When the source provides no availability information, store the unknown status. A Protovalidate required-oneof annotation declares that one alternative must be selected.

Flatten package information onto `Product` as `item_count`, `item_size`, and `item_size_unit`; remove `PackageSize` and `Measurement`. The three fields describe a package such as 24 items of 12 US fluid ounces without introducing single-use wrapper messages.

Remove the `Tag` message and its surrogate ID. A normalized tag name is the globally unique tag identifier, and `Product.tags` contains those identifiers directly. Tags remain governed first-class relational records and are not retailer-provided free-form labels. Renaming a tag is therefore an identifier migration rather than a display-name edit.

## Invariants and consequences

Only an exact retailer-reported count belongs in `Offer.quantity`; thresholds such as “10+” require a future representation and must not be stored as an exact count. Code deriving availability treats zero as out-of-stock and every positive value as in-stock.

Decision [0013](0013-protobuf-domain-validation.md) later narrowed a selected quantity to positive values. Zero availability is represented by the explicit out-of-stock status instead of quantity zero.

Decision 0013 also later made Product item size and item-size unit required validation invariants. Item count remains optional.

The measurement enum now uses `EACH` as its meaningful zero/default value and removes `UNSPECIFIED` and `COUNT`. A Product without known physical measurement is represented as item size `1` `EACH`; `item_count` separately represents a known package count.

Flattening measurement fields permits partial combinations at the Protobuf structural level. An ingestion or persistence validator must enforce the intended relationship between `item_size` and `item_size_unit`, and must enforce `item_count >= 1` when item count is set. Explicit Editions presence allows the validator to distinguish an absent scalar from an explicitly supplied zero.

The required-oneof annotation is metadata evaluated by Protovalidate. Protobuf parsing and `create(OfferSchema)` still permit an unset oneof until a configured validation runtime checks the message. CartHound must invoke that runtime at the eventual ingestion and persistence boundaries before treating the rule as enforced.

These edits are source- and generated-API breaking. Nesting changes enum type names; flattening changes Product fields; changing Tag messages to strings changes the element type; and the Offer oneof changes its generated TypeScript shape. They are accepted before the first released `carthound.v1` compatibility baseline. Once data or external clients exist, removed field and enum identifiers must be reserved and schema changes must pass a real breaking-change baseline.

## Lint exception and review follow-up

`AVAILABILITY_STATUS_UNKNOWN` deliberately describes a known report that availability is unknown, rather than the absence of an enum selection. Keep that name and place a declaration-level `ENUM_ZERO_VALUE_SUFFIX` suppression immediately before it. CartHound configures STANDARD locally because Buf policies cannot enable declaration comment overrides; the shared lint package still supplies the repository-local Buf and `proto-style` executables.

The removed enum number 3 and its former limited-status name should be reserved before compatibility matters. The repository also has no Protovalidate TypeScript runtime or boundary invocation yet.

The generated public entrypoint currently exports declarations from `buf/validate/validate.proto` because generation includes imports. Those validation implementation declarations are not part of CartHound's intended public domain API and should be excluded by the generated entrypoint policy.

The shared `proto-style` checker is the schema formatting authority because the project intentionally uses tab indentation. Buf's two-space formatter check was removed from the aggregate workflow; Buf STANDARD remains the semantic/schema style linter.

## Related

- [Foundational domain values](0007-foundational-domain-values.md)
- [Tag classification](0002-tag-based-product-classification.md)
- [Protobuf generation](0006-protobuf-generation.md)
- [Review history](../history/2026-09-11-product-offer-schema-review.md)
