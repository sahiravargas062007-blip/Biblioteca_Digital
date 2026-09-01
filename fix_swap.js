const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs';
let content = fs.readFileSync(file, 'utf8');

// The file currently has Subcategoria FIRST because `git checkout` restored it to the state where Subcategoria was first? 
// No, `git checkout` restores it to the Git index. Let's check if the Git index has Subcategoria first or Categoria first.
const catFirst = content.indexOf('Categor\\u00EDa') < content.indexOf('Subcategor\\u00EDa');
// wait, the output of my earlier search showed:
// <svg... > Subcategora
// <select ... id="subcategoria-select">
// <svg... > Categora
// <select ... id="categoria-select">

// So it's Subcategoria then Categoria in the file right now.
// I need to swap them back so Categoria is first, Subcategoria is second.

const subcatRegex = /<label class="af-label">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Subcategor.a\s*<\/span>\s*<select name="subcategoria_id" id="subcategoria-select">\s*<option value="">Sin subcategor.a<\/option>\s*<\/select>\s*<\/label>/;
const catRegex = /<label class="af-label" style="margin-top:14px">\s*<span>\s*<svg[^>]+>.*?<\/svg>\s*Categor.a\s*<\/span>\s*<select name="categoria_id" id="categoria-select" required>.*?<\/select>\s*<\/label>/s;

const matchSub = content.match(subcatRegex);
const matchCat = content.match(catRegex);

if (matchSub && matchCat) {
    console.log("Found both blocks! Swapping them...");
    
    // We want Categoria first, Subcategoria second.
    // The matchCat has margin-top:14px, we want to give that to Subcategoria instead.
    let newCat = matchCat[0].replace('style="margin-top:14px"', '');
    let newSub = matchSub[0].replace('<label class="af-label">', '<label class="af-label" style="margin-top:14px">');
    
    // Replace the exact strings we found, no wildcards
    content = content.replace(matchSub[0], '%%SUBCAT%%');
    content = content.replace(matchCat[0], '%%CAT%%');
    
    content = content.replace('%%SUBCAT%%', newCat);
    content = content.replace('%%CAT%%', newSub);
} else {
    console.log("Could not find blocks to swap");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done.");
