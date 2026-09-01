const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\masivo.ejs';
let content = fs.readFileSync(file, 'utf8');

const target = '<td><strong><%= r.titulo %></strong></td>';
const replacement = `
                <td>
                  <strong><%= r.titulo %></strong>
                  <% if (r.mainEntry && Array.isArray(r.mainEntry) && r.mainEntry.length > 1) { %>
                    <br><small style="color:#146c5f; font-weight:500;">(Contiene <%= r.mainEntry.length %> audios/capítulos)</small>
                  <% } %>
                </td>`.trim();

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated masivo.ejs UI");
