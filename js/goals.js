/* ============================================================
   RatRun — Objetivos / Sonhos + estimativas inteligentes

   O usuário cadastra metas (nome + valor estimado e, se quiser, um
   prazo desejado). Depois de pelo menos TRÊS meses de uso com salário
   informado, o app analisa o histórico real e responde três coisas:

     1. Onde o dinheiro está indo   → maiores ofensores (fixas + categorias)
     2. Quanto dá para cortar       → corte com teto realista por tipo
     3. Em quanto tempo ele chega   → hoje, e no cenário com as sugestões
                                       (incluindo renda extra, quando o
                                        corte sozinho não fecha a conta)

   Nada é inventado: todo número sai de Finance (dados do próprio
   usuário). Antes dos 3 meses o app diz que ainda não dá para projetar,
   em vez de arriscar uma estimativa enganosa.

   Base de cálculo: preferimos os meses JÁ ENCERRADOS, porque o mês em
   andamento está incompleto e puxaria a média de gasto para baixo (e o
   prazo para um otimismo falso). Só quando ainda não há 3 meses
   encerrados o mês corrente entra, e a tela avisa.

   Sheet: ratrun.goals → [{id, nome, valor, prazoMeses?, criadoEm}]
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
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function normPrazo(v) {
    var n = Math.round(Number(v) || 0);
    if (!n || n < 1) return 0;                 // 0 = sem prazo definido
    return Math.min(n, 600);
  }

  function add(nome, valor, prazoMeses) {
    var list = load();
    list.push({ id: uid(), nome: String(nome || "").trim() || "Meu objetivo",
                valor: Math.max(0, Number(valor) || 0),
                prazoMeses: normPrazo(prazoMeses),
                criadoEm: new Date().toISOString() });
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
    save(list);
    return list;
  }
  function remove(id) {
    save(load().filter(function (x) { return x.id !== id; }));
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
   *   guardaPorMes    média de saldo (o que sobra de verdade por mês)
   *   mesesAtual      prazo mantendo o ritmo (null = no ritmo atual não fecha)
   *   topOfensor      onde o dinheiro mais pesa
   *   cortes          sugestões de redução, com o porquê
   *   rendaExtra      renda a mais necessária quando o corte não basta
   *   cenario         {guardaPorMes, meses} aplicando tudo o que foi sugerido
   *   notas           avisos honestos sobre a qualidade da estimativa
   */
  function estimate(goal) {
    var r = readiness();
    if (!r.pronto) return { pronto: false, faltam: r.faltam, meses: r.meses };

    var st = stats();
    var guarda = st.mediaSaldo;
    var alvo = Math.max(0, Number(goal.valor) || 0);
    var prazo = normPrazo(goal.prazoMeses) || null;

    var mesesAtual = (guarda > 0 && alvo > 0) ? Math.ceil(alvo / guarda) : null;

    // Com prazo desejado, sabemos exatamente quanto precisa sobrar por mês.
    var precisaGuardar = (prazo && alvo > 0) ? round2(alvo / prazo) : null;
    var necessario = (precisaGuardar !== null)
      ? ceil10(Math.max(0, precisaGuardar - guarda))
      : null;

    // Já sobra mais do que o prazo pede? Então não há o que cortar: pedir
    // sacrifício de quem está em dia seria conselho vazio.
    var noRitmoDoPrazo = (necessario === 0);

    var cortes = noRitmoDoPrazo ? [] : cutPlan(necessario);
    var economia = round2(cortes.reduce(function (s, c) { return s + c.economiaMes; }, 0));
    var guardaComCortes = round2(guarda + economia);

    // Renda extra: só quando os cortes não dão conta. Com prazo, é o que
    // falta para o prazo; sem prazo, é o mínimo para sair do vermelho.
    var rendaExtra = 0, motivoRenda = null;
    if (precisaGuardar !== null) {
      var falta = round2(precisaGuardar - guardaComCortes);
      if (falta > 0) { rendaExtra = ceil10(falta); motivoRenda = "prazo"; }
    } else if (guardaComCortes <= 0) {
      var buraco = Math.abs(guardaComCortes);
      rendaExtra = ceil10(buraco);
      if (rendaExtra <= buraco) rendaExtra += 10;   // precisa sobrar algo, não empatar
      motivoRenda = "vermelho";
    }

    var guardaCenario = round2(guardaComCortes + rendaExtra);
    var mesesCenario = (guardaCenario > 0 && alvo > 0) ? Math.ceil(alvo / guardaCenario) : null;

    var ofensores = offenders();
    var top = ofensores.length ? ofensores[0] : null;

    // ===== Avisos honestos sobre a estimativa =====
    var notas = [];
    if (st.incluiMesEmAndamento) {
      notas.push("O mês em andamento ainda está incompleto e entra nesta média, " +
                 "então o prazo pode parecer melhor do que é. Ele se corrige quando o mês fechar.");
    }
    if (st.maxSaldo - st.minSaldo > Math.abs(guarda) && st.meses >= MIN_MESES) {
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
      meses: st.meses,
      alvo: alvo,
      prazoDesejado: prazo,
      precisaGuardar: precisaGuardar,
      guardaPorMes: guarda,
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
      cenario: (economia > 0 || rendaExtra > 0)
        ? { guardaPorMes: guardaCenario, meses: mesesCenario }
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
    readiness: readiness, stats: stats, estimate: estimate,
    offenders: offenders, cutPlan: cutPlan,
    categoryMonthlyAverages: categoryMonthlyAverages
  };
})();
