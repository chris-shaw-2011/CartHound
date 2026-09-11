import { fileURLToPath } from "node:url"
import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../../", import.meta.url)) })
const ruleId = "carthound/no-raw-protobuf-numeric-fields"

describe("repository numeric-field rule integration", () => {
	it.each([
		["packages/core/src/money.ts", "Money", "units", 0],
		["packages/core/src/decimal.ts", "Decimal", "value", 0],
		["packages/core/src/money.ts", "Decimal", "value", 1],
		["packages/core/src/decimal.ts", "Money", "nanos", 1],
		["apps/api/src/index.ts", "Money", "units", 1],
		["apps/web/src/App.tsx", "Decimal", "value", 1],
		["packages/core/src/money.test.ts", "Money", "units", 1],
	] as const)("enforces the configured boundary in %s for %s.%s", async (filePath, type, field, count) => {
		const results = await eslint.lintText(`import type { ${type} } from "@carthound/proto";
export function read(value: ${type}) { return value.${field}; }
`, { filePath })
		expect(results.flatMap(result => result.messages).filter(message => message.fatal)).toEqual([])
		const messages = results.flatMap(result => result.messages).filter(message => message.ruleId === ruleId)
		expect(messages).toHaveLength(count)
		expect(messages.every(message => message.severity === 2)).toBe(true)
	})

	it("lints the actual approved utility implementations without numeric-field violations", async () => {
		const results = await eslint.lintFiles(["packages/core/src/money.ts", "packages/core/src/decimal.ts"])
		expect(results.flatMap(result => result.messages).filter(message => message.fatal === true || message.ruleId === ruleId)).toEqual([])
	})
})
