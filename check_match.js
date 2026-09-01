const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const match = content.match(/Pendiente de configuraci.n/);
console.log("Match:", match ? match[0] : "null");
