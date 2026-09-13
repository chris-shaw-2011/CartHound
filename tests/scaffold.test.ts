import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)

const workspaces = [
	"apps/web",
	"apps/api",
	"apps/worker",
	"packages/proto",
	"packages/core",
	"packages/retailers",
	"packages/persistence",
]

describe("monorepo scaffold", () => {
	it.each(workspaces)("provides a build for %s", async workspace => {
		const manifestPath = path.join(workspace, "package.json")
		const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
			scripts?: Record<string, string>,
		}

		expect(manifest.scripts?.build).toBeTypeOf("string")
	})

	it.each(["api", "worker"])("runs the %s TypeScript entrypoint with Node", async app => {
		const entrypoint = path.join("apps", app, "src/index.ts")

		await expect(execFileAsync(process.execPath, [entrypoint])).resolves.toMatchObject({
			stderr: "",
		})
	})
})
