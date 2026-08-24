/* ============================================================
   RatRun — Núcleo financeiro (localStorage, 100% offline)

   O app organiza tudo por MÊS. Cada mês tem:
     - salario  : salário líquido (base de todos os cálculos)
     - fixas    : despesas fixas [{id, nome, valor}]
     - gastos   : gastos cotidianos [{id, desc, valor, data, categoria}]

   Cálculo central do mês:
     saldo = salario − Σfixas − Σgastos
     saldo >= 0 → Lucro do Mês ;  saldo < 0 → Prejuízo do Mês

   Sheets em localStorage:
     ratrun.months   → { "2026-07": {salario, fixas, gastos}, ... }
     ratrun.settings → { mesAtual: "2026-07" }
   ============================================================ */

window.Finance = (function () {

  var MKEY = "ratrun.months";
  var SKEY = "ratrun.settings";

  var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
               "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ===== Persistência bruta =====
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(MKEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveAll(all) { localStorage.setItem(MKEY, JSON.stringify(all)); }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SKEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSettings(s) { localStorage.setItem(SKEY, JSON.stringify(s)); }

  // ===== Chaves de mês ("2026-07") =====
  function keyOf(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function parseKey(key) {
    var p = String(key).split("-");
    return { year: parseInt(p[0], 10), month: parseInt(p[1], 10) };  // month 1..12
  }

  function label(key) {
    var p = parseKey(key);
    return MESES[p.month - 1] + " " + p.year;
  }
  function shortLabel(key) {
    var p = parseKey(key);
    return MESES[p.month - 1] + " " + p.year;
  }

  function shift(key, delta) {
    var p = parseKey(key);
    var idx = (p.year * 12) + (p.month - 1) + delta;
    var year = Math.floor(idx / 12);
    var month = (idx % 12) + 1;
    return year + "-" + String(month).padStart(2, "0");
  }
  function prev(key) { return shift(key, -1); }
  function next(key) { return shift(key, 1); }

  // ===== Mês atual (navegação) =====
  function currentKey() {
    var s = loadSettings();
    return s.mesAtual || keyOf(new Date());
  }
  function setCurrent(key) {
    var s = loadSettings();
    s.mesAtual = key;
    saveSettings(s);
  }

  // Devolve o mês (cria a estrutura em memória se ainda não existir).
  // Não grava sozinho: só materializa no storage quando algo é editado.
  function getMonth(key) {
    var all = loadAll();
    var m = all[key];
    if (!m) m = { salario: 0, fixas: [], gastos: [] };
    if (typeof m.salario !== "number") m.salario = 0;
    if (!Array.isArray(m.fixas)) m.fixas = [];
    if (!Array.isArray(m.gastos)) m.gastos = [];
    return m;
  }

  function putMonth(key, m) {
    var all = loadAll();
    all[key] = m;
    saveAll(all);
  }

  // ===== Salário =====
  function setSalario(key, valor) {
    var m = getMonth(key);
    m.salario = Math.max(0, Number(valor) || 0);
    putMonth(key, m);
    return m;
  }

  // ===== Despesas fixas =====
  function addFixa(key, nome, valor) {
    var m = getMonth(key);
    m.fixas.push({ id: uid(), nome: String(nome || "").trim() || "Despesa",
                   valor: Math.max(0, Number(valor) || 0) });
    putMonth(key, m);
    return m;
  }
  function updateFixa(key, id, patch) {
    var m = getMonth(key);
    var f = m.fixas.find(function (x) { return x.id === id; });
    if (!f) return m;
    if (patch.nome !== undefined) f.nome = String(patch.nome).trim() || "Despesa";
    if (patch.valor !== undefined) f.valor = Math.max(0, Number(patch.valor) || 0);
    putMonth(key, m);
    return m;
  }
  function removeFixa(key, id) {
    var m = getMonth(key);
    m.fixas = m.fixas.filter(function (x) { return x.id !== id; });
    putMonth(key, m);
    return m;
  }

  // Cria várias fixas de uma vez no mês. Usado pela cópia revisada do
  // mês anterior: cada item vira uma despesa NOVA e independente (id
  // próprio, sem vínculo com a de origem), então editar aqui nunca
  // mexe no mês que serviu de modelo. Devolve quantas criou.
  function addFixasBulk(key, items) {
    if (!Array.isArray(items) || !items.length) return 0;
    var m = getMonth(key);
    var n = 0;
    items.forEach(function (it) {
      if (!it) return;
      m.fixas.push({
        id: uid(),
        nome: String(it.nome || "").trim() || "Despesa",
        valor: Math.max(0, Number(it.valor) || 0)
      });
      n++;
    });
    if (n) putMonth(key, m);
    return n;
  }

  // Copia as despesas fixas do mês anterior para o mês atual (aluguel,
  // internet e afins costumam se repetir). Só copia se o mês atual ainda
  // não tiver fixas, para não duplicar. Devolve quantas copiou.
  function copyFixasFromPrev(key) {
    var m = getMonth(key);
    if (m.fixas.length) return 0;
    var prevM = getMonth(prev(key));
    if (!prevM.fixas.length) return 0;
    m.fixas = prevM.fixas.map(function (f) {
      return { id: uid(), nome: f.nome, valor: f.valor };
    });
    putMonth(key, m);
    return m.fixas.length;
  }

  // ===== Gastos cotidianos =====
  // Registro rápido: só descrição e valor são obrigatórios. A data
  // nasce como hoje; a categoria é texto livre e opcional.
  function addGasto(key, desc, valor, data, categoria) {
    var m = getMonth(key);
    m.gastos.push({
      id: uid(),
      desc: String(desc || "").trim() || "Gasto",
      valor: Math.max(0, Number(valor) || 0),
      data: data || todayISO(),
      categoria: String(categoria || "").trim()
    });
    putMonth(key, m);
    return m;
  }
  function updateGasto(key, id, patch) {
    var m = getMonth(key);
    var g = m.gastos.find(function (x) { return x.id === id; });
    if (!g) return m;
    if (patch.desc !== undefined) g.desc = String(patch.desc).trim() || "Gasto";
    if (patch.valor !== undefined) g.valor = Math.max(0, Number(patch.valor) || 0);
    if (patch.data !== undefined) g.data = patch.data;
    if (patch.categoria !== undefined) g.categoria = String(patch.categoria).trim();
    putMonth(key, m);
    return m;
  }
  function removeGasto(key, id) {
    var m = getMonth(key);
    m.gastos = m.gastos.filter(function (x) { return x.id !== id; });
    putMonth(key, m);
    return m;
  }

  // ===== Totais do mês =====
  function sum(arr, f) { return arr.reduce(function (s, x) { return s + f(x); }, 0); }

  function totals(key) {
    var m = getMonth(key);
    var fixasTotal = sum(m.fixas, function (f) { return f.valor; });
    var gastosTotal = sum(m.gastos, function (g) { return g.valor; });
    var despesas = fixasTotal + gastosTotal;
    var saldo = m.salario - despesas;
    return {
      salario: m.salario,
      fixasTotal: fixasTotal,
      gastosTotal: gastosTotal,
      despesas: despesas,
      saldo: round2(saldo),
      isLucro: saldo >= 0,
      countFixas: m.fixas.length,
      countGastos: m.gastos.length
    };
  }

  // Um mês "tem uso" quando o usuário informou salário ou lançou algo.
  function hasData(key) {
    var m = getMonth(key);
    return m.salario > 0 || m.fixas.length > 0 || m.gastos.length > 0;
  }

  // Meses com uso, em ordem cronológica (chaves "aaaa-mm" ordenam como string)
  function monthsWithData() {
    var all = loadAll();
    return Object.keys(all).filter(hasData).sort();
  }

  // ===== Relatórios =====

  // Gastos cotidianos agrupados por categoria (texto livre normalizado:
  // "uber" e "Uber" contam juntos). Vazio vira "Sem categoria".
  // Devolve [{ nome, total, count }] em ordem decrescente de total.
  function categoryTotals(key) {
    var m = getMonth(key);
    var map = {};
    m.gastos.forEach(function (g) {
      var raw = (g.categoria || "").trim();
      var norm = raw.toLowerCase() || "__none__";
      if (!map[norm]) {
        map[norm] = { nome: raw || "Sem categoria", total: 0, count: 0 };
      }
      map[norm].total += g.valor;
      map[norm].count++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  // Maior gasto cotidiano avulso do mês
  function biggestExpense(key) {
    var m = getMonth(key);
    if (!m.gastos.length) return null;
    return m.gastos.reduce(function (top, g) {
      return (!top || g.valor > top.valor) ? g : top;
    }, null);
  }

  // Evolução dos últimos N meses (a partir do mês de referência,
  // recuando). Sempre devolve N pontos, mesmo os vazios, para o
  // gráfico ter uma linha do tempo contínua.
  function evolution(refKey, n) {
    n = n || 6;
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var k = shift(refKey, -i);
      var t = totals(k);
      out.push({ key: k, label: label(k), despesas: t.despesas,
                 gastos: t.gastosTotal, fixas: t.fixasTotal, saldo: t.saldo,
                 salario: t.salario, temUso: hasData(k) });
    }
    return out;
  }

  // Média mensal de gastos e de saldo, considerando só os meses com
  // salário informado (sem salário, saldo não faz sentido).
  function averages() {
    var keys = monthsWithData().filter(function (k) { return getMonth(k).salario > 0; });
    if (!keys.length) return { meses: 0, mediaDespesa: 0, mediaSaldo: 0, mediaGastos: 0 };
    var somaDesp = 0, somaSaldo = 0, somaGastos = 0;
    keys.forEach(function (k) {
      var t = totals(k);
      somaDesp += t.despesas;
      somaSaldo += t.saldo;
      somaGastos += t.gastosTotal;
    });
    var n = keys.length;
    return {
      meses: n,
      mediaDespesa: round2(somaDesp / n),
      mediaSaldo: round2(somaSaldo / n),
      mediaGastos: round2(somaGastos / n)
    };
  }

  // ===== Utilidades =====
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }
  function round2(n) { return Math.round((n || 0) * 100) / 100; }

  function fmt(n) {
    return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  // Data curta "23/07" a partir de "2026-07-23"
  function fmtDay(iso) {
    var p = String(iso).split("-");
    if (p.length < 3) return "";
    return p[2] + "/" + p[1];
  }

  return {
    MESES: MESES,
    keyOf: keyOf, label: label, shortLabel: shortLabel,
    prev: prev, next: next, shift: shift, parseKey: parseKey,
    currentKey: currentKey, setCurrent: setCurrent,
    getMonth: getMonth,
    setSalario: setSalario,
    addFixa: addFixa, updateFixa: updateFixa, removeFixa: removeFixa,
    addFixasBulk: addFixasBulk, copyFixasFromPrev: copyFixasFromPrev,
    addGasto: addGasto, updateGasto: updateGasto, removeGasto: removeGasto,
    totals: totals, hasData: hasData, monthsWithData: monthsWithData,
    categoryTotals: categoryTotals, biggestExpense: biggestExpense,
    evolution: evolution, averages: averages,
    todayISO: todayISO, fmt: fmt, fmtDay: fmtDay
  };
})();
