document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorVendorAuth) {
    return;
  }

  var ordersPage = document.querySelector("[data-vendor-orders-page]");
  var detailPage = document.querySelector("[data-vendor-order-detail-page]");

  if (!ordersPage && !detailPage) {
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

  function getStatusClass(status) {
    var normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "delivered") {
      return "status-pill--delivered";
    }

    if (normalizedStatus === "out_for_delivery") {
      return "status-pill--delivery";
    }

    if (normalizedStatus === "processing" || normalizedStatus === "paid") {
      return "status-pill--processing";
    }

    return "status-pill--pending";
  }

  function setFeedback(target, message, type) {
    if (!target) {
      return;
    }

    target.hidden = !message;
    target.textContent = message || "";
    target.classList.remove("form-hint--success", "form-hint--error", "form-hint--loading");

    if (message) {
      if (type === "error") {
        target.classList.add("form-hint--error");
      } else if (type === "success") {
        target.classList.add("form-hint--success");
      } else if (type === "loading") {
        target.classList.add("form-hint--loading");
      }
    }
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
  }

  function handleVendorAuthError(error) {
    if (error && /token|unauthorized|expired|vendor session/i.test(error.message)) {
      window.FendorVendorAuth.logout();
      window.FendorVendorAuth.redirectToVendorLogin();
      return true;
    }

    return false;
  }

  function renderTrackingItems(tracking) {
    if (!tracking || !tracking.length) {
      return (
        '<div class="timeline-item">' +
        '<p class="card-copy">Tracking updates will appear here after your team adds progress notes for this order.</p>' +
        "</div>"
      );
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

  function renderVendorOrders(orders, list, emptyState) {
    if (!list) {
      return;
    }

    if (!orders.length) {
      list.innerHTML = "";
      if (emptyState) {
        emptyState.hidden = false;
      }
      return;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }

    list.innerHTML = orders
      .map(function (order) {
        return (
          '<article class="order-card">' +
          '<div class="page-toolbar">' +
          "<div>" +
          '<p class="muted-label">Order code</p>' +
          '<h2 class="title-md">' +
          escapeHtml(order.order_code) +
          "</h2>" +
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
          escapeHtml(order.recipient ? order.recipient.full_name : "Recipient unavailable") +
          "</span>" +
          '<span class="muted-label">Quantity: ' +
          escapeHtml(String(order.quantity || 1)) +
          "</span>" +
          "</div>" +
          '<h3 class="title-sm">' +
          escapeHtml(order.product_name) +
          "</h3>" +
          '<div class="order-card__footer">' +
          '<span class="price">' +
          formatCurrency(order.total_amount) +
          "</span>" +
          '<a class="btn btn-secondary" href="vendor-order-detail.html?id=' +
          order.id +
          '">View order</a>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function getRecipientAddress(recipient) {
    if (!recipient) {
      return "Recipient details are not available for this order.";
    }

    var parts = [
      recipient.address_line_1,
      recipient.address_line_2,
      recipient.city,
      recipient.state,
    ].filter(Boolean);

    return parts.length ? parts.join(", ") : "Address details are not available.";
  }

  function renderStatusOptions(statuses, currentStatus, includeBlank) {
    var options = [];

    if (includeBlank) {
      options.push('<option value="">Keep current status</option>');
    }

    return (
      options.join("") +
      statuses
        .map(function (status) {
          return (
            '<option value="' +
            escapeHtml(status) +
            '"' +
            (status === currentStatus && !includeBlank ? " selected" : "") +
            ">" +
            escapeHtml(formatLabel(status)) +
            "</option>"
          );
        })
        .join("")
    );
  }

  function renderVendorOrderDetail(order, allowedStatuses, detailTarget, emptyState) {
    if (!detailTarget) {
      return;
    }

    detailTarget.innerHTML =
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
        : '<p class="form-hint">No order note was added for this order.</p>') +
      "</section>" +
      '<section class="table-card">' +
      '<span class="eyebrow">Recipient</span>' +
      '<h2 class="title-md">' +
      escapeHtml(order.recipient ? order.recipient.full_name : "Recipient unavailable") +
      "</h2>" +
      '<p class="card-copy">' +
      escapeHtml(getRecipientAddress(order.recipient)) +
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
      '<section class="table-card">' +
      '<span class="eyebrow">Update status</span>' +
      '<h2 class="title-md">Keep the order stage current.</h2>' +
      '<form class="auth-form" data-vendor-order-status-form>' +
      '<div class="form-field">' +
      '<label class="form-label" for="vendor-order-status">Order status</label>' +
      '<select class="form-select" id="vendor-order-status" name="status" required>' +
      renderStatusOptions(allowedStatuses, order.order_status, false) +
      "</select>" +
      "</div>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-primary" type="submit" data-vendor-order-status-submit>Update status</button>' +
      "</div>" +
      "</form>" +
      "</section>" +
      '<section class="table-card">' +
      '<span class="eyebrow">Add tracking note</span>' +
      '<h2 class="title-md">Share a fulfillment update.</h2>' +
      '<form class="auth-form" data-vendor-order-tracking-form>' +
      '<div class="form-field">' +
      '<label class="form-label" for="vendor-tracking-status">Tracking status</label>' +
      '<select class="form-select" id="vendor-tracking-status" name="status">' +
      renderStatusOptions(allowedStatuses, order.order_status, true) +
      "</select>" +
      "</div>" +
      '<div class="form-field">' +
      '<label class="form-label" for="vendor-tracking-message">Tracking note</label>' +
      '<textarea class="form-textarea" id="vendor-tracking-message" name="message" placeholder="For example: Packaging completed and the dispatch rider has been booked." required></textarea>' +
      "</div>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-secondary" type="submit" data-vendor-order-tracking-submit>Add tracking note</button>' +
      "</div>" +
      "</form>" +
      "</section>" +
      '<section class="table-card order-detail-timeline">' +
      '<span class="eyebrow">Tracking timeline</span>' +
      '<h2 class="title-md">Latest fulfillment updates</h2>' +
      '<div class="timeline-list">' +
      renderTrackingItems(order.tracking) +
      "</div>" +
      "</section>" +
      "</div>" +
      "</article>";

    if (emptyState) {
      emptyState.hidden = true;
    }
  }

  async function initVendorOrdersPage() {
    var vendor = window.FendorVendorAuth.requireVendorAuth();
    if (!vendor) {
      return;
    }

    vendor = await window.FendorVendorAuth.fetchCurrentVendor();
    if (!vendor) {
      window.FendorVendorAuth.redirectToVendorLogin();
      return;
    }

    var list = document.querySelector("[data-vendor-orders-list]");
    var feedback = document.querySelector("[data-vendor-orders-feedback]");
    var emptyState = document.querySelector("[data-vendor-orders-empty]");

    try {
      setFeedback(feedback, "Loading your assigned orders...", "loading");

      var payload = await window.FendorVendorAuth.vendorApiRequest("/vendor/orders", {
        headers: window.FendorVendorAuth.getVendorAuthHeaders(),
      });

      renderVendorOrders(Array.isArray(payload.orders) ? payload.orders : [], list, emptyState);
      setFeedback(feedback, "");
    } catch (error) {
      if (handleVendorAuthError(error)) {
        return;
      }

      if (emptyState) {
        emptyState.hidden = false;
      }

      setFeedback(
        feedback,
        error.message || "Unable to load your vendor orders right now.",
        "error"
      );
    }
  }

  async function initVendorOrderDetailPage() {
    var vendor = window.FendorVendorAuth.requireVendorAuth();
    if (!vendor) {
      return;
    }

    vendor = await window.FendorVendorAuth.fetchCurrentVendor();
    if (!vendor) {
      window.FendorVendorAuth.redirectToVendorLogin();
      return;
    }

    var detailTarget = document.querySelector("[data-vendor-order-detail]");
    var feedback = document.querySelector("[data-vendor-order-feedback]");
    var emptyState = document.querySelector("[data-vendor-order-empty]");
    var params = new URLSearchParams(window.location.search);
    var orderId = params.get("id");
    var currentOrder = null;
    var allowedStatuses = [];

    async function loadOrder() {
      if (!orderId) {
        if (emptyState) {
          emptyState.hidden = false;
        }
        if (detailTarget) {
          detailTarget.innerHTML = "";
        }
        setFeedback(feedback, "No order was selected.", "error");
        return;
      }

      try {
        setFeedback(feedback, "Loading order details...", "loading");

        var payload = await window.FendorVendorAuth.vendorApiRequest("/vendor/orders/" + orderId, {
          headers: window.FendorVendorAuth.getVendorAuthHeaders(),
        });

        currentOrder = payload.order;
        allowedStatuses = Array.isArray(payload.allowed_statuses)
          ? payload.allowed_statuses
          : [];

        renderVendorOrderDetail(currentOrder, allowedStatuses, detailTarget, emptyState);
        bindDetailForms();
        setFeedback(feedback, "");
      } catch (error) {
        if (handleVendorAuthError(error)) {
          return;
        }

        if (detailTarget) {
          detailTarget.innerHTML = "";
        }
        if (emptyState) {
          emptyState.hidden = false;
        }

        setFeedback(
          feedback,
          error.message || "Unable to load this vendor order right now.",
          "error"
        );
      }
    }

    function bindDetailForms() {
      var statusForm = document.querySelector("[data-vendor-order-status-form]");
      var trackingForm = document.querySelector("[data-vendor-order-tracking-form]");
      var statusSubmit = document.querySelector("[data-vendor-order-status-submit]");
      var trackingSubmit = document.querySelector("[data-vendor-order-tracking-submit]");

      if (statusForm) {
        statusForm.addEventListener("submit", async function (event) {
          event.preventDefault();

          var formData = new FormData(statusForm);
          var nextStatus = String(formData.get("status") || "").trim();

          if (!nextStatus) {
            setFeedback(feedback, "Please choose a valid order status.", "error");
            return;
          }

          try {
            setButtonLoading(statusSubmit, true, "Updating...", "Update status");
            setFeedback(feedback, "Updating order status...", "loading");

            var payload = await window.FendorVendorAuth.vendorApiRequest(
              "/vendor/orders/" + orderId + "/status",
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization:
                    window.FendorVendorAuth.getVendorAuthHeaders().Authorization,
                },
                body: JSON.stringify({
                  status: nextStatus,
                }),
              }
            );

            currentOrder = payload.order;
            allowedStatuses = Array.isArray(payload.allowed_statuses)
              ? payload.allowed_statuses
              : allowedStatuses;

            renderVendorOrderDetail(currentOrder, allowedStatuses, detailTarget, emptyState);
            bindDetailForms();
            setFeedback(feedback, payload.message || "Order status updated.", "success");
          } catch (error) {
            if (handleVendorAuthError(error)) {
              return;
            }

            setFeedback(
              feedback,
              error.message || "Unable to update the order status right now.",
              "error"
            );
          } finally {
            setButtonLoading(statusSubmit, false, "Updating...", "Update status");
          }
        });
      }

      if (trackingForm) {
        trackingForm.addEventListener("submit", async function (event) {
          event.preventDefault();

          var formData = new FormData(trackingForm);
          var message = String(formData.get("message") || "").trim();
          var status = String(formData.get("status") || "").trim();

          if (!message) {
            setFeedback(feedback, "Please add a tracking note before saving.", "error");
            return;
          }

          try {
            setButtonLoading(trackingSubmit, true, "Saving...", "Add tracking note");
            setFeedback(feedback, "Saving tracking note...", "loading");

            await window.FendorVendorAuth.vendorApiRequest(
              "/vendor/orders/" + orderId + "/tracking",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization:
                    window.FendorVendorAuth.getVendorAuthHeaders().Authorization,
                },
                body: JSON.stringify({
                  status: status || undefined,
                  message: message,
                }),
              }
            );

            await loadOrder();
            setFeedback(feedback, "Tracking note added successfully.", "success");
          } catch (error) {
            if (handleVendorAuthError(error)) {
              return;
            }

            setFeedback(
              feedback,
              error.message || "Unable to save the tracking note right now.",
              "error"
            );
          } finally {
            setButtonLoading(trackingSubmit, false, "Saving...", "Add tracking note");
          }
        });
      }
    }

    await loadOrder();
  }

  if (ordersPage) {
    initVendorOrdersPage();
  }

  if (detailPage) {
    initVendorOrderDetailPage();
  }
});
