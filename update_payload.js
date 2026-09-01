const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\controllers\\admin\\recurso\\payload.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the generic estado assignment in buildRecursoPayload
const oldEstadoLine = "estado: req.body.estado || (publicado ? 'Activo' : 'Pendiente de configuraci\\uFFFDn'),";
const replacement = `
    estado: req.body.estado || 'Pendiente de configuraci\\u00F3n',
`;
// Let's just use string replacement on the payload assembly block.
content = content.replace(/estado:\s*req\.body\.estado\s*\|\|\s*\(publicado\s*\?\s*'Activo'\s*:\s*'Pendiente de configuraci.n'\),/, "/* ESTADO_PLACEHOLDER */");

const completenessLogic = `
  // --- Validacion y Estado automatico ---
  const tit = payload.titulo || '';
  const aut = payload.autor || '';
  const desc = payload.descripcion || '';
  const lang = payload.idioma || '';
  
  const isComplete = 
    tit.trim() !== '' && tit.toLowerCase() !== 'pendiente de completar' &&
    aut.trim() !== '' && aut.toLowerCase() !== 'pendiente de completar' &&
    desc.trim() !== '' && desc.toLowerCase() !== 'pendiente de completar' &&
    lang.trim() !== '' && lang.toLowerCase() !== 'pendiente de completar' &&
    payload.categorias && payload.categorias.length > 0;
  
  if (publicado || req.body.estado === 'Activo') {
    if (!isComplete) {
      const err = new Error("No se puede publicar ni activar el recurso: faltan metadatos requeridos (t\\u00EDtulo, autor, descripci\\u00F3n, idioma, o categor\\u00EDas).");
      err.isValidationError = true;
      throw err;
    }
    payload.estado = 'Activo';
    payload.publicado = true;
    payload.publicado_en = payload.publicado_en || new Date();
  } else {
    if (isComplete && req.body.estado === 'Pendiente de configuraci\\u00F3n') {
      payload.estado = 'Activo';
    } else {
      payload.estado = req.body.estado || 'Pendiente de configuraci\\u00F3n';
    }
  }
`;

content = content.replace("payload.publicado_en =      publicado ? new Date() : undefined;", "");
content = content.replace("publicado_en:      publicado ? new Date() : undefined,", "");

content = content.replace("/* ESTADO_PLACEHOLDER */", "");

// Insert at the bottom of buildRecursoPayload before metadatos validation
content = content.replace("if (req.body.tipo_contenido === 'Lectura') {", completenessLogic + "\n  if (req.body.tipo_contenido === 'Lectura') {");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated payload.js logic");
