# 2026-09-07: Reuse Google common Protobuf types

## User request

> doesn't google provide well known proto types for some fo the things we've defined here? if so lets use those rather than defining our own

## Assessment and plan

Reviewed the existing foundation, accepted decisions, prior task history, and Google's official well-known/common-type documentation and schema sources. Google provides Money, Decimal, PostalAddress, and LatLng in google.type; these common types are separate from compiler-provided google.protobuf well-known types such as the already-used Timestamp.

The user follow-up authorizes replacing the four custom equivalents. Communicated before editing that this changes the earlier minor-unit Money, coefficient/scale Decimal, and inner explicit-presence choices: Google Money uses bigint whole units and bounded integer nanos, Decimal uses an exact string, and Google's unchanged proto3 scalar fields use implicit presence. Unknown whole values remain absent nested messages. Exact arithmetic, canonical Protobuf models, native TypeScript, local generation, and normalized future PostgreSQL persistence remain required.

Plan: pin and vendor only the four dependency-free official schemas and their Apache-2.0 license, import those types directly without wrapper models or compatibility aliases, adapt normalization and tests, append a superseding decision record, and verify clean generation and installation. Vendoring upstream source avoids a new runtime package or dependency on a remote schema registry during installation/generation. Generated TypeScript remains ignored output.

## User follow-up

> can't we reference those types from buf so we pull them rather than hard coding them into this project?

## Revised dependency decision

Confirmed Buf supports the requested dependency approach. The initial vendoring plan was an agent assumption, not a user requirement. Removed the four newly downloaded source files and license/provenance copy before completion. Use buf.build/googleapis/googleapis in buf.yaml with Buf's generated buf.lock to pin its commit and digest. include_imports generates only the required imported common types with the existing local Protobuf-ES plugin. Cold setup needs BSR access to download schemas; it does not use a remote generator. Keep prior history intact to record this correction.

## Final implementation and validation

Buf locked googleapis/googleapis at commit c17df5b2beca46928cc87d5656bd5343 with its content digest. CartHound imports the upstream Money, Decimal, PostalAddress, and LatLng definitions directly. Removed the four custom definitions; the final repository has no vendor directory. The local generator produces ten CartHound files and four Google files. The public package exports upstream type names and schemas; no substitute DTO or wrapper layer was introduced.

Updated exact Decimal normalization for Google's string grammar, including empty-string zero, negative zero, exponents, trailing zeros, values beyond int64 precision, and invalid input. Money tests use exact bigint units and bounded integer nanos. Presence tests retain unknown-versus-zero at the containing-message boundary and explicitly verify valid zero coordinates and upstream type identities. Updated README and added [Decision 0008](../decisions/0008-google-common-types.md) to supersede the affected earlier choices without rewriting those records.

Full npm run check passed on Node 26.8.1 and TypeScript 7.0.2: clean Buf generation, schema lint/format verification, ESLint, Knip, Sherif, all workspace type checks, Vite build, and 47 tests. A separate source copy had no node_modules, generated files, or pre-existing Buf cache. npm install fetched the locked BSR dependency and generated TypeScript through postinstall; the full check also passed there. Both package-lock.json and buf.lock remained byte-identical, as did all 14 generated outputs between checkouts. Generated code remains ignored/untracked, and no upstream source definitions remain in the repository. The already-recorded generator localStorage and npm allowScripts informational warnings remain non-blocking. Whitespace checks passed; no commit or pull request was created.
