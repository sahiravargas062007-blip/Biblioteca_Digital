const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /const folderName = Array\.from\(carpetasDistintas\)\[0\]\.toLowerCase\(\)\.trim\(\);/;
content = content.replace(regex, `const folderName = Array.from(carpetasDistintas)[0].toLowerCase().trim();
      console.log("FOLDER NAME IS: '" + folderName + "'");`);

fs.writeFileSync(file, content, 'utf8');
