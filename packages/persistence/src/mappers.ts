import { create, fromJson, isFieldSet, type DescMessage, type MessageShape, toBinary } from "@bufbuild/protobuf"
import { TimestampSchema } from "@bufbuild/protobuf/wkt"
import { createValidator } from "@bufbuild/protovalidate"
import { Decimal } from "@carthound/core"
import { type Product_MeasurementUnit, type Offer_AvailabilityStatus, DecimalSchema, OfferSchema, ProductSchema, RetailerListingSchema, RetailerSchema, StoreSchema } from "@carthound/proto"
import type { currentOffers, products, retailerListings, retailers, stores } from "./schema.ts"

const validator = createValidator()

function validated<S extends DescMessage>(schema: S, message: MessageShape<S>) {
	// Protobuf wire types (for example uint32/int64) also need checking for
	// ordinary JavaScript objects; Protovalidate evaluates annotated rules only.
	toBinary(schema, message)
	const result = validator.validate(schema, message)
	if (result.kind !== "valid") throw new Error(`Invalid ${schema.typeName}: ${result.kind}`, { cause: result })
	return result.message
}

function present<T>(value: T | null): T {
	if (value === null) throw new Error("Incomplete persistence value object")
	return value
}
function group(values: unknown[]) {
	const count = values.filter(value => value !== null).length
	if (count !== 0 && count !== values.length) throw new Error("Incomplete persistence value object")
	return count !== 0
}

export const retailerMapper = {
	toRow(message: MessageShape<typeof RetailerSchema>): typeof retailers.$inferInsert {
		const m = validated(RetailerSchema, message)
		// Project known columns only: never pass Protobuf metadata to Drizzle.
		// eslint-disable-next-line internal/no-redundant-object-remap
		return { id: m.id, slug: m.slug, name: m.name }
	},
	fromRow(row: typeof retailers.$inferSelect) {
		return validated(RetailerSchema, create(RetailerSchema, row))
	},
}

export const productMapper = {
	toRow(message: MessageShape<typeof ProductSchema>): typeof products.$inferSelect {
		const m = validated(ProductSchema, message)
		return {
			id: m.id, gtin: isFieldSet(m, ProductSchema.field.gtin) ? m.gtin : null, name: m.name,
			brand: isFieldSet(m, ProductSchema.field.brand) ? m.brand : null,
			itemCount: isFieldSet(m, ProductSchema.field.itemCount) ? BigInt(m.itemCount) : null,
			itemSize: Decimal.normalize(m.itemSize).value, itemSizeDecimal: m.itemSize.value,
			itemSizeUnit: m.itemSizeUnit, tags: [...m.tags],
		}
	},
	fromRow(row: typeof products.$inferSelect) {
		const m = validated(ProductSchema, create(ProductSchema, {
			id: row.id, name: row.name, ...(row.gtin === null ? {} : { gtin: row.gtin }), ...(row.brand === null ? {} : { brand: row.brand }),
			...(row.itemCount === null ? {} : { itemCount: Number(row.itemCount) }),
			itemSize: { value: row.itemSizeDecimal }, itemSizeUnit: row.itemSizeUnit as Product_MeasurementUnit, tags: [...row.tags],
		}))
		if (Decimal.normalize(m.itemSize).value !== Decimal.normalize(create(DecimalSchema, { value: row.itemSize })).value) {
			throw new Error("Inconsistent persisted Decimal")
		}
		return m
	},
}

export const storeMapper = {
	toRow(message: MessageShape<typeof StoreSchema>): typeof stores.$inferSelect {
		const m = validated(StoreSchema, message)
		const a = m.address
		return {
			id: m.id, retailerId: m.retailerId, retailerStoreId: m.retailerStoreId, name: m.name,
			addressRevision: a?.revision ?? null, addressRegionCode: a?.regionCode ?? null,
			addressLanguageCode: a?.languageCode ?? null, addressPostalCode: a?.postalCode ?? null,
			addressSortingCode: a?.sortingCode ?? null, addressAdministrativeArea: a?.administrativeArea ?? null,
			addressLocality: a?.locality ?? null, addressSublocality: a?.sublocality ?? null,
			addressLines: a ? [...a.addressLines] : null, addressRecipients: a ? [...a.recipients] : null,
			addressOrganization: a?.organization ?? null,
			latitude: m.location?.latitude ?? null, longitude: m.location?.longitude ?? null,
		}
	},
	fromRow(row: typeof stores.$inferSelect) {
		const hasAddress = group([row.addressRevision, row.addressRegionCode, row.addressLanguageCode, row.addressPostalCode,
			row.addressSortingCode, row.addressAdministrativeArea, row.addressLocality, row.addressSublocality,
			row.addressLines, row.addressRecipients, row.addressOrganization])
		const hasLocation = group([row.latitude, row.longitude])
		return validated(StoreSchema, create(StoreSchema, {
			id: row.id, retailerId: row.retailerId, retailerStoreId: row.retailerStoreId, name: row.name,
			address: hasAddress ?
					{
						revision: present(row.addressRevision), regionCode: present(row.addressRegionCode),
						languageCode: present(row.addressLanguageCode), postalCode: present(row.addressPostalCode),
						sortingCode: present(row.addressSortingCode), administrativeArea: present(row.addressAdministrativeArea),
						locality: present(row.addressLocality), sublocality: present(row.addressSublocality),
						addressLines: [...present(row.addressLines)], recipients: [...present(row.addressRecipients)],
						organization: present(row.addressOrganization),
					} :
				undefined,
			location: hasLocation ? { latitude: present(row.latitude), longitude: present(row.longitude) } : undefined,
		}))
	},
}

export const retailerListingMapper = {
	toRow(message: MessageShape<typeof RetailerListingSchema>): typeof retailerListings.$inferSelect {
		const m = validated(RetailerListingSchema, message)
		return {
			id: m.id, retailerId: m.retailerId, productId: m.productId, retailerProductId: m.retailerProductId,
			name: isFieldSet(m, RetailerListingSchema.field.name) ? m.name : null,
			rawPackageDescription: isFieldSet(m, RetailerListingSchema.field.rawPackageDescription) ? m.rawPackageDescription : null,
		}
	},
	fromRow(row: typeof retailerListings.$inferSelect) {
		return validated(RetailerListingSchema, create(RetailerListingSchema, {
			id: row.id, retailerId: row.retailerId, productId: row.productId, retailerProductId: row.retailerProductId,
			...(row.name === null ? {} : { name: row.name }),
			...(row.rawPackageDescription === null ? {} : { rawPackageDescription: row.rawPackageDescription }),
		}))
	},
}

export const offerMapper = {
	toRow(message: MessageShape<typeof OfferSchema>): typeof currentOffers.$inferSelect {
		const m = validated(OfferSchema, message)
		// Date handles only the integral seconds/calendar; microseconds never enter Date.
		const calendar = new Date(Number(m.observedAt.seconds * 1000n)).toISOString().slice(0, 19)
		return {
			retailerListingId: m.retailerListingId, storeId: m.storeId,
			priceCurrencyCode: m.price.currencyCode, priceUnits: m.price.units, priceNanos: m.price.nanos,
			regularPriceCurrencyCode: m.regularPrice?.currencyCode ?? null,
			regularPriceUnits: m.regularPrice?.units ?? null, regularPriceNanos: m.regularPrice?.nanos ?? null,
			availabilityStatus: m.availability.case === "status" ? m.availability.value : null,
			availabilityQuantity: m.availability.case === "quantity" ? BigInt(m.availability.value) : null,
			observedAt: `${calendar}.${String(m.observedAt.nanos / 1000).padStart(6, "0")}Z`,
		}
	},
	fromRow(row: typeof currentOffers.$inferSelect) {
		const hasRegular = group([row.regularPriceCurrencyCode, row.regularPriceUnits, row.regularPriceNanos])
		if ((row.availabilityStatus === null) === (row.availabilityQuantity === null)) throw new Error("Invalid persisted availability oneof")
		// pg/Drizzle string mode returns PostgreSQL's ISO DateStyle, including +00 offsets.
		const timestamp = row.observedAt.replace(" ", "T").replace(/([+-]\d{2})$/u, "$1:00")
		return validated(OfferSchema, create(OfferSchema, {
			retailerListingId: row.retailerListingId, storeId: row.storeId,
			price: { currencyCode: row.priceCurrencyCode, units: row.priceUnits, nanos: row.priceNanos },
			regularPrice: hasRegular ? { currencyCode: present(row.regularPriceCurrencyCode), units: present(row.regularPriceUnits), nanos: present(row.regularPriceNanos) } : undefined,
			availability: row.availabilityStatus !== null ? { case: "status", value: row.availabilityStatus as Offer_AvailabilityStatus } : { case: "quantity", value: Number(present(row.availabilityQuantity)) },
			observedAt: fromJson(TimestampSchema, timestamp),
		}))
	},
}
