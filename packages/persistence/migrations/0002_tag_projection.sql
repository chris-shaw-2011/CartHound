-- products.tags is authoritative. Serialize each changed tag even when its
-- projection row does not yet exist. Sorted lock order limits deadlock risk;
-- as with any multi-row PostgreSQL transaction, callers must retry deadlocks.
CREATE FUNCTION maintain_tag_projection() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_tags text[] := '{}';
  new_tags text[] := '{}';
  changed_tag text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_tags := OLD.tags; END IF;
  IF TG_OP <> 'DELETE' THEN new_tags := NEW.tags; END IF;
  IF old_tags IS NOT DISTINCT FROM new_tags THEN RETURN NULL; END IF;

  FOR changed_tag IN
    SELECT tag FROM (
      (SELECT unnest(new_tags) AS tag EXCEPT SELECT unnest(old_tags))
      UNION
      (SELECT unnest(old_tags) AS tag EXCEPT SELECT unnest(new_tags))
    ) AS changed ORDER BY tag COLLATE "C"
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(changed_tag, 0));
    IF changed_tag = ANY(new_tags) THEN
      INSERT INTO tag_projection(tag, product_count) VALUES (changed_tag, 1)
      ON CONFLICT (tag) DO UPDATE
        SET product_count = tag_projection.product_count + 1;
    ELSE
      DELETE FROM tag_projection WHERE tag = changed_tag AND product_count = 1;
      IF NOT FOUND THEN
        UPDATE tag_projection SET product_count = product_count - 1
          WHERE tag = changed_tag;
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_tag_projection
AFTER INSERT OR DELETE OR UPDATE OF tags ON products
FOR EACH ROW EXECUTE FUNCTION maintain_tag_projection();
--> statement-breakpoint
-- Lock products first so no writer can race the rebuild or hold projection
-- locks while the rebuild waits on products. Run inside a transaction.
CREATE FUNCTION rebuild_tag_projection() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE tag_projection IN EXCLUSIVE MODE;
  DELETE FROM tag_projection;
  INSERT INTO tag_projection(tag, product_count)
    SELECT tag, count(*) FROM products
    CROSS JOIN LATERAL (SELECT DISTINCT unnest(tags) AS tag) AS product_tags
    GROUP BY tag;
END;
$$;
--> statement-breakpoint
SELECT rebuild_tag_projection();
--> statement-breakpoint
-- Historical observations are immutable; hard deletes, including FK cascades,
-- remain permitted. Corrections are new observations, never UPDATEs.
CREATE FUNCTION reject_offer_history_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'offer_history observations cannot be updated';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER offer_history_immutable BEFORE UPDATE ON offer_history
FOR EACH ROW EXECUTE FUNCTION reject_offer_history_update();
