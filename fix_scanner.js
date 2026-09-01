const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

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

// Fix meta-row ID
content = content.replace(/<div class="af-card">\s*<p class="af-card__label">Identificador Bibliogr.fico/s, '<div class="af-card" id="meta-row">\n        <p class="af-card__label">Identificador Bibliogr\u00E1fico');

// Fix ISBN and DOI containers
content = content.replace(/<label class="af-label">\s*<span><svg[^>]+>.*?<\/svg>\s*ISBN<\/span>/s, '<label class="af-label" id="isbn-container"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> ISBN</span>');
content = content.replace(/<label class="af-label">\s*<span><svg[^>]+>.*?<\/svg>\s*DOI<\/span>/s, '<label class="af-label" id="doi-container"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"></path></svg> DOI</span>');

fs.writeFileSync(file, content, 'utf8');
console.log("Applied scanner and ID fixes");
