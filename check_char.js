const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');
let match = content.match(/Pendiente de configuraci(.)n/);
if (match) {
    console.log("Found char:", match[1], "CharCode:", match[1].charCodeAt(0));
}
