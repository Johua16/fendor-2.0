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

  var recipients = [];
  var list = document.querySelector("[data-recipient-list]");
  var empty = document.querySelector("[data-recipient-empty]");
  var panel = document.querySelector("[data-recipient-form-panel]");
  var form = document.querySelector("[data-recipient-form]");
  var title = document.querySelector("[data-recipient-form-title]");
  var addButton = document.querySelector("[data-add-recipient]");
  var cancelButton = document.querySelector("[data-cancel-recipient]");
  var feedback = document.querySelector("[data-recipient-feedback]");
  var submitButton = form ? form.querySelector('button[type="submit"]') : null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setFeedback(message, type) {
    if (!feedback) {
      return;
    }

    feedback.hidden = !message;
    feedback.textContent = message || "";
    feedback.classList.remove("form-hint--success", "form-hint--error", "form-hint--loading");

    if (!message) {
      return;
    }

    if (type === "error") {
      feedback.classList.add("form-hint--error");
    } else if (type === "success") {
      feedback.classList.add("form-hint--success");
    } else if (type === "loading") {
      feedback.classList.add("form-hint--loading");
    }
  }

  function setFormLoading(isLoading) {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "Saving..." : "Save recipient";
  }

  async function fetchRecipients() {
    var payload = await window.FendorMockData.apiRequest("/recipients", {
      headers: window.FendorMockData.getAuthHeaders(),
    });

    recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
    return recipients;
  }

  async function saveRecipient(id, payload) {
    var path = id ? "/recipients/" + id : "/recipients";
    var method = id ? "PATCH" : "POST";
    return window.FendorMockData.apiRequest(path, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: window.FendorMockData.getAuthHeaders().Authorization,
      },
      body: JSON.stringify(payload),
    });
  }

  async function deleteRecipient(id) {
    return window.FendorMockData.apiRequest("/recipients/" + id, {
      method: "DELETE",
      headers: window.FendorMockData.getAuthHeaders(),
    });
  }

  async function updateDefaultRecipient(id) {
    return window.FendorMockData.apiRequest("/recipients/" + id, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: window.FendorMockData.getAuthHeaders().Authorization,
      },
      body: JSON.stringify({
        is_default: true,
      }),
    });
  }

  function render() {
    if (!recipients.length) {
      if (empty) empty.hidden = false;
      if (list) list.innerHTML = "";
      return;
    }

    if (empty) empty.hidden = true;

    list.innerHTML = recipients
      .map(function (recipient) {
        var recipientId = String(recipient.id);
        var recipientName = escapeHtml(recipient.full_name);
        var recipientCity = escapeHtml(recipient.city);
        var recipientState = escapeHtml(recipient.state);
        var recipientPhone = escapeHtml(recipient.phone);
        var recipientEmail = escapeHtml(recipient.email);
        var addressLine1 = escapeHtml(recipient.address_line_1);
        var addressLine2 = escapeHtml(recipient.address_line_2);
        var deliveryNotes = escapeHtml(recipient.delivery_notes);

        return (
          '<article class="recipient-card' +
          (recipient.is_default ? " is-default" : "") +
          '">' +
          '<div class="page-toolbar">' +
          "<div>" +
          '<h3 class="title-md">' +
          recipientName +
          "</h3>" +
          '<p class="section-subtitle">' +
          recipientCity +
          ", " +
          recipientState +
          "</p>" +
          "</div>" +
          (recipient.is_default
            ? '<span class="recipient-default-tag">Default recipient</span>'
            : "") +
          "</div>" +
          '<div class="recipient-card__meta">' +
          '<span class="muted-label">' +
          recipientPhone +
          "</span>" +
          (recipient.email ? '<span class="muted-label">' + recipientEmail + "</span>" : "") +
          "</div>" +
          '<p class="card-copy">' +
          addressLine1 +
          (recipient.address_line_2 ? ", " + addressLine2 : "") +
          ", " +
          recipientCity +
          ", " +
          recipientState +
          "</p>" +
          (recipient.delivery_notes ? '<p class="form-hint">' + deliveryNotes + "</p>" : "") +
          '<div class="recipient-card__footer">' +
          '<div class="toolbar-actions">' +
          '<button class="btn btn-secondary" type="button" data-edit-recipient="' +
          recipientId +
          '">Edit</button>' +
          (recipient.is_default
            ? ""
            : '<button class="btn btn-secondary" type="button" data-default-recipient="' +
              recipientId +
              '">Set default</button>') +
          "</div>" +
          '<button class="btn btn-accent" type="button" data-delete-recipient="' +
          recipientId +
          '">Delete</button>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    bindActions();
  }

  function bindActions() {
    document.querySelectorAll("[data-edit-recipient]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var id = button.getAttribute("data-edit-recipient");
        try {
          setFeedback("");
          var payload = await window.FendorMockData.apiRequest("/recipients/" + id, {
            headers: window.FendorMockData.getAuthHeaders(),
          });
          if (!payload.recipient) return;
          openForm("Edit recipient", payload.recipient);
        } catch (error) {
          handleApiError(error);
        }
      });
    });

    document.querySelectorAll("[data-default-recipient]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var id = button.getAttribute("data-default-recipient");
        try {
          setFeedback("");
          await updateDefaultRecipient(id);
          await reloadRecipients();
          setFeedback("Default recipient updated.", "success");
        } catch (error) {
          handleApiError(error);
        }
      });
    });

    document.querySelectorAll("[data-delete-recipient]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var id = button.getAttribute("data-delete-recipient");
        if (!window.confirm("Delete this saved recipient?")) {
          return;
        }

        try {
          setFeedback("");
          await deleteRecipient(id);
          await reloadRecipients();
          closeForm();
          setFeedback("Recipient deleted successfully.", "success");
        } catch (error) {
          handleApiError(error);
        }
      });
    });
  }

  function openForm(formTitle, recipient) {
    if (!panel || !form || !title) return;

    panel.hidden = false;
    title.textContent = formTitle;
    form.reset();
    setFormLoading(false);

    if (recipient) {
      form.elements.recipient_id.value = recipient.id;
      form.elements.full_name.value = recipient.full_name;
      form.elements.phone.value = recipient.phone;
      form.elements.email.value = recipient.email || "";
      form.elements.address_line_1.value = recipient.address_line_1;
      form.elements.address_line_2.value = recipient.address_line_2 || "";
      form.elements.city.value = recipient.city;
      form.elements.state.value = recipient.state;
      form.elements.delivery_notes.value = recipient.delivery_notes || "";
      form.elements.is_default.checked = recipient.is_default;
      return;
    }

    form.elements.recipient_id.value = "";
  }

  function closeForm() {
    if (!panel || !form) return;
    panel.hidden = true;
    form.reset();
    setFormLoading(false);
  }

  async function reloadRecipients() {
    await fetchRecipients();
    render();
  }

  function handleApiError(error) {
    if (error && /token|unauthorized|expired/i.test(error.message)) {
      window.FendorMockData.logout();
      window.FendorMockData.redirectToLogin();
      return;
    }

    setFeedback(error.message || "Something went wrong. Please try again.", "error");
  }

  if (addButton) {
    addButton.addEventListener("click", function () {
      setFeedback("");
      openForm("Add recipient");
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", function () {
      closeForm();
      setFeedback("");
    });
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      setFeedback("");
      var formData = new FormData(form);
      var id = formData.get("recipient_id");

      var payload = {
        full_name: formData.get("full_name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        address_line_1: formData.get("address_line_1"),
        address_line_2: formData.get("address_line_2"),
        city: formData.get("city"),
        state: formData.get("state"),
        delivery_notes: formData.get("delivery_notes"),
        is_default: formData.get("is_default") === "on",
      };

      if (!String(payload.full_name || "").trim()) {
        setFeedback("Full name is required.", "error");
        return;
      }

      if (!String(payload.phone || "").trim()) {
        setFeedback("Phone number is required.", "error");
        return;
      }

      if (!String(payload.address_line_1 || "").trim()) {
        setFeedback("Address line 1 is required.", "error");
        return;
      }

      if (!String(payload.city || "").trim() || !String(payload.state || "").trim()) {
        setFeedback("City and state are required.", "error");
        return;
      }

      try {
        setFormLoading(true);
        await saveRecipient(id, payload);
        await reloadRecipients();
        closeForm();
        setFeedback(id ? "Recipient updated successfully." : "Recipient saved successfully.", "success");
      } catch (error) {
        handleApiError(error);
        setFormLoading(false);
      }
    });
  }

  try {
    setFeedback("Loading your saved recipients...", "loading");
    await reloadRecipients();
    setFeedback("");
  } catch (error) {
    handleApiError(error);
  }
});
