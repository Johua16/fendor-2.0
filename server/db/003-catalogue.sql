-- First catalogue contract supports one purchasable option per listing.
ALTER TABLE product_variants ADD CONSTRAINT product_variants_one_per_product UNIQUE(product_id);
ALTER TABLE products ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN category text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN image_path text;
ALTER TABLE products ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK (version >= 0);
ALTER TABLE products ADD COLUMN review_note text;
ALTER TABLE products ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX products_status_id_idx ON products(status,id);
CREATE INDEX products_vendor_id_idx ON products(vendor_user_id,id);
CREATE TABLE product_events (
 id uuid PRIMARY KEY,
 product_id uuid NOT NULL REFERENCES products(id),
 actor_id uuid NOT NULL REFERENCES users(id),
 from_status text,
 to_status text NOT NULL,
 product_version integer NOT NULL,
 note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,product_version)
);
