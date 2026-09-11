# 0010: Explicit numeric conversion and currency formatting utilities

Status: Accepted
Date: 2026-09-10

The user explicitly requested Money.toNumber, Money.toString, and Decimal.toNumber operating on Google's generated Protobuf values. Expose these plain utility objects through @carthound/core, the existing home of shared value operations. They are not wrapper classes or replacement domain models.

Money.toNumber centralizes `Number(value.units) + value.nanos / 1_000_000_000`, including negative units/nanos according to Google's sign semantics. Money.toString calls Money.toNumber and uses built-in Intl.NumberFormat with currency style and the value's currency code. Its optional Intl.LocalesArgument uses the runtime locale when omitted. Decimal.toNumber centralizes Number(value.value). No arithmetic, validation framework, currency symbol tables, dependencies, prototype changes, or generated-code changes are introduced.

This is a user-authorized narrow exception to the prohibition on number conversion in Decision 0008 and AGENTS.md: callers may explicitly obtain a potentially rounded JavaScript number and format it. Canonical storage and wire values remain Google's exact Protobuf representation. These utilities do not guarantee exact arithmetic or lossless conversion; standard Number/Intl behavior applies, including NaN/Infinity for relevant Decimal inputs and Intl errors for invalid currency or locale inputs. The existing exact Decimal normalizer remains unchanged.

See [request and validation history](../history/2026-09-10-protobuf-numeric-utilities.md), [Google types decision](0008-google-common-types.md), and [earlier feasibility investigation](../history/2026-09-10-numeric-protobuf-ergonomics.md).
