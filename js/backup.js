/* ============================================================
   RatRun — Exportar / Importar dados (backup local)

   O app não tem servidor: tudo vive no localStorage DESTE aparelho.
   Trocar de celular, remover o ícone (no iOS isso apaga os dados) ou
   limpar os dados de sites leva tudo embora. Este módulo é a rede de
   proteção: gera um .json com o estado inteiro e sabe restaurá-lo.

   No iPhone, baixar arquivo dentro de um app instalado é pouco
   confiável, então o export usa a folha de compartilhamento do
   sistema (Web Share) quando existe, caindo no download comum no
   desktop.
   ============================================================ */

window.Backup = (function () {

  // Todas as chaves do app. Nada fora daqui é lido ou escrito.
  var KEYS = [
    "ratrun.avatar",
    "ratrun.months",
    "ratrun.goals",
    "ratrun.reserve",
    "ratrun.settings",
    "ratrun.donationSeen"
  ];

  var FORMAT = 1;   // versão do formato do arquivo (p/ migração futura)

  function readKey(k) {
    var raw = localStorage.getItem(k);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  function writeKey(k, v) {
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }

  // ===== Exportar =====
  function snapshot() {
    var data = {};
    KEYS.forEach(function (k) {
      var v = readKey(k);
      if (v !== undefined) data[k] = v;
    });
    return {
      app: "ratrun",
      format: FORMAT,
      exportedAt: new Date().toISOString(),
      data: data
    };
  }

  function filename() {
    var d = new Date();
    return "ratrun-backup-" + d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0") + ".json";
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /**
   * Exporta. Devolve uma Promise com o meio usado:
   * "share" (folha do sistema), "download" ou "cancel".
   * Precisa ser chamado a partir de um clique (o iOS exige gesto).
   */
  function exportData() {
    var name = filename();
    var json = JSON.stringify(snapshot(), null, 2);
    var blob = new Blob([json], { type: "application/json" });

    if (navigator.canShare && window.File) {
      var file = new File([blob], name, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: "Backup do RatRun" })
          .then(function () { return "share"; })
          .catch(function (err) {
            if (err && err.name === "AbortError") return "cancel";
            download(blob, name);
            return "download";
          });
      }
    }

    download(blob, name);
    return Promise.resolve("download");
  }

  // ===== Importar =====
  /**
   * Lê e valida o conteúdo do arquivo.
   * Devolve { ok: true, payload, resumo } ou { ok: false, erro }.
   */
  function parse(text) {
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, erro: "O arquivo não é um backup válido (não é JSON)." }; }

    if (!obj || typeof obj !== "object" || obj.app !== "ratrun" || !obj.data) {
      return { ok: false, erro: "Este arquivo não é um backup do RatRun." };
    }
    if (obj.format > FORMAT) {
      return { ok: false, erro: "Este backup foi feito por uma versão mais nova do app." };
    }

    var d = obj.data;
    var months = d["ratrun.months"] || {};
    var goals = Array.isArray(d["ratrun.goals"]) ? d["ratrun.goals"] : [];
    var reserve = d["ratrun.reserve"] || {};

    return {
      ok: true,
      payload: obj,
      resumo: {
        meses: Object.keys(months).length,
        objetivos: goals.length,
        reserva: Math.max(0, Number(reserve.saldo) || 0),
        data: obj.exportedAt
      }
    };
  }

  /**
   * SUBSTITUI os dados deste aparelho pelos do arquivo.
   * Só escreve as chaves conhecidas; as que não vierem no backup são
   * removidas, para o aparelho ficar idêntico ao arquivo.
   */
  function restore(payload) {
    var d = payload.data || {};
    KEYS.forEach(function (k) {
      if (d[k] === undefined) localStorage.removeItem(k);
      else writeKey(k, d[k]);
    });
  }

  return {
    KEYS: KEYS,
    snapshot: snapshot,
    exportData: exportData,
    parse: parse,
    restore: restore
  };
})();
