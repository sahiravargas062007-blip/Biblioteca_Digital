const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\models\\Recurso.js';
let content = fs.readFileSync(file, 'utf8');

if (content.includes("Pendiente de configuraci\u00F3n")) {
    console.log("Recurso.js HAS O ACUTE! IT IS FIXED!");
} else {
    console.log("Recurso.js DOES NOT HAVE O ACUTE!");
}

if (content.includes("Pendiente de configuraci\uFFFDn")) {
    console.log("Recurso.js HAS UFFFD! IT IS BROKEN!");
} else {
    console.log("Recurso.js DOES NOT HAVE UFFFD!");
}
