// ============ JR AGROCONTROL — Almacen.jsx v0.3.13 ============
// Módulo Almacén: existencias, entradas/ajustes, traspasos con confirmación
// de recepción y catálogo completo de productos e insumos.
// Patrón visual y de sesión tomado de Labores.jsx v0.2.5.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";

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

  // ---- Vistas ----
  const [pestana, setPestana] = useState("existencias");

  // ---- Formularios ----
  const [mov, setMov] = useState({ tipo: "entrada_compra", bodega_id: "", producto_id: "", cantidad: "", costo: "", notas: "" });
  const [tras, setTras] = useState({ origen: "", destino: "", notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);
  const [confirmando, setConfirmando] = useState(null);
  const [recibidas, setRecibidas] = useState({});

  // ---- Catálogo de productos ----
  const [buscar, setBuscar]         = useState("");
  const [filtroCat, setFiltroCat]   = useState("todas");
  const [verInactivos, setVerInactivos] = useState(false);
  const [editandoProd, setEditandoProd] = useState(null);   // null | "nuevo" | id
  const [formProd, setFormProd]     = useState(FORM_PRODUCTO_INICIAL);

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
    const [b, p, ex, t, d] = await Promise.all([
      supabase.from("bodegas").select("id, nombre, rancho_id, empresa_id").eq("activo", true).order("nombre"),
      supabase.from("productos_insumos").select("*").order("nombre_comercial"),
      supabase.from("inventario_existencias").select("*"),
      supabase.from("traspasos").select("*").order("fecha_envio", { ascending: false }).limit(50),
      supabase.from("traspaso_detalle").select("*"),
    ]);
    setBodegas(b.data || []);
    if (b.data?.length) setEmpresaId(b.data[0].empresa_id);
    setProductos(p.data || []);
    setExistencias(ex.data || []);
    setTraspasos(t.data || []);
    setDetalles(d.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { if (usuarioActual) cargarDatos(); }, [usuarioActual, cargarDatos]);

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
    cargarDatos();
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
    cargarDatos();
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
    cargarDatos();
  }

  async function cancelarTraspaso(t) {
    if (!window.confirm("¿Cancelar este traspaso? El producto regresará a la bodega origen.")) return;
    const { error: e } = await supabase.from("traspasos")
      .update({ estado: "cancelado" }).eq("id", t.id);
    if (e) return setError(e.message);
    avisar("Traspaso cancelado y producto devuelto al origen.");
    cargarDatos();
  }

  function puedeConfirmar(t) {
    if (esAdmin) return true;
    if (esEncargado && bodegaEncargado && t.bodega_destino_id === bodegaEncargado.id) return true;
    return false;
  }

  // ================= CATÁLOGO DE PRODUCTOS =================
  function abrirNuevoProducto() {
    setFormProd(FORM_PRODUCTO_INICIAL);
    setEditandoProd("nuevo");
  }

  function abrirEditarProducto(p) {
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
    cargarDatos();
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
    cargarDatos();
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
  ];

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
              <select style={S.select} value={mov.bodega_id} onChange={e => setMov({ ...mov, bodega_id: e.target.value })}>
                <option value="">— Selecciona —</option>
                {bodegas.filter(b => !esEncargado || b.id === bodegaEncargado?.id)
                  .map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>PRODUCTO</label>
              <select style={S.select} value={mov.producto_id} onChange={e => setMov({ ...mov, producto_id: e.target.value })}>
                <option value="">— Selecciona —</option>
                {productosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
              </select>
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
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select style={{ ...S.select, flex: 2 }} value={l.producto_id}
                      onChange={e => cambiarLinea(i, "producto_id", e.target.value)}>
                      <option value="">— Producto —</option>
                      {productosActivos.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    </select>
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

            {/* Formulario de alta / edición */}
            {editandoProd !== null && (
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

      </div>
    </div>
  );
}

