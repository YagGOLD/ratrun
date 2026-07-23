/* ============================================================
   RatRun — Aba Despesas fixas
   Lista nome + valor, total automático, e um atalho para copiar as
   fixas do mês anterior (aluguel, internet e afins se repetem).
   ============================================================ */

window.UIFixed = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    var key = Finance.currentKey();
    $("fxMonth").textContent = Finance.label(key);
    renderList(key);
    if (!wired) { wire(); wired = true; }
  }

  function renderList(key) {
    var m = Finance.getMonth(key);
    var box = $("fxList");
    box.innerHTML = "";

    if (!m.fixas.length) {
      box.innerHTML = '<div class="empty-hint">Nenhuma despesa fixa neste mês ainda.</div>';
    } else {
      m.fixas.forEach(function (f) {
        var row = document.createElement("div");
        row.className = "row-item";
        row.innerHTML =
          '<div class="row-main"><strong>' + Util.esc(f.nome) + '</strong></div>' +
          '<span class="row-value">' + Finance.fmt(f.valor) + '</span>';
        var del = document.createElement("button");
        del.className = "row-del"; del.textContent = "×"; del.title = "Excluir";
        del.onclick = function () { Finance.removeFixa(key, f.id); renderList(key); };
        row.appendChild(del);
        box.appendChild(row);
      });
    }

    var t = Finance.totals(key);
    $("fxTotal").textContent = Finance.fmt(t.fixasTotal);
  }

  function add() {
    var key = Finance.currentKey();
    var nome = $("fxName").value.trim();
    var valor = Util.parseMoney($("fxValue").value);
    if (!nome) { Toast.show("Dê um nome à despesa.", "warn"); $("fxName").focus(); return; }
    if (valor <= 0) { Toast.show("Informe um valor.", "warn"); $("fxValue").focus(); return; }
    Finance.addFixa(key, nome, valor);
    $("fxName").value = ""; $("fxValue").value = "";
    $("fxName").focus();
    renderList(key);
  }

  function wire() {
    $("fxPrev").onclick = function () { Finance.setCurrent(Finance.prev(Finance.currentKey())); render(); };
    $("fxNext").onclick = function () { Finance.setCurrent(Finance.next(Finance.currentKey())); render(); };
    $("fxMonth").onclick = function () { Finance.setCurrent(Finance.keyOf(new Date())); render(); };

    $("fxAdd").onclick = add;
    $("fxValue").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
    $("fxName").addEventListener("keydown", function (e) { if (e.key === "Enter") $("fxValue").focus(); });

    $("fxCopyPrev").onclick = function () {
      var key = Finance.currentKey();
      var n = Finance.copyFixasFromPrev(key);
      if (n === 0) {
        var m = Finance.getMonth(key);
        Toast.show(m.fixas.length ? "Este mês já tem fixas: apague antes de copiar."
                                  : "O mês anterior não tem fixas para copiar.", "warn");
        return;
      }
      renderList(key);
      Toast.show(n + (n === 1 ? " despesa copiada" : " despesas copiadas") + " do mês anterior.", "ok");
    };
  }

  return { render: render };
})();
