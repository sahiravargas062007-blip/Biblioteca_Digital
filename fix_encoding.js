const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix \uFFFD based on context
    if (content.includes('\uFFFD')) {
        // We can just use global regex for the specific words we know got corrupted
        content = content.replace(/Pendiente de configuraci\uFFFDn/g, 'Pendiente de configuración');
        content = content.replace(/detecci\uFFFDn/g, 'detección');
        content = content.replace(/tama\uFFFDo/g, 'tamaño');
        content = content.replace(/a\uFFFDo/g, 'año');
        content = content.replace(/dise\uFFFDo/g, 'diseño');
        content = content.replace(/Funci\uFFFDn/g, 'Función');
        content = content.replace(/Categor\uFFFDa/g, 'Categoría');
        content = content.replace(/Subcategor\uFFFDa/g, 'Subcategoría');
        content = content.replace(/Gesti\uFFFDn/g, 'Gestión');
        content = content.replace(/colecci\uFFFDn/g, 'colección');
        content = content.replace(/informaci\uFFFDn/g, 'información');
        content = content.replace(/versi\uFFFDn/g, 'versión');
        content = content.replace(/edici\uFFFDn/g, 'edición');
        content = content.replace(/p\uFFFDgina/g, 'página');
        content = content.replace(/t\uFFFDtulo/g, 'título');
        content = content.replace(/T\uFFFDtulo/g, 'Título');
        content = content.replace(/autom\uFFFDtic/g, 'automátic');
        content = content.replace(/m\uFFFDs/g, 'más');
        content = content.replace(/ra\uFFFDa/g, 'raíz');
        content = content.replace(/ra\uFFFDz/g, 'raíz');
        content = content.replace(/ning\uFFFDn/g, 'ningún');
        content = content.replace(/est\uFFFD/g, 'está');
        content = content.replace(/vac\uFFFDo/g, 'vacío');
        content = content.replace(/Funci\uFFFDn/g, 'Función');
        
        // Blind replace for any remaining diamond questions in comments? Better to be safe.
        // Actually, if we miss any, we can do a general replace or just let it be.
        modified = true;
    }
    
    if (replacements) {
        for (const r of replacements) {
            const before = content;
            content = content.replace(r.from, r.to);
            if (content !== before) modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
    }
}

// 1. Fix Recurso schema
replaceInFile('C:\\Biblioteca_Digital\\models\\Recurso.js', [
    { from: /Pendiente de configuraci.n/g, to: 'Pendiente de configuración' }
]);

// 2. Fix masivoZip.js and ensure tamano_bytes is used correctly
replaceInFile('C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\masivoZip.js', [
    { from: /tamaño_bytes/g, to: 'tamano_bytes' }, // Revert user's manual change if any
    { from: /Pendiente de configuraci.n/g, to: 'Pendiente de configuración' }
]);

// 3. Fix payload.js
replaceInFile('C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\payload.js', [
    { from: /Pendiente de configuraci.n/g, to: 'Pendiente de configuración' }
]);

// 4. Fix other corrupted files
replaceInFile('C:\\Biblioteca_Digital\\public\\js\\user\\pdf-immersive.js');
replaceInFile('C:\\Biblioteca_Digital\\views\\admin\\recursos\\nuevo.ejs');
replaceInFile('C:\\Biblioteca_Digital\\views\\user\\archivo\\ver.ejs');

console.log("Done");
