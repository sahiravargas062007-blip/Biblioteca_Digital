# Arquitectura CSS - Biblioteca Digital

## Descripción General

La arquitectura CSS está organizada en capas lógicas sin archivos largos ni estilos inline en los EJS. Cada archivo CSS tiene una responsabilidad específica.

---

## Estructura de Carpetas

```
public/css/
├── main.css                    # Base global (variables, reset, utilidades)
├── admin.css                   # Estilos base del panel admin
├── user.css                    # Estilos base del área de usuario
├── components/                 # Componentes reutilizables
│   ├── forms.css              # Formularios
│   ├── tables.css             # Tablas
│   ├── badges.css             # Insignias/etiquetas
│   ├── cards.css              # Tarjetas
│   └── modals.css             # Modales
└── pages/                      # Estilos específicos de páginas
    ├── admin-dashboard.css    # Dashboard del administrador
    └── admin-recursos.css     # Gestión de recursos (nuevo, masivo, excel)
```

---

## Capas de CSS (Orden de Carga)

### 1. **Base Global** (`main.css`)
- Variables CSS (colores, espacios, bordes, radios)
- Reset CSS
- Estilos generales de body, links, botones
- Clases utilidad

### 2. **Componentes** (`components/*.css`)
Componentes reutilizables que se usan en múltiples páginas:
- `forms.css` - Inputs, labels, validaciones
- `tables.css` - Tablas estándar
- `badges.css` - Badges/etiquetas
- `cards.css` - Tarjetas
- `modals.css` - Modales y diálogos

### 3. **Tema** (`admin.css` o `user.css`)
Estilos específicos del área (admin/usuario):
- Admin: sidebar, layout grid, tema oscuro
- User: navbar, tema claro

### 4. **Páginas Específicas** (`pages/*.css`) *(Opcional)*
Estilos únicos de páginas complejas:
- `admin-dashboard.css` - Solo para dashboard
- `admin-recursos.css` - Solo para gestión de recursos

---

## Archivo EJS - Estructura de Carga de CSS

### Patrón 1: Usando Partials (Archivos comunes)
```ejs
<%- include('../../partials/adminPageStart', { pageStylesheet: 'admin-dashboard.css' }) %>
  <!-- Contenido específico de la página -->
<%- include('../../partials/adminPageEnd') %>
```

### Patrón 2: Estructura HTML Completa (Páginas especiales)
```ejs
<!doctype html>
<html lang="es">
<head>
  <!-- CSS Base -->
  <link rel="stylesheet" href="/css/main.css">
  <!-- Componentes -->
  <link rel="stylesheet" href="/css/components/forms.css">
  <!-- Tema -->
  <link rel="stylesheet" href="/css/admin.css">
  <!-- Página específica (si aplica) -->
  <link rel="stylesheet" href="/css/pages/admin-dashboard.css">
</head>
<body class="admin-shell">
  <!-- Contenido -->
</body>
</html>
```

---

## Archivos Actualizados

### Partials (Cargan CSS automáticamente)
- `views/partials/adminPageStart.ejs` - Carga admin base + components + opcional page-specific
- `views/partials/userPageStart.ejs` - Carga user base + components + opcional page-specific

### Archivos EJS con Estructura Propia
- `views/admin/dashboard.ejs` - Carga `admin-dashboard.css`
- `views/admin/recursos/nuevo.ejs` - Carga `admin-recursos.css`
- `views/admin/recursos/masivo.ejs` - Carga `admin-recursos.css`
- `views/admin/recursos/excel-metadatos.ejs` - Carga `admin-recursos.css`

---

## Notas Importantes

✅ **Realizado:**
- ✓ No hay archivos CSS largos (máximo ~200 líneas)
- ✓ No hay CSS dentro de archivos EJS
- ✓ Todo usa `main.css` como base
- ✓ Estilos organizados por responsabilidad
- ✓ Reutilización de componentes

**Futuros CSS de página:**
Si necesitas agregar estilos para más páginas, crea archivos en `pages/`:
- `pages/admin-[feature].css` para features de admin
- `pages/user-[feature].css` para features de usuario

---

## Cómo Mantener la Arquitectura

1. **Nuevas páginas simples** → Usa los partials si es posible
2. **Nuevas páginas con estilos complejos** → Crea `pages/[nombre].css` y referencia en el EJS
3. **Componentes reutilizables** → Agrégalos a `components/`
4. **Cambios globales** → Modifica `main.css`, `admin.css` o `user.css`
