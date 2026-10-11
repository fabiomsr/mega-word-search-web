// Arrow buttons for the screenshot carousel; each one scrolls the visible row by most of its width.
document.querySelectorAll(".carousel").forEach(function (carousel) {
  var prev = carousel.querySelector(".arrow.prev");
  var next = carousel.querySelector(".arrow.next");

  function visibleRow() {
    var rows = carousel.querySelectorAll(".shots");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].offsetParent) return rows[i];
    }
    return null;
  }

  function update() {
    var row = visibleRow();
    if (!row) return;
    prev.hidden = row.scrollLeft <= 2;
    next.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
  }

  function scrollBy(direction) {
    var row = visibleRow();
    if (row) row.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: "smooth" });
  }

  prev.addEventListener("click", function () { scrollBy(-1); });
  next.addEventListener("click", function () { scrollBy(1); });
  carousel.querySelectorAll(".shots").forEach(function (row) {
    row.addEventListener("scroll", update, { passive: true });
  });
  window.addEventListener("resize", update);
  // The language can change, showing another row.
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
  window.addEventListener("load", update);
  update();
});
