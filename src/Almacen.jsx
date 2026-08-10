// ============ JR AGROCONTROL — Almacen.jsx v0.3.25 ============
// Módulo Almacén: existencias, entradas/ajustes, traspasos con confirmación
// de recepción y catálogo completo de productos e insumos.
// Patrón visual y de sesión tomado de Labores.jsx v0.2.5.
//
// v0.3.21 — Buscador de fitosanitarios filtrado por la lista autorizada
// activa del rancho (ANEBERRIES / comercializadora), en vez del <select>
// plano con todo el catálogo. Alta de fitosanitario ahora distingue entre
// "buscar en la lista autorizada" (catálogo ya cargado, solo lectura) y
// "agregar fuera de lista" (biorracionales caseros sin riesgo de auditoría,
// requieren justificación). Ver campo en_lista_oficial en productos_fitosanitarios.
//
// v0.3.22 — En "Buscar en lista autorizada", seleccionar un producto ahora
// sí hace algo: abre su ficha completa (misma vista de solo lectura + precio
// editable que ya existía en Editar), en vez de ser solo una lista sin clic.
//
// v0.3.23 — El formulario de "fuera de lista" ahora captura los mismos campos
// relevantes que trae la lista oficial: concentración, dosis general,
// intervalo de seguridad, periodo de reentrada y observaciones de uso
// (sin LMR, por acuerdo). Nuevas columnas en productos_fitosanitarios.
//
// v0.3.24 — Los datos de uso de productos "fuera de lista" (dosis, intervalos,
// observaciones/justificación) ya NO viven en columnas nuevas de
// productos_fitosanitarios — se guardan como filas normales de listas_productos,
// bajo una lista especial "Productor — Fuera de lista oficial" (una por
// especie, creada en v0.4.40). Misma estructura que ya usan los productos de
// ANEBERRIES, sin duplicar conceptos. productos_fitosanitarios se queda solo
// con lo intrínseco del químico + en_lista_oficial como bandera rápida.
//
// v0.3.25 — Todas las recargas de datos tras guardar (cargarDatos) ahora se
// esperan con await antes de cerrar el formulario, para evitar que el
// formulario de edición se abra con datos todavía no refrescados.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";

// ---- Utilidades de fecha para la pestaña de reportes ----
function todayISOAlmacen() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}
function hace30dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

// ============ CONSTANTES ============
const TIPOS_ENTRADA = [
  { value: "entrada_compra",   label: "🛒 Compra" },
  { value: "entrada_donacion", label: "🎁 Donación / muestra" },
  { value: "ajuste_entrada",   label: "➕ Ajuste de entrada (sobrante)" },
  { value: "ajuste_salida",    label: "➖ Ajuste de salida (merma)" },
];

const CATEGORIAS = [
  { value: "nutricional",    label: "Nutricional" },
  { value: "fitosanitario",  label: "Fitosanitario" },
  { value: "bioestimulante", label: "Bioestimulante" },
  { value: "coadyuvante",    label: "Coadyuvante" },
];

const ELEMENTOS = [
  ["pct_n", "N"], ["pct_p", "P"], ["pct_k", "K"],
  ["pct_ca", "Ca"], ["pct_mg", "Mg"], ["pct_s", "S"],
];
const MICROS = [
  ["pct_zn", "Zn"], ["pct_mn", "Mn"], ["pct_fe", "Fe"],
  ["pct_cu", "Cu"], ["pct_b", "B"],
];

const FORM_PRODUCTO_INICIAL = {
  nombre_comercial: "", marca: "", categoria: "nutricional",
  via_fertirriego: false, via_foliar: false, via_suelo: false,
  pct_n: "", pct_p: "", pct_k: "", pct_ca: "", pct_mg: "", pct_s: "",
  pct_zn: "", pct_mn: "", pct_fe: "", pct_cu: "", pct_b: "",
  unidad_base: "kg", presentacion: "", contenido_presentacion: "", costo_unitario: "",
};

// Formulario simplificado para fitosanitarios "fuera de lista" (biorracionales
// caseros u otros que no están en ANEBERRIES pero no representan riesgo de
// auditoría por no contener moléculas restringidas).
const FORM_FITO_FUERA_LISTA_INICIAL = {
  nombre_comercial: "", marca: "", ingrediente_activo: "", concentracion_ia: "",
  tipo_fitosanitario: "biorracional", unidad_base: "l",
  dosis_recomendada: "", intervalo_seguridad_horas: "", intervalo_reentrada: "", observaciones: "",
  costo_unitario: "", justificacion_fuera_lista: "",
};

const TIPOS_FITOSANITARIO = [
  { value: "insecticida", label: "Insecticida" },
  { value: "fungicida", label: "Fungicida" },
  { value: "herbicida", label: "Herbicida" },
  { value: "biorracional", label: "Biorracional" },
  { value: "regulador_crecimiento", label: "Regulador de crecimiento" },
  { value: "rodenticida", label: "Rodenticida" },
];

const ROLES_TXT = {
  admin: "Administrador", encargado: "Encargado",
  agronomo: "Agrónomo", agronomo_externo: "Agrónomo externo",
};

// ============ ESTILOS (patrón Labores) ============
const S = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8f5e0", padding: "20px 16px 40px", boxSizing: "border-box" },
  container: { maxWidth: "640px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.12em", color: "#7fbf5a", marginBottom: "4px", fontWeight: "600" },
  title: { fontSize: "26px", fontWeight: "800", margin: 0, color: "#ffffff" },
  usuarioTag: { fontSize: "11px", color: "rgba(200,230,180,0.45)", marginTop: "4px" },
  headerIcon: { fontSize: "36px" },
  version: { fontSize: "10px", color: "rgba(127,191,90,0.5)", textAlign: "right", marginTop: "2px" },
  btnLogout: { background: "none", border: "none", color: "#e8a23d", fontSize: "11px", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", marginTop: "4px" },
  errorBanner: { background: "rgba(224,92,92,0.15)", border: "1px solid rgba(224,92,92,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "12px", color: "#e05c5c", display: "flex", justifyContent: "space-between", alignItems: "center" },
  okBanner: { background: "rgba(127,191,90,0.12)", border: "1px solid rgba(127,191,90,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "12px", color: "#7fbf5a", display: "flex", justifyContent: "space-between", alignItems: "center" },
  btnCerrarError: { background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px" },
  navTabs: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
  navTab: { flex: "1 1 120px", border: "1.5px solid", borderRadius: "10px", padding: "10px 8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: "transparent", fontFamily: "inherit" },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer", marginBottom: "16px", boxShadow: "0 4px 24px rgba(90,171,46,0.3)", fontFamily: "inherit" },
  btnSecundario: { background: "rgba(127,191,90,0.12)", border: "1.5px solid rgba(127,191,90,0.3)", borderRadius: "10px", padding: "8px 16px", color: "#7fbf5a", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" },
  formGroup: { marginBottom: "16px" },
  formRow: { display: "flex", gap: "12px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" },
  cardRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "rgba(200,230,180,0.8)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  seccionTitulo: { fontSize: "14px", fontWeight: "700", color: "#ffffff", marginBottom: "10px" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  miniTag: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" },
  dropdownBusqueda: { position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", marginTop: "4px", maxHeight: "260px", overflowY: "auto", background: "#0f2818", border: "1px solid rgba(127,191,90,0.35)", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  dropdownItem: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" },
};

// ============ PANTALLA DE LOGIN ============
function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(false);

  const ingresar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setError("Correo o contraseña incorrectos.");
  };

  return (
    <div style={S.page}>
      <div style={{ ...S.container, paddingTop: "60px" }}>
        <div style={S.eyebrow}>JR AGROCONTROL · ALMACÉN</div>
        <h1 style={S.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={S.formGroup}>
            <label style={S.label}>CORREO</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={S.select} required />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>CONTRASEÑA</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={S.select} required />
          </div>
          {error && <p style={{ color: "#e05c5c", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
          <button type="submit" disabled={cargando} style={{ ...S.btnPrimary, marginTop: "20px" }}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============ COMPONENTE PRINCIPAL ============
export default function Almacen() {
  // ---- Sesión ----
  const [sesion, setSesion]             = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError]               = useState(null);
  const [aviso, setAviso]               = useState(null);
  const [cargando, setCargando]         = useState(true);

  // ---- Datos ----
  const [empresaId, setEmpresaId]   = useState(null);
  const [bodegas, setBodegas]       = useState([]);
  const [productos, setProductos]   = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [traspasos, setTraspasos]   = useState([]);
  const [detalles, setDetalles]     = useState([]);

  // ---- Datos para el filtro de fitosanitarios por lista activa del rancho ----
  const [sectores, setSectores]                 = useState([]);
  const [listasProductos, setListasProductos]   = useState([]);
  const [productosFito, setProductosFito]       = useState([]); // productos_fitosanitarios
  const [listas, setListas]                     = useState([]);

  // ---- Vistas ----
  const [pestana, setPestana] = useState("existencias");

  // ---- Formularios ----
  const [mov, setMov] = useState({ tipo: "entrada_compra", bodega_id: "", producto_id: "", cantidad: "", costo: "", notas: "" });
  const [tras, setTras] = useState({ origen: "", destino: "", notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);
  const [confirmando, setConfirmando] = useState(null);
  const [recibidas, setRecibidas] = useState({});

  // ---- Buscador de producto (Entradas/ajustes) ----
  const [buscarProductoMov, setBuscarProductoMov] = useState("");
  const [mostrarBuscadorMov, setMostrarBuscadorMov] = useState(false);

  // ---- Buscador de producto por línea (Traspasos) ----
  const [buscarProductoLinea, setBuscarProductoLinea] = useState({}); // { [indice]: texto }
  const [mostrarBuscadorLinea, setMostrarBuscadorLinea] = useState(null); // indice abierto | null

  // ---- Alta de fitosanitario: elegir catálogo vs fuera de lista ----
  const [modoAltaFito, setModoAltaFito] = useState(null); // null | "buscar" | "nuevo"
  const [buscarFitoCatalogo, setBuscarFitoCatalogo] = useState("");
  const [formFitoNuevo, setFormFitoNuevo] = useState(FORM_FITO_FUERA_LISTA_INICIAL);

  // ---- Catálogo de productos ----
  const [buscar, setBuscar]         = useState("");
  const [filtroCat, setFiltroCat]   = useState("todas");
  const [verInactivos, setVerInactivos] = useState(false);
  const [editandoProd, setEditandoProd] = useState(null);   // null | "nuevo" | id
  const [formProd, setFormProd]     = useState(FORM_PRODUCTO_INICIAL);

  // ---- Reportes ----
  const [repDesde, setRepDesde] = useState(hace30dias());
  const [repHasta, setRepHasta] = useState(todayISOAlmacen());
  const [repBodegaId, setRepBodegaId] = useState("todas");
  const [movConsumo, setMovConsumo] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- 1b. Limpiar estado al cambiar usuario ----
  useEffect(() => {
    setUsuarioActual(null);
    setError(null);
  }, [sesion?.user?.id]);

  // ---- 2. Perfil del usuario ----
  useEffect(() => {
    if (!sesion) return;
    supabase.from("usuarios")
      .select("id, nombre_completo, rol, rancho_id")
      .eq("id", sesion.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setError("Tu usuario no tiene perfil asignado."); return; }
        setUsuarioActual(data);
      });
  }, [sesion]);

  // ---- 3. Datos del módulo ----
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    const [b, p, ex, t, d, sec, lp, pf, lst] = await Promise.all([
      supabase.from("bodegas").select("id, nombre, rancho_id, empresa_id").eq("activo", true).order("nombre"),
      supabase.from("productos_insumos").select("*").order("nombre_comercial"),
      supabase.from("inventario_existencias").select("*"),
      supabase.from("traspasos").select("*").order("fecha_envio", { ascending: false }).limit(50),
      supabase.from("traspaso_detalle").select("*"),
      supabase.from("sectores").select("id, rancho_id, lista_activa_id"),
      supabase.from("listas_productos").select("id, lista_id, producto_fitosanitario_id, plaga_comun, plaga_cientifica, dosis_etiqueta, intervalo_seguridad_horas, intervalo_reentrada, observaciones"),
      supabase.from("productos_fitosanitarios").select("id, producto_id, grupo_quimico, clasificacion_resistencia, tipo_fitosanitario, concentracion_ia, en_lista_oficial"),
      supabase.from("listas").select("id, especie_id, comercializadora_id, fuente"),
    ]);
    setBodegas(b.data || []);
    if (b.data?.length) setEmpresaId(b.data[0].empresa_id);
    setProductos(p.data || []);
    setExistencias(ex.data || []);
    setTraspasos(t.data || []);
    setDetalles(d.data || []);
    setSectores(sec.data || []);
    setListasProductos(lp.data || []);
    setProductosFito(pf.data || []);
    setListas(lst.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { if (usuarioActual) cargarDatos(); }, [usuarioActual, cargarDatos]);

  // ---- Listas "Productor — Fuera de lista oficial" (una por especie, a prueba de futuro) ----
  const listasProductor = listas.filter(l => l.fuente === "Productor — Fuera de lista oficial");


  function avisar(texto) { setAviso(texto); setTimeout(() => setAviso(null), 6000); }

  const esAdmin      = usuarioActual?.rol === "admin";
  const esEncargado  = usuarioActual?.rol === "encargado";
  const soloLectura  = usuarioActual?.rol === "agronomo_externo";
  const bodegaEncargado = esEncargado
    ? bodegas.find(b => b.rancho_id === usuarioActual?.rancho_id) : null;

  const nombreProducto = id => productos.find(p => p.id === id)?.nombre_comercial || "?";
  const unidadProducto = id => productos.find(p => p.id === id)?.unidad_base || "";
  const nombreBodega   = id => bodegas.find(b => b.id === id)?.nombre || "?";
  const productosActivos = productos.filter(p => p.activo);

  // ---- Ficha fitosanitaria de un producto (join client-side con productos_fitosanitarios) ----
  const fitoDeProducto = productoId => productosFito.find(f => f.producto_id === productoId) || null;

  // ---- Lista activa del rancho de una bodega (toma la de sus sectores; hoy es uniforme) ----
  function listaActivaDeRancho(ranchoId) {
    if (!ranchoId) return null;
    const s = sectores.find(s => s.rancho_id === ranchoId && s.lista_activa_id);
    return s ? s.lista_activa_id : null;
  }

  // ---- Productos fitosanitarios autorizados en la lista activa de un rancho ----
  function fitosPermitidosEnRancho(ranchoId) {
    const listaId = listaActivaDeRancho(ranchoId);
    if (!listaId) return new Set(); // sin lista activa: no se restringe por lista (se maneja en el filtro de abajo)
    const idsFito = new Set(listasProductos.filter(lp => lp.lista_id === listaId).map(lp => lp.producto_fitosanitario_id));
    const idsProducto = new Set(
      productosFito.filter(f => idsFito.has(f.id)).map(f => f.producto_id)
    );
    return idsProducto;
  }

  // ---- Filtra el catálogo activo según la bodega seleccionada (para los buscadores) ----
  function productosDisponiblesParaBodega(bodegaId, textoBusqueda) {
    const bodega = bodegas.find(b => b.id === bodegaId);
    const listaId = bodega ? listaActivaDeRancho(bodega.rancho_id) : null;
    const permitidosFito = bodega ? fitosPermitidosEnRancho(bodega.rancho_id) : null;

    const q = (textoBusqueda || "").trim().toLowerCase();
    return productosActivos.filter(p => {
      if (q && !p.nombre_comercial.toLowerCase().includes(q) && !(p.marca || "").toLowerCase().includes(q)) return false;
      if (p.categoria !== "fitosanitario") return true; // solo se filtra por lista a los fitosanitarios
      if (!bodega || !listaId) return true; // sin bodega/lista seleccionada aún: no restringe
      const ficha = fitoDeProducto(p.id);
      if (ficha && ficha.en_lista_oficial === false) return true; // fuera de lista: siempre visible
      return permitidosFito.has(p.id);
    });
  }

  // ================= REPORTES =================
  const cargarConsumo = useCallback(async () => {
    if (!repDesde || !repHasta) return;
    setCargandoReporte(true);
    let q = supabase.from("inventario_movimientos")
      .select("cantidad, producto_id, bodega_id, creado_en")
      .eq("tipo_movimiento", "salida_aplicacion")
      .gte("creado_en", `${repDesde}T00:00:00`)
      .lte("creado_en", `${repHasta}T23:59:59`);
    if (esEncargado && bodegaEncargado) q = q.eq("bodega_id", bodegaEncargado.id);
    else if (repBodegaId !== "todas") q = q.eq("bodega_id", repBodegaId);
    const { data, error: e } = await q;
    if (e) { setError(e.message); setCargandoReporte(false); return; }
    setMovConsumo(data || []);
    setCargandoReporte(false);
  }, [repDesde, repHasta, repBodegaId, esEncargado, bodegaEncargado]);

  useEffect(() => {
    if (pestana === "reportes" && usuarioActual) cargarConsumo();
  }, [pestana, usuarioActual, cargarConsumo]);

  // Consumo agrupado por producto dentro del rango de fechas
  const consumoPorProducto = (() => {
    const mapa = {};
    movConsumo.forEach(m => {
      if (!mapa[m.producto_id]) mapa[m.producto_id] = 0;
      mapa[m.producto_id] += Number(m.cantidad);
    });
    return Object.entries(mapa)
      .map(([producto_id, total]) => ({
        producto_id, total,
        nombre: nombreProducto(producto_id),
        unidad: unidadProducto(producto_id),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // Existencias visibles en el reporte, agrupadas por bodega (misma
  // restricción de rol que el resto del módulo)
  const existenciasReporte = (esEncargado && bodegaEncargado
    ? existencias.filter(e => e.bodega_id === bodegaEncargado.id)
    : repBodegaId === "todas" ? existencias : existencias.filter(e => e.bodega_id === repBodegaId)
  ).filter(e => Number(e.existencia) !== 0);

  function exportarConsumoCSV() {
    const encabezado = ["Producto", "Unidad", "Cantidad consumida", "Del", "Al"];
    const filas = consumoPorProducto.map(c => [c.nombre, c.unidad, c.total.toFixed(3), repDesde, repHasta]);
    const csv = [encabezado, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consumo_productos_${repDesde}_a_${repHasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportarExistenciasCSV() {
    const encabezado = ["Bodega", "Producto", "Existencia", "Unidad"];
    const filas = existenciasReporte.map(e => [nombreBodega(e.bodega_id), e.producto, Number(e.existencia).toFixed(3), e.unidad_base]);
    const csv = [encabezado, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `existencias_${todayISOAlmacen()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ================= MOVIMIENTOS =================
  async function guardarMovimiento() {
    if (!mov.bodega_id || !mov.producto_id || !mov.cantidad)
      return setError("Completa bodega, producto y cantidad.");
    const { error: e } = await supabase.from("inventario_movimientos").insert({
      empresa_id: empresaId,
      bodega_id: mov.bodega_id,
      producto_id: mov.producto_id,
      tipo_movimiento: mov.tipo,
      cantidad: Number(mov.cantidad),
      costo_unitario: mov.tipo === "entrada_compra" ? Number(mov.costo || 0) : 0,
      notas: mov.notas || null,
      creado_por: usuarioActual.id,
    });
    if (e) return setError(e.message);
    avisar("Movimiento registrado.");
    setMov({ tipo: "entrada_compra", bodega_id: "", producto_id: "", cantidad: "", costo: "", notas: "" });
    await cargarDatos();
  }

  // ================= TRASPASOS =================
  function cambiarLinea(i, campo, valor) {
    const nuevas = [...lineas];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    setLineas(nuevas);
  }

  async function crearTraspaso() {
    if (!tras.origen || !tras.destino) return setError("Selecciona bodega origen y destino.");
    if (tras.origen === tras.destino) return setError("Origen y destino no pueden ser la misma bodega.");
    const validas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return setError("Agrega al menos un producto con cantidad.");

    const { data: cab, error: e1 } = await supabase.from("traspasos").insert({
      empresa_id: empresaId,
      bodega_origen_id: tras.origen,
      bodega_destino_id: tras.destino,
      notas: tras.notas || null,
      enviado_por: usuarioActual.id,
    }).select("id").single();
    if (e1) return setError(e1.message);

    for (const l of validas) {
      const { error: e2 } = await supabase.from("traspaso_detalle").insert({
        traspaso_id: cab.id,
        producto_id: l.producto_id,
        cantidad_enviada: Number(l.cantidad),
      });
      if (e2) return setError(`${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("Traspaso enviado. Queda en tránsito hasta que el rancho confirme recepción.");
    setTras({ origen: "", destino: "", notas: "" });
    setLineas([{ producto_id: "", cantidad: "" }]);
    await cargarDatos();
  }

  function abrirConfirmacion(t) {
    const suyo = detalles.filter(d => d.traspaso_id === t.id);
    const base = {};
    suyo.forEach(d => { base[d.id] = d.cantidad_enviada; });
    setRecibidas(base);
    setConfirmando(t.id);
  }

  async function confirmarRecepcion(t) {
    for (const d of detalles.filter(x => x.traspaso_id === t.id)) {
      const cant = Number(recibidas[d.id]);
      if (cant !== Number(d.cantidad_enviada)) {
        const { error: e } = await supabase.from("traspaso_detalle")
          .update({ cantidad_recibida: cant }).eq("id", d.id);
        if (e) return setError(e.message);
      }
    }
    const { error: e } = await supabase.from("traspasos")
      .update({ estado: "recibido", recibido_por: usuarioActual.id }).eq("id", t.id);
    if (e) return setError(e.message);
    avisar("Recepción confirmada. El stock entró a la bodega.");
    setConfirmando(null);
    await cargarDatos();
  }

  async function cancelarTraspaso(t) {
    if (!window.confirm("¿Cancelar este traspaso? El producto regresará a la bodega origen.")) return;
    const { error: e } = await supabase.from("traspasos")
      .update({ estado: "cancelado" }).eq("id", t.id);
    if (e) return setError(e.message);
    avisar("Traspaso cancelado y producto devuelto al origen.");
    await cargarDatos();
  }

  function puedeConfirmar(t) {
    if (esAdmin) return true;
    if (esEncargado && bodegaEncargado && t.bodega_destino_id === bodegaEncargado.id) return true;
    return false;
  }

  // ================= CATÁLOGO DE PRODUCTOS =================
  function abrirNuevoProducto() {
    setFormProd(FORM_PRODUCTO_INICIAL);
    setModoAltaFito(null);
    setBuscarFitoCatalogo("");
    setFormFitoNuevo(FORM_FITO_FUERA_LISTA_INICIAL);
    setEditandoProd("nuevo");
  }

  function abrirEditarProducto(p) {
    if (p.categoria === "fitosanitario") {
      const ficha = fitoDeProducto(p.id);
      // Datos de uso (dosis, intervalos, observaciones) viven en listas_productos,
      // bajo la lista "Productor" — tomamos cualquiera de las filas (son iguales
      // en todas las especies, ya que se guardan siempre juntas).
      const usoGuardado = ficha
        ? listasProductos.find(lp => lp.producto_fitosanitario_id === ficha.id && lp.plaga_comun === "Uso general")
        : null;
      // La justificación y las notas se guardaron juntas en observaciones — se separan para editar.
      let justificacion = "", notas = "";
      if (usoGuardado?.observaciones) {
        const m = usoGuardado.observaciones.match(/^Justificación \(fuera de lista\): (.*?)(?:\. Notas de uso: (.*))?$/s);
        if (m) { justificacion = m[1] || ""; notas = m[2] || ""; }
        else notas = usoGuardado.observaciones;
      }
      setFormFitoNuevo({
        nombre_comercial: p.nombre_comercial, marca: p.marca || "",
        ingrediente_activo: p.ingrediente_activo || "",
        concentracion_ia: ficha?.concentracion_ia || "",
        tipo_fitosanitario: ficha?.tipo_fitosanitario || "biorracional",
        unidad_base: p.unidad_base || "l",
        dosis_recomendada: usoGuardado?.dosis_etiqueta || "",
        intervalo_seguridad_horas: usoGuardado?.intervalo_seguridad_horas ?? "",
        intervalo_reentrada: usoGuardado?.intervalo_reentrada ?? "",
        observaciones: notas,
        costo_unitario: p.costo_unitario || "",
        justificacion_fuera_lista: justificacion,
      });
      setEditandoProd(p.id);
      return;
    }
    setFormProd({
      nombre_comercial: p.nombre_comercial, marca: p.marca || "",
      categoria: p.categoria,
      via_fertirriego: p.via_fertirriego, via_foliar: p.via_foliar, via_suelo: p.via_suelo,
      pct_n: p.pct_n || "", pct_p: p.pct_p || "", pct_k: p.pct_k || "",
      pct_ca: p.pct_ca || "", pct_mg: p.pct_mg || "", pct_s: p.pct_s || "",
      pct_zn: p.pct_zn || "", pct_mn: p.pct_mn || "", pct_fe: p.pct_fe || "",
      pct_cu: p.pct_cu || "", pct_b: p.pct_b || "",
      unidad_base: p.unidad_base, presentacion: p.presentacion || "",
      contenido_presentacion: p.contenido_presentacion || "",
      costo_unitario: p.costo_unitario || "",
    });
    setEditandoProd(p.id);
  }

  async function guardarProducto() {
    if (!formProd.nombre_comercial.trim()) return setError("El producto necesita nombre comercial.");
    if (!formProd.via_fertirriego && !formProd.via_foliar && !formProd.via_suelo)
      return setError("Marca al menos una vía de aplicación.");

    const num = v => (v === "" || v == null ? 0 : Number(v));
    const registro = {
      nombre_comercial: formProd.nombre_comercial.trim(),
      marca: formProd.marca.trim() || null,
      categoria: formProd.categoria,
      via_fertirriego: formProd.via_fertirriego,
      via_foliar: formProd.via_foliar,
      via_suelo: formProd.via_suelo,
      pct_n: num(formProd.pct_n), pct_p: num(formProd.pct_p), pct_k: num(formProd.pct_k),
      pct_ca: num(formProd.pct_ca), pct_mg: num(formProd.pct_mg), pct_s: num(formProd.pct_s),
      pct_zn: num(formProd.pct_zn), pct_mn: num(formProd.pct_mn), pct_fe: num(formProd.pct_fe),
      pct_cu: num(formProd.pct_cu), pct_b: num(formProd.pct_b),
      unidad_base: formProd.unidad_base,
      presentacion: formProd.presentacion.trim() || null,
      contenido_presentacion: formProd.contenido_presentacion === "" ? null : Number(formProd.contenido_presentacion),
      costo_unitario: num(formProd.costo_unitario),
    };

    let e;
    if (editandoProd === "nuevo") {
      ({ error: e } = await supabase.from("productos_insumos")
        .insert({ ...registro, empresa_id: empresaId }));
    } else {
      ({ error: e } = await supabase.from("productos_insumos")
        .update(registro).eq("id", editandoProd));
    }
    if (e) {
      if (e.message.includes("duplicate")) return setError("Ya existe un producto con ese nombre comercial.");
      return setError(e.message);
    }
    avisar(editandoProd === "nuevo" ? "Producto dado de alta." : "Producto actualizado.");
    setEditandoProd(null);
    await cargarDatos();
  }

  // ---- Alta / edición de fitosanitario fuera de lista (biorracional casero, etc.) ----
  async function guardarFitoFueraLista() {
    if (!formFitoNuevo.nombre_comercial.trim()) return setError("El producto necesita nombre comercial.");
    if (!formFitoNuevo.justificacion_fuera_lista.trim())
      return setError("Explica por qué este producto no representa riesgo de auditoría aunque no esté en la lista.");
    if (listasProductor.length === 0)
      return setError("No existe todavía la lista 'Productor — Fuera de lista oficial'. Corre la migración v0.4.40 primero.");

    const datosProducto = {
      nombre_comercial: formFitoNuevo.nombre_comercial.trim(),
      marca: formFitoNuevo.marca.trim() || null,
      categoria: "fitosanitario",
      ingrediente_activo: formFitoNuevo.ingrediente_activo.trim() || null,
      unidad_base: formFitoNuevo.unidad_base,
      via_foliar: true,
      costo_unitario: formFitoNuevo.costo_unitario === "" ? 0 : Number(formFitoNuevo.costo_unitario),
    };
    // Solo lo intrínseco del químico vive en productos_fitosanitarios.
    const datosFito = {
      tipo_fitosanitario: formFitoNuevo.tipo_fitosanitario,
      concentracion_ia: formFitoNuevo.concentracion_ia.trim() || null,
      en_lista_oficial: false,
    };
    // Justificación + notas de uso van juntas en observaciones, igual que en las listas oficiales.
    const observacionesCompletas = [
      `Justificación (fuera de lista): ${formFitoNuevo.justificacion_fuera_lista.trim()}`,
      formFitoNuevo.observaciones.trim() ? `Notas de uso: ${formFitoNuevo.observaciones.trim()}` : null,
    ].filter(Boolean).join(". ");

    let productoFitoId;
    if (editandoProd === "nuevo") {
      const { data: nuevoProd, error: e1 } = await supabase.from("productos_insumos")
        .insert({ ...datosProducto, empresa_id: empresaId, activo: true }).select("id").single();
      if (e1) {
        if (e1.message.includes("duplicate")) return setError("Ya existe un producto con ese nombre comercial.");
        return setError(e1.message);
      }
      const { data: nuevoFito, error: e2 } = await supabase.from("productos_fitosanitarios")
        .insert({ ...datosFito, producto_id: nuevoProd.id }).select("id").single();
      if (e2) return setError(e2.message);
      productoFitoId = nuevoFito.id;
    } else {
      const { error: e1 } = await supabase.from("productos_insumos")
        .update(datosProducto).eq("id", editandoProd);
      if (e1) return setError(e1.message);
      const { error: e2 } = await supabase.from("productos_fitosanitarios")
        .update(datosFito).eq("producto_id", editandoProd);
      if (e2) return setError(e2.message);
      productoFitoId = fitoDeProducto(editandoProd)?.id;
    }

    // Una fila en listas_productos por cada especie con lista "Productor" — se
    // borran las anteriores de este producto y se insertan limpias.
    await supabase.from("listas_productos").delete()
      .eq("producto_fitosanitario_id", productoFitoId)
      .in("lista_id", listasProductor.map(l => l.id));
    const filasUso = listasProductor.map(l => ({
      lista_id: l.id,
      producto_fitosanitario_id: productoFitoId,
      plaga_comun: "Uso general",
      dosis_etiqueta: formFitoNuevo.dosis_recomendada.trim() || null,
      intervalo_seguridad_horas: formFitoNuevo.intervalo_seguridad_horas === "" ? null : Number(formFitoNuevo.intervalo_seguridad_horas),
      intervalo_reentrada: formFitoNuevo.intervalo_reentrada === "" ? null : Number(formFitoNuevo.intervalo_reentrada),
      observaciones: observacionesCompletas,
    }));
    const { error: e3 } = await supabase.from("listas_productos").insert(filasUso);
    if (e3) return setError(e3.message);

    avisar(editandoProd === "nuevo" ? "Producto agregado fuera de lista." : "Producto actualizado.");
    setModoAltaFito(null);
    setFormFitoNuevo(FORM_FITO_FUERA_LISTA_INICIAL);
    setEditandoProd(null);
    await cargarDatos();
  }

  // ---- Actualiza solo el precio de referencia de un fitosanitario de lista oficial ----
  async function guardarPrecioFito(productoId, nuevoPrecio) {
    const { error: e } = await supabase.from("productos_insumos")
      .update({ costo_unitario: nuevoPrecio === "" ? 0 : Number(nuevoPrecio) }).eq("id", productoId);
    if (e) return setError(e.message);
    avisar("Precio de referencia actualizado.");
    setEditandoProd(null);
    await cargarDatos();
  }

  async function alternarProducto(p) {
    const accion = p.activo ? "desactivar" : "reactivar";
    if (!window.confirm(`¿Seguro que quieres ${accion} "${p.nombre_comercial}"?`)) return;
    const { error: e } = await supabase.from("productos_insumos")
      .update({ activo: !p.activo }).eq("id", p.id);
    if (e) return setError(e.message);
    avisar(p.activo
      ? "Producto desactivado: deja de aparecer en los selectores pero conserva su historial."
      : "Producto reactivado.");
    await cargarDatos();
  }

  const productosFiltrados = productos
    .filter(p => verInactivos || p.activo)
    .filter(p => filtroCat === "todas" || p.categoria === filtroCat)
    .filter(p => {
      const q = buscar.trim().toLowerCase();
      if (!q) return true;
      return p.nombre_comercial.toLowerCase().includes(q) ||
             (p.marca || "").toLowerCase().includes(q);
    });

  function viasTexto(p) {
    const v = [];
    if (p.via_fertirriego) v.push("💧 Fertirriego");
    if (p.via_foliar) v.push("🍃 Foliar");
    if (p.via_suelo) v.push("🟤 Suelo");
    return v.join(" · ");
  }

  function composicionTexto(p) {
    const partes = [...ELEMENTOS, ...MICROS]
      .filter(([campo]) => Number(p[campo]) > 0)
      .map(([campo, etiqueta]) => `${etiqueta} ${Number(p[campo])}%`);
    return partes.join(" · ");
  }

  // ================= RENDER =================
  if (sesion === undefined) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>📦</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (!sesion) return <Login />;

  if (cargando && bodegas.length === 0) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>📦</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Cargando módulo Almacén...</div>
      </div>
    </div>
  );

  const existenciasVisibles = esEncargado && bodegaEncargado
    ? existencias.filter(e => e.bodega_id === bodegaEncargado.id)
    : existencias;

  const traspasosVisibles = esEncargado && bodegaEncargado
    ? traspasos.filter(t => t.bodega_destino_id === bodegaEncargado.id || t.bodega_origen_id === bodegaEncargado.id)
    : traspasos;

  const PESTANAS = [
    { key: "existencias", label: "📊 Existencias" },
    ...(!soloLectura ? [{ key: "movimiento", label: "🛒 Entradas y ajustes" }] : []),
    { key: "traspasos", label: "🚚 Traspasos" },
    { key: "productos", label: "🏷️ Productos" },
    { key: "reportes", label: "📈 Reportes" },
  ];

  // ---- Contexto del formulario de alta/edición: ¿es un fitosanitario? ----
  const prodEditando = editandoProd && editandoProd !== "nuevo"
    ? productos.find(p => p.id === editandoProd) : null;
  const esFitoContext = editandoProd === "nuevo"
    ? formProd.categoria === "fitosanitario"
    : prodEditando?.categoria === "fitosanitario";
  const fichaEditando = prodEditando ? fitoDeProducto(prodEditando.id) : null;
  const esFitoFueraDeLista = fichaEditando ? fichaEditando.en_lista_oficial === false : false;

  return (
    <div style={S.page}>
      <style>{`select option { background-color: #0f2818; color: #e8f5e0; }`}</style>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · ALMACÉN</div>
            <h1 style={S.title}>Almacén</h1>
            <div style={S.usuarioTag}>
              {usuarioActual?.nombre_completo} · {ROLES_TXT[usuarioActual?.rol] || usuarioActual?.rol}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>📦</div>
            <div style={S.version}>v0.3.25</div>
            <button onClick={() => supabase.auth.signOut()} style={S.btnLogout}>Salir</button>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div style={S.errorBanner}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={S.btnCerrarError}>✕</button>
          </div>
        )}
        {aviso && (
          <div style={S.okBanner}>
            ✅ {aviso}
            <button onClick={() => setAviso(null)} style={S.btnCerrarError}>✕</button>
          </div>
        )}

        {/* Pestañas */}
        <div style={S.navTabs}>
          {PESTANAS.map(p => (
            <button key={p.key} onClick={() => setPestana(p.key)}
              style={{
                ...S.navTab,
                borderColor: pestana === p.key ? "#7fbf5a" : "rgba(127,191,90,0.2)",
                color: pestana === p.key ? "#7fbf5a" : "rgba(200,230,180,0.5)",
                background: pestana === p.key ? "rgba(127,191,90,0.12)" : "transparent",
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* ============ EXISTENCIAS ============ */}
        {pestana === "existencias" && (
          <div>
            {bodegas
              .filter(b => !esEncargado || b.id === bodegaEncargado?.id)
              .map(b => {
                const filas = existenciasVisibles.filter(e => e.bodega_id === b.id && Number(e.existencia) !== 0);
                return (
                  <div key={b.id} style={S.card}>
                    <div style={S.seccionTitulo}>{b.nombre}</div>
                    {filas.length === 0 && <div style={S.empty}>Sin existencias registradas.</div>}
                    {filas.map(e => (
                      <div key={e.producto_id} style={S.cardRow}>
                        <span>{e.producto}</span>
                        <span style={{ fontWeight: 800, color: "#e8f5e0" }}>
                          {Number(e.existencia).toLocaleString("es-MX")} {e.unidad_base}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}

        {/* ============ ENTRADAS Y AJUSTES ============ */}
        {pestana === "movimiento" && !soloLectura && (
          <div style={S.card}>
            <div style={S.seccionTitulo}>Registrar movimiento</div>

            <div style={S.formGroup}>
              <label style={S.label}>TIPO DE MOVIMIENTO</label>
              <select style={S.select} value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value })}>
                {TIPOS_ENTRADA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>BODEGA</label>
              <select style={S.select} value={mov.bodega_id} onChange={e => {
                setMov({ ...mov, bodega_id: e.target.value, producto_id: "" });
                setBuscarProductoMov("");
              }}>
                <option value="">— Selecciona —</option>
                {bodegas.filter(b => !esEncargado || b.id === bodegaEncargado?.id)
                  .map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>

            <div style={{ ...S.formGroup, position: "relative" }}>
              <label style={S.label}>PRODUCTO</label>
              <input style={S.select} placeholder={mov.bodega_id ? "🔍 Buscar producto…" : "Primero selecciona una bodega"}
                disabled={!mov.bodega_id}
                value={mov.producto_id ? nombreProducto(mov.producto_id) : buscarProductoMov}
                onFocus={() => { setMov({ ...mov, producto_id: "" }); setBuscarProductoMov(""); setMostrarBuscadorMov(true); }}
                onChange={e => { setBuscarProductoMov(e.target.value); setMostrarBuscadorMov(true); }}
              />
              {mostrarBuscadorMov && mov.bodega_id && (
                <div style={S.dropdownBusqueda}>
                  {productosDisponiblesParaBodega(mov.bodega_id, buscarProductoMov).slice(0, 40).map(p => (
                    <div key={p.id} style={S.dropdownItem}
                      onClick={() => { setMov({ ...mov, producto_id: p.id }); setMostrarBuscadorMov(false); }}>
                      <div style={{ fontWeight: 600, color: "#e8f5e0" }}>{p.nombre_comercial}</div>
                      <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                        {CATEGORIAS.find(c => c.value === p.categoria)?.label}
                        {p.marca && ` · ${p.marca}`}
                        {fitoDeProducto(p.id)?.en_lista_oficial === false && " · Fuera de lista"}
                      </div>
                    </div>
                  ))}
                  {productosDisponiblesParaBodega(mov.bodega_id, buscarProductoMov).length === 0 && (
                    <div style={{ ...S.dropdownItem, color: "rgba(200,230,180,0.4)" }}>
                      Ningún producto autorizado coincide con la búsqueda.
                    </div>
                  )}
                  <div style={{ ...S.dropdownItem, textAlign: "center", color: "rgba(200,230,180,0.4)", cursor: "pointer" }}
                    onClick={() => setMostrarBuscadorMov(false)}>Cerrar</div>
                </div>
              )}
            </div>

            <div style={S.formRow}>
              <div style={{ ...S.formGroup, flex: 1 }}>
                <label style={S.label}>CANTIDAD ({unidadProducto(mov.producto_id) || "kg / L"})</label>
                <input style={S.select} type="number" min="0" step="0.001" value={mov.cantidad}
                  onChange={e => setMov({ ...mov, cantidad: e.target.value })} />
              </div>
              {mov.tipo === "entrada_compra" && (
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>COSTO POR {unidadProducto(mov.producto_id)?.toUpperCase() || "UNIDAD"} ($)</label>
                  <input style={S.select} type="number" min="0" step="0.01" value={mov.costo}
                    onChange={e => setMov({ ...mov, costo: e.target.value })} />
                </div>
              )}
            </div>
            {mov.tipo === "entrada_compra" && (
              <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)", marginTop: -8, marginBottom: 12 }}>
                Este costo actualizará el precio de referencia del producto.
              </div>
            )}

            <div style={S.formGroup}>
              <label style={S.label}>NOTAS</label>
              <input style={S.select} value={mov.notas} onChange={e => setMov({ ...mov, notas: e.target.value })} />
            </div>

            <button style={S.btnPrimary} onClick={guardarMovimiento}>Guardar movimiento</button>
          </div>
        )}

        {/* ============ TRASPASOS ============ */}
        {pestana === "traspasos" && (
          <div>
            {esAdmin && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Nuevo traspaso</div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>BODEGA ORIGEN</label>
                    <select style={S.select} value={tras.origen} onChange={e => setTras({ ...tras, origen: e.target.value })}>
                      <option value="">— Selecciona —</option>
                      {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>BODEGA DESTINO</label>
                    <select style={S.select} value={tras.destino} onChange={e => setTras({ ...tras, destino: e.target.value })}>
                      <option value="">— Selecciona —</option>
                      {bodegas.filter(b => b.id !== tras.origen)
                        .map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <label style={S.label}>PRODUCTOS</label>
                {lineas.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, position: "relative" }}>
                    <div style={{ flex: 2, position: "relative" }}>
                      <input style={S.select} placeholder="🔍 Buscar producto…"
                        value={l.producto_id ? nombreProducto(l.producto_id) : (buscarProductoLinea[i] || "")}
                        onFocus={() => { cambiarLinea(i, "producto_id", ""); setBuscarProductoLinea({ ...buscarProductoLinea, [i]: "" }); setMostrarBuscadorLinea(i); }}
                        onChange={e => { setBuscarProductoLinea({ ...buscarProductoLinea, [i]: e.target.value }); setMostrarBuscadorLinea(i); }}
                      />
                      {mostrarBuscadorLinea === i && (
                        <div style={S.dropdownBusqueda}>
                          {productosDisponiblesParaBodega(null, buscarProductoLinea[i]).slice(0, 40).map(p => (
                            <div key={p.id} style={S.dropdownItem}
                              onClick={() => { cambiarLinea(i, "producto_id", p.id); setMostrarBuscadorLinea(null); }}>
                              <div style={{ fontWeight: 600, color: "#e8f5e0" }}>{p.nombre_comercial}</div>
                              <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                                {CATEGORIAS.find(c => c.value === p.categoria)?.label}{p.marca && ` · ${p.marca}`}
                              </div>
                            </div>
                          ))}
                          <div style={{ ...S.dropdownItem, textAlign: "center", color: "rgba(200,230,180,0.4)", cursor: "pointer" }}
                            onClick={() => setMostrarBuscadorLinea(null)}>Cerrar</div>
                        </div>
                      )}
                    </div>
                    <input style={{ ...S.select, flex: 1 }} type="number" min="0" step="0.001"
                      placeholder="Cant." value={l.cantidad}
                      onChange={e => cambiarLinea(i, "cantidad", e.target.value)} />
                  </div>
                ))}
                <button style={S.btnSecundario} onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "" }])}>
                  + Agregar producto
                </button>

                <div style={{ ...S.formGroup, marginTop: 16 }}>
                  <label style={S.label}>NOTAS</label>
                  <input style={S.select} value={tras.notas} onChange={e => setTras({ ...tras, notas: e.target.value })} />
                </div>

                <button style={S.btnPrimary} onClick={crearTraspaso}>Enviar traspaso</button>
              </div>
            )}

            {traspasosVisibles.map(t => {
              const suyo = detalles.filter(d => d.traspaso_id === t.id);
              const colorEstado = t.estado === "en_transito" ? "#e8a23d"
                : t.estado === "recibido" ? "#7fbf5a" : "#e05c5c";
              return (
                <div key={t.id} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>
                      {nombreBodega(t.bodega_origen_id)} → {nombreBodega(t.bodega_destino_id)}
                    </div>
                    <span style={{ ...S.miniTag, color: colorEstado, background: `${colorEstado}22` }}>
                      {t.estado === "en_transito" ? "🚚 En tránsito"
                        : t.estado === "recibido" ? "✅ Recibido" : "✖ Cancelado"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(200,230,180,0.45)", margin: "4px 0 8px" }}>
                    Enviado: {new Date(t.fecha_envio).toLocaleDateString("es-MX")}
                    {t.fecha_recepcion && ` · Recibido: ${new Date(t.fecha_recepcion).toLocaleDateString("es-MX")}`}
                  </div>

                  {suyo.map(d => (
                    <div key={d.id} style={S.cardRow}>
                      <span>{nombreProducto(d.producto_id)}</span>
                      <span>
                        {confirmando === t.id ? (
                          <input style={{ ...S.select, width: 100, padding: "6px 8px" }} type="number" min="0" step="0.001"
                            value={recibidas[d.id] ?? ""}
                            onChange={e => setRecibidas({ ...recibidas, [d.id]: e.target.value })} />
                        ) : (
                          <b style={{ color: "#e8f5e0" }}>
                            {Number(d.cantidad_recibida ?? d.cantidad_enviada).toLocaleString("es-MX")} {unidadProducto(d.producto_id)}
                            {d.cantidad_recibida != null && Number(d.cantidad_recibida) !== Number(d.cantidad_enviada) &&
                              <span style={{ color: "#e8a23d" }}> (enviado {d.cantidad_enviada})</span>}
                          </b>
                        )}
                      </span>
                    </div>
                  ))}

                  {t.estado === "en_transito" && puedeConfirmar(t) && (
                    confirmando === t.id ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={() => confirmarRecepcion(t)}>
                          ✅ Confirmar recepción
                        </button>
                        <button style={S.btnSecundario} onClick={() => setConfirmando(null)}>Cerrar</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={() => abrirConfirmacion(t)}>
                          Recibir traspaso
                        </button>
                        {esAdmin && (
                          <button style={{ ...S.btnSecundario, color: "#e05c5c", borderColor: "rgba(224,92,92,0.4)" }}
                            onClick={() => cancelarTraspaso(t)}>Cancelar</button>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
            {traspasosVisibles.length === 0 && <div style={S.empty}>Aún no hay traspasos registrados.</div>}
          </div>
        )}

        {/* ============ CATÁLOGO DE PRODUCTOS ============ */}
        {pestana === "productos" && (
          <div>
            {esAdmin && editandoProd === null && (
              <button style={S.btnPrimary} onClick={abrirNuevoProducto}>+ Nuevo producto</button>
            )}

            {/* Formulario de alta / edición — FITOSANITARIO */}
            {editandoProd !== null && esFitoContext && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>
                  {editandoProd === "nuevo" ? "Nuevo producto — Fitosanitario" : "Producto fitosanitario"}
                </div>

                {editandoProd === "nuevo" && (
                  <div style={S.formGroup}>
                    <label style={S.label}>CATEGORÍA</label>
                    <select style={S.select} value={formProd.categoria}
                      onChange={e => { setFormProd({ ...formProd, categoria: e.target.value }); setModoAltaFito(null); }}>
                      {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                )}

                {/* ---- Caso: alta nueva de fitosanitario — elegir modo ---- */}
                {editandoProd === "nuevo" && modoAltaFito === null && (
                  <>
                    <div style={{ fontSize: 12, color: "rgba(200,230,180,0.6)", marginBottom: 12 }}>
                      La mayoría de los fitosanitarios ya están en el catálogo (listas ANEBERRIES cargadas).
                      Solo agrega uno nuevo si de verdad no existe y no representa riesgo de auditoría.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={() => setModoAltaFito("buscar")}>
                        🔍 Buscar en lista autorizada
                      </button>
                      <button style={{ ...S.btnSecundario, flex: 1 }} onClick={() => setModoAltaFito("nuevo")}>
                        ➕ Agregar fuera de lista
                      </button>
                    </div>
                    <button style={{ ...S.btnSecundario, marginTop: 8, width: "100%" }} onClick={() => setEditandoProd(null)}>Cancelar</button>
                  </>
                )}

                {/* ---- Caso: buscar en catálogo ya autorizado (solo consulta) ---- */}
                {editandoProd === "nuevo" && modoAltaFito === "buscar" && (
                  <>
                    <div style={S.formGroup}>
                      <label style={S.label}>BUSCAR PRODUCTO</label>
                      <input style={S.select} placeholder="🔍 Nombre comercial…" value={buscarFitoCatalogo}
                        onChange={e => setBuscarFitoCatalogo(e.target.value)} />
                    </div>
                    {buscarFitoCatalogo.trim().length >= 2 ? (
                      productos.filter(p => p.categoria === "fitosanitario" && p.activo &&
                        p.nombre_comercial.toLowerCase().includes(buscarFitoCatalogo.trim().toLowerCase()))
                        .slice(0, 30).map(p => {
                          const f = fitoDeProducto(p.id);
                          return (
                            <div key={p.id} style={{ ...S.card, marginBottom: 8, cursor: "pointer" }}
                              onClick={() => { setModoAltaFito(null); setBuscarFitoCatalogo(""); abrirEditarProducto(p); }}>
                              <div style={{ fontWeight: 700, color: "#ffffff" }}>{p.nombre_comercial}</div>
                              <div style={{ fontSize: 12, color: "rgba(200,230,180,0.6)" }}>
                                {p.ingrediente_activo} · {f?.tipo_fitosanitario}
                                {f?.en_lista_oficial === false && " · ⚠️ Fuera de lista"}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(200,230,180,0.4)", marginTop: 4 }}>Toca para ver la ficha completa →</div>
                            </div>
                          );
                        })
                    ) : (
                      <div style={{ fontSize: 12, color: "rgba(200,230,180,0.4)" }}>Escribe al menos 2 letras para buscar.</div>
                    )}
                    <button style={{ ...S.btnSecundario, marginTop: 8, width: "100%" }}
                      onClick={() => { setModoAltaFito(null); setBuscarFitoCatalogo(""); }}>Regresar</button>
                  </>
                )}

                {/* ---- Caso: agregar/editar fuera de lista ---- */}
                {((editandoProd === "nuevo" && modoAltaFito === "nuevo") || (editandoProd !== "nuevo" && esFitoFueraDeLista)) && (
                  <>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 2 }}>
                        <label style={S.label}>NOMBRE COMERCIAL</label>
                        <input style={S.select} value={formFitoNuevo.nombre_comercial}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, nombre_comercial: e.target.value })} />
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>MARCA</label>
                        <input style={S.select} value={formFitoNuevo.marca}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, marca: e.target.value })} />
                      </div>
                    </div>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>TIPO</label>
                        <select style={S.select} value={formFitoNuevo.tipo_fitosanitario}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, tipo_fitosanitario: e.target.value })}>
                          {TIPOS_FITOSANITARIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>UNIDAD BASE</label>
                        <select style={S.select} value={formFitoNuevo.unidad_base}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, unidad_base: e.target.value })}>
                          <option value="kg">Kilogramos (kg)</option>
                          <option value="l">Litros (L)</option>
                        </select>
                      </div>
                    </div>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 2 }}>
                        <label style={S.label}>INGREDIENTE ACTIVO</label>
                        <input style={S.select} value={formFitoNuevo.ingrediente_activo}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, ingrediente_activo: e.target.value })} />
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>CONCENTRACIÓN (%)</label>
                        <input style={S.select} placeholder="ej. 2.5" value={formFitoNuevo.concentracion_ia}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, concentracion_ia: e.target.value })} />
                      </div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>DOSIS RECOMENDADA (GENERAL)</label>
                      <input style={S.select} placeholder="ej. 2-3 L por Ha" value={formFitoNuevo.dosis_recomendada}
                        onChange={e => setFormFitoNuevo({ ...formFitoNuevo, dosis_recomendada: e.target.value })} />
                    </div>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>INTERVALO DE SEGURIDAD (HRS)</label>
                        <input style={S.select} type="number" min="0" value={formFitoNuevo.intervalo_seguridad_horas}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, intervalo_seguridad_horas: e.target.value })} />
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>PERIODO DE REENTRADA (HRS)</label>
                        <input style={S.select} type="number" min="0" value={formFitoNuevo.intervalo_reentrada}
                          onChange={e => setFormFitoNuevo({ ...formFitoNuevo, intervalo_reentrada: e.target.value })} />
                      </div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>OBSERVACIONES DE USO</label>
                      <input style={S.select} placeholder="ej. Aplicar cada 7 días, preventivo contra araña roja"
                        value={formFitoNuevo.observaciones}
                        onChange={e => setFormFitoNuevo({ ...formFitoNuevo, observaciones: e.target.value })} />
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>PRECIO ($/{formFitoNuevo.unidad_base})</label>
                      <input style={S.select} type="number" min="0" step="0.01" value={formFitoNuevo.costo_unitario}
                        onChange={e => setFormFitoNuevo({ ...formFitoNuevo, costo_unitario: e.target.value })} />
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>JUSTIFICACIÓN — POR QUÉ NO REPRESENTA RIESGO DE AUDITORÍA</label>
                      <input style={S.select} placeholder="ej. Extracto de ajo casero, sin moléculas restringidas"
                        value={formFitoNuevo.justificacion_fuera_lista}
                        onChange={e => setFormFitoNuevo({ ...formFitoNuevo, justificacion_fuera_lista: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={guardarFitoFueraLista}>
                        {editandoProd === "nuevo" ? "Dar de alta fuera de lista" : "Guardar cambios"}
                      </button>
                      <button style={S.btnSecundario} onClick={() => { setEditandoProd(null); setModoAltaFito(null); }}>Cancelar</button>
                    </div>
                  </>
                )}

                {/* ---- Caso: editar un fitosanitario de la lista oficial (solo precio editable) ---- */}
                {editandoProd !== "nuevo" && !esFitoFueraDeLista && prodEditando && (
                  <>
                    <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)", marginBottom: 12 }}>
                      Este producto viene de la lista oficial ANEBERRIES — sus datos regulatorios no se editan aquí,
                      solo el precio de referencia.
                    </div>
                    <div style={{ ...S.card, marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>{prodEditando.nombre_comercial}</div>
                      <div style={S.cardRow}><span>Ingrediente activo</span><span>{prodEditando.ingrediente_activo || "—"}</span></div>
                      <div style={S.cardRow}><span>Tipo</span><span>{fichaEditando?.tipo_fitosanitario || "—"}</span></div>
                      <div style={S.cardRow}><span>Grupo químico</span><span>{fichaEditando?.grupo_quimico || "—"}</span></div>
                      <div style={S.cardRow}><span>Clasificación resistencia</span><span>{fichaEditando?.clasificacion_resistencia || "—"}</span></div>
                      <div style={S.cardRow}><span>Concentración</span><span>{fichaEditando?.concentracion_ia || "—"}</span></div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>PRECIO DE REFERENCIA ($/{prodEditando.unidad_base})</label>
                      <input style={S.select} type="number" min="0" step="0.01"
                        defaultValue={prodEditando.costo_unitario || ""}
                        onChange={e => setFormFitoNuevo({ ...formFitoNuevo, costo_unitario: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }}
                        onClick={() => guardarPrecioFito(prodEditando.id, formFitoNuevo.costo_unitario)}>
                        Guardar precio
                      </button>
                      <button style={S.btnSecundario} onClick={() => setEditandoProd(null)}>Cerrar</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Formulario de alta / edición — NUTRICIONAL / BIOESTIMULANTE / COADYUVANTE */}
            {editandoProd !== null && !esFitoContext && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>
                  {editandoProd === "nuevo" ? "Nuevo producto" : "Editar producto"}
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 2 }}>
                    <label style={S.label}>NOMBRE COMERCIAL</label>
                    <input style={S.select} value={formProd.nombre_comercial}
                      onChange={e => setFormProd({ ...formProd, nombre_comercial: e.target.value })} />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>MARCA</label>
                    <input style={S.select} value={formProd.marca}
                      onChange={e => setFormProd({ ...formProd, marca: e.target.value })} />
                  </div>
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>CATEGORÍA</label>
                    <select style={S.select} value={formProd.categoria}
                      onChange={e => setFormProd({ ...formProd, categoria: e.target.value })}>
                      {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>UNIDAD BASE</label>
                    <select style={S.select} value={formProd.unidad_base}
                      onChange={e => setFormProd({ ...formProd, unidad_base: e.target.value })}>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="l">Litros (L)</option>
                    </select>
                  </div>
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>VÍAS DE APLICACIÓN PERMITIDAS</label>
                  {[["via_fertirriego", "💧 Fertirriego"], ["via_foliar", "🍃 Foliar"], ["via_suelo", "🟤 Suelo / drench"]].map(([campo, texto]) => (
                    <label key={campo} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={formProd[campo]}
                        onChange={e => setFormProd({ ...formProd, [campo]: e.target.checked })} />
                      {texto}
                    </label>
                  ))}
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>COMPOSICIÓN — MACROS (%)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {ELEMENTOS.map(([campo, etiqueta]) => (
                      <div key={campo} style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "rgba(200,230,180,0.5)", textAlign: "center", marginBottom: 2 }}>{etiqueta}</div>
                        <input style={{ ...S.select, padding: "8px 6px", textAlign: "center" }} type="number" min="0" step="0.01"
                          value={formProd[campo]}
                          onChange={e => setFormProd({ ...formProd, [campo]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>COMPOSICIÓN — MICROS (%)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {MICROS.map(([campo, etiqueta]) => (
                      <div key={campo} style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "rgba(200,230,180,0.5)", textAlign: "center", marginBottom: 2 }}>{etiqueta}</div>
                        <input style={{ ...S.select, padding: "8px 6px", textAlign: "center" }} type="number" min="0" step="0.01"
                          value={formProd[campo]}
                          onChange={e => setFormProd({ ...formProd, [campo]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 2 }}>
                    <label style={S.label}>PRESENTACIÓN</label>
                    <input style={S.select} placeholder="ej. Saco 25 kg" value={formProd.presentacion}
                      onChange={e => setFormProd({ ...formProd, presentacion: e.target.value })} />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>CONTENIDO</label>
                    <input style={S.select} type="number" min="0" step="0.01" value={formProd.contenido_presentacion}
                      onChange={e => setFormProd({ ...formProd, contenido_presentacion: e.target.value })} />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>PRECIO ($/{formProd.unidad_base})</label>
                    <input style={S.select} type="number" min="0" step="0.01" value={formProd.costo_unitario}
                      onChange={e => setFormProd({ ...formProd, costo_unitario: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={guardarProducto}>
                    {editandoProd === "nuevo" ? "Dar de alta" : "Guardar cambios"}
                  </button>
                  <button style={S.btnSecundario} onClick={() => setEditandoProd(null)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Buscador y filtros */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <input style={{ ...S.select, flex: 2, minWidth: 160 }} placeholder="🔍 Buscar por nombre o marca…"
                value={buscar} onChange={e => setBuscar(e.target.value)} />
              <select style={{ ...S.select, flex: 1, minWidth: 130 }} value={filtroCat}
                onChange={e => setFiltroCat(e.target.value)}>
                <option value="todas">Todas las categorías</option>
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {esAdmin && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(200,230,180,0.6)", marginBottom: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={verInactivos} onChange={e => setVerInactivos(e.target.checked)} />
                Mostrar productos inactivos
              </label>
            )}

            <div style={{ fontSize: 12, color: "rgba(200,230,180,0.45)", marginBottom: 8 }}>
              {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
            </div>

            {/* Lista */}
            {productosFiltrados.map(p => (
              <div key={p.id} style={{ ...S.card, opacity: p.activo ? 1 : 0.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#ffffff" }}>
                    {p.nombre_comercial}
                    {p.marca && <span style={{ fontWeight: 400, color: "rgba(200,230,180,0.5)", fontSize: 12 }}> · {p.marca}</span>}
                    {!p.activo && <span style={{ ...S.miniTag, color: "#e05c5c", background: "rgba(224,92,92,0.15)", marginLeft: 8 }}>Inactivo</span>}
                    {p.categoria === "fitosanitario" && fitoDeProducto(p.id)?.en_lista_oficial === false &&
                      <span style={{ ...S.miniTag, color: "#e8a23d", background: "rgba(232,162,61,0.15)", marginLeft: 8 }}>Fuera de lista</span>}
                  </div>
                  <span style={{
                    fontWeight: 800,
                    color: Number(p.costo_unitario) > 0 ? "#7fbf5a" : "#e8a23d",
                  }}>
                    {Number(p.costo_unitario) > 0
                      ? `$${Number(p.costo_unitario).toLocaleString("es-MX", { minimumFractionDigits: 2 })}/${p.unidad_base}`
                      : "⚠️ Sin precio"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(200,230,180,0.55)", margin: "4px 0" }}>
                  {CATEGORIAS.find(c => c.value === p.categoria)?.label} · {viasTexto(p)}
                  {p.presentacion && ` · ${p.presentacion}`}
                </div>
                {composicionTexto(p) && (
                  <div style={{ fontSize: 12, color: "rgba(200,230,180,0.75)" }}>{composicionTexto(p)}</div>
                )}
                {esAdmin && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button style={{ ...S.btnSecundario, padding: "6px 12px" }} onClick={() => abrirEditarProducto(p)}>
                      ✏️ Editar
                    </button>
                    <button style={{
                      ...S.btnSecundario, padding: "6px 12px",
                      color: p.activo ? "#e05c5c" : "#7fbf5a",
                      borderColor: p.activo ? "rgba(224,92,92,0.4)" : "rgba(127,191,90,0.3)",
                    }} onClick={() => alternarProducto(p)}>
                      {p.activo ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {productosFiltrados.length === 0 && <div style={S.empty}>Ningún producto coincide con la búsqueda.</div>}
          </div>
        )}

        {/* ============ REPORTES ============ */}
        {pestana === "reportes" && (
          <div>
            {/* --- Consumo de productos --- */}
            <div style={S.card}>
              <div style={S.seccionTitulo}>Consumo de productos</div>

              <div style={S.formRow}>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>DEL</label>
                  <input style={S.select} type="date" value={repDesde} max={repHasta}
                    onChange={e => setRepDesde(e.target.value)} />
                </div>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>AL</label>
                  <input style={S.select} type="date" value={repHasta} min={repDesde} max={todayISOAlmacen()}
                    onChange={e => setRepHasta(e.target.value)} />
                </div>
                {!esEncargado && (
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>BODEGA</label>
                    <select style={S.select} value={repBodegaId} onChange={e => setRepBodegaId(e.target.value)}>
                      <option value="todas">Todas las bodegas</option>
                      {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {esEncargado && bodegaEncargado && (
                <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)", marginTop: -8, marginBottom: 12 }}>
                  Mostrando solo: {bodegaEncargado.nombre}
                </div>
              )}

              {cargandoReporte ? (
                <div style={{ fontSize: 13, color: "rgba(200,230,180,0.5)" }}>Calculando…</div>
              ) : consumoPorProducto.length === 0 ? (
                <div style={S.empty}>Sin salidas por aplicación en este periodo.</div>
              ) : (
                <>
                  {consumoPorProducto.map(c => (
                    <div key={c.producto_id} style={S.cardRow}>
                      <span>{c.nombre}</span>
                      <span style={{ fontWeight: 800, color: "#e8f5e0" }}>
                        {c.total.toLocaleString("es-MX", { maximumFractionDigits: 3 })} {c.unidad}
                      </span>
                    </div>
                  ))}
                  <button style={{ ...S.btnSecundario, marginTop: 12 }} onClick={exportarConsumoCSV}>
                    ⬇️ Exportar a Excel (CSV)
                  </button>
                </>
              )}
            </div>

            {/* --- Existencias por bodega --- */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={S.seccionTitulo}>Existencias actuales</div>
                <button style={{ ...S.btnSecundario, padding: "6px 12px" }} onClick={exportarExistenciasCSV}>
                  ⬇️ CSV
                </button>
              </div>
              {existenciasReporte.length === 0 && <div style={S.empty}>Sin existencias registradas.</div>}
              {bodegas
                .filter(b => !esEncargado || b.id === bodegaEncargado?.id)
                .filter(b => repBodegaId === "todas" || esEncargado || b.id === repBodegaId)
                .map(b => {
                  const filas = existenciasReporte.filter(e => e.bodega_id === b.id);
                  if (filas.length === 0) return null;
                  return (
                    <div key={b.id} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(200,230,180,0.7)", marginBottom: 4 }}>{b.nombre}</div>
                      {filas.map(e => (
                        <div key={e.producto_id} style={S.cardRow}>
                          <span>{e.producto}</span>
                          <span style={{ fontWeight: 700, color: "#e8f5e0" }}>
                            {Number(e.existencia).toLocaleString("es-MX")} {e.unidad_base}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

