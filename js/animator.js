/* ============================================================
   Mercator — Animações idle do avatar
   Um único requestAnimationFrame com agendador por timestamp e
   dirty flag: só redesenha quando algum estado visual muda.
   - Piscar: frame "closed" dos olhos por ~130ms a cada 3–7s
   - Sobrancelha: camada sobe 1px por ~400ms a cada ~12s
   - Sorriso: frame "smile" da boca por 1.5s a cada 15–30s
     (só se o asset existir — ver js/parts/new-avatar.js)
   - Head-bob: CSS puro no wrapper (não passa por aqui)
   Respeita prefers-reduced-motion.

   Duas camadas de override: "idle" (piscar/sobrancelha/sorriso) e
   "expr" (expressão temporária). A expressão tem prioridade, mas
   as duas coexistem — piscar durante uma expressão continua valendo.
   ============================================================ */

window.Animator = (function () {

  var canvas = null;
  var getState = null;
  var running = false;
  var session = 0;    // invalida loops antigos quando attach() é chamado de novo
  var dirty = false;
  var idle = { frames: {}, dy: {} };
  var expr = null;    // { frames, dy, parts } enquanto uma expressão toca
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var next = { blink: 0, blinkEnd: 0, brow: 0, browEnd: 0, smile: 0, smileEnd: 0 };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function schedule(now) {
    next.blink = now + rand(3000, 7000);
    next.brow = now + rand(9000, 15000);
    next.smile = now + rand(15000, 30000);
  }

  // Junta idle + expressão num único objeto de overrides p/ o Renderer
  function merged() {
    if (!expr) return idle;
    var out = { frames: {}, dy: {}, parts: expr.parts || {} };
    Object.keys(idle.frames).forEach(function (k) { out.frames[k] = idle.frames[k]; });
    Object.keys(idle.dy).forEach(function (k) { out.dy[k] = idle.dy[k]; });
    Object.keys(expr.frames || {}).forEach(function (k) { out.frames[k] = expr.frames[k]; });
    Object.keys(expr.dy || {}).forEach(function (k) { out.dy[k] = expr.dy[k]; });
    return out;
  }

  function makeTick(mySession) {
    return function tick(now) {
      if (!running || mySession !== session) return;
      step(now);
      requestAnimationFrame(makeTick(mySession));
    };
  }

  function step(now) {

    if (!reduced) {
      // Piscar (sem asset "closed", o Renderer sintetiza a piscada)
      if (next.blinkEnd && now >= next.blinkEnd) {
        delete idle.frames.eyes; next.blinkEnd = 0;
        next.blink = now + rand(3000, 7000); dirty = true;
      } else if (now >= next.blink && !next.blinkEnd) {
        idle.frames.eyes = "closed";
        next.blinkEnd = now + 130; dirty = true;
      }
      // Sobrancelha
      if (next.browEnd && now >= next.browEnd) {
        delete idle.dy.eyebrows; next.browEnd = 0;
        next.brow = now + rand(9000, 15000); dirty = true;
      } else if (now >= next.brow && !next.browEnd) {
        idle.dy.eyebrows = -1;
        next.browEnd = now + 400; dirty = true;
      }
      // Sorriso ocasional (só se a boca atual tiver o frame "smile")
      if (next.smileEnd && now >= next.smileEnd) {
        delete idle.frames.mouth; next.smileEnd = 0;
        next.smile = now + rand(15000, 30000); dirty = true;
      } else if (now >= next.smile && !next.smileEnd) {
        var mouthId = getState().parts.mouth;
        if (mouthId && Assets.hasFrame(mouthId, "smile")) {
          idle.frames.mouth = "smile";
          next.smileEnd = now + 1500;
          dirty = true;
        } else {
          next.smile = now + rand(15000, 30000);
        }
      }
    }

    if (dirty) {
      Renderer.draw(canvas, getState(), merged());
      dirty = false;
    }
  }

  return {
    // Liga o animator a um canvas + fonte de estado
    attach: function (targetCanvas, stateGetter) {
      canvas = targetCanvas;
      getState = stateGetter;
      running = true;
      session++;
      dirty = true;
      idle = { frames: {}, dy: {} };
      expr = null;
      schedule(performance.now());
      requestAnimationFrame(makeTick(session));
    },
    detach: function () { running = false; },
    // A UI chama após qualquer mudança de estado
    redraw: function () { dirty = true; },
    // Expressão temporária no palco do criador (presets do Expressions)
    playExpression: function (name, ms) {
      var ov = Expressions.overridesFor(name);
      if (!ov) return;
      expr = ov;
      dirty = true;
      clearTimeout(this._exprTimer);
      this._exprTimer = setTimeout(function () {
        expr = null;
        dirty = true;
      }, ms || 1800);
    },

    // Reações do mascote: vibração + balão de fala curto
    playReaction: function (name, text) {
      var wrap = document.getElementById("avatarWrap");
      var bubble = document.getElementById("speechBubble");
      if (wrap) {
        wrap.classList.remove("react-shake");
        void wrap.offsetWidth;          // reinicia a animação CSS
        wrap.classList.add("react-shake");
      }
      if (text && bubble) {
        bubble.textContent = text;
        bubble.classList.remove("hidden");
        clearTimeout(this._bubbleTimer);
        this._bubbleTimer = setTimeout(function () { bubble.classList.add("hidden"); }, 2200);
      }
    }
  };
})();
