import { fileURLToPath } from "node:url"
import { RuleTester } from "@typescript-eslint/rule-tester"
import { afterAll, describe, it } from "vitest"
import rule from "./no-raw-protobuf-numeric-fields.ts"

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
	languageOptions: {
		parserOptions: {
			tsconfigRootDir: fileURLToPath(new URL("../../../", import.meta.url)),
			projectService: { allowDefaultProject: ["rule-test.ts"], defaultProject: "tsconfig.json" },
		},
	},
})
const header = `
import type { Money, Decimal, Offer, Product } from "@carthound/proto";
declare const money: Money;
declare const decimal: Decimal;
`
const code = (body: string) => ({ filename: "rule-test.ts", code: header + body })

tester.run("no-raw-protobuf-numeric-fields", rule, {
	valid: [
		code("const other = { units: 1, nanos: 2, value: \"x\" }; other.units; other.nanos; other.value;"),
		code("declare const other: { $typeName: \"google.protobuf.Timestamp\"; nanos: number }; other.nanos;"),
		code("declare const other: { $typeName: string; value: string }; other.value;"),
		code("money.currencyCode; money.$typeName; decimal.$typeName;"),
		code("declare const product: Product; product.itemSize;"),
		code("money.units = 1n; money.nanos = 0; decimal.value = \"1\";"),
		code("const { units, nanos, value } = { units: 1, nanos: 2, value: \"x\" };"),
		code("declare const mixed: Money | { units: number }; if (!(\"$typeName\" in mixed)) mixed.units;"),
		code("type UnitOnly = Pick<Money, \"units\">; declare const erased: UnitOnly; erased.units;"),
		{ ...code("money.units; money.nanos;"), options: [{ allow: ["google.type.Money"] }] },
		{ ...code("decimal.value;"), options: [{ allow: ["google.type.Decimal"] }] },
	],
	invalid: [
		...[
			"money.units;", "money.nanos;",
			"const alias = money; alias.units;",
			"type Alias = Money; declare const value: Alias; value.nanos;",
			"declare const value: Money | null | undefined; value?.units;",
			"declare const offer: Offer; offer.price?.nanos;",
			"declare const value: Money | { units: number }; value.units;",
			"declare const value: Money & { extra: boolean }; value.units;",
			"function read<T extends Money>(value: T) { return value.units; }",
			"function read<T extends Money | undefined>(value: T) { return value?.units; }",
			"money[\"units\"];", "money[`nanos`];",
			"const key = \"units\"; money[key];",
			"declare const key: \"units\" | \"currencyCode\"; money[key];",
			"const { units: amount } = money;",
			"const { nanos = 0 } = money;",
			"function read({ units }: Money) { return units; }",
			"let units: bigint; ({ units } = money);",
			"declare const offer: Offer & { price: Money }; const { price: { units } } = offer;",
			"declare const offer: Offer & { price: Money }; let units: bigint; ({ price: { units } } = offer);",
			"money.units += 1n;", "money.nanos++;",
		].map(body => ({ ...code(body), errors: [{ messageId: "money" as const }] })),
		...[
			"decimal.value;",
			"const alias = decimal; alias.value;",
			"type Alias = Decimal; declare const value: Alias; value.value;",
			"declare const value: Decimal | null | undefined; value?.value;",
			"declare const product: Product; product.itemSize?.value;",
			"declare const value: Decimal | { value: number }; value.value;",
			"decimal[\"value\"];",
			"const { value: amount } = decimal;",
			"function read<T extends Decimal>(value: T) { return value.value; }",
			"decimal.value += \"0\";",
		].map(body => ({ ...code(body), errors: [{ messageId: "decimal" as const }] })),
		{ ...code("decimal.value;"), options: [{ allow: ["google.type.Money"] }], errors: [{ messageId: "decimal" }] },
		{ ...code("money.units;"), options: [{ allow: ["google.type.Decimal"] }], errors: [{ messageId: "money" }] },
	],
})
