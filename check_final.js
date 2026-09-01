const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

if (content.includes("Pendiente de configuraci\u00F3n")) {
    console.log("IT HAS O ACUTE! IT IS FIXED!");
} else {
    console.log("IT DOES NOT HAVE O ACUTE!");
}

if (content.includes("Pendiente de configuraci\uFFFDn")) {
    console.log("IT HAS UFFFD! IT IS BROKEN!");
} else {
    console.log("IT DOES NOT HAVE UFFFD!");
}
