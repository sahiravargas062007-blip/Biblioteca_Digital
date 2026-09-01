document.addEventListener("DOMContentLoaded", async function() {
  const epubUrl = document.getElementById("epub-visor").dataset.url;
  const recursoId = document.getElementById("epub-visor").dataset.recurso;
  
  if (!epubUrl || !recursoId) return;

  var book = ePub(epubUrl);
  var rendition = book.renderTo("epub-visor", { width: "100%", height: 650, spread: "none" });
  rendition.display();

  document.getElementById("prev-btn").addEventListener("click", function() { rendition.prev(); });
  document.getElementById("next-btn").addEventListener("click", function() { rendition.next(); });
  document.addEventListener("keyup", function(e) {
    if (e.key === "ArrowRight") rendition.next();
    if (e.key === "ArrowLeft")  rendition.prev();
  });

  // Floating menu UI
  const floatMenu = document.createElement("div");
  floatMenu.id = "epub-float-menu";
  floatMenu.style.position = "absolute";
  floatMenu.style.display = "none";
  floatMenu.style.zIndex = 1000;
  floatMenu.style.background = "#fff";
  floatMenu.style.border = "1px solid #ccc";
  floatMenu.style.borderRadius = "4px";
  floatMenu.style.padding = "5px";
  floatMenu.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  
  floatMenu.innerHTML = 
    <button data-action="highlight" style="background:#ffeb3b; border:none; padding:5px 10px; cursor:pointer; margin-right:5px;">Resaltar</button>
    <button data-action="underline" style="border:none; text-decoration:underline; padding:5px 10px; cursor:pointer; margin-right:5px; background:#e0e0e0;">Subrayar</button>
    <button data-action="note" style="border:none; padding:5px 10px; cursor:pointer; margin-right:5px; background:#bbdefb;">Nota</button>
    <button data-action="read" style="border:none; padding:5px 10px; cursor:pointer; background:#c8e6c9;">Leer</button>
  ;
  document.body.appendChild(floatMenu);

  let currentSelection = null;
  let currentCfiRange = null;

  rendition.on("selected", function(cfiRange, contents) {
    currentCfiRange = cfiRange;
    book.getRange(cfiRange).then(function(range) {
      if (range) {
        currentSelection = range.toString();
        
        // Show menu near selection
        const rect = range.getBoundingClientRect();
        // Adjust for iframe offset
        const iframe = document.querySelector("#epub-visor iframe");
        const iframeRect = iframe.getBoundingClientRect();
        
        floatMenu.style.top = (iframeRect.top + rect.bottom + window.scrollY + 10) + "px";
        floatMenu.style.left = (iframeRect.left + rect.left + window.scrollX) + "px";
        floatMenu.style.display = "block";
      }
    });
  });

  // Hide menu when clicking elsewhere
  rendition.on("click", () => { floatMenu.style.display = "none"; });
  document.addEventListener("click", (e) => {
    if(!floatMenu.contains(e.target)) floatMenu.style.display = "none";
  });

  // Load existing annotations
  async function loadAnnotations() {
    try {
      const res = await fetch('/user/anotaciones/' + recursoId);
      const json = await res.json();
      if (json.success && json.data) {
        json.data.forEach(a => {
          if (a.tipo === 'highlight') {
            rendition.annotations.highlight(a.cfi, {}, (e) => console.log('Click on highlight', a));
          } else if (a.tipo === 'underline') {
            rendition.annotations.underline(a.cfi, {}, (e) => console.log('Click on underline', a));
          }
        });
      }
    } catch(e) { console.error('Error load annotations', e); }
  }

  rendition.on("rendered", () => { loadAnnotations(); });

  // Handle menu actions
  floatMenu.addEventListener("click", async (e) => {
    if (e.target.tagName !== "BUTTON") return;
    const action = e.target.dataset.action;
    floatMenu.style.display = "none";

    if (!currentCfiRange || !currentSelection) return;

    if (action === 'read') {
      const utterance = new SpeechSynthesisUtterance(currentSelection);
      utterance.lang = 'es-ES';
      speechSynthesis.speak(utterance);
      return;
    }

    let textoNota = '';
    if (action === 'note') {
      textoNota = await new Promise(resolve => {
      // Show sliding panel
      let panel = document.getElementById("nota-sliding-panel");
      if(!panel) {
        panel = document.createElement("div");
        panel.id = "nota-sliding-panel";
        panel.style.position = "fixed";
        panel.style.right = "-300px";
        panel.style.top = "0";
        panel.style.width = "300px";
        panel.style.height = "100%";
        panel.style.background = "#fff";
        panel.style.boxShadow = "-2px 0 5px rgba(0,0,0,0.2)";
        panel.style.transition = "right 0.3s";
        panel.style.zIndex = "2000";
        panel.style.padding = "20px";
        panel.innerHTML = `
          <h3>Agregar Nota</h3>
          <textarea id="nota-text" style="width:100%;height:150px;margin-bottom:10px;"></textarea>
          <button id="btn-save-nota" class="btn btn-primary">Guardar</button>
          <button id="btn-cancel-nota" class="btn btn-secondary">Cancelar</button>
        `;
        document.body.appendChild(panel);
      }
      panel.style.right = "0";
      
      const saveBtn = document.getElementById("btn-save-nota");
      const cancelBtn = document.getElementById("btn-cancel-nota");
      const txtArea = document.getElementById("nota-text");
      txtArea.value = "";
      txtArea.focus();
      
      const closePanel = (val) => {
        panel.style.right = "-300px";
        saveBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(val);
      };
      
      saveBtn.onclick = () => closePanel(txtArea.value);
      cancelBtn.onclick = () => closePanel(null);
    });
      if (textoNota === null) return;
    }

    try {
      const res = await fetch('/user/anotaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurso_id: recursoId,
          tipo: action,
          texto: action === 'note' ? textoNota : currentSelection,
          cfi: currentCfiRange
        })
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'highlight') rendition.annotations.highlight(currentCfiRange);
        if (action === 'underline') rendition.annotations.underline(currentCfiRange);
        if (action === 'note') rendition.annotations.mark(currentCfiRange); // basic mark
      }
    } catch(e) { console.error('Save error', e); }
  });

});

