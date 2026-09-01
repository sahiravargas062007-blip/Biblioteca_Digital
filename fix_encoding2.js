const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Pendiente de configuraci.n/g, 'Pendiente de configuración');
content = content.replace(/t.tulo:/g, 'titulo:');
content = content.replace(/recurso\.t.tulo/g, 'recurso.titulo');
content = content.replace(/cargado m.sivamente/g, 'cargado masivamente');
content = content.replace(/m.s/g, 'más');
content = content.replace(/p.blico/g, 'público');
content = content.replace(/tama.o/g, 'tamaño');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed encoding strings in masivoZip.js using dot wildcard");
