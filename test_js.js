const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\user\\archivo\\ver.ejs';
let content = fs.readFileSync(file, 'utf8');
const i1 = content.indexOf('<script>');
console.log(content.substring(i1, i1 + 50));
