import { create, fromBinary, toBinary } from "@bufbuild/protobuf"
import { DecimalSchema } from "@carthound/proto"
import { describe, expect, it } from "vitest"
import { Decimal } from "./index.ts"

describe("canonical Google Decimal normalization", () => {
	it.each([
		["12.37500", "12375E-3"],
		["-12.37500", "-12375E-3"],
		["+001.237500E+1", "12375E-3"],
		["9007199254740993.1234567890123456789", "90071992547409931234567890123456789E-19"],
		["", "0"],
		["-0.000e+999999999999999999999", "0"],
		["1200", "12E+2"],
		["120.0", "12E+1"],
		["12.", "12"],
		[".5", "5E-1"],
		["-9223372036854775808.001", "-9223372036854775808001E-3"],
		["1E+9007199254740993", "1E+9007199254740993"],
		["1e-9007199254740993", "1E-9007199254740993"],
		["1000e-3", "1"],
	] as const)("normalizes %s to %s", (value, expected) => {
		const original = create(DecimalSchema, { value })
		const normalized = Decimal.normalize(original)
		// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
		expect(normalized.value).toBe(expected)
		expect(Decimal.normalize(normalized)).toEqual(normalized)
		expect(fromBinary(DecimalSchema, toBinary(DecimalSchema, normalized))).toEqual(normalized)
		// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
		expect(original.value).toBe(value)
	})

	it.each([" ", ".", "+", "e1", "1e", "1e+", "1.2.3", "1,25", "1_000", "NaN", "Infinity", "0x10", "1\n"])(
		"rejects invalid Decimal syntax %s", value => {
			expect(() => Decimal.normalize(create(DecimalSchema, { value }))).toThrow(RangeError)
		},
	)

	it("gives equivalent exact inputs the same canonical wire representation", () => {
		const first = Decimal.normalize(create(DecimalSchema, { value: "12.37500" }))
		const second = Decimal.normalize(create(DecimalSchema, { value: "12375e-3" }))
		expect(toBinary(DecimalSchema, first)).toEqual(toBinary(DecimalSchema, second))
	})
})

describe("Decimal.toNumber", () => {
	it.each([
		["12", 12], ["12.375", 12.375], ["-12", -12], ["-0.375", -0.375],
		["0", 0], ["", 0], ["1.25E+2", 125],
	] as const)("converts %s to %s", (value, expected) => {
		expect(Decimal.toNumber(create(DecimalSchema, { value }))).toBe(expected)
	})
})
