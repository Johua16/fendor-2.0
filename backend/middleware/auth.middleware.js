const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fendor-phase2-dev-secret";

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "").trim()
    : null;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication token is required.",
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = {
      strategy: "jwt",
      userId: payload.sub,
      email: payload.email,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired authentication token.",
    });
  }
}

module.exports = requireAuth;
