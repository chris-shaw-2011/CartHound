import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { create, toBinary, ScalarType, type DescMessage } from "@bufbuild/protobuf"
import { DescriptorProtoSchema, TimestampSchema } from "@bufbuild/protobuf/wkt"
import { createValidator } from "@bufbuild/protovalidate"
import * as proto from "@carthound/proto"
import { getTableColumns, getTableName, is, Table } from "drizzle-orm"
import { getTableConfig, PgDialect, type PgColumn, type PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { coverage } from "./coverage.ts"
import fingerprints from "./constraints.json" with { type: "json" }
import * as schema from "./schema.ts"

const descriptors = new Map<string, DescMessage>()
function visit(message: DescMessage) {
	if (descriptors.has(message.typeName)) return
	descriptors.set(message.typeName, message)
	for (const field of message.fields) if (field.message) visit(field.message)
}
for (const value of Object.values(proto)) {
	if (typeof value === "object" && "kind" in value && value.kind === "message" && value.typeName.startsWith("carthound.")) visit(value)
}
const tables = Object.values(schema).filter(value => is(value, Table))
const columns = new Set(tables.flatMap(table => (Object.values(getTableColumns(table)) as PgColumn[]).map(column => `${getTableName(table)}.${column.name}`)))
const dialect = new PgDialect()
const validator = createValidator()
const id = "019f049b-0000-7000-8000-000000000001"
const product = { id, name: "Butter", itemSize: { value: "1" }, itemSizeUnit: 0 as const }

const projectionSQL = readFileSync(new URL("../migrations/0002_tag_projection.sql", import.meta.url), "utf8")

describe("canonical persistence contract", () => {
	it("accounts for every canonical and flattened Google field and its structure", () => {
		expect([...descriptors.keys()].sort()).toEqual(Object.keys(coverage).sort())
		const mappedColumns = new Set<string>()
		for (const [name, fields] of Object.entries(coverage)) {
			const message = descriptors.get(name)
			expect(message).toBeDefined()
			expect(message?.fields.map(field => field.name).sort()).toEqual(Object.keys(fields).sort())
			for (const field of message?.fields ?? []) {
				const entry = fields[field.name]
				if (!entry) throw new Error(`Unmapped field ${name}.${field.name}`)
				expect(entry.signature).toEqual([field.number, field.fieldKind, field.scalar ?? field.message?.typeName ?? field.enum?.typeName ?? null, (field.fieldKind === "list" ? field.listKind : null), field.presence, field.oneof?.name ?? null])
				const [kind, ...targets] = entry.disposition
				expect(["column", "array", "reference", "flattened", "oneof", "derived"]).toContain(kind)
				expect(targets.length).toBeGreaterThan(0)
				for (const target of targets) {
					if (kind === "flattened") expect(descriptors.has(target)).toBe(true)
					else {
						expect(columns.has(target)).toBe(true)
						mappedColumns.add(target)
					}
				}
			}
		}
		// Projection data is the only non-domain table.
		expect([...columns].filter(column => !mappedColumns.has(column)).sort()).toEqual(["tag_projection.product_count", "tag_projection.tag"])
	})
	it("requires explicit review when canonical validation changes", () => {
		const actual = Object.fromEntries([...descriptors].map(([name, message]) => [name, createHash("sha256").update(toBinary(DescriptorProtoSchema, message.proto)).digest("hex")]))
		expect(actual).toEqual(fingerprints)
	})
	it("agrees on all defined enum values, including gaps", () => {
		expect(schema.measurementUnits).toEqual(proto.Product_MeasurementUnitSchema.values.map(value => value.number))
		expect(schema.availabilityStatuses).toEqual(proto.Offer_AvailabilityStatusSchema.values.map(value => value.number))
		for (const value of schema.measurementUnits) expect(validator.validate(proto.ProductSchema, create(proto.ProductSchema, { ...product, itemSizeUnit: value as proto.Product_MeasurementUnit })).kind).toBe("valid")
		expect(validator.validate(proto.ProductSchema, create(proto.ProductSchema, { ...product, itemSizeUnit: 11 as proto.Product_MeasurementUnit })).kind).toBe("invalid")
	})
	it("audits every uint32 and uses bounded bigint columns", () => {
		const fields = [...descriptors.values()].flatMap(message => message.fields.filter(field => field.scalar === ScalarType.UINT32).map(field => `${message.typeName}.${field.name}`))
		expect(fields.sort()).toEqual(["carthound.v1.Offer.quantity", "carthound.v1.Product.item_count"])
		expect(schema.uint32Max).toBe(4_294_967_295n)
		expect(schema.products.itemCount.getSQLType()).toBe("bigint")
		expect(schema.currentOffers.availabilityQuantity.getSQLType()).toBe("bigint")
		expect(validator.validate(proto.ProductSchema, create(proto.ProductSchema, { ...product, itemCount: Number(schema.uint32Max) })).kind).toBe("valid")
		expect(validator.validate(proto.ProductSchema, create(proto.ProductSchema, { ...product, itemCount: Number(schema.uint32Max + 1n) })).kind).toBe("invalid")
	})
	it("uses native UUIDv7 without database identity generation", () => {
		for (const table of [schema.products, schema.retailers, schema.stores, schema.retailerListings]) {
			expect(table.id.getSQLType()).toBe("uuid")
			expect(table.id.hasDefault).toBe(false)
			expect(getTableConfig(table).checks.some(c => dialect.sqlToQuery(c.value).sql.includes("uuid_extract_version"))).toBe(true)
		}
		expect(validator.validate(proto.ProductSchema, create(proto.ProductSchema, { ...product, id: "550e8400-e29b-41d4-a716-446655440000" })).kind).toBe("invalid")
	})
	it("uses exact numeric, Money bigint and microsecond string columns", () => {
		expect(schema.products.itemSize.getSQLType()).toBe("numeric")
		expect(schema.products.gtin.getSQLType()).toBe("text")
		expect(schema.currentOffers.priceUnits.getSQLType()).toBe("bigint")
		expect(schema.currentOffers.observedAt.getSQLType()).toBe("timestamp(6) with time zone")
		expect(schema.currentOffers.observedAt.mapFromDriverValue("1970-01-01 00:00:01.123456+00")).toBe("1970-01-01 00:00:01.123456+00")
		expect(TimestampSchema.fields.map(field => field.name)).toEqual(["seconds", "nanos"])
	})
	it("keeps Offer projections identical except keys/indexes and uses hard cascades", () => {
		expect(Object.values(getTableColumns(schema.currentOffers)).map(c => [c.name, c.getSQLType(), c.notNull])).toEqual(Object.values(getTableColumns(schema.offerHistory)).map(c => [c.name, c.getSQLType(), c.notNull]))
		expect(getTableConfig(schema.currentOffers).primaryKeys[0]?.columns.map(c => c.name)).toEqual(["retailer_listing_id", "store_id"])
		expect(getTableConfig(schema.offerHistory).primaryKeys[0]?.columns.map(c => c.name)).toEqual(["retailer_listing_id", "store_id", "observed_at"])
		for (const table of tables) {
			for (const fk of getTableConfig(table).foreignKeys) expect(fk.onDelete).toBe("cascade")
			expect((Object.values(getTableColumns(table)) as PgColumn[]).some(c => /deleted|active|tombstone/u.test(c.name))).toBe(false)
		}
	})
	it("mirrors canonical scalar bounds and presence groups in SQL checks", () => {
		const checks = (table: PgTable) => Object.fromEntries(getTableConfig(table).checks.map(constraint => [constraint.name, dialect.sqlToQuery(constraint.value).sql.replace(/"[^"]+"\./gu, "").replaceAll("\"", "")]))
		expect(checks(schema.products)).toMatchObject({
			products_gtin: "gtin ~ '^[0-9]{14}$'",
			products_item_count: "item_count between 1 and 4294967295",
			products_unit: `item_size_unit in (${proto.Product_MeasurementUnitSchema.values.map(value => value.number).join(", ")})`,
			products_size: "item_size > 0 and item_size < 'Infinity'::numeric",
		})
		for (const table of [schema.currentOffers, schema.offerHistory]) {
			const constraints = checks(table)
			const prefix = getTableName(table)
			expect(constraints[`${prefix}_price`]).toBe("price_currency_code ~ '^[A-Z]{3}$' and price_units >= 0 and price_nanos between 0 and 999999999 and (price_units > 0 or price_nanos > 0)")
			expect(constraints[`${prefix}_availability`]).toBe(`num_nonnulls(availability_status, availability_quantity) = 1 and (availability_status is null or availability_status in (${proto.Offer_AvailabilityStatusSchema.values.map(value => value.number).join(", ")})) and (availability_quantity is null or availability_quantity between 1 and 4294967295)`)
			expect(constraints[`${prefix}_regular_price`]).toBe("num_nonnulls(regular_price_currency_code, regular_price_units, regular_price_nanos) in (0, 3) and regular_price_currency_code = price_currency_code and regular_price_units >= 0 and regular_price_nanos between 0 and 999999999 and (regular_price_units, regular_price_nanos) >= (price_units, price_nanos)")
		}
		expect(checks(schema.stores).stores_location).toBe("num_nonnulls(latitude, longitude) in (0, 2) and latitude between -90 and 90 and longitude between -180 and 180")
		expect(checks(schema.stores).stores_address_presence).toContain("in (0, 11)")
		expect(checks(schema.retailers).retailers_slug_bytes).toBe("octet_length(slug) <= 2692")
		expect(checks(schema.stores).stores_identifier_bytes).toBe("octet_length(retailer_store_id) <= 2676")
		expect(checks(schema.retailerListings).retailer_listings_identifier_bytes).toBe("octet_length(retailer_product_id) <= 2676")
		expect(checks(schema.tagProjection).tag_projection_tag_bytes).toBe("octet_length(tag) <= 2692")
	})
	it("keeps persistence inaccessible to browser package resolution", () => {
		const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { exports: Record<string, string> }
		expect(manifest.exports).toEqual({ node: "./src/index.ts" })
		for (const path of ["../../../apps/web/package.json", "../../core/package.json", "../../proto/package.json", "../../retailers/package.json"]) {
			const dependency = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { dependencies?: Record<string, string> }
			expect(dependency.dependencies ?? {}).not.toHaveProperty("@carthound/persistence")
		}
	})

	it("provides array GIN, trigram autocomplete, and transactional projection maintenance", () => {
		expect(tables.map(getTableName).sort()).toEqual(["current_offers", "offer_history", "products", "retailer_listings", "retailers", "stores", "tag_projection"])
		expect(schema.products.tags.getSQLType()).toBe("text[]")
		expect(getTableConfig(schema.products).indexes[0]?.config.method).toBe("gin")
		expect(getTableConfig(schema.tagProjection).indexes[0]?.config.columns[0]).toMatchObject({ indexConfig: { opClass: "gin_trgm_ops" } })
		expect(readFileSync(new URL("../migrations/0000_extensions.sql", import.meta.url), "utf8")).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm")
		for (const fragment of ["AFTER INSERT OR DELETE OR UPDATE OF tags", "EXCEPT SELECT unnest(old_tags)", "EXCEPT SELECT unnest(new_tags)", "product_count + 1", "product_count - 1", "product_count = 1", "pg_advisory_xact_lock", "LOCK TABLE products", "SELECT rebuild_tag_projection()", "count(*) FROM products"]) expect(projectionSQL).toContain(fragment)
	})
})
