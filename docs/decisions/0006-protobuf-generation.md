# 0006: Reproducible native TypeScript Protobuf generation

Status: Accepted
Date: 2026-09-07

## Originating prompt

Implement the foundational Protobuf models using Edition 2024, local Buf and Protobuf-ES, uncommitted generated TypeScript, automatic installation setup, and clean generation before repository verification. Preserve Node 26, TypeScript 7, npm workspaces, and native type stripping.

## Decision and rationale

Canonical definitions live in `packages/proto/proto/carthound/v1/`, with one top-level message or enum per file. `carthound.v1` identifies the first domain contract version. Add compatible fields and enum values within v1; incompatible changes require deliberate versioning. Never reuse removed field/enum numbers or names; reserve both. Buf uses STANDARD lint and FILE breaking rules. A historical breaking-check baseline is deferred until there is a released contract to compare against.

Root development dependencies pin `@bufbuild/buf` to 1.72.0 and `@bufbuild/protoc-gen-es` to 2.14.1. The proto and core packages pin the runtime `@bufbuild/protobuf` to 2.14.1. The root lockfile pins transitive and platform dependencies. Buf invokes the locally installed `protoc-gen-es` through npm's binary path, without a remote generator or separate protoc installation. The standard Timestamp schema is available to Buf without a BSR dependency; generated code uses the runtime's well-known types.

Generation uses `target=ts`, `import_extension=ts`, and `erasable_syntax=true`. The last option is experimental in the pinned generator: it emits enum constant objects and type aliases instead of TypeScript enums. Generated code is checked with `erasableSyntaxOnly` and executed by Node in the tests. There is no TypeScript transpilation step for shared packages or backend applications. The browser compiler also allows `.ts` import extensions so it can consume those same sources; Vite retains its existing bundling role.

`packages/proto/src/gen/` is ignored build output. It is never hand edited or committed, including in history. The handwritten package entrypoint exports the intended message types, message schemas, enum objects/types, and enum schemas; it does not export generated file descriptors or codegen helpers. Consumers use Protobuf-ES runtime operations directly without a duplicate DTO layer.

## Lifecycle

Root `postinstall` runs `npm run proto:generate` after dependencies and workspace links are available. A normal development `npm install` supplies the local tools and generated files. Installs that deliberately disable lifecycle scripts require explicit generation; installs omitting development dependencies are not the build/setup workflow. Runtime startup never generates code. Deployment still preserves workspace paths and symlinks as required by Decision 0005 and must include previously generated output.

`npm run proto:check` removes generated output, runs Buf lint and format verification, then regenerates. It is the first step in `npm run check`, before the existing ESLint, Knip, Sherif, workspace type checks, Vite build, and tests. Explicit regeneration also uses Buf's `clean: true` to remove stale output after schema deletion. Verification does not compare generated files against Git. Successful regeneration and subsequent consumer checks establish that the committed inputs suffice.

Generated code is excluded from ESLint style checking but included in TypeScript checking. Knip ignores only the generator dependency that it cannot discover inside Buf's YAML; the tool is exercised during every aggregate check. Other existing checks remain enabled.

## Alternatives and consequences

Remote generators introduce a service dependency and were explicitly excluded. Committed generated files would create a second review artifact and were explicitly excluded. JavaScript/declaration generation and custom loaders would contradict the accepted native TypeScript architecture. npm scripts are sufficient; no task runner is added.

The experimental generator flag is a pinned compatibility dependency. Reassess it when upgrading Protobuf-ES, when changing the runtime/compiler baseline, or when publishing packages outside the workspace layout. Generation must run before consumer-only commands after a checkout or explicit clean; normal installation performs that setup automatically.

## References

- [Generator options](https://github.com/bufbuild/protobuf-es/blob/v2.14.1/packages/protoc-gen-es/README.md)
- [Buf generation configuration](https://buf.build/docs/configuration/v2/buf-gen-yaml/)
- [Protobuf Editions](https://protobuf.dev/programming-guides/editions/)
- [Protobuf file organization](https://protobuf.dev/best-practices/1-1-1/)
- [Node TypeScript execution](https://nodejs.org/api/typescript.html)
- [TypeScript erasable syntax](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html)
- [Canonical models](0001-protobuf-as-canonical-domain-models.md)
- [Workspace source imports](0005-workspace-typescript-sources.md)
- [Originating request and implementation history](../history/2026-09-07-protobuf-foundation.md)
