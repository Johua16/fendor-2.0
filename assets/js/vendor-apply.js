document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("[data-vendor-application-form]");
  var feedback = document.querySelector("[data-vendor-application-feedback]");

  if (!form) {
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

  function setButtonLoading(button, isLoading) {
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? "Submitting..." : "Submit application";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var submitButton = form.querySelector('button[type="submit"]');
    var formData = new FormData(form);
    var payload = {
      business_name: String(formData.get("business_name") || "").trim(),
      contact_name: String(formData.get("contact_name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      business_address: String(formData.get("business_address") || "").trim(),
      business_description: String(formData.get("business_description") || "").trim(),
      product_categories: String(formData.get("product_categories") || "").trim(),
      application_note: String(formData.get("application_note") || "").trim(),
    };

    setFeedback("");

    if (!payload.business_name) {
      setFeedback("Business name is required.", "error");
      return;
    }

    if (!payload.contact_name) {
      setFeedback("Contact name is required.", "error");
      return;
    }

    if (!payload.email || !isValidEmail(payload.email)) {
      setFeedback("Please enter a valid email address.", "error");
      return;
    }

    if (!payload.phone) {
      setFeedback("Phone number is required.", "error");
      return;
    }

    if (payload.phone.length < 7) {
      setFeedback("Please enter a valid phone number.", "error");
      return;
    }

    if (!payload.business_address) {
      setFeedback("Business address is required.", "error");
      return;
    }

    if (!payload.business_description) {
      setFeedback("Business description is required.", "error");
      return;
    }

    if (payload.business_description.length > 800) {
      setFeedback("Business description should stay within 800 characters.", "error");
      return;
    }

    if (payload.product_categories.length > 300) {
      setFeedback("Product categories should stay within 300 characters.", "error");
      return;
    }

    if (payload.application_note.length > 500) {
      setFeedback("Application note should stay within 500 characters.", "error");
      return;
    }

    try {
      setButtonLoading(submitButton, true);
      setFeedback("Submitting your application for review...", "loading");

      var response = await fetch("/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      var result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(result.message || "Unable to submit your application.");
      }

      setFeedback(
        result.message || "Application submitted successfully. We will review it shortly.",
        "success"
      );
      form.reset();
    } catch (error) {
      setFeedback(error.message || "Unable to submit your application right now.", "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
});
