// Picks the page language: ?lang=xx, then the one chosen before, then the browser's (English otherwise).
(function () {
  var supported = ["es", "en", "de"];
  var root = document.documentElement;

  function pick() {
    var fromUrl = new URLSearchParams(location.search).get("lang");
    if (supported.indexOf(fromUrl) >= 0) return fromUrl;
    try {
      var saved = localStorage.getItem("lang");
      if (supported.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var code = String(langs[i]).slice(0, 2).toLowerCase();
      if (supported.indexOf(code) >= 0) return code;
    }
    return "en";
  }

  function apply(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    var title = root.getAttribute("data-title-" + lang);
    if (title) document.title = title;
  }

  apply(pick());

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a[data-set]");
    if (!link) return;
    e.preventDefault();
    var lang = link.getAttribute("data-set");
    try { localStorage.setItem("lang", lang); } catch (err) {}
    apply(lang);
    history.replaceState(null, "", "?lang=" + lang + location.hash);
  });
})();
