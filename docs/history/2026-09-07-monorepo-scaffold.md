# 2026-09-07: Initial monorepo scaffold

## User request

> Scaffold the CartHound monorepo according to `AGENTS.md`.
>
> Create only the basic project structure and development tooling:
>
> - `apps/web`
> - `apps/api`
> - `apps/worker`
> - `packages/proto`
> - `packages/core`
> - `packages/retailers`
>
> Use a TypeScript monorepo with shared configuration and package management.
>
> Requirements:
>
> - Choose an appropriate modern monorepo/package-manager setup.
> - Configure TypeScript consistently across packages.
> - Each package/app should build successfully.
> - Add basic linting and formatting.
> - Add a root command that builds/tests the whole repository.
> - Add minimal placeholder entrypoints only where necessary to prove everything works.
> - Do not design domain models yet.
> - Do not create database schemas yet.
> - Do not implement retailer adapters yet.
> - Follow the development-history requirements in `AGENTS.md`.
> - If a tooling choice represents a meaningful long-term project decision, document it appropriately.
>
> When finished, summarize what was created and any decisions that need my review.

## Initial assessment

The repository contained `AGENTS.md`, the license, and three existing architectural decision records. It had no package manifests, application source, or uncommitted changes.

The initial implementation direction was npm workspaces, a shared strict TypeScript configuration, Vite for the React build, ESLint flat configuration, Prettier, and Vitest. npm workspaces were considered sufficient without adding Turborepo or Nx before a meaningful task graph exists.

No domain, persistence, retailer, or Protobuf contract design was authorized or introduced.

## User follow-up

> for lint I want it to use my own package: [https://github.com/chris-shaw-2011/lint](https://github.com/chris-shaw-2011/lint) more information on how to implement it in the readme of that repo

## Follow-up assessment and decisions

The package repository README and current package metadata were inspected. Version 1.3.0 exposes a React ESLint preset at `@chris-shaw-2011/lint/react`, installs the lint toolchain through its dependency graph, requires GitHub Packages authentication, and requires Node.js 24/npm 11.

The preliminary generic ESLint configuration was replaced before completion. The repository now imports the shared React preset directly. `AGENTS.md` is narrowly ignored because the shared Markdown rules reject its pre-existing `#IMPORTANT` heading, and changing repository instructions solely for lint was out of scope.

The repository `.npmrc` contains only the scoped registry and an environment-variable reference; no token or credential is stored.

A preliminary Prettier setup used tabs, double quotes, and no semicolons to approximate the shared package's style. Aggregate verification showed that Prettier still added arrow-function parentheses and removed TypeScript member delimiters that the shared rules reject. Prettier was therefore removed, and the shared ESLint configuration's fix mode became the single formatting authority exposed through `npm run format`.

These tooling choices are recorded in [Decision 0004](../decisions/0004-typescript-monorepo-tooling.md).

## Assumptions and deferred choices

The API and worker are intentionally empty buildable modules rather than invented runnable services. Docker development and production files were deferred until those applications have real startup behavior to containerize. The Protobuf compiler and code-generation choice was also deferred until the first contract is designed. These deferrals avoid establishing runtime and schema conventions beyond this scaffold request.

## Repository changes

- Added npm workspace management for `apps/*` and `packages/*` with one lockfile.
- Added shared strict TypeScript compiler options and environment-specific workspace configurations.
- Added the six requested workspaces. Non-web workspaces contain only empty module entrypoints; the web workspace contains the minimum React root required for a Vite production build.
- Added shared lint integration, an ESLint-backed formatting command, ignore files, and editor settings.
- Added root build, test, lint, format, and aggregate `check` commands.
- Added a scaffold test that verifies every required workspace exposes a build command.
- Added setup and command documentation in the root README.

## Validation

The first aggregate check caught and prevented the conflicting Prettier output described above. After consolidating formatting under the shared lint package, the completed scaffold was validated with `npm run check`, which runs shared formatting/lint rules, all six workspace builds, and the Vitest suite. All checks passed. The Vite production build completed successfully, and the scaffold suite ran six passing cases.

Dependency installation reported zero known vulnerabilities.

## TypeScript target follow-up

The user asked:

> why
>
> ```json
> "target": "ES2022",
> ```
>
> I prefer this project to target latest whenever possible, similar question as to why we're not using typescript 7

`ES2022` had been selected as a conservative stable output baseline rather than because of an application constraint. The npm registry was rechecked and showed TypeScript 7.0.2 as the current stable release. The project compiler was upgraded from TypeScript 6.0.3 to 7.0.2, `target` was changed to `ESNext`, and the web workspace's ECMAScript library baseline was changed to `ESNext`.

The shared lint package continues to use its bundled TypeScript 6 runtime. Its documented setup explicitly separates that internal lint runtime from a consumer project's TypeScript 7 compiler.

## Backend type-stripping follow-up

The user said:

> I also want to configure node so rather than transpiling we're using type stripping for anything that's backend

The current Node.js 24 documentation was checked before implementation. It recommends `noEmit`, `ESNext`, `NodeNext`, `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`, and explicit TypeScript file extensions for native type-stripping projects.

A shared `tsconfig.backend.json` now applies the strip-compatible compiler rules to the API and worker. Both applications execute their `.ts` entrypoints directly with Node.js for start and watch-mode development, while their build commands type-check without emitting JavaScript. The repository test suite executes both TypeScript entrypoints using the active Node binary to verify that the runtime path works.

Shared workspace packages continue to emit JavaScript and declarations because Node.js refuses to type-strip TypeScript dependencies under `node_modules`. This preserves normal npm workspace package boundaries rather than routing backend imports through unsupported TypeScript dependency execution.

## Node.js version follow-up

The user said:

> also need to be targeting node 26 instead of 24

CartHound's engine requirement was raised to Node.js 26, `.node-version` was added for version-manager discovery, and the project-level Node.js type definitions were moved to the Node.js 26 release line. npm 11 remains the minimum package-manager version. The full repository check was rerun with Node.js 26.8.1.

## Knip and Sherif follow-up

The user said:

> also need to implement knip and sherif from my lint package

The installed `@chris-shaw-2011/lint` README and exported Knip configuration helpers were inspected. A root `knip.config.ts` now applies the shared preset to the repository root, all application workspaces, and all package workspaces. Package entrypoints are explicitly included because the scaffold packages currently expose generated `dist` paths while Knip analyzes their TypeScript sources.

Root `knip` and `sherif` scripts use the binaries bundled by the shared lint package. Both were added to the aggregate `check` command so workspace consistency, unused files, and dependency declarations are continuously validated alongside lint, builds, and tests.

Knip passed with the shared workspace configuration. Sherif's first run reported that the root manifest needed a concrete package-manager version in addition to its npm engine range. The root now records `npm@11.19.0`, matching the npm version used to create and update the lockfile.
