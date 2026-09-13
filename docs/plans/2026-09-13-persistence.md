# PostgreSQL persistence implementation plan

The canonical model and Protovalidate own domain values; the database is a hand-designed relational projection. Read decisions 0001–0013, existing history, current schemas and numeric utilities. The initial working tree was clean.

1. Verify PostgreSQL 18 and stable Drizzle/pg releases and actual driver behavior.
2. Add canonical Decimal representability and microsecond Timestamp validation before database constraints. Preserve Decimal spelling as well as its exact numeric value. Address PostgreSQL text's inability to store NUL in canonical validation.
3. Add the native TypeScript persistence workspace, explicit Drizzle tables, lossless validated mappers, generated schema migration and custom tag projection SQL.
4. Add descriptor coverage, constraint/mapper tests, isolated migration-generation drift checks and a separately invoked PostgreSQL integration boundary without Docker.
5. Record superseding tag/persistence decisions, commands and limitations; run the complete existing verification workflow and inspect the diff.

The current request explicitly supersedes AGENTS.md's managed tags table requirement. Products own their tag arrays; the tag projection is derived. No retailer ingestion, RPC, runtime connection configuration or Docker implementation is authorized.
