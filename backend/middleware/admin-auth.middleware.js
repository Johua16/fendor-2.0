const jwt = require("jsonwebtoken");

const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "fendor-phase4-admin-dev-secret";

function requireAdminAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "").trim()
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Admin authentication token is required.",
    });
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);

    if (payload.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden",
        message: "This token is not authorized for admin access.",
      });
    }

    req.adminAuth = {
      strategy: "jwt",
      adminId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired admin authentication token.",
    });
  }
}

module.exports = requireAdminAuth;
