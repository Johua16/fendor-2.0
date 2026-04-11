const express = require("express");

const { all, get, getDatabase } = require("../db/database");

const router = express.Router();

function sanitizePublicProduct(product) {
  return {
    product_id: product.id,
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

router.get("/", async (req, res) => {
  try {
    const database = getDatabase();
    const rows = await all(
      database,
      `
        SELECT id, vendor_id, name, image_url, category, description, unit_price,
               availability_note, is_active, created_at, updated_at
        FROM products
        WHERE is_active = 1
        ORDER BY created_at DESC, id DESC
      `
    );

    return res.json({
      products: rows.map(sanitizePublicProduct),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Product Lookup Failed",
      message: "Unable to load products right now.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const database = getDatabase();
    const product = await get(
      database,
      `
        SELECT id, vendor_id, name, image_url, category, description, unit_price,
               availability_note, is_active, created_at, updated_at
        FROM products
        WHERE id = ? AND is_active = 1
      `,
      [req.params.id]
    );

    if (!product) {
      return res.status(404).json({
        error: "Product Not Found",
        message: "The requested product does not exist or is no longer available.",
      });
    }

    return res.json({
      product: sanitizePublicProduct(product),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Product Lookup Failed",
      message: "Unable to load this product right now.",
    });
  }
});

module.exports = router;
