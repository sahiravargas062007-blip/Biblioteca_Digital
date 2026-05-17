const fs = require('fs');
let css = fs.readFileSync('c:/Biblioteca_Digital/public/css/pages/catalogo-browse.css', 'utf8');

// Remove sidebar, topbar and main content margin sections
css = css.replace(/\/\* ── Sidebar Navigation ── \*\/\s*\.cat-sidebar[\s\S]*?\/\* ── Filter Panel ──/, '/* ── Filter Panel ──');

// Remove responsive
css = css.replace(/\/\* ── Responsive ── \*\/\s*@media \([\s\S]*?\/\* Sidebar overlay on mobile \*\/\s*\.cat-sidebar-overlay[\s\S]*?\}\s*/, '');

fs.writeFileSync('c:/Biblioteca_Digital/public/css/pages/catalogo-browse.css', css);
