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
    editando = null;
    box.innerHTML = "";

    if (!m.fixas.length) {
      box.innerHTML = '<div class="empty-hint">Nenhuma despesa fixa neste mês ainda.</div>';
    } else {
      m.fixas.forEach(function (f) { box.appendChild(rowView(key, f)); });
    }
    renderTotals(key);
  }

  function renderTotals(key) {
    var m = Finance.getMonth(key);
    var t = Finance.totals(key);
    $("fxTotal").textContent = Finance.fmt(t.fixasTotal);
    // Dizer quantas são responde de cara "cadastrei mais que isso?"
    // quando a lista é longa e só parte dela cabe na tela.
    $("fxCount").textContent = m.fixas.length || "";
    $("fxTotalLabel").textContent = m.fixas.length
      ? "Total de " + m.fixas.length + (m.fixas.length === 1 ? " despesa fixa" : " despesas fixas")
      : "Total de despesas fixas";
  }

  // ===== Editar uma despesa já cadastrada =====
  // Uma fixa se repete todo mês, mas o nome sai errado e o valor muda
  // (a luz de agosto não é a de setembro). Sem isto, corrigir exigia
  // apagar e cadastrar de novo. Só o mês aberto é afetado.

  var editando = null;    // { row, f, key } da linha em edição

  function troca(antiga, nova) {
    if (antiga && antiga.parentNode) antiga.parentNode.replaceChild(nova, antiga);
  }

  // Fecha a edição aberta sem salvar (uma de cada vez, para não deixar
  // meia dúzia de linhas abertas e o usuário perdido)
  function fecharEdicao() {
    if (!editando) return;
    var e = editando;
    editando = null;
    troca(e.row, rowView(e.key, e.f));
  }

  function rowView(key, f) {
    var row = document.createElement("div");
    row.className = "row-item row-editable";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", "Editar " + f.nome);

    var main = document.createElement("div");
    main.className = "row-main";
    var nome = document.createElement("strong");
    nome.textContent = f.nome;
    main.appendChild(nome);

    var val = document.createElement("span");
    val.className = "row-value";
    val.textContent = Finance.fmt(f.valor);

    var del = document.createElement("button");
    del.className = "row-del"; del.textContent = "×"; del.title = "Excluir";
    del.onclick = function (ev) {
      ev.stopPropagation();          // o × exclui, não abre a edição
      Finance.removeFixa(key, f.id);
      renderList(key);
    };

    row.appendChild(main);
    row.appendChild(val);
    row.appendChild(del);

    row.onclick = function () { abrirEdicao(key, f, row); };
    row.onkeydown = function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrirEdicao(key, f, row); }
    };
    return row;
  }

  function abrirEdicao(key, f, row) {
    fecharEdicao();
    var editor = rowEdit(key, f);
    troca(row, editor.row);
    editando = { row: editor.row, f: f, key: key };
    editor.focar();
  }

  function rowEdit(key, f) {
    var row = document.createElement("div");
    row.className = "row-item row-editing";

    var nome = document.createElement("input");
    nome.className = "edit-name";
    nome.maxLength = 40;
    nome.value = f.nome;
    nome.placeholder = "Nome da despesa";
    nome.setAttribute("aria-label", "Nome da despesa");

    var money = document.createElement("div");
    money.className = "entry-money";
    var prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.textContent = "R$";
    var valor = document.createElement("input");
    valor.className = "edit-value";
    valor.setAttribute("inputmode", "decimal");
    valor.setAttribute("aria-label", "Valor da despesa");
    valor.placeholder = "0,00";
    valor.value = Util.moneyInputValue(f.valor);
    money.appendChild(prefix);
    money.appendChild(valor);

    var acoes = document.createElement("div");
    acoes.className = "edit-actions";
    var cancelar = document.createElement("button");
    cancelar.className = "btn-ghost";
    cancelar.textContent = "Cancelar";
    cancelar.onclick = function () { fecharEdicao(); };
    var salvar = document.createElement("button");
    salvar.className = "btn-primary small";
    salvar.textContent = "Salvar";
    salvar.onclick = function () { gravar(); };
    acoes.appendChild(cancelar);
    acoes.appendChild(salvar);

    function gravar() {
      var novoNome = nome.value.trim();
      var novoValor = Util.parseMoney(valor.value);
      if (!novoNome) { Toast.show("Dê um nome à despesa.", "warn"); nome.focus(); return; }
      if (novoValor <= 0) { Toast.show("Informe um valor.", "warn"); valor.focus(); return; }

      Finance.updateFixa(key, f.id, { nome: novoNome, valor: novoValor });
      var atualizada = { id: f.id, nome: novoNome, valor: novoValor };
      editando = null;
      troca(row, rowView(key, atualizada));
      renderTotals(key);
      Toast.show("Despesa atualizada.", "ok");
    }

    function tecla(ev) {
      if (ev.key === "Enter") { ev.preventDefault(); gravar(); }
      else if (ev.key === "Escape") { ev.preventDefault(); fecharEdicao(); }
    }
    nome.addEventListener("keydown", tecla);
    valor.addEventListener("keydown", tecla);

    row.appendChild(nome);
    row.appendChild(money);
    row.appendChild(acoes);

    return {
      row: row,
      focar: function () { nome.focus(); nome.select(); }
    };
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

  // Uma linha por despesa: marcar, nome e valor lado a lado. Com dez,
  // quinze fixas, empilhar em duas linhas fazia caber só três na tela
  // e dava a impressão de que faltavam itens.
  function copyRow(f, duplicada) {
    var row = document.createElement("div");
    row.className = "copy-item";

    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "copy-check";
    chk.checked = !duplicada;
    chk.setAttribute("aria-label", "Copiar " + f.nome);
    chk.onchange = function () {
      row.classList.toggle("off", !chk.checked);
      updateCopyTotal();
    };

    var nome = document.createElement("input");
    nome.className = "copy-name";
    nome.maxLength = 40;
    nome.value = f.nome;
    nome.title = f.nome;
    nome.placeholder = "Nome da despesa";

    var money = document.createElement("div");
    money.className = "entry-money";
    var prefix = document.createElement("span");
    prefix.className = "prefix";
    prefix.textContent = "R$";
    var valor = document.createElement("input");
    valor.className = "copy-value";
    valor.setAttribute("inputmode", "decimal");
    valor.setAttribute("aria-label", "Valor de " + f.nome);
    valor.placeholder = "0,00";
    valor.value = Util.moneyInputValue(f.valor);
    valor.oninput = updateCopyTotal;
    money.appendChild(prefix);
    money.appendChild(valor);

    row.appendChild(chk);
    row.appendChild(nome);
    if (duplicada) {
      var tag = document.createElement("span");
      tag.className = "copy-dup";
      tag.textContent = "já existe";
      row.appendChild(tag);
      row.classList.add("off");
    }
    row.appendChild(money);
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
    var marcadas = readCopyItems(true);
    var todas = readCopyItems(false);
    var total = marcadas.reduce(function (s, it) { return s + it.valor; }, 0);
    $("fxCopyTotal").textContent = Finance.fmt(total);
    $("fxCopyOk").textContent = marcadas.length
      ? "Copiar " + marcadas.length + (marcadas.length === 1 ? " despesa" : " despesas")
      : "Copiar";
    $("fxCopyToggleAll").textContent =
      marcadas.length === todas.length ? "Desmarcar todas" : "Marcar todas";
    // Diz quantas existem ao todo: com a lista rolando, o usuário
    // precisa saber que há mais abaixo do que a tela mostra.
    $("fxCopyCount").textContent = marcadas.length + " de " + todas.length +
      (todas.length === 1 ? " marcada" : " marcadas");
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
