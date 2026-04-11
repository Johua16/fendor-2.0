const express = require("express");

const { all, get, getDatabase, run } = require("../db/database");
const requireAdminAuth = require("../middleware/admin-auth.middleware");

const router = express.Router();

function sanitizeAdminProduct(row) {
  return {
    id: row.id,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    name: row.name,
    image_url: row.image_url,
    category: row.category,
    description: row.description,
    unit_price: row.unit_price,
    availability_note: row.availability_note,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.get("/", requireAdminAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const products = await all(
      database,
      `
        SELECT
          p.id,
          p.vendor_id,
          v.business_name AS vendor_name,
          p.name,
          p.image_url,
          p.category,
          p.description,
          p.unit_price,
          p.availability_note,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        ORDER BY datetime(p.created_at) DESC, p.id DESC
      `
    );

    return res.json({
      products: products.map(sanitizeAdminProduct),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Product Lookup Failed",
      message: "Unable to load platform products right now.",
    });
  }
});

router.patch("/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "A valid product id is required.",
      });
    }

    if (req.body.is_active === undefined) {
      return res.status(400).json({
        error: "Validation Error",
        message: "is_active is required.",
      });
    }

    const isActive =
      req.body.is_active === true ||
      req.body.is_active === 1 ||
      req.body.is_active === "1" ||
      req.body.is_active === "true" ||
      req.body.is_active === "on";

    const database = getDatabase();
    const existingProduct = await get(
      database,
      `
        SELECT
          p.id,
          p.vendor_id,
          v.business_name AS vendor_name,
          p.name,
          p.image_url,
          p.category,
          p.description,
          p.unit_price,
          p.availability_note,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [productId]
    );

    if (!existingProduct) {
      return res.status(404).json({
        error: "Product Not Found",
        message: "That product could not be found.",
      });
    }

    await run(
      database,
      `
        UPDATE products
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [isActive ? 1 : 0, productId]
    );

    const updatedProduct = await get(
      database,
      `
        SELECT
          p.id,
          p.vendor_id,
          v.business_name AS vendor_name,
          p.name,
          p.image_url,
          p.category,
          p.description,
          p.unit_price,
          p.availability_note,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [productId]
    );

    return res.json({
      message: isActive
        ? "Product marked active successfully."
        : "Product marked inactive successfully.",
      product: sanitizeAdminProduct(updatedProduct),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Product Update Failed",
      message: "Unable to update this product right now.",
    });
  }
});

module.exports = router;
