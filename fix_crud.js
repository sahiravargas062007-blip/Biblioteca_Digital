const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\crud.js';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `    const payload         = await buildRecursoPayload(req);
    const recursoAnterior = await Recurso.findById(req.params.id);
    if (!recursoAnterior) {`;

const newLogic = `    const payload         = await buildRecursoPayload(req);
    const recursoAnterior = await Recurso.findById(req.params.id);
    if (!recursoAnterior) {`;

// Wait, I should insert the check after getting recursoAnterior
const patchStr = `
    if (payload.digital && payload.digital.archivos && payload.digital.archivos.length > 0) {
        const payloadUrl = payload.digital.archivos[0].url;
        const mainAnterior = recursoAnterior.digital?.archivos?.find(a => a.es_principal) || recursoAnterior.digital?.archivos?.[0];
        
        // If the URL hasn't changed, preserve the existing files (important for audiobooks with multiple chapters)
        if (mainAnterior && mainAnterior.url === payloadUrl) {
            payload.digital.archivos = recursoAnterior.digital.archivos;
        }
    }
`;

content = content.replace(
    /const recursoAnterior = await Recurso\.findById\(req\.params\.id\);\s*if \(\!recursoAnterior\) \{\s*flash\(req, 'error', 'El recurso no existe\.'\);\s*return res\.redirect\('\/admin\/recursos'\);\s*\}/,
    `const recursoAnterior = await Recurso.findById(req.params.id);
    if (!recursoAnterior) {
      flash(req, 'error', 'El recurso no existe.');
      return res.redirect('/admin/recursos');
    }
    ${patchStr}`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated crud.js");
