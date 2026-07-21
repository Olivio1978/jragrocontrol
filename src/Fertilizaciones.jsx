// ============ JR AGROCONTROL — Fertilizaciones.jsx v0.3.21 ============
// Módulo Fertilizaciones: recomendaciones del agrónomo, confirmación en
// campo (con motivo si se modifica), recetas con dosis por hectárea y
// programación por sector/semanas/días, sectores con semana fenológica,
// y mediciones de CE/pH.
// Patrón visual y de sesión tomado de Labores.jsx v0.2.5.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";

// ============ CONSTANTES ============
const VIAS = [
  { value: "fertirriego", label: "💧 Fertirriego" },
  { value: "foliar",      label: "🍃 Foliar" },
  { value: "suelo",       label: "🟤 Suelo / drench" },
];

const MOTIVOS = [
  { value: "falta_producto",      label: "Falta de producto en bodega" },
  { value: "producto_no_surtido", label: "Producto no surtido a tiempo" },
  { value: "clima",               label: "Ajuste por clima" },
  { value: "indicacion_agronomo", label: "Indicación del agrónomo" },
  { value: "otro",                label: "Otro (describir)" },
];

const MUESTRAS = [
  { value: "suelo",          label: "Suelo / sustrato" },
  { value: "solucion_riego", label: "Solución de riego" },
  { value: "drenaje",        label: "Drenaje" },
];

const ESTADOS = {
  pendiente:  { label: "Pendiente",  color: "#e8a23d", icono: "🕓" },
  aplicada:   { label: "Aplicada",   color: "#7fbf5a", icono: "✅" },
  modificada: { label: "Modificada", color: "#5a9bd4", icono: "✏️" },
  cancelada:  { label: "Cancelada",  color: "#e05c5c", icono: "✖" },
};

const DIAS = [[1, "L"], [2, "M"], [3, "Mi"], [4, "J"], [5, "V"], [6, "S"], [7, "D"]];

const EVENTOS_CICLO = [
  ["plantacion", "Plantación"], ["poda_piso", "Poda a piso"],
  ["poda_recuadre", "Poda recuadre"], ["pinchado", "Pinchado"], ["otro", "Otro"],
];

const ROLES_TXT = {
  admin: "Administrador", encargado: "Encargado",
  agronomo: "Agrónomo", agronomo_externo: "Agrónomo externo",
};

const compatible = (p, via) =>
  via === "fertirriego" ? p.via_fertirriego :
  via === "foliar" ? p.via_foliar : p.via_suelo;

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

function hace30diasFert() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

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
        <div style={S.eyebrow}>JR AGROCONTROL · FERTILIZACIÓN</div>
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
export default function Fertilizaciones() {
  // ---- Sesión ----
  const [sesion, setSesion]               = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError]                 = useState(null);
  const [aviso, setAviso]                 = useState(null);
  const [cargando, setCargando]           = useState(true);

  // ---- Datos ----
  const [empresaId, setEmpresaId]       = useState(null);
  const [ranchos, setRanchos]           = useState([]);
  const [productos, setProductos]       = useState([]);
  const [recetas, setRecetas]           = useState([]);
  const [recetaDet, setRecetaDet]       = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [aplicacionDet, setAplicacionDet] = useState([]);
  const [mediciones, setMediciones]     = useState([]);
  const [estadoSectores, setEstadoSectores] = useState([]);
  const [programaciones, setProgramaciones] = useState([]);

  // ---- Vistas ----
  const [pestana, setPestana]           = useState("aplicaciones");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [filtroFecha, setFiltroFecha] = useState("");

  // ---- Nueva recomendación ----
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ sector_id: "", via: "fertirriego", receta_id: "", fecha: todayISO(), minutos_riego: "", notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);
  const [generarRango, setGenerarRango] = useState(false);
  const [rangoHasta, setRangoHasta] = useState("");

  // ---- Confirmación en campo ----
  const [confirmando, setConfirmando] = useState(null);
  const [aplicadas, setAplicadas]     = useState({});
  const [motivo, setMotivo]           = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");

  // ---- Nueva receta ----
  const [creandoReceta, setCreandoReceta] = useState(false);
  const [nuevaReceta, setNuevaReceta] = useState({ nombre: "", cultivo: "", etapa: "", via: "fertirriego", modo: "por_ha" });
  const [lineasReceta, setLineasReceta] = useState([{ producto_id: "", cantidad: "" }]);
  const [recBuscar, setRecBuscar] = useState("");
  const [recFiltroVia, setRecFiltroVia] = useState("todas");
  const [recFiltroCultivo, setRecFiltroCultivo] = useState("todos");
  const [recVerInactivas, setRecVerInactivas] = useState(false);

  // ---- Nueva medición ----
  const [med, setMed] = useState({ sector_id: "", tipo: "suelo", ce: "", ph: "", humedad: "", notas: "" });

  // ---- Reportes ----
  const [repDesde, setRepDesde] = useState(hace30diasFert());
  const [repHasta, setRepHasta] = useState(todayISO());
  const [repRanchoId, setRepRanchoId] = useState("todos");
  const [repFert, setRepFert] = useState([]);
  const [repFertDet, setRepFertDet] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);


  // ---- Programación de recetas ----
  const [programando, setProgramando] = useState(null);      // receta_id abierta
  const [progForm, setProgForm] = useState({ sector_id: "", desde: "", hasta: "", dias: [1, 3, 5] });

  // ---- Nueva etapa de ciclo ----
  const [nuevaEtapa, setNuevaEtapa] = useState(null);        // sector_id abierto
  const [etapaForm, setEtapaForm] = useState({ etapa: "", evento: "pinchado", fecha: todayISO() });

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
    const [r, p, rec, rd, f, fd, m, es, rp] = await Promise.all([
      supabase.from("ranchos").select("id, nombre, empresa_id").order("nombre"),
      supabase.from("productos_insumos").select("id, nombre_comercial, unidad_base, costo_unitario, via_fertirriego, via_foliar, via_suelo").eq("activo", true).order("nombre_comercial"),
      supabase.from("recetas").select("*").order("nombre"),
      supabase.from("receta_detalle").select("*"),
      supabase.from("fertilizaciones").select("*").order("fecha_recomendada", { ascending: false }).limit(100),
      supabase.from("fertilizacion_detalle").select("*"),
      supabase.from("mediciones_campo").select("*").order("fecha", { ascending: false }).limit(30),
      supabase.from("vw_estado_sectores").select("*"),
      supabase.from("receta_programacion").select("*"),
    ]);
    setRanchos(r.data || []);
    if (r.data?.length) setEmpresaId(r.data[0].empresa_id);
    setProductos(p.data || []);
    setRecetas(rec.data || []);
    setRecetaDet(rd.data || []);
    setAplicaciones(f.data || []);
    setAplicacionDet(fd.data || []);
    setMediciones(m.data || []);
    setEstadoSectores(es.data || []);
    setProgramaciones(rp.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { if (usuarioActual) cargarDatos(); }, [usuarioActual, cargarDatos]);

  function avisar(texto) { setAviso(texto); setTimeout(() => setAviso(null), 6000); }

  const esAdmin        = usuarioActual?.rol === "admin";
  const esAgronomo     = usuarioActual?.rol === "agronomo";
  const esEncargado    = usuarioActual?.rol === "encargado";
  const puedeRecomendar = esAdmin || esAgronomo;

  const nombreRancho   = id => ranchos.find(r => r.id === id)?.nombre || "?";
  const nombreProducto = id => productos.find(p => p.id === id)?.nombre_comercial || "?";
  const unidadProducto = id => productos.find(p => p.id === id)?.unidad_base || "";
  const sectorInfo = id => estadoSectores.find(s => s.sector_id === id);
  // Día ISO de una fecha (1=lunes ... 7=domingo)
  const diaISO = fecha => { const d = new Date(fecha + "T00:00:00").getDay(); return d === 0 ? 7 : d; };

  // ================= REPORTES =================
  const cargarReporte = useCallback(async () => {
    if (!repDesde || !repHasta) return;
    setCargandoReporte(true);
    let qf = supabase.from("fertilizaciones").select("*")
      .gte("fecha_recomendada", repDesde)
      .lte("fecha_recomendada", repHasta);
    if (esEncargado) qf = qf.eq("rancho_id", usuarioActual.rancho_id);
    else if (repRanchoId !== "todos") qf = qf.eq("rancho_id", repRanchoId);

    const { data: fData, error: e1 } = await qf;
    if (e1) { setError(e1.message); setCargandoReporte(false); return; }
    setRepFert(fData || []);

    const ids = (fData || []).map(f => f.id);
    if (ids.length === 0) { setRepFertDet([]); setCargandoReporte(false); return; }
    const { data: dData, error: e2 } = await supabase.from("fertilizacion_detalle")
      .select("*").in("fertilizacion_id", ids);
    if (e2) { setError(e2.message); setCargandoReporte(false); return; }
    setRepFertDet(dData || []);
    setCargandoReporte(false);
  }, [repDesde, repHasta, repRanchoId, esEncargado, usuarioActual]);

  useEffect(() => {
    if (pestana === "reportes" && usuarioActual) cargarReporte();
  }, [pestana, usuarioActual, cargarReporte]);

  // ---- Comparativo recomendado vs aplicado (solo eventos ya ejecutados) ----
  const comparativoPorProducto = (() => {
    const ejecutadas = repFert.filter(f => f.estado === "aplicada" || f.estado === "modificada");
    const idsEjecutadas = new Set(ejecutadas.map(f => f.id));
    const mapa = {};
    repFertDet.filter(d => idsEjecutadas.has(d.fertilizacion_id)).forEach(d => {
      if (!mapa[d.producto_id]) mapa[d.producto_id] = { recomendado: 0, aplicado: 0 };
      mapa[d.producto_id].recomendado += Number(d.cantidad_recomendada);
      mapa[d.producto_id].aplicado += Number(d.cantidad_aplicada ?? d.cantidad_recomendada);
    });
    return Object.entries(mapa)
      .map(([producto_id, v]) => ({
        producto_id, ...v,
        nombre: nombreProducto(producto_id),
        unidad: unidadProducto(producto_id),
        diferencia: v.aplicado - v.recomendado,
        pctCumplido: v.recomendado > 0 ? Math.round((v.aplicado / v.recomendado) * 100) : 0,
      }))
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  })();

  // ---- Historial de modificaciones con motivos ----
  const modificacionesLista = repFert
    .filter(f => f.estado === "modificada")
    .sort((a, b) => new Date(b.fecha_recomendada) - new Date(a.fecha_recomendada));

  const motivosResumen = (() => {
    const mapa = {};
    modificacionesLista.forEach(f => {
      const m = f.motivo_modificacion || "sin_motivo";
      mapa[m] = (mapa[m] || 0) + 1;
    });
    return Object.entries(mapa)
      .map(([motivo, total]) => ({
        motivo,
        label: MOTIVOS.find(m => m.value === motivo)?.label || "Sin motivo registrado",
        total,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  function exportarComparativoCSV() {
    const encabezado = ["Producto", "Recomendado", "Aplicado", "Diferencia", "% cumplido", "Unidad", "Del", "Al"];
    const filas = comparativoPorProducto.map(c => [
      c.nombre, c.recomendado.toFixed(3), c.aplicado.toFixed(3), c.diferencia.toFixed(3),
      c.pctCumplido, c.unidad, repDesde, repHasta,
    ]);
    const csv = [encabezado, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `comparativo_recomendado_aplicado_${repDesde}_a_${repHasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportarModificacionesCSV() {
    const encabezado = ["Fecha", "Rancho", "Sector", "Motivo", "Detalle"];
    const filas = modificacionesLista.map(f => [
      f.fecha_recomendada, nombreRancho(f.rancho_id), f.sector,
      MOTIVOS.find(m => m.value === f.motivo_modificacion)?.label || "Sin motivo",
      f.motivo_otro_texto || "",
    ]);
    const csv = [encabezado, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `modificaciones_${repDesde}_a_${repHasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ================= RECOMENDACIONES =================
  function usarReceta(recetaId) {
    if (!recetaId) { setNueva(n => ({ ...n, receta_id: "" })); return; }
    const rec = recetas.find(x => x.id === recetaId);
    const det = recetaDet.filter(d => d.receta_id === recetaId);
    // Si la receta es por hectárea, se multiplica por la superficie del sector
    const info = sectorInfo(nueva.sector_id);
    const factor = rec.modo_dosis === "por_ha" && info ? Number(info.superficie_ha) : 1;
    setNueva(n => ({ ...n, receta_id: recetaId, via: rec.tipo_aplicacion }));
    setLineas(det.map(d => ({
      producto_id: d.producto_id,
      cantidad: String(Math.round(Number(d.cantidad_por_sector) * factor * 1000) / 1000),
    })));
  }

  // Semana fenológica de un sector en una fecha cualquiera (no solo "hoy")
  function semanaEnFecha(sectorId, fechaStr) {
    const info = sectorInfo(sectorId);
    if (!info || !info.fecha_referencia) return null;
    const fecha = new Date(fechaStr + "T00:00:00");
    const ref = new Date(info.fecha_referencia + "T00:00:00");
    const diffDias = Math.floor((fecha - ref) / 86400000);
    return Math.floor(diffDias / 7) + 1;
  }

  // Dentro de un rango [desde, hasta], las fechas que caen en algún día y
  // semana fenológica programados para esta receta en este sector
  function fechasProgramadasEnRango(recetaId, sectorId, desde, hasta) {
    const progs = programaciones.filter(pr => pr.activo && pr.receta_id === recetaId && pr.sector_id === sectorId);
    if (!progs.length) return [];
    const resultado = [];
    let d = new Date(desde + "T00:00:00");
    const fin = new Date(hasta + "T00:00:00");
    while (d <= fin) {
      const iso = d.toISOString().split("T")[0];
      const dia = diaISO(iso);
      const semana = semanaEnFecha(sectorId, iso);
      if (semana != null && progs.some(pr => semana >= pr.semana_desde && semana <= pr.semana_hasta && (pr.dias_semana || []).includes(dia))) {
        resultado.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return resultado;
  }

  // Recetas programadas para el sector, su semana fenológica y el día elegido
  function recetasSugeridas() {
    const info = sectorInfo(nueva.sector_id);
    if (!info || info.semana_fenologica == null) return [];
    const dia = diaISO(nueva.fecha);
    return programaciones
      .filter(pr => pr.activo && pr.sector_id === nueva.sector_id
        && info.semana_fenologica >= pr.semana_desde
        && info.semana_fenologica <= pr.semana_hasta
        && (pr.dias_semana || []).includes(dia))
      .map(pr => recetas.find(r => r.id === pr.receta_id))
      .filter(r => r && r.activo);
  }

  function cambiarLinea(setter, arr, i, campo, valor) {
    const nuevas = [...arr];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    setter(nuevas);
  }

  // Crea un único evento de recomendación en la fecha indicada
  async function crearEventoRecomendacion(info, fecha, validas) {
    const { data: cab, error: e1 } = await supabase.from("fertilizaciones").insert({
      empresa_id: empresaId,
      rancho_id: info.rancho_id,
      sector_id: nueva.sector_id,
      sector: info.sector,
      tipo_aplicacion: nueva.via,
      receta_id: nueva.receta_id || null,
      fecha_recomendada: fecha,
      minutos_riego: nueva.via === "fertirriego" && nueva.minutos_riego ? Number(nueva.minutos_riego) : null,
      recomendada_por: usuarioActual.id,
      notas: nueva.notas || null,
    }).select("id").single();
    if (e1) return e1.message;

    for (const l of validas) {
      const { error: e2 } = await supabase.from("fertilizacion_detalle").insert({
        fertilizacion_id: cab.id,
        producto_id: l.producto_id,
        cantidad_recomendada: Number(l.cantidad),
      });
      if (e2) return `${nombreProducto(l.producto_id)}: ${e2.message}`;
    }
    return null;
  }

  async function guardarRecomendacion() {
    const info = sectorInfo(nueva.sector_id);
    if (!info) return setError("Selecciona el sector.");
    const validas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return setError("Agrega al menos un producto con cantidad.");

    // Modo lote: generar una recomendación por cada día programado en el rango
    if (generarRango && nueva.receta_id) {
      if (!rangoHasta) return setError("Indica hasta qué fecha generar.");
      const fechas = fechasProgramadasEnRango(nueva.receta_id, nueva.sector_id, nueva.fecha, rangoHasta);
      if (!fechas.length) return setError("No hay días programados de esta receta para este sector en ese rango de fechas.");

      for (const fch of fechas) {
        const err = await crearEventoRecomendacion(info, fch, validas);
        if (err) return setError(err);
      }
      avisar(`${fechas.length} recomendaciones generadas (una por cada día programado). El encargado las verá como pendientes.`);
    } else {
      const err = await crearEventoRecomendacion(info, nueva.fecha, validas);
      if (err) return setError(err);
      avisar("Recomendación creada. El encargado la verá como pendiente.");
    }

    setCreando(false);
    setNueva({ sector_id: "", via: "fertirriego", receta_id: "", fecha: todayISO(), minutos_riego: "", notas: "" });
    setLineas([{ producto_id: "", cantidad: "" }]);
    setGenerarRango(false);
    setRangoHasta("");
    cargarDatos();
  }

  // ================= CONFIRMACIÓN EN CAMPO =================
  function abrirConfirmacion(f) {
    const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
    const base = {};
    det.forEach(d => { base[d.id] = String(d.cantidad_recomendada); });
    setAplicadas(base);
    setMotivo(""); setMotivoTexto("");
    setConfirmando(f.id);
  }

  function hayCambios(f) {
    return aplicacionDet
      .filter(d => d.fertilizacion_id === f.id)
      .some(d => Number(aplicadas[d.id]) !== Number(d.cantidad_recomendada));
  }

  async function confirmarAplicacion(f) {
    const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
    if (hayCambios(f) && !motivo)
      return setError("Las cantidades difieren de lo recomendado: selecciona el motivo.");
    if (motivo === "otro" && !motivoTexto.trim())
      return setError("Describe el motivo en el campo de texto.");

    for (const d of det) {
      const cant = Number(aplicadas[d.id]);
      if (cant !== Number(d.cantidad_recomendada)) {
        const { error: e } = await supabase.from("fertilizacion_detalle")
          .update({ cantidad_aplicada: cant }).eq("id", d.id);
        if (e) return setError(e.message);
      }
    }
    const { error: e } = await supabase.from("fertilizaciones").update({
      estado: "aplicada",
      aplicada_por: usuarioActual.id,
      motivo_modificacion: hayCambios(f) ? motivo : null,
      motivo_otro_texto: motivo === "otro" ? motivoTexto.trim() : null,
    }).eq("id", f.id);
    if (e) return setError(e.message);
    avisar("Aplicación confirmada. El inventario de la bodega del rancho fue descontado.");
    setConfirmando(null);
    cargarDatos();
  }

  async function cancelarRecomendacion(f) {
    if (!window.confirm("¿Cancelar esta recomendación?")) return;
    const { error: e } = await supabase.from("fertilizaciones")
      .update({ estado: "cancelada" }).eq("id", f.id);
    if (e) return setError(e.message);
    avisar("Recomendación cancelada.");
    cargarDatos();
  }

  // ================= RECETAS =================
  async function guardarReceta() {
    if (!nuevaReceta.nombre || !nuevaReceta.cultivo)
      return setError("La receta necesita nombre y cultivo.");
    const validas = lineasReceta.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return setError("Agrega al menos un producto con dosis.");

    const { data: cab, error: e1 } = await supabase.from("recetas").insert({
      empresa_id: empresaId,
      nombre: nuevaReceta.nombre.trim(),
      cultivo: nuevaReceta.cultivo.trim(),
      etapa_fenologica: nuevaReceta.etapa.trim() || null,
      tipo_aplicacion: nuevaReceta.via,
      modo_dosis: nuevaReceta.modo,
      creado_por: usuarioActual.id,
    }).select("id").single();
    if (e1) {
      if (e1.message.includes("duplicate")) return setError("Ya existe una receta con ese nombre.");
      return setError(e1.message);
    }

    for (const l of validas) {
      const { error: e2 } = await supabase.from("receta_detalle").insert({
        receta_id: cab.id,
        producto_id: l.producto_id,
        cantidad_por_sector: Number(l.cantidad),
      });
      if (e2) return setError(`${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("Receta guardada.");
    setCreandoReceta(false);
    setNuevaReceta({ nombre: "", cultivo: "", etapa: "", via: "fertirriego", modo: "por_ha" });
    setLineasReceta([{ producto_id: "", cantidad: "" }]);
    cargarDatos();
  }

  async function alternarReceta(r) {
    const { error: e } = await supabase.from("recetas")
      .update({ activo: !r.activo }).eq("id", r.id);
    if (e) return setError(e.message);
    cargarDatos();
  }

  // ================= PROGRAMACIÓN DE RECETAS =================
  async function guardarProgramacion(recetaId) {
    if (!progForm.sector_id || !progForm.desde || !progForm.hasta)
      return setError("Completa sector y rango de semanas.");
    if (Number(progForm.hasta) < Number(progForm.desde))
      return setError("La semana final no puede ser menor que la inicial.");
    if (!progForm.dias.length) return setError("Selecciona al menos un día de la semana.");
    const { error: e } = await supabase.from("receta_programacion").insert({
      receta_id: recetaId,
      sector_id: progForm.sector_id,
      semana_desde: Number(progForm.desde),
      semana_hasta: Number(progForm.hasta),
      dias_semana: progForm.dias,
    });
    if (e) return setError(e.message);
    avisar("Programación guardada.");
    setProgramando(null);
    setProgForm({ sector_id: "", desde: "", hasta: "", dias: [1, 3, 5] });
    cargarDatos();
  }

  async function borrarProgramacion(id) {
    if (!window.confirm("¿Quitar esta programación de la receta?")) return;
    const { error: e } = await supabase.from("receta_programacion").delete().eq("id", id);
    if (e) return setError(e.message);
    avisar("Programación eliminada.");
    cargarDatos();
  }

  // ================= CICLOS: NUEVA ETAPA =================
  async function iniciarEtapa(sectorId) {
    if (!etapaForm.etapa.trim()) return setError("Escribe el nombre de la nueva etapa.");
    const info = sectorInfo(sectorId);
    if (info?.ciclo_id) {
      const { error: e1 } = await supabase.from("ciclos_sector")
        .update({ activo: false, cerrado_en: new Date().toISOString() })
        .eq("id", info.ciclo_id);
      if (e1) return setError(e1.message);
    }
    const { error: e2 } = await supabase.from("ciclos_sector").insert({
      sector_id: sectorId,
      etapa: etapaForm.etapa.trim(),
      evento_referencia: etapaForm.evento,
      fecha_referencia: etapaForm.fecha,
    });
    if (e2) return setError(e2.message);
    avisar("Nueva etapa iniciada: el reloj de semanas fenológicas se reinició desde la fecha indicada. La etapa anterior quedó en el historial.");
    setNuevaEtapa(null);
    setEtapaForm({ etapa: "", evento: "pinchado", fecha: todayISO() });
    cargarDatos();
  }

  // ================= MEDICIONES =================
  async function guardarMedicion() {
    const info = sectorInfo(med.sector_id);
    if (!info) return setError("Selecciona el sector.");
    if (!med.ce && !med.ph && !med.humedad) return setError("Captura al menos CE, pH o humedad.");
    const { error: e } = await supabase.from("mediciones_campo").insert({
      empresa_id: empresaId,
      rancho_id: info.rancho_id,
      sector: info.sector,
      tipo_muestra: med.tipo,
      ce: med.ce ? Number(med.ce) : null,
      ph: med.ph ? Number(med.ph) : null,
      humedad_suelo_pct: med.humedad ? Number(med.humedad) : null,
      registrado_por: usuarioActual.id,
      notas: med.notas || null,
    });
    if (e) return setError(e.message);
    avisar("Medición registrada.");
    setMed({ sector_id: "", tipo: "suelo", ce: "", ph: "", humedad: "", notas: "" });
    cargarDatos();
  }

  // ================= RENDER =================
  if (sesion === undefined) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>💧</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (!sesion) return <Login />;

  if (cargando && ranchos.length === 0) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>💧</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Cargando módulo Fertilizaciones...</div>
      </div>
    </div>
  );

  const aplicacionesVisibles = aplicaciones
    .filter(f => !esEncargado || f.rancho_id === usuarioActual.rancho_id)
    .filter(f => filtroEstado === "todas" || f.estado === filtroEstado)
    .filter(f => !filtroFecha || f.fecha_recomendada === filtroFecha)
    .slice()
    .sort((a, b) => filtroEstado === "pendiente"
      ? new Date(a.fecha_recomendada) - new Date(b.fecha_recomendada)   // más antigua (más urgente) primero
      : new Date(b.fecha_recomendada) - new Date(a.fecha_recomendada)); // más reciente primero

  const recetasFiltradas = recetas
    .filter(r => recVerInactivas || r.activo)
    .filter(r => recFiltroVia === "todas" || r.tipo_aplicacion === recFiltroVia)
    .filter(r => recFiltroCultivo === "todos" || r.cultivo === recFiltroCultivo)
    .filter(r => !recBuscar.trim() || r.nombre.toLowerCase().includes(recBuscar.trim().toLowerCase()));

  return (
    <div style={S.page}>
      <style>{`select option { background-color: #0f2818; color: #e8f5e0; }`}</style>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · FERTILIZACIÓN</div>
            <h1 style={S.title}>Fertilizaciones</h1>
            <div style={S.usuarioTag}>
              {usuarioActual?.nombre_completo} · {ROLES_TXT[usuarioActual?.rol] || usuarioActual?.rol}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>💧</div>
            <div style={S.version}>v0.3.21</div>
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
          {[
            { key: "aplicaciones", label: "🧪 Aplicaciones" },
            { key: "recetas", label: "📖 Recetas" },
            { key: "sectores", label: "🗺️ Sectores" },
            { key: "mediciones", label: "🌡️ CE / pH" },
            { key: "reportes", label: "📈 Reportes" },
          ].map(p => (
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

        {/* ============ APLICACIONES ============ */}
        {pestana === "aplicaciones" && (
          <div>
            {puedeRecomendar && !creando && (
              <button style={S.btnPrimary} onClick={() => setCreando(true)}>+ Nueva recomendación</button>
            )}

            {creando && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Nueva recomendación</div>

                <div style={S.formGroup}>
                  <label style={S.label}>SECTOR</label>
                  <select style={S.select} value={nueva.sector_id}
                    onChange={e => setNueva({ ...nueva, sector_id: e.target.value, receta_id: "" })}>
                    <option value="">— Selecciona —</option>
                    {estadoSectores.map(s => (
                      <option key={s.sector_id} value={s.sector_id}>
                        {s.rancho} · {s.sector}
                      </option>
                    ))}
                  </select>
                  {sectorInfo(nueva.sector_id) && (
                    <div style={{ fontSize: 12, color: "#7fbf5a", marginTop: 6, fontWeight: 600 }}>
                      {sectorInfo(nueva.sector_id).etapa} · Sem. fenológica {sectorInfo(nueva.sector_id).semana_fenologica} · Sem. calendario {sectorInfo(nueva.sector_id).semana_calendario} · {Number(sectorInfo(nueva.sector_id).superficie_ha)} ha
                    </div>
                  )}
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>VÍA DE APLICACIÓN</label>
                    <select style={S.select} value={nueva.via}
                      onChange={e => { setNueva({ ...nueva, via: e.target.value, receta_id: "" }); setLineas([{ producto_id: "", cantidad: "" }]); }}>
                      {VIAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>FECHA RECOMENDADA</label>
                    <input style={S.select} type="date" value={nueva.fecha}
                      onChange={e => setNueva({ ...nueva, fecha: e.target.value })} />
                  </div>
                </div>

                {recetasSugeridas().length > 0 && (
                  <div style={{ ...S.formGroup, background: "rgba(127,191,90,0.08)", border: "1px solid rgba(127,191,90,0.3)", borderRadius: 10, padding: 10 }}>
                    <label style={S.label}>📌 PROGRAMADAS PARA ESTE SECTOR, SEMANA Y DÍA</label>
                    {recetasSugeridas().map(r => (
                      <button key={r.id} style={{ ...S.btnSecundario, marginRight: 6, marginTop: 4 }}
                        onClick={() => usarReceta(r.id)}>
                        Usar: {r.nombre}
                      </button>
                    ))}
                  </div>
                )}

                <div style={S.formGroup}>
                  <label style={S.label}>PARTIR DE UNA RECETA (OPCIONAL)</label>
                  <select style={S.select} value={nueva.receta_id} onChange={e => usarReceta(e.target.value)}>
                    <option value="">— Captura libre —</option>
                    {recetas.filter(r => r.activo && r.tipo_aplicacion === nueva.via)
                      .map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>

                {nueva.receta_id && programaciones.some(pr => pr.activo && pr.receta_id === nueva.receta_id && pr.sector_id === nueva.sector_id) && (
                  <div style={{ ...S.formGroup, background: "rgba(90,155,212,0.08)", border: "1px solid rgba(90,155,212,0.3)", borderRadius: 10, padding: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e8f5e0", cursor: "pointer" }}>
                      <input type="checkbox" checked={generarRango} onChange={e => setGenerarRango(e.target.checked)} />
                      📅 Generar automáticamente para todos los días programados
                    </label>
                    {generarRango && (
                      <div style={{ marginTop: 10 }}>
                        <label style={S.label}>GENERAR DESDE {nueva.fecha} HASTA</label>
                        <input style={S.select} type="date" min={nueva.fecha} value={rangoHasta}
                          onChange={e => setRangoHasta(e.target.value)} />
                        <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)", marginTop: 4 }}>
                          Se creará una recomendación pendiente por cada día, dentro de este rango, que coincida con los días y semanas programados de esta receta para este sector.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <label style={S.label}>PRODUCTOS Y CANTIDADES POR SECTOR</label>
                {lineas.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select style={{ ...S.select, flex: 2 }} value={l.producto_id}
                      onChange={e => cambiarLinea(setLineas, lineas, i, "producto_id", e.target.value)}>
                      <option value="">— Producto —</option>
                      {productos.filter(p => compatible(p, nueva.via))
                        .map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    </select>
                    <input style={{ ...S.select, flex: 1 }} type="number" min="0" step="0.001"
                      placeholder="Cant." value={l.cantidad}
                      onChange={e => cambiarLinea(setLineas, lineas, i, "cantidad", e.target.value)} />
                  </div>
                ))}
                <button style={S.btnSecundario} onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "" }])}>
                  + Agregar producto
                </button>

                {nueva.via === "fertirriego" && (
                  <div style={{ ...S.formGroup, marginTop: 16 }}>
                    <label style={S.label}>MINUTOS DE RIEGO (OPCIONAL)</label>
                    <input style={S.select} type="number" min="1" placeholder="ej. 30" value={nueva.minutos_riego}
                      onChange={e => setNueva({ ...nueva, minutos_riego: e.target.value })} />
                    <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)", marginTop: 4 }}>
                      Tiempo de riego en que se aplica la solución (dato de control agronómico).
                    </div>
                  </div>
                )}

                <div style={{ ...S.formGroup, marginTop: 16 }}>
                  <label style={S.label}>NOTAS</label>
                  <input style={S.select} value={nueva.notas}
                    onChange={e => setNueva({ ...nueva, notas: e.target.value })} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={guardarRecomendacion}>
                    {generarRango ? "Generar recomendaciones" : "Guardar recomendación"}
                  </button>
                  <button style={S.btnSecundario} onClick={() => { setCreando(false); setGenerarRango(false); setRangoHasta(""); }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Filtro por estado */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {["pendiente", "aplicada", "modificada", "cancelada", "todas"].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  style={{
                    ...S.btnSecundario, padding: "6px 10px", fontSize: 11,
                    background: filtroEstado === e ? "rgba(127,191,90,0.15)" : "transparent",
                    color: filtroEstado === e ? "#7fbf5a" : "rgba(200,230,180,0.5)",
                  }}>
                  {e === "todas" ? "Todas" : `${ESTADOS[e].icono} ${ESTADOS[e].label}`}
                </button>
              ))}
            </div>

            {/* Filtro por fecha */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setFiltroFecha(f => f === todayISO() ? "" : todayISO())}
                style={{
                  ...S.btnSecundario, padding: "6px 10px", fontSize: 11,
                  background: filtroFecha === todayISO() ? "rgba(127,191,90,0.15)" : "transparent",
                  color: filtroFecha === todayISO() ? "#7fbf5a" : "rgba(200,230,180,0.5)",
                }}>
                📅 Hoy
              </button>
              <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
                style={{ ...S.select, width: "auto", padding: "6px 10px", fontSize: 11 }} />
              {filtroFecha && (
                <button onClick={() => setFiltroFecha("")} style={{ ...S.btnCerrarError, fontSize: 11, color: "#e05c5c" }}>
                  ✕ Quitar filtro de fecha
                </button>
              )}
            </div>

            {aplicacionesVisibles.map(f => {
              const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
              const est = ESTADOS[f.estado];
              const abierta = confirmando === f.id;
              const costoTotal = det.reduce((s, d) =>
                s + Number(d.cantidad_aplicada ?? 0) * Number(d.costo_unitario ?? 0), 0);
              return (
                <div key={f.id} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>
                      {nombreRancho(f.rancho_id)} · Sector {f.sector} ·{" "}
                      {VIAS.find(v => v.value === f.tipo_aplicacion)?.label}
                    </div>
                    <span style={{ ...S.miniTag, color: est.color, background: `${est.color}22` }}>
                      {est.icono} {est.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(200,230,180,0.45)", margin: "4px 0 8px" }}>
                    Recomendada: {f.fecha_recomendada}
                    {f.fecha_aplicada && ` · Aplicada: ${new Date(f.fecha_aplicada).toLocaleDateString("es-MX")}`}
                    {f.minutos_riego && ` · 💧 ${f.minutos_riego} min de riego`}
                  </div>
                  {f.motivo_modificacion && (
                    <div style={{ fontSize: 12, color: "#5a9bd4", marginBottom: 6 }}>
                      Motivo: {MOTIVOS.find(m => m.value === f.motivo_modificacion)?.label}
                      {f.motivo_otro_texto ? ` — ${f.motivo_otro_texto}` : ""}
                    </div>
                  )}

                  {det.map(d => (
                    <div key={d.id} style={S.cardRow}>
                      <span>{nombreProducto(d.producto_id)}</span>
                      {abierta ? (
                        <input style={{ ...S.select, width: 100, padding: "6px 8px" }} type="number" min="0" step="0.001"
                          value={aplicadas[d.id] ?? ""}
                          onChange={e => setAplicadas({ ...aplicadas, [d.id]: e.target.value })} />
                      ) : (
                        <b style={{ color: "#e8f5e0" }}>
                          {f.estado === "pendiente"
                            ? `${Number(d.cantidad_recomendada)} ${unidadProducto(d.producto_id)}`
                            : `${Number(d.cantidad_aplicada ?? d.cantidad_recomendada)} ${unidadProducto(d.producto_id)}`}
                          {(f.estado === "modificada" && Number(d.cantidad_aplicada) !== Number(d.cantidad_recomendada)) &&
                            <span style={{ color: "#5a9bd4" }}> (rec. {Number(d.cantidad_recomendada)})</span>}
                        </b>
                      )}
                    </div>
                  ))}

                  {(f.estado === "aplicada" || f.estado === "modificada") && costoTotal > 0 && (
                    <div style={{ textAlign: "right", fontWeight: 800, color: "#7fbf5a", marginTop: 6, fontSize: 13 }}>
                      Costo: ${costoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </div>
                  )}

                  {abierta && (
                    <>
                      {hayCambios(f) && (
                        <div style={{ ...S.formGroup, marginTop: 12 }}>
                          <label style={S.label}>MOTIVO DE LA MODIFICACIÓN</label>
                          <select style={S.select} value={motivo} onChange={e => setMotivo(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                          {motivo === "otro" && (
                            <input style={{ ...S.select, marginTop: 8 }} placeholder="Describe el motivo"
                              value={motivoTexto} onChange={e => setMotivoTexto(e.target.value)} />
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={() => confirmarAplicacion(f)}>
                          ✅ Confirmar aplicación
                        </button>
                        <button style={S.btnSecundario} onClick={() => setConfirmando(null)}>Cerrar</button>
                      </div>
                    </>
                  )}

                  {f.estado === "pendiente" && !abierta && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={() => abrirConfirmacion(f)}>
                        Registrar aplicación
                      </button>
                      {puedeRecomendar && (
                        <button style={{ ...S.btnSecundario, color: "#e05c5c", borderColor: "rgba(224,92,92,0.4)" }}
                          onClick={() => cancelarRecomendacion(f)}>Cancelar</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {aplicacionesVisibles.length === 0 && <div style={S.empty}>No hay aplicaciones con este filtro.</div>}
          </div>
        )}

        {/* ============ RECETAS ============ */}
        {pestana === "recetas" && (
          <div>
            {puedeRecomendar && !creandoReceta && (
              <button style={S.btnPrimary} onClick={() => setCreandoReceta(true)}>+ Nueva receta</button>
            )}

            {creandoReceta && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Nueva receta</div>

                <div style={S.formGroup}>
                  <label style={S.label}>NOMBRE</label>
                  <input style={S.select} value={nuevaReceta.nombre}
                    onChange={e => setNuevaReceta({ ...nuevaReceta, nombre: e.target.value })} />
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>CULTIVO</label>
                    <input style={S.select} placeholder="ej. Frambuesa" value={nuevaReceta.cultivo}
                      onChange={e => setNuevaReceta({ ...nuevaReceta, cultivo: e.target.value })} />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>ETAPA FENOLÓGICA</label>
                    <input style={S.select} placeholder="ej. Fructificación" value={nuevaReceta.etapa}
                      onChange={e => setNuevaReceta({ ...nuevaReceta, etapa: e.target.value })} />
                  </div>
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>VÍA DE APLICACIÓN</label>
                    <select style={S.select} value={nuevaReceta.via}
                      onChange={e => { setNuevaReceta({ ...nuevaReceta, via: e.target.value }); setLineasReceta([{ producto_id: "", cantidad: "" }]); }}>
                      {VIAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>MODO DE DOSIS</label>
                    <select style={S.select} value={nuevaReceta.modo}
                      onChange={e => setNuevaReceta({ ...nuevaReceta, modo: e.target.value })}>
                      <option value="por_ha">Por hectárea (estándar)</option>
                      <option value="por_sector">Total por sector</option>
                    </select>
                  </div>
                </div>

                <label style={S.label}>{nuevaReceta.modo === "por_ha" ? "PRODUCTOS Y DOSIS POR HECTÁREA" : "PRODUCTOS Y DOSIS POR SECTOR"}</label>
                {lineasReceta.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select style={{ ...S.select, flex: 2 }} value={l.producto_id}
                      onChange={e => cambiarLinea(setLineasReceta, lineasReceta, i, "producto_id", e.target.value)}>
                      <option value="">— Producto —</option>
                      {productos.filter(p => compatible(p, nuevaReceta.via))
                        .map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    </select>
                    <input style={{ ...S.select, flex: 1 }} type="number" min="0" step="0.001"
                      placeholder="Dosis" value={l.cantidad}
                      onChange={e => cambiarLinea(setLineasReceta, lineasReceta, i, "cantidad", e.target.value)} />
                  </div>
                ))}
                <button style={S.btnSecundario} onClick={() => setLineasReceta([...lineasReceta, { producto_id: "", cantidad: "" }])}>
                  + Agregar producto
                </button>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={guardarReceta}>Guardar receta</button>
                  <button style={S.btnSecundario} onClick={() => setCreandoReceta(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Buscador y filtros */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input style={{ ...S.select, flex: 2, minWidth: 140 }} placeholder="🔍 Buscar por nombre…"
                value={recBuscar} onChange={e => setRecBuscar(e.target.value)} />
              <select style={{ ...S.select, flex: 1, minWidth: 120 }} value={recFiltroVia}
                onChange={e => setRecFiltroVia(e.target.value)}>
                <option value="todas">Todas las vías</option>
                {VIAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
              <select style={{ ...S.select, flex: 1, minWidth: 120 }} value={recFiltroCultivo}
                onChange={e => setRecFiltroCultivo(e.target.value)}>
                <option value="todos">Todos los cultivos</option>
                {[...new Set(recetas.map(r => r.cultivo))].sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(200,230,180,0.6)", marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={recVerInactivas} onChange={e => setRecVerInactivas(e.target.checked)} />
              Mostrar recetas inactivas
            </label>

            {recetasFiltradas.map(r => {
              const det = recetaDet.filter(d => d.receta_id === r.id);
              const costo = det.reduce((s, d) => {
                const p = productos.find(x => x.id === d.producto_id);
                return s + Number(d.cantidad_por_sector) * Number(p?.costo_unitario || 0);
              }, 0);
              return (
                <div key={r.id} style={{ ...S.card, opacity: r.activo ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>{r.nombre}</div>
                    <span style={{ fontSize: 12, color: "#7fbf5a", fontWeight: 600 }}>
                      {VIAS.find(v => v.value === r.tipo_aplicacion)?.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(200,230,180,0.45)", marginBottom: 6 }}>
                    {r.cultivo}{r.etapa_fenologica ? ` · ${r.etapa_fenologica}` : ""}
                    {!r.activo && " · INACTIVA"}
                  </div>
                  {det.map(d => (
                    <div key={d.id} style={S.cardRow}>
                      <span>{nombreProducto(d.producto_id)}</span>
                      <b style={{ color: "#e8f5e0" }}>{Number(d.cantidad_por_sector)} {unidadProducto(d.producto_id)}{r.modo_dosis === "por_ha" ? "/ha" : "/sector"}</b>
                    </div>
                  ))}
                  {/* Programación por sectores / semanas / días */}
                  {programaciones.filter(pr => pr.receta_id === r.id).map(pr => {
                    const inf = estadoSectores.find(s => s.sector_id === pr.sector_id);
                    return (
                      <div key={pr.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#7fbf5a", padding: "3px 0" }}>
                        <span>
                          📌 {inf ? `${inf.rancho} · ${inf.sector}` : "Sector"} · sem. {pr.semana_desde}–{pr.semana_hasta} · {DIAS.filter(([n]) => (pr.dias_semana || []).includes(n)).map(([, t]) => t).join(" ")}
                        </span>
                        {puedeRecomendar && (
                          <button style={{ ...S.btnCerrarError, color: "#e05c5c" }} onClick={() => borrarProgramacion(pr.id)}>✕</button>
                        )}
                      </div>
                    );
                  })}

                  {/* Formulario de programación */}
                  {programando === r.id && (
                    <div style={{ background: "rgba(127,191,90,0.06)", border: "1px solid rgba(127,191,90,0.2)", borderRadius: 10, padding: 10, marginTop: 8 }}>
                      <div style={S.formGroup}>
                        <label style={S.label}>SECTOR</label>
                        <select style={S.select} value={progForm.sector_id}
                          onChange={e => setProgForm({ ...progForm, sector_id: e.target.value })}>
                          <option value="">— Selecciona —</option>
                          {estadoSectores.map(s => (
                            <option key={s.sector_id} value={s.sector_id}>{s.rancho} · {s.sector}</option>
                          ))}
                        </select>
                        {progForm.sector_id && (() => {
                          const inf = estadoSectores.find(s => s.sector_id === progForm.sector_id);
                          return inf ? (
                            <div style={{ fontSize: 11, color: "#7fbf5a", marginTop: 4 }}>
                              Este sector va hoy en la semana fenológica {inf.semana_fenologica} ({inf.etapa})
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div style={S.formRow}>
                        <div style={{ ...S.formGroup, flex: 1 }}>
                          <label style={S.label}>SEM. FENOLÓGICA DESDE</label>
                          <input style={S.select} type="number" min="1" value={progForm.desde}
                            onChange={e => setProgForm({ ...progForm, desde: e.target.value })} />
                        </div>
                        <div style={{ ...S.formGroup, flex: 1 }}>
                          <label style={S.label}>SEM. FENOLÓGICA HASTA</label>
                          <input style={S.select} type="number" min="1" value={progForm.hasta}
                            onChange={e => setProgForm({ ...progForm, hasta: e.target.value })} />
                        </div>
                      </div>
                      <label style={S.label}>DÍAS DE APLICACIÓN</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {DIAS.map(([n, t]) => (
                          <button key={n}
                            onClick={() => setProgForm(fp => ({ ...fp, dias: fp.dias.includes(n) ? fp.dias.filter(x => x !== n) : [...fp.dias, n].sort((a, b) => a - b) }))}
                            style={{ ...S.btnSecundario, padding: "8px 0", flex: 1, fontSize: 11,
                              background: progForm.dias.includes(n) ? "rgba(127,191,90,0.3)" : "transparent" }}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1, padding: 10 }} onClick={() => guardarProgramacion(r.id)}>
                          Guardar programación
                        </button>
                        <button style={S.btnSecundario} onClick={() => setProgramando(null)}>Cerrar</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#7fbf5a", fontWeight: 700 }}>
                      Costo estimado{r.modo_dosis === "por_ha" ? "/ha" : "/sector"}: ${costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                    {puedeRecomendar && (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...S.btnSecundario, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => { setProgramando(programando === r.id ? null : r.id); }}>
                          📌 Programar
                        </button>
                        <button style={{ ...S.btnSecundario, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => alternarReceta(r)}>
                          {r.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {recetasFiltradas.length === 0 && <div style={S.empty}>Ninguna receta coincide con el filtro.</div>}
          </div>
        )}

        {/* ============ SECTORES Y CICLOS ============ */}
        {pestana === "sectores" && (
          <div>
            {estadoSectores
              .filter(s => !esEncargado || s.rancho_id === usuarioActual.rancho_id)
              .map(s => (
                <div key={s.sector_id} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>
                      {s.rancho} · {s.sector}
                    </div>
                    <span style={{ ...S.miniTag, color: "#7fbf5a", background: "rgba(127,191,90,0.15)" }}>
                      {Number(s.superficie_ha)} ha
                    </span>
                  </div>
                  {s.ciclo_id ? (
                    <>
                      <div style={{ fontSize: 13, color: "rgba(200,230,180,0.8)", marginTop: 6 }}>
                        {s.etapa}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(200,230,180,0.5)", marginTop: 2 }}>
                        {EVENTOS_CICLO.find(([v]) => v === s.evento_referencia)?.[1]} · {s.fecha_referencia}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#7fbf5a", marginTop: 6 }}>
                        Semana fenológica {s.semana_fenologica} · Semana calendario {s.semana_calendario}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#e8a23d", marginTop: 6 }}>Sin ciclo activo.</div>
                  )}

                  {puedeRecomendar && nuevaEtapa !== s.sector_id && (
                    <button style={{ ...S.btnSecundario, marginTop: 10, padding: "6px 12px" }}
                      onClick={() => { setNuevaEtapa(s.sector_id); setEtapaForm({ etapa: "", evento: "pinchado", fecha: todayISO() }); }}>
                      🔄 Iniciar nueva etapa
                    </button>
                  )}

                  {nuevaEtapa === s.sector_id && (
                    <div style={{ background: "rgba(127,191,90,0.06)", border: "1px solid rgba(127,191,90,0.2)", borderRadius: 10, padding: 10, marginTop: 10 }}>
                      <div style={S.formGroup}>
                        <label style={S.label}>NOMBRE DE LA ETAPA</label>
                        <input style={S.select} placeholder="ej. Vegetativo post-pinchado" value={etapaForm.etapa}
                          onChange={e => setEtapaForm({ ...etapaForm, etapa: e.target.value })} />
                      </div>
                      <div style={S.formRow}>
                        <div style={{ ...S.formGroup, flex: 1 }}>
                          <label style={S.label}>EVENTO</label>
                          <select style={S.select} value={etapaForm.evento}
                            onChange={e => setEtapaForm({ ...etapaForm, evento: e.target.value })}>
                            {EVENTOS_CICLO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                          </select>
                        </div>
                        <div style={{ ...S.formGroup, flex: 1 }}>
                          <label style={S.label}>FECHA DE REFERENCIA</label>
                          <input style={S.select} type="date" value={etapaForm.fecha}
                            onChange={e => setEtapaForm({ ...etapaForm, fecha: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#e8a23d", marginBottom: 10 }}>
                        ⚠️ La etapa actual se cerrará (queda en historial) y la semana fenológica se reiniciará desde esta fecha.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1, padding: 10 }} onClick={() => iniciarEtapa(s.sector_id)}>
                          Iniciar etapa
                        </button>
                        <button style={S.btnSecundario} onClick={() => setNuevaEtapa(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* ============ MEDICIONES CE / pH ============ */}
        {pestana === "mediciones" && (
          <div>
            <div style={S.card}>
              <div style={S.seccionTitulo}>Registrar medición</div>

              <div style={S.formRow}>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>SECTOR</label>
                  <select style={S.select} value={med.sector_id}
                    onChange={e => setMed({ ...med, sector_id: e.target.value })}>
                    <option value="">— Selecciona —</option>
                    {estadoSectores
                      .filter(s => !esEncargado || s.rancho_id === usuarioActual.rancho_id)
                      .map(s => (
                        <option key={s.sector_id} value={s.sector_id}>{s.rancho} · {s.sector}</option>
                      ))}
                  </select>
                </div>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>TIPO DE MUESTRA</label>
                  <select style={S.select} value={med.tipo} onChange={e => setMed({ ...med, tipo: e.target.value })}>
                    {MUESTRAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={S.formRow}>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>CE (dS/m)</label>
                  <input style={S.select} type="number" min="0" max="20" step="0.01" value={med.ce}
                    onChange={e => setMed({ ...med, ce: e.target.value })} />
                </div>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>pH</label>
                  <input style={S.select} type="number" min="0" max="14" step="0.01" value={med.ph}
                    onChange={e => setMed({ ...med, ph: e.target.value })} />
                </div>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>HUMEDAD (%)</label>
                  <input style={S.select} type="number" min="0" max="100" step="0.1" value={med.humedad}
                    onChange={e => setMed({ ...med, humedad: e.target.value })} />
                </div>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>NOTAS</label>
                <input style={S.select} value={med.notas} onChange={e => setMed({ ...med, notas: e.target.value })} />
              </div>

              <button style={S.btnPrimary} onClick={guardarMedicion}>Guardar medición</button>
            </div>

            <div style={S.card}>
              <div style={S.seccionTitulo}>Últimas mediciones</div>
              {mediciones
                .filter(m => !esEncargado || m.rancho_id === usuarioActual.rancho_id)
                .map(m => (
                  <div key={m.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "rgba(200,230,180,0.8)" }}>
                        {nombreRancho(m.rancho_id)} · S{m.sector} · {MUESTRAS.find(x => x.value === m.tipo_muestra)?.label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(200,230,180,0.45)" }}>
                        {new Date(m.fecha).toLocaleDateString("es-MX")}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#e8f5e0" }}>
                      {m.ce != null && <span style={{ marginRight: 16 }}>CE: {Number(m.ce)} dS/m</span>}
                      {m.humedad_suelo_pct != null && <span style={{ marginRight: 16 }}>💧 Humedad: {Number(m.humedad_suelo_pct)}%</span>}
                      {m.ph != null && <span>pH: {Number(m.ph)}</span>}
                    </div>
                  </div>
                ))}
              {mediciones.length === 0 && <div style={S.empty}>Sin mediciones registradas.</div>}
            </div>
          </div>
        )}

        {/* ============ REPORTES ============ */}
        {pestana === "reportes" && (
          <div>
            {/* --- Filtros comunes --- */}
            <div style={S.card}>
              <div style={S.formRow}>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>DEL</label>
                  <input style={S.select} type="date" value={repDesde} max={repHasta}
                    onChange={e => setRepDesde(e.target.value)} />
                </div>
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>AL</label>
                  <input style={S.select} type="date" value={repHasta} min={repDesde} max={todayISO()}
                    onChange={e => setRepHasta(e.target.value)} />
                </div>
                {!esEncargado && (
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>RANCHO</label>
                    <select style={S.select} value={repRanchoId} onChange={e => setRepRanchoId(e.target.value)}>
                      <option value="todos">Todos los ranchos</option>
                      {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {esEncargado && (
                <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                  Mostrando solo: {nombreRancho(usuarioActual.rancho_id)}
                </div>
              )}
              {cargandoReporte && (
                <div style={{ fontSize: 12, color: "rgba(200,230,180,0.5)", marginTop: 8 }}>Calculando…</div>
              )}
            </div>

            {/* --- Comparativo recomendado vs aplicado --- */}
            <div style={S.card}>
              <div style={S.seccionTitulo}>Comparativo recomendado vs aplicado</div>
              {comparativoPorProducto.length === 0 ? (
                <div style={S.empty}>Sin aplicaciones confirmadas en este periodo.</div>
              ) : (
                <>
                  {comparativoPorProducto.map(c => (
                    <div key={c.producto_id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span style={{ color: "#e8f5e0" }}>{c.nombre}</span>
                        <span style={{
                          fontWeight: 800,
                          color: c.diferencia === 0 ? "#7fbf5a" : c.diferencia > 0 ? "#5a9bd4" : "#e8a23d",
                        }}>
                          {c.pctCumplido}%
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                        Recomendado {c.recomendado.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {c.unidad}
                        {" · "}Aplicado {c.aplicado.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {c.unidad}
                        {c.diferencia !== 0 && (
                          <span> · {c.diferencia > 0 ? "+" : ""}{c.diferencia.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {c.unidad}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <button style={{ ...S.btnSecundario, marginTop: 12 }} onClick={exportarComparativoCSV}>
                    ⬇️ Exportar a Excel (CSV)
                  </button>
                </>
              )}
            </div>

            {/* --- Historial de modificaciones con motivos --- */}
            <div style={S.card}>
              <div style={S.seccionTitulo}>Historial de modificaciones con motivos</div>
              {modificacionesLista.length === 0 ? (
                <div style={S.empty}>Sin modificaciones registradas en este periodo.</div>
              ) : (
                <>
                  {/* Resumen por motivo: detecta patrones recurrentes */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {motivosResumen.map(m => (
                      <span key={m.motivo} style={{ ...S.miniTag, color: "#5a9bd4", background: "rgba(90,155,212,0.15)" }}>
                        {m.label}: {m.total}
                      </span>
                    ))}
                  </div>

                  {modificacionesLista.map(f => (
                    <div key={f.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "#e8f5e0" }}>{nombreRancho(f.rancho_id)} · Sector {f.sector}</span>
                        <span style={{ fontSize: 11, color: "rgba(200,230,180,0.45)" }}>{f.fecha_recomendada}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#5a9bd4" }}>
                        {MOTIVOS.find(m => m.value === f.motivo_modificacion)?.label || "Sin motivo registrado"}
                        {f.motivo_otro_texto ? ` — ${f.motivo_otro_texto}` : ""}
                      </div>
                    </div>
                  ))}
                  <button style={{ ...S.btnSecundario, marginTop: 12 }} onClick={exportarModificacionesCSV}>
                    ⬇️ Exportar a Excel (CSV)
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

