# 2026-09-07: Generate the Protobuf package entrypoint

## User request

> I don't really like index.ts since it seems like it's something which should either be dynamic (export \* from "./gen/\*.ts) or if it can't be dynamic it should be generated automatically as part of the build process rather than being hard coded and comitted

## Assessment and decision

The request concerns packages/proto/src/index.ts, which manually listed generated model exports. JavaScript re-exports target a single module specifier; they do not expand filesystem globs. Preserve the @carthound/proto root import by generating its entrypoint after Buf generation instead.

Move the package export target to src/gen/index.ts inside the already-ignored generated directory. A small native TypeScript script discovers Protobuf-ES output files, sorts paths, and derives exports from the pinned generator's top-level const/type declarations. It excludes generated file descriptors and merges same-name enum values/types. There is no handwritten model or file list. This supersedes Decision 0006's handwritten public barrel choice; generation, clean checks, and installation now own the barrel along with all other generated TypeScript.

Include the generator script in the workspace type check. Keep runtime imports static and consumer imports unchanged. No runtime filesystem scanning, transpilation, or new package dependency is introduced. Core's handwritten entrypoint is outside this generated-model concern and remains unchanged.

## 2026-09-08 continuation

The user asked:

> looks like I hit my token limit, did you finish everything regarding my prior request?

Reported that implementation and generation had succeeded before interruption, but final validation and documentation were unfinished, then completed them.

Added a regression test running the generator with temporary output files. It verifies automatic discovery of newly added models, removal of obsolete exports, deterministic ordering/output, exclusion of generated file descriptors, and one export for an enum's combined value/type. The existing native Node import test now verifies resolution to src/gen/index.ts. Added [Decision 0009](../decisions/0009-generated-proto-entrypoint.md) and updated README.

Validation: removed the entire generated directory, ran npm install --offline with existing npm/Buf caches, and confirmed postinstall recreated both models and the entrypoint. Then npm run check passed clean generation, schema checks, ESLint, Knip, Sherif, all workspace type checks, the Vite build, and all 48 tests. This continuation tested installation with cached dependencies, not a new empty-cache installation. Git confirmed the generated entrypoint is ignored and no generated output is tracked; both staged and unstaged whitespace checks passed. No new dependencies, runtime generation, or commits were introduced.
