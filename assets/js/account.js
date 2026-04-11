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

  var totalOrders = document.querySelector("[data-total-orders]");
  var activeOrders = document.querySelector("[data-active-orders]");
  var savedRecipients = document.querySelector("[data-saved-recipients]");
  var welcomeName = document.querySelector("[data-account-name]");
  var profileSummary = document.querySelector("[data-profile-summary]");
  var recentOrders = document.querySelector("[data-recent-orders]");
  var feedback = document.querySelector("[data-account-feedback]");

  if (welcomeName) {
    welcomeName.textContent = (user.full_name || user.fullName).split(" ")[0];
  }

  if (profileSummary) {
    profileSummary.textContent =
      user.email + " • " + (user.phone || "No phone") + " • " + (user.country || "No country");
  }

  if (totalOrders) totalOrders.textContent = "0";
  if (activeOrders) activeOrders.textContent = "0";
  if (savedRecipients) savedRecipients.textContent = "0";

  if (recentOrders) {
    recentOrders.innerHTML = '<p class="form-hint">Your recent orders will appear here once loaded.</p>';
  }

  setFeedback("Loading your account summary...", "loading");

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

  try {
    var orderPayload = await window.FendorMockData.apiRequest("/orders", {
      headers: window.FendorMockData.getAuthHeaders(),
    });
    var orders = Array.isArray(orderPayload.orders) ? orderPayload.orders : [];

    if (totalOrders) {
      totalOrders.textContent = String(orders.length);
    }

    if (activeOrders) {
      activeOrders.textContent = String(
        orders.filter(function (order) {
          return String(order.order_status || "").toLowerCase() !== "delivered";
        }).length
      );
    }

    if (recentOrders) {
      if (!orders.length) {
        recentOrders.innerHTML =
          '<p class="form-hint">No orders yet. Your future Fendor orders will show up here.</p>';
      } else {
        recentOrders.innerHTML = orders
          .slice(0, 2)
          .map(function (order) {
            return (
              '<article class="order-card">' +
              '<div class="order-card__meta">' +
              '<span class="status-pill ' +
              getStatusClass(order.order_status) +
              '">' +
              escapeHtml(formatLabel(order.order_status)) +
              "</span>" +
              '<span class="muted-label">' +
              escapeHtml(order.order_code) +
              "</span>" +
              "</div>" +
              '<h3 class="title-md">' +
              escapeHtml(order.product_name) +
              "</h3>" +
              '<p class="card-copy">Recipient: ' +
              escapeHtml(order.recipient ? order.recipient.full_name : "Recipient pending") +
              "</p>" +
              '<div class="order-card__footer">' +
              '<span class="price">' +
              formatCurrency(order.total_amount) +
              "</span>" +
              '<a class="btn btn-secondary" href="order-detail.html?id=' +
              order.id +
              '">View order</a>' +
              "</div>" +
              "</article>"
            );
          })
          .join("");
      }
    }
  } catch (error) {
    if (recentOrders) {
      recentOrders.innerHTML =
        '<p class="form-hint form-hint--error">Unable to load your account summary right now.</p>';
    }
    setFeedback("We could not load your recent orders right now.", "error");
  }

  try {
    var recipientPayload = await window.FendorMockData.apiRequest("/recipients", {
      headers: window.FendorMockData.getAuthHeaders(),
    });
    var recipientCount = Array.isArray(recipientPayload.recipients)
      ? recipientPayload.recipients.length
      : 0;

    if (savedRecipients) {
      savedRecipients.textContent = String(recipientCount);
    }
    setFeedback("");
  } catch (error) {
    if (savedRecipients) {
      savedRecipients.textContent = "0";
    }
    if (!feedback || feedback.hidden) {
      setFeedback("Some account details could not be loaded. Please refresh and try again.", "error");
    }
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

  function formatLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
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
