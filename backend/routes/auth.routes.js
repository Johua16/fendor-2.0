const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { getDatabase, get, run } = require("../db/database");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "fendor-phase2-dev-secret";
const JWT_EXPIRES_IN = "7d";

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

router.post("/signup", async (req, res) => {
  try {
    const { full_name, email, phone, country, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        error: "Validation Error",
        message: "full_name, email, and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const database = getDatabase();

    const existingUser = await get(
      database,
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUser) {
      return res.status(409).json({
        error: "Duplicate Email",
        message: "An account with that email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const result = await run(
      database,
      `
        INSERT INTO users (full_name, email, phone, country, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        String(full_name).trim(),
        normalizedEmail,
        phone ? String(phone).trim() : null,
        country ? String(country).trim() : null,
        passwordHash,
      ]
    );

    const user = await get(
      database,
      `
        SELECT id, full_name, email, phone, country, created_at, updated_at
        FROM users
        WHERE id = ?
      `,
      [result.lastID]
    );

    const token = createToken(user);

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Signup Failed",
      message: "Unable to create account right now.",
    });
  }
});

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

    const user = await get(
      database,
      `
        SELECT id, full_name, email, phone, country, password_hash, created_at, updated_at
        FROM users
        WHERE email = ?
      `,
      [normalizedEmail]
    );

    if (!user) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect email or password.",
      });
    }

    const token = createToken(user);

    return res.json({
      message: "Login successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Login Failed",
      message: "Unable to log in right now.",
    });
  }
});

router.post("/logout", (req, res) => {
  res.json({
    message: "Logout is currently handled client-side by clearing the stored token.",
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const user = await get(
      database,
      `
        SELECT id, full_name, email, phone, country, created_at, updated_at
        FROM users
        WHERE id = ?
      `,
      [req.auth.userId]
    );

    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
        message: "No authenticated customer was found.",
      });
    }

    return res.json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "User Lookup Failed",
      message: "Unable to fetch the current user.",
    });
  }
});

module.exports = router;
