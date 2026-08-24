/* ============================================================
   RatRun — Aba Despesas fixas
   Lista nome + valor, total automático, e um atalho para copiar as
   fixas do mês anterior (aluguel, internet e afins se repetem).

   A cópia passa por uma revisão: uma despesa fixa se repete todo mês,
   mas nem sempre pelo mesmo valor (a conta de luz de agosto não é a
   de setembro). Antes de confirmar dá para escolher quais copiar e
   corrigir nome e valor. O mês de origem nunca é tocado: cada item
   confirmado vira uma despesa nova e independente no mês de destino.
   ============================================================ */

window.UIFixed = (function () {

  function $(id) { return document.getElementById(id); }
  var wired = false;

  function render() {
    var key = Finance.currentKey();
    $("fxMonth").textContent = Finance.label(key);
    renderList(key);
    if (!wired) { wire(); wired = true; }
  }

  function renderList(key) {
    var m = Finance.getMonth(key);
    var box = $("fxList");
    box.innerHTML = "";

    if (!m.fixas.length) {
      box.innerHTML = '<div class="empty-hint">Nenhuma despesa fixa neste mês ainda.</div>';
    } else {
      m.fixas.forEach(function (f) {
        var row = document.createElement("div");
        row.className = "row-item";
        row.innerHTML =
          '<div class="row-main"><strong>' + Util.esc(f.nome) + '</strong></div>' +
          '<span class="row-value">' + Finance.fmt(f.valor) + '</span>';
        var del = document.createElement("button");
        del.className = "row-del"; del.textContent = "×"; del.title = "Excluir";
        del.onclick = function () { Finance.removeFixa(key, f.id); renderList(key); };
        row.appendChild(del);
        box.appendChild(row);
      });
    }

    var t = Finance.totals(key);
    $("fxTotal").textContent = Finance.fmt(t.fixasTotal);
  }

  function add() {
    var key = Finance.currentKey();
    var nome = $("fxName").value.trim();
    var valor = Util.parseMoney($("fxValue").value);
    if (!nome) { Toast.show("Dê um nome à despesa.", "warn"); $("fxName").focus(); return; }
    if (valor <= 0) { Toast.show("Informe um valor.", "warn"); $("fxValue").focus(); return; }
    Finance.addFixa(key, nome, valor);
    $("fxName").value = ""; $("fxValue").value = "";
    $("fxName").focus();
    renderList(key);
  }

  // ===== Cópia revisada do mês anterior =====

  var copyKey = null;     // mês de destino da cópia em andamento

  function norm(s) { return String(s || "").trim().toLowerCase(); }

  function openCopy() {
    var key = Finance.currentKey();
    var origem = Finance.prev(key);
    var fixas = Finance.getMonth(origem).fixas;

    if (!fixas.length) {
      Toast.show("O mês anterior não tem fixas para copiar.", "warn");
      return;
    }

    copyKey = key;
    $("fxCopyFrom").textContent = Finance.label(origem);
    $("fxCopyTo").textContent = Finance.label(key);

    // Já existe no destino? Vem desmarcada, para não duplicar sem querer.
    var jaTem = {};
    Finance.getMonth(key).fixas.forEach(function (f) { jaTem[norm(f.nome)] = true; });

    var box = $("fxCopyList");
    box.innerHTML = "";
    fixas.forEach(function (f) {
      box.appendChild(copyRow(f, !!jaTem[norm(f.nome)]));
    });

    updateCopyTotal();
    $("fxCopyOverlay").classList.remove("hidden");
  }

  function copyRow(f, duplicada) {
    var row = document.createElement("div");
    row.className = "copy-item";

    var head = document.createElement("label");
    head.className = "copy-head";

    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "copy-check";
    chk.checked = !duplicada;
    chk.onchange = function () {
      row.classList.toggle("off", !chk.checked);
      updateCopyTotal();
    };

    var nome = document.createElement("input");
    nome.className = "copy-name";
    nome.maxLength = 40;
    nome.value = f.nome;
    nome.placeholder = "Nome da despesa";

    head.appendChild(chk);
    head.appendChild(nome);

    var money = document.createElement("div");
    money.className = "entry-money";
    var prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.textContent = "R$";
    var valor = document.createElement("input");
    valor.className = "copy-value";
    valor.setAttribute("inputmode", "decimal");
    valor.placeholder = "0,00";
    valor.value = Util.moneyInputValue(f.valor);
    valor.oninput = updateCopyTotal;
    money.appendChild(prefix);
    money.appendChild(valor);

    var line = document.createElement("div");
    line.className = "copy-line";
    line.appendChild(money);
    if (duplicada) {
      var tag = document.createElement("span");
      tag.className = "copy-dup";
      tag.textContent = "já existe";
      line.appendChild(tag);
    }

    row.appendChild(head);
    row.appendChild(line);
    if (duplicada) row.classList.add("off");
    return row;
  }

  // Lê o que está na tela agora (o usuário pode ter editado tudo)
  function readCopyItems(onlyChecked) {
    var out = [];
    var rows = $("fxCopyList").querySelectorAll(".copy-item");
    Array.prototype.forEach.call(rows, function (row) {
      var chk = row.querySelector(".copy-check");
      if (onlyChecked && !chk.checked) return;
      out.push({
        marcada: chk.checked,
        nome: row.querySelector(".copy-name").value.trim(),
        valor: Util.parseMoney(row.querySelector(".copy-value").value)
      });
    });
    return out;
  }

  function updateCopyTotal() {
    var itens = readCopyItems(true);
    var total = itens.reduce(function (s, it) { return s + it.valor; }, 0);
    $("fxCopyTotal").textContent = Finance.fmt(total);
    $("fxCopyOk").textContent = itens.length
      ? "Copiar " + itens.length + (itens.length === 1 ? " despesa" : " despesas")
      : "Copiar";
    $("fxCopyToggleAll").textContent =
      itens.length === readCopyItems(false).length ? "Desmarcar todas" : "Marcar todas";
  }

  function closeCopy() {
    $("fxCopyOverlay").classList.add("hidden");
    $("fxCopyList").innerHTML = "";
    copyKey = null;
  }

  function confirmCopy() {
    var itens = readCopyItems(true);
    if (!itens.length) { Toast.show("Marque ao menos uma despesa.", "warn"); return; }
    if (itens.some(function (it) { return !it.nome; })) {
      Toast.show("Toda despesa precisa de um nome.", "warn"); return;
    }
    if (itens.some(function (it) { return it.valor <= 0; })) {
      Toast.show("Informe um valor para cada despesa marcada.", "warn"); return;
    }

    var key = copyKey || Finance.currentKey();
    var n = Finance.addFixasBulk(key, itens);
    closeCopy();
    renderList(key);
    Toast.show(n + (n === 1 ? " despesa copiada" : " despesas copiadas") +
               " para " + Finance.label(key) + ".", "ok");
  }

  function wire() {
    $("fxPrev").onclick = function () { Finance.setCurrent(Finance.prev(Finance.currentKey())); render(); };
    $("fxNext").onclick = function () { Finance.setCurrent(Finance.next(Finance.currentKey())); render(); };
    $("fxMonth").onclick = function () { Finance.setCurrent(Finance.keyOf(new Date())); render(); };

    $("fxAdd").onclick = add;
    $("fxValue").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
    $("fxName").addEventListener("keydown", function (e) { if (e.key === "Enter") $("fxValue").focus(); });

    $("fxCopyPrev").onclick = openCopy;
    $("fxCopyCancel").onclick = closeCopy;
    $("fxCopyOk").onclick = confirmCopy;
    $("fxCopyToggleAll").onclick = function () {
      var rows = $("fxCopyList").querySelectorAll(".copy-item");
      var marcar = readCopyItems(true).length !== rows.length;
      Array.prototype.forEach.call(rows, function (row) {
        var chk = row.querySelector(".copy-check");
        chk.checked = marcar;
        row.classList.toggle("off", !marcar);
      });
      updateCopyTotal();
    };
    // Toque fora da caixa fecha sem copiar
    $("fxCopyOverlay").addEventListener("click", function (e) {
      if (e.target === $("fxCopyOverlay")) closeCopy();
    });
  }

  return { render: render };
})();
