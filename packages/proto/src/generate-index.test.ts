import { execFile } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { expect, it } from "vitest"

const execFileAsync = promisify(execFile)

it("automatically exports added models and drops removed models without exposing file descriptors", async () => {
	const directory = await mkdtemp(path.join(tmpdir(), "carthound-proto-index-"))
	try {
		const scripts = path.join(directory, "scripts")
		const generated = path.join(directory, "src/gen")
		await mkdir(scripts, { recursive: true })
		await mkdir(path.join(generated, "example"), { recursive: true })
		const script = path.join(scripts, "generate-index.ts")
		await copyFile(new URL("../scripts/generate-index.ts", import.meta.url), script)
		const original = path.join(generated, "example/original_pb.ts")
		await writeFile(original, [
			"export const file_example_original = {};",
			"export type Original = {};",
			"export const OriginalSchema = {};",
			"export const Status = { UNKNOWN: 0 } as const;",
			"export type Status = 0;",
		].join("\n"))
		await execFileAsync(process.execPath, [script])
		const entrypoint = path.join(generated, "index.ts")
		const first = await readFile(entrypoint, "utf8")
		expect(first).toContain("export { type Original, OriginalSchema, Status } from \"./example/original_pb.ts\"")
		expect(first).not.toContain("file_example_original")
		await writeFile(path.join(generated, "added_pb.ts"), "export type Added = {};\nexport const AddedSchema = {};\n")
		await execFileAsync(process.execPath, [script])
		const added = await readFile(entrypoint, "utf8")
		expect(added).toContain("export { type Added, AddedSchema } from \"./added_pb.ts\"")
		expect(added.indexOf("AddedSchema")).toBeLessThan(added.indexOf("OriginalSchema"))
		await rm(original)
		await execFileAsync(process.execPath, [script])
		const removed = await readFile(entrypoint, "utf8")
		expect(removed).not.toContain("Original")
		expect(removed).toContain("AddedSchema")
		await execFileAsync(process.execPath, [script])
		expect(await readFile(entrypoint, "utf8")).toBe(removed)
	}
	finally {
		await rm(directory, { recursive: true, force: true })
	}
})
