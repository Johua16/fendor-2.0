const jwt = require("jsonwebtoken");

const VENDOR_JWT_SECRET =
  process.env.VENDOR_JWT_SECRET || "fendor-phase3-vendor-dev-secret";

function requireVendorAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "").trim()
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Vendor authentication token is required.",
    });
  }

  try {
    const payload = jwt.verify(token, VENDOR_JWT_SECRET);

    if (payload.role !== "vendor") {
      return res.status(403).json({
        error: "Forbidden",
        message: "This token is not authorized for vendor access.",
      });
    }

    req.vendorAuth = {
      strategy: "jwt",
      vendorId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired vendor authentication token.",
    });
  }
}

module.exports = requireVendorAuth;
