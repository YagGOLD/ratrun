/* ============================================================
   RatRun — Persistência do avatar (localStorage)
   Schema versionado + saneamento: um id que não exista mais no
   catálogo cai no default da categoria, a renderização nunca quebra.

   Herdado do Mercator sem mudança de contrato (mesma API pública).
   Só a chave mudou (mercator.avatar → ratrun.avatar), então o
   avatar do RatRun é independente do Mercator no mesmo aparelho.

   Nome "Store" (não "Storage") para não sombrear a interface
   nativa window.Storage do navegador.
   ============================================================ */

window.Store = (function () {

  var KEY = "ratrun.avatar";
  var CURRENT_VERSION = 1;

  function defaultAvatar() {
    var parts = {};
    AvatarCatalog.CATEGORIES.forEach(function (cat) {
      parts[cat.id] = AvatarCatalog.defaultFor(cat.id);
    });
    return {
      schemaVersion: CURRENT_VERSION,
      parts: parts,
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
  }

  function sanitize(data) {
    var clean = defaultAvatar();
    if (data.parts) {
      Object.keys(clean.parts).forEach(function (cat) {
        var id = data.parts[cat];
        if (id === null) { clean.parts[cat] = null; return; }   // categoria opcional: "Nenhum"
        clean.parts[cat] = AvatarCatalog.get(id) ? id : AvatarCatalog.defaultFor(cat);
      });
    }
    if (data.meta) clean.meta = data.meta;
    clean.schemaVersion = CURRENT_VERSION;
    return clean;
  }

  function loadAvatar() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return sanitize(JSON.parse(raw));
    } catch (e) {
      console.warn("[Store] avatar salvo ilegível, recomeçando", e);
      return null;
    }
  }

  function saveAvatar(state, extraMeta) {
    var data = sanitize(state);
    data.meta.updatedAt = new Date().toISOString();
    if (extraMeta) Object.keys(extraMeta).forEach(function (k) { data.meta[k] = extraMeta[k]; });
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  return {
    KEY: KEY,
    loadAvatar: loadAvatar,
    saveAvatar: saveAvatar,
    defaultAvatar: defaultAvatar
  };
})();
