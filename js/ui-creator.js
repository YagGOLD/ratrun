/* ============================================================
   RatRun — UI do Criador de Avatar
   Categorias em botões com thumbnail e carrossel de itens com
   scroll-snap. Toda mudança redesenha o avatar na hora (sem
   confirmação).

   Diferença do Mercator: o RatRun não é gamificado. Não há nível,
   gemas nem itens travados, então toda a lógica de Progress /
   Particles saiu. Personalizar = escolher a peça de cada categoria
   (inclusive o tom de pele, que é uma categoria de peças como as
   outras). Todo item está sempre disponível.
   ============================================================ */

window.UICreator = (function () {

  var state = null;         // avatar em edição
  var activeCat = "hair";
  var onSave = null;
  var onSkip = null;

  var els = {};

  function $(id) { return document.getElementById(id); }

  function init(initialState, callbacks) {
    state = initialState;
    onSave = callbacks.onSave;
    onSkip = callbacks.onSkip;
    els = {
      canvas: $("avatarCanvas"),
      catRow: $("catRow"),
      catLabel: $("catLabel"),
      itemRow: $("itemRow"),
      btnSave: $("btnSave"),
      btnSkip: $("btnSkip")
    };

    Animator.attach(els.canvas, function () { return state; });

    buildCategoryBar();
    selectCategory(activeCat);

    els.btnSave.onclick = function () {
      Animator.playExpression("feliz", 1200);
      onSave(state);
    };
    els.btnSkip.onclick = function () { onSkip(); };
  }

  function getState() { return state; }
  function setState(newState) {
    state = newState;
    Animator.redraw();
    buildCategoryBar();
    selectCategory(activeCat);
  }

  // ===== Barra de categorias =====
  function buildCategoryBar() {
    els.catRow.innerHTML = "";
    AvatarCatalog.CATEGORIES.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "cat-btn" + (cat.id === activeCat ? " active" : "");
      btn.title = cat.name;
      btn.setAttribute("aria-label", cat.name);

      var iconId = state.parts[cat.id] || AvatarCatalog.defaultFor(cat.id);
      btn.appendChild(cloneCanvas(Renderer.thumbnail(iconId)));

      btn.onclick = function () { selectCategory(cat.id); };
      els.catRow.appendChild(btn);
    });
  }

  function cloneCanvas(src) {
    var c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }

  // ===== Seleção de categoria =====
  function selectCategory(catId) {
    activeCat = catId;
    var cat = AvatarCatalog.CATEGORIES.find(function (c) { return c.id === catId; });
    els.catLabel.textContent = cat.name;

    Array.prototype.forEach.call(els.catRow.children, function (btn, i) {
      btn.classList.toggle("active", AvatarCatalog.CATEGORIES[i].id === catId);
    });

    buildItems(cat);
  }

  // ===== Carrossel de itens =====
  function buildItems(cat) {
    els.itemRow.innerHTML = "";

    var items = AvatarCatalog.list(cat.id);
    if (!items.length) {
      var hint = document.createElement("span");
      hint.className = "item-empty";
      hint.textContent = "Nenhum item nesta categoria ainda.";
      els.itemRow.appendChild(hint);
      return;
    }

    items.forEach(function (part) {
      var card = document.createElement("button");
      var isSelected = state.parts[cat.id] === part.id ||
                       (part.none && state.parts[cat.id] === null);
      card.className = "item-card" + (isSelected ? " selected" : "");

      if (part.none) {
        var icon = document.createElement("span");
        icon.className = "none-icon";
        icon.textContent = "×";
        card.appendChild(icon);
      } else {
        card.appendChild(cloneCanvas(Renderer.thumbnail(part.id)));
      }

      var name = document.createElement("span");
      name.className = "item-name";
      name.textContent = part.name;
      card.appendChild(name);

      card.onclick = function () {
        state.parts[cat.id] = part.none ? null : part.id;
        Animator.redraw();
        buildItems(cat);        // atualiza seleção
        buildCategoryBar();     // atualiza ícone da categoria
      };
      els.itemRow.appendChild(card);
    });
  }

  return { init: init, getState: getState, setState: setState };
})();
