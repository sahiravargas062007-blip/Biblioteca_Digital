const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Recurso = require('./models/Recurso');
    
    const rec = await Recurso.findOne({ titulo: /Los Cuatro Acuerdos/i });
    if (!rec) {
        console.log("No se encontro");
    } else {
        console.log("Titulo:", rec.titulo);
        console.log("Estado:", rec.estado);
        console.log("Archivos count:", rec.digital?.archivos?.length);
        console.log("Archivos:", JSON.stringify(rec.digital?.archivos, null, 2));
    }
    process.exit(0);
}
check();
