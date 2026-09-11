# CartHound

CartHound is a self-hosted grocery price comparison application. The repository contains the TypeScript monorepo and foundational Protobuf domain models. Persistence and retailer integrations remain future work.

## Requirements

- Node.js 26 or newer
- npm 11 or newer

## Commands

```sh
npm install
npm run check
```

Package installation requires a `GITHUB_TOKEN` that can read GitHub Packages, as described in `.npmrc`.

`npm install` automatically generates the Protobuf TypeScript using pinned repository-local tools. No global Buf, protoc, or generator installation is needed.

`npm run check` first removes generated Protobuf output, checks the schemas with Buf STANDARD and the shared Protobuf style rules, and regenerates TypeScript. It then runs ESLint, Knip, Sherif, every workspace build/type check, and the repository test suite against that fresh output.

Individual commands are also available:

```sh
npm run build
npm test
npm run lint
npm run knip
npm run sherif
npm run format
```

Run the web development server with `npm run dev --workspace @carthound/web`.

The API and worker run TypeScript directly with Node.js type stripping:

```sh
npm start --workspace @carthound/api
npm start --workspace @carthound/worker
```

All apps declare dependencies on `@carthound/core`, `@carthound/proto`, and `@carthound/retailers`. Placeholder imports exercise those connections until real exports are introduced.

Backend and shared-package build commands only type-check; packages export their TypeScript sources directly. Node resolves npm workspace symlinks to real `packages/*` paths and strips types there. Only the web app produces a bundled build.

Deploy the workspace directories with their npm links intact; do not copy these TypeScript packages into physical `node_modules` directories or enable `--preserve-symlinks`. Relative backend/package imports must use `.ts` extensions and erasable syntax. Generated Protobuf TypeScript uses these same constraints. Browser imports must exclude retailer secrets and Node-only implementations.

## Protobuf development

CartHound Edition 2024 schemas use `carthound.v1` under `packages/proto/proto/`. Google common types are imported from `buf.build/googleapis/googleapis`, pinned by `packages/proto/buf.lock`. Buf downloads them automatically when its cache is cold; setup then requires access to the Buf Schema Registry. Code generation still uses the locally installed generator.
Generated files under `packages/proto/src/gen/` are ignored build output: never edit or commit them.
Import public message types, schemas, and enums through `@carthound/proto`. Its entrypoint, `src/gen/index.ts`, is also generated automatically from Protobuf-ES output; adding or removing a model requires no handwritten export updates.

```sh
npm run proto:generate      # Regenerate after editing schemas; removes stale output
npm run proto:clean         # Remove generated output
npm run proto:lint          # Buf STANDARD and shared schema style checks
npm run proto:check         # Clean, lint, regenerate
npm exec --workspace @carthound/proto -- buf dep update # Intentionally update schema lock
```

After explicitly cleaning output, regenerate before running consumer-only commands such as build or test. Normal installation does this automatically; runtime startup never generates code. Disabling npm lifecycle scripts skips automatic generation. Production packaging must include generated output prepared with development dependencies and preserve workspace links.

Use `create`, `toBinary`, and `fromBinary` from `@bufbuild/protobuf` with the exported schemas. Google Money uses bigint whole `units` plus bounded integer `nanos`; Google Decimal uses an exact `value` string. Postal addresses and coordinates use Google `PostalAddress` and `LatLng`. `normalizeDecimal` from `@carthound/core` produces canonical exact Decimal values without mutating the input. Unit-price calculations are not implemented.

CartHound singular fields use Edition 2024's default explicit wire presence; the schemas do not restate that default. Protobuf's documented `has_*` API is language-specific. Protobuf-ES uses plain objects and the generic `isFieldSet(message, fieldDescriptor)` helper instead, for example `isFieldSet(product, ProductSchema.field.gtin)`. Scalar properties still read as their default values when absent, so presence must not be inferred by comparing `product.gtin` with an empty string. Use `clearField(message, fieldDescriptor)` to remove presence. Imported Google common types retain their proto3 scalar defaults; check presence on an optional containing message, such as `product.itemSize`, to distinguish unknown from known zero. Absent nested messages are `undefined`; Product tag strings contain normalized tag names used as managed natural-key references.

Protovalidate annotations enforce required domain facts, UUIDv7 and GTIN validity, required positive Product item sizes and units, normalized tag shape, positive nonzero Offer prices, valid availability, observation time, and supplied address/location bounds. Use item size `1` with measurement unit `EACH` when no physical measurement is known. Generated constructors and parsers do not invoke these rules automatically. API, retailer-ingestion, and persistence boundaries must run a Protovalidate validator before accepting a message. Protobuf-ES also generates `ProductValid`, `OfferValid`, and corresponding Valid types for every message. A successful validator result returns the Valid type, where required message fields such as `ProductValid.itemSize`, `OfferValid.price`, and `OfferValid.observedAt` are non-optional; downstream code should retain this validated type rather than repeatedly checking the ordinary decoded shape.

See [generation decision](docs/decisions/0006-protobuf-generation.md), [domain conventions](docs/decisions/0007-foundational-domain-values.md), [Product and Offer refinement](docs/decisions/0012-product-and-offer-schema-refinement.md), [domain validation](docs/decisions/0013-protobuf-domain-validation.md), and [Google common types decision](docs/decisions/0008-google-common-types.md), which supersedes the original custom value definitions. See also the [foundation history](docs/history/2026-09-07-protobuf-foundation.md), [schema review](docs/history/2026-09-11-product-offer-schema-review.md), and [Google types follow-up](docs/history/2026-09-07-google-common-types.md).

## Numeric utility lint boundary

Use `Money.toNumber`, `Money.toString`, and `Decimal.toNumber` from `@carthound/core` for numeric conversion and display. The type-aware `carthound/no-raw-protobuf-numeric-fields` error prohibits reading Google's Money `units`/`nanos` and Decimal `value` outside their approved utility implementations. Identically named fields on unrelated types are allowed. See [the enforcement decision](docs/decisions/0011-numeric-field-lint.md) for exact exemptions and limitations.

Local rule tooling lives in `packages/eslint`, with TypeScript 6 matching the shared lint parser; applications continue using TypeScript 7. Run its tests with `npm test -- packages/eslint/src`. The existing repository check includes those tests and the plugin's type check.
