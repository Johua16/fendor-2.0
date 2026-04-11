document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorAdminAuth) {
    return;
  }

  var page = document.querySelector("[data-admin-products-page]");
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

  function getStatusClass(isActive) {
    return isActive ? "status-pill--delivered" : "status-pill--pending";
  }

  function setFeedback(message, type) {
    var target = document.querySelector("[data-admin-products-feedback]");
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

  async function loadProducts() {
    return window.FendorAdminAuth.adminApiRequest("/admin/products", {
      headers: window.FendorAdminAuth.getAdminAuthHeaders(),
    });
  }

  async function updateProduct(productId, isActive) {
    return window.FendorAdminAuth.adminApiRequest(
      "/admin/products/" + encodeURIComponent(productId),
      {
        method: "PATCH",
        headers: Object.assign(
          {
            "Content-Type": "application/json",
          },
          window.FendorAdminAuth.getAdminAuthHeaders()
        ),
        body: JSON.stringify({
          is_active: isActive,
        }),
      }
    );
  }

  function renderProducts(products) {
    var list = document.querySelector("[data-admin-products-list]");
    var empty = document.querySelector("[data-admin-products-empty]");
    if (!list) {
      return;
    }

    if (!products.length) {
      list.innerHTML = "";
      if (empty) {
        empty.hidden = false;
      }
      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    list.innerHTML = products
      .map(function (product) {
        return (
          '<article class="table-card vendor-product-card admin-product-card">' +
          '<div class="vendor-product-card__media">' +
          (product.image_url
            ? '<img class="card-photo" src="' + escapeHtml(product.image_url) + '" alt="' + escapeHtml(product.name) + '" />'
            : '<div class="card-photo card-photo--placeholder">No image yet</div>') +
          "</div>" +
          '<div class="page-toolbar">' +
          "<div>" +
          '<p class="muted-label">' + escapeHtml(product.vendor_name || "Vendor unavailable") + "</p>" +
          '<h2 class="title-md">' + escapeHtml(product.name) + "</h2>" +
          "</div>" +
          '<span class="status-pill ' + getStatusClass(product.is_active) + '">' +
          escapeHtml(product.is_active ? "Active" : "Inactive") +
          "</span>" +
          "</div>" +
          '<div class="order-card__meta">' +
          '<span class="muted-label">Category: ' + escapeHtml(product.category) + "</span>" +
          '<span class="muted-label">Price: ' + escapeHtml(formatCurrency(product.unit_price)) + "</span>" +
          "</div>" +
          '<p class="card-copy">' + escapeHtml(product.availability_note || product.description) + "</p>" +
          '<div class="order-card__footer">' +
          '<span class="muted-label">Vendor ID: ' + escapeHtml(String(product.vendor_id)) + "</span>" +
          '<button class="btn btn-secondary" type="button" data-admin-product-toggle="' + product.id + '" data-next-state="' + (product.is_active ? "0" : "1") + '">' +
          escapeHtml(product.is_active ? "Mark inactive" : "Mark active") +
          "</button>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function updateSummary(products) {
    var activeCount = products.filter(function (product) {
      return product.is_active;
    }).length;
    var totalTarget = document.querySelector("[data-admin-products-total]");
    var activeTarget = document.querySelector("[data-admin-products-active]");
    var inactiveTarget = document.querySelector("[data-admin-products-inactive]");

    if (totalTarget) {
      totalTarget.textContent = String(products.length);
    }
    if (activeTarget) {
      activeTarget.textContent = String(activeCount);
    }
    if (inactiveTarget) {
      inactiveTarget.textContent = String(products.length - activeCount);
    }
  }

  async function refreshProducts(successMessage) {
    try {
      setFeedback(successMessage || "Loading platform products...", successMessage ? "success" : "loading");
      var payload = await loadProducts();
      var products = payload.products || [];
      updateSummary(products);
      renderProducts(products);
      if (!successMessage) {
        setFeedback("");
      }
    } catch (error) {
      if (handleAdminAuthError(error)) {
        return;
      }
      setFeedback(error.message, "error");
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

    await refreshProducts();

    page.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-admin-product-toggle]");
      if (!button) {
        return;
      }

      var defaultLabel = button.textContent;

      try {
        button.disabled = true;
        button.textContent = "Updating...";
        setFeedback("Updating product visibility...", "loading");
        var nextState = button.getAttribute("data-next-state") === "1";
        var productId = button.getAttribute("data-admin-product-toggle");
        var payload = await updateProduct(productId, nextState);
        await refreshProducts(payload.message);
      } catch (error) {
        if (handleAdminAuthError(error)) {
          return;
        }
        setFeedback(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = defaultLabel;
      }
    });
  })();
});
