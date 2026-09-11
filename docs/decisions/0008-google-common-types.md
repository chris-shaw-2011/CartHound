# 0008: Google common types through Buf dependencies

Status: Accepted
Date: 2026-09-07

## Originating instructions

The user requested using Google's provided types instead of custom equivalents, then explicitly requested pulling them through Buf instead of including their definitions in the repository. See the [chronological history](../history/2026-09-07-google-common-types.md).

## Decision

Use `google.type.Money`, `google.type.Decimal`, `google.type.PostalAddress`, and `google.type.LatLng` directly. Remove CartHound's equivalent messages and expose the upstream generated types/schemas through `@carthound/proto`, using the Google names without wrapper models or compatibility aliases. `google.protobuf.Timestamp` remains in use.

The four new types are Google common types, distinct from compiler-provided well-known types. Declare `buf.build/googleapis/googleapis` in `packages/proto/buf.yaml`. Commit `buf.lock`, which fixes the dependency's immutable commit and content digest. Buf retrieves and caches the schema dependency; no Google source definitions are vendored. Local generation enables `include_imports` so the required Google types are generated along with CartHound types. Well-known types remain supplied by the Protobuf-ES runtime rather than regenerated.

Keep the pinned local Buf and Protobuf-ES npm dependencies, erasable TypeScript options, ignored generated output, root postinstall, and clean-generation verification. Neither installation nor verification runs `buf dep update`; they consume the lock. Dependency upgrades are intentional maintenance via `npm exec --workspace @carthound/proto -- buf dep update`, followed by lock review and the full check. A cold Buf cache requires network access to the BSR. This is an accepted schema download dependency, not remote code generation.

## Exact numeric representations

Google Money has ISO-4217 `currency_code`, signed int64 `units` (bigint), and signed int32 `nanos` (integer billionths of a currency unit). For example, USD 5.99 is `{ currencyCode: "USD", units: 5n, nanos: 990000000 }`. Nanos must be between -999999999 and 999999999 and follow the sign rules in the upstream schema. Every permitted nanos integer is exactly representable by JavaScript Number, but monetary arithmetic must use integer/bigint operations, never a floating-point total such as `Number(units) + nanos / 1e9`. Currency minor-unit restrictions remain a future domain-validation concern.

Google Decimal holds an exact `value` string. It can represent values beyond the previous int64 coefficient limit. The existing core normalizer now parses decimal-string syntax and manipulates digits and a bigint exponent without converting the value through Number. Canonical zero is `"0"`, including Google's empty-string zero. Nonzero output is an integer significand without leading/trailing zeros, optionally followed by uppercase E and a signed nonzero exponent. For example, `12.37500` becomes `12375E-3`, and `1200` becomes `12E+2`. Equivalent inputs normalize identically; negative zero normalizes to zero. Invalid syntax is rejected. Exponents are not expanded into huge strings, and normalization imposes no additional fixed precision/scale limit. Future PostgreSQL NUMERIC persistence must explicitly enforce its supported bounds without silent rounding.

## Presence and address semantics

CartHound's own schemas remain Edition 2024 with explicit singular presence. Google's imported schemas retain upstream proto3 syntax and implicit scalar presence. An unknown price, measurement value, address, or coordinate pair is an absent containing message; a present Money with zero units/nanos is known zero. Within the imported messages, scalar zero/empty values cannot be distinguished from their defaults. The preceding explicit scalar presence rule still applies to CartHound fields such as Product GTIN and brand.

PostalAddress uses `region_code` for its country/region and supports international postal structure. Supply a known region code when constructing an address; unknown optional postal components use Google's default semantics. LatLng is a complete known WGS84 coordinate pair; latitude and longitude zero are valid coordinates. Do not construct a partial pair to represent a missing coordinate.

## Superseded choices and compatibility

This decision supersedes Decision 0007's custom Money, Decimal, Address, and GeoPoint definitions, the int64 coefficient bound, and explicit presence inside those values. It also supersedes Decision 0006's absence of external schema dependencies. The underlying decisions to use canonical Protobuf models, exact numbers, normalized relational PostgreSQL persistence, and native workspace TypeScript remain unchanged. Existing historical records retain the earlier choices and verification claims as history.

These are wire-contract changes: the new types do not share the old field encodings or identities. The foundation has no released/deployed contract or persisted data, so this task changes the initial model in place. Do not use old serialized foundation fixtures with the new schemas. A released contract would require a separate compatibility/migration design.

## Alternatives

Vendoring a minimal upstream source subset would avoid cold-cache network access, but the user specifically preferred a Buf dependency. Keeping custom types would preserve their original layouts but duplicate existing standard models. Remote generator plugins remain unnecessary; downloading schema dependencies works with the already pinned local generator.

## References

- [Google common schemas](https://github.com/googleapis/googleapis/tree/master/google/type)
- [Well-known versus common types](https://protobuf.dev/best-practices/dos-donts/)
- [Buf dependency management](https://buf.build/docs/bsr/module/dependency-management/)
- [Buf generation configuration](https://buf.build/docs/configuration/v2/buf-gen-yaml/)
- [Previous generation decision](0006-protobuf-generation.md)
- [Previous domain decision](0007-foundational-domain-values.md)
