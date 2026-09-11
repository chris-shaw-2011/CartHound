import type { Money as MoneyValue } from "@carthound/proto"

export const Money = {
	/** Explicit conversion to a JavaScript number; precision may be lost. */
	toNumber(value: MoneyValue): number {
		return Number(value.units) + value.nanos / 1_000_000_000
	},
	toString(value: MoneyValue, locale?: Intl.LocalesArgument): string {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency: value.currencyCode,
		}).format(Money.toNumber(value))
	},
}
