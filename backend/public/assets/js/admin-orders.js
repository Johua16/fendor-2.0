document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorAdminAuth) {
    return;
  }

  var page = document.querySelector("[data-admin-orders-page]");
  if (!page) {
    return;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(value) {
    return "N" + Number(value || 0).toLocaleString("en-NG");
  }

  function formatDate(value) {
    if (!value) {
      return "Date unavailable";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  function getStatusClass(status) {
    var normalized = String(status || "").toLowerCase();
    if (normalized === "delivered") {
      return "status-pill--delivered";
    }
    if (normalized === "out_for_delivery") {
      return "status-pill--delivery";
    }
    if (normalized === "processing" || normalized === "paid") {
      return "status-pill--processing";
    }
    return "status-pill--pending";
  }

  function setFeedback(message, type) {
    var target = document.querySelector("[data-admin-orders-feedback]");
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

  async function loadOrders() {
    return window.FendorAdminAuth.adminApiRequest("/admin/orders", {
      headers: window.FendorAdminAuth.getAdminAuthHeaders(),
    });
  }

  async function loadOrderDetail(orderId) {
    return window.FendorAdminAuth.adminApiRequest(
      "/admin/orders/" + encodeURIComponent(orderId),
      {
        headers: window.FendorAdminAuth.getAdminAuthHeaders(),
      }
    );
  }

  function renderOrders(orders) {
    var list = document.querySelector("[data-admin-orders-list]");
    var empty = document.querySelector("[data-admin-orders-empty]");
    if (!list) {
      return;
    }

    if (!orders.length) {
      list.innerHTML = "";
      if (empty) {
        empty.hidden = false;
      }
      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    list.innerHTML = orders
      .map(function (order) {
        return (
          '<article class="order-card">' +
          '<div class="page-toolbar">' +
          "<div>" +
          '<p class="muted-label">Order code</p>' +
          '<h2 class="title-md">' + escapeHtml(order.order_code) + "</h2>" +
          "</div>" +
          '<span class="status-pill ' + getStatusClass(order.order_status) + '">' +
          escapeHtml(formatLabel(order.order_status)) +
          "</span>" +
          "</div>" +
          '<div class="order-card__meta">' +
          '<span class="muted-label">Customer: ' + escapeHtml(order.customer.full_name || "Customer unavailable") + "</span>" +
          '<span class="muted-label">Vendor: ' + escapeHtml(order.vendor.business_name || "Vendor unavailable") + "</span>" +
          '<span class="muted-label">Payment: ' + escapeHtml(formatLabel(order.payment_status)) + "</span>" +
          '<span class="muted-label">Placed: ' + escapeHtml(formatDate(order.created_at)) + "</span>" +
          "</div>" +
          '<h3 class="title-sm">' + escapeHtml(order.product_name) + "</h3>" +
          '<div class="order-card__footer">' +
          '<span class="price">' + formatCurrency(order.total_amount) + "</span>" +
          '<a class="btn btn-secondary" href="admin-orders.html?id=' + order.id + '">View detail</a>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderOrderDetail(order) {
    var shell = document.querySelector("[data-admin-order-detail-shell]");
    var target = document.querySelector("[data-admin-order-detail]");
    var empty = document.querySelector("[data-admin-order-detail-empty]");
    if (!shell || !target) {
      return;
    }

    shell.hidden = false;
    if (empty) {
      empty.hidden = true;
    }
    target.innerHTML =
      '<article class="order-card order-detail-card">' +
      '<div class="page-toolbar">' +
      "<div>" +
      '<p class="muted-label">Order code</p>' +
      '<h2 class="title-lg">' + escapeHtml(order.order_code) + "</h2>" +
      "</div>" +
      '<span class="status-pill ' + getStatusClass(order.order_status) + '">' +
      escapeHtml(formatLabel(order.order_status)) +
      "</span>" +
      "</div>" +
      '<div class="order-detail-grid">' +
      '<section class="table-card">' +
      '<h3 class="title-md">Order summary</h3>' +
      '<dl class="meta-list">' +
      '<div><dt>Product</dt><dd>' + escapeHtml(order.product_name) + '</dd></div>' +
      '<div><dt>Quantity</dt><dd>' + escapeHtml(String(order.quantity)) + '</dd></div>' +
      '<div><dt>Total</dt><dd>' + escapeHtml(formatCurrency(order.total_amount)) + '</dd></div>' +
      '<div><dt>Payment status</dt><dd>' + escapeHtml(formatLabel(order.payment_status)) + '</dd></div>' +
      '<div><dt>Order status</dt><dd>' + escapeHtml(formatLabel(order.order_status)) + '</dd></div>' +
      '</dl>' +
      '<p class="card-copy">' + escapeHtml(order.order_note || "No order note was added by the customer.") + "</p>" +
      "</section>" +
      '<section class="table-card">' +
      '<h3 class="title-md">Customer and vendor</h3>' +
      '<dl class="meta-list">' +
      '<div><dt>Customer</dt><dd>' + escapeHtml(order.customer.full_name || "Unavailable") + '</dd></div>' +
      '<div><dt>Customer email</dt><dd>' + escapeHtml(order.customer.email || "Unavailable") + '</dd></div>' +
      '<div><dt>Vendor</dt><dd>' + escapeHtml(order.vendor.business_name || "Unavailable") + '</dd></div>' +
      '<div><dt>Vendor contact</dt><dd>' + escapeHtml(order.vendor.contact_name || "Unavailable") + '</dd></div>' +
      '</dl>' +
      "</section>" +
      '<section class="table-card">' +
      '<h3 class="title-md">Recipient</h3>' +
      '<dl class="meta-list">' +
      '<div><dt>Name</dt><dd>' + escapeHtml(order.recipient ? order.recipient.full_name : "Unavailable") + '</dd></div>' +
      '<div><dt>Phone</dt><dd>' + escapeHtml(order.recipient ? order.recipient.phone : "Unavailable") + '</dd></div>' +
      '<div><dt>Address</dt><dd>' +
      escapeHtml(
        order.recipient
          ? [
              order.recipient.address_line_1,
              order.recipient.address_line_2,
              order.recipient.city,
              order.recipient.state,
            ]
              .filter(Boolean)
              .join(", ")
          : "Unavailable"
      ) +
      '</dd></div>' +
      '</dl>' +
      "</section>" +
      '<section class="table-card order-detail-timeline">' +
      '<h3 class="title-md">Tracking history</h3>' +
      '<div class="timeline-list">' +
      (order.tracking && order.tracking.length
        ? order.tracking
            .map(function (item) {
              return (
                '<div class="timeline-item">' +
                '<p class="timeline-time">' + escapeHtml(formatDate(item.timestamp)) + "</p>" +
                '<p class="muted-label">' + escapeHtml(formatLabel(item.status)) + "</p>" +
                '<p class="card-copy">' + escapeHtml(item.message) + "</p>" +
                "</div>"
              );
            })
            .join("")
        : '<div class="timeline-item"><p class="card-copy">Tracking updates are not available for this order yet.</p></div>') +
      "</div>" +
      "</section>" +
      "</div>" +
      "</article>";
  }

  function updateSummary(orders) {
    var totalTarget = document.querySelector("[data-admin-orders-total]");
    var openTarget = document.querySelector("[data-admin-orders-open]");
    var deliveredTarget = document.querySelector("[data-admin-orders-delivered]");
    var deliveredCount = orders.filter(function (order) {
      return order.order_status === "delivered";
    }).length;

    if (totalTarget) {
      totalTarget.textContent = String(orders.length);
    }
    if (openTarget) {
      openTarget.textContent = String(orders.length - deliveredCount);
    }
    if (deliveredTarget) {
      deliveredTarget.textContent = String(deliveredCount);
    }
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

    try {
      setFeedback("Loading platform orders...", "loading");
      var payload = await loadOrders();
      var orders = payload.orders || [];
      updateSummary(orders);
      renderOrders(orders);
      setFeedback("");

      var params = new URLSearchParams(window.location.search);
      var orderId = params.get("id");
      if (orderId) {
        setFeedback("Loading order detail...", "loading");
        try {
          var detailPayload = await loadOrderDetail(orderId);
          renderOrderDetail(detailPayload.order);
          setFeedback("");
        } catch (error) {
          if (handleAdminAuthError(error)) {
            return;
          }

          var shell = document.querySelector("[data-admin-order-detail-shell]");
          var target = document.querySelector("[data-admin-order-detail]");
          var empty = document.querySelector("[data-admin-order-detail-empty]");
          if (shell) {
            shell.hidden = false;
          }
          if (target) {
            target.innerHTML = "";
          }
          if (empty) {
            empty.hidden = false;
          }
          setFeedback(error.message, "error");
        }
      }
    } catch (error) {
      if (handleAdminAuthError(error)) {
        return;
      }
      setFeedback(error.message, "error");
    }
  })();
});
