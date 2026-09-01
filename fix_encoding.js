const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js';
let content = fs.readFileSync(file, 'utf8');

// The replacement char in utf8 might be \uFFFD. Let's just use regex to match it and replace
content = content.replace(/Pendiente de configuracin/g, 'Pendiente de configuración');
content = content.replace(/Pendiente de configuraci\ufffdn/g, 'Pendiente de configuración');

content = content.replace(/ttulo/g, 'titulo');
content = content.replace(/t\ufffdtulo/g, 'titulo'); // changed back to titulo because schema uses titulo without accent

content = content.replace(/msivamente/g, 'masivamente');
content = content.replace(/m\ufffdsivamente/g, 'masivamente');

content = content.replace(/mos/g, 'más');
content = content.replace(/m\u01eds/g, 'más');

content = content.replace(/pgblico/g, 'público');
content = content.replace(/p\u01e7blico/g, 'público');

content = content.replace(/tamao/g, 'tamaño');
content = content.replace(/tama\ufffdo/g, 'tamaño');

content = content.replace(/aos/g, 'años');
content = content.replace(/a\ufffdos/g, 'años');

// Just to be extremely safe, doing explicit string replacements:
const toReplace = [
    ["Pendiente de configuracin", "Pendiente de configuración"],
    ["ttulo", "titulo"],
    ["msivamente", "masivamente"],
    ["mos", "más"],
    ["pgblico", "público"],
    ["tamao", "tamaño"]
];
for(const [bad, good] of toReplace) {
    content = content.split(bad).join(good);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed encoding strings in masivoZip.js");
