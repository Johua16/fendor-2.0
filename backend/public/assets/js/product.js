document.addEventListener("DOMContentLoaded", async function () {
  if (!window.FendorMockData) {
    return;
  }

  var productConfig = document.querySelector("[data-product-config]");
  var authPrompt = document.querySelector("[data-product-auth-prompt]");
  var form = document.querySelector("[data-product-order-form]");
  var recipientSelect = document.querySelector("[data-order-recipient]");
  var quantityInput = document.querySelector("[data-order-quantity]");
  var feedback = document.querySelector("[data-product-order-feedback]");
  var pageFeedback = document.querySelector("[data-product-page-feedback]");
  var emptyState = document.querySelector("[data-product-page-empty]");
  var placeOrderButton = document.querySelector("[data-place-order]");
  var unitPriceNode = document.querySelector("[data-order-unit-price]");
  var deliveryFeeNode = document.querySelector("[data-order-delivery-fee]");
  var totalNode = document.querySelector("[data-order-total]");
  var mainImage = document.querySelector("[data-product-main-image]");
  var thumbImages = document.querySelectorAll("[data-product-thumb]");
  var titleNode = document.querySelector("[data-product-name]");
  var descriptionNode = document.querySelector("[data-product-description]");
  var priceNode = document.querySelector("[data-product-price]");
  var categoryNode = document.querySelector("[data-product-category]");
  var idealForNode = document.querySelector("[data-product-ideal-for]");
  var availabilityNode = document.querySelector("[data-product-availability]");
  var eyebrowNode = document.querySelector("[data-product-eyebrow]");
  var statusBadgeNode = document.querySelector("[data-product-status-badge]");
  var pageSections = document.querySelectorAll("main > section");

  if (!productConfig || !authPrompt || !form || !recipientSelect || !quantityInput) {
    return;
  }

  var deliveryFee = Number(productConfig.getAttribute("data-delivery-fee") || 0);
  var recipients = [];
  var currentProduct = null;

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

  function getQuantity() {
    return Math.max(1, Number(quantityInput.value || 1));
  }

  function updateTotals() {
    var quantity = getQuantity();
    var unitPrice = Number(currentProduct ? currentProduct.unit_price : 0);
    var total = unitPrice * quantity + deliveryFee;

    if (unitPriceNode) {
      unitPriceNode.textContent = formatCurrency(unitPrice);
    }

    if (deliveryFeeNode) {
      deliveryFeeNode.textContent = formatCurrency(deliveryFee);
    }

    if (totalNode) {
      totalNode.textContent = formatCurrency(total);
    }

    return total;
  }

  function setLoading(isLoading) {
    if (!placeOrderButton) {
      return;
    }

    placeOrderButton.disabled = isLoading;
    placeOrderButton.textContent = isLoading ? "Placing order..." : "Place order";
  }

  function setOrderEnabled(isEnabled) {
    if (!placeOrderButton) {
      return;
    }

    placeOrderButton.disabled = !isEnabled;
  }

  function renderRecipients() {
    recipientSelect.innerHTML =
      '<option value="">Select a recipient</option>' +
      recipients
        .map(function (recipient) {
          return (
            '<option value="' +
            recipient.id +
            '"' +
            (recipient.is_default ? " selected" : "") +
            ">" +
            escapeHtml(recipient.full_name + " • " + recipient.city + ", " + recipient.state) +
            "</option>"
          );
        })
        .join("");
  }

  async function loadRecipients() {
    var payload = await window.FendorMockData.apiRequest("/recipients", {
      headers: window.FendorMockData.getAuthHeaders(),
    });

    recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
    renderRecipients();
  }

  function showLoggedOutState() {
    authPrompt.hidden = false;
    form.hidden = true;
    setFeedback(feedback, "");

    var nextTarget =
      (window.location.pathname.split("/").pop() || "product.html") + window.location.search;

    authPrompt.querySelectorAll("a").forEach(function (link) {
      var url = new URL(link.getAttribute("href"), window.location.href);
      url.searchParams.set("next", nextTarget);
      link.setAttribute("href", url.pathname.split("/").pop() + url.search);
    });
  }

  function showLoggedInState() {
    authPrompt.hidden = true;
    form.hidden = false;
  }

  function showUnavailableState(message) {
    var i;
    if (emptyState) {
      emptyState.hidden = false;
    }

    for (i = 0; i < pageSections.length; i += 1) {
      if (i > 0) {
        pageSections[i].hidden = true;
      }
    }

    var layout = document.querySelector(".product-layout");
    if (layout) {
      layout.hidden = true;
    }

    setFeedback(pageFeedback, message, "error");
  }

  function populateProduct(product) {
    currentProduct = product;
    productConfig.setAttribute("data-product-id", product.product_id);
    productConfig.setAttribute("data-vendor-id", product.vendor_id);

    if (titleNode) {
      titleNode.textContent = product.name;
    }

    if (descriptionNode) {
      descriptionNode.textContent = product.description;
    }

    if (priceNode) {
      priceNode.textContent = "From " + formatCurrency(product.unit_price);
    }

    if (categoryNode) {
      categoryNode.textContent = product.category || "Curated product";
    }

    if (idealForNode) {
      idealForNode.textContent = product.category
        ? "Gifting and support in " + product.category
        : "Thoughtful gifting and family support";
    }

    if (availabilityNode) {
      availabilityNode.textContent =
        product.availability_note || "Available for ordering with manual confirmation before fulfillment.";
    }

    if (statusBadgeNode) {
      statusBadgeNode.textContent = product.is_active ? "Active product" : "Unavailable";
    }

    if (eyebrowNode) {
      eyebrowNode.textContent = product.category || "Featured product";
    }

    if (mainImage) {
      mainImage.src =
        product.image_url ||
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1400&q=80";
      mainImage.alt = product.name;
    }

    thumbImages.forEach(function (image) {
      image.src =
        product.image_url ||
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1400&q=80";
      image.alt = product.name;
    });

    document.title = "Fendor Product | " + product.name;
    updateTotals();
  }

  async function loadProduct() {
    var params = new URLSearchParams(window.location.search);
    var productId = params.get("id");

    if (!productId) {
      showUnavailableState("No product was selected.");
      return false;
    }

    try {
      setFeedback(pageFeedback, "Loading product details...", "loading");

      var response = await fetch("/api/products/" + encodeURIComponent(productId));
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.message || "Unable to load this product.");
      }

      populateProduct(payload.product);
      setFeedback(pageFeedback, "");
      return true;
    } catch (error) {
      showUnavailableState(error.message || "Unable to load this product right now.");
      return false;
    }
  }

  var productLoaded = await loadProduct();
  if (!productLoaded) {
    return;
  }

  var storedUser = window.FendorMockData.getCurrentUser();
  var token = window.FendorMockData.getAuthHeaders().Authorization;

  if (!storedUser || !token) {
    showLoggedOutState();
    updateTotals();
    return;
  }

  var user = await window.FendorMockData.fetchCurrentUser();
  if (!user) {
    showLoggedOutState();
    updateTotals();
    return;
  }

  showLoggedInState();
  updateTotals();
  setOrderEnabled(false);

  try {
    setFeedback(feedback, "Loading your saved recipients...", "loading");
    await loadRecipients();
    if (!recipients.length) {
      setFeedback(feedback, "Add at least one saved recipient before placing an order.", "error");
      setOrderEnabled(false);
    } else {
      setFeedback(feedback, "");
      setOrderEnabled(true);
    }
  } catch (error) {
    setFeedback(feedback, error.message || "Unable to load saved recipients right now.", "error");
    setOrderEnabled(false);
  }

  quantityInput.addEventListener("input", function () {
    if (Number(quantityInput.value || 0) < 1) {
      quantityInput.value = "1";
    }
    updateTotals();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setFeedback(feedback, "");

    if (!currentProduct) {
      setFeedback(feedback, "This product is no longer available for ordering.", "error");
      return;
    }

    if (!recipients.length) {
      setFeedback(feedback, "Add a saved recipient before placing an order.", "error");
      return;
    }

    var formData = new FormData(form);
    var recipientId = formData.get("recipient_id");
    if (!recipientId) {
      setFeedback(feedback, "Please choose a saved recipient.", "error");
      return;
    }

    if (String(formData.get("order_note") || "").trim().length > 300) {
      setFeedback(feedback, "Order note should stay within 300 characters.", "error");
      return;
    }

    setLoading(true);

    try {
      var payload = await window.FendorMockData.apiRequest("/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: window.FendorMockData.getAuthHeaders().Authorization,
        },
        body: JSON.stringify({
          recipient_id: Number(recipientId),
          product_id: Number(currentProduct.product_id),
          vendor_id: Number(currentProduct.vendor_id),
          quantity: getQuantity(),
          delivery_fee: deliveryFee,
          payment_status: "pending",
          order_status: "pending_confirmation",
          order_note: formData.get("order_note"),
        }),
      });

      setFeedback(feedback, "Order created successfully. Redirecting...", "success");
      window.location.href = "order-detail.html?id=" + payload.order.id;
    } catch (error) {
      if (/token|unauthorized|expired/i.test(error.message)) {
        window.FendorMockData.logout();
        window.FendorMockData.redirectToLogin();
        return;
      }

      setFeedback(feedback, error.message || "Unable to place this order right now.", "error");
      setLoading(false);
    }
  });
});
