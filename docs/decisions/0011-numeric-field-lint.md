# 0011: Type-aware enforcement of numeric utility boundaries

Status: Accepted
Date: 2026-09-10

Money.units/nanos and Decimal.value are storage implementation details outside approved utility/infrastructure code. Conversion and display must use Money.toNumber, Money.toString, or Decimal.toNumber from @carthound/core. The user explicitly requested lint enforcement to prevent duplicated conversion logic and accidental dependence on the Protobuf representation. This adds enforcement to [Decision 0010](0010-explicit-numeric-utilities.md), superseding its earlier task-specific exclusion of custom lint rules.

Enable carthound/no-raw-protobuf-numeric-fields as an error in typed source through the existing shared ESLint preset. Identify google.type.Money and google.type.Decimal via the generated $typeName literal using typescript-eslint parser services and TypeScript's checker. Visit unions and generic constraints; nullable constituents do not hide a matching Protobuf member. Preserve normal flow narrowing so unrelated branches are allowed. Aliases and intersections remain recognizable while their discriminator is present.

Enforce ordinary/optional member reads, literal computed keys and key unions, and object destructuring. Compound writes count as reads; simple assignments and deletes do not. Construction and serialization remain supported. The rule neither recognizes conversion formulas nor adds automatic fixes.

Allow raw Money reads only in packages/core/src/money.ts and raw Decimal reads only in packages/core/src/decimal.ts. The latter also owns exact normalization, which cannot use rounded Number conversion. These are type-specific allowances, not rule-wide directory exclusions. Exact representation assertions may use documented line-level exceptions. Generated output remains excluded by the existing configuration. Configuration files follow the shared preset's deliberately untyped exclusions; ordinary typed source must provide parser services.

Use a private @carthound/eslint-rules workspace for the local plugin and standard typescript-eslint RuleTester tests. Match the shared lint runtime's TypeScript 6.0.3 and typescript-eslint 8.70.0, while application compilation remains TypeScript 7. ts-api-utils must resolve TypeScript 6; a scoped dependency override enforces this after observed hoisting to the incompatible native TypeScript 7 runtime. Sherif ignores only this deliberate TypeScript 6 version mismatch. ESLint continues to come from @chris-shaw-2011/lint. No application depends on the plugin.

This is architectural lint, not a security boundary. any/unknown casts or projections that erase $typeName cannot be reliably identified. Broad dynamic keys, reflection, Object.values/entries, and code stored in strings are not analyzed as direct named reads. Whole-object copies are allowed; subsequent field reads are checked while type identity survives. A structurally forged matching $typeName is indistinguishable from the generated identity. Explicit lint-disable comments and config changes remain deliberate escape hatches, with unused-disable checking retained. No global property-name restriction or weakened exactness test replaces type detection.

Revisit on generator, compiler, or lint-tool upgrades, or when a concrete infrastructure component requires another narrowly justified exemption. See the [request, discoveries, and validation history](../history/2026-09-10-numeric-field-lint.md).
