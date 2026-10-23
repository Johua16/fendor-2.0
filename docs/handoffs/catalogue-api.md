# Catalogue API — first implementation contract

Branch: `codex/vendor-catalogue`, dependent on the accounts/vendor approval PR. Endpoint contract for frontend review and integration; this does not change the agreed screen ownership. No UI screens are included. Account API cookie, same-origin POST, JSON, body limit, no-store and error conventions apply.

## Listing journey

Approved vendor creates a draft → submits → Fendor administrator approves or rejects → only approved products of currently approved vendors appear publicly. A vendor can pause an approved or pending listing. Admin can pause an approved listing. Editing any listing returns it to draft and removes public visibility until a fresh approval. Rejected/paused listings can be resubmitted. Suspension hides all that vendor's products immediately, including direct detail requests. Reviewers cannot approve their own products.

This first slice has one purchasable variant per listing. Do not build a multiple-size/colour editor against these endpoints yet. Category keys are `flowers`, `cakes`, `hampers`, `personalised-gifts`, `fashion`, `home`, `other`; confirm display labels against the approved designs.

## Routes

| Method | Path | Result |
|---|---|---|
| GET | /api/products | Public list, filters and pagination |
| GET | /api/products/:id | Public product; 404 if not visible |
| GET | /api/vendor/products | Own products; approved vendor session required |
| GET | /api/vendor/products/:id | Own product with management fields |
| POST | /api/vendor/products | Create draft; 201 `{product}` |
| POST | /api/vendor/products/:id/edit | Replace editable content; `{product}` |
| POST | /api/vendor/products/:id/submit | Submit for review; `{product}` |
| POST | /api/vendor/products/:id/pause | Hide listing; `{product}` |
| GET | /api/admin/products | All products for administrator review |
| GET | /api/admin/products/:id | Full management details for review |
| POST | /api/admin/products/:id/review | Review or pause; `{product}` |

No public creation or status-setting endpoint exists. Server loads the actor and ownership from the session; never send vendorId, userId, role, status or reservedQuantity.

### Create body / edit body

Create requires exactly these editable fields. Edit requires all of them plus the latest integer `version` (full replacement, not PATCH):

```json
{
  "title": "Celebration hamper",
  "description": "A selection of gifts in a presentation box.",
  "category": "hampers",
  "imagePath": "/media/catalogue/hamper.webp",
  "sku": "HAMPER-1",
  "priceKobo": 2500000,
  "stockQuantity": 5
}
```

Price is a positive safe integer in NGN kobo; stock is an integer 0–2,147,483,647. Title 2–160 characters, description 10–4,000, SKU 1–80. SKU is unique per vendor. Images may be null in draft, but are required for submission. Only `/media/catalogue/<letters-digits-underscore-hyphen>.(jpg|jpeg|png|webp)` paths are accepted. No external URLs, SVG, data URLs or HTML. API does not upload, fetch or validate the actual image file. Fendor must provision the image in `apps/web/public/media/catalogue/` and check it during approval; use immutable filenames. Media upload/storage and automated media validation are not delivered here. Render title/description as plain text, never HTML.

Submit/pause body: `{"version":0}`. Review body: `{"version":1,"decision":"approved","note":"Reviewed content and image"}`. Decisions: `approved`/`rejected` only from under_review; `paused` only from approved. Review note required, 1–1,000 characters. Each change increments version and records an audit event in the same transaction.

### Response shapes

Lists: `{products:[...],nextCursor:string|null}`. Detail/mutations: `{product:{...}}`.

Public product: `id,title,description,category,imagePath,variantId,priceKobo,currency:"NGN",availability:"confirmation_required"`.

Vendor/admin product adds `status,version,reviewNote,sku,stockQuantity,reservedQuantity`. No vendor identity/contact, registration information or stock quantities are exposed publicly. A product's price is the product price only, not an accepted quote including packaging/delivery.

### Filtering and pagination

All list routes accept `limit` (default 20, maximum 50), `after` (nextCursor from previous page), `category`, and `q` (literal case-insensitive title substring, maximum 100 characters). Vendor/admin lists also accept `status`. Results use ascending UUID keyset order; no popularity or recency ranking is implied. Pagination is not a frozen snapshot: new listings may require a refresh. Unknown or repeated query parameters are rejected.

### Error and retry behaviour

- 400: invalid field, image required, invalid filters, unknown fields.
- 401: missing/expired session. 403: wrong role, unapproved vendor, self-review.
- 404: hidden/missing product or another vendor's product.
- 409 `STALE_VERSION`: reload before offering to reapply edits. Do not silently overwrite.
- 409 `SKU_EXISTS`: SKU already in use. A lost create response must be reconciled by refreshing own listings; creation is not idempotent and must not be blindly retried.
- 409 `INVALID_STATE`: refresh the current state.
- 409 `ACTIVE_RESERVATIONS`: editing is blocked until reservations are resolved through Fendor. Pausing hides the listing but does not cancel existing orders/reservations.
- 503: configuration/database failure; no simulated success.

Stock quantity is vendor-reported, not a guarantee or a reservation. Zero stock may still appear as confirmation_required; do not label it in stock or offer instant checkout. No order, reservation, payment or dispatch is created by these routes. Stock freshness, multiple variants, image upload, inventory reservation and checkout remain subsequent increments.
