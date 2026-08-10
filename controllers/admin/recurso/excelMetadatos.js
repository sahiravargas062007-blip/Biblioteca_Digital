const mongoose = require('mongoose');
const Recurso = require('../../../models/Recurso');
const { flash, escapeRegExp, normalizeTipoMaterial } = require('./helpers');

exports.excelMetadatos = (req, res) =>
  res.render('admin/recursos/excel-metadatos', { title: 'Importar metadatos' });

exports.procesarExcelMetadatos = async (req, res, next) => {
  const { parsearExcel } = require('../../../services/excelService');

  try {
    if (!req.file) {
      flash(req, 'error', 'Debe seleccionar un archivo Excel.');
      return res.redirect('/admin/recursos/excel-metadatos');
    }

    // Parsear Excel
    const { filas, errores: erroresParsingExcel } = parsearExcel(
      req.file.buffer,
      req.file.originalname
    );

    if (filas.length === 0) {
      const todoErrores = erroresParsingExcel.length
        ? erroresParsingExcel.join(' | ')
        : 'No se pudieron procesar filas.';
      flash(req, 'error', `Error al leer Excel: ${todoErrores}`);
      return res.redirect('/admin/recursos/excel-metadatos');
    }

    let exitosos = 0;
    let publicados = 0;
    const detalles = [];
    const errores = [...erroresParsingExcel];

    for (const registro of filas) {
      try {
        const nombreArchivo = String(registro.nombreArchivoOriginal || '').trim();
        const datosProcesados = { ...registro.datosProcesados };

        // 1. Búsqueda por nombreArchivoOriginal (recurso previamente creado por ZIP - Escenario A)
        let recursoBuscado = await Recurso.findOne({
          nombreArchivoOriginal: { $regex: new RegExp("^" + escapeRegExp(nombreArchivo) + "$", "i") }
        });

        // 2. Búsqueda por Título o por ISBN para evitar duplicar recursos que ya existan en la base de datos
        const tituloABuscar = datosProcesados.titulo || nombreArchivo;
        const existentePorTitulo = await Recurso.findOne({
          titulo: { $regex: new RegExp("^" + escapeRegExp(tituloABuscar) + "$", "i") }
        });
        const isbnABuscar = datosProcesados.isbn || (datosProcesados.metadatos ? datosProcesados.metadatos.isbn : null);
        const existentePorIsbn = isbnABuscar
          ? await Recurso.findOne({ isbn: isbnABuscar })
          : null;

        const existente = existentePorTitulo || existentePorIsbn;

        // Si no se encuentra por nombre de archivo, pero sí existe por Título o ISBN:
        // lo asociamos para evitar duplicidad y realizar la fusión (merge)
        if (!recursoBuscado && existente) {
          recursoBuscado = existente;
        }

        if (datosProcesados.tipo_material) {
          const tipoMaterialNormalizado = normalizeTipoMaterial(datosProcesados.tipo_material);
          if (tipoMaterialNormalizado) {
            datosProcesados.tipo_material = tipoMaterialNormalizado;
          } else {
            delete datosProcesados.tipo_material;
          }
        }

        // Determinar tipo_contenido basado en campos presentes o el recurso existente
        let tipoContenido = 'Lectura';
        if (datosProcesados.narrador) {
          tipoContenido = 'Audio';
        } else if (datosProcesados.director) {
          tipoContenido = 'Video';
        } else if (recursoBuscado && recursoBuscado.tipo_contenido) {
          tipoContenido = recursoBuscado.tipo_contenido;
        }
        datosProcesados.tipo_contenido = tipoContenido;

        // Auto-detectar tipo_material para Lectura si no viene especificado explícitamente o en recurso existente
        if (tipoContenido === 'Lectura' && !datosProcesados.tipo_material) {
          if (recursoBuscado && recursoBuscado.tipo_material) {
            datosProcesados.tipo_material = recursoBuscado.tipo_material;
          } else if (datosProcesados.revista || datosProcesados.issn) {
            datosProcesados.tipo_material = 'Revista';
          } else if (datosProcesados.doi) {
            datosProcesados.tipo_material = 'Artículo';
          } else if (datosProcesados.universidad || datosProcesados.programa || datosProcesados.tipo_tesis) {
            datosProcesados.tipo_material = 'Tesis';
          } else if (datosProcesados.numero_norma || datosProcesados.entidad_emisora) {
            datosProcesados.tipo_material = 'Ley y Normativa';
          } else if (datosProcesados.escala || datosProcesados.region || datosProcesados.proyeccion) {
            datosProcesados.tipo_material = 'Mapa';
          } else {
            datosProcesados.tipo_material = 'Libro';
          }
        }

        // Agrupar campos dinámicos para Lectura
        if (tipoContenido === 'Lectura') {
          const tipoMat = datosProcesados.tipo_material || 'Libro';
          const metaInputs = {};

          if (datosProcesados.cantidad_paginas !== undefined) {
            metaInputs.paginas = datosProcesados.cantidad_paginas;
          }

          const posiblesCampos = [
            'editorial', 'paginas', 'isbn', 'volumen', 'numero', 'issn', 
            'revista', 'doi', 'universidad', 'programa', 'tipo_tesis', 'director',
            'numero_norma', 'entidad_emisora', 'diario_oficial', 'escala', 'region', 
            'proyeccion', 'año_cartografico'
          ];

          posiblesCampos.forEach(c => {
            if (datosProcesados[c] !== undefined && datosProcesados[c] !== null && String(datosProcesados[c]).trim() !== "") {
              metaInputs[c] = datosProcesados[c];
            }
          });

          const { METADATOS_SCHEMA } = require('../../../validators/metadatos.validator');
          const schema = METADATOS_SCHEMA[tipoMat];
          if (schema) {
            const permitidos = [...schema.requeridos, ...schema.opcionales];
            const metadatosFiltrados = {};
            for (const campo of permitidos) {
              if (metaInputs[campo] !== undefined && metaInputs[campo] !== null && String(metaInputs[campo]).trim() !== "") {
                if (["paginas", "volumen", "numero", "año_cartografico"].includes(campo)) {
                  const num = Number(metaInputs[campo]);
                  metadatosFiltrados[campo] = isNaN(num) ? metaInputs[campo] : num;
                } else {
                  metadatosFiltrados[campo] = metaInputs[campo];
                }
              }
            }

            // FUSIONAR METADATOS EXISTENTES
            if (recursoBuscado && recursoBuscado.metadatos) {
              let existingMeta = {};
              if (typeof recursoBuscado.metadatos.toObject === 'function') {
                existingMeta = recursoBuscado.metadatos.toObject();
              } else if (recursoBuscado.metadatos instanceof Map) {
                existingMeta = Object.fromEntries(recursoBuscado.metadatos);
              } else {
                existingMeta = { ...recursoBuscado.metadatos };
              }
              datosProcesados.metadatos = {
                ...existingMeta,
                ...metadatosFiltrados
              };
            } else {
              datosProcesados.metadatos = metadatosFiltrados;
            }
          } else {
            datosProcesados.metadatos = {};
          }

          const camposDinamicosParaLimpiar = [
            'editorial', 'cantidad_paginas', 'paginas', 'volumen', 'numero', 'issn', 
            'revista', 'doi', 'universidad', 'programa', 'tipo_tesis', 'director',
            'numero_norma', 'entidad_emisora', 'diario_oficial', 'escala', 'region', 
            'proyeccion', 'año_cartografico'
          ];
          camposDinamicosParaLimpiar.forEach(c => {
            delete datosProcesados[c];
          });
        }

        // Manejar imagen_url
        let imagenUpdate = {};
        if (datosProcesados.imagen_url) {
          imagenUpdate = {
            imagen: {
              url: datosProcesados.imagen_url,
              public_id: '',
              es_default: false
            }
          };
          delete datosProcesados.imagen_url;
        }

        const datosMerged = { ...(recursoBuscado ? recursoBuscado.toObject() : {}), ...datosProcesados };
        
        // Campos obligatorios: titulo, autor, descripcion, tipo_material (Clasificación)
        const tieneObligatorios = datosMerged.titulo && datosMerged.autor && datosMerged.descripcion && datosMerged.tipo_material;
        const tieneArchivoFisico = (recursoBuscado?.digital?.archivos?.some(a => a.es_principal)) || false;

        let nuevoEstado = recursoBuscado?.estado || 'Pendiente de configuración';
        let seraPublicado = recursoBuscado?.publicado !== undefined ? recursoBuscado.publicado : false;
        let publicadoEn = recursoBuscado?.publicado_en;

        if (req.body.auto_publicar === 'true' && tieneObligatorios && tieneArchivoFisico) {
          nuevoEstado = 'Activo';
          seraPublicado = true;
          if (!publicadoEn) publicadoEn = new Date();
        }

        // Determinar los motivos de pendiente
        let motivosPendiente = [];
        if (!seraPublicado) {
          if (!tieneObligatorios) motivosPendiente.push('Faltan campos obligatorios');
          if (!tieneArchivoFisico) motivosPendiente.push('Falta archivo principal');
        }
        const motivoPendienteStr = motivosPendiente.join(', ');

        if (!recursoBuscado) {
          // CA4: Crear recurso nuevo en estado "Pendiente de configuración"
          const titulo = datosProcesados.titulo || nombreArchivo || 'Sin título';
          const autor = datosProcesados.autor || 'Pendiente de completar';
          const descripcion = datosProcesados.descripcion || 'Recurso creado desde Excel. Pendiente de completar metadatos.';
          const tipoMaterial = datosProcesados.tipo_material || 'Libro';

          const nuevoRecurso = {
            nombreArchivoOriginal: nombreArchivo,
            tipo_naturaleza: 'Digital',
            tipo_contenido: datosProcesados.tipo_contenido || 'Lectura',
            tipo_material: tipoMaterial,
            titulo,
            autor,
            narrador: datosProcesados.narrador,
            director: datosProcesados.director,
            productora: datosProcesados.productora,
            descripcion,
            idioma: datosProcesados.idioma || '',
            editorial: datosProcesados.editorial || '',
            isbn: datosProcesados.isbn || '',
            cantidad_paginas: datosProcesados.cantidad_paginas,
            duracion_segundos: datosProcesados.duracion_segundos,
            fecha_publicacion: datosProcesados.fecha_publicacion
              ? new Date(datosProcesados.fecha_publicacion)
              : undefined,
            imagen: datosProcesados.imagen_url
              ? { url: datosProcesados.imagen_url, public_id: '', es_default: false }
              : { url: '/img/placeholder.png', public_id: '', es_default: true },
            categorias: [],
            estado: nuevoEstado,
            publicado: seraPublicado,
            publicado_en: publicadoEn,
            digital: {
              tipo_licencia: 'Libre',
              archivos: [],
              licencias_en_uso: 0,
              estado_disponibilidad: 'Acceso libre',
            },
            total_prestamos: 0,
            total_reservas: 0,
            creado_en: new Date(),
            actualizado_en: new Date(),
            metadatos: datosProcesados.metadatos,
            ...(mongoose.isValidObjectId(req.session?.adminId)
              ? { registrado_por: req.session.adminId }
              : {}),
          };

          const creado = await Recurso.create(nuevoRecurso);
          if (creado) {
            exitosos += 1;
            if (creado.publicado) publicados += 1;
            detalles.push({
              nombreArchivo: registro.nombreArchivoOriginal,
              titulo: creado.titulo || 'Sin título',
              publicado: creado.publicado,
              accion: 'Creado',
              motivo: motivoPendienteStr
            });
          }
        } else {
          // CA3: Actualizar con findByIdAndUpdate
          const actualizado = await Recurso.findByIdAndUpdate(
            recursoBuscado._id,
            {
              ...datosProcesados,
              ...imagenUpdate,
              estado: nuevoEstado,
              publicado: seraPublicado,
              publicado_en: publicadoEn,
              actualizado_en: new Date(),
            },
            { new: true, runValidators: true, context: 'query' }
          );

          if (actualizado) {
            exitosos += 1;
            if (actualizado.publicado) publicados += 1;

            detalles.push({
              nombreArchivo: registro.nombreArchivoOriginal,
              titulo: actualizado.titulo || 'Sin título',
              publicado: actualizado.publicado,
              accion: 'Actualizado',
              motivo: motivoPendienteStr
            });
          }
        }
      } catch (errActualizar) {
        console.error(
          `[ExcelMetadatos] Error procesando "${registro.nombreArchivoOriginal}":`,
          errActualizar
        );
        errores.push(
          `"${registro.nombreArchivoOriginal}": ${errActualizar.message}`
        );
      }
    }

    // CA-09: Reporte de resultados
    const resultados = {
      procesados: filas.length,
      exitosos,
      publicados: req.body.auto_publicar === 'true' ? publicados : 0,
      errores,
      detalles,
    };

    return res.render('admin/recursos/excel-metadatos', {
      title: 'Importar metadatos — Resultados',
      resultados,
    });
  } catch (error) {
    next(error);
  }
};
