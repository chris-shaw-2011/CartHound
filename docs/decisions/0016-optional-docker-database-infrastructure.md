# 0016: Optional Docker database infrastructure

Status: Accepted  
Date: 2026-09-13

## Decision

One root `compose.yaml` supplies optional infrastructure. PostgreSQL and CartHound
processes may each run inside or outside Docker independently. All database tooling
uses `DATABASE_URL` through pg; Docker initialization variables configure only the
optional database container. No database-location detection or second persistence
implementation exists. API, web and worker containerization remains deferred.

CartHound supports external PostgreSQL servers, but not arbitrary PostgreSQL
schema selection. CartHound-owned objects live in the normal `public` schema, and
owned connections set `search_path=public` through pg's connection options so a
server or database-user default cannot redirect unqualified migrations or queries.
`DATABASE_URL` remains the only database-location/configuration input for this
concern; there is no schema environment variable or application setting.

The `local-db` profile starts PostgreSQL 18.6 Bookworm, publishing only
`127.0.0.1:5432`. A named volume mounts at `/var/lib/postgresql`, matching the
PostgreSQL 18 image layout. Initialization explicitly enables UTF-8 and checksums;
flags apply only to a new volume. Normal down retains storage; the explicitly
labelled reset command deletes it.

The tooling image uses `node:current-bookworm-slim`, tracking current stable Node.
`.node-version` independently records the repository's validated major (26);
advancing it remains an intentional upgrade with full checks. A moving image tag
requires periodic rebuilds and may eventually expose new runtime incompatibilities.
The image installs the committed npm lockfile and generates ignored Protobuf
TypeScript at build time. Workspace paths and symlinks remain intact; no TypeScript
transpilation is introduced. The existing GitHub Packages token is supplied as a
BuildKit secret, never a build argument or image environment variable.

Host and Compose migration commands execute the same native TypeScript runner.
Drizzle's node-postgres migrator applies committed SQL and tracks applied migrations
in its migration journal. Repeated execution succeeds when current. Run one migration
job at a time. No `/docker-entrypoint-initdb.d` migration mechanism or dependency on
the optional Compose database exists. Connectivity probes retry for approximately
60 seconds (individual attempts bounded to five seconds), then fail. Schema errors
are not retried. Connections close on success and failure.

Migration and integration tooling share a small compatibility check: PostgreSQL
18.6 or newer stable 18.x, UTF8 and standard 8192-byte blocks. Newer major versions
require explicit validation of persistence assumptions. Existing migrations create
`pg_trgm`; external migration users need permission to create it or a DBA must
install it in the target database first. Normal pg connection URL SSL settings remain
available.

Disposable integration testing uses the same Compose file with a unique project,
a separate PostgreSQL service, tmpfs storage, generated temporary credentials and
no host port. It waits for health, runs the existing integration harness against
committed migrations, propagates failure, and removes containers/network/volumes on
exit or handled interruption. Ordinary `npm run check` remains Docker/database independent.

## Related records and verified sources

- [Infrastructure history and request](../history/2026-09-13-docker-database.md)
- [Persistence foundation](0014-postgresql-persistence-foundation.md)
- [Persistence value assumptions](0015-persistence-value-representation.md)
- [Official Node tags](https://raw.githubusercontent.com/docker-library/official-images/master/library/node): current Bookworm slim maps to 26.8.2 on verification date.
- [Official PostgreSQL tags](https://raw.githubusercontent.com/docker-library/official-images/master/library/postgres): 18.6-bookworm available.
- [PostgreSQL release archive](https://www.postgresql.org/docs/release/): 18.6 is the current stable 18.x patch.
- [Official PostgreSQL image](https://hub.docker.com/_/postgres): PostgreSQL 18 volume layout and initialization settings.
