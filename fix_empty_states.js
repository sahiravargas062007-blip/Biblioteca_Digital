const fs = require('fs');

function processFile(file, collectionName, eyebrowText, titleText, subtitleText) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove the standalone page-title-panel
    const panelRegex = /<section class="panel page-title-panel">.*?<\/section>/s;
    content = content.replace(panelRegex, `<% if (${collectionName}.length > 0) { %>
  <section class="panel page-title-panel">
    <p class="eyebrow">${eyebrowText}</p>
    <h1>${titleText}</h1>
    <p class="muted">${subtitleText}</p>
  </section>
<% } %>`);

    // Add the inside title to empty-state
    const emptyStateRegex = /<section class="empty-state">/;
    content = content.replace(emptyStateRegex, `<section class="empty-state" style="position:relative; padding-top: 8rem;">
      <div style="position: absolute; top: 30px; left: 30px; text-align: left;">
        <p class="eyebrow" style="color:#146c5f; margin:0;">${eyebrowText}</p>
        <h1 style="color:#2c2518; margin: 4px 0; font-size:1.8rem; font-family:'Playfair Display',serif;">${titleText}</h1>
        <p class="muted" style="color:#5c5548; margin:0; font-size:0.9rem;">${subtitleText}</p>
      </div>`);
      
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated", file);
}

processFile(
    'C:\\Biblioteca_Digital\\views\\user\\sanciones\\index.ejs',
    'sanciones',
    'Estado del usuario',
    'Mis sanciones',
    'Consulta tus sanciones activas e historial de sanciones levantadas.'
);

processFile(
    'C:\\Biblioteca_Digital\\views\\user\\prestamos\\index.ejs',
    'prestamos',
    'Actividad',
    'Mis préstamos',
    'Aquí se muestran los recursos que tienes prestados y sus fechas de vencimiento.'
);

processFile(
    'C:\\Biblioteca_Digital\\views\\user\\reservas\\index.ejs',
    'reservas',
    'Actividad',
    'Mis reservas',
    'Gestiona los materiales que has reservado para préstamo físico.'
);

