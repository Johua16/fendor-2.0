const express = require("express");

const { all, get, getDatabase, run } = require("../db/database");
const requireVendorAuth = require("../middleware/vendor-auth.middleware");

const router = express.Router();
const ALLOWED_ORDER_STATUSES = [
  "pending_confirmation",
  "processing",
  "out_for_delivery",
  "delivered",
];

function sanitizeRecipientSummary(row) {
  if (!row || !row.recipient_id) {
    return null;
  }

  return {
    id: row.recipient_id,
    full_name: row.recipient_full_name,
    phone: row.recipient_phone,
    email: row.recipient_email,
    address_line_1: row.recipient_address_line_1,
    address_line_2: row.recipient_address_line_2,
    city: row.recipient_city,
    state: row.recipient_state,
  };
}

function sanitizeTrackingItem(item) {
  return {
    id: item.id,
    status: item.status,
    message: item.message,
    timestamp: item.timestamp,
  };
}

function sanitizeVendorOrder(row, tracking) {
  return {
    id: row.id,
    product_id: row.product_id,
    vendor_id: row.vendor_id,
    order_code: row.order_code,
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
    recipient: sanitizeRecipientSummary(row),
    tracking: Array.isArray(tracking) ? tracking.map(sanitizeTrackingItem) : undefined,
  };
}

async function getOwnedVendorOrder(database, vendorId, orderId) {
  return get(
    database,
    `
      SELECT o.id, o.user_id, o.recipient_id, o.product_id, o.vendor_id, o.order_code,
             o.product_name, o.product_image, o.quantity, o.unit_price, o.delivery_fee,
             o.total_amount, o.payment_status, o.order_status, o.order_note, o.created_at, o.updated_at,
             r.full_name AS recipient_full_name,
             r.phone AS recipient_phone,
             r.email AS recipient_email,
             r.address_line_1 AS recipient_address_line_1,
             r.address_line_2 AS recipient_address_line_2,
             r.city AS recipient_city,
             r.state AS recipient_state
      FROM orders o
      LEFT JOIN recipients r ON r.id = o.recipient_id
      WHERE o.id = ? AND o.vendor_id = ?
    `,
    [orderId, vendorId]
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

router.get("/", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const rows = await all(
      database,
      `
        SELECT o.id, o.recipient_id, o.product_id, o.vendor_id, o.order_code,
               o.product_name, o.product_image, o.quantity, o.unit_price, o.delivery_fee,
               o.total_amount, o.payment_status, o.order_status, o.order_note, o.created_at, o.updated_at,
               r.full_name AS recipient_full_name,
               r.phone AS recipient_phone,
               r.email AS recipient_email,
               r.address_line_1 AS recipient_address_line_1,
               r.address_line_2 AS recipient_address_line_2,
               r.city AS recipient_city,
               r.state AS recipient_state
        FROM orders o
        LEFT JOIN recipients r ON r.id = o.recipient_id
        WHERE o.vendor_id = ?
        ORDER BY o.created_at DESC, o.id DESC
      `,
      [req.vendorAuth.vendorId]
    );

    return res.json({
      orders: rows.map((row) => sanitizeVendorOrder(row)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Order Lookup Failed",
      message: "Unable to load assigned vendor orders right now.",
    });
  }
});

router.get("/:id", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const order = await getOwnedVendorOrder(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "No assigned vendor order was found for this account.",
      });
    }

    const tracking = await getOrderTracking(database, req.params.id);

    return res.json({
      order: sanitizeVendorOrder(order, tracking),
      allowed_statuses: ALLOWED_ORDER_STATUSES,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Order Detail Failed",
      message: "Unable to load this vendor order right now.",
    });
  }
});

router.patch("/:id/status", requireVendorAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !ALLOWED_ORDER_STATUSES.includes(String(status).trim())) {
      return res.status(400).json({
        error: "Validation Error",
        message:
          "status must be one of: pending_confirmation, processing, out_for_delivery, delivered.",
      });
    }

    const database = getDatabase();
    const order = await getOwnedVendorOrder(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "No assigned vendor order was found for this account.",
      });
    }

    const normalizedStatus = String(status).trim();

    await run(
      database,
      `
        UPDATE orders
        SET order_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND vendor_id = ?
      `,
      [normalizedStatus, req.params.id, req.vendorAuth.vendorId]
    );

    await run(
      database,
      `
        INSERT INTO order_tracking (order_id, status, message)
        VALUES (?, ?, ?)
      `,
      [
        req.params.id,
        normalizedStatus,
        "Vendor updated the order status to " +
          normalizedStatus.replace(/_/g, " ") +
          ".",
      ]
    );

    const updatedOrder = await getOwnedVendorOrder(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );
    const tracking = await getOrderTracking(database, req.params.id);

    return res.json({
      message: "Order status updated successfully.",
      order: sanitizeVendorOrder(updatedOrder, tracking),
      allowed_statuses: ALLOWED_ORDER_STATUSES,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Order Status Update Failed",
      message: "Unable to update this order status right now.",
    });
  }
});

router.post("/:id/tracking", requireVendorAuth, async (req, res) => {
  try {
    const message = req.body.message ? String(req.body.message).trim() : "";
    const status = req.body.status
      ? String(req.body.status).trim()
      : null;

    if (!message) {
      return res.status(400).json({
        error: "Validation Error",
        message: "message is required.",
      });
    }

    if (status && !ALLOWED_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message:
          "status must be one of: pending_confirmation, processing, out_for_delivery, delivered.",
      });
    }

    const database = getDatabase();
    const order = await getOwnedVendorOrder(
      database,
      req.vendorAuth.vendorId,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "No assigned vendor order was found for this account.",
      });
    }

    const trackingStatus = status || order.order_status;

    await run(
      database,
      `
        INSERT INTO order_tracking (order_id, status, message)
        VALUES (?, ?, ?)
      `,
      [req.params.id, trackingStatus, message]
    );

    const tracking = await getOrderTracking(database, req.params.id);

    return res.status(201).json({
      message: "Tracking note added successfully.",
      order_id: Number(req.params.id),
      tracking: tracking.map(sanitizeTrackingItem),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Tracking Update Failed",
      message: "Unable to add a tracking note right now.",
    });
  }
});

module.exports = router;
