# 2026-09-10: Protobuf numeric utility functions

## User instructions

> Implement only the protobuf utility functions for `google.type.Money` and `google.type.Decimal`.
>
> Before changing code, inspect the repository conventions and relevant AGENTS.md / decision documentation.
>
> Do not modify generated protobuf files.
>
> Create the project-appropriate utility API, preferably:
>
> ```ts
> Money.toNumber(value)
> Money.toString(value, locale?)
> Decimal.toNumber(value)
> ```

The user specifically required:

- Money.toNumber centralizes `Number(value.units) + value.nanos / 1_000_000_000`, supporting Google's negative-value semantics.
- Money.toString calls Money.toNumber, then built-in Intl.NumberFormat with `{ style: "currency", currency: value.currencyCode }`; use the appropriate optional Intl locale type and runtime default when omitted. No manual symbol mapping or currency-formatting package.
- Decimal.toNumber centralizes conversion of Google's decimal string into a JavaScript number.
- Focused tests for money zero, positive whole/fractional, negative values, zero units with negative nanos, USD/en-US, locale-specific EUR, JPY fraction digits, and positive/fractional/negative decimals.
- No custom ESLint rules, Protobuf redesign, wrappers, prototype patches, message decoration, or arithmetic APIs.
- Run formatter, type checker, and tests; update project history/decisions. Report changed files, public API, tests, commands/results, and any human decision required.

## Inspection and implementation

Read AGENTS.md, package scripts/source/tests, and relevant decisions 0005, 0008, and 0009 before editing. Existing changes from earlier tasks were present and preserved. Generated types remain in @carthound/proto; shared operations belong in @carthound/core.

Communicated the conflict with Decision 0008's explicit prohibition on this number conversion before implementing. The user's precise current request authorizes the narrow exception recorded in [Decision 0010](../decisions/0010-explicit-numeric-utilities.md). Canonical Protobuf storage remains exact; these opt-in outputs follow JavaScript Number precision and Intl formatting behavior. No further approval is needed.

Added Money as a plain utility object in money.ts. Added Decimal.toNumber beside the existing normalizer in decimal.ts, aliasing the imported Protobuf type to DecimalValue to avoid a name collision. Export both utility objects through the handwritten core entrypoint, whose domain-function exports are separate from the generated proto entrypoint. The existing normalization function and its behavior remain intact.

Added 18 focused cases: six Money conversions, USD/EUR/JPY formatting, default locale and Intl.Locale/list arguments, and seven Decimal conversions including negative, fractional, zero/empty, and exponent strings. Tests use generated messages and the public core exports. No generated schemas/files, dependencies, or existing configurations were edited.

## Validation and completion

Ran npm run format successfully. Ran npm run build --workspace @carthound/core (TypeScript noEmit) and npm test -- packages/core/src: 46 core cases passed. Then npm run lint, npm run knip, npm run sherif, npm run build, and npm test all passed, including all workspace type checks, Vite bundling, and 66 total tests across five files. Both git diff --check and git diff --cached --check passed. Generation was not rerun; generated files were not edited.

Task files: packages/core/src/money.ts, money.test.ts, decimal.ts, decimal.test.ts, index.ts, this history, and Decision 0010. No outstanding human decision or blocked work. No commit created.
