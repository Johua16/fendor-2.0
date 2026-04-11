const express = require("express");

const { all, get, getDatabase, run } = require("../db/database");
const requireVendorAuth = require("../middleware/vendor-auth.middleware");

const router = express.Router();

function sanitizeProduct(product) {
  return {
    id: product.id,
    vendor_id: product.vendor_id,
    name: product.name,
    image_url: product.image_url,
    category: product.category,
    description: product.description,
    unit_price: product.unit_price,
    availability_note: product.availability_note,
    is_active: Boolean(product.is_active),
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

function normalizeProductPayload(body, existingProduct) {
  const source = body || {};
  const fallback = existingProduct || {};

  function readText(fieldName) {
    const value = source[fieldName];
    if (value === undefined) {
      return fallback[fieldName] || null;
    }

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  let isActive = fallback.is_active;
  if (source.is_active !== undefined) {
    isActive =
      source.is_active === true ||
      source.is_active === 1 ||
      source.is_active === "1" ||
      source.is_active === "true" ||
      source.is_active === "on";
  }

  let unitPrice = fallback.unit_price;
  if (source.unit_price !== undefined) {
    unitPrice = Number(source.unit_price);
  }

  return {
    name: readText("name"),
    image_url: readText("image_url"),
    category: readText("category"),
    description: readText("description"),
    unit_price: unitPrice,
    availability_note: readText("availability_note"),
    is_active: Boolean(isActive),
  };
}

function validateProductPayload(payload) {
  if (!payload.name) {
    return "name is required.";
  }

  if (!payload.category) {
    return "category is required.";
  }

  if (!payload.description) {
    return "description is required.";
  }

  if (Number.isNaN(Number(payload.unit_price)) || Number(payload.unit_price) < 0) {
    return "unit_price must be a valid amount.";
  }

  if (
    payload.image_url &&
    !/^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(payload.image_url)
  ) {
    return "image_url must be a valid uploaded image or image link.";
  }

  if (payload.image_url && payload.image_url.length > 3000000) {
    return "Uploaded product image is too large. Please choose a smaller image.";
  }

  if (payload.availability_note && payload.availability_note.length > 240) {
    return "availability_note must be 240 characters or fewer.";
  }

  return null;
}

async function getOwnedProduct(database, vendorId, productId) {
  return get(
    database,
    `
      SELECT id, vendor_id, name, image_url, category, description, unit_price,
             availability_note, is_active, created_at, updated_at
      FROM products
      WHERE id = ? AND vendor_id = ?
    `,
    [productId, vendorId]
  );
}

router.get("/", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const products = await all(
      database,
      `
        SELECT id, vendor_id, name, image_url, category, description, unit_price,
               availability_note, is_active, created_at, updated_at
        FROM products
        WHERE vendor_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      [req.vendorAuth.vendorId]
    );

    return res.json({
      products: products.map(sanitizeProduct),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Product Lookup Failed",
      message: "Unable to load vendor products right now.",
    });
  }
});

router.post("/", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const payload = normalizeProductPayload(req.body);
    const validationError = validateProductPayload(payload);

    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    const result = await run(
      database,
      `
        INSERT INTO products (
          vendor_id, name, image_url, category, description, unit_price,
          availability_note, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.vendorAuth.vendorId,
        payload.name,
        payload.image_url,
        payload.category,
        payload.description,
        Number(payload.unit_price),
        payload.availability_note,
        payload.is_active ? 1 : 0,
      ]
    );

    const product = await getOwnedProduct(
      database,
      req.vendorAuth.vendorId,
      result.lastID
    );

    return res.status(201).json({
      message: "Product saved successfully.",
      product: sanitizeProduct(product),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Product Creation Failed",
      message: "Unable to save this product right now.",
    });
  }
});

router.get("/:id", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const product = await getOwnedProduct(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        error: "Product Not Found",
        message: "No vendor product was found for this account.",
      });
    }

    return res.json({
      product: sanitizeProduct(product),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Product Lookup Failed",
      message: "Unable to load this product right now.",
    });
  }
});

router.patch("/:id", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const existingProduct = await getOwnedProduct(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    if (!existingProduct) {
      return res.status(404).json({
        error: "Product Not Found",
        message: "No vendor product was found for this account.",
      });
    }

    const payload = normalizeProductPayload(req.body, existingProduct);
    const validationError = validateProductPayload(payload);

    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    await run(
      database,
      `
        UPDATE products
        SET name = ?, image_url = ?, category = ?, description = ?,
            unit_price = ?, availability_note = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND vendor_id = ?
      `,
      [
        payload.name,
        payload.image_url,
        payload.category,
        payload.description,
        Number(payload.unit_price),
        payload.availability_note,
        payload.is_active ? 1 : 0,
        req.params.id,
        req.vendorAuth.vendorId,
      ]
    );

    const product = await getOwnedProduct(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    return res.json({
      message: "Product updated successfully.",
      product: sanitizeProduct(product),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Product Update Failed",
      message: "Unable to update this product right now.",
    });
  }
});

module.exports = router;
