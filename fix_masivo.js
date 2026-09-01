const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `    let modoCarpetaPorRecurso = false;
    if (tipoContenido === 'Lectura') {
      modoCarpetaPorRecurso = carpetasDistintas.size >= 2;
    } else {
      modoCarpetaPorRecurso = carpetasDistintas.size >= 1;
    }`;

const newLogic = `    let modoCarpetaPorRecurso = carpetasDistintas.size >= 2;
    if (tipoContenido === 'Audio' && carpetasDistintas.size === 1) {
      const folderName = Array.from(carpetasDistintas)[0].toLowerCase().trim();
      const genericNames = ['audiolibros', 'audio libros', 'libros', 'audios', 'audio', 'audiobooks', 'audiobook', 'books'];
      if (!genericNames.includes(folderName)) {
        modoCarpetaPorRecurso = true;
      }
    }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated masivoZip.js");
