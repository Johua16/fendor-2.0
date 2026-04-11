const express = require("express");
const bcrypt = require("bcrypt");

const { getDatabase, all, get, run } = require("../db/database");
const requireAdminAuth = require("../middleware/admin-auth.middleware");

const router = express.Router();
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

router.get("/applications", requireAdminAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const status = String(req.query.status || "")
      .trim()
      .toLowerCase();

    var whereClause = "";
    var params = [];

    if (status) {
      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({
          error: "Validation Error",
          message: "status must be pending, approved, or rejected.",
        });
      }

      whereClause = "WHERE status = ?";
      params.push(status);
    }

    const applications = await all(
      database,
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          business_description,
          product_categories,
          application_note,
          status,
          review_note,
          reviewed_by_admin_id,
          reviewed_at,
          created_at,
          updated_at
        FROM vendor_applications
        ${whereClause}
        ORDER BY datetime(created_at) DESC, id DESC
      `,
      params
    );

    return res.json({
      applications,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Application Lookup Failed",
      message: "Unable to fetch vendor applications right now.",
    });
  }
});

router.get("/", requireAdminAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const vendors = await all(
      database,
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          application_id,
          approved_by_admin_id,
          approved_at,
          is_active,
          created_at,
          updated_at
        FROM vendors
        ORDER BY datetime(created_at) DESC, id DESC
      `
    );

    return res.json({
      vendors: vendors.map(function (vendor) {
        return {
          id: vendor.id,
          business_name: vendor.business_name,
          contact_name: vendor.contact_name,
          email: vendor.email,
          phone: vendor.phone,
          business_address: vendor.business_address,
          application_id: vendor.application_id,
          approved_by_admin_id: vendor.approved_by_admin_id,
          approved_at: vendor.approved_at,
          is_active: Boolean(vendor.is_active),
          created_at: vendor.created_at,
          updated_at: vendor.updated_at,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Lookup Failed",
      message: "Unable to load approved vendors right now.",
    });
  }
});

router.get("/applications/:id", requireAdminAuth, async (req, res) => {
  try {
    const applicationId = Number(req.params.id);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "A valid application id is required.",
      });
    }

    const database = getDatabase();
    const application = await get(
      database,
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          business_description,
          product_categories,
          application_note,
          status,
          review_note,
          reviewed_by_admin_id,
          reviewed_at,
          created_at,
          updated_at
        FROM vendor_applications
        WHERE id = ?
        LIMIT 1
      `,
      [applicationId]
    );

    if (!application) {
      return res.status(404).json({
        error: "Application Not Found",
        message: "That vendor application could not be found.",
      });
    }

    return res.json({
      application,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Application Lookup Failed",
      message: "Unable to fetch that vendor application right now.",
    });
  }
});

router.patch("/applications/:id/status", requireAdminAuth, async (req, res) => {
  const database = getDatabase();

  try {
    const applicationId = Number(req.params.id);
    const status = String(req.body.status || "")
      .trim()
      .toLowerCase();
    const reviewNote = String(req.body.review_note || "").trim();
    const temporaryPassword = String(req.body.temporary_password || "");

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "A valid application id is required.",
      });
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be pending, approved, or rejected.",
      });
    }

    if (reviewNote.length > 500) {
      return res.status(400).json({
        error: "Validation Error",
        message: "review_note must be 500 characters or fewer.",
      });
    }

    if (status === "approved" && temporaryPassword.trim().length < 8) {
      return res.status(400).json({
        error: "Validation Error",
        message: "A temporary password of at least 8 characters is required for approval.",
      });
    }

    const application = await get(
      database,
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          status
        FROM vendor_applications
        WHERE id = ?
        LIMIT 1
      `,
      [applicationId]
    );

    if (!application) {
      return res.status(404).json({
        error: "Application Not Found",
        message: "That vendor application could not be found.",
      });
    }

    const existingVendorByApplication = await get(
      database,
      `
        SELECT id, email, application_id
        FROM vendors
        WHERE application_id = ?
        LIMIT 1
      `,
      [applicationId]
    );

    const existingVendorByEmail = await get(
      database,
      `
        SELECT id, email, application_id
        FROM vendors
        WHERE email = ?
        LIMIT 1
      `,
      [application.email]
    );

    const reviewedAt = new Date().toISOString();

    await run(database, "BEGIN TRANSACTION");

    if (status === "approved") {
      if (existingVendorByApplication) {
        await run(database, "ROLLBACK");
        return res.status(409).json({
          error: "Application Already Approved",
          message: "A vendor account has already been created for this application.",
        });
      }

      if (existingVendorByEmail) {
        await run(database, "ROLLBACK");
        return res.status(409).json({
          error: "Vendor Already Exists",
          message: "A vendor account already exists for this email address.",
        });
      }

      const passwordHash = await bcrypt.hash(temporaryPassword.trim(), 10);

      await run(
        database,
        `
          INSERT INTO vendors (
            business_name,
            contact_name,
            email,
            phone,
            password_hash,
            business_address,
            is_active,
            application_id,
            approved_by_admin_id,
            approved_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `,
        [
          application.business_name,
          application.contact_name,
          application.email,
          application.phone,
          passwordHash,
          application.business_address,
          application.id,
          req.adminAuth.adminId,
          reviewedAt,
        ]
      );
    } else if (status === "pending" && existingVendorByApplication) {
      await run(database, "ROLLBACK");
      return res.status(409).json({
        error: "Status Update Not Allowed",
        message: "An approved application with a live vendor account cannot be moved back to pending.",
      });
    } else if (status === "rejected" && existingVendorByApplication) {
      await run(database, "ROLLBACK");
      return res.status(409).json({
        error: "Status Update Not Allowed",
        message: "An approved application with a live vendor account cannot be rejected.",
      });
    }

    await run(
      database,
      `
        UPDATE vendor_applications
        SET
          status = ?,
          review_note = ?,
          reviewed_by_admin_id = ?,
          reviewed_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [status, reviewNote || null, req.adminAuth.adminId, reviewedAt, applicationId]
    );

    await run(database, "COMMIT");

    const updatedApplication = await get(
      database,
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          phone,
          business_address,
          business_description,
          product_categories,
          application_note,
          status,
          review_note,
          reviewed_by_admin_id,
          reviewed_at,
          created_at,
          updated_at
        FROM vendor_applications
        WHERE id = ?
        LIMIT 1
      `,
      [applicationId]
    );

    return res.json({
      message:
        status === "approved"
          ? "Vendor application approved and vendor account created."
          : status === "rejected"
            ? "Vendor application rejected."
            : "Vendor application status updated.",
      application: updatedApplication,
    });
  } catch (error) {
    try {
      await run(database, "ROLLBACK");
    } catch (rollbackError) {
      // Ignore rollback errors after a failed transaction attempt.
    }

    console.error(error);
    return res.status(500).json({
      error: "Application Review Failed",
      message: "Unable to update the vendor application right now.",
    });
  }
});

module.exports = router;
