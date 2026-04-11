document.addEventListener("DOMContentLoaded", async function () {
  if (!window.FendorMockData) {
    return;
  }

  var user = window.FendorMockData.requireAuth();
  if (!user) {
    return;
  }

  user = await window.FendorMockData.fetchCurrentUser();
  if (!user) {
    window.FendorMockData.redirectToLogin();
    return;
  }

  var list = document.querySelector("[data-orders-list]");
  var emptyState = document.querySelector("[data-orders-empty]");
  var detailCard = document.querySelector("[data-order-detail]");
  var detailEmpty = document.querySelector("[data-order-detail-empty]");
  var feedback = document.querySelector("[data-orders-feedback]");

  if (!list && !detailCard) {
    return;
  }

  function setFeedback(message, type) {
    if (!feedback) {
      return;
    }

    feedback.hidden = !message;
    feedback.textContent = message || "";
    feedback.classList.remove("form-hint--success", "form-hint--error", "form-hint--loading");

    if (message) {
      if (type === "error") {
        feedback.classList.add("form-hint--error");
      } else if (type === "success") {
        feedback.classList.add("form-hint--success");
      } else if (type === "loading") {
        feedback.classList.add("form-hint--loading");
      }
    }
  }

  function handleUnauthorized(error) {
    if (error && /token|unauthorized|expired/i.test(error.message)) {
      window.FendorMockData.logout();
      window.FendorMockData.redirectToLogin();
      return true;
    }

    return false;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
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

  function renderTracking(tracking) {
    if (!tracking || !tracking.length) {
      return '<div class="timeline-item"><p class="card-copy">Tracking updates will appear here once the order progresses.</p></div>';
    }

    return tracking
      .map(function (item) {
        return (
          '<div class="timeline-item">' +
          '<p class="timeline-time">' +
          escapeHtml(formatDate(item.timestamp)) +
          "</p>" +
          '<p class="muted-label">' +
          escapeHtml(formatLabel(item.status)) +
          "</p>" +
          '<p class="card-copy">' +
          escapeHtml(item.message) +
          "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderOrderList(orders) {
    if (!list) {
      return;
    }

    if (!orders.length) {
      if (emptyState) {
        emptyState.hidden = false;
      }
      list.innerHTML = "";
      return;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }

    list.innerHTML = orders
      .map(function (order) {
        return (
          '<article class="order-card" id="order-' +
          order.id +
          '">' +
          '<div class="page-toolbar">' +
          "<div>" +
          '<p class="muted-label">Order code</p>' +
          '<h3 class="title-md">' +
          escapeHtml(order.order_code) +
          "</h3>" +
          "</div>" +
          '<span class="status-pill ' +
          getStatusClass(order.order_status) +
          '">' +
          escapeHtml(formatLabel(order.order_status)) +
          "</span>" +
          "</div>" +
          '<div class="order-card__meta">' +
          '<span class="muted-label">Placed: ' +
          escapeHtml(formatDate(order.created_at)) +
          "</span>" +
          '<span class="muted-label">Payment: ' +
          escapeHtml(formatLabel(order.payment_status)) +
          "</span>" +
          '<span class="muted-label">Recipient: ' +
          escapeHtml(order.recipient ? order.recipient.full_name : "Recipient pending") +
          "</span>" +
          "</div>" +
          '<h4 class="title-sm">' +
          escapeHtml(order.product_name) +
          "</h4>" +
          '<div class="order-card__footer">' +
          '<span class="price">' +
          formatCurrency(order.total_amount) +
          "</span>" +
          '<a class="btn btn-secondary" href="order-detail.html?id=' +
          order.id +
          '">View order</a>' +
          "</div>" +
          '<div class="timeline-list">' +
          renderTracking((order.tracking || []).slice(-2)) +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderOrderDetail(order) {
    if (!detailCard) {
      return;
    }

    detailCard.innerHTML =
      '<article class="order-card order-detail-card">' +
      '<div class="page-toolbar">' +
      "<div>" +
      '<p class="muted-label">Order code</p>' +
      '<h1 class="title-lg">' +
      escapeHtml(order.order_code) +
      "</h1>" +
      "</div>" +
      '<span class="status-pill ' +
      getStatusClass(order.order_status) +
      '">' +
      escapeHtml(formatLabel(order.order_status)) +
      "</span>" +
      "</div>" +
      '<div class="order-detail-grid">' +
      '<section class="table-card">' +
      '<span class="eyebrow">Order summary</span>' +
      '<h2 class="title-md">' +
      escapeHtml(order.product_name) +
      "</h2>" +
      '<div class="stat-grid">' +
      '<div><p class="muted-label">Placed</p><p class="card-copy">' +
      escapeHtml(formatDate(order.created_at)) +
      '</p></div>' +
      '<div><p class="muted-label">Payment</p><p class="card-copy">' +
      escapeHtml(formatLabel(order.payment_status)) +
      '</p></div>' +
      '<div><p class="muted-label">Quantity</p><p class="card-copy">' +
      escapeHtml(String(order.quantity)) +
      '</p></div>' +
      '<div><p class="muted-label">Total</p><p class="price">' +
      formatCurrency(order.total_amount) +
      "</p></div>" +
      "</div>" +
      (order.order_note
        ? '<p class="form-hint">Order note: ' + escapeHtml(order.order_note) + "</p>"
        : "") +
      "</section>" +
      '<section class="table-card">' +
      '<span class="eyebrow">Recipient</span>' +
      '<h2 class="title-md">' +
      escapeHtml(order.recipient ? order.recipient.full_name : "Recipient not available") +
      "</h2>" +
      '<p class="card-copy">' +
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
          : "Recipient details are not available for this order."
      ) +
      "</p>" +
      '<div class="recipient-card__meta">' +
      (order.recipient && order.recipient.phone
        ? '<span class="muted-label">' + escapeHtml(order.recipient.phone) + "</span>"
        : "") +
      (order.recipient && order.recipient.email
        ? '<span class="muted-label">' + escapeHtml(order.recipient.email) + "</span>"
        : "") +
      "</div>" +
      "</section>" +
      '<section class="table-card order-detail-timeline">' +
      '<span class="eyebrow">Tracking timeline</span>' +
      '<h2 class="title-md">Latest delivery updates</h2>' +
      '<div class="timeline-list">' +
      renderTracking(order.tracking) +
      "</div>" +
      "</section>" +
      "</div>" +
      "</article>";

    if (detailEmpty) {
      detailEmpty.hidden = true;
    }
  }

  try {
    setFeedback("Loading your orders...", "loading");

    if (list) {
      var orderListPayload = await window.FendorMockData.apiRequest("/orders", {
        headers: window.FendorMockData.getAuthHeaders(),
      });
      renderOrderList(Array.isArray(orderListPayload.orders) ? orderListPayload.orders : []);
    }

    if (detailCard) {
      var params = new URLSearchParams(window.location.search);
      var orderId = params.get("id");

      if (!orderId) {
        if (detailEmpty) {
          detailEmpty.hidden = false;
        }
        setFeedback("No order was selected.", "error");
        return;
      }

      var orderDetailPayload = await window.FendorMockData.apiRequest("/orders/" + orderId, {
        headers: window.FendorMockData.getAuthHeaders(),
      });
      renderOrderDetail(orderDetailPayload.order);
    }
    setFeedback("");
  } catch (error) {
    if (handleUnauthorized(error)) {
      return;
    }

    if (detailEmpty) {
      detailEmpty.hidden = false;
    }
    if (emptyState) {
      emptyState.hidden = false;
    }
    setFeedback(error.message || "Unable to load orders right now.", "error");
  }

  function getStatusClass(status) {
    var normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "delivered") return "status-pill--delivered";
    if (normalizedStatus === "out_for_delivery" || normalizedStatus === "out for delivery") {
      return "status-pill--delivery";
    }
    if (normalizedStatus === "processing" || normalizedStatus === "payment_received") {
      return "status-pill--processing";
    }
    return "status-pill--pending";
  }
});
