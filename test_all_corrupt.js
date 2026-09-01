const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory && f !== 'node_modules' && f !== '.git') {
      walkDir(dirPath, callback);
    } else if (!isDirectory && (f.endsWith('.js') || f.endsWith('.ejs'))) {
      callback(path.join(dir, f));
    }
  });
}

walkDir('C:\\Biblioteca_Digital', (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('\uFFFD')) {
    console.log(`Corrupted: ${filePath}`);
  }
});
