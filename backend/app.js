const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");
const adminVendorRoutes = require("./routes/admin-vendor.routes");
const adminProductRoutes = require("./routes/admin-product.routes");
const adminOrderRoutes = require("./routes/admin-order.routes");
const vendorAuthRoutes = require("./routes/vendor-auth.routes");
const vendorApplicationRoutes = require("./routes/vendor-application.routes");
const vendorProductRoutes = require("./routes/vendor-product.routes");
const vendorOrderRoutes = require("./routes/vendor-order.routes");
const productRoutes = require("./routes/product.routes");
const userRoutes = require("./routes/user.routes");
const recipientRoutes = require("./routes/recipient.routes");
const orderRoutes = require("./routes/order.routes");

const app = express();
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const ASSETS_ROOT = path.join(FRONTEND_ROOT, "assets");
const STATIC_PAGES = [
  "index.html",
  "shop.html",
  "product.html",
  "about.html",
  "contact.html",
  "signup.html",
  "login.html",
  "account.html",
  "orders.html",
  "order-detail.html",
  "recipients.html",
  "vendor-login.html",
  "vendor-dashboard.html",
  "vendor-products.html",
  "vendor-product-form.html",
  "vendor-orders.html",
  "vendor-order-detail.html",
  "vendor-apply.html",
  "admin-login.html",
  "admin-dashboard.html",
  "admin-vendors.html",
  "admin-vendor-detail.html",
  "admin-products.html",
  "admin-orders.html",
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "fendor-backend",
    phase: "phase-2-foundation",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/vendors", adminVendorRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/vendor-applications", vendorApplicationRoutes);
app.use("/api/vendor/auth", vendorAuthRoutes);
app.use("/api/vendor/products", vendorProductRoutes);
app.use("/api/vendor/orders", vendorOrderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/recipients", recipientRoutes);
app.use("/api/orders", orderRoutes);

app.use("/assets", express.static(ASSETS_ROOT));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, "index.html"));
});

STATIC_PAGES.forEach((pageName) => {
  if (pageName === "index.html") {
    return;
  }

  app.get("/" + pageName, (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, pageName));
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong on the server.",
  });
});

module.exports = app;
