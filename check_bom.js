const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
const buf = fs.readFileSync(file);
console.log(buf.slice(0, 50).toString('hex'));
