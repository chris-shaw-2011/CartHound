# 0004: TypeScript monorepo tooling

Status: Accepted  
Date: 2026-09-07

## Originating prompt

Scaffold the CartHound monorepo with shared TypeScript configuration, package management, linting, formatting, and repository-wide build and test commands. Use `@chris-shaw-2011/lint` according to its repository README.

## Context

CartHound needs six independently buildable TypeScript workspaces and a React web application. The scaffold should establish consistent development tooling without prematurely designing domain models, persistence, Protobuf schemas, or retailer integrations.

The repository does not yet have a complex task graph, remote build-cache requirement, or enough implementation to justify a dedicated monorepo orchestrator.

The shared lint package requires Node.js 24 or newer, npm 11 or newer, and installation through GitHub Packages.

## Decision

CartHound uses npm workspaces with a single root `package-lock.json`.

The root manifest records the concrete npm version used to maintain the lockfile through its `packageManager` field.

Native npm workspace scripts run builds across `apps/*` and `packages/*`. A dedicated task orchestrator is not included at this stage.

All workspaces extend a strict root TypeScript configuration. Node-oriented workspaces compile with NodeNext module semantics. The React web workspace uses bundler module resolution and is built with Vite.

The repository uses:

- `@chris-shaw-2011/lint/react` as its shared ESLint flat configuration
- the shared ESLint configuration's fix mode for code formatting
- the shared lint package's Knip preset for unused-code and dependency analysis
- the shared lint package's Sherif binary for workspace consistency checks
- Vitest for repository tests
- Node.js 26 and npm 11 as the minimum supported toolchain

Dependency ranges are recorded in package manifests and exact resolutions are committed in the npm lockfile.

CartHound's application compiler follows the latest stable TypeScript major and uses `ESNext` as its output target and standard-library baseline. The shared lint package retains its separately bundled TypeScript version for its linting internals.

## Rationale

npm workspaces provide package linking, dependency installation, lockfile management, and workspace script execution without another orchestration dependency. They are sufficient for the initial repository size and keep setup familiar to Node.js contributors.

A shared strict TypeScript base prevents compiler behavior from drifting while allowing the browser workspace to use the module resolution expected by Vite.

Vite provides a small conventional React build setup without committing CartHound to additional application architecture.

Using the owner's shared lint package centralizes established TypeScript and React rules rather than duplicating them locally.

Using its autofix behavior for formatting also keeps the lint package's stylistic rules authoritative. A separate Prettier setup was tested and removed because its arrow-parenthesis and TypeScript member-delimiter output conflicted with the shared rules.

## Alternatives considered

### pnpm workspaces

pnpm offers efficient storage and strict dependency resolution. It was not selected because npm workspaces already satisfy the current repository's needs and npm is required for the selected shared lint package workflow.

### Turborepo or Nx

Both can coordinate and cache large task graphs. Neither is warranted while the workspaces are small and have no cross-package build graph. A task orchestrator can be added later without changing the workspace layout.

### Independent TypeScript and ESLint configurations

Per-workspace configurations would allow maximum customization but create immediate duplication and increase the chance of inconsistent rules. Workspace-specific overrides remain possible when a demonstrated need appears.

## Consequences

- Contributors need Node.js 26 or newer and npm 11 or newer.
- Installing dependencies requires GitHub Packages read access for `@chris-shaw-2011/lint`.
- npm runs workspace builds serially and without remote caching.
- Browser and Node workspaces share strictness rules but use environment-appropriate module resolution.
- Formatting conventions follow the shared lint package and can be applied with `npm run format`.
- The Protobuf compiler and generation strategy remain deliberately undecided until actual contracts are introduced.
- Docker development and production definitions remain deferred until the applications have real runtime entrypoints to containerize.
- Compiler upgrades can advance the JavaScript syntax and standard-library APIs accepted by the project because `ESNext` follows the installed TypeScript version.

## Assumptions

- The project remains primarily TypeScript and React.
- The six initial workspaces remain manageable with native npm script orchestration.
- Contributors can authenticate to GitHub Packages.
- Vite remains suitable for the browser application when frontend implementation begins.

## Revisit when

Reconsider this decision when build times justify caching or parallel task orchestration, workspace dependency ordering becomes complex, npm workspace behavior becomes limiting, the runtime baseline must support Node.js versions older than the shared lint package permits, or `ESNext` begins accepting syntax or APIs unsupported by a CartHound deployment target.

## Amendment: Latest TypeScript and ECMAScript target

On 2026-09-07, the initial `ES2022` target and TypeScript 6 compiler pin were reconsidered after the user stated a preference for targeting the latest versions whenever possible.

The stable TypeScript release was 7.0.2. The compiler was upgraded to TypeScript 7 and the shared target and browser library baseline were changed to `ESNext`. `@chris-shaw-2011/lint` continues to use its bundled TypeScript 6 runtime internally, as supported by that package's documented consumer setup.

## Amendment: Native Node.js type stripping

On 2026-09-07, the user requested native Node.js type stripping instead of transpilation for backend applications.

The API and worker extend a shared backend TypeScript configuration using `noEmit`, `erasableSyntaxOnly`, `rewriteRelativeImportExtensions`, and `allowImportingTsExtensions`. Their production and development commands execute `.ts` entrypoints directly with Node.js. Their build commands are type checks and do not create JavaScript artifacts.

Shared packages continue to emit JavaScript. Node.js deliberately refuses to type-strip TypeScript files beneath `node_modules`, which is where npm workspace package imports are resolved. Keeping publishable library boundaries as JavaScript plus declarations avoids relying on unsupported dependency execution while application-owned backend entrypoints remain TypeScript-only.

## Amendment: Node.js 26 baseline

On 2026-09-07, the user raised CartHound's runtime target from Node.js 24 to Node.js 26.

The root engine requirement, version-manager file, and Node.js type definitions now target Node.js 26. The shared lint package's Node.js 24 minimum remains compatible but no longer defines CartHound's runtime baseline.

## Amendment: Knip and Sherif repository checks

On 2026-09-07, the user requested the Knip and Sherif tooling bundled by `@chris-shaw-2011/lint`.

The root Knip configuration uses the lint package's `createKnipConfig`, `rootWorkspaceConfig`, and `workspaceConfig` helpers across the repository root, `apps/*`, and `packages/*`. Sherif uses the package's bundled command without a duplicate direct dependency. Both checks are part of the aggregate `npm run check` command.

Sherif's initial run identified that the root manifest declared only an npm engine range. The accepted fix records `npm@11.19.0` in `packageManager` while retaining npm 11 as the supported minimum.

## Related

- `AGENTS.md`
- `package.json`
- `tsconfig.base.json`
- `eslint.config.ts`
- `docs/history/2026-09-07-monorepo-scaffold.md`
