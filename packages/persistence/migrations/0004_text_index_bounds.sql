ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_identifier_bytes" CHECK (octet_length("retailer_listings"."retailer_product_id") <= 2676);--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_slug_bytes" CHECK (octet_length("retailers"."slug") <= 2692);--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_identifier_bytes" CHECK (octet_length("stores"."retailer_store_id") <= 2676);--> statement-breakpoint
ALTER TABLE "tag_projection" ADD CONSTRAINT "tag_projection_tag_bytes" CHECK (octet_length("tag_projection"."tag") <= 2692);