/* ============================================================
   RatRun — Aba Objetivos e sonhos

   Três camadas na tela, nesta ordem, porque é a ordem em que o
   dinheiro deve andar:

     1. Reserva de emergência  o colchão que vem antes de qualquer sonho
     2. Divisão da sobra       para onde vai o que sobra todo mês
     3. Metas                  cada sonho com o que já tem reservado, o
                               que recebe por mês e a projeção real

   Com pelo menos 3 meses de uso (com salário), cada meta ganha um
   plano baseado nos números do próprio usuário: quanto entra nela por
   mês, onde o dinheiro mais pesa, quanto dá para cortar sem promessa
   irreal, quanta renda extra faltaria e em quanto tempo chega — hoje e
   no cenário sugerido.
   ============================================================ */

window.UIGoals = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    renderReserve();
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

  function mesAtualNome() {
    var p = Finance.parseKey(Finance.keyOf(new Date()));
    return Finance.MESES[p.month - 1];
  }

  // ===== Peças reutilizadas =====

  // Campo de dinheiro compacto. Grava no blur (onchange) e só então
  // redesenha, para não perder o foco a cada tecla digitada.
  function moneyField(rotulo, valor, onSet) {
    var wrap = document.createElement("label");
    wrap.className = "mini-field";

    var lab = document.createElement("span");
    lab.textContent = rotulo;

    var box = document.createElement("div");
    box.className = "mini-money";
    var pre = document.createElement("span");
    pre.className = "prefix"; pre.textContent = "R$";
    var inp = document.createElement("input");
    inp.setAttribute("inputmode", "decimal");
    inp.placeholder = "0,00";
    inp.value = Util.moneyInputValue(valor);
    inp.setAttribute("aria-label", rotulo);
    inp.onchange = function () { onSet(Util.parseMoney(inp.value)); };

    box.appendChild(pre); box.appendChild(inp);
    wrap.appendChild(lab); wrap.appendChild(box);
    return wrap;
  }

  function progress(pct, cls) {
    var track = document.createElement("div");
    track.className = "hbar-track prog-track";
    var fill = document.createElement("div");
    fill.className = "hbar-fill " + (cls || "");
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    track.appendChild(fill);
    return track;
  }

  function botaoAporte(rotulo, jaFeito, onClick) {
    var b = document.createElement("button");
    b.className = "btn-ghost btn-aporte";
    if (jaFeito) {
      b.textContent = "Aporte de " + mesAtualNome() + " já registrado";
      b.disabled = true;
      b.classList.add("done");
    } else {
      b.textContent = rotulo;
      b.onclick = onClick;
    }
    return b;
  }

  // ===== 1. Reserva de emergência =====

  function renderReserve() {
    var box = $("glReserve");
    box.innerHTML = "";
    var s = Reserve.status();

    var card = document.createElement("div");
    card.className = "reserve-card" + (s.completa ? " completa" : "");

    var head = document.createElement("div");
    head.className = "reserve-head";
    head.innerHTML = '<div class="reserve-title"><strong>Reserva de emergência</strong>' +
      '<span>O colchão que vem antes dos sonhos</span></div>';
    var pill = document.createElement("span");
    pill.className = "reserve-pill" + (s.completa ? " ok" : "");
    pill.textContent = s.temBase ? s.pct + "%" : "sem meta";
    head.appendChild(pill);
    card.appendChild(head);

    if (s.temBase) {
      card.appendChild(progress(s.pct, s.completa ? "" : "c2"));
      var linha = document.createElement("div");
      linha.className = "reserve-nums";
      linha.innerHTML = '<b>' + Finance.fmt(s.saldo) + '</b><span>de ' + Finance.fmt(s.meta) + '</span>';
      card.appendChild(linha);
    }

    var campos = document.createElement("div");
    campos.className = "mini-fields";
    campos.appendChild(moneyField("Já tenho guardado", s.saldo, function (v) {
      Reserve.set({ saldo: v }); render();
    }));
    campos.appendChild(moneyField("Destino por mês", s.aporteMes, function (v) {
      Reserve.set({ aporteMes: v }); render();
    }));
    card.appendChild(campos);

    card.appendChild(metaRow(s));
    card.appendChild(reserveMsg(s));

    if (s.aporteMes > 0 && !s.completa) {
      card.appendChild(botaoAporte("+ Guardei " + Finance.fmt(s.aporteMes) + " em " + mesAtualNome(),
        s.aportouEsteMes, function () {
          Reserve.aportar(s.aporteMes);
          render();
          Toast.show("Aporte registrado na reserva.", "ok");
        }));
    }

    box.appendChild(card);
  }

  // Meta da reserva: por padrão N meses da despesa média real. Quem
  // preferir um número redondo pode fixar o valor à mão.
  function metaRow(s) {
    var row = document.createElement("div");
    row.className = "meta-row";

    var lab = document.createElement("span");
    lab.className = "meta-lab";
    lab.textContent = "Meta:";
    row.appendChild(lab);

    Reserve.OPCOES_MESES.forEach(function (n) {
      var b = document.createElement("button");
      b.className = "meta-chip" + (s.metaAuto && s.metaMeses === n ? " active" : "");
      b.textContent = n + " meses";
      b.onclick = function () { Reserve.set({ metaMeses: n }); render(); };
      row.appendChild(b);
    });

    var fixo = document.createElement("div");
    fixo.className = "mini-money meta-fixo" + (s.metaAuto ? "" : " active");
    var pre = document.createElement("span");
    pre.className = "prefix"; pre.textContent = "R$";
    var inp = document.createElement("input");
    inp.setAttribute("inputmode", "decimal");
    inp.placeholder = "valor";
    inp.value = s.metaAuto ? "" : Util.moneyInputValue(s.metaValor);
    inp.setAttribute("aria-label", "Meta da reserva em valor fixo");
    inp.onchange = function () { Reserve.set({ metaValor: Util.parseMoney(inp.value) }); render(); };
    fixo.appendChild(pre); fixo.appendChild(inp);
    row.appendChild(fixo);

    return row;
  }

  function reserveMsg(s) {
    var el = document.createElement("div");
    el.className = "reserve-msg";

    if (!s.temBase) {
      el.innerHTML = "Informe seu salário e suas despesas para o RatRun calcular a meta da " +
        "reserva, ou fixe um valor acima. A recomendação é guardar de 3 a 6 meses de despesa.";
      return el;
    }
    if (s.completa) {
      el.innerHTML = "Reserva completa. Você tem <b>" + Finance.fmt(s.saldo) + "</b> guardado, o " +
        "equivalente a " + (s.metaAuto ? meses(s.metaMeses) : "sua meta") + " de despesa. " +
        "O que você destinava a ela agora conta para os seus objetivos.";
      return el;
    }

    var txt = s.metaAuto
      ? "Meta de <b>" + Finance.fmt(s.meta) + "</b>, que são " + meses(s.metaMeses) +
        " da sua despesa média de " + Finance.fmt(s.baseDespesa) + "."
      : "Meta de <b>" + Finance.fmt(s.meta) + "</b>, definida por você.";
    txt += " Faltam <b>" + Finance.fmt(s.falta) + "</b>.";

    if (s.mesesParaCompletar === null) {
      txt += " Defina quanto destinar por mês para o RatRun dizer quando ela fecha, e para " +
             "descontar isso da projeção dos seus objetivos.";
    } else {
      txt += " Nesse ritmo, ela fecha em <b>" + prazoTexto(s.mesesParaCompletar) + "</b>.";
    }
    el.innerHTML = txt;
    return el;
  }

  // ===== 2. Divisão da sobra + prontidão do histórico =====

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
      ? "Com base em <b>" + meses(r.meses) + "</b> de histórico, sobra em média <b>" +
        Finance.fmt(st.mediaSaldo) + "</b> por mês."
      : "Você já tem <b>" + meses(r.meses) + "</b> de histórico, mas a média está no vermelho (<b>" +
        Finance.fmt(st.mediaSaldo) + "</b> por mês). Reduzir gastos é o primeiro passo para sobrar algo.";

    if (r.incluiMesEmAndamento) {
      msg += '<span class="readiness-note">O mês atual ainda não fechou e entra nesta conta. ' +
             'Quando houver ' + Goals.MIN_MESES + ' meses encerrados, a projeção usa só eles.</span>';
    }
    box.innerHTML = '<div class="readiness">' + msg + '</div>' + splitHtml();
  }

  // Para onde vai a sobra: é o que explica por que a projeção de um
  // objetivo é mais lenta do que o "sobrou tanto no mês" sugeria.
  function splitHtml() {
    var a = Goals.allocation();
    if (a.sobra <= 0 && a.comprometido <= 0) return "";

    var html = '<div class="split-card"><div class="cut-title">Divisão da sua sobra mensal</div>';
    html += splitLine("Sobra do mês", a.sobra, a.sobra > 0 ? "good" : "bad");
    if (a.paraReserva > 0) html += splitLine("Reserva de emergência", a.paraReserva);
    if (a.paraObjetivos > 0) html += splitLine("Objetivos com valor definido", a.paraObjetivos);
    html += splitLine("Livre para os demais objetivos", a.livre, a.livre > 0 ? "good" : "bad");

    if (a.excedido) {
      html += '<div class="split-warn">Você prometeu <b>' + Finance.fmt(a.comprometido) +
        '</b> por mês, mais do que sobra. Reduza um dos aportes ou corte despesas, senão ' +
        'alguma dessas promessas vai furar.</div>';
    } else if (a.paraReserva > 0 && a.mesesReserva) {
      html += '<div class="split-note">Quando a reserva fechar, em ' + prazoTexto(a.mesesReserva) +
        ', esses <b>' + Finance.fmt(a.paraReserva) + '</b> voltam a ficar livres para os objetivos.</div>';
    }
    html += '</div>';
    return html;
  }

  function splitLine(rotulo, valor, cls) {
    return '<div class="est-line"><span>' + rotulo + '</span><b class="' + (cls || "") + '">' +
      Finance.fmt(valor) + '</b></div>';
  }

  // ===== 3. Metas =====

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

    var pct = g.valor > 0 ? Math.min(100, Math.round(g.guardado / g.valor * 100)) : 0;

    var top = document.createElement("div");
    top.className = "goal-top";
    top.innerHTML = '<div class="goal-info"><strong>' + Util.esc(g.nome) + '</strong>' +
      '<span>' + Finance.fmt(g.guardado) + ' de ' + Finance.fmt(g.valor) + ' · ' + pct + '%</span></div>';
    var del = document.createElement("button");
    del.className = "row-del"; del.textContent = "×"; del.title = "Excluir objetivo";
    del.onclick = function () { Goals.remove(g.id); render(); };
    top.appendChild(del);
    el.appendChild(top);
    el.appendChild(progress(pct));

    // Reserva do objetivo: o que já está separado para ele e o quanto
    // do que entra é destinado a ele todo mês.
    var campos = document.createElement("div");
    campos.className = "mini-fields";
    campos.appendChild(moneyField("Já reservado", g.guardado, function (v) {
      Goals.update(g.id, { guardado: v }); render();
    }));
    campos.appendChild(moneyField("Destino por mês", g.aporteMes, function (v) {
      Goals.update(g.id, { aporteMes: v }); render();
    }));
    el.appendChild(campos);

    el.appendChild(prazoRow(g));

    if (g.aporteMes > 0 && g.guardado < g.valor) {
      el.appendChild(botaoAporte("+ Guardei " + Finance.fmt(g.aporteMes) + " em " + mesAtualNome(),
        Goals.aportouEsteMes(g), function () {
          Goals.aportar(g.id, g.aporteMes);
          render();
          Toast.show("Aporte registrado no objetivo.", "ok");
        }));
    }

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
      render();
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

    if (est.concluido) {
      wrap.innerHTML = '<div class="est-headline">Objetivo alcançado. Você já tem <b>' +
        Finance.fmt(est.guardado) + '</b> reservado para ele.</div>' +
        '<div class="goal-motiv">Conquistado. Agora é só realizar, e escolher o próximo sonho.</div>';
      return wrap;
    }

    var html = "";

    // ===== 1. Onde você está hoje =====
    if (est.mesesAtual !== null) {
      html += '<div class="est-headline">Com o que você destina hoje, alcança esta meta em <b>' +
        prazoTexto(est.mesesAtual) + '</b>.</div>';
    } else if (est.semFluxoAgora) {
      html += '<div class="est-headline warn">Este objetivo <b>não está recebendo nada</b> por mês: ' +
        'sua sobra já está toda destinada à reserva e a outros objetivos.</div>';
    } else {
      html += '<div class="est-headline warn">Com a média atual você <b>não consegue guardar</b> ' +
        'para esta meta: as despesas consomem tudo o que entra. Veja abaixo por onde começar.</div>';
    }

    var origem = est.aporteDeclarado ? "valor definido por você" : "sua sobra livre";
    html += line("Entra neste objetivo por mês", Finance.fmt(est.guardaPorMes),
                 est.guardaPorMes > 0 ? "good" : "bad", origem);
    if (est.guardado > 0) {
      html += line("Já reservado", Finance.fmt(est.guardado), "good", est.pctGuardado + "% da meta");
    }
    html += line("Ainda falta", Finance.fmt(est.falta));
    if (est.precisaGuardar !== null) {
      html += line("Precisa destinar (prazo de " + meses(est.prazoDesejado) + ")",
                   Finance.fmt(est.precisaGuardar));
    }
    html += '<div class="est-base">Base: ' + meses(est.meses) + ' de histórico, sobra média de ' +
      Finance.fmt(est.sobraDoMes) + ' e gasto médio de ' + Finance.fmt(est.mediaDespesa) + ' por mês.</div>';

    // Segunda fase: a reserva fecha e o objetivo acelera sozinho.
    if (!est.aporteDeclarado && est.guardaDepois > est.guardaPorMes && est.alocacao.mesesReserva) {
      html += '<div class="est-hint">Quando a reserva de emergência fechar, em ' +
        prazoTexto(est.alocacao.mesesReserva) + ', este objetivo passa a receber <b>' +
        Finance.fmt(est.guardaDepois) + '</b> por mês. O prazo acima já conta com isso.</div>';
    }

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
        html += '<div class="cut-item">Nenhum corte é necessário: este objetivo já recebe <b>' +
          Finance.fmt(est.guardaPorMes) + '</b> por mês e esse prazo pede <b>' +
          Finance.fmt(est.precisaGuardar) + '</b>. É só manter o ritmo.</div>';
      } else {
        html += '<div class="cut-item">Não encontrei um corte relevante a sugerir: seus gastos estão ' +
          'distribuídos em itens pequenos. Nesse caso, ganhar renda extra costuma render mais que cortar.</div>';
      }
      html += '</div>';
    }

    // ===== 4. Quando cortar não basta =====
    // Sobra dinheiro, mas nada chega aqui: o problema é a divisão da
    // sobra, não o orçamento.
    if (est.semFluxoAgora) {
      html += '<div class="est-extra">Sobra <b>' + Finance.fmt(est.sobraDoMes) + '</b> por mês, mas ' +
        'tudo já está destinado à reserva de emergência e a outros objetivos. Este aqui só começa a ' +
        'andar quando a reserva fechar, ou se você redistribuir os valores destinados.</div>';
    }
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
        " por mês, e destinando isso a este objetivo, ele passaria a receber <b>" +
        Finance.fmt(est.cenario.guardaPorMes) + "</b> por mês";
      if (est.cenario.meses !== null) {
        frase += " e seria alcançado em <b>" + prazoTexto(est.cenario.meses) + "</b>";
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

  function line(label, value, cls, sub) {
    return '<div class="est-line"><span>' + label +
      (sub ? '<i class="est-sub">' + sub + '</i>' : "") +
      '</span><b class="' + (cls || "") + '">' + value + '</b></div>';
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
    var guardado = $("glSaved") ? Util.parseMoney($("glSaved").value) : 0;
    var aporte = $("glAporte") ? Util.parseMoney($("glAporte").value) : 0;
    if (!nome) { Toast.show("Dê um nome ao objetivo.", "warn"); $("glName").focus(); return; }
    if (valor <= 0) { Toast.show("Informe o valor estimado.", "warn"); $("glValue").focus(); return; }
    Goals.add(nome, valor, prazo, guardado, aporte);
    ["glName", "glValue", "glPrazo", "glSaved", "glAporte"].forEach(function (id) {
      if ($(id)) $(id).value = "";
    });
    $("glName").focus();
    render();
    Toast.show("Objetivo criado!", "ok");
  }

  function wire() {
    $("glAdd").onclick = add;
    $("glName").addEventListener("keydown", function (e) { if (e.key === "Enter") $("glValue").focus(); });
    $("glValue").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
  }

  return { render: render };
})();
