const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

// The block for subcategoria
const subcatRegex = /<label class="af-label">\s*<span>\s*<svg[^>]*>.*?<\/svg>\s*Subcategora\s*<\/span>\s*<select name="subcategoria_id".*?<\/select>\s*<\/label>/s;

// The block for categoria
const catRegex = /<label class="af-label" style="margin-top:14px">\s*<span>\s*<svg[^>]*>.*?<\/svg>\s*Categora\s*<\/span>\s*<select name="categoria_id".*?<\/select>\s*<\/label>/s;

// The current layout has subcat THEN cat. Let's just use string replacement on the whole <div> that contains them.

const matchSubcat = content.match(subcatRegex);
const matchCat = content.match(catRegex);

if (matchSubcat && matchCat) {
    let subcatBlock = matchSubcat[0];
    let catBlock = matchCat[0];

    // Remove margin-top from catBlock, and add it to subcatBlock
    catBlock = catBlock.replace('style="margin-top:14px"', '');
    subcatBlock = subcatBlock.replace('<label class="af-label">', '<label class="af-label" style="margin-top:14px">');

    // Remove both blocks
    content = content.replace(matchSubcat[0], "%%SUBCAT%%");
    content = content.replace(matchCat[0], "%%CAT%%");

    // Reinsert them in the desired order
    content = content.replace("%%SUBCAT%%", catBlock);
    content = content.replace("%%CAT%%", subcatBlock);

    fs.writeFileSync(file, content, 'utf8');
    console.log("Swapped Categorias and Subcategorias!");
} else {
    console.log("Could not find the blocks to swap.");
    
    // Alternative simpler replacement if regex failed due to special characters
    const textCat = `
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
              </select>
            </label>
`;
    // We can just overwrite the parent div manually if needed.
}
