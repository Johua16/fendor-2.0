document.addEventListener("DOMContentLoaded", function () {
  var header = document.querySelector("[data-site-header]");
  var toggle = document.querySelector("[data-nav-toggle]");
  var navLinks = document.querySelectorAll("[data-nav-link]");
  var heroWord = document.querySelector("[data-hero-words]");
  var revealNodes = document.querySelectorAll("[data-reveal]");
  var heroStage = document.querySelector(".hero-stage");
  var filterChips = document.querySelectorAll(".filter-chip");

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      var isOpen = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  var currentPage = window.location.pathname.split("/").pop() || "index.html";

  navLinks.forEach(function (link) {
    var target = link.getAttribute("href");
    if (target === currentPage || (currentPage === "" && target === "index.html")) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }

    link.addEventListener("click", function () {
      if (header && toggle && header.classList.contains("is-open")) {
        header.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  if (heroWord) {
    var words = heroWord
      .getAttribute("data-hero-words")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(function (item) {
        return item.length > 0 && item.length <= 25;
      });

    var index = 0;

    if (words.length > 1) {
      setInterval(function () {
        heroWord.classList.add("is-changing");
        index = (index + 1) % words.length;

        setTimeout(function () {
          heroWord.textContent = words[index];
          heroWord.classList.remove("is-changing");
        }, 180);
      }, 5000);
    }
  }

  if (revealNodes.length) {
    revealNodes.forEach(function (node, idx) {
      node.style.setProperty("--reveal-delay", String((idx % 4) * 70) + "ms");
    });

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.14 }
      );

      revealNodes.forEach(function (node) {
        observer.observe(node);
      });
    } else {
      revealNodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
    }
  }

  if (heroStage) {
    heroStage.addEventListener("mousemove", function (event) {
      var rect = heroStage.getBoundingClientRect();
      var offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      var offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
      var device = heroStage.querySelector(".phone-mockup");

      if (device && window.innerWidth > 1080) {
        device.style.transform =
          "rotate(9deg) translate(" + offsetX * 0.7 + "px, " + offsetY * 0.7 + "px)";
      }
    });

    heroStage.addEventListener("mouseleave", function () {
      var device = heroStage.querySelector(".phone-mockup");
      if (device) {
        device.style.transform = window.innerWidth > 820 ? "rotate(9deg)" : "rotate(4deg)";
      }
    });
  }

  filterChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      filterChips.forEach(function (item) {
        item.classList.remove("is-active");
      });
      chip.classList.add("is-active");
    });
  });
});
