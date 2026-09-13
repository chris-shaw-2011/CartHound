import { create, equals, isFieldSet } from "@bufbuild/protobuf"
import { createValidator } from "@bufbuild/protovalidate"
import { OfferSchema, ProductSchema, RetailerListingSchema, RetailerSchema, StoreSchema } from "@carthound/proto"
import { describe, expect, it } from "vitest"
import { offerMapper, productMapper, retailerListingMapper, retailerMapper, storeMapper } from "./mappers.ts"

const id = "019f049b-0000-7000-8000-000000000001"
const validator = createValidator()
const product = { id, name: "Butter", itemSize: { value: "1.20E+1" }, itemSizeUnit: 1 as const }
const store = { id, retailerId: id, retailerStoreId: "001", name: "Main Street" }
const offer = {
	retailerListingId: id, storeId: id, price: { currencyCode: "USD", units: 9_223_372_036_854_775_807n, nanos: 999_999_999 },
	availability: { case: "status" as const, value: 0 as const }, observedAt: { seconds: 1n, nanos: 123_456_000 },
}

describe("validated canonical round trips", () => {
	it("preserves Retailer identity", () => {
		const m = create(RetailerSchema, { id, slug: "kroger", name: "Kroger" })
		expect(equals(RetailerSchema, retailerMapper.fromRow(retailerMapper.toRow(m)), m)).toBe(true)
	})
	it.each([false, true])("preserves Product optional presence, uint32 and tag order (%s)", full => {
		const m = create(ProductSchema, { ...product, ...(full ? { gtin: "00012345678905", brand: "Brand", itemCount: 4_294_967_295, tags: ["butter", "organic", "salted"] } : {}) })
		const row = productMapper.toRow(m)
		const roundTrip = productMapper.fromRow(row)
		expect(equals(ProductSchema, roundTrip, m)).toBe(true)
		expect(isFieldSet(roundTrip, ProductSchema.field.itemCount)).toBe(full)
		expect(row.itemCount).toBe(full ? 4_294_967_295n : null)
	})
	it.each(["1", "+0001.2000e+0002", "9007199254740993.000000000001", "1e131071", "1e-16383", "9".repeat(131072), `0.${"0".repeat(16382)}1`, "100e-16385", ".0001e131075"])("preserves exact Decimal %s", value => {
		const m = create(ProductSchema, { ...product, itemSize: { value } })
		expect(equals(ProductSchema, productMapper.fromRow(productMapper.toRow(m)), m)).toBe(true)
	})
	it.each(["1e131072", "1e-16384", "9".repeat(131073), `0.${"0".repeat(16383)}1`, "1e999999999999999999999999"])("rejects Decimal outside PostgreSQL limits (%s)", value => {
		expect(() => productMapper.toRow(create(ProductSchema, { ...product, itemSize: { value } }))).toThrow()
	})
	it.each([false, true])("preserves listing optional fields (%s)", full => {
		const m = create(RetailerListingSchema, { id, retailerId: id, productId: id, retailerProductId: "00042", ...(full ? { name: "Butter", rawPackageDescription: "2 x 8 oz" } : {}) })
		expect(equals(RetailerListingSchema, retailerListingMapper.fromRow(retailerListingMapper.toRow(m)), m)).toBe(true)
	})
	it.each([[false, false], [true, false], [false, true], [true, true]])("preserves complete Google address and location (%s, %s)", (address, location) => {
		const m = create(StoreSchema, { ...store,
			address: address ? { revision: -2_147_483_648, regionCode: "US", languageCode: "en", postalCode: "00123", sortingCode: "CEDEX", administrativeArea: "OH", locality: "Town", sublocality: "North", addressLines: ["1 Main St", "Suite 2"], recipients: ["One", "Two"], organization: "Store" } : undefined,
			location: location ? { latitude: 0, longitude: -180 } : undefined,
		})
		expect(equals(StoreSchema, storeMapper.fromRow(storeMapper.toRow(m)), m)).toBe(true)
	})
	it.each([false, true])("preserves Offer Money int64, availability and regular price (%s)", quantity => {
		const m = create(OfferSchema, { ...offer,
			regularPrice: quantity ? offer.price : undefined,
			availability: quantity ? { case: "quantity", value: 4_294_967_295 } : offer.availability,
		})
		const row = offerMapper.toRow(m)
		expect(row.observedAt).toBe("1970-01-01T00:00:01.123456Z")
		expect(equals(OfferSchema, offerMapper.fromRow({ ...row, observedAt: "1970-01-01 00:00:01.123456+00" }), m)).toBe(true)
		expect(validator.validate(OfferSchema, offerMapper.fromRow(row)).kind).toBe("valid")
	})
	it.each([-62_135_596_800n, -1n, 0n, 1_700_000_000n])("preserves timestamp seconds %s plus microseconds", seconds => {
		const m = create(OfferSchema, { ...offer, observedAt: { seconds, nanos: 999_999_000 } })
		expect(equals(OfferSchema, offerMapper.fromRow(offerMapper.toRow(m)), m)).toBe(true)
	})
	it.each([0, 1, 999, 1000, 1001, 123456000, 999999000, 999999999])("agrees with nanos modulo 1000 for %s", nanos => {
		const m = create(OfferSchema, { ...offer, observedAt: { seconds: 1n, nanos } })
		expect(validator.validate(OfferSchema, m).kind).toBe(nanos % 1000 === 0 ? "valid" : "invalid")
	})
	it("rejects observations before the Protobuf Timestamp year-one boundary", () => {
		expect(() => offerMapper.toRow(create(OfferSchema, { ...offer, observedAt: { seconds: -62135596801n } }))).toThrow()
	})

	it("validates writes and rejects corrupt reads", () => {
		expect(() => productMapper.toRow(create(ProductSchema, { ...product, tags: ["butter", "butter"] }))).toThrow()
		expect(() => productMapper.toRow(create(ProductSchema, { ...product, tags: ["Butter"] }))).toThrow()
		expect(() => productMapper.fromRow({ ...productMapper.toRow(create(ProductSchema, product)), itemSize: "99" })).toThrow()
		expect(() => productMapper.fromRow({ ...productMapper.toRow(create(ProductSchema, product)), itemCount: 4_294_967_296n })).toThrow()
		const row = offerMapper.toRow(create(OfferSchema, offer))
		expect(() => offerMapper.fromRow({ ...row, availabilityQuantity: 1n })).toThrow()
		expect(() => offerMapper.fromRow({ ...row, regularPriceUnits: 1n })).toThrow()
		expect(() => offerMapper.fromRow({ ...row, priceUnits: -1n })).toThrow()
		expect(() => offerMapper.fromRow({ ...row, observedAt: "1970-01-01 00:00:01.123456789+00" })).toThrow()
		const storeRow = storeMapper.toRow(create(StoreSchema, store))
		expect(() => storeMapper.fromRow({ ...storeRow, latitude: 1 })).toThrow()
		expect(() => storeMapper.fromRow({ ...storeRow, addressRevision: 0 })).toThrow()
	})
	it("rejects PostgreSQL NUL text in canonical validation, including nested arrays", () => {
		expect(() => productMapper.toRow(create(ProductSchema, { ...product, name: "Butter\0" }))).toThrow()
		expect(() => productMapper.toRow(create(ProductSchema, { ...product, tags: ["but\0ter"] }))).toThrow()
		expect(() => storeMapper.toRow(create(StoreSchema, { ...store, address: { regionCode: "US", recipients: ["a\0b"] } }))).toThrow()
	})
	it("enforces index byte boundaries in canonical validation", () => {
		for (const tag of ["x".repeat(2692), "é".repeat(1346)]) {
			expect(() => productMapper.toRow(create(ProductSchema, { ...product, tags: [tag] }))).not.toThrow()
			expect(() => productMapper.toRow(create(ProductSchema, { ...product, tags: [`${tag}x`] }))).toThrow()
		}
		expect(() => retailerMapper.toRow(create(RetailerSchema, { id, name: "Retailer", slug: "a".repeat(2692) }))).not.toThrow()
		expect(() => retailerMapper.toRow(create(RetailerSchema, { id, name: "Retailer", slug: "a".repeat(2693) }))).toThrow()
		for (const length of [2676, 2677]) {
			const storeResult = validator.validate(StoreSchema, create(StoreSchema, { ...store, retailerStoreId: "x".repeat(length) }))
			const listingResult = validator.validate(RetailerListingSchema, create(RetailerListingSchema, { id, retailerId: id, productId: id, retailerProductId: "x".repeat(length) }))
			expect(storeResult.kind).toBe(length === 2676 ? "valid" : "invalid")
			expect(listingResult.kind).toBe(length === 2676 ? "valid" : "invalid")
		}
	})
})
