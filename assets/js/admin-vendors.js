document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorAdminAuth) {
    return;
  }

  var listPage = document.querySelector("[data-admin-vendors-page]");
  var detailPage = document.querySelector("[data-admin-vendor-detail-page]");

  if (!listPage && !detailPage) {
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

    if (normalizedStatus === "approved") {
      return "status-pill--delivered";
    }

    if (normalizedStatus === "rejected") {
      return "status-pill--rejected";
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

  function handleAdminAuthError(error) {
    if (error && /token|unauthorized|expired|admin authentication/i.test(error.message)) {
      window.FendorAdminAuth.logout();
      window.FendorAdminAuth.redirectToAdminLogin();
      return true;
    }

    return false;
  }

  function renderApplications(applications, listTarget, emptyTarget) {
    if (!listTarget) {
      return;
    }

    if (!applications.length) {
      listTarget.innerHTML = "";
      if (emptyTarget) {
        emptyTarget.hidden = false;
      }
      return;
    }

    if (emptyTarget) {
      emptyTarget.hidden = true;
    }

    listTarget.innerHTML = applications
      .map(function (application) {
        return (
          '<article class="order-card">' +
          '<div class="page-toolbar">' +
          "<div>" +
          '<p class="muted-label">Application #' +
          escapeHtml(String(application.id)) +
          "</p>" +
          '<h2 class="title-md">' +
          escapeHtml(application.business_name) +
          "</h2>" +
          "</div>" +
          '<span class="status-pill ' +
          getStatusClass(application.status) +
          '">' +
          escapeHtml(formatLabel(application.status)) +
          "</span>" +
          "</div>" +
          '<div class="order-card__meta">' +
          '<span class="muted-label">Contact: ' +
          escapeHtml(application.contact_name) +
          "</span>" +
          '<span class="muted-label">Email: ' +
          escapeHtml(application.email) +
          "</span>" +
          '<span class="muted-label">Submitted: ' +
          escapeHtml(formatDate(application.created_at)) +
          "</span>" +
          "</div>" +
          '<p class="card-copy">' +
          escapeHtml(application.product_categories || "Categories not specified yet.") +
          "</p>" +
          '<div class="order-card__footer">' +
          '<span class="muted-label">Phone: ' +
          escapeHtml(application.phone || "Not provided") +
          "</span>" +
          '<a class="btn btn-secondary" href="admin-vendor-detail.html?id=' +
          application.id +
          '">Review application</a>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderApplicationDetail(application, target, emptyTarget) {
    if (!target) {
      return;
    }

    if (emptyTarget) {
      emptyTarget.hidden = true;
    }

    target.innerHTML =
      '<article class="order-card order-detail-card">' +
      '<div class="page-toolbar">' +
      "<div>" +
      '<p class="muted-label">Application #' +
      escapeHtml(String(application.id)) +
      "</p>" +
      '<h1 class="title-lg">' +
      escapeHtml(application.business_name) +
      "</h1>" +
      "</div>" +
      '<span class="status-pill ' +
      getStatusClass(application.status) +
      '">' +
      escapeHtml(formatLabel(application.status)) +
      "</span>" +
      "</div>" +
      '<div class="order-detail-grid">' +
      '<section class="table-card">' +
      '<h2 class="title-md">Business details</h2>' +
      '<dl class="meta-list">' +
      "<div><dt>Business name</dt><dd>" +
      escapeHtml(application.business_name) +
      "</dd></div>" +
      "<div><dt>Business address</dt><dd>" +
      escapeHtml(application.business_address) +
      "</dd></div>" +
      "<div><dt>Categories</dt><dd>" +
      escapeHtml(application.product_categories || "Not provided") +
      "</dd></div>" +
      "</dl>" +
      '<p class="card-copy admin-application-copy">' +
      escapeHtml(application.business_description || "No business description was provided.") +
      "</p>" +
      "</section>" +
      '<section class="table-card">' +
      '<h2 class="title-md">Contact details</h2>' +
      '<dl class="meta-list">' +
      "<div><dt>Contact name</dt><dd>" +
      escapeHtml(application.contact_name) +
      "</dd></div>" +
      "<div><dt>Email</dt><dd>" +
      escapeHtml(application.email) +
      "</dd></div>" +
      "<div><dt>Phone</dt><dd>" +
      escapeHtml(application.phone || "Not provided") +
      "</dd></div>" +
      "<div><dt>Submitted</dt><dd>" +
      escapeHtml(formatDate(application.created_at)) +
      "</dd></div>" +
      "</dl>" +
      "</section>" +
      '<section class="table-card">' +
      '<h2 class="title-md">Application note</h2>' +
      '<p class="card-copy admin-application-copy">' +
      escapeHtml(
        application.application_note ||
          "No additional application note was provided with this submission."
      ) +
      "</p>" +
      "</section>" +
      '<section class="table-card">' +
      '<h2 class="title-md">Admin review area</h2>' +
      '<p class="card-copy">' +
      "Use this review area to record your decision and move the application into its next state." +
      "</p>" +
      '<dl class="meta-list">' +
      "<div><dt>Current status</dt><dd>" +
      escapeHtml(formatLabel(application.status)) +
      "</dd></div>" +
      "<div><dt>Review note</dt><dd>" +
      escapeHtml(application.review_note || "No admin review note yet.") +
      "</dd></div>" +
      "<div><dt>Reviewed at</dt><dd>" +
      escapeHtml(application.reviewed_at ? formatDate(application.reviewed_at) : "Not reviewed yet") +
      "</dd></div>" +
      "</dl>" +
      '<form class="auth-form admin-review-form" data-admin-review-form>' +
      '<label class="field-group">' +
      "<span>Review note</span>" +
      '<textarea name="review_note" rows="4" maxlength="500" placeholder="Add context for your decision or leave a short review note.">' +
      escapeHtml(application.review_note || "") +
      "</textarea>" +
      "</label>" +
      '<label class="field-group">' +
      "<span>Temporary password for approval</span>" +
      '<input type="password" name="temporary_password" minlength="8" placeholder="Required only when approving this application" />' +
      "</label>" +
      '<div class="toolbar-actions">' +
      '<button class="btn btn-primary" type="submit" data-review-action="approved">Approve application</button>' +
      '<button class="btn btn-secondary" type="submit" data-review-action="rejected">Reject application</button>' +
      "</div>" +
      '<p class="form-hint">Approving creates a live vendor account. Rejection keeps the application on file without creating an account.</p>' +
      "</form>" +
      "</section>" +
      "</div>" +
      "</article>";
  }

  async function loadApplications(status) {
    var path = "/admin/vendors/applications";
    if (status) {
      path += "?status=" + encodeURIComponent(status);
    }
    return window.FendorAdminAuth.adminApiRequest(path, {
      headers: window.FendorAdminAuth.getAdminAuthHeaders(),
    });
  }

  async function loadApplicationDetail(applicationId) {
    return window.FendorAdminAuth.adminApiRequest(
      "/admin/vendors/applications/" + encodeURIComponent(applicationId),
      {
        headers: window.FendorAdminAuth.getAdminAuthHeaders(),
      }
    );
  }

  async function updateApplicationStatus(applicationId, payload) {
    return window.FendorAdminAuth.adminApiRequest(
      "/admin/vendors/applications/" + encodeURIComponent(applicationId) + "/status",
      {
        method: "PATCH",
        headers: Object.assign(
          {
            "Content-Type": "application/json",
          },
          window.FendorAdminAuth.getAdminAuthHeaders()
        ),
        body: JSON.stringify(payload),
      }
    );
  }

  function bindReviewForm(applicationId, feedback, detailTarget, emptyTarget) {
    var reviewForm = document.querySelector("[data-admin-review-form]");

    if (!reviewForm) {
      return;
    }

    reviewForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      var action = event.submitter
        ? event.submitter.getAttribute("data-review-action")
        : "";
      var approveButton = reviewForm.querySelector('[data-review-action="approved"]');
      var rejectButton = reviewForm.querySelector('[data-review-action="rejected"]');
      var reviewNote = String(reviewForm.elements.review_note.value || "").trim();
      var temporaryPassword = String(reviewForm.elements.temporary_password.value || "").trim();

      if (action === "approved" && temporaryPassword.length < 8) {
        setFeedback(
          feedback,
          "Enter a temporary password with at least 8 characters before approving.",
          "error"
        );
        return;
      }

      try {
        setFeedback(
          feedback,
          action === "approved"
            ? "Approving vendor application..."
            : "Rejecting vendor application...",
          "loading"
        );
        setButtonLoading(
          approveButton,
          true,
          "Approving...",
          "Approve application"
        );
        setButtonLoading(
          rejectButton,
          true,
          "Rejecting...",
          "Reject application"
        );

        var updatePayload = await updateApplicationStatus(applicationId, {
          status: action,
          review_note: reviewNote,
          temporary_password: action === "approved" ? temporaryPassword : "",
        });

        renderApplicationDetail(updatePayload.application, detailTarget, emptyTarget);
        bindReviewForm(applicationId, feedback, detailTarget, emptyTarget);
        setFeedback(feedback, updatePayload.message, "success");
      } catch (error) {
        if (handleAdminAuthError(error)) {
          return;
        }

        setFeedback(feedback, error.message, "error");
      } finally {
        setButtonLoading(
          approveButton,
          false,
          "Approving...",
          "Approve application"
        );
        setButtonLoading(
          rejectButton,
          false,
          "Rejecting...",
          "Reject application"
        );
      }
    });
  }

  function initAdminVendorsPage() {
    if (!listPage) {
      return;
    }

    var feedback = document.querySelector("[data-admin-vendors-feedback]");
    var listTarget = document.querySelector("[data-admin-applications-list]");
    var emptyTarget = document.querySelector("[data-admin-applications-empty]");
    var filterForm = document.querySelector("[data-admin-application-filter]");
    var resetButton = document.querySelector("[data-admin-filter-reset]");
    var totalTarget = document.querySelector("[data-admin-application-total]");
    var pendingTarget = document.querySelector("[data-admin-application-pending]");
    var reviewedTarget = document.querySelector("[data-admin-application-reviewed]");

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

      async function refreshList(statusValue) {
        try {
          setFeedback(feedback, "Loading vendor applications...", "loading");
          var payload = await loadApplications(statusValue);
          var applications = payload.applications || [];
          var pendingCount = applications.filter(function (item) {
            return item.status === "pending";
          }).length;

          if (totalTarget) {
            totalTarget.textContent = String(applications.length);
          }

          if (pendingTarget) {
            pendingTarget.textContent = String(pendingCount);
          }

          if (reviewedTarget) {
            reviewedTarget.textContent = String(applications.length - pendingCount);
          }

          renderApplications(applications, listTarget, emptyTarget);
          setFeedback(feedback, "");
        } catch (error) {
          if (handleAdminAuthError(error)) {
            return;
          }

          if (listTarget) {
            listTarget.innerHTML = "";
          }
          if (emptyTarget) {
            emptyTarget.hidden = true;
          }
          setFeedback(feedback, error.message, "error");
        }
      }

      var params = new URLSearchParams(window.location.search);
      var currentStatus = params.get("status") || "";

      if (filterForm) {
        filterForm.elements.status.value = currentStatus;

        filterForm.addEventListener("submit", function (event) {
          event.preventDefault();
          currentStatus = filterForm.elements.status.value;

          var nextUrl = "admin-vendors.html";
          if (currentStatus) {
            nextUrl += "?status=" + encodeURIComponent(currentStatus);
          }

          window.history.replaceState({}, "", nextUrl);
          refreshList(currentStatus);
        });
      }

      if (resetButton) {
        resetButton.addEventListener("click", function () {
          currentStatus = "";
          if (filterForm) {
            filterForm.reset();
          }
          window.history.replaceState({}, "", "admin-vendors.html");
          refreshList("");
        });
      }

      refreshList(currentStatus);
    })();
  }

  function initAdminVendorDetailPage() {
    if (!detailPage) {
      return;
    }

    var feedback = document.querySelector("[data-admin-vendor-detail-feedback]");
    var detailTarget = document.querySelector("[data-admin-vendor-detail]");
    var emptyTarget = document.querySelector("[data-admin-vendor-detail-empty]");

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

      var params = new URLSearchParams(window.location.search);
      var applicationId = params.get("id");

      if (!applicationId) {
        if (emptyTarget) {
          emptyTarget.hidden = false;
        }
        if (detailTarget) {
          detailTarget.innerHTML = "";
        }
        setFeedback(feedback, "No application id was provided.", "error");
        return;
      }

      try {
        setFeedback(feedback, "Loading vendor application details...", "loading");
        var payload = await loadApplicationDetail(applicationId);
        renderApplicationDetail(payload.application, detailTarget, emptyTarget);
        setFeedback(feedback, "");
        bindReviewForm(applicationId, feedback, detailTarget, emptyTarget);
      } catch (error) {
        if (handleAdminAuthError(error)) {
          return;
        }

        if (detailTarget) {
          detailTarget.innerHTML = "";
        }
        if (emptyTarget) {
          emptyTarget.hidden = true;
        }

        if (/not found/i.test(error.message) && emptyTarget) {
          emptyTarget.hidden = false;
        }

        setFeedback(feedback, error.message, "error");
      }
    })();
  }

  initAdminVendorsPage();
  initAdminVendorDetailPage();
});
