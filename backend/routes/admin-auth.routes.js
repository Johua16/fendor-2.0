const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { getDatabase, get } = require("../db/database");
const requireAdminAuth = require("../middleware/admin-auth.middleware");

const router = express.Router();
const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "fendor-phase4-admin-dev-secret";
const ADMIN_JWT_EXPIRES_IN = "7d";

function createAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      role: "admin",
    },
    ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_JWT_EXPIRES_IN }
  );
}

function sanitizeAdmin(admin) {
  return {
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    is_active: Boolean(admin.is_active),
    created_at: admin.created_at,
    updated_at: admin.updated_at,
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

    const admin = await get(
      database,
      `
        SELECT id, full_name, email, password_hash, is_active, created_at, updated_at
        FROM admins
        WHERE email = ?
      `,
      [normalizedEmail]
    );

    if (!admin) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect admin email or password.",
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        error: "Admin Inactive",
        message: "This admin account is not active.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      String(password),
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect admin email or password.",
      });
    }

    const token = createAdminToken(admin);

    return res.json({
      message: "Admin login successful.",
      token,
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Login Failed",
      message: "Unable to log in right now.",
    });
  }
});

router.get("/me", requireAdminAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const admin = await get(
      database,
      `
        SELECT id, full_name, email, is_active, created_at, updated_at
        FROM admins
        WHERE id = ?
      `,
      [req.adminAuth.adminId]
    );

    if (!admin) {
      return res.status(404).json({
        error: "Admin Not Found",
        message: "No authenticated admin was found.",
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        error: "Admin Inactive",
        message: "This admin account is not active.",
      });
    }

    return res.json({
      admin: sanitizeAdmin(admin),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Admin Lookup Failed",
      message: "Unable to fetch the current admin.",
    });
  }
});

router.post("/logout", requireAdminAuth, (req, res) => {
  return res.json({
    message:
      "Admin logout is currently handled client-side by clearing the stored token.",
  });
});

module.exports = router;
