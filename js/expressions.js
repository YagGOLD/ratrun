/* ============================================================
   Mercator — Expressões do mascote
   O mascote "interage" trocando de expressão quando o usuário usa
   o app (marcar item, concluir compra, desbloquear...).

   No motor de imagens, uma expressão é uma combinação de:
     frames → troca o desenho de uma camada (olhos "closed", boca "smile")
     dy     → desloca a camada em pixels (sobrancelha sobe = surpresa)
     parts  → troca a peça inteira (ex.: uma boca sorridente própria)

   O pack atual tem um desenho por categoria, então as expressões se
   apoiam no que dá para fazer sem arte nova (sobrancelha e piscada).
   Assim que MOUTH_01_SMILE.png / EYES_01_CLOSED.png forem desenhados
   e declarados no manifesto, estas mesmas expressões ganham a arte
   automaticamente — sem tocar neste arquivo.
   ============================================================ */

window.Expressions = (function () {

  var PRESETS = {
    neutro:      {},
    sorrindo:    { frames: { mouth: "smile" },                    dy: { eyebrows: -1 } },
    feliz:       { frames: { mouth: "smile" },                    dy: { eyebrows: -2 } },
    surpreso:    {                                                dy: { eyebrows: -2 } },
    rindo:       { frames: { eyes: "closed", mouth: "smile" },    dy: { eyebrows: -2 } },
    determinado: {                                                dy: { eyebrows:  1 } }
  };

  function overridesFor(name) {
    return PRESETS[name] || null;
  }

  // Toca uma expressão num canvas estático (lista, resumo, home).
  // ms = duração; omitido → expressão fica (ex.: resumo da compra).
  var timers = {};
  function playOn(canvas, state, name, ms) {
    var ov = overridesFor(name);
    if (!ov || !canvas) return;
    Renderer.draw(canvas, state, ov);
    var key = canvas.id || "_";
    clearTimeout(timers[key]);
    if (ms) {
      timers[key] = setTimeout(function () { Renderer.draw(canvas, state); }, ms);
    }
  }

  return { PRESETS: PRESETS, overridesFor: overridesFor, playOn: playOn };
})();
