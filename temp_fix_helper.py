from pathlib import Path
p = Path('controllers/admin/recursoController.js')
text = p.read_text(encoding='utf-8')
old = "function normalizeTipoMaterial(value) {\n  const raw = String(value || '').trim();\n  const normalized = raw\n    .normalize('NFD')\n    .replace(/[-f]/g, '')\n    .replace(/[-f]/g, '')\n    .replace(/[-f]/g, '')\n    .replace(/[-f]/g, '')\n    .toLowerCase();\n\n  const tipoMap = {"
new = "function normalizeTipoMaterial(value) {\n  const raw = String(value || '').trim();\n  const normalized = raw\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .replace(/[^a-zA-Z0-9\\s]/g, '')\n    .toLowerCase();\n\n  const tipoMap = {"
if old not in text:
    raise SystemExit('Old helper block not found')
text = text.replace(old, new)
p.write_text(text, encoding='utf-8')
print('helper block patched')
