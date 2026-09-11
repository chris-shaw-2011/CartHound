# 2026-09-10: Enforce canonical numeric utilities with typed lint

## User request

> Implement a custom type-aware ESLint rule that enforces use of CartHound's canonical `Money` and `Decimal` utilities.
>
> Before changing code, inspect:
>
> - current ESLint configuration and version
> - `typescript-eslint` setup
> - generated protobuf types
> - the existing Money and Decimal utility implementation
> - repository conventions
> - AGENTS.md and relevant decision/history documentation
>
> Remember that eslint itself is coming from my personal @chris-shaw-2011/lint package. If you need to know how that's set up you can see the code in ../lint

The user required prohibiting reads of Money.units, Money.nanos, and Decimal.value specifically on google.type.Money/Decimal, identified through TypeScript information such as the generated $typeName literal. Do not globally prohibit these property names. Handle direct/nested values, unions, nullable/optional values, and type/variable aliases. Utilities and legitimate infrastructure may have only narrowly justified exemptions.

Requested actionable diagnostics direct callers to Money.toNumber/Money.toString or Decimal.toNumber for comparison/display. Detect raw field access, not conversion formulas. Test rejected fields/aliases/optional types, unrelated allowed fields, actual approved utilities, and existing-project compatibility. Enable as an error in normal lint, run rule tests/lint/type checks/existing tests, and replace application violations where appropriate. Do not edit generated files.

Document the implementation-detail boundary, centralized conversion, and protection against duplicate conversion logic. Completion must report changed files, rule name/type detection, union/optional handling, exemptions, test coverage/results, and weaknesses or deliberate escape hatches.

## Inspection and implementation plan

Read AGENTS.md and the prior numeric decisions/history, generated Google definitions, utility implementations/tests, repository config, and ../lint source, README, test conventions, and launcher. Installed versions are shared lint 1.3.0, ESLint 10.10.0, typescript-eslint 8.70.0, lint TypeScript 6.0.3, and application TypeScript 7.0.2. The shared preset uses projectService for typed source and intentionally disables it for configuration files. No CartHound custom-rule testing infrastructure existed. Existing worktree changes belong to preceding tasks and remain preserved.

Plan: use a private local lint workspace with matching typescript-eslint utils/RuleTester, identify the generated $typeName through the checker, cover ordinary/computed/destructured reads, enable the error in the shared-config extension, exempt exact utility files only for their matching type, preserve exact storage assertions with line-level exceptions, and verify rule/config integration plus the entire repository.

## Implementation decisions and discoveries

Added @carthound/eslint-rules in packages/eslint, linked only as root development tooling. This keeps TypeScript 6 and typescript-eslint peers separate from TypeScript 7 application compilation. ESLint remains the shared package's installed engine and CLI; the rule workspace declares the engine as a peer, not a replacement dependency. The typescript-eslint RuleTester runs in existing Vitest. A second suite exercises the actual project ESLint config and real utility source files.

The rule is carthound/no-raw-protobuf-numeric-fields. It uses getParserServices and the TypeChecker, visiting union constituents and constrained generics and examining each constituent's $typeName string literal. Intersections/aliases retain that property. Computed literal keys and literal-key unions, optional chaining, nested properties, and object destructuring are supported. Plain writes and deletes are allowed; compound assignments and increments read the field and are rejected. No autofix or formula recognizer is introduced.

The first tests exposed the parser's ts-api-utils resolving to the root TypeScript 7 package, whose native-compiler package does not supply the classic TypeScript runtime API expected there. Merely pinning the tester's TypeScript peer was insufficient because ts-api-utils had been hoisted. The final tooling workspace also declares ts-api-utils explicitly, with a root override constraining that package's TypeScript dependency to 6.0.3. An incremental stale lock resolution was refreshed; npm ls confirms both parser stacks use TypeScript 6 while the root compiler stays 7. No --force or legacy-peer-deps bypass was used. Sherif exempts only the intentional typescript@6.0.3 version difference, retaining other consistency checks.

The initial field visitor caught member access but missed assignment destructuring. A failing regression case prompted resolving the right-hand source type and nested pattern property types; those cases now pass. The shared lint preset's existing rule options required AST_NODE_TYPES comparisons, and the installed ts-api-utils API prefers unionConstituents over its deprecated alias.

Numeric raw-access allowances are exact paths: packages/core/src/money.ts allows only Money; packages/core/src/decimal.ts allows only Decimal, including its existing exact normalizer. Generated output retains its existing lint exclusion. Nine individual assertions in decimal.test.ts and proto/domain.test.ts receive explained eslint-disable-next-line directives because converting those values to Number would invalidate exactness tests. No test-directory exemption is used. All other existing raw reads belong to those approved implementations; there were no application conversion violations to rewrite.

The new rule follows the shared preset's configuration-file exclusions, where typed parser services are deliberately unavailable. In typed application code, missing services fail rather than silently degrading to property-name matching.

See [Decision 0011](../decisions/0011-numeric-field-lint.md).
