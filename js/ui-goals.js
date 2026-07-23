/* ============================================================
   RatRun — Aba Objetivos e sonhos
   Metas (nome + valor). Com pelo menos 3 meses de uso (com salário),
   cada meta ganha uma projeção baseada nos dados reais do usuário:
   quanto ele guarda por mês, em quanto tempo chega, e onde poderia
   cortar para acelerar. Tom motivacional, sempre com números dele.
   ============================================================ */

window.UIGoals = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    renderReadiness();
    renderList();
    if (!wired) { wire(); wired = true; }
  }

  function renderReadiness() {
    var box = $("glReadiness");
    var r = Goals.readiness();
    if (r.pronto) {
      var avg = Finance.averages();
      var msg = avg.mediaSaldo > 0
        ? "Com base em <b>" + r.meses + " meses</b>, você guarda em média <b>" +
          Finance.fmt(avg.mediaSaldo) + "</b> por mês."
        : "Você já tem <b>" + r.meses + " meses</b> de histórico, mas a média está no vermelho. Reduzir gastos libera espaço para guardar.";
      box.innerHTML = '<div class="readiness">' + msg + '</div>';
    } else {
      box.innerHTML = '<div class="readiness">Faltam <b>' + r.faltam +
        (r.faltam === 1 ? " mês" : " meses") + '</b> de uso (com salário informado) para o RatRun projetar suas metas com precisão. ' +
        'Continue lançando: a inteligência liga aos 3 meses.</div>';
    }
  }

  function renderList() {
    var box = $("glList");
    box.innerHTML = "";
    var goals = Goals.load();
    if (!goals.length) {
      box.innerHTML = '<div class="empty-hint">Nenhum objetivo ainda.<br>Que sonho você quer conquistar?</div>';
      return;
    }
    goals.forEach(function (g) { box.appendChild(card(g)); });
  }

  function card(g) {
    var el = document.createElement("div");
    el.className = "goal-card";

    var top = document.createElement("div");
    top.className = "goal-top";
    top.innerHTML = '<div class="goal-info"><strong>' + Util.esc(g.nome) + '</strong>' +
      '<span>Meta: ' + Finance.fmt(g.valor) + '</span></div>';
    var del = document.createElement("button");
    del.className = "row-del"; del.textContent = "×"; del.title = "Excluir objetivo";
    del.onclick = function () { Goals.remove(g.id); renderList(); };
    top.appendChild(del);
    el.appendChild(top);

    el.appendChild(estimateBlock(g));
    return el;
  }

  function estimateBlock(g) {
    var wrap = document.createElement("div");
    wrap.className = "goal-estimate";
    var est = Goals.estimate(g);

    if (!est.pronto) {
      wrap.innerHTML = '<div class="est-headline">Projeção disponível em <b>' + est.faltam +
        (est.faltam === 1 ? " mês" : " meses") + '</b>. Continue registrando seus gastos.</div>';
      return wrap;
    }

    var html = "";
    if (est.meses !== null) {
      var anos = est.meses >= 12 ? " (~" + (Math.round(est.meses / 12 * 10) / 10).toString().replace(".", ",") + " anos)" : "";
      html += '<div class="est-headline">No ritmo atual, você atinge esta meta em <b>' +
        est.meses + (est.meses === 1 ? " mês" : " meses") + '</b>' + anos + '.</div>';
      html += line("Você guarda por mês", Finance.fmt(est.guardaPorMes), "good");
    } else {
      html += '<div class="est-headline warn">No ritmo atual você <b>não consegue guardar</b> para esta meta: os gastos consomem todo o salário. Veja onde cortar abaixo.</div>';
    }

    // Sugestões de corte (as maiores categorias)
    if (est.cortes && est.cortes.length) {
      var cuts = est.cortes.filter(function (c) { return c.economiaMes > 0; });
      if (cuts.length) {
        html += '<div class="cut-list"><div class="cut-title">Onde acelerar</div>';
        cuts.forEach(function (c) {
          var ganho = "Cortar <b>" + c.cortePct + "%</b> em <b>" + Util.esc(c.categoria) +
            "</b> libera <b>" + Finance.fmt(c.economiaMes) + "</b> por mês";
          if (c.novoMeses !== null && est.meses !== null && c.novoMeses < est.meses) {
            ganho += ", chegando em <b>" + c.novoMeses + (c.novoMeses === 1 ? " mês" : " meses") + "</b>";
          } else if (c.novoMeses !== null && est.meses === null) {
            ganho += ", tornando a meta possível em <b>" + c.novoMeses + (c.novoMeses === 1 ? " mês" : " meses") + "</b>";
          }
          html += '<div class="cut-item">' + ganho + ".</div>";
        });
        html += '</div>';
      }
    }

    html += '<div class="goal-motiv">' + motivation(est) + '</div>';
    wrap.innerHTML = html;
    return wrap;
  }

  function line(label, value, cls) {
    return '<div class="est-line"><span>' + label + '</span><b class="' + (cls || "") + '">' + value + '</b></div>';
  }

  function motivation(est) {
    if (est.meses === null) {
      return "Todo real que sai dos supérfluos vira um passo rumo ao seu sonho. Comece pequeno.";
    }
    if (est.meses <= 6) return "Está logo ali. Mantenha o foco e o hábito de anotar tudo.";
    if (est.meses <= 18) return "Um plano consistente vale mais que pressa. Você está no caminho.";
    return "Grandes conquistas pedem paciência. Cada mês registrado te aproxima e mostra onde melhorar.";
  }

  function add() {
    var nome = $("glName").value.trim();
    var valor = Util.parseMoney($("glValue").value);
    if (!nome) { Toast.show("Dê um nome ao objetivo.", "warn"); $("glName").focus(); return; }
    if (valor <= 0) { Toast.show("Informe o valor estimado.", "warn"); $("glValue").focus(); return; }
    Goals.add(nome, valor);
    $("glName").value = ""; $("glValue").value = "";
    $("glName").focus();
    renderList();
    Toast.show("Objetivo criado!", "ok");
  }

  function wire() {
    $("glAdd").onclick = add;
    $("glName").addEventListener("keydown", function (e) { if (e.key === "Enter") $("glValue").focus(); });
    $("glValue").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
  }

  return { render: render };
})();
