/* ============================================================
   RatRun — Utilidades compartilhadas
   Parsing de dinheiro em formato brasileiro e escape de HTML.
   ============================================================ */

window.Util = (function () {

  // Converte o que o usuário digitou em número.
  // Aceita "1.234,56", "1234,56", "1234.56" e "1234".
  // Regra: se tem vírgula, ela é o separador decimal e os pontos são
  // de milhar. Sem vírgula, o ponto é tratado como decimal.
  function parseMoney(str) {
    if (typeof str === "number") return str;
    var s = String(str == null ? "" : str).trim();
    if (!s) return 0;
    s = s.replace(/[^\d.,-]/g, "");
    if (s.indexOf(",") !== -1) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // Valor pronto para preencher um input (sem símbolo, vírgula decimal).
  // 0 vira "" para o campo mostrar o placeholder.
  function moneyInputValue(n) {
    if (!n) return "";
    return Number(n).toFixed(2).replace(".", ",");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  return { parseMoney: parseMoney, moneyInputValue: moneyInputValue, esc: esc };
})();
