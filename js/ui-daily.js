/* ============================================================
   RatRun — Aba Gastos cotidianos
   Registro rápido: descrição + valor obrigatórios; data já vem como
   hoje; categoria é texto livre e opcional. Lançamentos agrupados
   por dia, mais recentes primeiro. Total do mês no rodapé.
   ============================================================ */

window.UIDaily = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    var key = Finance.currentKey();
    $("dyMonth").textContent = Finance.label(key);
    if (!$("dyDate").value) $("dyDate").value = Finance.todayISO();
    renderList(key);
    if (!wired) { wire(); wired = true; }
  }

  function renderList(key) {
    var m = Finance.getMonth(key);
    var box = $("dyList");
    box.innerHTML = "";

    if (!m.gastos.length) {
      box.innerHTML = '<div class="empty-hint">Nenhum gasto lançado neste mês.<br>Anote o primeiro assim que gastar.</div>';
    } else {
      // Mais recentes primeiro, agrupados por dia
      var ordered = m.gastos.slice().sort(function (a, b) {
        return b.data < a.data ? -1 : (b.data > a.data ? 1 : 0);
      });
      var lastDay = null;
      ordered.forEach(function (g) {
        if (g.data !== lastDay) {
          lastDay = g.data;
          var h = document.createElement("div");
          h.className = "day-group";
          h.textContent = dayLabel(g.data);
          box.appendChild(h);
        }
        box.appendChild(rowFor(key, g));
      });
    }

    var t = Finance.totals(key);
    $("dyTotal").textContent = Finance.fmt(t.gastosTotal);
  }

  function rowFor(key, g) {
    var row = document.createElement("div");
    row.className = "row-item";
    var cat = g.categoria ? '<span class="tag">' + Util.esc(g.categoria) + '</span>' : "";
    row.innerHTML =
      '<div class="row-main"><strong>' + Util.esc(g.desc) + '</strong>' +
        '<span>' + cat + Finance.fmtDay(g.data) + '</span></div>' +
      '<span class="row-value neg">' + Finance.fmt(g.valor) + '</span>';
    var del = document.createElement("button");
    del.className = "row-del"; del.textContent = "×"; del.title = "Excluir";
    del.onclick = function () { Finance.removeGasto(key, g.id); renderList(key); };
    row.appendChild(del);
    return row;
  }

  // "Hoje", "Ontem" ou "23/07" a partir do ISO
  function dayLabel(iso) {
    var hoje = Finance.todayISO();
    if (iso === hoje) return "Hoje";
    var p = iso.split("-");
    var d = new Date(p[0], p[1] - 1, p[2]);
    var ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    var oiso = ontem.getFullYear() + "-" + String(ontem.getMonth() + 1).padStart(2, "0") +
               "-" + String(ontem.getDate()).padStart(2, "0");
    if (iso === oiso) return "Ontem";
    var dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return dias[d.getDay()] + " " + p[2] + "/" + p[1];
  }

  function add() {
    var key = Finance.currentKey();
    var desc = $("dyDesc").value.trim();
    var valor = Util.parseMoney($("dyValue").value);
    var data = $("dyDate").value || Finance.todayISO();
    var cat = $("dyCat").value.trim();
    if (!desc) { Toast.show("Descreva o gasto.", "warn"); $("dyDesc").focus(); return; }
    if (valor <= 0) { Toast.show("Informe o valor.", "warn"); $("dyValue").focus(); return; }

    // O gasto entra no mês da DATA escolhida (não no mês em navegação),
    // para uma data de outro mês não cair no lugar errado.
    var destKey = data.slice(0, 7);
    Finance.addGasto(destKey, desc, valor, data, cat);

    $("dyDesc").value = ""; $("dyValue").value = ""; $("dyCat").value = "";
    $("dyDesc").focus();

    if (destKey !== key) {
      Toast.show("Lançado em " + Finance.label(destKey) + ".", "ok");
    }
    render();
  }

  function wire() {
    $("dyPrev").onclick = function () { Finance.setCurrent(Finance.prev(Finance.currentKey())); render(); };
    $("dyNext").onclick = function () { Finance.setCurrent(Finance.next(Finance.currentKey())); render(); };
    $("dyMonth").onclick = function () { Finance.setCurrent(Finance.keyOf(new Date())); render(); };

    $("dyAdd").onclick = add;
    $("dyDesc").addEventListener("keydown", function (e) { if (e.key === "Enter") $("dyValue").focus(); });
    $("dyValue").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
    $("dyCat").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
  }

  return { render: render };
})();
