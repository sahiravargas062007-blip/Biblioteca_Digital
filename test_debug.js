const { analizarZip } = require('./controllers/admin/recurso/masivoZip');
const AdmZip = require('adm-zip');

const zip = new AdmZip();
zip.addFile('Audiolibros/El Alquimista.jfif', Buffer.from(''));
zip.addFile('Audiolibros/El alquimista - paulo Coelho.mp3', Buffer.from(''));
zip.addFile('Audiolibros/Becoming.jpg', Buffer.from(''));
zip.addFile('Audiolibros/Becoming de Michelle Obama.mp3', Buffer.from(''));

console.log("Calling analizarZip...");
const { recursos, errores } = analizarZip(zip, 'Audio');
console.log("Recursos:", recursos.length);
