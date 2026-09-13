import type pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { checkCompatibility, connectWhenReady } from "./database.ts"

afterEach(() => vi.useRealTimers())

it.each([
	["180006", "UTF8", "8192", true],
	["180007", "UTF8", "8192", true],
	["180005", "UTF8", "8192", false],
	["190000", "UTF8", "8192", false],
	["170011", "UTF8", "8192", false],
	["180006", "LATIN1", "8192", false],
	["180006", "UTF8", "16384", false],
])("checks server compatibility %s / %s / %s", async (version, encoding, blockSize, supported) => {
	const client = { query: vi.fn().mockResolvedValue({ rows: [{ version, encoding, block_size: blockSize }] }) } as unknown as pg.PoolClient
	if (supported) await expect(checkCompatibility(client)).resolves.toBeUndefined()
	else await expect(checkCompatibility(client)).rejects.toThrow("requires PostgreSQL")
})

it("connects immediately when ready and retries transient failures", async () => {
	vi.useFakeTimers()
	const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() }
	const pool = { connect: vi.fn().mockRejectedValueOnce(new Error("starting")).mockResolvedValue(client) } as unknown as pg.Pool
	const pending = connectWhenReady(pool)
	await vi.advanceTimersByTimeAsync(1000)
	await expect(pending).resolves.toBe(client)
	await expect(connectWhenReady(pool)).resolves.toBe(client)
})

it("bounds retries without exposing driver connection details", async () => {
	vi.useFakeTimers()
	const pool = { connect: vi.fn().mockRejectedValue(new Error("sensitive connection details")) } as unknown as pg.Pool
	const pending = expect(connectWhenReady(pool)).rejects.toThrow("Database unavailable after 60 seconds")
	await vi.advanceTimersByTimeAsync(60_000)
	await pending
})

it("discards a connection whose readiness query fails", async () => {
	vi.useFakeTimers()
	const failed = { query: vi.fn().mockRejectedValue(new Error("disconnected")), release: vi.fn() }
	const ready = { query: vi.fn().mockResolvedValue({}), release: vi.fn() }
	const pool = { connect: vi.fn().mockResolvedValueOnce(failed).mockResolvedValue(ready) } as unknown as pg.Pool
	const pending = connectWhenReady(pool)
	await vi.advanceTimersByTimeAsync(1000)
	await expect(pending).resolves.toBe(ready)
	expect(failed.release).toHaveBeenCalledWith(true)
})
