import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { checkCompatibility, connectWhenReady, DatabaseSetupError, postgresPoolConfig } from "./database.ts"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("Set DATABASE_URL to the PostgreSQL database to migrate")
const pool = new pg.Pool({ ...postgresPoolConfig(connectionString), connectionTimeoutMillis: 5000 })
try {
	const client = await connectWhenReady(pool)
	try {
		await checkCompatibility(client)
		await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) })
		process.stdout.write("Database migrations complete; database is current\n")
	}
	finally { client.release() }
}
catch (error) {
	// Driver/Drizzle errors can include SQL values or connection details.
	const code = error instanceof Error && "code" in error ? String(error.code) : undefined
	if (error instanceof DatabaseSetupError) process.stderr.write(`${error.message}\n`)
	process.stderr.write(`Database migration failed${code ? ` (${code})` : ""}. Verify server compatibility, connectivity and migration-user permissions (including pg_trgm).\n`)
	process.exitCode = 1
}
finally { await pool.end() }
