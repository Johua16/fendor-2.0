const express = require("express");

const { all, get, getDatabase, run } = require("../db/database");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

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

function sanitizeOrder(row, tracking) {
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

function validateOrderPayload(payload) {
  if (!payload.product_id || Number(payload.product_id) < 1) {
    return "product_id is required.";
  }

  if (!payload.vendor_id || Number(payload.vendor_id) < 1) {
    return "vendor_id is required.";
  }

  if (!payload.recipient_id) {
    return "recipient_id is required.";
  }

  if (!payload.quantity || Number(payload.quantity) < 1) {
    return "quantity must be at least 1.";
  }

  if (!Number.isInteger(Number(payload.quantity))) {
    return "quantity must be a whole number.";
  }

  if (payload.order_note && String(payload.order_note).length > 300) {
    return "order_note must be 300 characters or fewer.";
  }

  return null;
}

function createOrderCode() {
  return "FND-" + Date.now().toString().slice(-8);
}

async function getOwnedRecipient(database, userId, recipientId) {
  return get(
    database,
    `
      SELECT id, full_name, phone, email, address_line_1, address_line_2, city, state
      FROM recipients
      WHERE id = ? AND user_id = ?
    `,
    [recipientId, userId]
  );
}

async function getOwnedOrder(database, userId, orderId) {
  return get(
    database,
    `
      SELECT o.id, o.user_id, o.recipient_id, o.product_id, o.vendor_id, o.order_code,
             o.product_name, o.product_image, o.quantity, o.unit_price, o.delivery_fee, o.total_amount, o.payment_status,
             o.order_status, o.order_note, o.created_at, o.updated_at,
             r.full_name AS recipient_full_name,
             r.phone AS recipient_phone,
             r.email AS recipient_email,
             r.address_line_1 AS recipient_address_line_1,
             r.address_line_2 AS recipient_address_line_2,
             r.city AS recipient_city,
             r.state AS recipient_state
      FROM orders o
      LEFT JOIN recipients r ON r.id = o.recipient_id
      WHERE o.id = ? AND o.user_id = ?
    `,
    [orderId, userId]
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

async function getActiveProduct(database, productId) {
  return get(
    database,
    `
      SELECT id, vendor_id, name, image_url, category, description, unit_price,
             availability_note, is_active
      FROM products
      WHERE id = ? AND is_active = 1
    `,
    [productId]
  );
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const rows = await all(
      database,
      `
        SELECT o.id, o.order_code, o.product_name, o.product_image, o.quantity, o.unit_price,
               o.delivery_fee, o.total_amount, o.payment_status, o.order_status, o.order_note,
               o.product_id, o.vendor_id,
               o.created_at, o.updated_at, o.recipient_id,
               r.full_name AS recipient_full_name,
               r.phone AS recipient_phone,
               r.email AS recipient_email,
               r.address_line_1 AS recipient_address_line_1,
               r.address_line_2 AS recipient_address_line_2,
               r.city AS recipient_city,
               r.state AS recipient_state
        FROM orders o
        LEFT JOIN recipients r ON r.id = o.recipient_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC, o.id DESC
      `,
      [req.auth.userId]
    );

    const orders = await Promise.all(
      rows.map(async (row) => {
        const tracking = await getOrderTracking(database, row.id);
        return sanitizeOrder(row, tracking);
      })
    );

    return res.json({
      orders,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Order Lookup Failed",
      message: "Unable to load orders right now.",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const payload = {
      recipient_id: req.body.recipient_id,
      product_id: Number(req.body.product_id || 0),
      vendor_id: Number(req.body.vendor_id || 0),
      quantity: Number(req.body.quantity || 1),
      delivery_fee: Number(req.body.delivery_fee || 0),
      payment_status: req.body.payment_status ? String(req.body.payment_status).trim() : "pending",
      order_status: req.body.order_status ? String(req.body.order_status).trim() : "pending_confirmation",
      order_note: req.body.order_note ? String(req.body.order_note).trim() : null,
    };

    const validationError = validateOrderPayload(payload);
    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    const ownedRecipient = await getOwnedRecipient(database, req.auth.userId, payload.recipient_id);
    if (!ownedRecipient) {
      return res.status(404).json({
        error: "Recipient Not Found",
        message: "The selected recipient does not exist for this account.",
      });
    }

    const activeProduct = await getActiveProduct(database, payload.product_id);
    if (!activeProduct) {
      return res.status(404).json({
        error: "Product Not Found",
        message: "The selected product is not available for ordering right now.",
      });
    }

    if (Number(activeProduct.vendor_id) !== Number(payload.vendor_id)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "vendor_id does not match the selected product.",
      });
    }

    if (Number.isNaN(payload.delivery_fee) || payload.delivery_fee < 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "delivery_fee must be a valid amount.",
      });
    }

    const quantity = Number(payload.quantity);
    const unitPrice = Number(activeProduct.unit_price || 0);
    const totalAmount = quantity * unitPrice + Number(payload.delivery_fee || 0);

    const insertResult = await run(
      database,
      `
        INSERT INTO orders (
          user_id, recipient_id, product_id, vendor_id, order_code, product_name, product_image, quantity,
          unit_price, delivery_fee, total_amount, payment_status, order_status, order_note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.auth.userId,
        Number(payload.recipient_id),
        Number(activeProduct.id),
        Number(activeProduct.vendor_id),
        createOrderCode(),
        activeProduct.name,
        activeProduct.image_url,
        quantity,
        unitPrice,
        payload.delivery_fee,
        totalAmount,
        payload.payment_status,
        payload.order_status,
        payload.order_note,
      ]
    );

    await run(
      database,
      `
        INSERT INTO order_tracking (order_id, status, message)
        VALUES (?, ?, ?)
      `,
      [
        insertResult.lastID,
        payload.order_status,
        "Order created and waiting for the next fulfillment update.",
      ]
    );

    const orderRow = await getOwnedOrder(database, req.auth.userId, insertResult.lastID);
    const tracking = await getOrderTracking(database, insertResult.lastID);

    return res.status(201).json({
      message: "Order created successfully.",
      order: sanitizeOrder(orderRow, tracking),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Order Creation Failed",
      message: "Unable to create this order right now.",
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const orderRow = await getOwnedOrder(database, req.auth.userId, req.params.id);

    if (!orderRow) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "No order was found for this account.",
      });
    }

    const tracking = await getOrderTracking(database, req.params.id);

    return res.json({
      order: sanitizeOrder(orderRow, tracking),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Order Lookup Failed",
      message: "Unable to load this order right now.",
    });
  }
});

router.get("/:id/tracking", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const orderRow = await getOwnedOrder(database, req.auth.userId, req.params.id);

    if (!orderRow) {
      return res.status(404).json({
        error: "Order Not Found",
        message: "No order was found for this account.",
      });
    }

    const tracking = await getOrderTracking(database, req.params.id);

    return res.json({
      order_id: Number(req.params.id),
      order_code: orderRow.order_code,
      tracking: tracking.map(sanitizeTrackingItem),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Tracking Lookup Failed",
      message: "Unable to load order tracking right now.",
    });
  }
});

module.exports = router;
