# CartHound

CartHound is a self-hosted grocery price comparison application. This repository currently contains the initial TypeScript monorepo scaffold; domain models, persistence, and retailer integrations will be added separately.

## Requirements

- Node.js 26 or newer
- npm 11 or newer

## Commands

```sh
npm install
npm run check
```

Package installation requires a `GITHUB_TOKEN` that can read GitHub Packages, as described in `.npmrc`.

`npm run check` verifies formatting and lint rules, every workspace build, and the repository test suite.

Individual commands are also available:

```sh
npm run build
npm test
npm run lint
npm run knip
npm run sherif
npm run format
```

Run the web development server with `npm run dev --workspace @carthound/web`.

The API and worker run TypeScript directly with Node.js type stripping:

```sh
npm start --workspace @carthound/api
npm start --workspace @carthound/worker
```

All apps declare dependencies on `@carthound/core`, `@carthound/proto`, and `@carthound/retailers`. Placeholder imports exercise those connections until real exports are introduced.

Backend and shared-package build commands only type-check; packages export their TypeScript sources directly. Node resolves npm workspace symlinks to real `packages/*` paths and strips types there. Only the web app produces a bundled build.

Deploy the workspace directories with their npm links intact; do not copy these TypeScript packages into physical `node_modules` directories or enable `--preserve-symlinks`. Relative backend/package imports must use `.ts` extensions and erasable syntax. Future Protobuf generation must satisfy these constraints. Browser imports must exclude retailer secrets and Node-only implementations.
