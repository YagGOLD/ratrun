/* ============================================================
   Mercator — Catálogo central de partes do avatar
   As partes são PNGs de pixel-art (pasta New_Avatar), registrados
   pelo manifesto js/parts/new-avatar.js via AvatarCatalog.register().
   Todos os assets são 65x65 e já vêm ALINHADOS entre si: a
   composição é empilhamento direto, sem offsets.

   Schema de uma parte:
   {
     id: "hair_01",
     category: "skin" | "eyes" | "eyebrows" | "nose"
             | "mouth" | "cloth" | "hair",
     name: "Bagunçado",
     src: "New_Avatar/HAIR/HAIR_01.png",   // frame padrão
     frames: {                             // frames extras (opcional)
       closed: "New_Avatar/EYES/EYES_01_CLOSED.png",  // olhos: piscar
       smile:  "New_Avatar/MOUTH/MOUTH_01_SMILE.png"  // boca: sorriso
     },
     none: true,          // item "Nenhum" (só em categorias opcionais)
     locked: false,       // trava de progressão
     unlockedBy: null,    // { type: "level", value: 5 }
     price: null,         // custo em gemas (badge no card)
     since: 1
   }
   ============================================================ */

window.AvatarCatalog = (function () {

  // Lado do canvas do avatar, em pixels de arte (os PNGs são 65x65)
  var GRID = 65;

  // A ordem daqui é a ordem dos botões de categoria no criador.
  // A ordem de DESENHO (camadas) fica em Renderer.LAYER_ORDER.
  var CATEGORIES = [
    { id: "skin",     name: "Pele",        optional: false },
    { id: "hair",     name: "Cabelo",      optional: false },
    { id: "eyes",     name: "Olhos",       optional: false },
    { id: "eyebrows", name: "Sobrancelha", optional: false },
    { id: "nose",     name: "Nariz",       optional: false },
    { id: "mouth",    name: "Boca",        optional: false },
    { id: "cloth",    name: "Roupa",       optional: false }
  ];

  var parts = {};        // id → parte
  var byCategory = {};   // categoria → [partes na ordem de registro]

  function warn(msg, part) {
    console.warn("[AvatarCatalog] " + msg, part ? "(" + part.id + ")" : "");
  }

  function register(part) {
    if (parts[part.id]) { warn("id duplicado", part); return; }
    if (part.locked === undefined) part.locked = false;
    if (part.unlockedBy === undefined) part.unlockedBy = null;
    if (part.price === undefined) part.price = null;
    if (part.since === undefined) part.since = 1;
    if (!CATEGORIES.some(function (c) { return c.id === part.category; })) {
      warn("categoria desconhecida: " + part.category, part);
    }

    if (!part.none) {
      if (!part.src) { warn("parte sem 'src' (arquivo do frame padrão)", part); return; }
      // frames.default é o src; os extras (closed/smile) são opcionais
      var frames = { default: part.src };
      if (part.frames) {
        Object.keys(part.frames).forEach(function (f) { frames[f] = part.frames[f]; });
      }
      part.frames = frames;
    }

    parts[part.id] = part;
    (byCategory[part.category] = byCategory[part.category] || []).push(part);
  }

  function get(id) { return parts[id] || null; }
  function list(category) { return byCategory[category] || []; }

  // Todas as partes registradas (usado pelo pré-carregador de imagens)
  function all() {
    return Object.keys(parts).map(function (id) { return parts[id]; });
  }

  // Primeiro item "de verdade" da categoria (pula o "Nenhum")
  function defaultFor(category) {
    var items = list(category);
    var cat = CATEGORIES.find(function (c) { return c.id === category; });
    if (cat && cat.optional) return items[0] ? items[0].id : null; // opcionais: default = "Nenhum"
    var real = items.find(function (p) { return !p.none; });
    return real ? real.id : null;
  }

  return {
    GRID: GRID,
    CATEGORIES: CATEGORIES,
    register: register,
    get: get,
    list: list,
    all: all,
    defaultFor: defaultFor
  };
})();
