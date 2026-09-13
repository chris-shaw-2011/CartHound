import { readFile } from "node:fs/promises"
import { generateMigration } from "drizzle-kit/api"
import { pgTable, text, uuid } from "drizzle-orm/pg-core"
import { expect, it } from "vitest"
import { checkMigrationSnapshot, snapshotMetadata } from "../scripts/migration-diff.ts"
import * as schema from "./schema.ts"

it("detects pending column additions and renames without writing migration history", async () => {
	const journalPath = new URL("../migrations/meta/_journal.json", import.meta.url)
	const journal = await readFile(journalPath, "utf8")
	await expect(checkMigrationSnapshot(schema)).resolves.toBeUndefined()
	for (const columns of [
		{ slug: text().notNull().unique(), manufacturer: text() },
		{ retailerSlug: text().notNull().unique() },
	]) {
		const retailers = pgTable("retailers", { id: uuid().primaryKey(), name: text().notNull(), ...columns })
		await expect(checkMigrationSnapshot({ ...schema, retailers })).rejects.toThrow("Persistence schema drift")
	}
	expect(await readFile(journalPath, "utf8")).toBe(journal)
})

it.each([[0, 1, "0001_foundation"], [2, 3, "0003_uuid_variant"], [3, 4, "0004_text_index_bounds"]] as const)("keeps generated migration %s -> %s consistent with its historical snapshots", async (before, after, name) => {
	const snapshot = async (index: number) => snapshotMetadata.parse(JSON.parse(await readFile(new URL(`../migrations/meta/${String(index).padStart(4, "0")}_snapshot.json`, import.meta.url), "utf8")))
	const expected = await generateMigration(await snapshot(before), await snapshot(after))
	const committed = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8")
	expect(committed.split("--> statement-breakpoint").map(statement => statement.trim()).filter(Boolean)).toEqual(expected.map(statement => statement.trim()))
})

it("validates snapshot metadata without discarding the relational schema", () => {
	const snapshot = { id: "current", prevId: "previous", tables: { products: { columns: { id: { type: "uuid" } } } } }
	expect(snapshotMetadata.parse(snapshot)).toEqual(snapshot)
	expect(() => snapshotMetadata.parse({ ...snapshot, id: 42 })).toThrow()
	expect(() => snapshotMetadata.parse({ id: "current" })).toThrow()
})
