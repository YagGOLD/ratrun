/* ============================================================
   RatRun — Aba Relatórios
   Indicadores objetivos do mês + dois gráficos simples, sem
   biblioteca externa (barras em HTML/CSS, mantém o app offline):
     - categorias que mais consomem (barras horizontais)
     - evolução dos últimos 6 meses (barras verticais de saldo)
   Mais média mensal e destaque do maior gasto.
   ============================================================ */

window.UIReports = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    var key = Finance.currentKey();
    $("rpMonth").textContent = Finance.label(key);
    renderContent(key);
    if (!wired) { wire(); wired = true; }
  }

  function renderContent(key) {
    var box = $("reportsContent");
    var t = Finance.totals(key);

    if (!Finance.hasData(key)) {
      box.innerHTML = '<div class="report-empty">Sem dados neste mês ainda.<br>' +
        'Informe o salário e lance despesas para ver seus relatórios.</div>';
      return;
    }

    var html = "";

    // ===== KPIs =====
    var maior = Finance.biggestExpense(key);
    var avg = Finance.averages();
    html += '<div class="kpi-grid">' +
      kpi("Total gasto no mês", Finance.fmt(t.despesas), "") +
      kpi(t.isLucro ? "Lucro do mês" : "Prejuízo do mês", Finance.fmt(t.saldo), t.isLucro ? "accent" : "danger") +
      kpi("Despesas fixas", Finance.fmt(t.fixasTotal), "blue") +
      kpi("Gastos cotidianos", Finance.fmt(t.gastosTotal), "danger") +
      kpi("Maior gasto avulso", maior ? Finance.fmt(maior.valor) : "—",
          "", maior ? maior.desc : "nenhum gasto lançado") +
      kpi("Média mensal de gasto", avg.meses ? Finance.fmt(avg.mediaDespesa) : "—",
          "", avg.meses ? "base: " + avg.meses + (avg.meses === 1 ? " mês" : " meses") : "precisa de salário") +
      '</div>';

    // ===== Categorias que mais consomem =====
    var cats = Finance.categoryTotals(key);
    if (cats.length) {
      var max = cats[0].total || 1;
      var bars = cats.slice(0, 6).map(function (c, i) {
        var pct = Math.max(3, Math.round(c.total / max * 100));
        return '<div class="hbar">' +
          '<div class="hbar-label"><span>' + Util.esc(c.nome) + '</span><b>' + Finance.fmt(c.total) + '</b></div>' +
          '<div class="hbar-track"><div class="hbar-fill c' + ((i % 5) + 1) + '" style="width:' + pct + '%"></div></div>' +
        '</div>';
      }).join("");
      html += '<div class="chart-card"><div class="chart-title">Categorias que mais consomem</div>' +
        '<div class="chart-sub">Onde seu dinheiro do dia a dia está indo</div>' + bars + '</div>';
    }

    // ===== Evolução (saldo dos últimos 6 meses) =====
    var evo = Finance.evolution(key, 6);
    var maxAbs = evo.reduce(function (mx, p) { return Math.max(mx, Math.abs(p.saldo)); }, 1);
    var cols = evo.map(function (p) {
      var h = Math.max(3, Math.round(Math.abs(p.saldo) / maxAbs * 100));
      var cls = p.saldo >= 0 ? "pos" : "neg";
      var mLabel = Finance.MESES[Finance.parseKey(p.key).month - 1].slice(0, 3);
      var val = p.temUso ? shortMoney(p.saldo) : "—";
      return '<div class="vbar">' +
        '<div class="vbar-val">' + val + '</div>' +
        '<div class="vbar-col ' + cls + '" style="height:' + (p.temUso ? h : 0) + '%"></div>' +
        '<div class="vbar-cap">' + mLabel + '</div>' +
      '</div>';
    }).join("");
    html += '<div class="chart-card"><div class="chart-title">Evolução do resultado</div>' +
      '<div class="chart-sub">Lucro (verde) ou prejuízo (vermelho) dos últimos 6 meses</div>' +
      '<div class="vbars">' + cols + '</div></div>';

    box.innerHTML = html;
  }

  function kpi(label, value, cls, sub) {
    return '<div class="kpi ' + (cls || "") + '">' +
      '<span>' + label + '</span><b>' + value + '</b>' +
      (sub ? '<span>' + Util.esc(sub) + '</span>' : "") + '</div>';
  }

  // "R$ 1,2k" para caber nas colunas estreitas do gráfico
  function shortMoney(n) {
    var a = Math.abs(n);
    var s = (n < 0 ? "-" : "");
    if (a >= 1000) return s + "R$ " + (a / 1000).toFixed(1).replace(".", ",") + "k";
    return s + "R$ " + Math.round(a);
  }

  function wire() {
    $("rpPrev").onclick = function () { Finance.setCurrent(Finance.prev(Finance.currentKey())); render(); };
    $("rpNext").onclick = function () { Finance.setCurrent(Finance.next(Finance.currentKey())); render(); };
    $("rpMonth").onclick = function () { Finance.setCurrent(Finance.keyOf(new Date())); render(); };
  }

  return { render: render };
})();
