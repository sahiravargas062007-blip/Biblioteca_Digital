const fs = require('fs');
const path = require('path');
const dir = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  if (content.includes('\uFFFD')) {
    console.log(`Corrupted characters found in ${file}`);
  }
}
