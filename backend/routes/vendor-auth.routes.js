const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { getDatabase, get } = require("../db/database");
const requireVendorAuth = require("../middleware/vendor-auth.middleware");

const router = express.Router();
const VENDOR_JWT_SECRET =
  process.env.VENDOR_JWT_SECRET || "fendor-phase3-vendor-dev-secret";
const VENDOR_JWT_EXPIRES_IN = "7d";

function createVendorToken(vendor) {
  return jwt.sign(
    {
      sub: vendor.id,
      email: vendor.email,
      role: "vendor",
    },
    VENDOR_JWT_SECRET,
    { expiresIn: VENDOR_JWT_EXPIRES_IN }
  );
}

function sanitizeVendor(vendor) {
  return {
    id: vendor.id,
    business_name: vendor.business_name,
    contact_name: vendor.contact_name,
    email: vendor.email,
    phone: vendor.phone,
    business_address: vendor.business_address,
    is_active: Boolean(vendor.is_active),
    created_at: vendor.created_at,
    updated_at: vendor.updated_at,
  };
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Validation Error",
        message: "email and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const database = getDatabase();

    const vendor = await get(
      database,
      `
        SELECT id, business_name, contact_name, email, phone, password_hash,
               business_address, is_active, created_at, updated_at
        FROM vendors
        WHERE email = ?
      `,
      [normalizedEmail]
    );

    if (!vendor) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect vendor email or password.",
      });
    }

    if (!vendor.is_active) {
      return res.status(403).json({
        error: "Vendor Inactive",
        message: "This vendor account is not active.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      String(password),
      vendor.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect vendor email or password.",
      });
    }

    const token = createVendorToken(vendor);

    return res.json({
      message: "Vendor login successful.",
      token,
      vendor: sanitizeVendor(vendor),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Login Failed",
      message: "Unable to log in right now.",
    });
  }
});

router.get("/me", requireVendorAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const vendor = await get(
      database,
      `
        SELECT id, business_name, contact_name, email, phone,
               business_address, is_active, created_at, updated_at
        FROM vendors
        WHERE id = ?
      `,
      [req.vendorAuth.vendorId]
    );

    if (!vendor) {
      return res.status(404).json({
        error: "Vendor Not Found",
        message: "No authenticated vendor was found.",
      });
    }

    if (!vendor.is_active) {
      return res.status(403).json({
        error: "Vendor Inactive",
        message: "This vendor account is not active.",
      });
    }

    return res.json({
      vendor: sanitizeVendor(vendor),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Vendor Lookup Failed",
      message: "Unable to fetch the current vendor.",
    });
  }
});

router.post("/logout", requireVendorAuth, (req, res) => {
  return res.json({
    message:
      "Vendor logout is currently handled client-side by clearing the stored token.",
  });
});

module.exports = router;
