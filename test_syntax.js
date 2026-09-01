
document.addEventListener("DOMContentLoaded", function() {
  const scanBtn = document.getElementById("scan-camera-btn");
  const metaSearchBtn = document.getElementById("meta-search-btn");
  const scannerDrawer = document.getElementById("scanner-drawer");
  const scannerOverlay = document.getElementById("scanner-drawer-overlay");
  const cancelScannerBtn = document.getElementById("cancel-scanner-btn");
  const closeScannerBtn = document.getElementById("close-scanner-btn");
  const videoElem = document.getElementById("scanner-video");
  const statusElem = document.getElementById("scanner-status");
  const hintElem = document.getElementById("isbn-hint");

  let codeReader;

  if (scannerOverlay && scannerOverlay.parentNode !== document.body) {
    document.body.appendChild(scannerOverlay);
    document.body.appendChild(scannerDrawer);
  }

  const tipoMaterialSelect = document.getElementById("tipo_material");
  const isbnContainer = document.getElementById("isbn-container");
  const doiContainer = document.getElementById("doi-container");

  function toggleMetaFields() {
    if(!tipoMaterialSelect) return;
    const val = tipoMaterialSelect.value;
    if(val === 'Libro' || val === 'Audiolibro') {
      if(isbnContainer) isbnContainer.style.display = 'block';
      if(doiContainer) doiContainer.style.display = 'none';
    } else if(val === 'Artículo') {
      if(isbnContainer) isbnContainer.style.display = 'none';
      if(doiContainer) doiContainer.style.display = 'block';
    } else {
      if(isbnContainer) isbnContainer.style.display = 'block';
      if(doiContainer) doiContainer.style.display = 'block';
    }
  }

  if(tipoMaterialSelect) {
    tipoMaterialSelect.addEventListener("change", toggleMetaFields);
    toggleMetaFields(); // init
  }

  const closeScanner = () => {
    if(scannerDrawer) {
      scannerDrawer.style.right = "-100%";
      setTimeout(() => scannerDrawer.style.display = "none", 300);
    }
    if(scannerOverlay) scannerOverlay.style.display = "none";
    if(codeReader) codeReader.reset();
    if (videoElem && videoElem.srcObject) {
      videoElem.srcObject.getTracks().forEach(track => track.stop());
      videoElem.srcObject = null;
    }
  };

  if (closeScannerBtn) closeScannerBtn.addEventListener("click", closeScanner);
  if (cancelScannerBtn) cancelScannerBtn.addEventListener("click", closeScanner);
  if (scannerOverlay) scannerOverlay.addEventListener("click", closeScanner);

  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (err) {
        console.error("User denied camera permission or error:", err);
        alert("Debes conceder permisos de cámara para poder escanear.");
        return;
      }

      if(scannerDrawer) { 
        scannerDrawer.style.display = "flex"; 
        setTimeout(() => scannerDrawer.style.right = "0", 10); 
      }
      if(scannerOverlay) scannerOverlay.style.display = "block";
      statusElem.textContent = "Iniciando cámara...";
      
      try {
        codeReader = new ZXingBrowser.BrowserMultiFormatReader();
        const videoInputDevices = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          statusElem.textContent = "No se encontraron cámaras";
          return;
        }
        
        const deviceId = videoInputDevices[0].deviceId; 
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        statusElem.textContent = "Buscando identificador...";
        codeReader.decodeFromVideoDevice(deviceId, videoElem, (result, err) => {
          if (result) {
            closeScanner();
            processScannedCode(result.text);
          }
        });
      } catch (err) {
        console.error(err);
        statusElem.textContent = "Error al acceder a la cámara";
      }
    });
  }

  if (metaSearchBtn) {
    metaSearchBtn.addEventListener("click", () => {
      const isbn = document.getElementById("isbn-input").value.trim();
      const doi = document.getElementById("doi-input").value.trim();
      if (!isbn && !doi) {
        hintElem.textContent = "Ingresa un ISBN o DOI primero.";
        hintElem.style.color = "red";
        return;
      }
      if (isbn) fetchMetadata("isbn", isbn);
      else if (doi) fetchMetadata("doi", doi);
    });
  }

  function processScannedCode(code) {
    if (code.startsWith("978") || code.startsWith("979") || (!isNaN(code) && code.length >= 10)) {
      document.getElementById("isbn-input").value = code;
      fetchMetadata("isbn", code);
    } else if (code.includes("10.") && code.includes("/")) {
      let doiMatch = code.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (doiMatch) {
        document.getElementById("doi-input").value = doiMatch[0];
        fetchMetadata("doi", doiMatch[0]);
      } else {
        hintElem.textContent = "Código QR no parece contener un DOI.";
        hintElem.style.color = "orange";
      }
    } else {
      hintElem.textContent = "Código no reconocido: " + code;
      hintElem.style.color = "orange";
    }
  }

  async function fetchMetadata(type, value) {
    hintElem.textContent = "Buscando metadatos...";
    hintElem.style.color = "#146c5f";
    
    try {
      if (type === "isbn") {
        let res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${value}&format=json&jscmd=data`);
        let data = await res.json();
        let bookInfo = data[`ISBN:${value}`];
        
        if (bookInfo) {
          fillForm(
            bookInfo.title, 
            bookInfo.authors?.[0]?.name, 
            bookInfo.publishers?.[0]?.name, 
            bookInfo.publish_date,
            bookInfo.number_of_pages
          );
          hintElem.textContent = "Metadatos obtenidos de Open Library.";
          return;
        }
        
        res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${value}`);
        data = await res.json();
        if (data.items && data.items.length > 0) {
          const vol = data.items[0].volumeInfo;
          fillForm(
            vol.title, 
            vol.authors?.[0], 
            vol.publisher, 
            vol.publishedDate,
            vol.pageCount
          );
          hintElem.textContent = "Metadatos obtenidos de Google Books.";
          return;
        }
        
        hintElem.textContent = "No se encontraron metadatos para este ISBN.";
        hintElem.style.color = "orange";
      } 
      else if (type === "doi") {
        let res = await fetch(`https://api.crossref.org/works/${value}`);
        if (!res.ok) throw new Error("DOI not found");
        let data = await res.json();
        let item = data.message;
        
        let title = item.title?.[0] || "";
        let author = item.author?.[0] ? `${item.author[0].given} ${item.author[0].family}` : "";
        let publisher = item.publisher || "";
        let year = item.created?.["date-parts"]?.[0]?.[0] || "";
        
        fillForm(title, author, publisher, year, null);
        hintElem.textContent = "Metadatos obtenidos de Crossref.";
      }
    } catch (e) {
      console.error(e);
      hintElem.textContent = "Error consultando metadatos.";
      hintElem.style.color = "red";
    }
  }

  function fillForm(title, author, publisher, year, pages) {
    if(title) {
      let el = document.getElementById("titulo");
      if(el) el.value = title;
    }
    if(author) {
      let el = document.getElementById("autor");
      if(el) el.value = author;
    }
    if(publisher) {
      let el = document.querySelector('input[name="editorial"]');
      if(el) el.value = publisher;
    }
    if(year) {
      let el = document.querySelector('input[name="fecha_publicacion"]');
      if(el) {
        let y = year.toString().substring(0,4);
        if(y.length === 4 && !isNaN(y)) el.value = y + "-01-01";
      }
    }
    if(pages) {
      let el = document.querySelector('input[name="cantidad_paginas"]');
      if(el) el.value = pages;
    }
  }
});


