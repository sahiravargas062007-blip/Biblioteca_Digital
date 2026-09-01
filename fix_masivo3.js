const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /let modoCarpetaPorRecurso = false;\s+if \(tipoContenido === 'Lectura'\) \{\s+modoCarpetaPorRecurso = carpetasDistintas\.size >= 2;\s+\} else \{\s+modoCarpetaPorRecurso = carpetasDistintas\.size >= 1;\s+\}/;

const newLogic = `let modoCarpetaPorRecurso = carpetasDistintas.size >= 2;
  if (tipoContenido === 'Audio' && carpetasDistintas.size === 1) {
    const folderName = Array.from(carpetasDistintas)[0].toLowerCase().trim();
    const genericNames = ['audiolibros', 'audio libros', 'libros', 'audios', 'audio', 'audiobooks', 'audiobook', 'books'];
    if (!genericNames.includes(folderName)) {
      modoCarpetaPorRecurso = true;
    }
  }`;

if (regex.test(content)) {
    content = content.replace(regex, newLogic);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated masivoZip.js");
} else {
    console.log("Regex did not match!");
}
