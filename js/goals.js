/* ============================================================
   RatRun — Objetivos / Sonhos + estimativas inteligentes

   O usuário cadastra metas (nome + valor estimado). Depois de pelo
   menos TRÊS meses de uso com salário informado, o app analisa o
   histórico real e projeta:
     - quanto ele consegue guardar por mês (média do saldo)
     - em quanto tempo atinge a meta mantendo o padrão atual
     - quais categorias de gasto poderiam ser reduzidas para chegar
       mais rápido, com um cenário de corte

   Nada é inventado: todos os números saem de Finance (dados do
   próprio usuário). Antes dos 3 meses, o app mostra incentivo e
   quanto falta para liberar a análise.

   Sheet: ratrun.goals → [{id, nome, valor, criadoEm}]
   ============================================================ */

window.Goals = (function () {

  var KEY = "ratrun.goals";
  var MIN_MESES = 3;              // histórico mínimo p/ estimar

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function add(nome, valor) {
    var list = load();
    list.push({ id: uid(), nome: String(nome || "").trim() || "Meu objetivo",
                valor: Math.max(0, Number(valor) || 0),
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
    save(list);
    return list;
  }
  function remove(id) {
    save(load().filter(function (x) { return x.id !== id; }));
  }

  // Quantos meses com salário informado já existem, e quantos faltam
  function readiness() {
    var n = Finance.averages().meses;
    return { meses: n, pronto: n >= MIN_MESES, faltam: Math.max(0, MIN_MESES - n) };
  }

  /**
   * Estimativa para uma meta, com base no histórico real.
   * Devolve:
   *   { pronto:false, faltam } enquanto não há 3 meses; ou
   *   { pronto:true, guardaPorMes, meses, deficit, cortes:[...] }
   * Quando a média de saldo é <= 0, meses = null (no ritmo atual não
   * dá para guardar) e os cortes ganham protagonismo.
   */
  function estimate(goal) {
    var r = readiness();
    if (!r.pronto) return { pronto: false, faltam: r.faltam, meses: r.meses };

    var avg = Finance.averages();
    var guardaPorMes = avg.mediaSaldo;          // saldo médio = poupança média
    var alvo = goal.valor;

    var mesesAteMeta = null;
    if (guardaPorMes > 0 && alvo > 0) {
      mesesAteMeta = Math.ceil(alvo / guardaPorMes);
    }

    // Sugestões de corte: as categorias que mais consomem, somadas
    // por todos os meses recentes, viram candidatas a redução. Um
    // corte de 30% na média mensal daquela categoria mostra o ganho.
    var cortes = suggestCuts(guardaPorMes, alvo);

    return {
      pronto: true,
      meses: mesesAteMeta,          // null = no ritmo atual não fecha
      guardaPorMes: guardaPorMes,
      mediaGastos: avg.mediaGastos,
      alvo: alvo,
      cortes: cortes
    };
  }

  // Média mensal de gasto por categoria (só gastos cotidianos), sobre
  // os meses com salário. Usada para propor onde economizar.
  function categoryMonthlyAverages() {
    var keys = Finance.monthsWithData().filter(function (k) {
      return Finance.getMonth(k).salario > 0;
    });
    if (!keys.length) return [];
    var acc = {};
    keys.forEach(function (k) {
      Finance.categoryTotals(k).forEach(function (c) {
        if (!acc[c.nome]) acc[c.nome] = 0;
        acc[c.nome] += c.total;
      });
    });
    var n = keys.length;
    return Object.keys(acc).map(function (nome) {
      return { nome: nome, media: Math.round((acc[nome] / n) * 100) / 100 };
    }).sort(function (a, b) { return b.media - a.media; });
  }

  // Para as 3 maiores categorias, simula cortar CUT_PCT da média e
  // mostra o novo prazo até a meta. Devolve os cenários mais úteis.
  var CUT_PCT = 0.30;
  function suggestCuts(guardaPorMes, alvo) {
    if (alvo <= 0) return [];
    var cats = categoryMonthlyAverages().filter(function (c) {
      return c.nome !== "Sem categoria" && c.media > 0;
    }).slice(0, 3);

    return cats.map(function (c) {
      var economiaMes = Math.round(c.media * CUT_PCT * 100) / 100;
      var novoGuarda = guardaPorMes + economiaMes;
      var novoMeses = (novoGuarda > 0) ? Math.ceil(alvo / novoGuarda) : null;
      return {
        categoria: c.nome,
        mediaAtual: c.media,
        cortePct: Math.round(CUT_PCT * 100),
        economiaMes: economiaMes,
        novoGuardaPorMes: Math.round(novoGuarda * 100) / 100,
        novoMeses: novoMeses
      };
    });
  }

  return {
    MIN_MESES: MIN_MESES,
    load: load, add: add, update: update, remove: remove,
    readiness: readiness, estimate: estimate,
    categoryMonthlyAverages: categoryMonthlyAverages
  };
})();
