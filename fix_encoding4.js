const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

// Replace all occurrences using a function to see what was replaced
let count = 0;
content = content.replace(/Pendiente de configuraci.n/g, (match) => {
    count++;
    return 'Pendiente de configuraci\u00F3n';
});
content = content.replace(/t.tulo:/g, (match) => { count++; return 't\u00EDtulo:'; });
content = content.replace(/recurso\.t.tulo/g, (match) => { count++; return 'recurso.t\u00EDtulo'; });
content = content.replace(/cargado m.sivamente/g, (match) => { count++; return 'cargado masivamente'; });
content = content.replace(/m.s /g, (match) => { count++; return 'm\u00E1s '; });
content = content.replace(/p.blico/g, (match) => { count++; return 'p\u00FAblico'; });
content = content.replace(/tama.o/g, (match) => { count++; return 'tama\u00F1o'; });

fs.writeFileSync(file, content, 'utf8');
console.log("Replacements made: ", count);
