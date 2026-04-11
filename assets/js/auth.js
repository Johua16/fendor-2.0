(function () {
  var USER_KEY = "fendor_mock_user";
  var TOKEN_KEY = "fendor_auth_token";
  var API_BASE_URL = "/api";

  function getStoredUser() {
    var raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function getNextUrl() {
    var next = window.location.pathname.split("/").pop() || "account.html";
    if (window.location.search) {
      next += window.location.search;
    }
    return next;
  }

  function getPostAuthRedirect() {
    var params = new URLSearchParams(window.location.search);
    return params.get("next") || "account.html";
  }

  function redirectToLogin() {
    window.location.href = "login.html?next=" + encodeURIComponent(getNextUrl());
  }

  function requireAuth() {
    var token = getStoredToken();
    var user = getStoredUser();

    if (!token || !user) {
      redirectToLogin();
      return null;
    }

    return user;
  }

  function getAuthHeaders() {
    var token = getStoredToken();
    return token
      ? {
          Authorization: "Bearer " + token,
        }
      : {};
  }

  async function apiRequest(path, options) {
    var response = await fetch(API_BASE_URL + path, options || {});
    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.message || "Request failed.");
    }

    return payload;
  }

  async function signupWithApi(formData) {
    var payload = await apiRequest("/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    saveToken(payload.token);
    saveUser(payload.user);
    return payload.user;
  }

  async function loginWithApi(formData) {
    var payload = await apiRequest("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    saveToken(payload.token);
    saveUser(payload.user);
    return payload.user;
  }

  async function fetchCurrentUser() {
    var token = getStoredToken();

    if (!token) {
      return null;
    }

    try {
      var payload = await apiRequest("/auth/me", {
        headers: getAuthHeaders(),
      });
      saveUser(payload.user);
      return payload.user;
    } catch (error) {
      clearUser();
      return null;
    }
  }

  async function logoutAndRedirect() {
    try {
      if (getStoredToken()) {
        await apiRequest("/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        });
      }
    } catch (error) {
      // Logout is still token-clear first on the frontend.
    }

    clearUser();
    window.location.href = "login.html";
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
    document.querySelectorAll("[data-logout]").forEach(function (button) {
      button.addEventListener("click", async function () {
        setButtonLoading(button, true, "Logging out...", "Logout");
        await logoutAndRedirect();
      });
    });
  }

  function renderHeaderAuth() {
    var user = getStoredUser();
    var targets = document.querySelectorAll("[data-auth-slot]");

    targets.forEach(function (target) {
      if (!user) {
        target.innerHTML =
          '<a class="btn btn-secondary" href="login.html">Login</a>' +
          '<a class="btn btn-primary" href="signup.html">Sign Up</a>';
        return;
      }

      target.innerHTML =
        '<span class="header-chip"><span class="header-chip__dot" aria-hidden="true"></span>' +
        ((user.full_name || user.fullName).split(" ")[0]) +
        "</span>" +
        '<button class="btn btn-secondary" type="button" data-logout>Logout</button>';
    });

    bindLogoutButtons();
  }

  function initAuthForms() {
    var signupForm = document.querySelector("[data-signup-form]");
    var loginForm = document.querySelector("[data-login-form]");
    var feedback = document.querySelector("[data-auth-feedback]");
    var currentUser = getStoredUser();
    var currentToken = getStoredToken();

    if ((signupForm || loginForm) && currentUser && currentToken) {
      window.location.href = getPostAuthRedirect();
      return;
    }

    if (signupForm) {
      var signupButton = signupForm.querySelector('button[type="submit"]');
      signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setFeedback(feedback, "");
        var formData = new FormData(signupForm);

        if (!String(formData.get("full_name") || "").trim()) {
          setFeedback(feedback, "Full name is required.", "error");
          return;
        }

        if (String(formData.get("password") || "").length < 8) {
          setFeedback(feedback, "Password must be at least 8 characters.", "error");
          return;
        }

        if (formData.get("password") !== formData.get("confirm_password")) {
          setFeedback(feedback, "Passwords do not match.", "error");
          return;
        }

        try {
          setButtonLoading(signupButton, true, "Creating account...", "Create Account");
          await signupWithApi({
            full_name: formData.get("full_name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            country: formData.get("country"),
            password: formData.get("password"),
          });

          setFeedback(feedback, "Account created successfully. Redirecting...", "success");
          window.location.href = getPostAuthRedirect();
        } catch (error) {
          setFeedback(feedback, error.message, "error");
          setButtonLoading(signupButton, false, "Creating account...", "Create Account");
        }
      });
    }

    if (loginForm) {
      var loginButton = loginForm.querySelector('button[type="submit"]');
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setFeedback(feedback, "");
        var formData = new FormData(loginForm);
        try {
          setButtonLoading(loginButton, true, "Logging in...", "Login");
          await loginWithApi({
            email: formData.get("email"),
            password: formData.get("password"),
          });

          setFeedback(feedback, "Login successful. Redirecting...", "success");
          window.location.href = getPostAuthRedirect();
        } catch (error) {
          setFeedback(feedback, error.message, "error");
          setButtonLoading(loginButton, false, "Logging in...", "Login");
        }
      });
    }
  }

  window.FendorMockData = {
    getCurrentUser: getStoredUser,
    logout: clearUser,
    logoutAndRedirect: logoutAndRedirect,
    requireAuth: requireAuth,
    getAuthHeaders: getAuthHeaders,
    fetchCurrentUser: fetchCurrentUser,
    apiRequest: apiRequest,
    renderHeaderAuth: renderHeaderAuth,
    redirectToLogin: redirectToLogin,
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderHeaderAuth();
    initAuthForms();
  });
})();
