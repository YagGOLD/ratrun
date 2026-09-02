/* ============================================================
   RatRun — Aba Início
   Seletor de mês, avatar com frase contextual, campo de salário
   líquido, o resultado do mês (Lucro ou Prejuízo, em destaque) e o
   detalhamento (salário / fixas / gastos). Também abriga o backup e
   os atalhos de editar avatar e apoiar o projeto.
   ============================================================ */

window.UIHome = (function () {

  function $(id) { return document.getElementById(id); }

  var wired = false;

  function render() {
    var key = Finance.currentKey();
    var avatar = Store.loadAvatar() || Store.defaultAvatar();

    $("homeMonth").textContent = Finance.label(key);

    // Avatar vivo (pisca, mexe sobrancelha) com frase contextual
    Animator.attach($("homeAvatarCanvas"), function () { return avatar; });
    $("homeGreeting").innerHTML = greeting(key);
    $("homeSub").textContent = subtitle(key);

    // Salário do mês no campo
    var m = Finance.getMonth(key);
    $("salaryInput").value = Util.moneyInputValue(m.salario);

    renderResult(key);
    $("importOverlay").classList.add("hidden");

    if (!wired) { wire(); wired = true; }
  }

  function renderResult(key) {
    var t = Finance.totals(key);
    $("bdSalaryVal").textContent = Finance.fmt(t.salario);
    $("bdFixedVal").textContent = Finance.fmt(t.fixasTotal);
    $("bdDailyVal").textContent = Finance.fmt(t.gastosTotal);

    var card = $("resultCard");
    card.classList.remove("lucro", "prejuizo");

    if (t.salario === 0 && t.despesas === 0) {
      card.classList.add("lucro");
      $("resultLabel").textContent = "Resultado do mês";
      $("resultValue").textContent = Finance.fmt(0);
      $("resultNote").textContent = "Informe seu salário e comece a lançar.";
      return;
    }

    if (t.isLucro) {
      card.classList.add("lucro");
      $("resultLabel").textContent = "Lucro do mês";
      $("resultValue").textContent = Finance.fmt(t.saldo);
      $("resultNote").textContent = "Você fechou o mês no azul. Continue assim!";
    } else {
      card.classList.add("prejuizo");
      $("resultLabel").textContent = "Prejuízo do mês";
      $("resultValue").textContent = Finance.fmt(t.saldo);
      $("resultNote").textContent = "Os gastos passaram do salário. Dá para ajustar.";
    }
  }

  // Frase do avatar: contextual, curta e positiva.
  function greeting(key) {
    var t = Finance.totals(key);
    if (t.salario === 0) return "Vamos começar? Informe seu <b>salário líquido</b>.";
    if (t.despesas === 0) return "Salário registrado. Agora lance suas <b>despesas</b>.";
    if (t.isLucro && t.saldo > 0) return "Sobrou <b>" + Finance.fmt(t.saldo) + "</b> este mês!";
    if (!t.isLucro) return "Atenção: o mês está <b>no vermelho</b>.";
    return "Mês zerado, salário igual às despesas.";
  }

  function subtitle(key) {
    var t = Finance.totals(key);
    if (t.salario === 0) return "Tudo fica só neste aparelho.";
    var pct = t.salario ? Math.round(t.despesas / t.salario * 100) : 0;
    return "Você já comprometeu " + pct + "% do salário.";
  }

  // ===== Backup =====
  var pendingImport = null;

  function doExport() {
    Backup.exportData().then(function (via) {
      if (via === "cancel") return;
      Toast.show(via === "share" ? "Backup pronto, escolha onde salvar."
                                 : "Backup salvo nos downloads.", "ok");
    });
  }

  function onFileChosen(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var r = Backup.parse(String(reader.result));
      if (!r.ok) { Toast.show(r.erro, "warn"); return; }
      pendingImport = r.payload;
      var s = r.resumo;
      var quando = new Date(s.data);
      $("importSummary").innerHTML =
        '<div class="imp-line"><span>Feito em</span><b>' +
          (isNaN(quando) ? "—" : quando.toLocaleDateString("pt-BR")) + '</b></div>' +
        '<div class="imp-line"><span>Meses</span><b>' + s.meses + '</b></div>' +
        '<div class="imp-line"><span>Objetivos</span><b>' + s.objetivos + '</b></div>' +
        '<div class="imp-line"><span>Reserva</span><b>' + Finance.fmt(s.reserva) + '</b></div>';
      $("importOverlay").classList.remove("hidden");
    };
    reader.onerror = function () { Toast.show("Não consegui ler o arquivo.", "warn"); };
    reader.readAsText(file);
  }

  function doImport() {
    if (!pendingImport) return;
    Backup.restore(pendingImport);
    pendingImport = null;
    location.reload();
  }

  function wire() {
    $("homePrev").onclick = function () { Finance.setCurrent(Finance.prev(Finance.currentKey())); render(); };
    $("homeNext").onclick = function () { Finance.setCurrent(Finance.next(Finance.currentKey())); render(); };
    $("homeMonth").onclick = function () {
      Finance.setCurrent(Finance.keyOf(new Date())); render();
      Toast.show("Voltou para o mês atual.", "ok");
    };

    // Salário: salva ao sair do campo ou no Enter
    function saveSalary() {
      var key = Finance.currentKey();
      var v = Util.parseMoney($("salaryInput").value);
      Finance.setSalario(key, v);
      $("salaryInput").value = Util.moneyInputValue(v);
      renderResult(key);
      $("homeGreeting").innerHTML = greeting(key);
      $("homeSub").textContent = subtitle(key);
    }
    $("salaryInput").addEventListener("blur", saveSalary);
    $("salaryInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { saveSalary(); $("salaryInput").blur(); }
    });

    // Tiles levam para a aba correspondente
    $("bdFixed").onclick = function () { App.openTab("fixed"); };
    $("bdDaily").onclick = function () { App.openTab("daily"); };
    $("bdSalary").onclick = function () { $("salaryInput").focus(); };

    // Backup
    $("btnExport").onclick = doExport;
    $("btnImport").onclick = function () { $("importFile").click(); };
    $("importFile").onchange = onFileChosen;
    $("btnImportCancel").onclick = function () { $("importOverlay").classList.add("hidden"); pendingImport = null; };
    $("btnImportOk").onclick = doImport;
    $("importOverlay").onclick = function (e) {
      if (e.target === $("importOverlay")) { $("importOverlay").classList.add("hidden"); pendingImport = null; }
    };

    $("btnEditAvatar").onclick = function () { App.openCreator(Store.loadAvatar() || Store.defaultAvatar()); };
    $("btnDonate").onclick = function () { App.openDonate(function () { App.openTab("home"); }); };
  }

  return { render: render };
})();
