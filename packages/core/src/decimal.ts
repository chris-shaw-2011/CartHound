import { create } from "@bufbuild/protobuf"
import { type Decimal as DecimalValue, DecimalSchema } from "@carthound/proto"

export const Decimal = {
	/** Canonical exact integer significand plus optional E exponent; zero is "0". */
	normalize(decimal: DecimalValue): DecimalValue {
		const input = decimal.value === "" ? "0" : decimal.value
		const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/u.exec(input)
		if (match?.[0] !== input) {
			throw new RangeError("Invalid Google Decimal string")
		}
		const [, sign, integer = "", fraction = "", exponent = "0"] = match
		const digits = integer + fraction
		if (digits.length === 0) {
			throw new RangeError("Decimal must contain at least one digit")
		}
		const withoutTrailingZeros = digits.replace(/0+$/u, "")
		const significand = withoutTrailingZeros.replace(/^0+/u, "")
		if (significand === "") {
			return create(DecimalSchema, { value: "0" })
		}
		const power = BigInt(exponent) - BigInt(fraction.length) +
			BigInt(digits.length - withoutTrailingZeros.length)
		const suffix = power === 0n ? "" : `E${power > 0n ? "+" : ""}${power}`
		return create(DecimalSchema, { value: `${sign === "-" ? "-" : ""}${significand}${suffix}` })
	},

	/** Explicit conversion to a JavaScript number; precision may be lost. */
	toNumber(value: DecimalValue): number {
		return Number(value.value)
	},
}
