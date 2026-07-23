/* ============================================================
   RatRun — Boot e roteamento
   1º acesso (sem avatar salvo) → Criador de Avatar.
   Depois → abas (Início por padrão). O avatar dá personalidade;
   o resto do app é sério, minimalista e didático.
   ============================================================ */

window.App = (function () {

  var screens = {
    creator:  document.getElementById("screenCreator"),
    donate:   document.getElementById("screenDonate"),
    home:     document.getElementById("screenHome"),
    fixed:    document.getElementById("screenFixed"),
    daily:    document.getElementById("screenDaily"),
    reports:  document.getElementById("screenReports"),
    goals:    document.getElementById("screenGoals")
  };

  // Abas → módulo de UI que renderiza a tela
  var TAB_RENDER = {
    home:    function () { UIHome.render(); },
    fixed:   function () { UIFixed.render(); },
    daily:   function () { UIDaily.render(); },
    reports: function () { UIReports.render(); },
    goals:   function () { UIGoals.render(); }
  };

  var TABS = ["home", "fixed", "daily", "reports", "goals"];

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("hidden", k !== name);
    });
    // Barra de abas só aparece nas telas de aba
    if (TABS.indexOf(name) !== -1) Nav.setActive(name);
    else Nav.hide();
  }

  function openTab(tab) {
    if (TABS.indexOf(tab) === -1) tab = "home";
    show(tab);
    Animator.detach();
    TAB_RENDER[tab]();
  }

  function openCreator(state) {
    show("creator");
    var hasAvatar = !!Store.loadAvatar();
    document.getElementById("btnSkip").textContent =
      hasAvatar ? "Cancelar" : "Pular por enquanto";

    UICreator.init(state, {
      onSave: function (finalState) {
        Store.saveAvatar(finalState);
        finishCreator();
      },
      onSkip: function () {
        if (!hasAvatar) Store.saveAvatar(Store.defaultAvatar(), { skipped: true });
        finishCreator();
      }
    });
  }

  // Ao sair do criador: no 1º acesso mostra o convite de apoio (uma
  // vez), depois a Home. Editando o avatar já com apoio visto, vai
  // direto para a Home.
  function finishCreator() {
    if (!Donation.wasSeen()) openDonate(function () { openTab("home"); });
    else openTab("home");
  }

  function openDonate(next) {
    show("donate");
    Animator.detach();
    Donation.open(next);
  }

  // ===== Boot =====
  // O avatar é composto por PNGs e o Renderer desenha de forma
  // síncrona, então o app só entra depois que os assets estão prontos.
  Assets.preload(function () {
    Nav.init();
    var saved = Store.loadAvatar();

    // 1º acesso: monta o avatar primeiro (dá personalidade), depois o
    // convite de apoio (uma vez) e então a Home. Já com avatar: Home,
    // passando pelo apoio só se ainda não foi visto.
    if (!saved) {
      openCreator(Store.defaultAvatar());
    } else if (!Donation.wasSeen()) {
      openDonate(function () { openTab("home"); });
    } else {
      openTab("home");
    }
  });

  // Service worker: só em HTTPS (GitHub Pages). Em file:// o app já é
  // 100% offline por não depender de rede.
  if (location.protocol === "https:" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }

  return {
    openTab: openTab,
    openCreator: openCreator,
    openDonate: openDonate
  };
})();
