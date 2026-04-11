document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorAdminAuth) {
    return;
  }

  var dashboard = document.querySelector("[data-admin-dashboard]");
  if (!dashboard) {
    return;
  }

  function setText(selector, value) {
    var target = document.querySelector(selector);
    if (target) {
      target.textContent = value;
    }
  }

  function setFeedback(message, type) {
    var target = document.querySelector("[data-admin-feedback]");
    if (!target) {
      return;
    }

    target.hidden = !message;
    target.textContent = message || "";
    target.classList.remove("form-hint--success", "form-hint--error", "form-hint--loading");

    if (message) {
      if (type === "error") {
        target.classList.add("form-hint--error");
      } else if (type === "loading") {
        target.classList.add("form-hint--loading");
      } else if (type === "success") {
        target.classList.add("form-hint--success");
      }
    }
  }

  function handleAdminAuthError(error) {
    if (error && /token|unauthorized|expired|admin authentication/i.test(error.message)) {
      window.FendorAdminAuth.logout();
      window.FendorAdminAuth.redirectToAdminLogin();
      return true;
    }
    return false;
  }

  function extractListLength(result, key) {
    if (result.status !== "fulfilled") {
      return null;
    }

    return Array.isArray(result.value[key]) ? result.value[key].length : 0;
  }

  (async function () {
    var admin = window.FendorAdminAuth.requireAdminAuth();
    if (!admin) {
      return;
    }

    admin = await window.FendorAdminAuth.fetchCurrentAdmin();
    if (!admin) {
      window.FendorAdminAuth.redirectToAdminLogin();
      return;
    }

    setFeedback("Loading platform overview...", "loading");

    try {
      var results = await Promise.allSettled([
        window.FendorAdminAuth.adminApiRequest("/admin/vendors/applications?status=pending", {
          headers: window.FendorAdminAuth.getAdminAuthHeaders(),
        }),
        window.FendorAdminAuth.adminApiRequest("/admin/vendors", {
          headers: window.FendorAdminAuth.getAdminAuthHeaders(),
        }),
        window.FendorAdminAuth.adminApiRequest("/admin/products", {
          headers: window.FendorAdminAuth.getAdminAuthHeaders(),
        }),
        window.FendorAdminAuth.adminApiRequest("/admin/orders", {
          headers: window.FendorAdminAuth.getAdminAuthHeaders(),
        }),
      ]);

      var pendingApplications = results[0].status === "fulfilled" ? results[0].value.applications || [] : [];
      var vendors = results[1].status === "fulfilled" ? results[1].value.vendors || [] : [];
      var products = results[2].status === "fulfilled" ? results[2].value.products || [] : [];
      var orders = results[3].status === "fulfilled" ? results[3].value.orders || [] : [];

      var activeProducts = products.filter(function (product) {
        return product.is_active;
      }).length;
      var openOrders = orders.filter(function (order) {
        return order.order_status === "pending_confirmation" ||
          order.order_status === "processing" ||
          order.order_status === "out_for_delivery";
      }).length;

      setText("[data-admin-pending-applications-count]", String(pendingApplications.length));
      setText("[data-admin-approved-vendors-count]", String(vendors.length));
      setText("[data-admin-active-products-count]", String(activeProducts));
      setText("[data-admin-open-orders-count]", String(openOrders));

      var summary = document.querySelector("[data-admin-summary]");
      if (summary) {
        summary.textContent =
          admin.email +
          " • " +
          pendingApplications.length +
          " pending applications, " +
          vendors.length +
          " approved vendors, and " +
          openOrders +
          " active orders need visibility today.";
      }

      var failedSections = [];
      if (results[0].status === "rejected") failedSections.push("applications");
      if (results[1].status === "rejected") failedSections.push("vendors");
      if (results[2].status === "rejected") failedSections.push("products");
      if (results[3].status === "rejected") failedSections.push("orders");

      if (failedSections.length) {
        setFeedback(
          "Some dashboard data could not be loaded right now: " + failedSections.join(", ") + ".",
          "error"
        );
      } else {
        setFeedback("");
      }
    } catch (error) {
      if (handleAdminAuthError(error)) {
        return;
      }
      setFeedback(error.message, "error");
    }
  })();
});
