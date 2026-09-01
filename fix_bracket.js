const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\admin\\recursos\\masivo.ejs';
let content = fs.readFileSync(file, 'utf8');

// Find the block
const startStr = "if (job.status === 'completado') {";
const idx1 = content.indexOf(startStr);
if (idx1 !== -1) {
    const nextCatch = content.indexOf('} catch (e) {', idx1);
    
    // We want to replace everything from idx1 up to the closing brace before catch.
    const goodBlock = `if (job.status === 'completado') {
                clearInterval(interval);
                let htmlRes = \`<strong style="color:green;">Carga completada!</strong><br>Creados: \${job.creados} | Actualizados: \${job.actualizados}\`;
                if (job.errores && job.errores.length > 0) {
                  htmlRes += \`<div style="margin-top:10px; padding:10px; background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; font-size:0.9em; max-height:120px; overflow-y:auto; text-align:left; border-radius:4px;">\`;
                  htmlRes += \`<strong>Errores durante la subida (\${job.errores.length}):</strong><ul style="padding-left:15px; margin-top:5px; margin-bottom:0;">\`;
                  job.errores.forEach(e => { htmlRes += \`<li>\${e}</li>\`; });
                  htmlRes += \`</ul></div>\`;
                }
                progressText.innerHTML = htmlRes;
                
                setTimeout(() => {
                  window.location.href = '/admin/recursos';
                }, job.errores && job.errores.length > 0 ? 8000 : 2000);
              }
            `;
    
    // the catch block usually is:
    //            }
    //          } catch (e) {
    // so we want to replace up to the brace right before catch
    
    content = content.substring(0, idx1) + goodBlock + content.substring(nextCatch);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed bracket!");
} else {
    console.log("Not found");
}
