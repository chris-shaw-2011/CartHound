ALTER TABLE "products" DROP CONSTRAINT "products_uuid_v7";--> statement-breakpoint
ALTER TABLE "retailer_listings" DROP CONSTRAINT "retailer_listings_uuid_v7";--> statement-breakpoint
ALTER TABLE "retailers" DROP CONSTRAINT "retailers_uuid_v7";--> statement-breakpoint
ALTER TABLE "stores" DROP CONSTRAINT "stores_uuid_v7";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uuid_v7" CHECK ((uuid_extract_version("products"."id") = 7) is true);--> statement-breakpoint
ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_uuid_v7" CHECK ((uuid_extract_version("retailer_listings"."id") = 7) is true);--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_uuid_v7" CHECK ((uuid_extract_version("retailers"."id") = 7) is true);--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_uuid_v7" CHECK ((uuid_extract_version("stores"."id") = 7) is true);