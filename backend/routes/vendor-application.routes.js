const express = require("express");

const { getDatabase, get, run } = require("../db/database");

const router = express.Router();

function normalizeApplicationPayload(body) {
  const source = body || {};

  function readText(fieldName) {
    const value = source[fieldName];
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  return {
    business_name: readText("business_name"),
    contact_name: readText("contact_name"),
    email: readText("email") ? String(readText("email")).toLowerCase() : null,
    phone: readText("phone"),
    business_address: readText("business_address"),
    business_description: readText("business_description"),
    product_categories: readText("product_categories"),
    application_note: readText("application_note"),
  };
}

function validateApplicationPayload(payload) {
  if (!payload.business_name) {
    return "business_name is required.";
  }

  if (!payload.contact_name) {
    return "contact_name is required.";
  }

  if (!payload.email) {
    return "email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "email must be a valid email address.";
  }

  if (!payload.phone) {
    return "phone is required.";
  }

  if (!payload.business_address) {
    return "business_address is required.";
  }

  if (!payload.business_description) {
    return "business_description is required.";
  }

  if (payload.business_description && payload.business_description.length > 800) {
    return "business_description must be 800 characters or fewer.";
  }

  if (payload.product_categories && payload.product_categories.length > 300) {
    return "product_categories must be 300 characters or fewer.";
  }

  if (payload.application_note && payload.application_note.length > 500) {
    return "application_note must be 500 characters or fewer.";
  }

  return null;
}

router.post("/", async (req, res) => {
  try {
    const database = getDatabase();
    const payload = normalizeApplicationPayload(req.body);
    const validationError = validateApplicationPayload(payload);

    if (validationError) {
      return res.status(400).json({
        error: "Validation Error",
        message: validationError,
      });
    }

    const existingPendingApplication = await get(
      database,
      `
        SELECT id
        FROM vendor_applications
        WHERE email = ? AND status = 'pending'
        LIMIT 1
      `,
      [payload.email]
    );

    if (existingPendingApplication) {
      return res.status(409).json({
        error: "Duplicate Pending Application",
        message:
          "A pending vendor application already exists for this email address.",
      });
    }

    const insertResult = await run(
      database,
      `
        INSERT INTO vendor_applications (
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          business_description,
          product_categories,
          application_note,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        payload.business_name,
        payload.contact_name,
        payload.email,
        payload.phone,
        payload.business_address,
        payload.business_description,
        payload.product_categories,
        payload.application_note,
      ]
    );

    return res.status(201).json({
      message:
        "Your vendor application has been submitted successfully and is now pending review.",
      application: {
        id: insertResult.lastID,
        business_name: payload.business_name,
        contact_name: payload.contact_name,
        email: payload.email,
        status: "pending",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Application Submission Failed",
      message: "Unable to submit your vendor application right now.",
    });
  }
});

module.exports = router;
