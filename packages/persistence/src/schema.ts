import { sql } from "drizzle-orm"
import { type PgColumn, bigint, check, doublePrecision, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

// Keep these explicit: descriptor contract tests detect enum and uint32 changes.
export const measurementUnits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]
export const availabilityStatuses = [0, 1, 2]
export const uint32Max = 4_294_967_295n

export const retailers = pgTable("retailers", {
	id: uuid().primaryKey(), slug: text().notNull().unique(), name: text().notNull(),
}, t => [check("retailers_uuid_v7", sql`(uuid_extract_version(${t.id}) = 7) is true`), check("retailers_slug_bytes", sql`octet_length(${t.slug}) <= 2692`)])

export const products = pgTable("products", {
	id: uuid().primaryKey(), gtin: text().unique(), name: text().notNull(), brand: text(),
	itemCount: bigint("item_count", { mode: "bigint" }),
	itemSize: numeric("item_size").notNull(),
	// Google Decimal spelling is observable domain data; NUMERIC alone loses it.
	itemSizeDecimal: text("item_size_decimal").notNull(),
	itemSizeUnit: integer("item_size_unit").notNull(), tags: text().array().notNull(),
}, t => [
	check("products_uuid_v7", sql`(uuid_extract_version(${t.id}) = 7) is true`),
	check("products_gtin", sql`${t.gtin} ~ '^[0-9]{14}$'`),
	check("products_item_count", sql`${t.itemCount} between 1 and ${sql.raw(String(uint32Max))}`),
	check("products_unit", sql`${t.itemSizeUnit} in (${sql.raw(measurementUnits.join(", "))})`),
	check("products_size", sql`${t.itemSize} > 0 and ${t.itemSize} < 'Infinity'::numeric`),
	index("products_tags_gin").using("gin", t.tags),
])

export const stores = pgTable("stores", {
	id: uuid().primaryKey(), retailerId: uuid("retailer_id").notNull().references(() => retailers.id, { onDelete: "cascade" }),
	retailerStoreId: text("retailer_store_id").notNull(), name: text().notNull(),
	addressRevision: integer("address_revision"), addressRegionCode: text("address_region_code"),
	addressLanguageCode: text("address_language_code"), addressPostalCode: text("address_postal_code"),
	addressSortingCode: text("address_sorting_code"), addressAdministrativeArea: text("address_administrative_area"),
	addressLocality: text("address_locality"), addressSublocality: text("address_sublocality"),
	addressLines: text("address_lines").array(), addressRecipients: text("address_recipients").array(),
	addressOrganization: text("address_organization"),
	latitude: doublePrecision(), longitude: doublePrecision(),
}, t => [
	check("stores_uuid_v7", sql`(uuid_extract_version(${t.id}) = 7) is true`),
	check("stores_identifier_bytes", sql`octet_length(${t.retailerStoreId}) <= 2676`),
	unique("stores_retailer_identifier").on(t.retailerId, t.retailerStoreId),
	check("stores_address_presence", sql`num_nonnulls(${t.addressRevision}, ${t.addressRegionCode}, ${t.addressLanguageCode}, ${t.addressPostalCode}, ${t.addressSortingCode}, ${t.addressAdministrativeArea}, ${t.addressLocality}, ${t.addressSublocality}, ${t.addressLines}, ${t.addressRecipients}, ${t.addressOrganization}) in (0, 11)`),
	check("stores_address_region", sql`${t.addressRegionCode} ~ '^[A-Z]{2}$'`),
	check("stores_location", sql`num_nonnulls(${t.latitude}, ${t.longitude}) in (0, 2) and ${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180`),
])

export const retailerListings = pgTable("retailer_listings", {
	id: uuid().primaryKey(), retailerId: uuid("retailer_id").notNull().references(() => retailers.id, { onDelete: "cascade" }),
	productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
	retailerProductId: text("retailer_product_id").notNull(), name: text(), rawPackageDescription: text("raw_package_description"),
}, t => [
	check("retailer_listings_uuid_v7", sql`(uuid_extract_version(${t.id}) = 7) is true`),
	check("retailer_listings_identifier_bytes", sql`octet_length(${t.retailerProductId}) <= 2676`),
	unique("retailer_listings_retailer_identifier").on(t.retailerId, t.retailerProductId),
	index("retailer_listings_product").on(t.productId),
])

function offerColumns() {
	return {
		retailerListingId: uuid("retailer_listing_id").notNull().references(() => retailerListings.id, { onDelete: "cascade" }),
		storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
		priceCurrencyCode: text("price_currency_code").notNull(), priceUnits: bigint("price_units", { mode: "bigint" }).notNull(), priceNanos: integer("price_nanos").notNull(),
		regularPriceCurrencyCode: text("regular_price_currency_code"), regularPriceUnits: bigint("regular_price_units", { mode: "bigint" }), regularPriceNanos: integer("regular_price_nanos"),
		availabilityStatus: integer("availability_status"), availabilityQuantity: bigint("availability_quantity", { mode: "bigint" }),
		observedAt: timestamp("observed_at", { withTimezone: true, precision: 6, mode: "string" }).notNull(),
	}
}

// The two tables project the same Offer, including the same field constraints.
function offerChecks(t: Record<keyof ReturnType<typeof offerColumns>, PgColumn>, prefix: string) {
	return [
		check(`${prefix}_price`, sql`${t.priceCurrencyCode} ~ '^[A-Z]{3}$' and ${t.priceUnits} >= 0 and ${t.priceNanos} between 0 and 999999999 and (${t.priceUnits} > 0 or ${t.priceNanos} > 0)`),
		check(`${prefix}_regular_price`, sql`num_nonnulls(${t.regularPriceCurrencyCode}, ${t.regularPriceUnits}, ${t.regularPriceNanos}) in (0, 3) and ${t.regularPriceCurrencyCode} = ${t.priceCurrencyCode} and ${t.regularPriceUnits} >= 0 and ${t.regularPriceNanos} between 0 and 999999999 and (${t.regularPriceUnits}, ${t.regularPriceNanos}) >= (${t.priceUnits}, ${t.priceNanos})`),
		check(`${prefix}_availability`, sql`num_nonnulls(${t.availabilityStatus}, ${t.availabilityQuantity}) = 1 and (${t.availabilityStatus} is null or ${t.availabilityStatus} in (${sql.raw(availabilityStatuses.join(", "))})) and (${t.availabilityQuantity} is null or ${t.availabilityQuantity} between 1 and ${sql.raw(String(uint32Max))})`),
		check(`${prefix}_timestamp`, sql`${t.observedAt} >= '0001-01-01T00:00:00Z'::timestamptz and ${t.observedAt} <= '9999-12-31T23:59:59.999999Z'::timestamptz`),
	]
}

export const currentOffers = pgTable("current_offers", offerColumns(), t => [
	primaryKey({ columns: [t.retailerListingId, t.storeId] }),
	...offerChecks(t, "current_offers"),
	index("current_offers_store").on(t.storeId),
])
export const offerHistory = pgTable("offer_history", offerColumns(), t => [
	primaryKey({ columns: [t.retailerListingId, t.storeId, t.observedAt] }),
	...offerChecks(t, "offer_history"),
	index("offer_history_store").on(t.storeId),
	index("offer_history_observed_at").using("brin", t.observedAt),
])

export const tagProjection = pgTable("tag_projection", {
	tag: text().primaryKey(), productCount: bigint("product_count", { mode: "bigint" }).notNull(),
}, t => [
	check("tag_projection_tag_bytes", sql`octet_length(${t.tag}) <= 2692`),
	check("tag_projection_positive_count", sql`${t.productCount} > 0`),
	index("tag_projection_tag_trgm").using("gin", t.tag.op("gin_trgm_ops")),
])
