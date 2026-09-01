const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\public\\js\\admin\\recursos.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Rewrite syncAutocompletarRow completely using indexOf bounds
const syncStart = content.indexOf('function syncAutocompletarRow() {');
const syncEnd = content.indexOf('function syncForm() {');

if (syncStart !== -1 && syncEnd !== -1) {
    const newSync = `function syncAutocompletarRow() {
    var row = document.getElementById('meta-row');
    if (!row) return;

    var content = val('tipo_contenido');
    var material = val('tipo_material');
    var isbnCont = document.getElementById('isbn-container');
    var doiCont = document.getElementById('doi-container');

    if (content === 'Lectura' && (material === 'Libro' || material === 'Art\\u00EDculo')) {
      row.style.display = '';
      if (isbnCont) isbnCont.style.display = (material === 'Libro') ? '' : 'none';
      if (doiCont) doiCont.style.display = (material === 'Art\\u00EDculo') ? '' : 'none';
    } else {
      row.style.display = 'none';
    }
  }

  `;
    content = content.substring(0, syncStart) + newSync + content.substring(syncEnd);
} else {
    console.log("Could not find syncAutocompletarRow bounds");
}

// 2. Remove the Audio hardcoding in syncForm
const audioBlockStart = content.indexOf('// ISBN: visible en Lectura y Audio');
const audioBlockEnd = content.indexOf('// P\\u00E1ginas est\\u00E1tico'); 
// wait, the file has UTF-8 characters corrupted by powershell or something?
// let's just use regex for the audio block in syncForm

content = content.replace(/\/\/ ISBN: visible en Lectura y Audio.*?if \(contenido === 'Video'\) \{\s*hide\('isbn-row'\);\s*\} else \{\s*syncAutocompletarRow\(\);\s*\}/s, "syncAutocompletarRow();");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated recursos.js logic");
