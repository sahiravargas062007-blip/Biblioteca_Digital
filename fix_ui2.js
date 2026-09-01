const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

const divBlockStart = content.indexOf('<div>\n            <label class="af-label">');
const blockEnd = content.indexOf('</label>\n          </div>\n        </div>\n      </div>', divBlockStart);

if (divBlockStart !== -1 && blockEnd !== -1) {
    const textCat = `<div>
            <label class="af-label">
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
            </label>
            <label class="af-label" style="margin-top:14px">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Subcategor\u00EDa
              </span>
              <select name="subcategoria_id" id="subcategoria-select">
                <option value="">Sin subcategor\u00EDa</option>
              </select>`;
              
    content = content.substring(0, divBlockStart) + textCat + content.substring(blockEnd);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Swapped Categorias and Subcategorias successfully!");
} else {
    console.log("Failed to find index");
}
