// Shared sidebar behavior for every praktikum page.
(function () {
  var toggle = document.querySelector("[data-menu-toggle]");
  var sidebar = document.querySelector(".sidebar");

  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!sidebar.classList.contains("open")) return;
      if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
      sidebar.classList.remove("open");
    });
  }

  // Highlight the nav link matching the current page.
  var current = document.body.getAttribute("data-page");
  if (current) {
    document.querySelectorAll(".nav-link[data-page]").forEach(function (link) {
      if (link.getAttribute("data-page") === current) {
        link.classList.add("active");
      }
    });
  }
})();
