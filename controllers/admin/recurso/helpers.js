const {
  subirBuffer,
  subirBufferGrande,
} = require('../../../services/cloudinaryService');

// ── Umbral para usar upload chunked (archivos > 90 MB van por chunks) ──────
const UMBRAL_CHUNKED = 90 * 1024 * 1024;

// ── Tipos de archivo que necesitan chunked upload (videos generalmente) ────
const VIDEO_EXTS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv']);

// ── Extensiones válidas de imagen / portada ─────────────────────────────
// (declarada para uso futuro en validación de portadas; no se usa todavía)
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

// ── Upload Preset de Cloudinary (RN5) ───────────────────────────────────
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'Biblioteca_name';

// ── Resource type correcto para Cloudinary según extensión ──────────────
function cloudinaryResourceType(ext) {
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4b', 'm4a', 'ogg', 'aac', 'flac', 'wma'].includes(ext)) return 'video';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'raw';
}

// ── Extensión desde mimetype ─────────────────────────────────────────────
function extFromMime(mime) {
  const map = {
    'application/pdf':      'pdf',
    'application/epub+zip': 'epub',
    'audio/mpeg':           'mp3',
    'audio/mp4':            'm4a',
    'audio/wav':            'wav',
    'audio/ogg':            'ogg',
    'audio/aac':            'aac',
    'audio/flac':           'flac',
    'video/mp4':            'mp4',
    'video/webm':           'webm',
    'video/avi':            'avi',
    'video/quicktime':      'mov',
  };
  return map[mime] || 'bin';
}

// ── Genera public_id limpio para Cloudinary ──────────────────────────────
function generarPublicId(titulo, carpeta) {
  const nombre = String(titulo || 'recurso')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .slice(0, 60);
  return `biblioteca/${carpeta}/${nombre}_${Date.now()}`;
}

// ── Sube archivo a Cloudinary (automáticamente elige normal o chunked) ──
async function subirArchivoCloudinary(fileBuffer, originalname, mimetype, titulo) {
  const ext = originalname.includes('.')
    ? originalname.split('.').pop().toLowerCase()
    : extFromMime(mimetype);

  const resourceType = cloudinaryResourceType(ext);
  const publicId     = generarPublicId(titulo, ext);
  const options      = {
    resource_type: resourceType,
    public_id:     publicId,
    upload_preset: UPLOAD_PRESET,   // RN5: preset en todas las subidas
  };

  // Archivos de video grandes → chunked upload para evitar timeout
  const usarChunked =
    VIDEO_EXTS.has(ext) || fileBuffer.length > UMBRAL_CHUNKED;

  const result = usarChunked
    ? await subirBufferGrande(fileBuffer, options)
    : await subirBuffer(fileBuffer, options);

  return {
    url:          result.secure_url,
    public_id:    result.public_id,
    tamano_bytes: result.bytes || fileBuffer.length,
    ext,
  };
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function normalizarTexto(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeTipoMaterial(value) {
  const raw = String(value || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase();

  const tipoMap = {
    libro: 'Libro',
    revista: 'Revista',
    tesis: 'Tesis',
    articulo: 'Artículo',
    'articulo': 'Artículo',
    'ley y normativa': 'Ley y Normativa',
    normativa: 'Ley y Normativa',
    ley: 'Ley y Normativa',
    mapa: 'Mapa',
    audiolibro: 'Audiolibro',
    audio: 'Audiolibro',
    video: 'Video',
  };

  for (const [key, mapped] of Object.entries(tipoMap)) {
    if (normalized === key || normalized.includes(key)) {
      return mapped;
    }
  }

  const allowed = [
    'Libro',
    'Revista',
    'Tesis',
    'Artículo',
    'Ley y Normativa',
    'Mapa',
    'Audiolibro',
    'Video',
  ];

  return allowed.includes(raw) ? raw : null;
}

function buildFlexibleTextRegex(text) {
  const normalized = normalizeSearchKey(text);
  if (!normalized) return null;

  const pattern = normalized
    .split('')
    .map((char) => escapeRegExp(char))
    .join('[^a-z0-9]*');

  return new RegExp(pattern, 'i');
}

function prefixFromCategoria(categoriaNombre) {
  const normalized = normalizarTexto(categoriaNombre);
  return (normalized.slice(0, 3) || 'REC').padEnd(3, 'X');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeTipoNaturaleza(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (normalized === 'fisico') return 'Físico';
  if (normalized === 'mixto') return 'Mixto';
  return 'Digital';
}

function nombreBase(filename) {
  const parts = String(filename || '').split('/');
  const name = parts[parts.length - 1];
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return name;
  return name.slice(0, dotIdx);
}

function tipoArchivoFromExt(ext) {
  return String(ext || '').toLowerCase().trim();
}

function materialFromContenido(tipoContenido) {
  if (tipoContenido === 'Audio') return 'Audiolibro';
  if (tipoContenido === 'Video') return 'Video';
  return 'Libro';
}

module.exports = {
  UMBRAL_CHUNKED,
  VIDEO_EXTS,
  IMAGE_EXTS,
  UPLOAD_PRESET,
  cloudinaryResourceType,
  extFromMime,
  generarPublicId,
  subirArchivoCloudinary,
  flash,
  normalizarTexto,
  escapeRegExp,
  normalizeSearchKey,
  normalizeTipoMaterial,
  buildFlexibleTextRegex,
  prefixFromCategoria,
  asArray,
  normalizeTipoNaturaleza,
  nombreBase,
  tipoArchivoFromExt,
  materialFromContenido,
};
