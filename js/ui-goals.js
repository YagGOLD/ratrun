/* ============================================================
   RatRun — Aba Objetivos e sonhos
   Metas (nome + valor + prazo opcional). Com pelo menos 3 meses de
   uso (com salário), cada meta ganha um plano baseado nos números do
   próprio usuário: quanto ele guarda, onde o dinheiro mais pesa,
   quanto dá para cortar sem promessa irreal, quanta renda extra
   faltaria e em quanto tempo chega — hoje e no cenário sugerido.
   ============================================================ */

window.UIGoals = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    renderReadiness();
    renderList();
    if (!wired) { wire(); wired = true; }
  }

  function plural(n, um, muitos) { return n + " " + (n === 1 ? um : muitos); }
  function meses(n) { return plural(n, "mês", "meses"); }

  function anosNota(n) {
    if (n < 12) return "";
    return " (~" + (Math.round(n / 12 * 10) / 10).toString().replace(".", ",") + " anos)";
  }

  // Acima de 20 anos, um número exato de meses só dá falsa precisão:
  // o que importa é a mensagem de que, assim, o objetivo não fecha.
  var LONGE = 240;
  function prazoTexto(n) {
    return n > LONGE ? "mais de 20 anos" : meses(n) + anosNota(n);
  }

  function renderReadiness() {
    var box = $("glReadiness");
    var r = Goals.readiness();

    if (!r.pronto) {
      box.innerHTML = '<div class="readiness">Faltam <b>' + meses(r.faltam) +
        '</b> de uso (com salário informado) para o RatRun projetar suas metas com precisão. ' +
        'Continue lançando: a inteligência liga aos ' + Goals.MIN_MESES + ' meses.</div>';
      return;
    }

    var st = Goals.stats();
    var msg = st.mediaSaldo > 0
      ? "Com base em <b>" + meses(r.meses) + "</b> de histórico, você guarda em média <b>" +
        Finance.fmt(st.mediaSaldo) + "</b> por mês."
      : "Você já tem <b>" + meses(r.meses) + "</b> de histórico, mas a média está no vermelho (<b>" +
        Finance.fmt(st.mediaSaldo) + "</b> por mês). Reduzir gastos é o primeiro passo para sobrar algo.";

    if (r.incluiMesEmAndamento) {
      msg += '<span class="readiness-note">O mês atual ainda não fechou e entra nesta conta. ' +
             'Quando houver ' + Goals.MIN_MESES + ' meses encerrados, a projeção usa só eles.</span>';
    }
    box.innerHTML = '<div class="readiness">' + msg + '</div>';
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

    el.appendChild(prazoRow(g));
    el.appendChild(estimateBlock(g));
    return el;
  }

  // Prazo desejado: é ele que permite dizer quanto cortar e quanta
  // renda extra faltaria. Opcional — sem ele o app só projeta o ritmo.
  function prazoRow(g) {
    var row = document.createElement("div");
    row.className = "goal-prazo";

    var lab = document.createElement("span");
    lab.textContent = "Quero alcançar em";

    var inp = document.createElement("input");
    inp.type = "number";
    inp.min = "1"; inp.max = "600";
    inp.setAttribute("inputmode", "numeric");
    inp.placeholder = "—";
    inp.value = g.prazoMeses > 0 ? g.prazoMeses : "";
    inp.setAttribute("aria-label", "Prazo desejado em meses");
    inp.onchange = function () {
      Goals.update(g.id, { prazoMeses: inp.value });
      renderList();
    };

    var suf = document.createElement("span");
    suf.textContent = "meses (opcional)";

    row.appendChild(lab); row.appendChild(inp); row.appendChild(suf);
    return row;
  }

  function estimateBlock(g) {
    var wrap = document.createElement("div");
    wrap.className = "goal-estimate";
    var est = Goals.estimate(g);

    if (!est.pronto) {
      wrap.innerHTML = '<div class="est-headline">Projeção disponível em <b>' + meses(est.faltam) +
        '</b>. Continue registrando seus gastos: sem histórico suficiente, qualquer previsão seria chute.</div>';
      return wrap;
    }

    var html = "";

    // ===== 1. Onde você está hoje =====
    if (est.mesesAtual !== null) {
      html += '<div class="est-headline">Mantendo sua média atual, você atinge esta meta em <b>' +
        prazoTexto(est.mesesAtual) + '</b>.</div>';
    } else {
      html += '<div class="est-headline warn">Com a média atual você <b>não consegue guardar</b> ' +
        'para esta meta: as despesas consomem tudo o que entra. Veja abaixo por onde começar.</div>';
    }
    html += line("Você guarda por mês", Finance.fmt(est.guardaPorMes),
                 est.guardaPorMes > 0 ? "good" : "bad");
    if (est.precisaGuardar !== null) {
      html += line("Precisa guardar (prazo de " + meses(est.prazoDesejado) + ")",
                   Finance.fmt(est.precisaGuardar));
    }
    html += '<div class="est-base">Base: ' + meses(est.meses) + ' de histórico, gasto médio de ' +
      Finance.fmt(est.mediaDespesa) + ' por mês.</div>';

    // ===== 2. Maiores ofensores =====
    if (est.topOfensor) {
      var t = est.topOfensor;
      var ondeVem = t.semCategoria ? "em gastos sem categoria"
                  : (t.tipo === "fixa" ? "na conta fixa <b>" + Util.esc(t.nome) + "</b>"
                                       : "com <b>" + Util.esc(t.nome) + "</b>");
      html += '<div class="cut-list"><div class="cut-title">Onde seu dinheiro mais pesa</div>' +
        '<div class="cut-item">Seu maior gasto médio hoje é ' + ondeVem + ': cerca de <b>' +
        Finance.fmt(t.media) + '</b> por mês, perto de <b>' + t.pct + '%</b> de tudo o que você gasta.</div>';

      // ===== 3. Cortes alcançáveis =====
      if (est.cortes.length) {
        est.cortes.forEach(function (c) {
          html += '<div class="cut-item">Reduzir cerca de <b>' + Finance.fmt(c.economiaMes) +
            '</b> por mês ' + (c.tipo === "fixa" ? "em " : "com ") + '<b>' + Util.esc(c.nome) +
            '</b> é viável: são só <b>' + c.cortePct + '%</b> da sua média de ' + Finance.fmt(c.media) +
            '.<span class="cut-why">' + c.porque + '</span></div>';
        });
      } else if (est.noRitmoDoPrazo) {
        html += '<div class="cut-item">Nenhum corte é necessário: você já guarda <b>' +
          Finance.fmt(est.guardaPorMes) + '</b> por mês e esse prazo pede <b>' +
          Finance.fmt(est.precisaGuardar) + '</b>. É só manter o ritmo.</div>';
      } else {
        html += '<div class="cut-item">Não encontrei um corte relevante a sugerir: seus gastos estão ' +
          'distribuídos em itens pequenos. Nesse caso, ganhar renda extra costuma render mais que cortar.</div>';
      }
      html += '</div>';
    }

    // ===== 4. Renda extra, quando cortar não basta =====
    if (est.rendaExtra > 0) {
      var txt = est.motivoRenda === "prazo"
        ? 'Só com os cortes o prazo de <b>' + meses(est.prazoDesejado) + '</b> não fecha. ' +
          'Seria preciso <b>' + Finance.fmt(est.rendaExtra) + '</b> a mais de renda por mês para chegar lá.'
        : 'Mesmo aplicando os cortes, seu mês ainda fecharia no vermelho. Seriam necessários pelo menos <b>' +
          Finance.fmt(est.rendaExtra) + '</b> a mais de renda por mês para você começar a guardar.';
      html += '<div class="est-extra">' + txt + '</div>';
    }

    // ===== 5. Cenário com as sugestões =====
    if (est.cenario) {
      var partes = [];
      if (est.economiaCortes > 0) partes.push("cortando " + Finance.fmt(est.economiaCortes));
      if (est.rendaExtra > 0) partes.push("somando " + Finance.fmt(est.rendaExtra) + " de renda");
      var cabeca = partes.join(" e ");
      var frase = cabeca.charAt(0).toUpperCase() + cabeca.slice(1) +
        " por mês, você passaria a guardar <b>" + Finance.fmt(est.cenario.guardaPorMes) + "</b> por mês";
      if (est.cenario.meses !== null) {
        frase += " e alcançaria o objetivo em <b>" + prazoTexto(est.cenario.meses) + "</b>";
        if (est.mesesAtual !== null && est.cenario.meses < est.mesesAtual) {
          frase += ", contra " + prazoTexto(est.mesesAtual) + " no ritmo de hoje";
        } else if (est.cenario.meses > LONGE) {
          frase += ". Para um prazo realista, seria preciso cortar mais fundo ou somar mais renda";
        }
      }
      html += '<div class="est-scenario"><div class="cut-title">Cenário com as sugestões</div>' +
        '<div class="cut-item">' + frase + '.</div></div>';
    }

    // Sem prazo definido, o app não tem como dizer quanta renda falta
    if (!est.prazoDesejado) {
      html += '<div class="est-hint">Informe acima em quantos meses você quer chegar: ' +
        'assim o RatRun calcula quanto cortar e quanta renda extra faltaria para esse prazo.</div>';
    }

    // ===== 6. Avisos honestos =====
    est.notas.forEach(function (n) {
      html += '<div class="est-note">' + n + '</div>';
    });

    html += '<div class="goal-motiv">' + motivation(est) + '</div>';
    wrap.innerHTML = html;
    return wrap;
  }

  function line(label, value, cls) {
    return '<div class="est-line"><span>' + label + '</span><b class="' + (cls || "") + '">' + value + '</b></div>';
  }

  function motivation(est) {
    if (est.mesesAtual === null) {
      return "Todo real que sai dos supérfluos vira um passo rumo ao seu sonho. Comece pequeno.";
    }
    if (est.mesesAtual <= 6) return "Está logo ali. Mantenha o foco e o hábito de anotar tudo.";
    if (est.mesesAtual <= 18) return "Um plano consistente vale mais que pressa. Você está no caminho.";
    return "Grandes conquistas pedem paciência. Cada mês registrado te aproxima e mostra onde melhorar.";
  }

  function add() {
    var nome = $("glName").value.trim();
    var valor = Util.parseMoney($("glValue").value);
    var prazo = $("glPrazo") ? $("glPrazo").value : "";
    if (!nome) { Toast.show("Dê um nome ao objetivo.", "warn"); $("glName").focus(); return; }
    if (valor <= 0) { Toast.show("Informe o valor estimado.", "warn"); $("glValue").focus(); return; }
    Goals.add(nome, valor, prazo);
    $("glName").value = ""; $("glValue").value = "";
    if ($("glPrazo")) $("glPrazo").value = "";
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
