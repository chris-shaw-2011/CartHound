import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { create, fromBinary, isFieldSet, toBinary } from "@bufbuild/protobuf"
import { TimestampSchema } from "@bufbuild/protobuf/wkt"
import {
	PostalAddressSchema,
	DecimalSchema,
	LatLngSchema,
	MoneySchema,
	Offer_AvailabilityStatus,
	Offer_AvailabilityStatusSchema,
	OfferSchema,
	Product_MeasurementUnit,
	Product_MeasurementUnitSchema,
	ProductSchema,
	RetailerListingSchema,
	RetailerSchema,
	StoreSchema,
} from "@carthound/proto"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const productId = "019f049b-0000-7000-8000-000000000001"
const retailerId = "019f049b-0000-7000-8000-000000000002"
const storeId = "019f049b-0000-7000-8000-000000000003"
const listingId = "019f049b-0000-7000-8000-000000000004"

describe("public generated Protobuf models", () => {
	it.each([9007199254740993n, 9223372036854775807n, -9223372036854775808n, 0n])(
		"preserves int64 money and exact Decimal string %s", integer => {
			const money = create(MoneySchema, { units: integer, nanos: integer < 0n ? -123456789 : 123456789, currencyCode: "USD" })
			const decimal = create(DecimalSchema, { value: `${integer}.1234567890123456789` })
			const decodedMoney = fromBinary(MoneySchema, toBinary(MoneySchema, money))
			const decodedDecimal = fromBinary(DecimalSchema, toBinary(DecimalSchema, decimal))
			expect(decodedMoney).toEqual(money)
			// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
			expect(decodedMoney.units).toBe(integer)
			// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
			expect(decodedMoney.units).toBeTypeOf("bigint")
			expect(decodedDecimal).toEqual(decimal)
			// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
			expect(decodedDecimal.value).toBe(`${integer}.1234567890123456789`)
			// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
			expect(decodedMoney.nanos).toBe(integer < 0n ? -123456789 : 123456789)
		},
	)

	it("represents 24 x 12 US fl oz and first-class product classification", () => {
		const product = create(ProductSchema, {
			id: productId,
			gtin: "00012345678905",
			name: "Sparkling water",
			brand: "Example",
			itemCount: 24,
			itemSize: { value: "12" },
			itemSizeUnit: Product_MeasurementUnit.US_FLUID_OUNCE,
			tags: ["sparkling water"],
		})
		const decoded = fromBinary(ProductSchema, toBinary(ProductSchema, product))
		expect(decoded).toEqual(product)
		expect(decoded.gtin).toBe("00012345678905")
		expect(decoded.itemCount).toBe(24)
		// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
		expect(decoded.itemSize?.value).toBe("12")
		expect(decoded.itemSizeUnit).toBe(Product_MeasurementUnit.US_FLUID_OUNCE)
		expect(decoded.tags).toEqual(["sparkling water"])
		expect(Product_MeasurementUnit.US_FLUID_OUNCE).not.toBe(Product_MeasurementUnit.MASS_OUNCE)
	})

	it("round-trips retailer, physical store, listing, and one observed offer", () => {
		const retailer = create(RetailerSchema, { id: retailerId, slug: "kroger", name: "Kroger" })
		const store = create(StoreSchema, {
			id: storeId, retailerId, retailerStoreId: "00123", name: "Example store",
			address: create(PostalAddressSchema, {
				addressLines: ["123 Main Street"], locality: "Example",
				administrativeArea: "MI", postalCode: "01234", regionCode: "US",
			}),
			location: create(LatLngSchema, { latitude: 42.1, longitude: -83.1 }),
		})
		const listing = create(RetailerListingSchema, {
			id: listingId, retailerId, productId, retailerProductId: "00042",
			name: "Water 24 pack", rawPackageDescription: "24 cans / 12 fl oz each",
		})
		const offer = create(OfferSchema, {
			retailerListingId: listingId, storeId,
			price: { units: 5n, nanos: 990000000, currencyCode: "USD" },
			regularPrice: { units: 6n, nanos: 990000000, currencyCode: "USD" },
			availability: { case: "quantity", value: 4 },
			observedAt: create(TimestampSchema, { seconds: 1788825600n, nanos: 123456789 }),
		})
		expect(fromBinary(RetailerSchema, toBinary(RetailerSchema, retailer))).toEqual(retailer)
		expect(fromBinary(StoreSchema, toBinary(StoreSchema, store))).toEqual(store)
		expect(fromBinary(RetailerListingSchema, toBinary(RetailerListingSchema, listing))).toEqual(listing)
		expect(fromBinary(OfferSchema, toBinary(OfferSchema, offer))).toEqual(offer)
	})

	it("retains absent versus explicitly empty scalar presence", () => {
		const absent = fromBinary(ProductSchema, toBinary(ProductSchema, create(ProductSchema)))
		const empty = fromBinary(ProductSchema, toBinary(ProductSchema, create(ProductSchema, {
			gtin: "", brand: "", itemCount: 0,
			itemSizeUnit: Product_MeasurementUnit.EACH,
		})))
		// Explicit-presence scalar getters still return defaults; use isFieldSet.
		expect(absent.gtin).toBe("")
		for (const field of [ProductSchema.field.gtin, ProductSchema.field.brand]) {
			expect(isFieldSet(absent, field)).toBe(false)
			expect(isFieldSet(empty, field)).toBe(true)
		}
		for (const field of [ProductSchema.field.itemCount, ProductSchema.field.itemSizeUnit]) {
			expect(isFieldSet(absent, field)).toBe(false)
			expect(isFieldSet(empty, field)).toBe(true)
		}
		expect(absent.itemSize).toBeUndefined()
		expect(absent.tags).toEqual([])
		const listing = fromBinary(RetailerListingSchema, toBinary(RetailerListingSchema, create(RetailerListingSchema)))
		expect(isFieldSet(listing, RetailerListingSchema.field.rawPackageDescription)).toBe(false)
		const store = fromBinary(StoreSchema, toBinary(StoreSchema, create(StoreSchema)))
		expect(store.address).toBeUndefined()
		expect(store.location).toBeUndefined()
	})

	it("retains absent prices versus known zero, and unknown availability", () => {
		const unknown = fromBinary(OfferSchema, toBinary(OfferSchema, create(OfferSchema)))
		const free = fromBinary(OfferSchema, toBinary(OfferSchema, create(OfferSchema, {
			price: { units: 0n, currencyCode: "USD" },
			availability: { case: "status", value: Offer_AvailabilityStatus.UNKNOWN },
		})))
		expect(unknown.price).toBeUndefined()
		expect(unknown.regularPrice).toBeUndefined()
		expect(unknown.observedAt).toBeUndefined()
		expect(unknown.availability).toEqual({ case: undefined })
		expect(free.availability).toEqual({ case: "status", value: Offer_AvailabilityStatus.UNKNOWN })
		expect(isFieldSet(unknown, OfferSchema.field.status)).toBe(false)
		expect(isFieldSet(unknown, OfferSchema.field.quantity)).toBe(false)
		expect(isFieldSet(free, OfferSchema.field.status)).toBe(true)
		// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
		expect(free.price?.units).toBe(0n)
		// Upstream proto3 scalars have implicit presence; the containing price is present.
		expect(isFieldSet(free, OfferSchema.field.price)).toBe(true)
		// eslint-disable-next-line carthound/no-raw-protobuf-numeric-fields -- Assert exact stored representation, not a rounded conversion.
		expect(free.price?.nanos).toBe(0)
		const emptyMoney = fromBinary(MoneySchema, toBinary(MoneySchema, create(MoneySchema)))
		expect(isFieldSet(emptyMoney, MoneySchema.field.units)).toBe(false)
	})

	it("uses Google's actual types and preserves known zero coordinates", () => {
		expect(MoneySchema.typeName).toBe("google.type.Money")
		expect(DecimalSchema.typeName).toBe("google.type.Decimal")
		expect(PostalAddressSchema.typeName).toBe("google.type.PostalAddress")
		expect(LatLngSchema.typeName).toBe("google.type.LatLng")
		const store = create(StoreSchema, {
			location: { latitude: 0, longitude: 0 },
			address: { regionCode: "US", addressLines: ["123 Main Street"] },
		})
		const decoded = fromBinary(StoreSchema, toBinary(StoreSchema, store))
		expect(decoded.location).toEqual(create(LatLngSchema))
		expect(isFieldSet(decoded, StoreSchema.field.location)).toBe(true)
		expect(decoded.address?.regionCode).toBe("US")
		const product = fromBinary(ProductSchema, toBinary(ProductSchema, create(ProductSchema)))
		expect(product.itemSize).toBeUndefined()
	})

	it("exposes enum schemas and preserves future unknown enum values", () => {
		expect(Product_MeasurementUnitSchema.typeName).toBe("carthound.v1.Product.MeasurementUnit")
		expect(Offer_AvailabilityStatusSchema.typeName).toBe("carthound.v1.Offer.AvailabilityStatus")
		expect(Product_MeasurementUnit.EACH).toBe(0)
		expect(Offer_AvailabilityStatus.UNKNOWN).toBe(0)
		const future = fromBinary(OfferSchema, new Uint8Array([40, 99]))
		expect(future.availability).toEqual({ case: "status", value: 99 })
		expect(toBinary(OfferSchema, future)).toEqual(new Uint8Array([40, 99]))
	})

	it("executes the public generated TypeScript with native Node type stripping", async () => {
		const result = await execFileAsync(process.execPath, ["--input-type=module", "--eval", `
			import assert from "node:assert/strict";
			import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
			import { MoneySchema, Product_MeasurementUnit } from "@carthound/proto";
			assert.ok(Number(process.versions.node.split(".")[0]) >= 26);
			assert.ok(import.meta.resolve("@carthound/proto").endsWith("/packages/proto/src/gen/index.ts"));
			const money = create(MoneySchema, { units: 9007199254740993n, currencyCode: "USD" });
			assert.equal(fromBinary(MoneySchema, toBinary(MoneySchema, money)).units, 9007199254740993n);
			assert.notEqual(Product_MeasurementUnit.MASS_OUNCE, Product_MeasurementUnit.US_FLUID_OUNCE);
		`], { cwd: new URL("..", import.meta.url) })
		expect(result.stderr).toBe("")
	})
})
