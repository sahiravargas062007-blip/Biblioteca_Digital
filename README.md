# 📚 Biblioteca Digital SENA

Sistema web de gestión de biblioteca para el SENA que permite administrar recursos bibliográficos físicos y digitales, préstamos, reservas, sanciones y notificaciones. Está orientado a aprendices, instructores y funcionarios autenticados mediante LDAP institucional.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Inicialización de la base de datos](#inicialización-de-la-base-de-datos)
- [Ejecución](#ejecución)
- [Roles y accesos](#roles-y-accesos)
- [Módulos principales](#módulos-principales)
- [Tareas automáticas](#tareas-automáticas)
- [Almacenamiento de archivos](#almacenamiento-de-archivos)
- [Colecciones de la base de datos](#colecciones-de-la-base-de-datos)

---

## Características

- Catálogo de recursos físicos, digitales y mixtos (libros, revistas, tesis, audiolibros, videos)
- Autenticación de usuarios vía LDAP institucional (con modo mock para desarrollo)
- Autenticación independiente para administradores con contraseña encriptada
- Préstamos físicos y digitales con control de licencias y usuarios simultáneos
- Cola de reservas con asignación automática por turno
- Sistema de sanciones configurable por tipo de incidencia y gravedad
- Notificaciones internas y envío de correos automáticos con Nodemailer
- Carga masiva de recursos desde archivo ZIP
- Búsqueda de metadatos por ISBN usando Open Library API
- Generación de reportes exportables en PDF y Excel
- Tareas automáticas diarias con node-cron
- Visor integrado de ePub en el navegador
- Descarga directa de PDF, MP3 y MP4 con nombre legible
- Panel de configuración de reglas de negocio desde la interfaz

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Servidor | Node.js + Express |
| Vistas | EJS + CSS + JavaScript |
| Base de datos | MongoDB + Mongoose |
| Almacenamiento archivos | Cloudinary |
| Autenticación usuarios | ldapjs + express-session |
| Contraseña admin | bcryptjs |
| Sesiones persistentes | connect-mongo |
| Correos | Nodemailer + Gmail |
| Duración audio/video | fluent-ffmpeg + ffprobe-static |
| ISBN | Open Library API |
| Excel import/export | xlsx (SheetJS) |
| PDF export | puppeteer |
| Gráficos | Chart.js |
| Carga de archivos | Multer + Cloudinary SDK |
| ZIP masivo | adm-zip |
| Tareas automáticas | node-cron |
| Validaciones | express-validator |
| Seguridad | helmet + express-rate-limit |
| Variables de entorno | dotenv |

---

## Estructura del proyecto

```
biblioteca-digital/
├── app.js                        # Punto de entrada
├── .env                          # Variables de entorno (no subir a Git)
├── .env.example                  # Plantilla de variables
│
├── config/                       # Conexiones externas
│   ├── db.js                     # MongoDB
│   ├── cloudinary.js             # Cloudinary SDK
│   ├── mailer.js                 # Nodemailer
│   ├── ldap.js                   # LDAP real o mock
│   └── session.js                # express-session + connect-mongo
│
├── models/                       # Esquemas Mongoose
├── controllers/
│   ├── admin/                    # Lógica del panel administrador
│   └── user/                     # Lógica del portal usuario
├── routes/
│   ├── admin/                    # Rutas del administrador
│   └── user/                     # Rutas del usuario
├── middlewares/                  # Autenticación, validaciones, errores
├── services/                     # Lógica reutilizable desacoplada
├── jobs/                         # Tareas automáticas con node-cron
├── views/                        # Plantillas EJS
│   ├── layouts/
│   ├── partials/
│   ├── admin/
│   └── user/
├── public/                       # Archivos estáticos
│   ├── css/
│   ├── js/
│   └── img/
└── scripts/
    └── initDb.js                 # Script de inicialización de la BD
```

---

## Requisitos previos

- [Node.js](https://nodejs.org) v18 o superior
- [MongoDB](https://www.mongodb.com) local o acceso a MongoDB Atlas
- Cuenta gratuita en [Cloudinary](https://cloudinary.com)
- Cuenta de Gmail con [contraseña de aplicación](https://myaccount.google.com/apppasswords) habilitada

---

## Instalación

**1. Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/biblioteca-digital.git
cd biblioteca-digital
```

**2. Instalar dependencias**

```bash
npm install
```

**3. Crear el archivo de variables de entorno**

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales (ver sección siguiente).

---

## Variables de entorno

```env
# Entorno
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Base de datos
MONGODB_URI=mongodb://127.0.0.1:27017/biblioteca_digital

# Sesión
SESSION_SECRET=una_clave_muy_larga_y_segura

# LDAP — usar "mock" para desarrollo local, "real" para producción
LDAP_MODE=mock
LDAP_URL=ldap://ldap.example.com:389
LDAP_BASE_DN=dc=sena,dc=edu,dc=co
LDAP_BIND_DN=cn=reader,dc=sena,dc=edu,dc=co
LDAP_BIND_PASSWORD=tu_password_ldap

# Cloudinary
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Correo Gmail
GMAIL_USER=tu_correo@gmail.com
GMAIL_APP_PASSWORD=tu_contraseña_de_aplicacion

# Tareas automáticas (false en desarrollo, true en producción)
CRON_ENABLED=false
```

> **Nota:** `LDAP_MODE=mock` hace que el sistema use usuarios de prueba almacenados en la base de datos local en lugar de conectarse al servidor LDAP del SENA. Es el modo correcto para desarrollo.

---

## Inicialización de la base de datos

Antes de iniciar el servidor por primera vez ejecuta el script de inicialización. Este crea las colecciones, los índices, el administrador por defecto y usuarios mock de prueba:

```bash
npm run init-db
```

Credenciales del administrador creado por defecto:

```
Correo:     admin@biblioteca.sena.edu.co
Contraseña: Admin123*
```

> Cambia la contraseña inmediatamente después del primer inicio de sesión.

---

## Ejecución

**Modo desarrollo** (reinicia automáticamente al guardar cambios):

```bash
npm run dev
```

**Modo producción:**

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

---

## Roles y accesos

El sistema tiene dos roles completamente separados con sus propias rutas, vistas y sesiones.

**Administrador** — accede por `/admin/login`
- Gestión completa de recursos, categorías y ejemplares
- Registro y gestión de préstamos y devoluciones
- Gestión de reservas y cola de espera
- Aplicar y levantar sanciones
- Ver y aprobar usuarios entrantes del LDAP
- Configurar reglas de negocio del sistema
- Generar reportes y exportar en PDF/Excel

**Usuario (Aprendiz / Instructor / Funcionario)** — accede por `/login`
- Autenticación con credenciales institucionales LDAP
- Explorar el catálogo y buscar recursos
- Ver detalle, descargar o leer recursos digitales
- Ver préstamos activos e historial
- Gestionar reservas propias
- Ver sanciones activas
- Editar datos de contacto

---

## Módulos principales

### Recursos
Los recursos pueden ser físicos, digitales o mixtos. Los digitales soportan PDF, ePub, MP3 y MP4. Al crear un recurso digital el archivo se sube automáticamente a Cloudinary con nombre legible. Los ePub se visualizan dentro de la plataforma; los demás formatos se descargan directamente.

### Préstamos
Un préstamo puede incluir varios recursos al mismo tiempo (hasta el límite configurado). Cada ítem tiene su propio estado, fecha límite y lógica de renovación. El estado general del préstamo se calcula automáticamente a partir del estado de sus ítems.

### Reservas
Cuando un recurso no está disponible el usuario puede reservarlo. El sistema lo ubica en una cola ordenada por posición. Cuando el recurso queda libre, el siguiente en la cola recibe una notificación y tiene un tiempo límite para reclamarlo.

### Sanciones
Las sanciones se generan automáticamente al registrar una devolución tardía, con daño o pérdida. El tipo y duración de la sanción se determina según las reglas configuradas por el administrador. Las sanciones activas bloquean nuevos préstamos.

### Configuración
Desde el panel de administración se pueden ajustar sin tocar código: límites de préstamos por usuario, tiempos por categoría, días de tolerancia, reglas de sanción, límites de reservas y tiempo máximo de espera en cola.

---

## Tareas automáticas

Se ejecutan diariamente cuando `CRON_ENABLED=true`. En desarrollo están desactivadas por defecto.

| Job | Descripción |
|---|---|
| `verificarVencimientos` | Marca como vencidos los préstamos que superaron su fecha límite |
| `verificarReservas` | Expira reservas cuyo tiempo de reclamo venció y avanza la cola |
| `enviarRecordatorios` | Envía correos a usuarios con préstamos próximos a vencer |

---

## Almacenamiento de archivos

Todos los archivos (portadas, PDFs, ePubs, MP3, MP4) se almacenan en Cloudinary. El sistema organiza los archivos en carpetas según su tipo:

```
biblioteca/
├── portadas/       ← imágenes de portada
├── pdf/            ← libros y documentos PDF
├── epub/           ← libros ePub para lectura en línea
├── mp3/            ← audiolibros
└── mp4/            ← videos
```

Los archivos PDF, MP3 y MP4 se entregan con el nombre del recurso para que la descarga sea legible. Los ePub se sirven para lectura en línea usando el visor epub.js integrado en la plataforma.

---

## Colecciones de la base de datos

| # | Colección | Propósito |
|---|---|---|
| 1 | `ldap_mock` | Usuarios simulados del LDAP para desarrollo |
| 2 | `administradores` | Credenciales propias del sistema |
| 3 | `usuarios` | Aprendices registrados vía LDAP |
| 4 | `categorias` | Categorías y subcategorías con código Dewey |
| 5 | `recursos` | Materiales bibliográficos (digital, físico o mixto) |
| 6 | `ejemplares` | Ejemplares físicos individuales con su estado |
| 7 | `prestamos` | Préstamos con sus ítems individuales |
| 8 | `reservas` | Cola de espera por recurso |
| 9 | `sanciones` | Sanciones activas e historial |
| 10 | `notificaciones` | Notificaciones internas y registro de correos |
| 11 | `configuracion` | Reglas de negocio globales del sistema |
| 12 | `sesiones` | Sesiones activas (gestionada por connect-mongo) |
| 13 | `jobs_log` | Registro de ejecución de tareas automáticas |

---

## Licencia

Proyecto académico desarrollado para el SENA. Uso interno institucional.