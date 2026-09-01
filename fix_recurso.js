const fs = require('fs');
let file = 'C:\\Biblioteca_Digital\\models\\Recurso.js';
let content = fs.readFileSync(file, 'utf8');
if (content.includes('\uFFFD')) {
    content = content.replace(/Pendiente de configuraci\uFFFDn/g, 'Pendiente de configuración');
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed Recurso.js");
}
