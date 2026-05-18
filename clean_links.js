const fs = require('fs');
const path = require('path');

function processFile(p) {
  let content = fs.readFileSync(p, 'utf8');
  if (!content.toLowerCase().includes('<html')) return;

  let links = [];
  const linkRegex = /<link rel="stylesheet" href="([^"]+)">/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    if (!match[1].includes('main.css') && !match[1].includes('/css/admin.css')) {
      links.push(match[0]);
    }
  }

  let scripts = [];
  const scriptRegex = /<script[^>]*>[\s\S]*?<\/script>/g;
  while ((match = scriptRegex.exec(content)) !== null) {
    scripts.push(match[0]);
  }

  let mainContent = '';
  const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
  const mainMatch = mainRegex.exec(content);
  if (mainMatch) {
    mainContent = mainMatch[1];
  } else {
    console.log('NO MAIN in', p);
    return;
  }

  mainContent = mainContent.replace(/<%- include\(['"](?:\.\.\/)+partials\/alertas['"]\) %>/, '').trim();

  let newContent = links.join('\n') + (links.length > 0 ? '\n\n' : '') + mainContent + (scripts.length > 0 ? '\n\n' : '') + scripts.join('\n');
  fs.writeFileSync(p, newContent.trim() + '\n');
  console.log('Cleaned', p);
}

function walk(d) {
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ejs')) processFile(p);
  });
}

walk('c:/Biblioteca_Digital/views/admin');
