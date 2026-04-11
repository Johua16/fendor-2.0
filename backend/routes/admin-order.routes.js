const express = require("express");

const { all, get, getDatabase } = require("../db/database");
const requireAdminAuth = require("../middleware/admin-auth.middleware");

const router = express.Router();

function sanitizeTrackingItem(item) {
  return {
    id: item.id,
    status: item.status,
    message: item.message,
    timestamp: item.timestamp,
  };
}

function sanitizeAdminOrder(row, tracking) {
  return {
    id: row.id,
    order_code: row.order_code,
    product_id: row.product_id,
    vendor_id: row.vendor_id,
    user_id: row.user_id,
    product_name: row.product_name,
    product_image: row.product_image,
    quantity: row.quantity,
    unit_price: row.unit_price,
    delivery_fee: row.delivery_fee,
    total_amount: row.total_amount,
    payment_status: row.payment_status,
    order_status: row.order_status,
    order_note: row.order_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: {
      id: row.user_id,
      full_name: row.customer_full_name,
      email: row.customer_email,
      phone: row.customer_phone,
    },
    vendor: {
      id: row.vendor_id,
      business_name: row.vendor_business_name,
      contact_name: row.vendor_contact_name,
      email: row.vendor_email,
    },
    recipient: row.recipient_id
      ? {
          id: row.recipient_id,
          full_name: row.recipient_full_name,
          phone: row.recipient_phone,
          email: row.recipient_email,
          address_line_1: row.recipient_address_line_1,
          address_line_2: row.recipient_address_line_2,
          city: row.recipient_city,
          state: row.recipient_state,
        }
      : null,
    tracking: Array.isArray(tracking) ? tracking.map(sanitizeTrackingItem) : undefined,
  };
}

async function getAdminOrderRow(database, orderId) {
  return get(
    database,
    `
      SELECT
        o.id,
        o.order_code,
        o.product_id,
        o.vendor_id,
        o.user_id,
        o.recipient_id,
        o.product_name,
        o.product_image,
        o.quantity,
        o.unit_price,
        o.delivery_fee,
        o.total_amount,
        o.payment_status,
        o.order_status,
        o.order_note,
        o.created_at,
        o.updated_at,
        u.full_name AS customer_full_name,
        u.email AS customer_email,
        u.phone AS customer_phone,
        v.business_name AS vendor_business_name,
        v.contact_name AS vendor_contact_name,
        v.email AS vendor_email,
        r.full_name AS recipient_full_name,
        r.phone AS recipient_phone,
        r.email AS recipient_email,
        r.address_line_1 AS recipient_address_line_1,
        r.address_line_2 AS recipient_address_line_2,
        r.city AS recipient_city,
        r.state AS recipient_state
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN vendors v ON v.id = o.vendor_id
      LEFT JOIN recipients r ON r.id = o.recipient_id
      WHERE o.id = ?
      LIMIT 1
    `,
    [orderId]
  );
}

async function getOrderTracking(database, orderId) {
  return all(
    database,
    `
      SELECT id, status, message, timestamp
      FROM order_tracking
      WHERE order_id = ?
      ORDER BY timestamp ASC, id ASC
    `,
    [orderId]
  );
}

router.get("/", requireAdminAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const rows = await all(
      database,
      `
        SELECT
          o.id,
          o.order_code,
          o.product_id,
          o.vendor_id,
          o.user_id,
          o.recipient_id,
          o.product_name,
          o.product_image,
          o.quantity,
          o.unit_price,
          o.delivery_fee,
          o.total_amount,
          o.payment_status,
          o.order_status,
          o.order_note,
          o.created_at,
          o.updated_at,
          u.full_name AS customer_full_name,
          u.email AS customer_email,
          u.phone AS customer_phone,
          v.business_name AS vendor_business_name,
          v.contact_name AS vendor_contact_name,
          v.email AS vendor_email,
          r.full_name AS recipient_full_name,
          r.phone AS recipient_phone,
          r.email AS recipient_email,
          r.address_line_1 AS recipient_address_line_1,
          r.address_line_2 AS recipient_address_line_2,
          r.city AS recipient_city,
          r.state AS recipient_state
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        LEFT JOIN vendors v ON v.id = o.vendor_id
        LEFT JOIN recipients r ON r.id = o.recipient_id
        ORDER BY datetime(o.created_at) DESC, o.id DESC
      `
    );

    return res.json({
      orders: rows.map(function (row) {
        return sanitizeAdminOrder(row);
      }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Order Lookup Failed",
      message: "Unable to load platform orders right now.",
    });
  }
});

router.get("/:id", requireAdminAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "A valid order id is required.",
      });
    }

    const database = getDatabase();
    const orderRow = await getAdminOrderRow(database, orderId);

    if (!orderRow) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "That order could not be found.",
      });
    }

    const tracking = await getOrderTracking(database, orderId);

    return res.json({
      order: sanitizeAdminOrder(orderRow, tracking),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Order Lookup Failed",
      message: "Unable to load that order right now.",
    });
  }
});

module.exports = router;
