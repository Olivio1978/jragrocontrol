// ============ JR AGROCONTROL — src/lib/permisos.js v1.1 ============
// v1.1: se agregan los helpers del módulo Cosecha y Empaque, que trajo
// cuatro roles nuevos (carretillero, empaque, chofer, regador). Mismo
// criterio que esAdmin: un solo lugar donde vive la regla, para que al
// agregar un rol no haya que buscar comparaciones sueltas por el código.
//
// Punto único de verdad para verificar privilegios de administrador.
// superadmin (dueño de la plataforma, ve todas las empresas) siempre
// cuenta como admin para efectos de acceso a pantallas y catálogos.

export function esAdmin(usuarioActual) {
  return usuarioActual?.rol === "admin" || usuarioActual?.rol === "superadmin";
}

// Encargado de rancho: abre el día, asigna túneles y zonas, resuelve
// incidencias. El admin puede hacer todo lo del encargado.
export function esEncargado(usuarioActual) {
  return esAdmin(usuarioActual) || usuarioActual?.rol === "encargado";
}

// Quién puede registrar cubetas o cajas cortadas. El encargado entra
// aquí porque hay ranchos sin carretillero, donde él mismo captura.
export function puedeCapturarCorte(usuarioActual) {
  return esEncargado(usuarioActual)
    || usuarioActual?.rol === "carretillero"
    || usuarioActual?.rol === "empaque";
}

// Quién recibe viajes en empaque y cuenta cajas por empacadora.
export function puedeCapturarEmpaque(usuarioActual) {
  return esEncargado(usuarioActual) || usuarioActual?.rol === "empaque";
}

// Quién acepta la carga y captura la boleta del cooler.
export function puedeCapturarEntregas(usuarioActual) {
  return esEncargado(usuarioActual)
    || usuarioActual?.rol === "empaque"
    || usuarioActual?.rol === "chofer";
}

// Quién registra aplicaciones de fertilizante por sector.
export function puedeCapturarRiego(usuarioActual) {
  return esEncargado(usuarioActual) || usuarioActual?.rol === "regador";
}

// Solo lectura: el agrónomo externo consulta reportes sin capturar nada.
export function esSoloLectura(usuarioActual) {
  return usuarioActual?.rol === "agronomo_externo";
}

// Pestaña con la que conviene abrir el módulo según el rol, para que
// cada quien caiga directo en su pantalla de trabajo.
export function pestanaInicialCosecha(usuarioActual) {
  switch (usuarioActual?.rol) {
    case "carretillero": return "corte";
    case "empaque":      return "empaque";
    case "chofer":       return "entregas";
    default:             return "dia";
  }
}
