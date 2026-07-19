// ============ JR AGROCONTROL — Fertilizaciones.jsx v0.3.13 ============
// Módulo Fertilizaciones: recomendaciones del agrónomo, confirmación en
// campo (con motivo si se modifica), recetas y mediciones de CE/pH.
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

  // ---- Vistas ----
  const [pestana, setPestana]           = useState("aplicaciones");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");

  // ---- Nueva recomendación ----
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ rancho_id: "", sector: "", via: "fertirriego", receta_id: "", fecha: todayISO(), notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);

  // ---- Confirmación en campo ----
  const [confirmando, setConfirmando] = useState(null);
  const [aplicadas, setAplicadas]     = useState({});
  const [motivo, setMotivo]           = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");

  // ---- Nueva receta ----
  const [creandoReceta, setCreandoReceta] = useState(false);
  const [nuevaReceta, setNuevaReceta] = useState({ nombre: "", cultivo: "", etapa: "", via: "fertirriego" });
  const [lineasReceta, setLineasReceta] = useState([{ producto_id: "", cantidad: "" }]);

  // ---- Nueva medición ----
  const [med, setMed] = useState({ rancho_id: "", sector: "", tipo: "suelo", ce: "", ph: "", notas: "" });

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
    const [r, p, rec, rd, f, fd, m] = await Promise.all([
      supabase.from("ranchos").select("id, nombre, empresa_id").order("nombre"),
      supabase.from("productos_insumos").select("id, nombre_comercial, unidad_base, costo_unitario, via_fertirriego, via_foliar, via_suelo").eq("activo", true).order("nombre_comercial"),
      supabase.from("recetas").select("*").order("nombre"),
      supabase.from("receta_detalle").select("*"),
      supabase.from("fertilizaciones").select("*").order("fecha_recomendada", { ascending: false }).limit(100),
      supabase.from("fertilizacion_detalle").select("*"),
      supabase.from("mediciones_campo").select("*").order("fecha", { ascending: false }).limit(30),
    ]);
    setRanchos(r.data || []);
    if (r.data?.length) setEmpresaId(r.data[0].empresa_id);
    setProductos(p.data || []);
    setRecetas(rec.data || []);
    setRecetaDet(rd.data || []);
    setAplicaciones(f.data || []);
    setAplicacionDet(fd.data || []);
    setMediciones(m.data || []);
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

  // ================= RECOMENDACIONES =================
  function usarReceta(recetaId) {
    if (!recetaId) { setNueva(n => ({ ...n, receta_id: "" })); return; }
    const rec = recetas.find(x => x.id === recetaId);
    const det = recetaDet.filter(d => d.receta_id === recetaId);
    setNueva(n => ({ ...n, receta_id: recetaId, via: rec.tipo_aplicacion }));
    setLineas(det.map(d => ({ producto_id: d.producto_id, cantidad: String(d.cantidad_por_sector) })));
  }

  function cambiarLinea(setter, arr, i, campo, valor) {
    const nuevas = [...arr];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    setter(nuevas);
  }

  async function guardarRecomendacion() {
    if (!nueva.rancho_id || !nueva.sector) return setError("Selecciona rancho y sector.");
    const validas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return setError("Agrega al menos un producto con cantidad.");

    const { data: cab, error: e1 } = await supabase.from("fertilizaciones").insert({
      empresa_id: empresaId,
      rancho_id: nueva.rancho_id,
      sector: nueva.sector,
      tipo_aplicacion: nueva.via,
      receta_id: nueva.receta_id || null,
      fecha_recomendada: nueva.fecha,
      recomendada_por: usuarioActual.id,
      notas: nueva.notas || null,
    }).select("id").single();
    if (e1) return setError(e1.message);

    for (const l of validas) {
      const { error: e2 } = await supabase.from("fertilizacion_detalle").insert({
        fertilizacion_id: cab.id,
        producto_id: l.producto_id,
        cantidad_recomendada: Number(l.cantidad),
      });
      if (e2) return setError(`${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("Recomendación creada. El encargado la verá como pendiente.");
    setCreando(false);
    setNueva({ rancho_id: "", sector: "", via: "fertirriego", receta_id: "", fecha: todayISO(), notas: "" });
    setLineas([{ producto_id: "", cantidad: "" }]);
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
    setNuevaReceta({ nombre: "", cultivo: "", etapa: "", via: "fertirriego" });
    setLineasReceta([{ producto_id: "", cantidad: "" }]);
    cargarDatos();
  }

  async function alternarReceta(r) {
    const { error: e } = await supabase.from("recetas")
      .update({ activo: !r.activo }).eq("id", r.id);
    if (e) return setError(e.message);
    cargarDatos();
  }

  // ================= MEDICIONES =================
  async function guardarMedicion() {
    const ranchoMed = esEncargado ? usuarioActual.rancho_id : med.rancho_id;
    if (!ranchoMed || !med.sector) return setError("Selecciona rancho y sector.");
    if (!med.ce && !med.ph) return setError("Captura al menos CE o pH.");
    const { error: e } = await supabase.from("mediciones_campo").insert({
      empresa_id: empresaId,
      rancho_id: ranchoMed,
      sector: med.sector,
      tipo_muestra: med.tipo,
      ce: med.ce ? Number(med.ce) : null,
      ph: med.ph ? Number(med.ph) : null,
      registrado_por: usuarioActual.id,
      notas: med.notas || null,
    });
    if (e) return setError(e.message);
    avisar("Medición registrada.");
    setMed({ rancho_id: "", sector: "", tipo: "suelo", ce: "", ph: "", notas: "" });
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
    .filter(f => filtroEstado === "todas" || f.estado === filtroEstado);

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
            <div style={S.version}>v0.3.13</div>
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
            { key: "mediciones", label: "🌡️ CE / pH" },
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

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>RANCHO</label>
                    <select style={S.select} value={nueva.rancho_id}
                      onChange={e => setNueva({ ...nueva, rancho_id: e.target.value })}>
                      <option value="">— Selecciona —</option>
                      {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>SECTOR</label>
                    <input style={S.select} placeholder="ej. 5" value={nueva.sector}
                      onChange={e => setNueva({ ...nueva, sector: e.target.value })} />
                  </div>
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

                <div style={S.formGroup}>
                  <label style={S.label}>PARTIR DE UNA RECETA (OPCIONAL)</label>
                  <select style={S.select} value={nueva.receta_id} onChange={e => usarReceta(e.target.value)}>
                    <option value="">— Captura libre —</option>
                    {recetas.filter(r => r.activo && r.tipo_aplicacion === nueva.via)
                      .map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>

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

                <div style={{ ...S.formGroup, marginTop: 16 }}>
                  <label style={S.label}>NOTAS</label>
                  <input style={S.select} value={nueva.notas}
                    onChange={e => setNueva({ ...nueva, notas: e.target.value })} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btnPrimary, marginBottom: 0, flex: 1 }} onClick={guardarRecomendacion}>
                    Guardar recomendación
                  </button>
                  <button style={S.btnSecundario} onClick={() => setCreando(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Filtro por estado */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
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

                <div style={S.formGroup}>
                  <label style={S.label}>VÍA DE APLICACIÓN</label>
                  <select style={S.select} value={nuevaReceta.via}
                    onChange={e => { setNuevaReceta({ ...nuevaReceta, via: e.target.value }); setLineasReceta([{ producto_id: "", cantidad: "" }]); }}>
                    {VIAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>

                <label style={S.label}>PRODUCTOS Y DOSIS POR SECTOR</label>
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

            {recetas.map(r => {
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
                      <b style={{ color: "#e8f5e0" }}>{Number(d.cantidad_por_sector)} {unidadProducto(d.producto_id)}/sector</b>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#7fbf5a", fontWeight: 700 }}>
                      Costo estimado/sector: ${costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                    {puedeRecomendar && (
                      <button style={{ ...S.btnSecundario, padding: "4px 10px", fontSize: 11 }}
                        onClick={() => alternarReceta(r)}>
                        {r.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {recetas.length === 0 && <div style={S.empty}>Aún no hay recetas registradas.</div>}
          </div>
        )}

        {/* ============ MEDICIONES CE / pH ============ */}
        {pestana === "mediciones" && (
          <div>
            <div style={S.card}>
              <div style={S.seccionTitulo}>Registrar medición</div>

              <div style={S.formRow}>
                {!esEncargado && (
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>RANCHO</label>
                    <select style={S.select} value={med.rancho_id}
                      onChange={e => setMed({ ...med, rancho_id: e.target.value })}>
                      <option value="">— Selecciona —</option>
                      {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ ...S.formGroup, flex: 1 }}>
                  <label style={S.label}>SECTOR</label>
                  <input style={S.select} placeholder="ej. 5" value={med.sector}
                    onChange={e => setMed({ ...med, sector: e.target.value })} />
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
                      {m.ph != null && <span>pH: {Number(m.ph)}</span>}
                    </div>
                  </div>
                ))}
              {mediciones.length === 0 && <div style={S.empty}>Sin mediciones registradas.</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

