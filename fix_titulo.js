const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

// Fix the mistakes I made with titulo
content = content.replace(/t\u00EDtulo/g, 'titulo');
content = content.replace(/t\uFFFDtulo/g, 'titulo');
content = content.replace(/t\u00EDtulo:/g, 'titulo:');
content = content.replace(/recurso\.t\u00EDtulo/g, 'recurso.titulo');

// Just to be absolutely sure:
content = content.replace(/ttulo/g, 'titulo');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed titulo");
