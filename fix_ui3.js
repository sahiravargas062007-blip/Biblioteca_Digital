const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

const subcatIndex = content.indexOf('Subcategor\\u00EDa');
const catIndex = content.indexOf('Categor\\u00EDa', subcatIndex); // wait it was subcat then cat.
console.log("Subcat:", content.indexOf('Subcategor\u00EDa'));
console.log("Cat:", content.indexOf('Categor\u00EDa', content.indexOf('Subcategor\u00EDa')));

content = content.replace(/<label class="af-label">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Subcategor\u00EDa\s*<\/span>\s*<select name="subcategoria_id" id="subcategoria-select">\s*<option value="">Sin subcategor\u00EDa<\/option>\s*<\/select>\s*<\/label>/s, '%%SUBCAT%%');
content = content.replace(/<label class="af-label" style="margin-top:14px">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Categor\u00EDa\s*<\/span>\s*<select name="categoria_id" id="categoria-select" required>.*?<\/select>\s*<\/label>/s, '%%CAT%%');

if (content.includes('%%SUBCAT%%') && content.includes('%%CAT%%')) {
    // Just replace them back in swapped order
    const catBlock = `            <label class="af-label">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                Categor\u00EDa
              </span>
              <select name="categoria_id" id="categoria-select" required>
                <option value="">Seleccione</option>
                <% categorias.forEach(function(cat) { %>
                  <option value="<%= cat._id %>"
                    <%= String(firstCategoria?.categoria_id || '') === String(cat._id) ? 'selected' : '' %>>
                    <%= cat.nombre %>
                  </option>
                <% }); %>
              </select>
            </label>`;
            
    const subcatBlock = `            <label class="af-label" style="margin-top:14px">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Subcategor\u00EDa
              </span>
              <select name="subcategoria_id" id="subcategoria-select">
                <option value="">Sin subcategor\u00EDa</option>
              </select>
            </label>`;
            
    content = content.replace('%%SUBCAT%%', catBlock);
    content = content.replace('%%CAT%%', subcatBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Swapped via strict regex!");
} else {
    console.log("Failed. SC:", content.includes('%%SUBCAT%%'), "CAT:", content.includes('%%CAT%%'));
}

