const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

// 1. Swap Categorias / Subcategorias (Safely!)
const textCat = `<div>
            <label class="af-label">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                Categor\\u00EDa
              </span>
              <select name="categoria_id" id="categoria-select" required>
                <option value="">Seleccione</option>
                <% categorias.forEach(function(cat) { %>
                  <option value="<%= cat._id %>"
                    <%= String(firstCategoria?.categoria_id || '') === String(cat._id) ? 'selected' : '' %>>
                    <%= cat.nombre %>
                  </option>
                <% }); %>
              </select>
            </label>
            <label class="af-label" style="margin-top:14px">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Subcategor\\u00EDa
              </span>
              <select name="subcategoria_id" id="subcategoria-select">
                <option value="">Sin subcategor\\u00EDa</option>
              </select>
            </label>`;

// We will find the EXACT string block and replace it using indexOf to avoid regex disaster
const idx1 = content.indexOf('<div>\n          <label class="af-label">');
const idx2 = content.indexOf('</label>\n        </div>\n      </div>\n    </div>', idx1);

if (idx1 !== -1 && idx2 !== -1) {
    const toReplace = content.substring(idx1, idx2 + 8);
    // actually, let's just use string replace on the known block
    content = content.replace(/<div>\s*<label class="af-label">\s*<span>\s*<svg.*?Subcategor.*?<\/select>\s*<\/label>\s*<label class="af-label".*?Categor.*?<\/select>\s*<\/label>\s*<\/div>/s, textCat + "\n          </div>");
}

// If regex failed, let's just do a more robust string replacement
if (!content.includes('id="categoria-select" required>\n                <option value="">Seleccione</option>')) {
   // Wait, it is already swapped if I did it right before, but I ran git checkout!
   // So it's definitely in the original state.
   content = content.replace(/<div>\s*<label class="af-label">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Subcategor.a\s*<\/span>\s*<select name="subcategoria_id" id="subcategoria-select">\s*<option value="">Sin subcategor.a<\/option>\s*<\/select>\s*<\/label>\s*<label class="af-label" style="margin-top:14px">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Categor.a\s*<\/span>\s*<select name="categoria_id" id="categoria-select" required>.*?<\/select>\s*<\/label>\s*<\/div>/s, textCat + "\n          </div>");
}

// 2. Fix the ZXing scanner logic
const oldScannerScript = /try \{\s*codeReader = new ZXingBrowser\.BrowserMultiFormatReader\(\);.*?\} catch \(err\) \{\s*console\.error\(err\);\s*statusElem\.textContent = "Error al acceder a la c.mara";\s*\}/s;

const newScannerScript = `const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        function playBeep() {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'sine';
          oscillator.frequency.value = 800;
          gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.1);
        }

        try {
          codeReader = new ZXingBrowser.BrowserMultiFormatReader();
          const videoInputDevices = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
          if (videoInputDevices.length === 0) {
            statusElem.textContent = "No se encontraron c\\u00E1maras";
            return;
          }
          
          let selectedDevice = videoInputDevices[0].deviceId;
          for (const device of videoInputDevices) {
            const label = device.label.toLowerCase();
            if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('trasera')) {
              selectedDevice = device.deviceId;
              break;
            }
          }
          
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          
          statusElem.textContent = "Buscando identificador...";
          codeReader.decodeFromVideoDevice(selectedDevice, videoElem, (result, err) => {
            if (result) {
              playBeep();
              statusElem.textContent = "¡C\\u00F3digo detectado!";
              statusElem.style.color = "#28a745";
              document.getElementById('scanner-container').style.borderColor = "#28a745";
              setTimeout(() => {
                closeScanner();
                processScannedCode(result.text);
              }, 1000);
            }
          });
        } catch (err) {
          console.error(err);
          statusElem.textContent = "Error al acceder a la c\\u00E1mara";
        }`;

content = content.replace(oldScannerScript, newScannerScript);

// Fix the ID for meta-row dynamically if it was lost
content = content.replace(/<div class="af-card">\s*<p class="af-card__label">Identificador Bibliogr.fico/s, '<div class="af-card" id="meta-row">\n        <p class="af-card__label">Identificador Bibliogr\u00E1fico');

// Add ids to ISBN and DOI containers if they were lost
content = content.replace(/<label class="af-label">\s*<span><svg[^>]+>.*?<\/svg>\s*ISBN<\/span>/s, '<label class="af-label" id="isbn-container"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> ISBN</span>');
content = content.replace(/<label class="af-label">\s*<span><svg[^>]+>.*?<\/svg>\s*DOI<\/span>/s, '<label class="af-label" id="doi-container"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg> DOI</span>');


fs.writeFileSync(file, content, 'utf8');
console.log("Reapplied all fixes to nuevo.ejs securely");
