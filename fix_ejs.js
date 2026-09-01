const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\masivo.ejs';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/cap.tulos/g, 'cap\u00EDtulos');
fs.writeFileSync(file, content, 'utf8');
