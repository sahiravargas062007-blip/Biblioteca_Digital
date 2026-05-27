/**
 * notificacionService.js
 * Centraliza la creación de notificaciones internas + envío de correo.
 * Importar desde cualquier controlador o job con:
 *   const notifService = require('../services/notificacionService');
 *   await notifService.prestamoAprobado(usuario, prestamo, items);
 */

const Notificacion = require('../models/Notificacion');
const mailService = require('./mailService');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ── Utilidad interna ──────────────────────────────────────────────────────
// Crea la notificación en BD y envía correo de forma concurrente.
// Si el correo falla, guarda el error pero no lanza excepción.
async function _crear({
    destinatario_tipo,
    destinatario_id,
    correo,           // dirección de correo del destinatario
    tipo,
    titulo,
    mensaje,
    referencia_tipo = null,
    referencia_id = null,
    enlace = APP_URL,
    nombre_usuario = ''
}) {
    const ahora = new Date();

    // 1. Crear notificación interna
    const notif = await Notificacion.create({
        destinatario_tipo,
        destinatario_id,
        tipo,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id,
        leida: false,
        correo_enviado: false,
        creado_en: ahora
    });

    // 2. Enviar correo si hay dirección válida
    if (correo && correo.includes('@')) {
        try {
            await mailService.enviarCorreo({
                to: correo,
                subject: titulo,
                html: _plantillaHtml({ nombre_usuario, titulo, mensaje, enlace }),
                text: `${titulo}\n\n${mensaje}\n\nAccede aquí: ${enlace}`
            });
            await Notificacion.findByIdAndUpdate(notif._id, {
                correo_enviado: true,
                correo_enviado_en: new Date()
            });
        } catch (err) {
            await Notificacion.findByIdAndUpdate(notif._id, {
                correo_error: String(err.message || err).slice(0, 300)
            });
        }
    }

    return notif;
}

// ── Plantilla HTML del correo ─────────────────────────────────────────────
function _plantillaHtml({ nombre_usuario, titulo, mensaje, enlace }) {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Encabezado -->
        <tr>
          <td style="background:#146c5f;padding:28px 32px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">BiblioNet</p>
            <p style="margin:4px 0 0;color:#a8d8d0;font-size:13px;">Conecta con el conocimiento</p>
          </td>
        </tr>
        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#146c5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Notificación</p>
            <h2 style="margin:0 0 16px;color:#17202a;font-size:20px;">${titulo}</h2>
            ${nombre_usuario ? `<p style="margin:0 0 12px;color:#667085;font-size:14px;">Hola, <strong>${nombre_usuario}</strong></p>` : ''}
            <p style="margin:0 0 28px;color:#444;font-size:15px;line-height:1.6;">${mensaje}</p>
            <a href="${enlace}" style="display:inline-block;background:#146c5f;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              Ir a la plataforma →
            </a>
          </td>
        </tr>
        <!-- Pie -->
        <tr>
          <td style="background:#f4f6f8;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Este correo fue enviado automáticamente por BiblioNet. Por favor no respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTOS DE USUARIO (RN3)
// ═══════════════════════════════════════════════════════════════════════════

// CA evento: préstamo aprobado (físico registrado por admin o digital auto)
exports.prestamoAprobado = async (usuario, prestamo, titulosItems) => {
    const titulo = String(titulosItems[0] || 'recurso');
    const resto = titulosItems.length > 1 ? ` y ${titulosItems.length - 1} más` : '';
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'prestamo_aprobado',
        titulo: '📚 Préstamo registrado',
        mensaje: `Se ha registrado un préstamo de "${titulo}"${resto}. Recuerda devolverlo a tiempo.`,
        referencia_tipo: 'prestamo',
        referencia_id: prestamo._id,
        enlace: `${APP_URL}/prestamos`
    });
};

// CA1: próximo a vencer (lo llama el job enviarRecordatorios)
exports.proximoVencimiento = async (usuario, prestamo, item) => {
    const limite = new Date(item.fecha_limite).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'proximo_vencimiento',
        titulo: '⏰ Tu préstamo vence mañana',
        mensaje: `El recurso "${item.recurso_titulo}" vence el ${limite}. Devuélvelo a tiempo para evitar sanciones.`,
        referencia_tipo: 'prestamo',
        referencia_id: prestamo._id,
        enlace: `${APP_URL}/prestamos`
    });
};

// Préstamo vencido (lo llama verificarVencimientos)
exports.recursoVencido = async (usuario, prestamo, item) => {
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'recurso_vencido',
        titulo: '🚨 Préstamo vencido',
        mensaje: `El préstamo de "${item.recurso_titulo}" ha vencido. Por favor regulariza tu situación para evitar sanciones mayores.`,
        referencia_tipo: 'prestamo',
        referencia_id: prestamo._id,
        enlace: `${APP_URL}/prestamos`
    });
};

// CA2: sanción registrada
exports.sancionRegistrada = async (usuario, sancion) => {
    const detalle = sancion.tipo_sancion === 'Suspensión'
        ? `Suspensión de ${sancion.dias_suspension} días`
        : sancion.tipo_sancion;
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'sancion_registrada',
        titulo: '⚠️ Se ha registrado una sanción en tu cuenta',
        mensaje: `Se registró una sanción de tipo "${detalle}" por "${sancion.tipo_incidencia}" en el recurso "${sancion.recurso_titulo}". ${sancion.observaciones || ''}`,
        referencia_tipo: 'sancion',
        referencia_id: sancion._id,
        enlace: `${APP_URL}/sanciones`
    });
};

// Devolución confirmada
exports.devolucionConfirmada = async (usuario, prestamo, item) => {
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'devolucion_confirmada',
        titulo: '✅ Devolución confirmada',
        mensaje: `La devolución de "${item.recurso_titulo}" ha sido registrada correctamente. ¡Gracias!`,
        referencia_tipo: 'prestamo',
        referencia_id: prestamo._id,
        enlace: `${APP_URL}/historial`
    });
};

// Renovación confirmada
exports.renovacionConfirmada = async (usuario, prestamo, item) => {
    const nuevaFecha = new Date(item.nueva_fecha_limite || item.fecha_limite)
        .toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'renovacion_confirmada',
        titulo: '🔄 Renovación confirmada',
        mensaje: `El préstamo de "${item.recurso_titulo}" ha sido renovado. Nueva fecha límite: ${nuevaFecha}.`,
        referencia_tipo: 'prestamo',
        referencia_id: prestamo._id,
        enlace: `${APP_URL}/prestamos`
    });
};

// CA3: turno de reserva disponible
exports.turnoReservaDisponible = async (usuario, reserva, horasLimite) => {
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'turno_reserva_disponible',
        titulo: '🔔 ¡Tu turno de reserva está disponible!',
        mensaje: `El recurso "${reserva.recurso_titulo}" ya está disponible para ti. Tienes ${horasLimite} horas para reclamarlo antes de que pase al siguiente en la cola.`,
        referencia_tipo: 'reserva',
        referencia_id: reserva._id,
        enlace: `${APP_URL}/reservas`
    });
};

// Reserva expirada (ya existe en verificarReservas, pero centralizado aquí)
exports.reservaExpirada = async (usuario, reserva) => {
    await _crear({
        destinatario_tipo: 'usuario',
        destinatario_id: usuario._id,
        correo: usuario.correo,
        nombre_usuario: usuario.nombre,
        tipo: 'reserva_expirada',
        titulo: '❌ Reserva expirada',
        mensaje: `Tu reserva del recurso "${reserva.recurso_titulo}" ha expirado porque no fue reclamada a tiempo.`,
        referencia_tipo: 'reserva',
        referencia_id: reserva._id,
        enlace: `${APP_URL}/catalogo`
    });
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENTOS DE ADMINISTRADOR (RN4)
// ═══════════════════════════════════════════════════════════════════════════

// CA4: nuevo usuario pendiente de aprobación
exports.nuevoUsuarioPendiente = async (adminId, usuarioNombre, usuarioId) => {
    await _crear({
        destinatario_tipo: 'administrador',
        destinatario_id: adminId,
        correo: null,           // no se envía correo al admin (RN2: mismo evento, mismo canal)
        tipo: 'nuevo_usuario_pendiente',
        titulo: '👤 Nuevo usuario pendiente de aprobación',
        mensaje: `El usuario "${usuarioNombre}" ha iniciado sesión por primera vez y espera aprobación para acceder al sistema.`,
        referencia_tipo: 'usuario',
        referencia_id: usuarioId,
        enlace: `${APP_URL}/admin/usuarios`
    });
};

// Recursos próximos a vencer (licencia digital)
exports.recursosProximosVencer = async (adminId, recursos) => {
    const lista = recursos.map(r => `• ${r.titulo}`).join('\n');
    await _crear({
        destinatario_tipo: 'administrador',
        destinatario_id: adminId,
        correo: null,
        tipo: 'recursos_proximos_vencer',
        titulo: `📋 ${recursos.length} recurso(s) con licencia próxima a vencer`,
        mensaje: `Los siguientes recursos digitales tienen licencia que vence en los próximos 30 días:\n${lista}`,
        referencia_tipo: null,
        enlace: `${APP_URL}/admin/recursos`
    });
};

// Reserva sin siguiente usuario en cola
exports.reservaSinSiguienteUsuario = async (adminId, reserva) => {
    await _crear({
        destinatario_tipo: 'administrador',
        destinatario_id: adminId,
        correo: null,
        tipo: 'reserva_sin_siguiente_usuario',
        titulo: '📭 Reserva expirada sin cola',
        mensaje: `La reserva del recurso "${reserva.recurso_titulo}" expiró y no hay más usuarios en cola. El recurso vuelve a estar disponible sin reserva.`,
        referencia_tipo: 'reserva',
        referencia_id: reserva._id,
        enlace: `${APP_URL}/admin/reservas`
    });
};
