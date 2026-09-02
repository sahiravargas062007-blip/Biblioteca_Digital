document.addEventListener("DOMContentLoaded", async function() {
  const epubUrl = document.getElementById("epub-visor").dataset.url;
  const recursoId = document.getElementById("epub-visor").dataset.recurso;
  
  if (!epubUrl || !recursoId) return;

  const proxyUrl = `/catalogo/${recursoId}/descargar?visor=true`;
  document.getElementById("epub-visor").innerHTML = '<p style="padding:2rem;text-align:center;color:#888;">Descargando libro (puede tardar unos segundos)...</p>';

  var book, rendition;
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("No se pudo obtener el archivo del servidor.");
    const buffer = await response.arrayBuffer();
    
    document.getElementById("epub-visor").innerHTML = ''; 
    book = ePub(buffer);
    rendition = book.renderTo("epub-visor", { width: "100%", height: "100%", spread: "auto" });
    
    // Inyectar CSS dentro del ePub para márgenes y lectura cómoda
    rendition.themes.default({
      "body": { 
        "font-size": "1.15rem", 
        "line-height": "1.8 !important",
        "color": "#2c2c2c !important",
        "background": "transparent !important"
      },
      "p": {
        "margin-bottom": "1.2em !important"
      }
    });

    await rendition.display();
  } catch (err) {
    document.getElementById("epub-visor").innerHTML = '<p style="padding:2rem;text-align:center;color:red;">Error al cargar el libro: ' + (err.message || err) + '</p>';
    console.error("ePub load error:", err);
    return;
  }

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
  floatMenu.style.zIndex = "1000";
  floatMenu.style.background = "#fff";
  floatMenu.style.border = "none";
  floatMenu.style.borderRadius = "8px";
  floatMenu.style.padding = "10px";
  floatMenu.style.boxShadow = "0 4px 15px rgba(0,0,0,0.15)";
  floatMenu.style.gap = "10px";
  floatMenu.style.alignItems = "center";
  
  floatMenu.innerHTML = `
    <div style="display:flex; gap:8px; border-right:1px solid #eee; padding-right:10px;">
      <button data-action="highlight" data-color="rgba(255, 235, 59, 0.5)" style="background:#ffeb3b; width:22px; height:22px; border-radius:50%; border:none; cursor:pointer;" title="Amarillo"></button>
      <button data-action="highlight" data-color="rgba(76, 175, 80, 0.5)" style="background:#4caf50; width:22px; height:22px; border-radius:50%; border:none; cursor:pointer;" title="Verde"></button>
      <button data-action="highlight" data-color="rgba(33, 150, 243, 0.5)" style="background:#2196f3; width:22px; height:22px; border-radius:50%; border:none; cursor:pointer;" title="Azul"></button>
      <button data-action="highlight" data-color="rgba(206, 147, 216, 0.5)" style="background:#ce93d8; width:22px; height:22px; border-radius:50%; border:none; cursor:pointer;" title="Morado"></button>
      <button data-action="highlight" data-color="rgba(244, 143, 177, 0.5)" style="background:#f48fb1; width:22px; height:22px; border-radius:50%; border:none; cursor:pointer;" title="Rosa"></button>
    </div>
    <button data-action="note" style="border:none; background:none; font-weight:bold; color:#555; cursor:pointer; font-size:0.9rem;">📝 Nota</button>
    <button data-action="read" style="border:none; background:none; font-weight:bold; color:#555; cursor:pointer; font-size:0.9rem;">🔊 Leer</button>
  `;
  document.body.appendChild(floatMenu);

  let currentSelection = null;
  let currentCfiRange = null;

  rendition.on("selected", function(cfiRange, contents) {
    currentCfiRange = cfiRange;
    const selection = contents.window.getSelection();
    currentSelection = selection.toString().trim();
    
    if (selection.rangeCount > 0 && currentSelection.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframe = document.querySelector("#epub-visor iframe");
      const iframeRect = iframe.getBoundingClientRect();
      
      let topPos = iframeRect.top + rect.bottom + window.scrollY + 10;
      let leftPos = iframeRect.left + rect.left + window.scrollX;
      
      floatMenu.style.top = topPos + "px";
      floatMenu.style.left = leftPos + "px";
      
      setTimeout(() => {
        floatMenu.style.display = "flex";
      }, 50);
    }
  });

  rendition.on("click", () => { 
    if(floatMenu.style.display === "flex") {
      floatMenu.style.display = "none"; 
      try { rendition.getContents()[0].window.getSelection().removeAllRanges(); } catch(e){}
    }
  });
  
  document.addEventListener("click", (e) => {
    if(floatMenu.style.display === "flex" && !floatMenu.contains(e.target)) {
      floatMenu.style.display = "none";
    }
  });

  let userAnnotations = [];

  async function loadAnnotations() {
    try {
      const res = await fetch('/user/anotaciones/' + recursoId);
      const json = await res.json();
      if (json.success && json.data) {
        userAnnotations = json.data;
        applyVisibleAnnotations();
      }
    } catch(e) { console.error('Error load annotations', e); }
  }

  function applyVisibleAnnotations() {
    userAnnotations.forEach(a => {
      let color = a.color || 'rgba(255, 235, 59, 0.5)';
      try {
        if (a.tipo === 'highlight' || a.tipo === 'note') {
          rendition.annotations.highlight(a.cfi, {}, (e) => {}, "", { "fill": color, "fill-opacity": "0.4" });
        } else if (a.tipo === 'underline') {
          rendition.annotations.underline(a.cfi, {}, (e) => {});
        }
      } catch(e){}
    });
  }

  rendition.on("rendered", () => {
    applyVisibleAnnotations();
  });
  
  loadAnnotations();

  // Create Notes Panel
  let notesPanel = document.createElement("div");
  notesPanel.id = "notes-sliding-panel";
  notesPanel.style.position = "fixed";
  notesPanel.style.left = "-350px";
  notesPanel.style.top = "0";
  notesPanel.style.width = "350px";
  notesPanel.style.height = "100%";
  notesPanel.style.background = "#1e1e1e";
  notesPanel.style.color = "#eee";
  notesPanel.style.boxShadow = "2px 0 10px rgba(0,0,0,0.5)";
  notesPanel.style.transition = "left 0.3s";
  notesPanel.style.zIndex = "2000";
  notesPanel.style.padding = "20px";
  notesPanel.style.overflowY = "auto";
  notesPanel.style.display = "flex";
  notesPanel.style.flexDirection = "column";
  document.body.appendChild(notesPanel);

  function renderNotesList() {
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="margin:0; color:#fff;">Mis Notas</h3>
        <button id="btn-close-notes" style="background:none;border:none;font-size:2rem;cursor:pointer;color:#aaa;line-height:1;">&times;</button>
      </div>
      <div id="notes-list-container" style="display:flex; flex-direction:column; gap:10px;">
    `;
    const notes = userAnnotations.filter(a => a.tipo === 'note');
    if(notes.length === 0) {
      html += `<p style="color:#888; font-size:0.9rem;">No tienes notas guardadas.</p>`;
    } else {
      notes.forEach(n => {
        const dateStr = new Date(n.createdAt || Date.now()).toLocaleDateString();
        html += `
          <div class="note-item" data-cfi="${n.cfi}" style="background:#2d2d2d; border-radius:6px; padding:12px; cursor:pointer; border-left:4px solid #2196f3; transition:background 0.2s;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
              <span style="font-size:0.75rem; color:#888;">${dateStr}</span>
            </div>
            <p style="font-size:0.85rem; color:#bbb; font-style:italic; margin:0 0 8px 0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">"${n.texto_cita || 'Cita de texto'}"</p>
            <p style="font-size:0.95rem; color:#fff; margin:0;">${n.texto}</p>
          </div>
        `;
      });
    }
    html += `</div>`;
    notesPanel.innerHTML = html;
    
    document.getElementById("btn-close-notes").onclick = () => { notesPanel.style.left = "-350px"; };
    
    document.querySelectorAll(".note-item").forEach(item => {
      item.onclick = () => {
        rendition.display(item.dataset.cfi);
        notesPanel.style.left = "-350px";
      };
    });
  }

  function openNewNoteForm(selectedText, cfi) {
    let tpl = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="margin:0; color:#fff;">Nueva Nota</h3>
        <button id="btn-close-notes" style="background:none;border:none;font-size:2rem;cursor:pointer;color:#aaa;line-height:1;">&times;</button>
      </div>
      <div style="background:#2a2a2a; padding:10px; border-radius:6px; margin-bottom:15px; border-left:4px solid #2196f3;">
        <p style="font-size:0.85rem; color:#ccc; font-style:italic; margin:0; max-height:80px; overflow-y:auto;">"${selectedText}"</p>
      </div>
      <textarea id="new-note-text" placeholder="Escribe tu nota aquí..." style="width:100%; height:150px; background:#1e1e1e; color:#fff; border:1px solid #444; border-radius:4px; padding:10px; margin-bottom:15px; font-family:inherit; resize:none;"></textarea>
      <div style="display:flex; gap:10px;">
        <button id="btn-save-note" style="flex:1; padding:8px; background:#2196f3; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Guardar</button>
        <button id="btn-cancel-note" style="flex:1; padding:8px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancelar</button>
      </div>
    `;
    notesPanel.innerHTML = tpl;
    notesPanel.style.left = "0px";
    
    document.getElementById("btn-close-notes").onclick = () => { renderNotesList(); notesPanel.style.left = "-350px"; };
    document.getElementById("btn-cancel-note").onclick = () => { renderNotesList(); notesPanel.style.left = "-350px"; };
    
    document.getElementById("btn-save-note").onclick = async () => {
      const text = document.getElementById("new-note-text").value;
      if(!text.trim()) return;
      
      const payload = {
        recurso_id: recursoId,
        tipo: 'note',
        texto: text,
        texto_cita: selectedText,
        cfi: cfi,
        color: 'rgba(33, 150, 243, 0.5)'
      };
      
      try {
        const res = await fetch('/user/anotaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
          userAnnotations.push(data.data);
          try { rendition.annotations.highlight(cfi, {}, (e)=>{}, "", { "fill": 'rgba(33, 150, 243, 0.5)', "fill-opacity": "0.4" }); } catch(e){}
          renderNotesList();
        }
      } catch(e) { console.error('Save note error', e); }
    };
  }

  // Handle floating menu actions
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

    if (action === 'note') {
      openNewNoteForm(currentSelection, currentCfiRange);
      return;
    }

    if (action === 'highlight') {
      const color = e.target.dataset.color || 'rgba(255, 235, 59, 0.5)';
      const payload = {
        recurso_id: recursoId,
        tipo: 'highlight',
        texto: currentSelection,
        cfi: currentCfiRange,
        color: color
      };
      
      try {
        const res = await fetch('/user/anotaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
          userAnnotations.push(data.data);
          try { rendition.annotations.highlight(currentCfiRange, {}, (e)=>{}, "", { "fill": color, "fill-opacity": "0.4" }); } catch(e){}
        }
      } catch(e) { console.error('Save highlight error', e); }
    }
  });

  // Tamaño de fuente
  let fontSizes = ["1.15rem", "1.3rem", "1.5rem", "1.7rem"];
  let currentFontIdx = 0;
  const btnFont = document.getElementById("btn-epub-font");
  if(btnFont) {
    btnFont.addEventListener("click", () => {
      currentFontIdx = (currentFontIdx + 1) % fontSizes.length;
      rendition.themes.fontSize(fontSizes[currentFontIdx]);
    });
  }

  // Lectura en voz alta global
  const btnRead = document.getElementById("btn-epub-read");
  let isReading = false;
  if(btnRead) {
    btnRead.addEventListener("click", () => {
      if(isReading) {
        speechSynthesis.cancel();
        isReading = false;
        btnRead.style.color = "";
        return;
      }
      const contents = rendition.getContents();
      if(contents && contents.length > 0) {
        let text = contents[0].document.body.innerText;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.onend = () => { isReading = false; btnRead.style.color = ""; };
        speechSynthesis.speak(utterance);
        isReading = true;
        btnRead.style.color = "#4CAF50";
      }
    });
    
    // Detener audio al cambiar de página
    rendition.on("relocated", () => {
      if(isReading) { speechSynthesis.cancel(); isReading = false; btnRead.style.color = ""; }
    });
  }

  // Índice (TOC)
  const btnToc = document.getElementById("btn-epub-toc");
  if(btnToc) {
    btnToc.addEventListener("click", () => {
      book.loaded.navigation.then(nav => {
        let panel = document.getElementById("toc-sliding-panel");
        if(!panel) {
          panel = document.createElement("div");
          panel.id = "toc-sliding-panel";
          panel.style.position = "fixed";
          panel.style.left = "-300px";
          panel.style.top = "0";
          panel.style.width = "300px";
          panel.style.height = "100%";
          panel.style.background = "#fff";
          panel.style.boxShadow = "2px 0 5px rgba(0,0,0,0.2)";
          panel.style.transition = "left 0.3s";
          panel.style.zIndex = "2000";
          panel.style.padding = "20px";
          panel.style.overflowY = "auto";
          
          let ul = "<ul style='list-style:none; padding:0;'>";
          nav.forEach(item => {
            ul += `<li style='margin-bottom:10px;'><a href='#' class='toc-link' data-href='${item.href}' style='color:#333; text-decoration:none;'>${item.label}</a></li>`;
          });
          ul += "</ul>";
          
          panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
              <h3 style="margin:0; color:#333;">Índice</h3>
              <button id="btn-close-toc" style="background:none;border:none;font-size:2rem;cursor:pointer;color:#333;line-height:1;">&times;</button>
            </div>
            ${ul}
          `;
          document.body.appendChild(panel);
          
          document.getElementById("btn-close-toc").onclick = () => { panel.style.left = "-300px"; };
          document.querySelectorAll(".toc-link").forEach(link => {
            link.onclick = (e) => {
              e.preventDefault();
              rendition.display(e.target.dataset.href);
              panel.style.left = "-300px";
            };
          });

          // Cerrar al hacer clic fuera
          document.addEventListener("click", (e) => {
            if (panel.style.left === "0px" && !panel.contains(e.target) && !btnToc.contains(e.target)) {
              panel.style.left = "-300px";
            }
          });
        }
        
        if(panel.style.left === "0px") panel.style.left = "-300px";
        else panel.style.left = "0px";
      });
    });
  }

  // Notas Sidebar
  const btnNotes = document.getElementById("btn-epub-notes");
  if(btnNotes) {
    btnNotes.addEventListener("click", () => {
      if(notesPanel.style.left === "0px") {
        notesPanel.style.left = "-350px";
      } else {
        renderNotesList();
        notesPanel.style.left = "0px";
      }
    });
    
    // Cerrar al hacer clic fuera
    document.addEventListener("click", (e) => {
      if (notesPanel.style.left === "0px" && !notesPanel.contains(e.target) && !btnNotes.contains(e.target) && (!floatMenu || !floatMenu.contains(e.target))) {
        notesPanel.style.left = "-350px";
      }
    });
  }
});