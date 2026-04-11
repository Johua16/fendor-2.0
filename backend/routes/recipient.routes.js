const express = require("express");
const { all, get, getDatabase, run } = require("../db/database");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

function sanitizeRecipient(recipient) {
  if (!recipient) {
    return null;
  }

  return {
    id: recipient.id,
    full_name: recipient.full_name,
    phone: recipient.phone,
    email: recipient.email,
    address_line_1: recipient.address_line_1,
    address_line_2: recipient.address_line_2,
    city: recipient.city,
    state: recipient.state,
    delivery_notes: recipient.delivery_notes,
    is_default: Boolean(recipient.is_default),
    created_at: recipient.created_at,
    updated_at: recipient.updated_at,
  };
}

function normalizeRecipientPayload(payload, fallbackRecipient) {
  const source = payload || {};
  const fallback = fallbackRecipient || {};

  function readText(fieldName) {
    const value = source[fieldName];
    if (value === undefined) {
      return fallback[fieldName] || null;
    }

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  let isDefault = fallback.is_default;
  if (source.is_default !== undefined) {
    isDefault =
      source.is_default === true ||
      source.is_default === 1 ||
      source.is_default === "1" ||
      source.is_default === "true" ||
      source.is_default === "on";
  }

  return {
    full_name: readText("full_name"),
    phone: readText("phone"),
    email: readText("email"),
    address_line_1: readText("address_line_1"),
    address_line_2: readText("address_line_2"),
    city: readText("city"),
    state: readText("state"),
    delivery_notes: readText("delivery_notes"),
    is_default: Boolean(isDefault),
  };
}

function validateRecipientPayload(payload) {
  const requiredFields = [
    "full_name",
    "phone",
    "address_line_1",
    "city",
    "state",
  ];

  const missingField = requiredFields.find((fieldName) => !payload[fieldName]);
  if (!missingField) {
    return null;
  }

  return `${missingField} is required.`;
}

async function getOwnedRecipient(database, userId, recipientId) {
  return get(
    database,
    `
      SELECT id, user_id, full_name, phone, email, address_line_1, address_line_2, city, state,
             delivery_notes, is_default, created_at, updated_at
      FROM recipients
      WHERE id = ? AND user_id = ?
    `,
    [recipientId, userId]
  );
}

async function promoteFallbackDefault(database, userId, excludedRecipientId) {
  const fallbackRecipient = await get(
    database,
    `
      SELECT id
      FROM recipients
      WHERE user_id = ? AND id != ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId, excludedRecipientId]
  );

  if (!fallbackRecipient) {
    return;
  }

  await run(
    database,
    `
      UPDATE recipients
      SET is_default = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
    [fallbackRecipient.id, userId]
  );
}

async function countOtherRecipients(database, userId, excludedRecipientId) {
  const countRow = await get(
    database,
    "SELECT COUNT(*) AS count FROM recipients WHERE user_id = ? AND id != ?",
    [userId, excludedRecipientId]
  );

  return Number(countRow ? countRow.count : 0);
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const recipients = await all(
      database,
      `
        SELECT id, full_name, phone, email, address_line_1, address_line_2, city, state,
               delivery_notes, is_default, created_at, updated_at
        FROM recipients
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC, id DESC
      `,
      [req.auth.userId]
    );

    return res.json({
      recipients: recipients.map(sanitizeRecipient),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Recipient Lookup Failed",
      message: "Unable to load saved recipients right now.",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const payload = normalizeRecipientPayload(req.body);
    const validationError = validateRecipientPayload(payload);

    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    const existingCountRow = await get(
      database,
      "SELECT COUNT(*) AS count FROM recipients WHERE user_id = ?",
      [req.auth.userId]
    );
    const shouldBeDefault = payload.is_default || Number(existingCountRow.count) === 0;

    if (shouldBeDefault) {
      await run(
        database,
        "UPDATE recipients SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [req.auth.userId]
      );
    }

    const insertResult = await run(
      database,
      `
        INSERT INTO recipients (
          user_id, full_name, phone, email, address_line_1, address_line_2,
          city, state, delivery_notes, is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.auth.userId,
        payload.full_name,
        payload.phone,
        payload.email,
        payload.address_line_1,
        payload.address_line_2,
        payload.city,
        payload.state,
        payload.delivery_notes,
        shouldBeDefault ? 1 : 0,
      ]
    );

    const recipient = await getOwnedRecipient(database, req.auth.userId, insertResult.lastID);

    return res.status(201).json({
      message: "Recipient saved successfully.",
      recipient: sanitizeRecipient(recipient),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Recipient Creation Failed",
      message: "Unable to save this recipient right now.",
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const recipient = await getOwnedRecipient(database, req.auth.userId, req.params.id);

    if (!recipient) {
      return res.status(404).json({
        error: "Recipient Not Found",
        message: "No saved recipient was found for this account.",
      });
    }

    return res.json({
      recipient: sanitizeRecipient(recipient),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Recipient Lookup Failed",
      message: "Unable to load this recipient right now.",
    });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const existingRecipient = await getOwnedRecipient(database, req.auth.userId, req.params.id);

    if (!existingRecipient) {
      return res.status(404).json({
        error: "Recipient Not Found",
        message: "No saved recipient was found for this account.",
      });
    }

    const payload = normalizeRecipientPayload(req.body, existingRecipient);
    const validationError = validateRecipientPayload(payload);

    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    if (existingRecipient.is_default && !payload.is_default) {
      const otherRecipientCount = await countOtherRecipients(
        database,
        req.auth.userId,
        req.params.id
      );

      if (otherRecipientCount === 0) {
        payload.is_default = true;
      }
    }

    if (payload.is_default) {
      await run(
        database,
        `
          UPDATE recipients
          SET is_default = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND id != ?
        `,
        [req.auth.userId, req.params.id]
      );
    }

    await run(
      database,
      `
        UPDATE recipients
        SET full_name = ?, phone = ?, email = ?, address_line_1 = ?, address_line_2 = ?,
            city = ?, state = ?, delivery_notes = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
      [
        payload.full_name,
        payload.phone,
        payload.email,
        payload.address_line_1,
        payload.address_line_2,
        payload.city,
        payload.state,
        payload.delivery_notes,
        payload.is_default ? 1 : 0,
        req.params.id,
        req.auth.userId,
      ]
    );

    if (existingRecipient.is_default && !payload.is_default) {
      await promoteFallbackDefault(database, req.auth.userId, req.params.id);
    }

    const updatedRecipient = await getOwnedRecipient(database, req.auth.userId, req.params.id);

    return res.json({
      message: "Recipient updated successfully.",
      recipient: sanitizeRecipient(updatedRecipient),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Recipient Update Failed",
      message: "Unable to update this recipient right now.",
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const existingRecipient = await getOwnedRecipient(database, req.auth.userId, req.params.id);

    if (!existingRecipient) {
      return res.status(404).json({
        error: "Recipient Not Found",
        message: "No saved recipient was found for this account.",
      });
    }

    await run(
      database,
      "DELETE FROM recipients WHERE id = ? AND user_id = ?",
      [req.params.id, req.auth.userId]
    );

    if (existingRecipient.is_default) {
      await promoteFallbackDefault(database, req.auth.userId, req.params.id);
    }

    return res.json({
      message: "Recipient deleted successfully.",
      deleted_recipient_id: Number(req.params.id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Recipient Deletion Failed",
      message: "Unable to delete this recipient right now.",
    });
  }
});

module.exports = router;
