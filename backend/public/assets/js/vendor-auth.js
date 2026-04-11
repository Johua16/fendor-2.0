(function () {
  var VENDOR_KEY = "fendor_vendor_profile";
  var VENDOR_TOKEN_KEY = "fendor_vendor_auth_token";
  var API_BASE_URL = "/api";

  function getStoredVendor() {
    var raw = localStorage.getItem(VENDOR_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function getStoredVendorToken() {
    return localStorage.getItem(VENDOR_TOKEN_KEY);
  }

  function saveVendor(vendor) {
    localStorage.setItem(VENDOR_KEY, JSON.stringify(vendor));
  }

  function saveVendorToken(token) {
    localStorage.setItem(VENDOR_TOKEN_KEY, token);
  }

  function clearVendor() {
    localStorage.removeItem(VENDOR_KEY);
    localStorage.removeItem(VENDOR_TOKEN_KEY);
  }

  function getNextUrl() {
    var next = window.location.pathname.split("/").pop() || "vendor-dashboard.html";
    if (window.location.search) {
      next += window.location.search;
    }
    return next;
  }

  function getPostAuthRedirect() {
    var params = new URLSearchParams(window.location.search);
    return params.get("next") || "vendor-dashboard.html";
  }

  function redirectToVendorLogin() {
    window.location.href =
      "vendor-login.html?next=" + encodeURIComponent(getNextUrl());
  }

  function requireVendorAuth() {
    var token = getStoredVendorToken();
    var vendor = getStoredVendor();

    if (!token || !vendor) {
      redirectToVendorLogin();
      return null;
    }

    return vendor;
  }

  function getVendorAuthHeaders() {
    var token = getStoredVendorToken();
    return token
      ? {
          Authorization: "Bearer " + token,
        }
      : {};
  }

  async function vendorApiRequest(path, options) {
    var response = await fetch(API_BASE_URL + path, options || {});
    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }

    return payload;
  }

  async function loginVendorWithApi(formData) {
    var payload = await vendorApiRequest("/vendor/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    saveVendorToken(payload.token);
    saveVendor(payload.vendor);
    return payload.vendor;
  }

  async function fetchCurrentVendor() {
    var token = getStoredVendorToken();

    if (!token) {
      return null;
    }

    try {
      var payload = await vendorApiRequest("/vendor/auth/me", {
        headers: getVendorAuthHeaders(),
      });
      saveVendor(payload.vendor);
      return payload.vendor;
    } catch (error) {
      clearVendor();
      return null;
    }
  }

  async function vendorLogoutAndRedirect() {
    try {
      if (getStoredVendorToken()) {
        await vendorApiRequest("/vendor/auth/logout", {
          method: "POST",
          headers: getVendorAuthHeaders(),
        });
      }
    } catch (error) {
      // Vendor logout remains token-clear first on the frontend.
    }

    clearVendor();
    window.location.href = "vendor-login.html";
  }

  function setFeedback(target, message, type) {
    if (!target) {
      return;
    }

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

  function bindLogoutButtons() {
    document.querySelectorAll("[data-vendor-logout]").forEach(function (button) {
      button.addEventListener("click", async function () {
        setButtonLoading(button, true, "Logging out...", "Logout");
        await vendorLogoutAndRedirect();
      });
    });
  }

  function renderVendorHeaderAuth() {
    var vendor = getStoredVendor();
    var targets = document.querySelectorAll("[data-vendor-auth-slot]");

    targets.forEach(function (target) {
      if (!vendor) {
        target.innerHTML =
          '<a class="btn btn-secondary" href="index.html">Back to site</a>' +
          '<a class="btn btn-primary" href="vendor-login.html">Vendor Login</a>';
        return;
      }

      target.innerHTML =
        '<span class="header-chip"><span class="header-chip__dot" aria-hidden="true"></span>' +
        vendor.business_name +
        "</span>" +
        '<button class="btn btn-secondary" type="button" data-vendor-logout>Logout</button>';
    });

    bindLogoutButtons();
  }

  function initVendorLoginForm() {
    var loginForm = document.querySelector("[data-vendor-login-form]");
    var feedback = document.querySelector("[data-vendor-auth-feedback]");
    var currentVendor = getStoredVendor();
    var currentToken = getStoredVendorToken();

    if (!loginForm) {
      return;
    }

    if (currentVendor && currentToken) {
      window.location.href = getPostAuthRedirect();
      return;
    }

    var loginButton = loginForm.querySelector('button[type="submit"]');

    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setFeedback(feedback, "");
      var formData = new FormData(loginForm);

      try {
        setButtonLoading(loginButton, true, "Logging in...", "Vendor Login");
        setFeedback(feedback, "Checking your vendor account...", "loading");

        await loginVendorWithApi({
          email: formData.get("email"),
          password: formData.get("password"),
        });

        setFeedback(feedback, "Vendor login successful. Redirecting...", "success");
        window.location.href = getPostAuthRedirect();
      } catch (error) {
        setFeedback(feedback, error.message, "error");
        setButtonLoading(loginButton, false, "Logging in...", "Vendor Login");
      }
    });
  }

  function initVendorDashboard() {
    var dashboard = document.querySelector("[data-vendor-dashboard]");
    var vendorName = document.querySelector("[data-vendor-name]");
    var vendorSummary = document.querySelector("[data-vendor-summary]");
    var vendorFeedback = document.querySelector("[data-vendor-feedback]");
    var productsCount = document.querySelector("[data-vendor-products-count]");
    var ordersCount = document.querySelector("[data-vendor-orders-count]");
    var activeProductsCount = document.querySelector("[data-vendor-active-products-count]");

    if (!dashboard) {
      return;
    }

    (async function () {
      var vendor = requireVendorAuth();
      if (!vendor) {
        return;
      }

      setFeedback(vendorFeedback, "Loading your vendor workspace...", "loading");

      vendor = await fetchCurrentVendor();
      if (!vendor) {
        redirectToVendorLogin();
        return;
      }

      if (vendorName) {
        vendorName.textContent = vendor.business_name;
      }

      if (vendorSummary) {
        vendorSummary.textContent =
          vendor.contact_name +
          " • " +
          vendor.email +
          (vendor.phone ? " • " + vendor.phone : "");
      }

      try {
        var results = await Promise.all([
          vendorApiRequest("/vendor/products", {
            headers: getVendorAuthHeaders(),
          }),
          vendorApiRequest("/vendor/orders", {
            headers: getVendorAuthHeaders(),
          }),
        ]);

        var products = Array.isArray(results[0].products) ? results[0].products : [];
        var orders = Array.isArray(results[1].orders) ? results[1].orders : [];
        var activeProducts = products.filter(function (product) {
          return product.is_active;
        });

        if (productsCount) {
          productsCount.textContent = String(products.length);
        }

        if (ordersCount) {
          ordersCount.textContent = String(orders.length);
        }

        if (activeProductsCount) {
          activeProductsCount.textContent = String(activeProducts.length);
        }
      } catch (error) {
        if (productsCount) {
          productsCount.textContent = "0";
        }
        if (ordersCount) {
          ordersCount.textContent = "0";
        }
        if (activeProductsCount) {
          activeProductsCount.textContent = "0";
        }
      }

      setFeedback(vendorFeedback, "");
    })();
  }

  window.FendorVendorAuth = {
    getCurrentVendor: getStoredVendor,
    getVendorToken: getStoredVendorToken,
    getVendorAuthHeaders: getVendorAuthHeaders,
    fetchCurrentVendor: fetchCurrentVendor,
    requireVendorAuth: requireVendorAuth,
    redirectToVendorLogin: redirectToVendorLogin,
    vendorApiRequest: vendorApiRequest,
    logout: clearVendor,
    logoutAndRedirect: vendorLogoutAndRedirect,
    renderHeaderAuth: renderVendorHeaderAuth,
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderVendorHeaderAuth();
    initVendorLoginForm();
    initVendorDashboard();
  });
})();
