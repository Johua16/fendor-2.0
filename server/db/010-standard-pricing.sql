ALTER TABLE delivery_zones ADD COLUMN fee_kobo bigint CHECK(fee_kobo>=0);
CREATE TABLE packaging_options (
 id text PRIMARY KEY,
 name text NOT NULL,
 price_kobo bigint NOT NULL CHECK(price_kobo>=0),
 active boolean NOT NULL DEFAULT true
);
