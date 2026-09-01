const fs = require('fs');

function getEstadoBytes(file) {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/Pendiente de configuraci.n/);
    if (!match) return "Not found";
    const str = match[0];
    return Array.from(str).map(c => c.charCodeAt(0)).join(',');
}

console.log("masivoZip.js:", getEstadoBytes('C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js'));
console.log("Recurso.js:", getEstadoBytes('C:\\Biblioteca_Digital\\models\\Recurso.js'));
