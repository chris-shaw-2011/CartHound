import carthound from "@carthound/eslint-rules"
import config from "@chris-shaw-2011/lint/react"

export default [
	...config,
	{ ignores: ["AGENTS.md", "packages/proto/src/gen/**"] },
	{
		files: ["**/*.{ts,tsx,mts,cts}"],
		// The shared preset deliberately disables typed services for config files.
		ignores: ["**/*.config.{ts,mts,cts}", "**/playwright*.{ts,mts,cts}"],
		plugins: { carthound },
		rules: { "carthound/no-raw-protobuf-numeric-fields": "error" },
	},
	{
		files: ["packages/core/src/money.ts"],
		rules: { "carthound/no-raw-protobuf-numeric-fields": ["error", { allow: ["google.type.Money"] }] },
	},
	{
		// Includes the exact string normalizer, which must not convert through Number.
		files: ["packages/core/src/decimal.ts"],
		rules: { "carthound/no-raw-protobuf-numeric-fields": ["error", { allow: ["google.type.Decimal"] }] },
	},
]
