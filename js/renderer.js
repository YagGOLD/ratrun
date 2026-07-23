/* ============================================================
   Mercator — Motor de renderização do avatar
   Empilha os PNGs do pack New_Avatar num canvas 65x65 (upscale via
   CSS com image-rendering: pixelated). Os assets já vêm alinhados
   entre si, então cada camada é desenhada em (0,0) — a única
   variação é o deslocamento vertical usado pelas animações.

   A API pública é a mesma do motor antigo (draw / thumbnail /
   randomState), então UI, Animator e Expressions não mudaram de
   contrato ao trocarmos matrizes de pixel por imagens.
   ============================================================ */

window.Renderer = (function () {

  var GRID = AvatarCatalog.GRID;

  // Ordem de empilhamento (de trás para frente).
  // Cabelo por último: cai sobre a testa, o rosto e os ombros.
  var LAYER_ORDER = [
    "skin", "eyes", "eyebrows", "nose", "mouth", "cloth", "hair"
  ];

  // Linha dos olhos no pack (y em pixels de arte). Todos os assets
  // usam a mesma cabeça de referência, então é constante.
  var EYE_LINE = 32;

  var thumbCache = {};

  // ===== Piscada sintetizada =====
  // Fallback usado só quando os olhos NÃO têm um frame "closed"
  // desenhado: achata a camada dos olhos contra a linha dos olhos,
  // virando uma fresta escura — que é como um piscar aparece em
  // pixel-art. Assim que EYES_xx_CLOSED.png existir no manifesto,
  // o frame de verdade tem prioridade e isto deixa de rodar.
  function drawBlink(ctx, img, dy) {
    var s = 0.4;                                   // fator de achatamento
    var top = Math.round(EYE_LINE * (1 - s)) + dy; // escala em torno de EYE_LINE
    ctx.drawImage(img, 0, 0, GRID, GRID, 0, top, GRID, Math.round(GRID * s));
  }

  /**
   * Desenha o avatar completo.
   * overrides (opcional — usado pelo Animator e pelas Expressions):
   *   { frames: { eyes: "closed", mouth: "smile" },
   *     dy:     { eyebrows: -1 },
   *     parts:  { mouth: "mouth_02" } }
   * Um frame ou uma parte que não exista cai no padrão em vez de
   * sumir da tela — expressão sem asset degrada, nunca quebra.
   */
  function draw(canvas, state, overrides) {
    overrides = overrides || {};
    var frameOv = overrides.frames || {};
    var dyOv = overrides.dy || {};
    var partOv = overrides.parts || {};

    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    LAYER_ORDER.forEach(function (cat) {
      var id = partOv[cat] !== undefined ? partOv[cat] : state.parts[cat];
      // Override apontando p/ uma peça que ainda não existe no pack:
      // mantém a peça equipada em vez de sumir com a camada.
      if (partOv[cat] && !AvatarCatalog.get(partOv[cat])) id = state.parts[cat];
      if (!id) return;

      var part = AvatarCatalog.get(id);
      if (!part || part.none) return;

      var dy = dyOv[cat] || 0;
      var frame = frameOv[cat];
      var img = Assets.image(id, frame);

      if (frame && !img) {
        // Frame pedido não existe neste asset
        var base = Assets.image(id);
        if (!base) return;
        if (cat === "eyes" && frame === "closed") { drawBlink(ctx, base, dy); return; }
        img = base;   // demais frames: usa o desenho padrão
      }
      if (!img) return;

      ctx.drawImage(img, 0, dy);
    });
  }

  // ===== Thumbnails (cards do carrossel e ícones de categoria) =====
  // A parte é desenhada sobre a pele-base, para o item aparecer no
  // contexto do rosto. Cache por id: sem paleta, o desenho é fixo.
  function baseState(partId) {
    var parts = {};
    var part = partId && AvatarCatalog.get(partId);
    parts.skin = (part && part.category === "skin")
      ? partId
      : AvatarCatalog.defaultFor("skin");
    if (part && !part.none && part.category !== "skin") parts[part.category] = partId;
    return { parts: parts };
  }

  // Nariz e boca têm pouquíssimos pixels; a 65px de largura os cards
  // dessas categorias ficariam todos iguais (uma cabeça careca).
  // Nelas o thumbnail dá zoom 2x no rosto — recorte quadrado de 32px
  // centrado nas feições (x 22..54, y 19..51 da grade de arte).
  var FACE_CROP = { x: 22, y: 19, size: 32 };
  var ZOOMED = { eyes: true, eyebrows: true, nose: true, mouth: true };

  function thumbnail(partId) {
    if (thumbCache[partId]) return thumbCache[partId];

    var part = partId && AvatarCatalog.get(partId);
    var zoom = part && ZOOMED[part.category];

    // Composição em tamanho real...
    var full = document.createElement("canvas");
    full.width = GRID; full.height = GRID;
    draw(full, baseState(partId));

    // ...e, se for categoria de detalhe, recorta o rosto em 2x
    var canvas = full;
    if (zoom) {
      canvas = document.createElement("canvas");
      canvas.width = FACE_CROP.size * 2;
      canvas.height = FACE_CROP.size * 2;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(full, FACE_CROP.x, FACE_CROP.y, FACE_CROP.size, FACE_CROP.size,
                    0, 0, canvas.width, canvas.height);
    }

    thumbCache[partId] = canvas;
    return canvas;
  }

  function clearThumbCache() { thumbCache = {}; }

  // Avatar aleatório (usado na gallery e no botão de sorte)
  function randomState() {
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    var parts = {};
    AvatarCatalog.CATEGORIES.forEach(function (cat) {
      var items = AvatarCatalog.list(cat.id);
      if (items.length) parts[cat.id] = pick(items).id;
    });
    return { parts: parts };
  }

  return {
    GRID: GRID,
    LAYER_ORDER: LAYER_ORDER,
    draw: draw,
    thumbnail: thumbnail,
    clearThumbCache: clearThumbCache,
    randomState: randomState
  };
})();
