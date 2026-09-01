const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\public\\js\\admin\\recursos.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /function syncAutocompletarRow\(\) \{[\s\S]*?if \(!inputEl\.value[\s\S]*?\}\s*\}\s*\}\s*\}\s*\}/;

const newFunc = `function syncAutocompletarRow() {
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
  }`;

content = content.replace(regex, newFunc);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated recursos.js");
