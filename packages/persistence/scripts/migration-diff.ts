import { readFile, readdir } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api"
import { z } from "zod"

// Kit snapshots are external tooling data, not CartHound domain models.
export const snapshotMetadata = z.looseObject({ id: z.string(), prevId: z.string() })
const migrationJournal = z.object({ entries: z.array(z.object({ idx: z.int().nonnegative(), tag: z.string().regex(/^\d+_[a-zA-Z0-9_-]+$/u) })) })

export async function checkMigrationSnapshot(schema: Record<string, unknown>) {
	const directory = new URL("../migrations/meta/", import.meta.url)
	const snapshots = (await readdir(directory)).filter(name => name.endsWith("_snapshot.json")).sort()
	const journal = migrationJournal.parse(JSON.parse(await readFile(new URL("_journal.json", directory), "utf8")))
	if (!isDeepStrictEqual(snapshots, journal.entries.map(entry => `${String(entry.idx).padStart(4, "0")}_snapshot.json`).sort())) {
		throw new Error("Migration snapshots and journal disagree")
	}
	for (const entry of journal.entries) {
		if (!(await readFile(new URL(`../${entry.tag}.sql`, directory), "utf8")).trim()) throw new Error(`Missing SQL for migration ${entry.tag}`)
	}
	const latest = snapshots.at(-1)
	if (!latest) throw new Error("No committed migration snapshot")
	const previous = snapshotMetadata.parse(JSON.parse(await readFile(new URL(latest, directory), "utf8")))
	const current = snapshotMetadata.parse(generateDrizzleJson(schema))
	// Use Kit's real serialization in an isolated in-memory context. Compare before
	// diffing so a rename cannot open an interactive prompt during verification.
	const previousSchema = { ...previous, id: "", prevId: "" }
	const currentSchema = { ...current, id: "", prevId: "" }
	if (!isDeepStrictEqual(previousSchema, JSON.parse(JSON.stringify(currentSchema))) || (await generateMigration(previous, current)).length !== 0) {
		throw new Error("Persistence schema drift: run npm run persistence:generate and review the new migration")
	}
}
