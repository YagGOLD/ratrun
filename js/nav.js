/* ============================================================
   RatRun — Barra de abas inferior
   Cinco abas (Início, Fixas, Gastos, Relatórios, Objetivos). O
   próprio App troca de tela; aqui só destacamos a aba ativa e
   encaminhamos o clique.
   ============================================================ */

window.Nav = (function () {

  var bar = null;

  function init() {
    bar = document.getElementById("tabBar");
    Array.prototype.forEach.call(bar.querySelectorAll(".tab-btn"), function (btn) {
      btn.addEventListener("click", function () {
        App.openTab(btn.getAttribute("data-tab"));
      });
    });
  }

  // Mostra a barra e destaca a aba ativa
  function setActive(tab) {
    bar.classList.remove("hidden");
    Array.prototype.forEach.call(bar.querySelectorAll(".tab-btn"), function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
  }

  function hide() { bar.classList.add("hidden"); }

  return { init: init, setActive: setActive, hide: hide };
})();
