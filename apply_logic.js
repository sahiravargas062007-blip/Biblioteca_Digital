const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = "const modoCarpetaPorRecurso = carpetasDistintas.size >= 2;";
const newLogic = `
  let modoCarpetaPorRecurso = false;
  if (tipoContenido === 'Lectura') {
    modoCarpetaPorRecurso = carpetasDistintas.size >= 2;
  } else {
    modoCarpetaPorRecurso = carpetasDistintas.size >= 1;
  }
`;

content = content.replace(oldLogic, newLogic.trim());
fs.writeFileSync(file, content, 'utf8');
console.log("Re-applied logic fix securely.");
