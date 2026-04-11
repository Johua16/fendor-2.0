document.addEventListener("DOMContentLoaded", function () {
  var chipGroup = document.querySelector("[data-shop-chip-group]");
  var featuredTarget = document.querySelector("[data-shop-featured]");
  var heroFeaturedTarget = document.querySelector("[data-shop-hero-featured]");
  var sectionsTarget = document.querySelector("[data-shop-sections]");
  var feedback = document.querySelector("[data-shop-feedback]");
  var emptyState = document.querySelector("[data-shop-empty]");
  var productCountNode = document.querySelector("[data-shop-product-count]");
  var categoryCountNode = document.querySelector("[data-shop-category-count]");

  if (!chipGroup || !featuredTarget || !sectionsTarget || !heroFeaturedTarget) {
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
      } else if (type === "loading") {
        feedback.classList.add("form-hint--loading");
      } else if (type === "success") {
        feedback.classList.add("form-hint--success");
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

  function slugify(value) {
    return String(value || "products")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildProductCard(product) {
    var availability = product.availability_note
      ? '<div class="order-card__meta"><span class="muted-label">Availability: ' +
        escapeHtml(product.availability_note) +
        "</span></div>"
      : "";

    return (
      '<article class="product-card" data-reveal>' +
      '<div class="product-card__image">' +
      '<img class="card-photo" src="' +
      escapeHtml(product.image_url || "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=80") +
      '" alt="' +
      escapeHtml(product.name) +
      '" />' +
      "</div>" +
      '<h3 class="product-card__title">' +
      escapeHtml(product.name) +
      "</h3>" +
      '<p class="product-meta">' +
      escapeHtml(product.description) +
      "</p>" +
      availability +
      '<div class="price-row">' +
      '<span class="price">From ' +
      formatCurrency(product.unit_price) +
      "</span>" +
      '<a class="btn btn-secondary" href="product.html?id=' +
      product.product_id +
      '">View Product</a>' +
      "</div>" +
      "</article>"
    );
  }

  function buildHeroFeatured(product) {
    return (
      '<article class="shop-live-card__inner">' +
      '<div class="shop-live-card__meta">' +
      '<span class="featured-tag">Live now</span>' +
      '<span class="featured-tag">Active product</span>' +
      "</div>" +
      '<div class="shop-live-card__media">' +
      '<img class="card-photo" src="' +
      escapeHtml(product.image_url || "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=80") +
      '" alt="' +
      escapeHtml(product.name) +
      '" />' +
      "</div>" +
      '<div class="shop-live-card__content">' +
      '<p class="muted-label">Featured live product</p>' +
      '<h2 class="title-md">' +
      escapeHtml(product.name) +
      "</h2>" +
      '<p class="card-copy">' +
      escapeHtml(product.description) +
      "</p>" +
      (product.availability_note
        ? '<p class="shop-live-card__availability">Availability: ' +
          escapeHtml(product.availability_note) +
          "</p>"
        : "") +
      '<div class="featured-card__footer">' +
      '<span class="featured-card__price">From ' +
      formatCurrency(product.unit_price) +
      "</span>" +
      '<a class="btn btn-primary" href="product.html?id=' +
      product.product_id +
      '">View product</a>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  async function loadProducts() {
    try {
      setFeedback("Loading live products...", "loading");

      var response = await fetch("/api/products");
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.message || "Unable to load products.");
      }

      var products = Array.isArray(payload.products) ? payload.products : [];

      if (!products.length) {
        emptyState.hidden = false;
        chipGroup.innerHTML = "";
        featuredTarget.innerHTML = "";
        heroFeaturedTarget.innerHTML =
          '<p class="muted-label">No live featured product is available yet.</p>';
        sectionsTarget.innerHTML = "";
        setFeedback("");
        return;
      }

      emptyState.hidden = true;

      var featured = products.slice(0, 3);
      var grouped = {};

      products.forEach(function (product) {
        var category = product.category || "Featured Products";
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(product);
      });

      var categories = Object.keys(grouped);

      if (productCountNode) {
        productCountNode.textContent = String(products.length);
      }

      if (categoryCountNode) {
        categoryCountNode.textContent = String(categories.length);
      }

      chipGroup.innerHTML = categories
        .map(function (category, index) {
          var anchor = slugify(category);
          return (
            '<a class="filter-chip' +
            (index === 0 ? " is-active" : "") +
            '" href="#' +
            anchor +
            '">' +
            escapeHtml(category) +
            "</a>"
          );
        })
        .join("");

      heroFeaturedTarget.innerHTML = buildHeroFeatured(featured[0]);

      featuredTarget.innerHTML =
        '<article class="featured-card featured-card--hero" data-reveal>' +
        '<div>' +
        '<div class="featured-tag-row">' +
        '<span class="featured-tag">Live Product</span>' +
        '<span class="featured-tag">Vendor Ready</span>' +
        "</div>" +
        '<h3 class="featured-card__title title-md">' +
        escapeHtml(featured[0].name) +
        "</h3>" +
        '<p class="featured-card__copy">' +
        escapeHtml(featured[0].description) +
        "</p>" +
        '<div class="featured-card__footer">' +
        '<span class="featured-card__price">From ' +
        formatCurrency(featured[0].unit_price) +
        "</span>" +
        '<a class="btn btn-secondary" href="product.html?id=' +
        featured[0].product_id +
        '">View Product</a>' +
        "</div>" +
        "</div>" +
        '<div class="featured-card__media">' +
        '<img class="card-photo" src="' +
        escapeHtml(featured[0].image_url || "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=80") +
        '" alt="' +
        escapeHtml(featured[0].name) +
        '" />' +
        "</div>" +
        "</article>" +
        '<div class="featured-spotlight__stack">' +
        featured
          .slice(1)
          .map(function (product) {
            return (
              '<article class="featured-card" data-reveal>' +
              '<div class="featured-tag-row"><span class="featured-tag">Active Now</span></div>' +
              '<h3 class="featured-card__title title-md">' +
              escapeHtml(product.name) +
              "</h3>" +
              '<p class="featured-card__copy">' +
              escapeHtml(product.description) +
              "</p>" +
              '<div class="featured-card__footer">' +
              '<span class="featured-card__price">From ' +
              formatCurrency(product.unit_price) +
              "</span>" +
              '<a class="btn btn-secondary" href="product.html?id=' +
              product.product_id +
              '">View Product</a>' +
              "</div>" +
              "</article>"
            );
          })
          .join("") +
        "</div>";

      sectionsTarget.innerHTML = categories
        .map(function (category) {
          var anchor = slugify(category);
          return (
            '<section class="section-anchor" id="' +
            anchor +
            '">' +
            '<div class="catalog-header">' +
            "<div>" +
            '<span class="eyebrow">Active collection</span>' +
            '<h2 class="title-lg">' +
            escapeHtml(category) +
            "</h2>" +
            "</div>" +
            '<p class="catalog-meta">Real products ready for customer ordering.</p>' +
            "</div>" +
            '<div class="products-grid">' +
            grouped[category].map(buildProductCard).join("") +
            "</div>" +
            "</section>"
          );
        })
        .join("");

      setFeedback("");
    } catch (error) {
      emptyState.hidden = false;
      heroFeaturedTarget.innerHTML =
        '<p class="muted-label">We could not load the featured product right now.</p>';
      if (productCountNode) {
        productCountNode.textContent = "0";
      }
      if (categoryCountNode) {
        categoryCountNode.textContent = "0";
      }
      setFeedback(error.message || "Unable to load active products right now.", "error");
    }
  }

  chipGroup.addEventListener("click", function (event) {
    var chip = event.target.closest(".filter-chip");

    if (!chip) {
      return;
    }

    chipGroup.querySelectorAll(".filter-chip").forEach(function (item) {
      item.classList.remove("is-active");
    });
    chip.classList.add("is-active");
  });

  loadProducts();
});
