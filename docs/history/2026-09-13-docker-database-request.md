# 2026-09-13: Docker/database infrastructure request

Implement CartHound's initial Docker/database infrastructure.

Read `AGENTS.md`, the current repository, all persistence decision records, and relevant history before making changes. Preserve the existing architecture rather than redesigning persistence or application services.

The PostgreSQL persistence layer is already implemented and pushed. This task is infrastructure around that implementation.

## Goals

Create one root `compose.yaml` that supports:

* an optional local PostgreSQL database running in Docker
* an external PostgreSQL database not hosted by Docker
* running database migrations against either database
* reproducibly running the existing PostgreSQL integration test against a disposable Docker PostgreSQL instance

Docker must not become an architectural requirement for CartHound.

These deployment combinations must remain possible:

* CartHound in Docker + PostgreSQL in Docker
* CartHound in Docker + external PostgreSQL
* CartHound outside Docker + PostgreSQL in Docker
* CartHound outside Docker + external PostgreSQL

Do not build separate persistence implementations for these cases.

All application/database tooling must connect using the same normal PostgreSQL interface.

## Scope

Implement:

* one root `compose.yaml`
* optional local PostgreSQL service
* persistent development PostgreSQL storage
* PostgreSQL health check
* database migration runner
* database readiness/retry handling where appropriate
* disposable Docker-backed PostgreSQL integration-test workflow
* environment-variable examples/documentation
* convenient npm scripts for Docker/database operations
* appropriate `.dockerignore`
* documentation and architecture/history records required by `AGENTS.md`

Do NOT yet containerize:

* `apps/api`
* `apps/web`
* `apps/worker`

Those applications still contain placeholder/minimal behavior and will be containerized when they have meaningful runtime behavior.

Do not implement retailer integrations or application features in this task.

## Node version strategy

Docker should target the latest stable/current Node release rather than permanently pinning CartHound to Node 26.

Use the official Node image's current stable line, based on Debian Bookworm slim, equivalent to:

`node:current-bookworm-slim`

Verify the current official image/tag before implementation.

Do not use Node LTS merely because it is LTS; the project explicitly wants the current stable Node release.

The repository's `.node-version` should continue recording the Node major/version against which the repository itself has actually been validated.

Do not silently change `.node-version` merely because the moving Docker `current` tag eventually advances. A repository Node-version upgrade should remain an intentional change with the normal test suite run against it.

Document this distinction:

* Docker runtime/build base tracks current stable Node
* repository `.node-version` records the currently validated Node version

## PostgreSQL target

Use the currently supported PostgreSQL 18 stable line.

The existing persistence implementation currently targets PostgreSQL 18.6 and relies on PostgreSQL 18 behavior.

Verify the currently available stable PostgreSQL 18 patch release before choosing the image tag.

Prefer an explicit PostgreSQL image tag such as:

`postgres:18.6-bookworm`

or the newer stable 18.x Bookworm patch if one exists at implementation time.

Do not use:

* `postgres:latest`
* PostgreSQL 19 prereleases
* Alpine PostgreSQL images

The persistence model assumes:

* PostgreSQL 18
* UTF-8 server encoding
* standard 8192-byte PostgreSQL block/page size
* `pg_trgm`

Those compatibility requirements already exist because canonical Proto validation includes persistence-induced index-size constraints.

## One root Compose file

Use one root:

`compose.yaml`

Do not create separate development and production Compose files at this stage.

Use a Compose profile for the optional Docker-hosted PostgreSQL service.

Use a profile equivalent to:

`local-db`

The PostgreSQL service should not start by default merely because some other database-oriented Compose task is invoked.

Example intended usage:

`docker compose --profile local-db up -d postgres`

The exact service names/scripts are implementation judgment, but keep them straightforward.

## Optional local PostgreSQL service

Create a PostgreSQL service suitable for local development.

Requirements:

* explicit PostgreSQL 18 Bookworm image
* named persistent volume
* appropriate PostgreSQL 18 data-volume mount location
* UTF-8 database
* standard image defaults compatible with the existing 8 KiB page-size assumption
* health check using PostgreSQL tooling such as `pg_isready`
* restart policy appropriate for a local persistent service
* initialization settings supplied through environment variables
* no hardcoded secrets

Publish PostgreSQL only to loopback for host development, not to all LAN interfaces.

For example:

`127.0.0.1:5432:5432`

unless an existing repository/environment convention justifies another host port.

Do not expose PostgreSQL publicly.

Enable PostgreSQL data checksums during initialization if supported cleanly by the current official image.

Because initialization flags only affect a newly created data directory, document that changing initialization options later does not rewrite an existing database volume.

## PostgreSQL persistent volume

Use a named Compose volume.

Be aware of the PostgreSQL 18 official-image data-layout change.

Verify the official PostgreSQL image documentation and mount the persistent volume at the correct PostgreSQL 18 location rather than blindly using legacy `/var/lib/postgresql/data` instructions.

Do not bind-mount database files into the repository.

## External PostgreSQL support

The Docker-hosted PostgreSQL service is optional.

CartHound database consumers must not know or care whether PostgreSQL is:

* the Compose `postgres` service
* another container
* a VM
* a physical server
* a managed/external PostgreSQL server

Use:

`DATABASE_URL`

as the canonical application/database-tool connection setting.

Examples:

Host process using Docker PostgreSQL:

`postgresql://...@127.0.0.1:5432/carthound`

Compose process using Docker PostgreSQL:

`postgresql://...@postgres:5432/carthound`

External PostgreSQL:

`postgresql://...@database.example.internal:5432/carthound`

Do not implement detection of "Docker database" versus "external database."

Do not build separate code paths.

## Configuration separation

Keep optional Docker PostgreSQL initialization configuration separate from CartHound connection configuration.

Docker database initialization may use settings equivalent to:

* `CARTHOUND_POSTGRES_USER`
* `CARTHOUND_POSTGRES_PASSWORD`
* `CARTHOUND_POSTGRES_DB`

or suitably named equivalents.

These configure the optional PostgreSQL container only.

CartHound/database tooling uses:

* `DATABASE_URL`

Do not make the application construct `DATABASE_URL` from Docker-specific environment variables.

Provide a committed `.env.example` containing safe placeholders/documentation only.

Do not commit credentials.

Respect the repository's existing `.env` ignore behavior.

## Migration runner

Implement a proper database migration runner using the existing committed Drizzle migrations.

The migration runner must:

* accept `DATABASE_URL`
* connect through `pg`
* use the existing migration files under `packages/persistence/migrations`
* use Drizzle's migration facilities where appropriate
* be safe to run repeatedly
* apply only migrations that have not already been applied
* exit successfully when the database is already current
* fail clearly when migration fails
* close the connection/pool cleanly

Do not use `/docker-entrypoint-initdb.d` as the migration system.

That mechanism only runs when PostgreSQL initializes an empty data directory and therefore cannot upgrade an existing CartHound database.

The same migration command must work against:

* the optional Compose PostgreSQL
* an external PostgreSQL database

## Database readiness

Do not create a hard Compose dependency from the migration service to the optional `postgres` service that would make external PostgreSQL awkward.

Instead, the migration runner should handle short-lived database unavailability itself.

Implement a bounded database connection/retry strategy appropriate for startup.

It should:

* retry connection failures for a reasonable bounded period
* succeed immediately when the database is already available
* eventually fail with a useful error rather than retry forever

Keep this simple.

Do not build a general retry framework.

## PostgreSQL compatibility checks

Since external PostgreSQL is explicitly supported, database tooling should verify required server properties where appropriate.

At minimum consider checking:

* PostgreSQL major version 18
* supported stable patch level assumptions where relevant
* UTF-8 server encoding
* 8192-byte block size

The existing persistence integration harness already verifies these assumptions.

Avoid duplicating compatibility logic unnecessarily; share or extract a small helper if that produces cleaner code.

Do not reject a newer PostgreSQL 18 patch release merely because the original implementation was written against 18.6.

Do reject an incompatible PostgreSQL major/page-size/encoding where persistence assumptions would no longer hold.

## pg_trgm

CartHound requires `pg_trgm` for tag autocomplete indexing.

The existing migration creates the extension.

Keep that migration behavior.

For external PostgreSQL installations, document that the database migration user must either:

* have permission to create `pg_trgm`
* or have a DBA install/enable it for the CartHound database first

Do not weaken the persistence design merely to support an external account that cannot provide the required extension.

## Migration container

Provide a one-shot Compose migration service.

It should use the Node current stable Bookworm-slim base.

The service/container must have everything needed to:

* install/use the workspace dependencies
* generate the uncommitted Protobuf TypeScript
* execute the persistence migration runner

Remember:

`packages/proto/src/gen/` is intentionally not committed.

A container built from a clean checkout must therefore generate the required Protobuf output during build/setup.

Preserve the npm workspace layout and symlink behavior required by the existing Node native TypeScript architecture.

Do not introduce TypeScript transpilation merely for Docker.

Do not copy generated Protobuf output into Git.

Do not include credentials in the image.

## Docker build design

Use a root Dockerfile or another simple repository-level Docker build arrangement suitable for the migration/test tooling.

Keep it simple.

A multi-stage build is appropriate if it materially reduces the final image, but do not create complex production-image machinery for placeholder applications.

Use `.dockerignore` to exclude unnecessary data such as:

* `.git`
* local `node_modules`
* coverage
* environment files containing secrets
* local build/cache files
* database data

Do not accidentally exclude files required for npm workspaces, migrations, Buf generation, or generated Proto setup.

## Disposable PostgreSQL integration testing

The existing command:

`npm run persistence:test:postgres`

already accepts:

`CARTHOUND_TEST_DATABASE_URL`

and exercises the real PostgreSQL persistence implementation.

Add Docker tooling that makes this easy and reproducible.

The Docker-backed test workflow should:

1. start a fresh/disposable PostgreSQL 18 instance
2. wait until it is ready
3. run the existing persistence integration harness against it
4. propagate the test exit status
5. clean up the disposable database/container afterward

Do not reuse the normal persistent development database for integration tests.

Do not use the named development database volume for this test.

Prefer ephemeral storage, such as a disposable anonymous volume or tmpfs, when practical.

The test must exercise the actual committed migrations rather than constructing schema through `drizzle push`.

Do not rewrite the existing live integration test into a Docker-specific implementation.

Docker should supply the environment; the existing test remains the persistence test.

## Normal repository checks

Do not make ordinary:

`npm run check`

require Docker or a live PostgreSQL server.

The current architecture deliberately allows:

* Proto checks
* persistence contract tests
* migration-drift checks
* lint
* build/type checks
* unit tests

without external infrastructure.

Keep Docker-backed PostgreSQL testing explicit.

A developer/CI environment can choose to run the Docker integration test in addition to `npm run check`.

## Root commands

Add concise root npm commands for the common workflows.

Use names equivalent to:

* `docker:db:up`
* `docker:db:down`
* `docker:migrate`
* `docker:test:persistence`
* `docker:db:reset`

Exact names are implementation judgment, but they should be obvious.

The reset command must be clearly destructive and remove the local PostgreSQL volume.

Do not make ordinary `docker:db:down` delete persisted data.

The normal developer workflow should be easy to understand.

For example, conceptually:

Start local database:

`npm run docker:db:up`

Apply migrations:

`npm run docker:migrate`

Stop database while retaining data:

`npm run docker:db:down`

Run disposable integration test:

`npm run docker:test:persistence`

Destroy local development database:

`npm run docker:db:reset`

Do not silently destroy data.

## Host-side migration support

Docker must not be required to run migrations against an external PostgreSQL server.

Expose a normal repository/npm migration command that can run directly on the host with `DATABASE_URL`.

For example, conceptually:

`DATABASE_URL=... npm run persistence:migrate`

Then `docker:migrate` may simply invoke the same underlying behavior inside the migration container.

There must be one migration implementation, not separate Docker and host migration logic.

## Security

Do not commit:

* PostgreSQL passwords
* external database credentials
* connection URLs containing real credentials

Do not bake secrets into Docker images.

Use runtime environment variables.

Do not publish PostgreSQL beyond loopback in the local Compose setup.

Do not add TLS configuration for external PostgreSQL unless required by current code; `DATABASE_URL` should remain able to carry normal PostgreSQL SSL settings supported by `pg`.

Do not introduce a secret-management system in this task.

## Docker health behavior

The optional local PostgreSQL service should expose a meaningful healthcheck.

The migration runner itself should not rely solely on Compose health state because it must also work against external servers.

The migration process should perform its own actual database connectivity/readiness check.

## Application containers are deferred

Do not containerize API, worker, or web yet.

Do not create placeholder images simply to make Compose look complete.

When those applications gain meaningful runtime behavior, their eventual startup dependency will conceptually be:

`database reachable -> migrations successful -> application starts`

but implementing those containers belongs to a future task.

## Persistence architecture must remain unchanged

Do not redesign:

* Product tag storage
* tag projection
* Offer tables
* persistence mappers
* Proto validation
* current migration history

unless Docker integration uncovers an actual defect.

If a genuine persistence bug is discovered:

1. document it
2. make the smallest appropriate fix
3. preserve Proto as authoritative
4. add/adjust tests
5. do not silently work around it in Docker

## Documentation/history

Follow `AGENTS.md` completely.

Record the material user instructions and resulting implementation in the appropriate history document.

Create an architectural decision record for Docker/runtime/database infrastructure if warranted.

At minimum document:

* one root `compose.yaml`
* Docker is optional infrastructure, not an application requirement
* both Docker-hosted and external PostgreSQL are first-class supported configurations
* `DATABASE_URL` is the canonical database connection configuration
* optional local database profile
* PostgreSQL 18 stable target
* current stable Node Docker target
* distinction between Docker's moving Node current tag and repository `.node-version`
* migration runner is independent of where PostgreSQL runs
* migrations do not use `docker-entrypoint-initdb.d`
* local database persists through a named volume
* integration database is disposable
* ordinary `npm run check` remains Docker/database independent
* `pg_trgm` external-server requirement
* PostgreSQL encoding/page-size compatibility requirement
* application containerization remains deferred

Do not rewrite historical decisions to erase earlier architecture.

## Verification

Before considering the task complete, verify as much as possible locally.

At minimum validate:

* `npm run check`
* Compose configuration parses successfully
* local PostgreSQL can start
* local PostgreSQL healthcheck succeeds
* migration runner applies all committed migrations
* running migration runner again succeeds without reapplying migrations
* host migration command and Docker migration command use the same underlying migration logic
* local database survives a normal down/up cycle
* destructive reset actually removes the database volume
* disposable PostgreSQL integration test runs the existing persistence test successfully
* disposable test environment is cleaned up afterward
* external-PostgreSQL configuration requires no Compose PostgreSQL service
* generated Protobuf output remains untracked
* Git is not dirtied by normal Docker/test operation
* no credentials are committed

If testing against a truly external PostgreSQL server is not available, verify the configuration path structurally and ensure nothing in the migration implementation depends on the Compose PostgreSQL service name.

## Completion criteria

The task is complete when:

* one root `compose.yaml` exists
* optional `local-db` PostgreSQL profile exists
* local PostgreSQL uses a persistent named volume
* PostgreSQL is exposed only on loopback
* health checking exists
* external PostgreSQL is fully supported through `DATABASE_URL`
* the migration implementation works independently of Docker
* a one-shot Docker migration service uses that same implementation
* bounded database readiness/retry behavior exists
* current stable Node is used for Docker tooling
* PostgreSQL uses the stable PostgreSQL 18 line
* `pg_trgm` requirements are handled/documented
* disposable Docker-backed persistence testing exists
* normal repository checks still require neither Docker nor PostgreSQL
* root convenience commands are documented
* no placeholder application containers were added
* `npm run check` passes
* Docker-backed persistence integration test passes
* architecture/history documentation is updated
