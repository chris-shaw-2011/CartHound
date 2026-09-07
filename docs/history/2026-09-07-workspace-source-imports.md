# 2026-09-07: Workspace source imports

## User request

> as part of this scaffolding I would like to set things up so all the apps already reference the packages so that when we need to use code from one of the packages the reference is already set up. while doing this you need to re-assess if it's actually the best course of action to use transpiling for packages over type stripping, if at all possible I would much prefer type stripping since that's where things are going and it reduces the number of moving parts and elimiates a build step

## Correction to the earlier assessment

The previous history and Decision 0004 asserted that npm workspace resolution prevented native type stripping. That assertion was incorrect for the current symlink layout. Node 26 resolves workspace links to real paths under `packages/*`, outside `node_modules`. Direct imports of all three TypeScript package entrypoints succeeded. The documented restriction applies to files physically resolved beneath `node_modules`.

## Changes and decisions

All three apps now declare all three packages as dependencies with matching local versions. Minimal imports in their entrypoints exercise the connections through both Node and Vite. Packages export `src/index.ts` directly and inherit the strip-compatible configuration. Their build scripts only type-check; composite build settings and declaration/source-map emit settings were removed. No domain exports or retailer implementations were added.

Deployment must preserve the workspace layout and normal realpath resolution. TypeScript package contents cannot be installed as physical copies under `node_modules`, and `--preserve-symlinks` is incompatible with this setup. The browser dependency on the currently empty retailer package does not authorize shipping secrets or Node-only adapter implementations. Protobuf generation remains deferred and must be assessed for erasable output when introduced.

See [Decision 0005](../decisions/0005-workspace-typescript-sources.md), which supersedes the package-emission portion of Decision 0004.

## Validation

Removed the twelve stale generated package files from the earlier scaffold build. With those artifacts absent, `npm run check` passed ESLint, Knip, Sherif, all workspace compiler checks, Vite production bundling, and eight tests. Existing backend entrypoint tests now exercise all three package imports through the actual Node process. Package output directories remained empty after verification. `npm ls` confirmed all nine app dependencies resolve to local workspace links. `git diff --check` passed. No deployment image or future generated Protobuf code was tested.
