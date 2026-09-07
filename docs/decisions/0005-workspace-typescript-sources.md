# 0005: Execute workspace TypeScript sources directly

Status: Accepted
Date: 2026-09-07

## Context and decision

The user requested app-to-package dependencies and preferred native type stripping over package transpilation. All apps declare dependencies on core, proto, and retailers. All packages export TypeScript source directly; Node 26 executes it through built-in type stripping, and Vite bundles browser imports. TypeScript still checks all workspaces with no output. Plain compiler checks replace composite compilation because source imports need neither declaration artifacts nor build ordering.

This supersedes Decision 0004's assertion that workspace packages must emit JavaScript. Runtime verification showed that Node resolves npm workspace symlinks to real source paths outside `node_modules`. The previous conclusion incorrectly applied the physical dependency-directory restriction to symlinked workspaces.

## Consequences

There is no shared-package compilation prerequisite for starting the API or worker or bundling the web app. Runtime source must use erasable syntax and explicit relative `.ts` extensions. Type checking remains necessary: Node does not check types or downlevel JavaScript.

Deployments must retain the workspace directories and symlinks and avoid `--preserve-symlinks`. Publishing these packages or physically copying their TypeScript under `node_modules` would require reconsidering this decision. Protobuf generation must produce strip-compatible code; no generator is selected here. Browser imports from retailers must remain free of credentials and Node-only implementations.

## Alternatives

JavaScript plus declarations remains appropriate for published dependencies but adds unnecessary generated artifacts for these private workspace packages. Custom loaders and path aliases are unnecessary with normal npm links.

## References

- [Node TypeScript documentation](https://nodejs.org/api/typescript.html)
- [History and originating prompt](../history/2026-09-07-workspace-source-imports.md)
- [Previous tooling decision](0004-typescript-monorepo-tooling.md)
