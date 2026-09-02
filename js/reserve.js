/* ============================================================
   RatRun — Reserva de emergência

   O colchão que vem ANTES de qualquer sonho. Enquanto ela não está
   completa, o dinheiro que o usuário destina a ela sai da sobra do
   mês e não está disponível para os objetivos. É isso que torna a
   projeção honesta: sem a reserva no meio do caminho, o app estaria
   prometendo para a viagem um dinheiro que na prática precisa ficar
   parado para o dia em que a geladeira quebrar.

   Meta: por padrão, 6 meses da despesa média real do usuário (base
   vinda do mesmo histórico que alimenta as projeções). Ele pode
   trocar para 3 ou 12 meses, ou fixar um valor à mão.

   Quando a reserva fecha, o aporte dela deixa de ser compromisso e
   volta para a sobra livre — e as metas aceleram. Isso entra na
   projeção como uma segunda fase, não como um número escondido.

   Sheet: ratrun.reserve → { saldo, aporteMes, metaMeses, metaValor,
                             ultimoAporte }
   ============================================================ */

window.Reserve = (function () {

  var KEY = "ratrun.reserve";
  var MESES_PADRAO = 6;
  var OPCOES_MESES = [3, 6, 12];

  function round2(n) { return Math.round((n || 0) * 100) / 100; }

  // ===== Persistência =====
  function load() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { o = {}; }
    return {
      saldo:     Math.max(0, Number(o.saldo) || 0),
      aporteMes: Math.max(0, Number(o.aporteMes) || 0),
      metaMeses: OPCOES_MESES.indexOf(Number(o.metaMeses)) !== -1
                   ? Number(o.metaMeses) : MESES_PADRAO,
      metaValor: Math.max(0, Number(o.metaValor) || 0),   // 0 = meta automática
      ultimoAporte: typeof o.ultimoAporte === "string" ? o.ultimoAporte : ""
    };
  }
  function save(r) { localStorage.setItem(KEY, JSON.stringify(r)); }

  function set(patch) {
    var r = load();
    if (patch.saldo !== undefined)     r.saldo = Math.max(0, Number(patch.saldo) || 0);
    if (patch.aporteMes !== undefined) r.aporteMes = Math.max(0, Number(patch.aporteMes) || 0);
    if (patch.metaValor !== undefined) r.metaValor = Math.max(0, Number(patch.metaValor) || 0);
    if (patch.metaMeses !== undefined) {
      var n = Number(patch.metaMeses);
      if (OPCOES_MESES.indexOf(n) !== -1) { r.metaMeses = n; r.metaValor = 0; }
    }
    save(r);
    return r;
  }

  // Guardar o aporte do mês. Marca o mês para o botão não somar duas
  // vezes o mesmo aporte por descuido.
  function aportar(valor) {
    var r = load();
    var v = Math.max(0, Number(valor) || 0);
    if (v <= 0) return r;
    r.saldo = round2(r.saldo + v);
    r.ultimoAporte = Finance.keyOf(new Date());
    save(r);
    return r;
  }
  function aportouEsteMes() {
    return load().ultimoAporte === Finance.keyOf(new Date());
  }

  // ===== Meta =====

  // Base da meta: a despesa média do mesmo histórico usado nas
  // projeções. Sem histórico ainda, cai no mês corrente — melhor uma
  // meta aproximada agora do que nenhuma referência.
  function baseDespesa() {
    var st = (window.Goals && Goals.stats) ? Goals.stats() : null;
    if (st && st.meses > 0 && st.mediaDespesa > 0) return st.mediaDespesa;
    var t = Finance.totals(Finance.currentKey());
    return t.despesas;
  }

  /**
   * Retrato da reserva hoje.
   *   meta / metaAuto / baseDespesa  quanto precisa juntar e de onde saiu
   *   falta / pct / completa         onde ele está nessa caminhada
   *   mesesParaCompletar             no aporte atual (null = sem aporte,
   *                                  ou seja: nunca, do jeito que está)
   *   temBase                        false = ainda não dá para dizer a meta
   */
  function status() {
    var r = load();
    var base = round2(baseDespesa());
    var metaAuto = r.metaValor <= 0;
    var meta = metaAuto ? round2(base * r.metaMeses) : r.metaValor;
    var temBase = meta > 0;

    var falta = temBase ? Math.max(0, round2(meta - r.saldo)) : 0;
    var completa = temBase && falta <= 0;
    var pct = temBase ? Math.min(100, Math.round(r.saldo / meta * 100)) : 0;

    var mesesParaCompletar = (!temBase || completa)
      ? 0
      : (r.aporteMes > 0 ? Math.ceil(falta / r.aporteMes) : null);

    return {
      saldo: r.saldo,
      aporteMes: r.aporteMes,
      metaMeses: r.metaMeses,
      metaValor: r.metaValor,
      metaAuto: metaAuto,
      baseDespesa: base,
      meta: meta,
      temBase: temBase,
      falta: falta,
      pct: pct,
      completa: completa,
      mesesParaCompletar: mesesParaCompletar,
      aportouEsteMes: r.ultimoAporte === Finance.keyOf(new Date())
    };
  }

  return {
    OPCOES_MESES: OPCOES_MESES,
    MESES_PADRAO: MESES_PADRAO,
    load: load, set: set, status: status,
    aportar: aportar, aportouEsteMes: aportouEsteMes
  };
})();
