import { setTimeout } from "node:timers/promises"
import type pg from "pg"

export class DatabaseSetupError extends Error {}

export function postgresPoolConfig(connectionString: string): pg.PoolConfig {
	const existingOptions = new URL(connectionString).searchParams.get("options")
	return {
		connectionString,
		options: [
			existingOptions,
			"-c search_path=public",
			"-c timezone=UTC",
			"-c datestyle=ISO,MDY",
		].filter(Boolean).join(" "),
	}
}

export async function checkCompatibility(client: pg.PoolClient) {
	const result = await client.query<{ version: string, encoding: string, block_size: string }>(
		"SELECT current_setting('server_version_num') AS version, current_setting('server_encoding') AS encoding, current_setting('block_size') AS block_size",
	)
	const server = result.rows[0]
	if (!server || Number(server.version) < 180006 || Number(server.version) >= 190000 || server.encoding !== "UTF8" || server.block_size !== "8192") {
		throw new DatabaseSetupError("CartHound requires PostgreSQL 18.6 or newer stable 18.x, UTF8 encoding and 8192-byte blocks")
	}
}

// Each connection attempt is also bounded by the pool's connectionTimeoutMillis.
export async function connectWhenReady(pool: pg.Pool) {
	const deadline = Date.now() + 60_000
	for (;;) {
		try {
			const client = await pool.connect()
			try {
				const probe = { text: "SELECT 1", query_timeout: 5000 }
				await client.query(probe)
			}
			catch (error) {
				client.release(true)
				throw error
			}
			return client
		}
		catch {
			if (Date.now() >= deadline) throw new DatabaseSetupError("Database unavailable after 60 seconds; check connection, authentication and network settings")
			await setTimeout(1000)
		}
	}
}
