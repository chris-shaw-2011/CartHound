# 0009: Generate the Protobuf package entrypoint

Status: Accepted
Date: 2026-09-08

The user requested automatic exports for generated Protobuf models instead of a committed, handwritten index. JavaScript re-exports do not support filesystem globs. The package therefore exports `src/gen/index.ts`, generated immediately after Buf by `scripts/generate-index.ts` and ignored with the rest of `src/gen/`.

The script discovers generated `_pb.ts` files, sorts their paths, and derives public symbols from the pinned Protobuf-ES generator's top-level const/type declarations. It excludes file descriptors and combines enum objects with their same-name types. There is no manually maintained list of model names or files. Generator upgrades must preserve these declaration conventions or update the script; normal consumer type checks and tests verify the resulting public API.

This supersedes Decision 0006's handwritten-barrel choice. Existing package-root imports remain unchanged. Installation, explicit regeneration, and clean repository checks all regenerate the entrypoint. Runtime loading remains ordinary static ESM, with no filesystem scanning or transpilation. No new dependency is required. Handwritten exports of domain functions in core remain outside this generated-model concern.

See the [originating request and validation history](../history/2026-09-07-generated-proto-entrypoint.md) and [original generation decision](0006-protobuf-generation.md).
