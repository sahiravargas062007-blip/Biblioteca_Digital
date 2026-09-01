const fs = require('fs');

// Fix masivoZip.js
let file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/Pendiente de configuracin/g, 'Pendiente de configuración');
fs.writeFileSync(file, content, 'utf8');

// Fix payload.js
file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\payload.js';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/Pendiente de configuracin/g, 'Pendiente de configuración');
fs.writeFileSync(file, content, 'utf8');

console.log("Fixed controllers");
