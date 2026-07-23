/* ============================================================
   Mercator — Toasts (mensagens curtas do mascote/sistema)
   Regra da spec: curtas, positivas, nunca invasivas.
   ============================================================ */

window.Toast = (function () {

  function show(msg, kind) {
    var box = document.getElementById("toasts");
    if (!box) return;
    var t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 300);
    }, 2400);
  }

  return { show: show };
})();
