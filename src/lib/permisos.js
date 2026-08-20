// ============ JR AGROCONTROL — src/lib/permisos.js v1.0 ============
// Punto único de verdad para verificar privilegios de administrador.
// superadmin (dueño de la plataforma, ve todas las empresas) siempre
// cuenta como admin para efectos de acceso a pantallas y catálogos.
//
// Usar esta función en vez de comparar usuarioActual.rol !== "admin"
// directamente en cada módulo — así, si en el futuro se agrega otro
// rol con privilegios de administrador, solo se ajusta aquí.

export function esAdmin(usuarioActual) {
  return usuarioActual?.rol === "admin" || usuarioActual?.rol === "superadmin";
}
