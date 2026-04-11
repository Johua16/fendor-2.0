document.addEventListener("DOMContentLoaded", function () {
  if (!window.FendorVendorAuth) {
    return;
  }

  var productsPage = document.querySelector("[data-vendor-products-page]");
  var formPage = document.querySelector("[data-vendor-product-form-page]");

  if (!productsPage && !formPage) {
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

  function getProductStatusClass(isActive) {
    return isActive ? "status-pill--delivered" : "status-pill--pending";
  }

  function setSubmitLoading(button, isLoading) {
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? "Saving..." : "Save product";
  }

  function isValidImageUrl(value) {
    if (!value) {
      return true;
    }

    return /^(https?:\/\/|data:image\/)/i.test(String(value).trim());
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = function () {
        reject(new Error("We could not read that image file."));
      };

      reader.readAsDataURL(file);
    });
  }

  function renderProductImagePreview(previewTarget, imageValue) {
    if (!previewTarget) {
      return;
    }

    if (!imageValue) {
      previewTarget.innerHTML =
        '<span class="vendor-image-upload__placeholder">No product image selected yet</span>';
      return;
    }

    previewTarget.innerHTML =
      '<img class="vendor-image-upload__image" src="' +
      escapeHtml(imageValue) +
      '" alt="Selected product preview" />';
  }

  async function initProductsPage() {
    var vendor = window.FendorVendorAuth.requireVendorAuth();
    if (!vendor) {
      return;
    }

    vendor = await window.FendorVendorAuth.fetchCurrentVendor();
    if (!vendor) {
      window.FendorVendorAuth.redirectToVendorLogin();
      return;
    }

    var list = document.querySelector("[data-vendor-products-list]");
    var emptyState = document.querySelector("[data-vendor-products-empty]");
    var feedback = document.querySelector("[data-vendor-products-feedback]");
    var totalNode = document.querySelector("[data-vendor-product-total]");
    var activeNode = document.querySelector("[data-vendor-product-active]");
    var inactiveNode = document.querySelector("[data-vendor-product-inactive]");

    if (!list) {
      return;
    }

    try {
      setFeedback(feedback, "Loading your products...", "loading");

      var payload = await window.FendorVendorAuth.vendorApiRequest("/vendor/products", {
        headers: window.FendorVendorAuth.getVendorAuthHeaders(),
      });
      var products = Array.isArray(payload.products) ? payload.products : [];

      if (!products.length) {
        if (emptyState) {
          emptyState.hidden = false;
        }
        if (totalNode) {
          totalNode.textContent = "0";
        }
        if (activeNode) {
          activeNode.textContent = "0";
        }
        if (inactiveNode) {
          inactiveNode.textContent = "0";
        }
        list.innerHTML = "";
        setFeedback(feedback, "");
        return;
      }

      if (emptyState) {
        emptyState.hidden = true;
      }

      if (totalNode) {
        totalNode.textContent = String(products.length);
      }
      if (activeNode) {
        activeNode.textContent = String(
          products.filter(function (product) {
            return product.is_active;
          }).length
        );
      }
      if (inactiveNode) {
        inactiveNode.textContent = String(
          products.filter(function (product) {
            return !product.is_active;
          }).length
        );
      }

      list.innerHTML = products
        .map(function (product) {
          var imageMarkup = product.image_url
            ? '<div class="vendor-product-card__media"><img class="card-photo" src="' +
              escapeHtml(product.image_url) +
              '" alt="' +
              escapeHtml(product.name) +
              '" /></div>'
            : "";

          return (
            '<article class="table-card vendor-product-card">' +
            imageMarkup +
            '<div class="page-toolbar">' +
            "<div>" +
            '<p class="muted-label">' +
            escapeHtml(product.category) +
            "</p>" +
            '<h2 class="title-md">' +
            escapeHtml(product.name) +
            "</h2>" +
            "</div>" +
            '<span class="status-pill ' +
            getProductStatusClass(product.is_active) +
            '">' +
            (product.is_active ? "Active" : "Inactive") +
            "</span>" +
            "</div>" +
            '<p class="card-copy">' +
            escapeHtml(product.description) +
            "</p>" +
            '<div class="order-card__meta">' +
            '<span class="muted-label">Price: ' +
            formatCurrency(product.unit_price) +
            "</span>" +
            (product.availability_note
              ? '<span class="muted-label">Availability: ' +
                escapeHtml(product.availability_note) +
                "</span>"
              : "") +
            "</div>" +
            '<div class="order-card__footer">' +
            '<span class="price">' +
            formatCurrency(product.unit_price) +
            "</span>" +
            '<a class="btn btn-secondary" href="vendor-product-form.html?id=' +
            product.id +
            '">Edit product</a>' +
            "</div>" +
            "</article>"
          );
        })
        .join("");

      setFeedback(feedback, "");
    } catch (error) {
      if (/token|unauthorized|expired/i.test(error.message)) {
        window.FendorVendorAuth.logout();
        window.FendorVendorAuth.redirectToVendorLogin();
        return;
      }

      setFeedback(
        feedback,
        error.message || "Unable to load your products right now.",
        "error"
      );
    }
  }

  async function initProductFormPage() {
    var vendor = window.FendorVendorAuth.requireVendorAuth();
    if (!vendor) {
      return;
    }

    vendor = await window.FendorVendorAuth.fetchCurrentVendor();
    if (!vendor) {
      window.FendorVendorAuth.redirectToVendorLogin();
      return;
    }

    var form = document.querySelector("[data-vendor-product-form]");
    var title = document.querySelector("[data-vendor-product-form-title]");
    var feedback = document.querySelector("[data-vendor-product-form-feedback]");
    var submitButton = document.querySelector("[data-vendor-product-submit]");
    var imageDataField = document.querySelector("#vendor-product-image-data");
    var imageFileInput = document.querySelector("[data-vendor-product-image-file]");
    var imagePreview = document.querySelector("[data-vendor-product-image-preview]");
    var clearImageButton = document.querySelector("[data-vendor-product-image-clear]");

    if (!form) {
      return;
    }

    function syncImageControls() {
      var hasImage = !!String((imageDataField && imageDataField.value) || "").trim();
      renderProductImagePreview(imagePreview, hasImage ? imageDataField.value : "");
      if (clearImageButton) {
        clearImageButton.hidden = !hasImage;
      }
    }

    async function handleSelectedImage(file) {
      if (!file) {
        return;
      }

      if (!/^image\//i.test(file.type)) {
        setFeedback(feedback, "Please choose an image file.", "error");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setFeedback(feedback, "Please choose an image smaller than 2MB for now.", "error");
        return;
      }

      try {
        setFeedback(feedback, "Preparing image preview...", "loading");
        var dataUrl = await readFileAsDataUrl(file);
        imageDataField.value = dataUrl;
        syncImageControls();
        setFeedback(feedback, "Image added successfully. Save the product to keep it.", "success");
      } catch (error) {
        setFeedback(feedback, error.message || "Unable to prepare this image.", "error");
      } finally {
        if (imageFileInput) {
          imageFileInput.value = "";
        }
      }
    }

    var params = new URLSearchParams(window.location.search);
    var productId = params.get("id");
    var isEditMode = Boolean(productId);

    if (isEditMode && title) {
      title.textContent = "Edit product details.";
    }

    if (isEditMode) {
      try {
        setFeedback(feedback, "Loading product details...", "loading");

        var productPayload = await window.FendorVendorAuth.vendorApiRequest(
          "/vendor/products/" + productId,
          {
            headers: window.FendorVendorAuth.getVendorAuthHeaders(),
          }
        );
        var product = productPayload.product;

        form.elements.name.value = product.name || "";
        if (imageDataField) {
          imageDataField.value = product.image_url || "";
        }
        form.elements.category.value = product.category || "";
        form.elements.description.value = product.description || "";
        form.elements.unit_price.value = product.unit_price || "";
        form.elements.availability_note.value = product.availability_note || "";
        form.elements.is_active.checked = !!product.is_active;
        syncImageControls();

        setFeedback(feedback, "");
      } catch (error) {
        if (/token|unauthorized|expired/i.test(error.message)) {
          window.FendorVendorAuth.logout();
          window.FendorVendorAuth.redirectToVendorLogin();
          return;
        }

        setFeedback(
          feedback,
          error.message || "Unable to load this product right now.",
          "error"
        );
      }
    }

    syncImageControls();

    if (imageFileInput) {
      imageFileInput.addEventListener("change", function (event) {
        var selectedFile = event.target.files && event.target.files[0];
        handleSelectedImage(selectedFile);
      });
    }

    if (clearImageButton) {
      clearImageButton.addEventListener("click", function () {
        if (imageDataField) {
          imageDataField.value = "";
        }
        if (imageFileInput) {
          imageFileInput.value = "";
        }
        syncImageControls();
        setFeedback(feedback, "Image removed. Save the product to keep this change.", "success");
      });
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      setFeedback(feedback, "");

      var formData = new FormData(form);
      var payload = {
        name: formData.get("name"),
        image_url: formData.get("image_url"),
        category: formData.get("category"),
        description: formData.get("description"),
        unit_price: formData.get("unit_price"),
        availability_note: formData.get("availability_note"),
        is_active: formData.get("is_active") === "on",
      };

      if (!String(payload.name || "").trim()) {
        setFeedback(feedback, "Product name is required.", "error");
        return;
      }

      if (!String(payload.category || "").trim()) {
        setFeedback(feedback, "Category is required.", "error");
        return;
      }

      if (!String(payload.description || "").trim()) {
        setFeedback(feedback, "Description is required.", "error");
        return;
      }

      if (!isValidImageUrl(payload.image_url)) {
        setFeedback(feedback, "Please add a valid product image before saving.", "error");
        return;
      }

      if (String(payload.availability_note || "").trim().length > 240) {
        setFeedback(feedback, "Availability note should stay within 240 characters.", "error");
        return;
      }

      if (Number(payload.unit_price) < 0 || payload.unit_price === "") {
        setFeedback(feedback, "Unit price must be a valid amount.", "error");
        return;
      }

      try {
        setSubmitLoading(submitButton, true);
        setFeedback(
          feedback,
          isEditMode ? "Updating product..." : "Saving product...",
          "loading"
        );

        await window.FendorVendorAuth.vendorApiRequest(
          isEditMode ? "/vendor/products/" + productId : "/vendor/products",
          {
            method: isEditMode ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:
                window.FendorVendorAuth.getVendorAuthHeaders().Authorization,
            },
            body: JSON.stringify(payload),
          }
        );

        setFeedback(
          feedback,
          isEditMode
            ? "Product updated successfully. Redirecting..."
            : "Product created successfully. Redirecting...",
          "success"
        );

        window.location.href = "vendor-products.html";
      } catch (error) {
        if (/token|unauthorized|expired/i.test(error.message)) {
          window.FendorVendorAuth.logout();
          window.FendorVendorAuth.redirectToVendorLogin();
          return;
        }

        setFeedback(
          feedback,
          error.message || "Unable to save this product right now.",
          "error"
        );
        setSubmitLoading(submitButton, false);
      }
    });
  }

  if (productsPage) {
    initProductsPage();
  }

  if (formPage) {
    initProductFormPage();
  }
});
