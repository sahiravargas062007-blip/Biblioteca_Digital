const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const i = content.indexOf('let modoCarpetaPorRecurso');
console.log(content.substring(i, i + 200));
