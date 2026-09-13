import type { DescMessage, MessageInitShape } from "@bufbuild/protobuf"
import { create } from "@bufbuild/protobuf"
import { TimestampSchema } from "@bufbuild/protobuf/wkt"
import { createValidator } from "@bufbuild/protovalidate"
import {
	type OfferValid,
	Offer_AvailabilityStatus,
	OfferSchema,
	Product_MeasurementUnit,
	ProductSchema,
	RetailerListingSchema,
	RetailerSchema,
	StoreSchema,
} from "@carthound/proto"
import { describe, expect, it } from "vitest"

const productId = "019f049b-0000-7000-8000-000000000001"
const retailerId = "019f049b-0000-7000-8000-000000000002"
const storeId = "019f049b-0000-7000-8000-000000000003"
const listingId = "019f049b-0000-7000-8000-000000000004"
const validator = createValidator()

function validate<Schema extends DescMessage>(schema: Schema, init?: MessageInitShape<Schema>) {
	return validator.validate(schema, create(schema, init))
}

function expectInvalid<Schema extends DescMessage>(schema: Schema, init: MessageInitShape<Schema>, ruleId: string) {
	const result = validate(schema, init)
	expect(result.kind).toBe("invalid")
	if (result.kind === "invalid") {
		expect(result.violations.map(violation => violation.ruleId)).toContain(ruleId)
	}
}

const validProduct = {
	id: productId,
	name: "Sparkling water",
	itemSize: { value: "12" },
	itemSizeUnit: Product_MeasurementUnit.US_FLUID_OUNCE,
}
const validRetailer = { id: retailerId, slug: "sams-club", name: "Sam's Club" }
const validListing = { id: listingId, retailerId, productId, retailerProductId: "00042" }
const validStore = { id: storeId, retailerId, retailerStoreId: "00123", name: "Main Street" }
const validOffer = {
	retailerListingId: listingId,
	storeId,
	price: { currencyCode: "USD", units: 1n },
	availability: { case: "status" as const, value: Offer_AvailabilityStatus.UNKNOWN },
	observedAt: create(TimestampSchema, { seconds: 1n }),
}

describe("Protovalidate domain invariants", () => {
	it("returns the generated Valid type after successful validation", () => {
		const result = validate(OfferSchema, validOffer)
		expect(result.kind).toBe("valid")
		if (result.kind === "valid") {
			const offer: OfferValid = result.message
			expect(offer.observedAt.seconds).toBe(1n)
			expect(offer.price.currencyCode).toBe("USD")
		}
	})

	it("makes required Product message fields non-optional after validation", () => {
		const result = validate(ProductSchema, validProduct)
		expect(result.kind).toBe("valid")
		if (result.kind === "valid") {
			expect(result.message.itemSize.$typeName).toBe("google.type.Decimal")
		}
	})

	it("accepts minimal valid domain messages", () => {
		for (const result of [
			validate(ProductSchema, validProduct),
			validate(RetailerSchema, validRetailer),
			validate(RetailerListingSchema, validListing),
			validate(StoreSchema, validStore),
			validate(OfferSchema, validOffer),
		]) {
			expect(result.kind).toBe("valid")
		}
	})

	it("requires every domain identity, relationship, name, observation time, and availability", () => {
		expectInvalid(ProductSchema, { id: productId, name: "Sparkling water" }, "required")
		expectInvalid(RetailerSchema, { id: retailerId, slug: "kroger" }, "required")
		expectInvalid(RetailerListingSchema, {
			id: listingId, retailerId, retailerProductId: "00042",
		}, "required")
		expectInvalid(StoreSchema, {
			id: storeId, retailerId, name: "Main Street",
		}, "required")
		expectInvalid(OfferSchema, {
			retailerListingId: listingId,
			storeId,
			availability: validOffer.availability,
			observedAt: validOffer.observedAt,
		}, "required")
		expectInvalid(OfferSchema, { ...validOffer, observedAt: undefined }, "required")
		expectInvalid(OfferSchema, { ...validOffer, availability: { case: undefined } }, "required")
	})

	it("requires lowercase, hyphenated UUIDv7 values for IDs and references", () => {
		const uuidV4 = "550e8400-e29b-41d4-a716-446655440000"
		expectInvalid(ProductSchema, { ...validProduct, id: uuidV4 }, "string.pattern")
		expectInvalid(RetailerSchema, { ...validRetailer, id: uuidV4 }, "string.pattern")
		expectInvalid(RetailerListingSchema, { ...validListing, retailerId: uuidV4 }, "string.pattern")
		expectInvalid(StoreSchema, { ...validStore, retailerId: "not-a-uuid" }, "string.uuid")
		expectInvalid(OfferSchema, { ...validOffer, storeId: uuidV4 }, "string.pattern")
	})

	it("rejects empty names and identifiers and malformed retailer slugs", () => {
		expectInvalid(ProductSchema, { ...validProduct, name: "   " }, "string.pattern")
		expectInvalid(RetailerSchema, { ...validRetailer, slug: "Sam's Club" }, "string.pattern")
		expectInvalid(RetailerListingSchema, { ...validListing, retailerProductId: "\t" }, "string.pattern")
		expectInvalid(RetailerListingSchema, { ...validListing, name: "" }, "string.min_len")
		expectInvalid(StoreSchema, { ...validStore, name: " " }, "string.pattern")
	})

	it("validates product identifiers, normalized tags, and complete positive measurements", () => {
		expectInvalid(ProductSchema, { ...validProduct, gtin: "123" }, "string.pattern")
		expectInvalid(ProductSchema, { ...validProduct, gtin: "00012345678904" }, "product.gtin.checksum")
		expectInvalid(ProductSchema, { ...validProduct, itemCount: 0 }, "uint32.gte_lte")
		expectInvalid(ProductSchema, {
			id: productId,
			name: "Sparkling water",
			itemSize: { value: "12" },
		}, "required")
		expectInvalid(ProductSchema, {
			id: productId,
			name: "Sparkling water",
			itemSizeUnit: Product_MeasurementUnit.GRAM,
		}, "required")
		expectInvalid(ProductSchema, {
			...validProduct,
			itemSize: { value: "-0.5" },
			itemSizeUnit: Product_MeasurementUnit.GRAM,
		}, "product.item_size.positive_decimal")
		expectInvalid(ProductSchema, {
			...validProduct,
			itemSize: { value: "2" },
			itemSizeUnit: Product_MeasurementUnit.EACH,
		}, "product.item_size.each")
		expectInvalid(ProductSchema, {
			...validProduct,
			itemSizeUnit: 99 as Product_MeasurementUnit,
		}, "enum.defined_only")
		expectInvalid(ProductSchema, { ...validProduct, tags: ["organic", "organic"] }, "repeated.unique")
		expectInvalid(ProductSchema, { ...validProduct, tags: ["Organic"] }, "string.pattern")
		expectInvalid(ProductSchema, { ...validProduct, tags: ["sparkling  water"] }, "string.pattern")
		expect(validate(ProductSchema, {
			...validProduct,
			gtin: "00012345678905",
			itemCount: 24,
			itemSize: { value: "1.2E+1" },
			itemSizeUnit: Product_MeasurementUnit.US_FLUID_OUNCE,
			tags: ["sparkling water", "zero-sugar"],
		}).kind).toBe("valid")
		expect(validate(ProductSchema, {
			...validProduct,
			itemSize: { value: "1" },
			itemSizeUnit: Product_MeasurementUnit.EACH,
		}).kind).toBe("valid")
	})

	it("validates prices, availability enums, and observation times", () => {
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "usd", units: 1n },
		}, "offer.price.valid")
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD", units: -1n },
		}, "offer.price.valid")
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD", nanos: 1_000_000_000 },
		}, "offer.price.valid")
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD" },
		}, "offer.price.valid")
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD", units: 2n },
			regularPrice: { currencyCode: "CAD", units: 3n },
		}, "offer.prices.same_currency")
		expectInvalid(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD", units: 3n },
			regularPrice: { currencyCode: "USD", units: 2n },
		}, "offer.regular_price.not_less_than_price")
		expectInvalid(OfferSchema, {
			...validOffer,
			availability: { case: "status", value: 99 as Offer_AvailabilityStatus },
		}, "enum.defined_only")
		expectInvalid(OfferSchema, {
			...validOffer,
			availability: { case: "quantity", value: 0 },
		}, "uint32.gte_lte")
		expectInvalid(OfferSchema, {
			...validOffer,
			observedAt: create(TimestampSchema, { seconds: 253402300799n }),
		}, "timestamp.lt_now")
		expect(validate(OfferSchema, {
			...validOffer,
			price: { currencyCode: "USD", nanos: 500_000_000 },
			regularPrice: { currencyCode: "USD", nanos: 500_000_000 },
			availability: { case: "quantity", value: 1 },
		}).kind).toBe("valid")
	})

	it("validates supplied addresses and coordinate bounds while permitting their absence", () => {
		expectInvalid(StoreSchema, { ...validStore, address: { regionCode: "usa" } }, "store.address.region_code")
		expectInvalid(StoreSchema, { ...validStore, location: { latitude: 90.1, longitude: 0 } }, "store.location.bounds")
		expectInvalid(StoreSchema, { ...validStore, location: { latitude: 0, longitude: 180.1 } }, "store.location.bounds")
		expect(validate(StoreSchema, {
			...validStore,
			address: { regionCode: "US" },
			location: { latitude: 0, longitude: 0 },
		}).kind).toBe("valid")
	})
})
