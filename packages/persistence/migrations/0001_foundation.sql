CREATE TABLE "current_offers" (
	"retailer_listing_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"price_currency_code" text NOT NULL,
	"price_units" bigint NOT NULL,
	"price_nanos" integer NOT NULL,
	"regular_price_currency_code" text,
	"regular_price_units" bigint,
	"regular_price_nanos" integer,
	"availability_status" integer,
	"availability_quantity" bigint,
	"observed_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "current_offers_retailer_listing_id_store_id_pk" PRIMARY KEY("retailer_listing_id","store_id"),
	CONSTRAINT "current_offers_price" CHECK ("current_offers"."price_currency_code" ~ '^[A-Z]{3}$' and "current_offers"."price_units" >= 0 and "current_offers"."price_nanos" between 0 and 999999999 and ("current_offers"."price_units" > 0 or "current_offers"."price_nanos" > 0)),
	CONSTRAINT "current_offers_regular_price" CHECK (num_nonnulls("current_offers"."regular_price_currency_code", "current_offers"."regular_price_units", "current_offers"."regular_price_nanos") in (0, 3) and "current_offers"."regular_price_currency_code" = "current_offers"."price_currency_code" and "current_offers"."regular_price_units" >= 0 and "current_offers"."regular_price_nanos" between 0 and 999999999 and ("current_offers"."regular_price_units", "current_offers"."regular_price_nanos") >= ("current_offers"."price_units", "current_offers"."price_nanos")),
	CONSTRAINT "current_offers_availability" CHECK (num_nonnulls("current_offers"."availability_status", "current_offers"."availability_quantity") = 1 and ("current_offers"."availability_status" is null or "current_offers"."availability_status" in (0, 1, 2)) and ("current_offers"."availability_quantity" is null or "current_offers"."availability_quantity" between 1 and 4294967295)),
	CONSTRAINT "current_offers_timestamp" CHECK ("current_offers"."observed_at" >= '0001-01-01T00:00:00Z'::timestamptz and "current_offers"."observed_at" <= '9999-12-31T23:59:59.999999Z'::timestamptz)
);
--> statement-breakpoint
CREATE TABLE "offer_history" (
	"retailer_listing_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"price_currency_code" text NOT NULL,
	"price_units" bigint NOT NULL,
	"price_nanos" integer NOT NULL,
	"regular_price_currency_code" text,
	"regular_price_units" bigint,
	"regular_price_nanos" integer,
	"availability_status" integer,
	"availability_quantity" bigint,
	"observed_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "offer_history_retailer_listing_id_store_id_observed_at_pk" PRIMARY KEY("retailer_listing_id","store_id","observed_at"),
	CONSTRAINT "offer_history_price" CHECK ("offer_history"."price_currency_code" ~ '^[A-Z]{3}$' and "offer_history"."price_units" >= 0 and "offer_history"."price_nanos" between 0 and 999999999 and ("offer_history"."price_units" > 0 or "offer_history"."price_nanos" > 0)),
	CONSTRAINT "offer_history_regular_price" CHECK (num_nonnulls("offer_history"."regular_price_currency_code", "offer_history"."regular_price_units", "offer_history"."regular_price_nanos") in (0, 3) and "offer_history"."regular_price_currency_code" = "offer_history"."price_currency_code" and "offer_history"."regular_price_units" >= 0 and "offer_history"."regular_price_nanos" between 0 and 999999999 and ("offer_history"."regular_price_units", "offer_history"."regular_price_nanos") >= ("offer_history"."price_units", "offer_history"."price_nanos")),
	CONSTRAINT "offer_history_availability" CHECK (num_nonnulls("offer_history"."availability_status", "offer_history"."availability_quantity") = 1 and ("offer_history"."availability_status" is null or "offer_history"."availability_status" in (0, 1, 2)) and ("offer_history"."availability_quantity" is null or "offer_history"."availability_quantity" between 1 and 4294967295)),
	CONSTRAINT "offer_history_timestamp" CHECK ("offer_history"."observed_at" >= '0001-01-01T00:00:00Z'::timestamptz and "offer_history"."observed_at" <= '9999-12-31T23:59:59.999999Z'::timestamptz)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"gtin" text,
	"name" text NOT NULL,
	"brand" text,
	"item_count" bigint,
	"item_size" numeric NOT NULL,
	"item_size_decimal" text NOT NULL,
	"item_size_unit" integer NOT NULL,
	"tags" text[] NOT NULL,
	CONSTRAINT "products_gtin_unique" UNIQUE("gtin"),
	CONSTRAINT "products_uuid_v7" CHECK (uuid_extract_version("products"."id") = 7),
	CONSTRAINT "products_gtin" CHECK ("products"."gtin" ~ '^[0-9]{14}$'),
	CONSTRAINT "products_item_count" CHECK ("products"."item_count" between 1 and 4294967295),
	CONSTRAINT "products_unit" CHECK ("products"."item_size_unit" in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12)),
	CONSTRAINT "products_size" CHECK ("products"."item_size" > 0 and "products"."item_size" < 'Infinity'::numeric)
);
--> statement-breakpoint
CREATE TABLE "retailer_listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"retailer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"retailer_product_id" text NOT NULL,
	"name" text,
	"raw_package_description" text,
	CONSTRAINT "retailer_listings_retailer_identifier" UNIQUE("retailer_id","retailer_product_id"),
	CONSTRAINT "retailer_listings_uuid_v7" CHECK (uuid_extract_version("retailer_listings"."id") = 7)
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "retailers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "retailers_uuid_v7" CHECK (uuid_extract_version("retailers"."id") = 7)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"retailer_id" uuid NOT NULL,
	"retailer_store_id" text NOT NULL,
	"name" text NOT NULL,
	"address_revision" integer,
	"address_region_code" text,
	"address_language_code" text,
	"address_postal_code" text,
	"address_sorting_code" text,
	"address_administrative_area" text,
	"address_locality" text,
	"address_sublocality" text,
	"address_lines" text[],
	"address_recipients" text[],
	"address_organization" text,
	"latitude" double precision,
	"longitude" double precision,
	CONSTRAINT "stores_retailer_identifier" UNIQUE("retailer_id","retailer_store_id"),
	CONSTRAINT "stores_uuid_v7" CHECK (uuid_extract_version("stores"."id") = 7),
	CONSTRAINT "stores_address_presence" CHECK (num_nonnulls("stores"."address_revision", "stores"."address_region_code", "stores"."address_language_code", "stores"."address_postal_code", "stores"."address_sorting_code", "stores"."address_administrative_area", "stores"."address_locality", "stores"."address_sublocality", "stores"."address_lines", "stores"."address_recipients", "stores"."address_organization") in (0, 11)),
	CONSTRAINT "stores_address_region" CHECK ("stores"."address_region_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "stores_location" CHECK (num_nonnulls("stores"."latitude", "stores"."longitude") in (0, 2) and "stores"."latitude" between -90 and 90 and "stores"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "tag_projection" (
	"tag" text PRIMARY KEY NOT NULL,
	"product_count" bigint NOT NULL,
	CONSTRAINT "tag_projection_positive_count" CHECK ("tag_projection"."product_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_retailer_listing_id_retailer_listings_id_fk" FOREIGN KEY ("retailer_listing_id") REFERENCES "public"."retailer_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_offers" ADD CONSTRAINT "current_offers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_history" ADD CONSTRAINT "offer_history_retailer_listing_id_retailer_listings_id_fk" FOREIGN KEY ("retailer_listing_id") REFERENCES "public"."retailer_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_history" ADD CONSTRAINT "offer_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "current_offers_store" ON "current_offers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "offer_history_store" ON "offer_history" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "offer_history_observed_at" ON "offer_history" USING brin ("observed_at");--> statement-breakpoint
CREATE INDEX "products_tags_gin" ON "products" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "retailer_listings_product" ON "retailer_listings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tag_projection_tag_trgm" ON "tag_projection" USING gin ("tag" gin_trgm_ops);