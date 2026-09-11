# 2026-09-11: Product and Offer schema review

## User request

> I've made some changes to the protos and I want you to review them for issues and soundness and document that the change was made and the reasoning behind it:
> \tI've moved the AvailabilityStatus enum so it's defined inside the Offer message since this enum won't be used by any other messages
> \tI moved MeasurementUnit to the Measurement message for the same reason as above
> \tI've removed AvailabilityStatus.Limited because it's meaningless and pollutes the model, an item is either in stock or out of stock or we don't know the status.
> \tI created Offer.quantity so if an api will return the quantity of an item available we can store it
> \tI renamed Offer.availability to Offer.status and then wrapped both status and quantity in a oneof called availability. This is so if an api returns an actual quantity of items available we can store it and then automatically determine status based off if the value is nonzero. If an api just tells us if an item is available or not only the status part will be set. I don't want to store values that can be derived based off other data directly in the model or database which is why I created a oneof to enforce this. I also enabled buf validation on the oneof to ensure that either status or quantity is always populated with something
> \tRemoved the PackageSize message and just put the fields on the Product message since there's no reason to have a separate message for these two fields and nothing else will need it
> \tRemoved the Measurement message and just put the fields on the Product message since there's no reason to have a separate message for these two fields and nothing else will need it
> \tRemoved the Tag message since we don't need a separate id from the tag name, the name can be the globally unique identifier, no need for a separate id or a separate tag message, just put the tags in the repeated list
>
> I've also updated my lint package so that it includes rules to lint proto files using buf.build's standard lint rules as well as added some stylistic linting rules for proto files including using tabs over spaces for indentation, no trailing whitespace, use lf not crlf or cr, and files must end with a newline

The checked-in schema places `MeasurementUnit` inside `Product`, which is the remaining owner after `Measurement` was removed. The review therefore treats Product ownership as the implemented form of the stated single-consumer rationale.

## Review

Read `AGENTS.md`, the current Protobuf and generation configuration, generated Protobuf-ES output, the shared lint package implementation in `../lint`, and decisions 0002, 0003, 0006, 0007, 0008, and 0009. Generated output was regenerated only to inspect the actual public API; it remains ignored and was not hand edited.

The availability oneof is a sound way to retain the most authoritative retailer fact without persisting a redundant derived status. Protobuf-ES generates a discriminated `availability` union with `status`, `quantity`, and unset cases. Quantity zero remains distinguishable because selecting a oneof member records its case. A retailer threshold or lower bound is not an exact quantity and cannot use this field without losing meaning.

Nesting the enums expresses their current ownership but changes generated exports to `Offer_AvailabilityStatus` and `Product_MeasurementUnit`. Flattening Product removes small single-use wrappers, while also removing the structural coupling between decimal size and measurement unit. Tag names can serve as natural keys if normalization, controlled creation, uniqueness, and rename migration remain domain and persistence invariants. `AGENTS.md` was clarified so repeated Product strings are understood as managed tag-name references rather than arbitrary labels.

The new Protovalidate option is syntactically recognized after importing `buf/validate/validate.proto`, and generation succeeds. It does not itself execute validation. No `@bufbuild/protovalidate` runtime or application boundary invocation is installed, so an Offer with an unset oneof can still be constructed and parsed. Runtime enforcement is deferred until the ingestion and persistence boundaries exist.

## Issues found

- `npm run proto:lint` fails because `AVAILABILITY_STATUS_UNKNOWN` violates Buf STANDARD's required `_UNSPECIFIED` suffix for a zero enum value.
- Removed limited-status value number 3 and its name are not reserved. Reuse could reinterpret persisted or delayed messages once compatibility matters.
- `npm run proto:format:check` fails. Buf's formatter requires two spaces and canonical import ordering, while the shared `proto-style` checker requires tabs. The two configured format policies are mutually exclusive.
- The Product file also lacks its final newline, and the Offer file contains space indentation and trailing whitespace detected by `proto-style`.
- Regenerated domain tests and the proto workspace type check fail because they still import removed top-level declarations and use the former Product and Offer fields. Six of eleven focused domain tests fail at runtime; TypeScript reports the same stale API assumptions.
- Generating imported validation schemas causes the automatic public index to export Protovalidate declarations. This broadens `@carthound/proto` beyond its intended CartHound and selected Google domain types.
- Product comments state `item_count >= 1` and unique tags, but no validation rules currently enforce either invariant or require size and unit to appear together.

The schema changes are wire/API breaking relative to the preceding foundation. This is acceptable only because the repository has no released schema baseline or persistence data. Decision [0012](../decisions/0012-product-and-offer-schema-refinement.md) records the accepted model and its required follow-up. The existing decisions remain unchanged as historical records.

## Files changed by this review

- `AGENTS.md`
- `README.md`
- `docs/decisions/0012-product-and-offer-schema-refinement.md`
- `docs/history/2026-09-11-product-offer-schema-review.md`

No canonical `.proto` source or generated Protobuf file was edited by the review.

## User follow-up and corrections

> looks like some tests need updated, do that, also for the removal of unspecified add a comment to the enum so buf ignores that rule for that enum

Updated the domain tests to use flattened Product fields, normalized string tag identifiers, nested enum exports and schemas, and Protobuf-ES's discriminated availability oneof. The tests now cover quantity availability, explicit unknown status, the unset oneof case, scalar presence on the flattened Product fields, preservation of future unknown nested-enum values, and native Node imports using the new enum name. Updated the ESLint rule fixtures to traverse `Product.item_size` now that `Measurement` no longer exists.

Kept `AVAILABILITY_STATUS_UNKNOWN` and documented that zero is a meaningful reported unknown state rather than an unspecified sentinel. Added the narrow `// buf:lint:ignore ENUM_ZERO_VALUE_SUFFIX` directive directly above that enum value. Buf applies the same STANDARD rule twice here: once locally and once through the shared policy. Policy checks do not honor source comment suppressions, so `buf.yaml` ignores only `ENUM_ZERO_VALUE_SUFFIX` from the policy for `offer.proto` while retaining local STANDARD. The local pass honors the declaration comment, and all other declarations and policy rules remain checked.

Removed the incompatible `buf format --diff` check because its mandatory two-space output cannot satisfy the shared `proto-style` tab rule. The shared checker now owns source formatting, including tabs, LF line endings, trailing whitespace, and final newlines. Fixed the current schema style violations accordingly.

Regenerated ignored TypeScript output without editing it. `npm run proto:lint`, generation, and 56 focused domain/lint-rule tests passed after these corrections. Full repository validation follows this history entry.

## Edition 2024 presence defaults

> Why is option features.field_presence = EXPLICIT; declared on every proto file despite it being the default value for 2024 and 2026? I would rather just remove that declaration since the default is what we want. Also looking up what that does I was wondering how field presence works with typescript since the documentation (https://protobuf.dev/editions/features/#field_presence) says an has_* functions are generated for fields set to EXPLICIT, given that all we have is plain objects not classes how would I test field presence for a given object?

The declarations were originally added to make the chosen presence discipline visible, but they do not change Edition 2024 behavior. Removed every file-level declaration so the schemas inherit the edition default. This intentionally means a future edition default change would be adopted unless CartHound then adds an override; Edition 2024 and Edition 2026 both currently default to explicit presence.

The Protobuf language documentation describes generated presence APIs generically; exact APIs depend on the language implementation. Protobuf-ES generates plain message objects and descriptors rather than per-message `has_*` methods. CartHound tests presence with `isFieldSet(message, Schema.field.fieldName)` and clears it with `clearField(message, Schema.field.fieldName)`. For explicit scalar and enum fields, an absent field and an explicitly set default read as the same JavaScript value but return different `isFieldSet` results. Message fields use `undefined`, oneofs expose their selected `case`, and repeated/map fields do not preserve absent-versus-empty presence.

Expanded the existing presence test to verify that absent and explicitly assigned zero values remain distinguishable for both `uint32 item_count` and `MeasurementUnit item_size_unit` after removing the declarations. Updated Decision 0007 and the README to document the edition default and Protobuf-ES API.

## Policy comment-override correction

The user rejected combining a policy-level file exception with a duplicate local STANDARD pass and asked whether the shared policy could instead allow comment overrides. Buf's version 2 policy schema does not expose `disallow_comment_ignores`; source comment overrides apply only to local lint configuration. Removed the rejected policy/file-exception arrangement and kept a single local STANDARD configuration, where the declaration comment is honored. The shared lint package continues to provide the pinned Buf executable and the `proto-style` checker, but its policy file is not used by CartHound because its current content is only STANDARD.

## Final validation

The first aggregate test run found that programmatic ESLint could not load the TypeScript config after switching to the locally linked lint package: ESLint treats `jiti` as an optional peer and the linked package's copy was outside the root resolver path. Added `jiti` 2.7.0 to the ESLint-rule test workspace because those integration tests instantiate ESLint directly and load `eslint.config.ts`.

`npm run check` then passed completely: clean Protobuf generation, Buf STANDARD and shared schema-style lint, ESLint, Knip, Sherif, the root and all workspace type checks/builds, and 119 tests across seven files. The generator's existing Node localStorage experimental warning remains informational. Generated Protobuf output remains ignored.

## Domain validation annotations

> go through all the protos and mark fields that should always be set as required using buf's validation, also add validation for UUIDs and any other validation that we should include to prevent nonsense data from making it into the system

Reviewed all five CartHound schemas against the domain, persistence, tag, numeric, and Product/Offer decisions. Required validation is limited to facts needed for a valid domain entity or observation. Facts that retailer sources may genuinely omit remain optional and are validated only when supplied.

Added Protovalidate rules for required fields; lowercase UUIDv7 IDs and references; nonempty names and opaque retailer IDs; retailer slug syntax; GTIN-14 syntax and checksum; positive, coherent package measurements; defined units; unique normalized tag strings; valid nonnegative Google Money values; price currency and ordering consistency; defined availability statuses; past observation timestamps; postal region-code shape; and coordinate bounds. The existing required availability oneof remains the authoritative choice between categorical status and exact quantity.

Added `@bufbuild/protovalidate` to the proto workspace's development dependencies and executable tests that validate representative good and bad messages. This proves that the annotations compile and execute. It does not install automatic validation into generated constructors or parsers. The API, retailer-ingestion, and persistence layers do not exist yet; when implemented, they must invoke a Protovalidate runtime before accepting messages. Decision [0013](../decisions/0013-protobuf-domain-validation.md) records the invariant boundary and the constraints that remain outside schema validation.

`npm run check` passed after clean generation: Buf STANDARD and shared Protobuf style, ESLint, Knip, Sherif, all workspace and root type checks/builds, and 126 tests across eight files. The generator emitted its existing informational Node localStorage experimental warning. Generated Protobuf files remain ignored and were not edited.

## Generated validated types

> That seems wrong though, is there any way we can fix the generation, the whole point of validation is to make it so we don't have to constantly test messages to see if they're defined or not since they have to be defined if they're required otherwise the object shouldn't exist

The installed Protobuf-ES 2.14.1 generator supports experimental `valid_types=protovalidate_required`. Enabled that option in `buf.gen.yaml`. Generation now exports `ProductValid`, `OfferValid`, `RetailerValid`, `RetailerListingValid`, and `StoreValid`, and records each as its schema's `validType`. After `validator.validate()` returns `kind: "valid"`, TypeScript exposes `result.message` as the corresponding Valid type. For example, `OfferValid.observedAt` is a required `Timestamp`, so downstream code does not need an undefined check.

The ordinary generated type must remain capable of representing untrusted decoded input until validation occurs. Validation is therefore a single boundary transition rather than a property of every constructed or decoded object. Added a compile-time checked runtime test that accesses `result.message.observedAt.seconds` directly after successful validation.

The experimental generator currently narrows required message fields only. Scalar properties were already non-optional in Protobuf-ES, and `OfferValid.availability` still includes the unset oneof case even though runtime Protovalidate rejects it. This is a remaining upstream limitation rather than a reason to hand-edit generated files.

## Required positive Offer price

> offer.price should be required, also that field should be forced to be positive nonzero but and it attempts that with units >= 0 but is it valid for units to be zero but nanos to be nonzero?

Google Money permits zero units with nonzero nanos. For example, zero units and 500,000,000 nanos represents a valid positive half-unit price. Marked `Offer.price` required and strengthened its CEL rule so both components remain nonnegative and at least one is positive. Known zero now fails validation, while a positive fractional price below one currency unit passes. Because valid-type generation is enabled, `OfferValid.price` is also non-optional.

Updated validation tests to cover a missing price, a zero price, a positive sub-unit price, and direct non-optional access to `OfferValid.price`.

`npm run check` passed after clean regeneration: all schema and TypeScript linting, Knip, Sherif, builds and type checks, and 127 tests across eight files succeeded.

## Positive Offer quantity

> offer.quantity should be > 0

Added a Protovalidate `uint32.gte = 1` rule to the quantity oneof member. A selected quantity now always represents known available stock; zero availability must use `AVAILABILITY_STATUS_OUT_OF_STOCK`. Updated the validation test to reject zero quantity and retain a positive-quantity success case.

`npm run check` passed with all schema linting, repository linting, dependency checks, builds, type checks, and 127 tests succeeding.

`npm run check` passed with the new generation mode: clean Protobuf generation, both schema lint layers, ESLint, Knip, Sherif, all builds and type checks, and 127 tests across eight files.

## Required Product item size

> I think we should make item_size required

Marked `Product.item_size` required. The existing measurement-coherence rule consequently requires `item_size_unit` on every valid Product as well, while `item_count` remains optional. Successful validation now exposes `ProductValid.itemSize` as a non-optional Decimal. Updated valid Product fixtures, missing-size coverage, incomplete-measurement coverage, and compile-time checked direct access to the validated item size.

The first check correctly rejected the type test's direct read of `Decimal.value` under the canonical numeric-field lint rule. Changed the assertion to read Decimal's type name, which still proves non-optional access without bypassing the utility boundary. The final `npm run check` passed all schema and TypeScript linting, dependency checks, builds, type checks, and 128 tests across eight files.

## EACH measurement unit

> yes, and while we're at it lets remove the MeasurementUnit unspecified and count, both of those are pretty meaningless. Instead we need a good default that indicates that I'm thinking in a situation where we get no measurement information for an item we should just store 1 for the item size but I don't know what to call that measurement unit, any idea?

Selected `EACH` because it means one purchasable item without claiming a physical mass, volume, or package count. Replaced the zero `UNSPECIFIED` value with `EACH`, removed `COUNT`, and added a narrow Buf enum-zero-name comment override. Added validation requiring item size to be exactly the canonical Decimal string `1` when the unit is `EACH`. Updated generated-API, presence, and validation tests for the new enum.

> no need to reserve things, breaking changes to protos don't matter when we haven't deployed anything yet, we're still finalizing the model

Removed the initially added reserved number and names. The schemas have no deployed compatibility baseline, so reserving identifiers during this model-finalization phase adds no present protection. Compatibility reservations remain relevant after persisted data or external clients exist.

`npm run check` passed after clean regeneration: schema and TypeScript linting, dependency checks, all builds and type checks, and 128 tests across eight files succeeded.
