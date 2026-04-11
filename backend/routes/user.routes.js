const express = require("express");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/profile", requireAuth, (req, res) => {
  res.status(501).json({
    message: "User profile fetch not implemented yet.",
    authContext: req.auth,
    next: "Load the authenticated customer record from SQLite.",
  });
});

router.patch("/profile", requireAuth, (req, res) => {
  res.status(501).json({
    message: "User profile update not implemented yet.",
    authContext: req.auth,
    next: "Implement validated customer profile updates.",
  });
});

module.exports = router;
