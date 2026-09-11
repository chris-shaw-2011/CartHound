# 2026-09-07: Protobuf foundation

## User request

> Implement CartHound's foundational Protobuf domain model and generation pipeline.
>
> Read `AGENTS.md` and all existing decision/history records before making changes. In particular, preserve the accepted decisions that Protobuf is the canonical CartHound domain representation and PostgreSQL will later use normalized relational persistence rather than serialized Protobuf blobs.
>
> The repository currently targets Node.js 26, TypeScript 7, npm workspaces, and native Node TypeScript type stripping. Preserve those architectural choices.
>
> ## Scope
>
> This task is only the foundational Protobuf layer.
>
> Do not implement:
>
> * PostgreSQL schema or persistence
> * migrations
> * Docker
> * retailer adapters
> * RPC/Connect services
> * shopping lists
> * saved searches or logical search-expression models
> * promotions/coupons
> * authentication
> * application UI behavior
>
> Do not introduce abstractions merely for anticipated future requirements.
>
> ## Protobuf toolchain
>
> Use:
>
> * project-local `@bufbuild/buf`
> * `@bufbuild/protoc-gen-es`
> * `@bufbuild/protobuf`
>
> Use the locally installed Protobuf-ES generator rather than a remote Buf Schema Registry generator so code generation is reproducible without depending on an external service.
>
> Generate TypeScript directly.
>
> Configure Protobuf-ES appropriately for CartHound's existing native-TypeScript architecture, including:
>
> * TypeScript output
> * `.ts` import extensions where required
> * erasable TypeScript syntax compatible with Node.js native type stripping and `erasableSyntaxOnly`
>
> Generated TypeScript must execute directly under CartHound's existing Node.js 26 native TypeScript type-stripping configuration.
>
> Do not introduce a transpilation step.
>
> Use Protobuf Edition 2024 for the schemas.
>
> Use the Protobuf package namespace:
>
> `carthound.v1`
>
> Prefer small schema files following modern Protobuf file-organization guidance where practical.
>
> Do not add ConnectRPC generation yet because this task does not define RPC services.
>
> ## Canonical sources and generated output
>
> The `.proto` files are the canonical source.
>
> Use a clean structure equivalent to:
>
> `packages/proto/proto/carthound/v1/`
>
> for committed canonical `.proto` sources.
>
> Generated TypeScript should live under a location equivalent to:
>
> `packages/proto/src/gen/carthound/v1/`
>
> The generated directory is build output and MUST NOT be committed to Git.
>
> Add the generated output to `.gitignore`.
>
> Generated files must never be manually edited.
>
> Do not treat generated output as a historical artifact. The committed `.proto` definitions, pinned package dependencies, package lockfile, and generator configuration must contain everything required to reproduce it.
>
> Expose the intended public generated types/schemas through `@carthound/proto`.
>
> Do not expose unrelated generator internals unnecessarily.
>
> Generated code may be excluded from stylistic lint rules where appropriate, but it must type-check and execute successfully.
>
> ## Generation lifecycle
>
> Generation must be automatic enough that a fresh checkout works without developers manually installing tools or remembering undocumented setup steps.
>
> A fresh:
>
> `npm install`
>
> should leave the repository with the required generated Protobuf TypeScript available.
>
> Also expose an explicit repository command equivalent to:
>
> `npm run proto:generate`
>
> for regeneration after modifying `.proto` files.
>
> Use repository-local dependencies only. Do not require globally installed Buf, protoc, or Protobuf-ES tools.
>
> Normal application runtime must not dynamically invoke code generation.
>
> Code generation is a development/build concern.
>
> ## Clean verification
>
> Because generated code is not committed, do NOT implement a "generated files are up to date with Git" check.
>
> Instead, repository verification must prove generation is reproducible from scratch.
>
> The aggregate verification flow should effectively:
>
> 1. remove existing generated Protobuf output
> 2. validate/format-check the `.proto` schemas
> 3. regenerate all Protobuf TypeScript from the committed schema/configuration
> 4. run the repository's normal lint/Knip/Sherif/type-check/build/tests against that fresh generated output
>
> Integrate this clean generation into the existing `npm run check` workflow without weakening existing checks.
>
> A successful `npm run check` must therefore prove that the repository can recreate all required generated code from committed sources.
>
> Be careful about command ordering: checks such as TypeScript, linting, Knip, or application builds that import `@carthound/proto` must not run before required generated files exist.
>
> ## Identifier conventions
>
> Canonical CartHound entity IDs use UUIDv7.
>
> Represent UUIDs as `string` fields in Protobuf rather than `bytes` or wrapper messages.
>
> Do not create `ProductId`, `StoreId`, etc. wrapper messages.
>
> The following entities require CartHound IDs:
>
> * Product
> * Tag
> * Retailer
> * Store
> * RetailerListing
>
> Retailer-specific identifiers remain strings.
>
> Known product GTINs are strings, never numeric fields, so leading zeros cannot be lost.
>
> The canonical Product GTIN representation should be normalized to GTIN-14 when a valid GTIN is known.
>
> GTIN must be able to be absent.
>
> Do not implement UUID generation as part of this task unless it becomes concretely necessary to validate the Protobuf implementation.
>
> ## Exact numeric values
>
> Never represent monetary or exact measurement quantities using JavaScript floating-point semantics.
>
> Define a canonical `Money` value object using:
>
> * `int64 minor_units`
> * `string currency_code`
>
> Currency codes use uppercase ISO-4217 codes.
>
> The generated TypeScript representation of the monetary integer must preserve full integer precision, preferably using `bigint` according to the chosen Protobuf-ES configuration.
>
> Define a reusable exact `Decimal` value object using:
>
> * signed `int64` coefficient
> * unsigned scale
>
> For example:
>
> `12.375`
>
> is represented as:
>
> * coefficient: `12375`
> * scale: `3`
>
> Document and test a canonical normalized Decimal representation so equivalent values are not unnecessarily represented using multiple coefficient/scale combinations.
>
> Decimal is intended for exact measurements and other non-money exact decimal values.
>
> It will later map to PostgreSQL `NUMERIC`.
>
> Do not convert exact Decimal values through JavaScript floating-point numbers.
>
> ## Measurements and package sizes
>
> Define a structured `Measurement` consisting of:
>
> * Decimal value
> * MeasurementUnit
>
> Define an extensible `MeasurementUnit` enum beginning with the common grocery units necessary for:
>
> * mass
> * volume
> * count
>
> At minimum, distinguish mass ounce from fluid ounce.
>
> Include the practical grocery units needed to establish the model, but do not attempt to model every unit that could ever exist. Enum values can be added compatibly later.
>
> Define `PackageSize` so common packages can represent both:
>
> * number of items
> * measurement of each item
>
> For example, the model must be capable of representing:
>
> `24 × 12 fl oz`
>
> without collapsing the structure into an ambiguous string.
>
> Do not define or persist unit-price fields. Unit price is derived domain logic.
>
> ## Core domain messages
>
> Define the minimum durable foundation necessary for future persistence and retailer ingestion:
>
> * Decimal
> * Money
> * Measurement
> * MeasurementUnit
> * PackageSize
> * Address
> * GeoPoint
> * Tag
> * Product
> * Retailer
> * Store
> * RetailerListing
> * AvailabilityStatus
> * Offer
>
> Avoid adding unrelated domain concepts.
>
> ### Tag
>
> Tag is a first-class entity.
>
> It has:
>
> * CartHound UUID
> * normalized unique name
>
> Do not turn tags into arbitrary repeated strings.
>
> ### Product
>
> Product represents a specific real-world product, not a generic concept such as "butter".
>
> It should include the durable fields needed now, including:
>
> * CartHound ID
> * optional normalized GTIN-14
> * canonical product name
> * optional brand
> * structured package size when confidently known
> * product Tags
>
> Do not introduce a category hierarchy or abstract canonical-product concept.
>
> ### Retailer
>
> Retailer is an entity, not an enum.
>
> It should have:
>
> * CartHound ID
> * stable slug/key such as `kroger`
> * display name
>
> Adding another retailer should not inherently require altering a Protobuf enum.
>
> ### Store
>
> Store belongs to a Retailer and should contain the foundational information required to identify a physical retailer location:
>
> * CartHound ID
> * retailer ID
> * retailer-specific store ID
> * name
> * structured address when available
> * geographic position when available
>
> GeoPoint may use floating-point coordinates because geographic coordinates are approximate values and are not subject to the exact monetary/measurement restriction.
>
> ### RetailerListing
>
> RetailerListing represents a retailer's representation of a Product.
>
> It should include:
>
> * CartHound ID
> * retailer ID
> * product ID
> * retailer-specific product/listing ID
> * retailer-facing title/name where appropriate
> * raw package description when supplied by the retailer
>
> Raw retailer package text belongs here rather than replacing Product's structured package measurement.
>
> Do not include raw retailer API payloads in the canonical Protobuf model.
>
> Raw payloads may later be retained as persistence/debugging information outside the canonical domain model.
>
> ### Offer
>
> Use one canonical Offer shape for an observed retailer listing at a store.
>
> Do not create a separate `OfferSnapshot` Protobuf message merely because PostgreSQL will later have current-offer and historical-observation tables.
>
> An Offer should contain the domain facts required for one observation, including:
>
> * retailer listing ID
> * store ID
> * current/effective price when known
> * regular price when separately known
> * availability status
> * observation timestamp using `google.protobuf.Timestamp`
>
> Use an enum for availability rather than a boolean so states such as unknown, in-stock, out-of-stock, or limited availability can evolve cleanly.
>
> Do not model complex promotions, digital coupons, loyalty requirements, BOGO rules, quantity discounts, or other retailer-specific pricing mechanics yet.
>
> Those should be designed after inspecting actual retailer data.
>
> ## Relationship strategy
>
> Avoid deeply nested entity graphs.
>
> Use IDs for entity relationships:
>
> * Store -> retailer ID
> * RetailerListing -> retailer ID and product ID
> * Offer -> retailer listing ID and store ID
>
> Value objects such as Money, Measurement, PackageSize, Address, and GeoPoint should be nested normally.
>
> Product may directly contain its Tags because Tags are part of Product classification and the persistence layer will later reconstruct that relationship from normalized relational tables.
>
> Do not add database row IDs or persistence-only metadata merely because later tables may require them.
>
> Do not add generic `created_at` or `updated_at` fields unless they represent genuine domain facts.
>
> `Offer.observed_at` is a domain fact and must be represented.
>
> ## Optional/presence semantics
>
> Use explicit Protobuf presence intentionally.
>
> Do not use arbitrary sentinel values such as empty strings or zero monetary values to represent "unknown" when field absence is semantically different.
>
> Review each potentially absent field and model presence appropriately according to Edition 2024 / Protobuf-ES semantics.
>
> Examples where presence matters include:
>
> * GTIN
> * brand
> * normalized package information
> * store address/location data
> * price
> * regular price
> * retailer package description
>
> Repeated collections should generally use their natural empty representation rather than an unnecessary presence wrapper.
>
> ## Enum conventions
>
> Every enum must have a zero-valued unspecified/unknown member.
>
> Do not assign semantic meaning to the default numeric zero other than unspecified/unknown unless there is a compelling reason.
>
> Choose stable enum numeric values deliberately.
>
> Never reuse removed enum numbers or names.
>
> ## Schema evolution
>
> Follow normal Protobuf compatibility practices from the beginning:
>
> * stable field numbers
> * zero/unspecified enum values
> * never reuse removed field numbers
> * reserve removed fields and enum values
> * prefer additive evolution
> * avoid wire-incompatible type changes
>
> Use comments to document semantic invariants that the wire schema itself cannot enforce, including:
>
> * UUIDv7 formatting
> * GTIN-14 normalization
> * currency-code expectations
> * Decimal normalization
>
> Do not add a second TypeScript DTO/domain-model layer.
>
> ## Repository scripts and validation
>
> Add appropriate scripts for:
>
> * Protobuf generation
> * cleaning generated output
> * Buf schema linting
> * Buf format verification
> * aggregate clean generation/verification
>
> Integrate relevant verification into the existing repository `npm run check` without weakening any current ESLint, Knip, Sherif, TypeScript, build, or test coverage.
>
> Review the existing workspace/source-import architecture before modifying scripts so this work remains compatible with current Node native type stripping and npm workspace resolution.
>
> Do not add unnecessary task runners or build systems.
>
> ## Tests
>
> Add meaningful tests proving the generated models actually work.
>
> At minimum verify:
>
> * generated code imports successfully through `@carthound/proto`
> * Node.js 26 can execute the generated TypeScript through native type stripping
> * representative messages can be constructed
> * representative messages survive Protobuf binary serialization/deserialization
> * Money integer values round-trip without precision loss
> * Decimal coefficient/scale values round-trip without precision loss
> * package measurements can represent structures such as `24 × 12 fl oz`
> * enums/generated syntax are compatible with `erasableSyntaxOnly`
> * optional/presence semantics behave as intended
> * a clean generation followed by the normal repository verification succeeds
>
> Do not add live network-dependent tests.
>
> Where appropriate, test representative values larger than JavaScript's safe integer range so tests prove the exact-integer strategy rather than merely exercising small values.
>
> ## `.gitignore` and repository cleanliness
>
> Generated Protobuf TypeScript must remain untracked.
>
> After a clean build/check:
>
> * generated files may exist locally
> * `git status` must not report generated files
> * no generated artifact should be accidentally staged or committed
> * no unnecessary compiler/build artifacts should appear as repository changes
>
> The repository must remain reproducible from only committed source/configuration and pinned dependencies.
>
> ## Documentation/history
>
> Follow `AGENTS.md` development-history requirements completely.
>
> Preserve this user request and the material implementation decisions in an appropriate `docs/history/` record.
>
> Create new architectural decision records where these newly fixed choices warrant them rather than rewriting prior decision history.
>
> At minimum, make sure the durable record explains:
>
> * Buf + Protobuf-ES choice
> * native type-strippable generated TypeScript
> * Edition 2024 choice
> * generated code is deliberately NOT committed
> * `.proto` files are canonical and generated TypeScript is reproducible build output
> * automatic generation/setup strategy
> * clean-generation verification strategy
> * `carthound.v1` package/version convention
> * UUIDv7/string identifier convention
> * GTIN-14 convention
> * Money representation
> * Decimal representation
> * measurement/package-size strategy
> * Retailer-as-entity decision
> * Offer/current-vs-history canonical modeling decision
> * presence/optional conventions
>
> Do not alter existing accepted architectural decisions silently.
>
> If implementation exposes a genuine conflict with one of them, document the conflict and do not silently work around it.
>
> ## Implementation judgment
>
> The choices above are intentional architectural requirements.
>
> However, inspect the current versions and official documentation for Buf, Protobuf, Protobuf-ES, Node.js 26, and TypeScript before relying on specific generator flags or behavior.
>
> If a requested tool configuration has changed or is technically incompatible with the current tool versions, do not force it mechanically.
>
> Instead:
>
> 1. establish the actual current behavior from authoritative documentation or installed tool behavior
> 2. preserve the architectural intent
> 3. choose the smallest compatible adjustment
> 4. document the discrepancy and resulting decision in development history
>
> Do not broaden scope merely because adjacent infrastructure could also be implemented.
>
> ## Completion criteria
>
> The task is complete when:
>
> * foundational `.proto` definitions exist
> * generated TypeScript is reproducible but untracked
> * a fresh `npm install` leaves required generated code available
> * an explicit Protobuf generation command exists
> * all intended canonical models are publicly usable through `@carthound/proto`
> * generation uses repository-pinned dependencies
> * generated code works under Node 26 native TypeScript type stripping
> * clean schema/generation verification is integrated into `npm run check`
> * exact numeric and presence behavior is covered by tests
> * all existing repository checks continue to pass
> * generated output does not dirty Git
> * development history and durable architectural decisions are documented
>
> Do not start persistence, Docker, or retailer implementation as part of this task.

## Assessment and implementation plan

Read AGENTS.md and all existing decision/history records before editing. Decisions 0001–0005 remain accepted, including the correction in 0005 that npm workspace symlinks support native TypeScript execution. The checkout was clean. Node 26.8.1 and TypeScript 7.0.2 are installed. Registry metadata reports Buf 1.72.0 and Protobuf-ES generator/runtime 2.14.1.

1. Add small Edition 2024 schemas under carthound.v1 and an explicit public generated-model export surface.
2. Pin local Buf and Protobuf-ES dependencies; generate erasable TypeScript with explicit .ts imports into ignored src/gen output.
3. Generate during root postinstall; prepend clean/lint/format-check/generate to the existing check workflow.
4. Exercise exact integers, Decimal normalization, package structure, relationships, presence, binary round trips, and actual Node execution. Keep any Decimal normalization behavior as a small core function over the generated type.
5. Document durable choices and commands, verify clean installation and the complete repository checks, and inspect Git cleanliness.

Official generator documentation exposes target=ts, import_extension=ts, and experimental erasable_syntax=true. Installed behavior will be verified before relying on those options. No transpilation or remote generator is planned.

## Implementation findings and changes

Added all 14 requested messages/enums as separate small schemas, an explicit public barrel, local Buf configuration, pinned dependencies, ignored output, automatic postinstall generation, and clean generation at the start of check. Added a minimal core Decimal normalizer over the generated type, with no duplicate domain models. Added native Node execution, exact int64 boundaries, normalization, package structure, entity relationship, timestamp, enum evolution, and presence tests.

The pinned generator accepts Edition 2024 and all three requested options. Its enums are erasable constant objects, and int64 defaults to bigint. Explicit presence does not produce optional scalar TypeScript properties: defaults are inherited and isFieldSet distinguishes absence. This installed behavior was verified directly and communicated; documentation and tests use it intentionally.

The first consumer build exposed a previously latent web compiler gap: the web tsconfig did not permit .ts import extensions because the scaffold packages were empty. Enabled allowImportingTsExtensions for the web noEmit check, preserving Vite and the accepted source-import architecture. The proto workspace test imports also require explicit Node type inclusion under TypeScript 7, so its tsconfig includes node types.

Knip does not discover the generator invoked inside buf.gen.yaml. Added a narrowly documented ignoreDependencies entry for @bufbuild/protoc-gen-es only; clean generation executes the tool in every aggregate check. Generated TypeScript alone is excluded from ESLint style checks and remains type-checked.

Sandboxed Buf initially could not create its default user cache directory; validation uses BUF_CACHE_DIR=/tmp/carthound-buf-cache as an environment-only adjustment. No machine-specific cache path is committed. Registry access required the environment's network-enabled execution. npm reports the Buf dependency postinstall as not yet covered by allowScripts; the installed local CLI nevertheless runs successfully. Fresh installation will be verified explicitly.

Durable decisions: [0006 generation](../decisions/0006-protobuf-generation.md) and [0007 domain values](../decisions/0007-foundational-domain-values.md). Existing accepted records were preserved unchanged. No architectural conflict or expansion into deferred application features was necessary.

## Final validation

On Node 26.8.1, npm 11.19.0, and TypeScript 7.0.2, the full aggregate check passed: clean output removal, Buf STANDARD lint, format verification, local regeneration, ESLint, Knip, Sherif, all six workspace type checks, the Vite production build, and 36 tests across three suites (the eight existing scaffold tests plus 28 new cases). Tests include int64 endpoints and values above JavaScript's safe integer range, Decimal canonicalization and invalid inputs, structured multipacks, entity relationships, nanosecond Timestamp preservation, explicit scalar/message presence, future unknown enum values, and a child Node process importing the public TypeScript package without a transpiler.

Created an isolated source copy with no node_modules, generated output, build output, or Git metadata. Plain `npm install` successfully installed the locked dependencies and ran root postinstall generation. Plain `npm run check` then passed the complete flow and all 36 tests there. The install left package-lock.json byte-for-byte unchanged. All 14 generated TypeScript files were byte-identical between the original checkout and independent installation. Neither test suite uses a live retailer API.

The pinned generator emits a Node localStorage experimental warning during generation; this does not prevent generation, checking, or execution. npm's informational allowScripts warning for Buf also remained non-blocking in the actual fresh install. No loader, transpilation, cache configuration, or warning suppression was added to compensate.

Git inspection confirmed the generated directory is ignored and contains no tracked or staged files. No compiler output appears among repository changes. Existing historical/decision records remain unchanged, and git diff whitespace checks passed. No commit or pull request was created for this task.
