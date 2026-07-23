/* ============================================================
   Mercator — Manifesto do avatar (pack New_Avatar, pixel-art 65x65)

   ===== COMO ADICIONAR UMA VARIANTE NOVA =====
   1. Salve o PNG 65x65 na pasta da categoria, seguindo a numeração:
        New_Avatar/HAIR/HAIR_02.png
      O desenho tem que estar ALINHADO com os demais assets (mesma
      cabeça de referência) — a composição é empilhamento direto.
   2. Acrescente UMA linha aqui embaixo, no bloco da categoria:
        A.register({ id: "hair_02", category: "hair",
                     name: "Curto", src: DIR + "HAIR/HAIR_02.png" });
   3. Registre o arquivo em sw.js (lista ASSETS) p/ funcionar offline.
   Pronto — o item aparece no criador, entra no sorteio e pode ser
   vendido na loja (price) ou travado por nível (unlockedBy).

   ===== TRAVAR UM ITEM (loja / progressão) =====
     locked: true, price: 40                      → custa 40 gemas
     locked: true, unlockedBy: { type: "level", value: 5 }  → nível 5

   ===== FRAMES DE ANIMAÇÃO (opcional) =====
   Olhos com frame "closed" → o mascote pisca com o SEU desenho.
   Boca com frame "smile"   → o mascote sorri sozinho e nas reações.
     frames: { closed: DIR + "EYES/EYES_01_CLOSED.png" }
   Sem esses arquivos o app não quebra: o piscar usa um fallback
   sintetizado (achata a camada dos olhos) e o sorriso fica inativo.
   ============================================================ */

(function () {

  var A = window.AvatarCatalog;
  var DIR = "New_Avatar/";

  // ===== Pele (camada base — cabeça, pescoço e ombros) =====
  A.register({ id: "skin_01", category: "skin", name: "Clara",
               src: DIR + "SKIN/SKIN_01.png" });

  // ===== Cabelo =====
  A.register({ id: "hair_01", category: "hair", name: "Bagunçado",
               src: DIR + "HAIR/HAIR_01.png" });

  // ===== Olhos =====
  // Para o piscar usar arte de verdade, crie EYES_01_CLOSED.png e
  // descomente a linha de frames:
  A.register({ id: "eyes_01", category: "eyes", name: "Padrão",
               src: DIR + "EYES/EYES_01.png"
               /* , frames: { closed: DIR + "EYES/EYES_01_CLOSED.png" } */ });

  // ===== Sobrancelhas ===== (arquivo do pack: EYEBROWN_01.png)
  A.register({ id: "eyebrows_01", category: "eyebrows", name: "Reta",
               src: DIR + "EYEBROWS/EYEBROWN_01.png" });

  // ===== Nariz =====
  A.register({ id: "nose_01", category: "nose", name: "Padrão",
               src: DIR + "NOSE/NOSE_01.png" });

  // ===== Boca =====
  // Crie MOUTH_01_SMILE.png p/ reativar o sorriso ocasional do mascote:
  A.register({ id: "mouth_01", category: "mouth", name: "Neutra",
               src: DIR + "MOUTH/MOUTH_01.png"
               /* , frames: { smile: DIR + "MOUTH/MOUTH_01_SMILE.png" } */ });

  // ===== Roupa =====
  A.register({ id: "cloth_01", category: "cloth", name: "Moletom",
               src: DIR + "CLOTH/CLOTH_01.png" });

})();
