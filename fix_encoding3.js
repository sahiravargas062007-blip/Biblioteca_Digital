const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Pendiente de configuraci.n/g, 'Pendiente de configuraci\u00F3n');
content = content.replace(/t.tulo:/g, 't\u00EDtulo:');
content = content.replace(/recurso\.t.tulo/g, 'recurso.t\u00EDtulo');
content = content.replace(/cargado m.sivamente/g, 'cargado masivamente');
content = content.replace(/m.s /g, 'm\u00E1s ');
content = content.replace(/p.blico/g, 'p\u00FAblico');
content = content.replace(/tama.o/g, 'tama\u00F1o');
content = content.replace(/a.os/g, 'a\u00F1os');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed encoding using unicode escapes");
