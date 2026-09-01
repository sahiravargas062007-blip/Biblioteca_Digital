const fs = require('fs');
const content = fs.readFileSync('C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('\uFFFD')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
