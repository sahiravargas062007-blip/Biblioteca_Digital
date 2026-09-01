const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
const content = fs.readFileSync(file, 'utf8');

const matches = content.match(/Pendiente de configuraci.n/g);
if (matches) {
    matches.forEach((m, i) => {
        console.log(`Match ${i}: ${m} -> ` + Array.from(m).map(c => c.charCodeAt(0)).join(','));
    });
} else {
    console.log("No matches found");
}
