(function () {
  var ADMIN_KEY = "fendor_admin_profile";
  var ADMIN_TOKEN_KEY = "fendor_admin_auth_token";
  var API_BASE_URL = "/api";

  function getStoredAdmin() {
    var raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function getStoredAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  function saveAdmin(admin) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  }

  function saveAdminToken(token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  function clearAdmin() {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  function getNextUrl() {
    var next = window.location.pathname.split("/").pop() || "admin-dashboard.html";
    if (window.location.search) {
      next += window.location.search;
    }
    return next;
  }

  function getPostAuthRedirect() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get("next") || "admin-dashboard.html";

    if (!/^[a-z0-9\-_.?=&]+\.html(?:\?.*)?$/i.test(next)) {
      return "admin-dashboard.html";
    }

    if (next.indexOf("admin-login.html") === 0) {
      return "admin-dashboard.html";
    }

    return next;
  }

  function redirectToAdminLogin() {
    window.location.href =
      "admin-login.html?next=" + encodeURIComponent(getNextUrl());
  }

  function requireAdminAuth() {
    var token = getStoredAdminToken();
    var admin = getStoredAdmin();

    if (!token || !admin) {
      redirectToAdminLogin();
      return null;
    }

    return admin;
  }

  function getAdminAuthHeaders() {
    var token = getStoredAdminToken();
    return token
      ? {
          Authorization: "Bearer " + token,
        }
      : {};
  }

  async function adminApiRequest(path, options) {
    var response = await fetch(API_BASE_URL + path, options || {});
    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }

    return payload;
  }

  async function loginAdminWithApi(formData) {
    var payload = await adminApiRequest("/admin/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    saveAdminToken(payload.token);
    saveAdmin(payload.admin);
    return payload.admin;
  }

  async function fetchCurrentAdmin() {
    var token = getStoredAdminToken();

    if (!token) {
      return null;
    }

    try {
      var payload = await adminApiRequest("/admin/auth/me", {
        headers: getAdminAuthHeaders(),
      });
      saveAdmin(payload.admin);
      return payload.admin;
    } catch (error) {
      clearAdmin();
      return null;
    }
  }

  async function adminLogoutAndRedirect() {
    try {
      if (getStoredAdminToken()) {
        await adminApiRequest("/admin/auth/logout", {
          method: "POST",
          headers: getAdminAuthHeaders(),
        });
      }
    } catch (error) {
      // Admin logout remains token-clear first on the frontend.
    }

    clearAdmin();
    window.location.href = "admin-login.html";
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

  function bindLogoutButtons() {
    document.querySelectorAll("[data-admin-logout]").forEach(function (button) {
      button.addEventListener("click", async function () {
        setButtonLoading(button, true, "Logging out...", "Logout");
        await adminLogoutAndRedirect();
      });
    });
  }

  function renderAdminHeaderAuth() {
    var admin = getStoredAdmin();
    var targets = document.querySelectorAll("[data-admin-auth-slot]");

    targets.forEach(function (target) {
      if (!admin) {
        target.innerHTML =
          '<a class="btn btn-secondary" href="index.html">Back to site</a>' +
          '<a class="btn btn-primary" href="admin-login.html">Admin Login</a>';
        return;
      }

      target.innerHTML =
        '<span class="header-chip"><span class="header-chip__dot" aria-hidden="true"></span>' +
        admin.full_name +
        "</span>" +
        '<button class="btn btn-secondary" type="button" data-admin-logout>Logout</button>';
    });

    bindLogoutButtons();
  }

  function initAdminLoginForm() {
    var loginForm = document.querySelector("[data-admin-login-form]");
    var feedback = document.querySelector("[data-admin-auth-feedback]");
    var currentAdmin = getStoredAdmin();
    var currentToken = getStoredAdminToken();

    if (!loginForm) {
      return;
    }

    if (currentAdmin && currentToken) {
      window.location.href = getPostAuthRedirect();
      return;
    }

    var loginButton = loginForm.querySelector('button[type="submit"]');

    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      setFeedback(feedback, "");
      var formData = new FormData(loginForm);
      var email = String(formData.get("email") || "").trim().toLowerCase();
      var password = String(formData.get("password") || "");

      if (!email) {
        setFeedback(feedback, "Email address is required.", "error");
        return;
      }

      if (!password) {
        setFeedback(feedback, "Password is required.", "error");
        return;
      }

      try {
        setButtonLoading(loginButton, true, "Logging in...", "Admin Login");
        setFeedback(feedback, "Checking your admin account...", "loading");

        await loginAdminWithApi({
          email: email,
          password: password,
        });

        setFeedback(feedback, "Admin login successful. Redirecting...", "success");
        window.location.href = getPostAuthRedirect();
      } catch (error) {
        setFeedback(feedback, error.message, "error");
        setButtonLoading(loginButton, false, "Logging in...", "Admin Login");
      }
    });
  }

  function initAdminDashboard() {
    var dashboard = document.querySelector("[data-admin-dashboard]");
    var adminName = document.querySelector("[data-admin-name]");
    var adminSummary = document.querySelector("[data-admin-summary]");
    var adminFeedback = document.querySelector("[data-admin-feedback]");

    if (!dashboard) {
      return;
    }

    (async function () {
      var admin = requireAdminAuth();
      if (!admin) {
        return;
      }

      setFeedback(adminFeedback, "Loading your admin workspace...", "loading");

      admin = await fetchCurrentAdmin();
      if (!admin) {
        redirectToAdminLogin();
        return;
      }

      if (adminName) {
        adminName.textContent = admin.full_name;
      }

      if (adminSummary) {
        adminSummary.textContent = admin.email + " • Admin workspace access is active.";
      }

      setFeedback(adminFeedback, "");
    })();
  }

  window.FendorAdminAuth = {
    getCurrentAdmin: getStoredAdmin,
    getAdminToken: getStoredAdminToken,
    getAdminAuthHeaders: getAdminAuthHeaders,
    fetchCurrentAdmin: fetchCurrentAdmin,
    requireAdminAuth: requireAdminAuth,
    redirectToAdminLogin: redirectToAdminLogin,
    adminApiRequest: adminApiRequest,
    logout: clearAdmin,
    logoutAndRedirect: adminLogoutAndRedirect,
    renderHeaderAuth: renderAdminHeaderAuth,
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderAdminHeaderAuth();
    initAdminLoginForm();
    initAdminDashboard();
  });
})();
