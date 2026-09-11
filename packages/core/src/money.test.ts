import { create } from "@bufbuild/protobuf"
import { MoneySchema } from "@carthound/proto"
import { describe, expect, it } from "vitest"
import { Money } from "./index.ts"

describe("Money utilities", () => {
	it.each([
		[0n, 0, 0],
		[12n, 0, 12],
		[12n, 375000000, 12.375],
		[-12n, 0, -12],
		[-12n, -375000000, -12.375],
		[0n, -375000000, -0.375],
	] as const)("converts units %s and nanos %s to %s", (units, nanos, expected) => {
		expect(Money.toNumber(create(MoneySchema, { units, nanos, currencyCode: "USD" }))).toBe(expected)
	})

	it.each([
		["USD", "en-US", 1234n, 500000000, "$1,234.50"],
		["EUR", "de-DE", 1234n, 500000000, "1.234,50\u00a0€"],
		["JPY", "ja-JP", 1234n, 500000000, "￥1,235"],
	] as const)("formats %s in %s", (currencyCode, locale, units, nanos, expected) => {
		expect(Money.toString(create(MoneySchema, { currencyCode, units, nanos }), locale)).toBe(expected)
	})

	it("uses the runtime locale when none is supplied", () => {
		const value = create(MoneySchema, { currencyCode: "USD", units: 12n, nanos: 500000000 })
		expect(Money.toString(value)).toBe(new Intl.NumberFormat(undefined, {
			style: "currency", currency: "USD",
		}).format(12.5))
	})

	it("accepts Intl.Locale objects and locale lists", () => {
		const value = create(MoneySchema, { currencyCode: "USD", units: 12n })
		expect(Money.toString(value, new Intl.Locale("en-US"))).toBe("$12.00")
		expect(Money.toString(value, ["en-US", "de-DE"])).toBe("$12.00")
	})
})
