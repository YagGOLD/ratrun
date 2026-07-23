/* ============================================================
   RatRun — Contribuição opcional via PIX
   Exibida UMA vez no primeiro acesso (flag em localStorage) e
   acessível depois pelo link "Apoiar o projeto" na Home.
   Nunca bloqueia o uso: "Continuar sem contribuir" segue direto.
   ============================================================ */

window.Donation = (function () {

  var SEEN_KEY = "ratrun.donationSeen";

  // Dados do recebedor (QR em icons/pix-qr.png gerado destes dados)
  var PIX = {
    key:  "c3b9b636-c989-42e4-9b56-c75bcbd983c1",
    name: "YagGOD",
    city: "SAO PAULO"
  };

  function wasSeen() { return !!localStorage.getItem(SEEN_KEY); }
  function markSeen() { localStorage.setItem(SEEN_KEY, "1"); }

  function copyKey() {
    var done = function () { Toast.show("Chave PIX copiada!", "ok"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PIX.key).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var tmp = document.createElement("textarea");
      tmp.value = PIX.key;
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { Toast.show("Copie manualmente: " + PIX.key, "warn"); }
      tmp.remove();
    }
  }

  function open(onContinue) {
    document.getElementById("pixKeyText").textContent = PIX.key;
    document.getElementById("btnCopyPix").onclick = copyKey;
    document.getElementById("btnDonateContinue").onclick = function () {
      markSeen();
      onContinue();
    };
  }

  return { wasSeen: wasSeen, open: open };
})();
