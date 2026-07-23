/* ============================================================
   Mercator — Pré-carregador de imagens do avatar
   O renderizador é SÍNCRONO (Renderer.draw é chamado em vários
   pontos da UI e dentro do requestAnimationFrame do Animator).
   Imagens, porém, carregam de forma assíncrona — então o app só
   entra depois que todos os PNGs do catálogo estão na memória.
   Depois disso, Assets.image() devolve o <img> na hora.

   Um PNG que falhe ao carregar não derruba o app: a camada
   simplesmente não é desenhada e o erro aparece no console.
   ============================================================ */

window.Assets = (function () {

  var images = {};      // "partId" ou "partId|frame" → HTMLImageElement
  var ready = false;

  function key(partId, frame) {
    return (!frame || frame === "default") ? partId : partId + "|" + frame;
  }

  function loadOne(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        console.warn("[Assets] falhou ao carregar: " + src);
        resolve(null);
      };
      img.src = src;
    });
  }

  // Carrega todos os frames de todas as partes registradas.
  // done() roda uma vez, com tudo em memória.
  function preload(done) {
    var jobs = [];
    AvatarCatalog.all().forEach(function (part) {
      if (part.none || !part.frames) return;
      Object.keys(part.frames).forEach(function (frame) {
        jobs.push(
          loadOne(part.frames[frame]).then(function (img) {
            if (img) images[key(part.id, frame)] = img;
          })
        );
      });
    });

    Promise.all(jobs).then(function () {
      ready = true;
      done();
    });
  }

  /**
   * Imagem de uma parte. frame ausente (ex.: "closed" sem asset)
   * devolve null — quem chama decide o fallback; nunca quebra.
   */
  function image(partId, frame) {
    if (!partId) return null;
    return images[key(partId, frame)] || null;
  }

  // A parte tem esse frame? (Animator usa p/ decidir se pisca/sorri)
  function hasFrame(partId, frame) {
    return !!image(partId, frame);
  }

  return {
    preload: preload,
    image: image,
    hasFrame: hasFrame,
    isReady: function () { return ready; }
  };
})();
