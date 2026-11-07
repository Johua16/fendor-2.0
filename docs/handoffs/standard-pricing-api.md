# Standard checkout pricing

GET /api/packaging-options returns active {id,name,priceKobo} options (kobo strings).
POST /api/orders/:id/auto-quote accepts {version,packagingId}. Only the owning verified customer may call it. Requires reserved stock, a current product/vendor, an active priced delivery zone and no pending payment. Server computes the total from the product snapshot, packaging rate and destination rate. Customer-supplied prices are rejected. The result uses existing quote acceptance and provider payment APIs.

GET /api/admin/standard-prices returns packaging and active destination prices. POST accepts {kind:'packaging'|'zone',id,priceKobo,previousPriceKobo}. Requires an admin; priceKobo is a non-negative integer and previousPriceKobo is the returned string or null. Updates are audited and stale updates rejected. Existing quotes retain their totals.

Apply migration 010-standard-pricing.sql. Destination fees are nullable until explicitly configured; there is no free-delivery fallback. Packaging prices apply once per individual product order, as does delivery; multi-product checkout consolidation remains separate work. Local test fixtures are not production rates.
