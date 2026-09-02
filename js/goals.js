/* ============================================================
   RatRun — Objetivos / Sonhos + estimativas inteligentes

   O usuário cadastra metas (nome + valor estimado, e se quiser um
   prazo desejado, quanto já tem reservado e quanto destina por mês).
   Depois de pelo menos TRÊS meses de uso com salário informado, o app
   analisa o histórico real e responde:

     1. Onde o dinheiro está indo   → maiores ofensores (fixas + categorias)
     2. Quanto dá para cortar       → corte com teto realista por tipo
     3. Em quanto tempo ele chega   → hoje, e no cenário com as sugestões
                                       (incluindo renda extra, quando o
                                        corte sozinho não fecha a conta)

   O QUE ENTRA NA CONTA DO OBJETIVO
   Sobrar dinheiro no mês não é o mesmo que ter dinheiro para o sonho.
   Parte da sobra vai para a reserva de emergência (que vem primeiro) e
   parte pode já estar prometida a outros objetivos. Então a projeção
   usa o fluxo REALMENTE destinado a esta meta:

     sobra do mês − aporte da reserva − aportes dos outros objetivos
                                                    = sobra livre

   Quem tem valor destinado usa esse valor; quem não tem divide a sobra
   livre com os outros objetivos sem valor destinado. E o que a meta já
   tem reservado é descontado do alvo, em vez de recomeçar do zero.

   Quando a reserva fecha, o aporte dela volta para a sobra livre: a
   projeção trata isso como uma segunda fase, mais rápida.

   Nada é inventado: todo número sai de Finance (dados do próprio
   usuário). Antes dos 3 meses o app diz que ainda não dá para projetar,
   em vez de arriscar uma estimativa enganosa.

   Base de cálculo: preferimos os meses JÁ ENCERRADOS, porque o mês em
   andamento está incompleto e puxaria a média de gasto para baixo (e o
   prazo para um otimismo falso). Só quando ainda não há 3 meses
   encerrados o mês corrente entra, e a tela avisa.

   Sheet: ratrun.goals → [{id, nome, valor, prazoMeses?, guardado,
                           aporteMes, ultimoAporte?, criadoEm}]
   ============================================================ */

window.Goals = (function () {

  var KEY = "ratrun.goals";
  var MIN_MESES = 3;              // histórico mínimo p/ estimar

  // Regras do que é um corte "alcançável". Fixa resiste mais que gasto
  // do dia a dia: cancelar uma assinatura ou renegociar um plano rende
  // pouco por vez, enquanto o cotidiano cede mais fácil.
  var TETO_CORTE = { fixa: 0.10, categoria: 0.20 };
  var MIN_ITEM   = 80;            // ofensor menor que isso não vale sugestão
  var MIN_CORTE  = 10;            // sugerir menos que R$ 10/mês é ruído
  var TOP_N      = 3;             // no máximo 3 frentes de corte

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function round2(n) { return Math.round((n || 0) * 100) / 100; }
  function ceil10(n) { return Math.ceil((n || 0) / 10) * 10; }

  // ===== Persistência =====
  function norm(g) {
    g.valor = Math.max(0, Number(g.valor) || 0);
    g.prazoMeses = normPrazo(g.prazoMeses);
    g.guardado = Math.max(0, Number(g.guardado) || 0);
    g.aporteMes = Math.max(0, Number(g.aporteMes) || 0);
    if (typeof g.ultimoAporte !== "string") g.ultimoAporte = "";
    return g;
  }

  // Metas antigas (antes da reserva) não têm guardado/aporteMes: a
  // normalização os cria zerados, então o app segue funcionando com o
  // comportamento de antes até o usuário preencher.
  function load() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY)) || [];
      return Array.isArray(list) ? list.map(norm) : [];
    }
    catch (e) { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function normPrazo(v) {
    var n = Math.round(Number(v) || 0);
    if (!n || n < 1) return 0;                 // 0 = sem prazo definido
    return Math.min(n, 600);
  }

  function add(nome, valor, prazoMeses, guardado, aporteMes) {
    var list = load();
    list.push(norm({ id: uid(), nome: String(nome || "").trim() || "Meu objetivo",
                     valor: valor, prazoMeses: prazoMeses,
                     guardado: guardado, aporteMes: aporteMes,
                     ultimoAporte: "",
                     criadoEm: new Date().toISOString() }));
    save(list);
    return list;
  }
  function update(id, patch) {
    var list = load();
    var g = list.find(function (x) { return x.id === id; });
    if (!g) return list;
    if (patch.nome !== undefined) g.nome = String(patch.nome).trim() || "Meu objetivo";
    if (patch.valor !== undefined) g.valor = Math.max(0, Number(patch.valor) || 0);
    if (patch.prazoMeses !== undefined) g.prazoMeses = normPrazo(patch.prazoMeses);
    if (patch.guardado !== undefined) g.guardado = Math.max(0, Number(patch.guardado) || 0);
    if (patch.aporteMes !== undefined) g.aporteMes = Math.max(0, Number(patch.aporteMes) || 0);
    save(list);
    return list;
  }
  function remove(id) {
    save(load().filter(function (x) { return x.id !== id; }));
  }

  // Guardar o aporte do mês nesta meta. Marca o mês para o botão não
  // somar duas vezes o mesmo aporte por descuido.
  function aportar(id, valor) {
    var list = load();
    var g = list.find(function (x) { return x.id === id; });
    if (!g) return list;
    var v = Math.max(0, Number(valor) || 0);
    if (v <= 0) return list;
    g.guardado = round2(g.guardado + v);
    g.ultimoAporte = Finance.keyOf(new Date());
    save(list);
    return list;
  }
  function aportouEsteMes(g) {
    return g.ultimoAporte === Finance.keyOf(new Date());
  }

  // ===== Base histórica =====

  // Meses que entram na projeção. Só valem meses com salário informado
  // (sem salário, saldo não significa nada) e nunca meses futuros.
  function historyKeys() {
    var atual = Finance.keyOf(new Date());
    var comSalario = Finance.monthsWithData().filter(function (k) {
      return k <= atual && Finance.getMonth(k).salario > 0;
    });
    var fechados = comSalario.filter(function (k) { return k < atual; });
    return fechados.length >= MIN_MESES ? fechados : comSalario;
  }

  // Médias reais do histórico, mais o intervalo do saldo (usado para
  // avisar quando o resultado balança muito de um mês para o outro).
  function stats() {
    var keys = historyKeys();
    var atual = Finance.keyOf(new Date());
    var out = {
      meses: keys.length, keys: keys,
      mediaSalario: 0, mediaFixas: 0, mediaGastos: 0, mediaDespesa: 0, mediaSaldo: 0,
      minSaldo: 0, maxSaldo: 0,
      incluiMesEmAndamento: keys.indexOf(atual) !== -1
    };
    if (!keys.length) return out;

    var sal = 0, fix = 0, gas = 0, des = 0, sal2 = 0, min = null, max = null;
    keys.forEach(function (k) {
      var t = Finance.totals(k);
      sal += t.salario; fix += t.fixasTotal; gas += t.gastosTotal;
      des += t.despesas; sal2 += t.saldo;
      if (min === null || t.saldo < min) min = t.saldo;
      if (max === null || t.saldo > max) max = t.saldo;
    });
    var n = keys.length;
    out.mediaSalario = round2(sal / n);
    out.mediaFixas   = round2(fix / n);
    out.mediaGastos  = round2(gas / n);
    out.mediaDespesa = round2(des / n);
    out.mediaSaldo   = round2(sal2 / n);
    out.minSaldo = round2(min);
    out.maxSaldo = round2(max);
    return out;
  }

  // Quantos meses de histórico já existem, e quantos faltam
  function readiness() {
    var st = stats();
    return {
      meses: st.meses,
      pronto: st.meses >= MIN_MESES,
      faltam: Math.max(0, MIN_MESES - st.meses),
      incluiMesEmAndamento: st.incluiMesEmAndamento
    };
  }

  // ===== Para onde vai a sobra do mês =====

  /**
   * Divisão da sobra média entre reserva de emergência, objetivos com
   * valor destinado e o que ainda está livre.
   *
   *   sobra          o que sobra por mês, em média (pode ser negativo)
   *   paraReserva    aporte da reserva, enquanto ela não está completa
   *   paraObjetivos  soma do que as metas já têm destinado
   *   livre          sobra − compromissos (pode ficar negativo)
   *   excedido       true quando ele prometeu mais do que sobra
   *   semAporte      quantas metas dependem da sobra livre
   *   livrePorMeta   fatia da sobra livre para cada uma delas
   *   folgaFutura    quanto volta a sobrar quando a reserva fechar
   */
  function allocation() {
    var st = stats();
    var res = Reserve.status();
    var metas = load().filter(function (g) { return g.valor > 0; });

    var sobra = st.mediaSaldo;
    var paraReserva = res.completa ? 0 : res.aporteMes;
    var paraObjetivos = round2(metas.reduce(function (s, g) { return s + g.aporteMes; }, 0));
    var livre = round2(sobra - paraReserva - paraObjetivos);

    var semAporte = metas.filter(function (g) { return g.aporteMes <= 0; }).length;
    var livrePorMeta = (semAporte > 0 && livre > 0) ? round2(livre / semAporte) : 0;
    var folgaFutura = paraReserva;
    var folgaPorMeta = (semAporte > 0 && folgaFutura > 0) ? round2(folgaFutura / semAporte) : 0;

    return {
      sobra: sobra,
      paraReserva: paraReserva,
      paraObjetivos: paraObjetivos,
      comprometido: round2(paraReserva + paraObjetivos),
      livre: livre,
      excedido: round2(paraReserva + paraObjetivos) > sobra,
      semAporte: semAporte,
      metas: metas.length,
      livrePorMeta: livrePorMeta,
      folgaFutura: folgaFutura,
      folgaPorMeta: folgaPorMeta,
      reservaCompleta: res.completa,
      mesesReserva: res.completa ? 0 : res.mesesParaCompletar
    };
  }

  // Quanto esta meta recebe por mês, hoje e depois que a reserva fechar.
  // Com valor destinado, é ele; sem, é a fatia da sobra livre — que
  // cresce quando o aporte da reserva deixa de ser compromisso.
  function flow(goal, alo) {
    var declarado = Math.max(0, Number(goal.aporteMes) || 0);
    if (declarado > 0) {
      return { agora: declarado, depois: declarado, declarado: true };
    }
    var agora = Math.max(0, alo.livrePorMeta);
    return { agora: agora, depois: round2(agora + alo.folgaPorMeta), declarado: false };
  }

  /**
   * Meses até juntar `falta`, respeitando as duas fases: enquanto a
   * reserva não fecha o fluxo é `f1`; depois passa a `f2`.
   * `mesesFase1` null = a reserva não fecha do jeito que está, então a
   * fase 1 vale para sempre. Devolve null quando não fecha nunca.
   */
  function mesesPara(falta, f1, mesesFase1, f2) {
    if (falta <= 0) return 0;

    if (mesesFase1 === null) {                 // reserva parada: só a fase 1
      return f1 > 0 ? Math.ceil(falta / f1) : null;
    }
    if (mesesFase1 > 0 && f1 > 0) {
      var acumulado = f1 * mesesFase1;
      if (acumulado >= falta) return Math.ceil(falta / f1);
      return f2 > 0 ? mesesFase1 + Math.ceil(round2(falta - acumulado) / f2) : null;
    }
    // Sem fluxo na fase 1: só começa a andar quando a reserva fechar.
    return f2 > 0 ? mesesFase1 + Math.ceil(falta / f2) : null;
  }

  // ===== Onde o dinheiro está indo =====

  // Maiores ofensores do orçamento: junta as despesas FIXAS (por nome)
  // com as CATEGORIAS de gasto cotidiano, tudo em média mensal. Ver as
  // duas coisas na mesma lista é o que mostra o peso real de cada uma.
  // Devolve [{nome, tipo, media, pct}] em ordem decrescente.
  function offenders() {
    var keys = historyKeys();
    if (!keys.length) return [];

    var acc = {};
    function bump(tipo, nome, valor) {
      var id = tipo + "|" + String(nome).toLowerCase();
      if (!acc[id]) acc[id] = { nome: nome, tipo: tipo, total: 0 };
      acc[id].total += valor;
    }
    keys.forEach(function (k) {
      Finance.getMonth(k).fixas.forEach(function (f) { bump("fixa", f.nome, f.valor); });
      Finance.categoryTotals(k).forEach(function (c) { bump("categoria", c.nome, c.total); });
    });

    var n = keys.length;
    var list = Object.keys(acc).map(function (id) {
      var o = acc[id];
      return {
        nome: o.nome, tipo: o.tipo,
        media: round2(o.total / n),
        semCategoria: o.tipo === "categoria" && o.nome === "Sem categoria"
      };
    }).filter(function (o) { return o.media > 0; });

    var totalMedio = list.reduce(function (s, o) { return s + o.media; }, 0);
    list.forEach(function (o) {
      o.pct = totalMedio > 0 ? Math.round(o.media / totalMedio * 100) : 0;
    });
    return list.sort(function (a, b) { return b.media - a.media; });
  }

  /**
   * Plano de corte pé no chão.
   * - só entra ofensor com média >= MIN_ITEM (cortar um item de R$ 30
   *   não muda nada e soa como conselho vazio);
   * - cada um cede no máximo o teto do seu tipo;
   * - valores arredondados na dezena, para virar uma meta que se lembra;
   * - se há um alvo de economia (`necessario`), corta só o que falta,
   *   em vez de pedir sacrifício além da conta.
   * `necessario` null = mostrar o máximo alcançável.
   */
  function cutPlan(necessario) {
    var cands = offenders().filter(function (o) {
      return !o.semCategoria && o.media >= MIN_ITEM;
    }).slice(0, TOP_N);

    var falta = (necessario === null || necessario === undefined) ? null : Math.max(0, necessario);
    var out = [];

    cands.forEach(function (o) {
      if (falta !== null && falta <= 0) return;
      var teto = o.media * (TETO_CORTE[o.tipo] || 0.20);
      var bruto = (falta === null) ? teto : Math.min(teto, falta);
      var corte = Math.round(bruto / 10) * 10;
      if (corte > teto) corte = Math.floor(teto / 10) * 10;
      if (corte < MIN_CORTE) return;
      if (falta !== null) falta = round2(falta - corte);

      out.push({
        nome: o.nome,
        tipo: o.tipo,
        media: o.media,
        economiaMes: corte,
        cortePct: Math.round(corte / o.media * 100),
        porque: o.tipo === "fixa"
          ? "É uma conta fixa: o corte vem de renegociar o plano, trocar de fornecedor ou cancelar o que você não usa."
          : "É gasto do dia a dia, a parte mais fácil de ajustar sem virar sua rotina de cabeça para baixo."
      });
    });

    return out;
  }

  /**
   * Estimativa para uma meta, com base no histórico real.
   *
   * Sem os 3 meses: { pronto:false, faltam }.
   * Com histórico:
   *   guardado / falta   quanto já está reservado e quanto ainda falta
   *   guardaPorMes       o que ESTA meta recebe por mês (não a sobra toda)
   *   mesesAtual         prazo no ritmo atual (null = assim não fecha)
   *   reserva            situação da reserva de emergência
   *   alocacao           como a sobra do mês está dividida
   *   topOfensor         onde o dinheiro mais pesa
   *   cortes             sugestões de redução, com o porquê
   *   rendaExtra         renda a mais necessária quando o corte não basta
   *   cenario            aplicando tudo o que foi sugerido
   *   notas              avisos honestos sobre a qualidade da estimativa
   */
  function estimate(goal) {
    var r = readiness();
    if (!r.pronto) return { pronto: false, faltam: r.faltam, meses: r.meses };

    var st = stats();
    var res = Reserve.status();
    var alo = allocation();
    var f = flow(goal, alo);

    var alvo = Math.max(0, Number(goal.valor) || 0);
    var guardado = Math.min(Math.max(0, Number(goal.guardado) || 0), alvo || Infinity);
    var falta = round2(Math.max(0, alvo - guardado));
    var pctGuardado = alvo > 0 ? Math.min(100, Math.round(guardado / alvo * 100)) : 0;
    var prazo = normPrazo(goal.prazoMeses) || null;

    // Meta já alcançada: não há o que projetar nem o que cortar.
    if (alvo > 0 && falta <= 0) {
      return {
        pronto: true, concluido: true, meses: st.meses,
        alvo: alvo, guardado: guardado, falta: 0, pctGuardado: 100,
        guardaPorMes: f.agora, reserva: res, alocacao: alo, notas: []
      };
    }

    var mesesAtual = (alvo > 0)
      ? mesesPara(falta, f.agora, alo.mesesReserva, f.depois)
      : null;

    // Com prazo desejado, sabemos exatamente quanto precisa entrar por mês.
    var precisaGuardar = (prazo && falta > 0) ? round2(falta / prazo) : null;
    var necessario = (precisaGuardar !== null)
      ? ceil10(Math.max(0, precisaGuardar - f.agora))
      : null;

    // Já entra mais do que o prazo pede? Então não há o que cortar: pedir
    // sacrifício de quem está em dia seria conselho vazio.
    var noRitmoDoPrazo = (necessario === 0);

    var cortes = noRitmoDoPrazo ? [] : cutPlan(necessario);
    var economia = round2(cortes.reduce(function (s, c) { return s + c.economiaMes; }, 0));
    var comCortes = round2(f.agora + economia);

    // Renda extra: só quando os cortes não dão conta. Com prazo, é o que
    // falta para o prazo; sem prazo, é o mínimo para a meta sair do lugar.
    var rendaExtra = 0, motivoRenda = null;
    if (precisaGuardar !== null) {
      var buracoPrazo = round2(precisaGuardar - comCortes);
      if (buracoPrazo > 0) { rendaExtra = ceil10(buracoPrazo); motivoRenda = "prazo"; }
    } else if (comCortes <= 0 && st.mediaSaldo + economia <= 0) {
      // Não sobra nada no mês: o problema é o orçamento, não a divisão.
      var buraco = Math.abs(round2(st.mediaSaldo + economia));
      rendaExtra = ceil10(buraco);
      if (rendaExtra <= buraco) rendaExtra += 10;     // precisa sobrar algo, não empatar
      motivoRenda = "vermelho";
    }

    // Caso diferente do vermelho: o mes fecha no azul, mas esta meta nao
    // recebe nada porque a sobra inteira ja esta prometida a reserva e a
    // outros objetivos. Dizer so que nao da para guardar seria injusto:
    // da, mas o dinheiro esta com outro dono.
    var semFluxoAgora = (f.agora <= 0 && st.mediaSaldo > 0);

    var fluxoCenario = round2(comCortes + rendaExtra);
    var mesesCenario = (alvo > 0)
      ? mesesPara(falta, fluxoCenario, alo.mesesReserva,
                  round2(fluxoCenario + (f.declarado ? 0 : alo.folgaPorMeta)))
      : null;

    var ofensores = offenders();
    var top = ofensores.length ? ofensores[0] : null;

    // ===== Avisos honestos sobre a estimativa =====
    var notas = [];
    if (st.incluiMesEmAndamento) {
      notas.push("O mês em andamento ainda está incompleto e entra nesta média, " +
                 "então o prazo pode parecer melhor do que é. Ele se corrige quando o mês fechar.");
    }
    if (alo.excedido) {
      notas.push("Você já destinou " + Finance.fmt(alo.comprometido) + " por mês entre reserva e " +
                 "objetivos, mas sobra em média " + Finance.fmt(alo.sobra) + ". Do jeito que está, " +
                 "alguma dessas promessas não vai caber no mês.");
    }
    if (!res.completa && res.temBase && f.agora > 0) {
      notas.push("Sua reserva de emergência ainda não está completa (" + res.pct + "% de " +
                 Finance.fmt(res.meta) + "). Sem ela, um imprevisto consome justamente o que " +
                 "você está juntando para este objetivo.");
    }
    if (!f.declarado && alo.semAporte > 1) {
      notas.push("Este objetivo não tem valor destinado, então divide a sobra livre com os outros " +
                 (alo.semAporte - 1) + " objetivos na mesma situação. Defina quanto vai para cada um " +
                 "para ter um prazo mais firme.");
    }
    if (st.maxSaldo - st.minSaldo > Math.abs(st.mediaSaldo) && st.meses >= MIN_MESES) {
      notas.push("Seu resultado varia bastante de um mês para o outro (de " +
                 Finance.fmt(st.minSaldo) + " a " + Finance.fmt(st.maxSaldo) +
                 "), então trate o prazo como estimativa, não como promessa.");
    }
    if (top && top.semCategoria && top.pct >= 30) {
      notas.push("Boa parte dos seus gastos está sem categoria. Categorizando, " +
                 "o RatRun consegue apontar melhor onde cortar.");
    }

    return {
      pronto: true,
      concluido: false,
      meses: st.meses,
      alvo: alvo,
      guardado: guardado,
      falta: falta,
      pctGuardado: pctGuardado,
      prazoDesejado: prazo,
      precisaGuardar: precisaGuardar,
      guardaPorMes: f.agora,
      guardaDepois: f.depois,
      aporteDeclarado: f.declarado,
      sobraDoMes: st.mediaSaldo,
      reserva: res,
      alocacao: alo,
      mediaSalario: st.mediaSalario,
      mediaDespesa: st.mediaDespesa,
      mediaGastos: st.mediaGastos,
      mediaFixas: st.mediaFixas,
      mesesAtual: mesesAtual,
      topOfensor: top,
      ofensores: ofensores.slice(0, 5),
      cortes: cortes,
      noRitmoDoPrazo: noRitmoDoPrazo,
      economiaCortes: economia,
      rendaExtra: rendaExtra,
      motivoRenda: motivoRenda,
      semFluxoAgora: semFluxoAgora,
      cenario: (economia > 0 || rendaExtra > 0)
        ? { guardaPorMes: fluxoCenario, meses: mesesCenario }
        : null,
      notas: notas
    };
  }

  // Média mensal de gasto por categoria (só gastos cotidianos), sobre o
  // mesmo histórico usado nas projeções.
  function categoryMonthlyAverages() {
    return offenders().filter(function (o) { return o.tipo === "categoria"; })
      .map(function (o) { return { nome: o.nome, media: o.media }; });
  }

  return {
    MIN_MESES: MIN_MESES,
    load: load, add: add, update: update, remove: remove,
    aportar: aportar, aportouEsteMes: aportouEsteMes,
    readiness: readiness, stats: stats, estimate: estimate,
    allocation: allocation, mesesPara: mesesPara,
    offenders: offenders, cutPlan: cutPlan,
    categoryMonthlyAverages: categoryMonthlyAverages
  };
})();
