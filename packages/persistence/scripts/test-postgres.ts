import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { fileURLToPath } from "node:url"
import { create, equals } from "@bufbuild/protobuf"
import { OfferSchema, ProductSchema, RetailerListingSchema, RetailerSchema, StoreSchema } from "@carthound/proto"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { offerMapper, productMapper, retailerListingMapper, retailerMapper, storeMapper } from "../src/mappers.ts"
import { checkCompatibility, postgresPoolConfig } from "./database.ts"
import { currentOffers, offerHistory, products, retailerListings, retailers, stores, tagProjection } from "../src/schema.ts"

// Explicit integration command only. Supply a disposable PostgreSQL 18.6 database.
const connectionString = process.env.CARTHOUND_TEST_DATABASE_URL
if (!connectionString) throw new Error("Set CARTHOUND_TEST_DATABASE_URL to a disposable PostgreSQL 18.6 test database")
const pool = new pg.Pool(postgresPoolConfig(connectionString))
try {
	const client = await pool.connect()
	try {
		await checkCompatibility(client)
		const session = await client.query<{ current_schema: string, search_path: string, timezone: string, date_style: string }>(
			"SELECT current_schema(), current_setting('search_path') AS search_path, current_setting('TimeZone') AS timezone, current_setting('DateStyle') AS date_style",
		)
		assert.deepEqual(
			session.rows,
			[{ current_schema: "public", search_path: "public", timezone: "UTC", date_style: "ISO, MDY" }],
			"CartHound connections must enforce public schema, UTC and ISO DateStyle",
		)
		const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
		assert.equal(tables.rows.length, 0, "Integration tests require an empty disposable database")
		const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url))
		await migrate(drizzle(client), { migrationsFolder })
		await migrate(drizzle(client), { migrationsFolder })
	}
	finally { client.release() }
	const db = drizzle(pool)
	const id = "019f049b-0000-7000-8000-000000000001"
	const secondId = "019f049b-0000-7000-8000-000000000002"
	const product = create(ProductSchema, { id, name: "Butter", itemSize: { value: "+001.2000" }, itemSizeUnit: 1, tags: ["butter", "salted"], itemCount: 4_294_967_295 })
	const counts = async () => Object.fromEntries((await db.select().from(tagProjection)).map(row => [row.tag, row.productCount]))
	await db.insert(products).values(productMapper.toRow(product))
	assert.deepEqual(await counts(), { butter: 1n, salted: 1n })
	const [productRow] = await db.select().from(products)
	assert(productRow && equals(ProductSchema, productMapper.fromRow(productRow), product))
	await db.insert(products).values(productMapper.toRow(create(ProductSchema, { ...product, id: secondId, tags: ["butter"] })))
	assert.deepEqual(await counts(), { butter: 2n, salted: 1n })
	await db.update(products).set({ tags: ["butter", "organic"] }).where(eq(products.id, id))
	assert.deepEqual(await counts(), { butter: 2n, organic: 1n })
	// Unchanged/reordered tags retain counts; a projection rebuild has identical data.
	await db.update(products).set({ tags: ["organic", "butter"] }).where(eq(products.id, id))
	assert.deepEqual(await counts(), { butter: 2n, organic: 1n })
	await pool.query("SELECT rebuild_tag_projection()")
	assert.deepEqual(await counts(), { butter: 2n, organic: 1n })
	await db.delete(products).where(eq(products.id, secondId))
	assert.deepEqual(await counts(), { butter: 1n, organic: 1n })
	// Concurrent writers introduce the same initially absent tag.
	await Promise.all([id, secondId].map((productId, index) => index === 0 ?
			db.update(products).set({ tags: ["butter", "organic", "shared"] }).where(eq(products.id, productId)) :
			db.insert(products).values(productMapper.toRow(create(ProductSchema, { ...product, id: productId, tags: ["shared"] })))))
	assert.deepEqual(await counts(), { butter: 1n, organic: 1n, shared: 2n })
	await db.insert(retailers).values(retailerMapper.toRow(create(RetailerSchema, { id, slug: "kroger", name: "Kroger" })))
	await db.insert(stores).values(storeMapper.toRow(create(StoreSchema, { id, retailerId: id, retailerStoreId: "001", name: "Main", address: { regionCode: "US", addressLines: ["1 Main", "Suite 2"] }, location: { latitude: 0, longitude: 0 } })))
	await db.insert(retailerListings).values(retailerListingMapper.toRow(create(RetailerListingSchema, { id, retailerId: id, productId: id, retailerProductId: "001" })))
	const offer = create(OfferSchema, { retailerListingId: id, storeId: id, observedAt: { seconds: 1n, nanos: 123_456_000 }, price: { currencyCode: "USD", units: 9_223_372_036_854_775_807n, nanos: 999_999_999 }, availability: { case: "quantity", value: 4_294_967_295 } })
	await db.insert(currentOffers).values(offerMapper.toRow(offer))
	await db.insert(offerHistory).values(offerMapper.toRow(offer))
	const [offerRow] = await db.select().from(currentOffers)
	assert(offerRow && equals(OfferSchema, offerMapper.fromRow(offerRow), offer))
	await assert.rejects(db.update(offerHistory).set({ priceNanos: 1 }))
	// Every required dependent-parent cascade is exercised independently.
	const cascadeClient = await pool.connect()
	try {
		for (const table of [products, stores, retailerListings]) {
			await cascadeClient.query("BEGIN")
			try {
				const transaction = drizzle(cascadeClient)
				await transaction.delete(table).where(eq(table.id, id))
				assert.equal((await transaction.select().from(currentOffers)).length, 0)
				assert.equal((await transaction.select().from(offerHistory)).length, 0)
			}
			finally { await cascadeClient.query("ROLLBACK") }
		}
	}
	finally { cascadeClient.release() }
	await db.delete(retailers).where(eq(retailers.id, id))
	assert.equal((await db.select().from(stores)).length, 0)
	assert.equal((await db.select().from(retailerListings)).length, 0)
	assert.equal((await db.select().from(currentOffers)).length, 0)
	assert.equal((await db.select().from(offerHistory)).length, 0)
	assert.equal((await db.select().from(products)).length, 2)
	await db.delete(products)
	assert.deepEqual(await counts(), {})
	// Incompressible text verifies physical index capacity, independent of TOAST.
	const tag = randomBytes(1346).toString("hex")
	await db.insert(products).values(productMapper.toRow(create(ProductSchema, { ...product, tags: [tag] })))
	await db.insert(retailers).values(retailerMapper.toRow(create(RetailerSchema, { id, name: "Boundary", slug: tag })))
	await db.insert(stores).values(storeMapper.toRow(create(StoreSchema, { id, retailerId: id, retailerStoreId: randomBytes(1338).toString("hex"), name: "Boundary" })))
	await db.insert(retailerListings).values(retailerListingMapper.toRow(create(RetailerListingSchema, { id, retailerId: id, productId: id, retailerProductId: randomBytes(1338).toString("hex") })))
	assert.deepEqual(await counts(), { [tag]: 1n })
	process.stdout.write("PostgreSQL migrations, exact driver round trips, tag projection, concurrency and retailer cascade checks passed\n")
}
finally {
	await pool.end()
}
