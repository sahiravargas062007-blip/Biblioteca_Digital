const mongoose = require('mongoose');
const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const Recurso = require('../../../models/Recurso');
const { subirBuffer } = require('../../../services/cloudinaryService');
const tituloService = require('../../../services/tituloService');
const {
  flash,
  escapeRegExp,
  generarPublicId,
  subirArchivoCloudinary,
  nombreBase,
  tipoArchivoFromExt,
  materialFromContenido,
  UPLOAD_PRESET,
} = require('./helpers');

const MAIN_EXTS_POR_TIPO = {
  Lectura: ['pdf', 'epub'],
  Audio:   ['mp3', 'wav', 'm4b', 'm4a', 'aac', 'ogg', 'flac'],
  Video:   ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'],
};
// jfif se agrega porque es un JPEG válido y es común que gestores de
// imágenes (ej. guardar-como desde el navegador) lo usen por defecto.
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'jfif'];
const COMPLEMENTO_EXTS = ['mp3', 'wav', 'm4a'];

function analizarZip(zip, tipoContenido) {
  const recursos = [];
  const errores = [];
  const gruposCarpeta = new Map();
  // Archivos sin carpeta (o cuya carpeta contenedora es única/compartida
  // por todos): se emparejan por similitud de título, no por nombre exacto.
  const sueltos = { mains: [], portadas: [], complementos: [] };

  const mainExts = MAIN_EXTS_POR_TIPO[tipoContenido] || [];
  const entries = zip.getEntries();

  // ── Pasada 1: clasificar cada archivo, sin decidir todavía el modo ──────
  const archivos = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const parts = entry.entryName.split('/');
    const filename = parts[parts.length - 1];
    if (filename.startsWith('.') || filename.startsWith('__')) continue;

    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx === -1) continue;

    const ext = filename.slice(dotIdx + 1).toLowerCase();
    const base = filename.slice(0, dotIdx);
    // carpetaKey = nombre de la carpeta inmediata que contiene el archivo,
    // o null si el archivo está en la raíz del ZIP.
    const carpetaKey = parts.length > 1 ? parts[parts.length - 2] : null;

    archivos.push({ entry, base, ext, carpetaKey });
  }

  // ── Pasada 2: ¿el ZIP realmente tiene "una carpeta por recurso", o es
  //    todo (raíz, o una única carpeta contenedora tipo "Audiolibros/")
  //    envolviendo un solo lote de archivos sueltos? Solo si hay 2+
  //    carpetas DISTINTAS asumimos que cada una es un recurso propio.
  const carpetasDistintas = new Set(
    archivos.filter(a => a.carpetaKey !== null).map(a => a.carpetaKey)
  );
  const modoCarpetaPorRecurso = carpetasDistintas.size >= 2;

  for (const { entry, base, ext, carpetaKey } of archivos) {
    if (modoCarpetaPorRecurso && carpetaKey !== null) {
      // ── Modo "una carpeta = un recurso" ─────────────────────────────
      const key = carpetaKey;
      if (!gruposCarpeta.has(key)) {
        gruposCarpeta.set(key, { main: null, portada: null, complemento: null });
      }
      const grupo = gruposCarpeta.get(key);

      if (mainExts.includes(ext)) grupo.main = entry;
      if (IMG_EXTS.includes(ext)) {
        grupo.portada = entry;
      } else if (tipoContenido === 'Lectura' && COMPLEMENTO_EXTS.includes(ext)) {
        grupo.complemento = entry;
      }
    } else {
      // ── Modo "archivos sueltos": se emparejan por título parecido ──────
      // (aplica tanto a archivos en la raíz como a los que comparten una
      // única carpeta contenedora envolviendo todo el lote)
      if (mainExts.includes(ext)) {
        sueltos.mains.push({ entry, base, ext });
      } else if (IMG_EXTS.includes(ext)) {
        sueltos.portadas.push({ entry, base, ext });
      } else if (tipoContenido === 'Lectura' && COMPLEMENTO_EXTS.includes(ext)) {
        sueltos.complementos.push({ entry, base, ext });
      }
      // Otras extensiones sueltas no reconocidas se ignoran silenciosamente.
    }
  }

  // 1. Recursos detectados por carpeta — solo corre si modoCarpetaPorRecurso
  //    fue true (2+ carpetas distintas). Si el ZIP tenía 0 o 1 carpeta,
  //    gruposCarpeta queda vacío y este bloque no hace nada.
  for (const [base, grupo] of gruposCarpeta.entries()) {
    if (!grupo.main && !grupo.portada && !grupo.complemento) continue;

    if (!grupo.main) {
      errores.push(`Archivo "${base}" no tiene archivo principal valido para "${tipoContenido}".`);
      recursos.push({ titulo: base, tieneMain: false, tienePortada: !!grupo.portada });
      continue;
    }

    recursos.push({
      titulo:           base.replace(/_/g, ' ').replace(/-/g, ' '),
      tieneMain:        true,
      tienePortada:     !!grupo.portada,
      mainEntry:        grupo.main,
      portadaEntry:     grupo.portada     || null,
      complementoEntry: grupo.complemento || null,
    });
  }

  // 2. Recursos detectados por archivos sueltos: cada archivo principal es
  //    un recurso, y se le empareja la portada/complemento con el nombre
  //    más parecido (tolerante a mayúsculas, tildes, "_"/"-"/"+", y
  //    palabras de más como el autor).
  const portadasDisponibles = [...sueltos.portadas];
  const complementosDisponibles = [...sueltos.complementos];

  for (const mainInfo of sueltos.mains) {
    const portadaMatch = tituloService.mejorCoincidencia(
      mainInfo.base, portadasDisponibles, (c) => c.base
    );
    if (portadaMatch) {
      portadasDisponibles.splice(portadasDisponibles.indexOf(portadaMatch), 1);
    }

    const complementoMatch = tipoContenido === 'Lectura'
      ? tituloService.mejorCoincidencia(mainInfo.base, complementosDisponibles, (c) => c.base)
      : null;
    if (complementoMatch) {
      complementosDisponibles.splice(complementosDisponibles.indexOf(complementoMatch), 1);
    }

    recursos.push({
      titulo:           mainInfo.base.replace(/_/g, ' ').replace(/-/g, ' '),
      tieneMain:        true,
      tienePortada:     !!portadaMatch,
      mainEntry:        mainInfo.entry,
      portadaEntry:     portadaMatch      ? portadaMatch.entry      : null,
      complementoEntry: complementoMatch  ? complementoMatch.entry  : null,
    });
  }

  // Portadas/complementos sueltos que no se lograron asociar a ningún
  // archivo principal: se reportan como error en vez de perderse en
  // silencio, para que el admin sepa que algo quedó fuera.
  for (const p of portadasDisponibles) {
    errores.push(`La portada "${p.base}.${p.ext}" no se pudo asociar a ningún archivo principal.`);
  }
  for (const c of complementosDisponibles) {
    errores.push(`El archivo complementario "${c.base}.${c.ext}" no se pudo asociar a ningún archivo principal.`);
  }

  return { recursos, errores };
}

// Exportada además para poder testear el agrupamiento de forma aislada
// (sin necesidad de una petición HTTP real).
exports.analizarZip = analizarZip;


/**
 * Busca en la BD un conjunto amplio de candidatos que podrían coincidir
 * con alguno de los títulos detectados, usando sus palabras significativas
 * como filtro (para no traer toda la colección). La comparación fina y
 * difusa se hace después con tituloService, no aquí.
 */
async function buscarCandidatosPorTitulo(titulos) {
  const tokens = new Set();
  for (const t of titulos) {
    tituloService.tokensSignificativos(t).forEach((tok) => tokens.add(tok));
  }
  if (tokens.size === 0) return [];

  const regexes = [...tokens].map((tok) => new RegExp(escapeRegExp(tok), 'i'));
  return Recurso.find({ titulo: { $in: regexes } });
}

/** Marca cada recurso detectado como Nuevo / Error / ya existente en BD, usando
 * comparación difusa de títulos (mismo criterio en previsualizar y confirmar). */
async function marcarEstadoDeteccion(recursos) {
  const titulos = recursos.map(r => r.titulo);
  const candidatosDB = await buscarCandidatosPorTitulo(titulos);

  for (const recurso of recursos) {
    if (!recurso.tieneMain) {
      recurso.estadoDeteccion = 'Error';
      continue;
    }
    const existente = tituloService.mejorCoincidencia(
      recurso.titulo, candidatosDB, (doc) => doc.titulo
    );
    if (existente) {
      recurso.estadoDeteccion = 'Archivo pendiente encontrado';
      recurso.existenteDoc = existente;
    } else {
      recurso.estadoDeteccion = 'Nuevo';
    }
  }
}

exports.masivo = (req, res) =>
  res.render('admin/recursos/masivo', { title: 'Carga masiva' });

// ─────────────────────────────────────────────────────────────────────
// PASO 1 — POST /admin/recursos/masivo/previsualizar
// CA4: analizar el ZIP y mostrar previsualización sin guardar nada
// ─────────────────────────────────────────────────────────────────────
exports.previsualizarMasivo = async (req, res, next) => {
  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    const tipoContenido = req.body.tipo_contenido || 'Lectura';
    const zip = new AdmZip(req.file.buffer);
    const { recursos, errores } = analizarZip(zip, tipoContenido);

    await marcarEstadoDeteccion(recursos);

    const zipTempName = `recursos-masivo-${randomUUID()}.zip`;
    const zipTempPath = path.join(os.tmpdir(), zipTempName);
    await fs.writeFile(zipTempPath, req.file.buffer);

    return res.render('admin/recursos/masivo', {
      title:         'Carga masiva — Vista previa',
      previsualizar: true,
      tipoContenido,
      recursos,
      errores,
      zipTempName,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────
// PASO 2 — POST /admin/recursos/masivo/confirmar
// CA5: subir a Cloudinary y guardar en MongoDB
// CA6: si cancela, no guarda nada
// ─────────────────────────────────────────────────────────────────────
exports.confirmarMasivo = async (req, res, next) => {
  const zipTempName = req.body.zip_temp_name;
  const zipTempPath = zipTempName ? path.join(os.tmpdir(), zipTempName) : null;
  const tipoContenido = req.body.tipo_contenido || 'Lectura';

  try {
    // CA6: cancelar sin guardar nada
    if (req.body.accion === 'cancelar') {
      if (zipTempPath) await fs.unlink(zipTempPath).catch(() => {});
      flash(req, 'info', 'Carga masiva cancelada. No se guardaron cambios.');
      return res.redirect('/admin/recursos');
    }

    if (!zipTempPath) {
      flash(req, 'error', 'No se encontró el archivo ZIP temporal. Vuelva a intentarlo.');
      return res.redirect('/admin/recursos/masivo');
    }

    const zipBuffer = await fs.readFile(zipTempPath);
    const zip = new AdmZip(zipBuffer);
    const { recursos, errores: erroresDeteccion } = analizarZip(zip, tipoContenido);

    await marcarEstadoDeteccion(recursos);

    const recursosAGuardar = recursos.filter(
      r => r.estadoDeteccion === 'Nuevo' || r.estadoDeteccion === 'Archivo pendiente encontrado'
    );

    if (recursosAGuardar.length === 0) {
      flash(req, 'error', 'No se detectaron recursos procesables en el ZIP.');
      return res.redirect('/admin/recursos/masivo');
    }

    let creados = 0;
    let actualizados = 0;
    const erroresSubida = [];

    for (const recurso of recursosAGuardar) {
      try {
        const archivos = [];

        // Subir archivo principal a Cloudinary solo si existe
        if (recurso.mainEntry) {
          const mainBuffer = recurso.mainEntry.getData();
          const mainSubido = await subirArchivoCloudinary(
            mainBuffer,
            recurso.mainEntry.name,
            '',
            recurso.titulo
          );

          archivos.push({
            tipo:         tipoArchivoFromExt(mainSubido.ext),
            url:          mainSubido.url,
            public_id:    mainSubido.public_id,
            es_principal: true,
            tamano_bytes: mainSubido.tamano_bytes,
            subido_en:    new Date(),
          });
        }

        // Complemento de audio (solo Lectura y si hay main)
        if (recurso.complementoEntry && recurso.mainEntry) {
          const compBuffer = recurso.complementoEntry.getData();
          const compSubido = await subirArchivoCloudinary(
            compBuffer,
            recurso.complementoEntry.name,
            '',
            `${recurso.titulo}_comp`
          );
          archivos.push({
            tipo:         tipoArchivoFromExt(compSubido.ext),
            url:          compSubido.url,
            public_id:    compSubido.public_id,
            es_principal: false,
            tamano_bytes: compSubido.tamano_bytes,
            subido_en:    new Date(),
          });
        }

        // Portada: subir a Cloudinary o usar placeholder
        let imagen = { url: '/img/placeholder.png', public_id: '', es_default: true };

        if (recurso.portadaEntry) {
          const portadaBuffer = recurso.portadaEntry.getData();
          const portadaResult = await subirBuffer(portadaBuffer, {
            resource_type: 'image',
            public_id:     generarPublicId(recurso.titulo, 'portadas'),
            upload_preset: UPLOAD_PRESET,
          });
          imagen = {
            url:        portadaResult.secure_url,
            public_id:  portadaResult.public_id,
            es_default: false,
          };
        }

        if (recurso.estadoDeteccion === 'Archivo pendiente encontrado' && recurso.existenteDoc) {
          // Actualizar Recurso existente en MongoDB
          const doc = recurso.existenteDoc;

          // Mantener archivos anteriores que no sean principales si corresponde
          const archivosFiltrados = (doc.digital?.archivos || []).filter(a => !a.es_principal);
          const todosArchivos = [...archivos, ...archivosFiltrados];

          // Actualizar imagen si se subió portada nueva, si no dejar la existente
          const nuevaImagen = recurso.portadaEntry ? imagen : doc.imagen;

          await Recurso.findByIdAndUpdate(doc._id, {
            $set: {
              'digital.archivos': todosArchivos,
              imagen: nuevaImagen,
              estado: 'Pendiente de configuración',
              actualizado_en: new Date()
            }
          });
          actualizados += 1;
        } else {
          // Guardar en MongoDB con estado "Pendiente de configuración"
          await Recurso.create({
            nombreArchivoOriginal: recurso.mainEntry ? nombreBase(recurso.mainEntry.name) : recurso.titulo,
            tipo_naturaleza: 'Digital',
            tipo_contenido:  tipoContenido,
            tipo_material:   materialFromContenido(tipoContenido),
            titulo:          recurso.titulo,
            autor:           'Pendiente de completar',
            descripcion:     'Recurso cargado masivamente. Pendiente de completar metadatos.',
            idioma:          '',
            imagen,
            categorias:      [],
            estado:          'Pendiente de configuración',
            publicado:       false,
            digital: {
              tipo_licencia:         'Libre',
              archivos,
              licencias_en_uso:      0,
              estado_disponibilidad: 'Acceso libre',
            },
            fisico:          undefined,
            total_prestamos: 0,
            total_reservas:  0,
            creado_en:       new Date(),
            actualizado_en:  new Date(),
            ...(mongoose.isValidObjectId(req.session?.adminId)
              ? { registrado_por: req.session.adminId }
              : {}),
          });

          creados += 1;
        }
      } catch (errSubida) {
        console.error(`[MasivoZIP] Error al procesar "${recurso.titulo}":`, errSubida);
        erroresSubida.push(`"${recurso.titulo}": ${errSubida.message}`);
      }
    }

    const totalErrores   = [...erroresDeteccion, ...erroresSubida];
    const detalleErrores = totalErrores.length ? ` Problemas: ${totalErrores.join(' | ')}` : '';

    flash(
      req,
      totalErrores.length ? 'error' : 'success',
      `Carga completada. Recursos creados: ${creados}. Recursos actualizados: ${actualizados}.${detalleErrores}`
    );
    return res.redirect('/admin/recursos');
  } catch (error) {
    next(error);
  } finally {
    if (zipTempPath) await fs.unlink(zipTempPath).catch(() => {});
  }
};
