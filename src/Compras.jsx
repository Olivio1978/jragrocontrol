// ============ JR AGROCONTROL — Compras.jsx v0.9.0 ============
// Módulo de Compras: una compra = un evento (cabecera + líneas), en vez de
// entradas sueltas por producto. Reemplaza a la opción "🛒 Compra" que
// existía en Almacén (retirada en Almacén v0.3.30).
//
// v0.9.0 — Primera versión.
//   • Alta "Desde XML": lee el CFDI 4.0 (Comprobante/Emisor/Receptor/
//     Conceptos/Impuestos + TimbreFiscalDigital), da de alta el proveedor
//     solo si su RFC no existe todavía, y resuelve cada línea contra
//     producto_equivalencias (por NoIdentificacion o por descripción
//     normalizada). Las líneas sin coincidencia se resuelven a mano con un
//     buscador que también muestra productos inactivos, para reactivarlos
//     en vez de duplicarlos.
//   • Alta "Captura manual": mismo formulario de líneas, sin XML — para
//     remisiones o compras sin comprobante fiscal.
//   • El costo de cada línea SIEMPRE se calcula sobre lo que cobra el
//     proveedor por presentación (bulto, saco, tambo) convertido a la
//     unidad base del inventario (kg/L/pieza) — nunca sobre la unidad que
//     declare el XML, que puede venir mal capturada por el proveedor
//     (ver ejemplo real: "1 KILOGRAMO" cuando en realidad es "1 bulto
//     de 25 kg"). El campo "Contenido por presentación" siempre es
//     editable y obligatorio antes de guardar.
//   • El PDF y el XML se suben al bucket privado "comprobantes" ANTES de
//     llamar a fn_registrar_compra(), usando un id generado en el
//     navegador (comprobantes/<empresa_id>/<compra_id>.pdf|.xml), y ese
//     mismo id se manda a la función para que la compra quede con ese id
//     exacto (fn_registrar_compra v2, Paso 6F).
//   • Historial: lista de compras con su detalle y botón de cancelar
//     (fn_cancelar_compra), que revierte el inventario línea por línea y
//     se bloquea sola si ya no hay existencia suficiente.
//   • Solo visible para admin/superadmin (RLS de compras/compra_detalle
//     no tiene política de escritura directa: todo pasa por las
//     funciones SECURITY DEFINER).
//
// Patrón visual y de sesión tomado de Almacen.jsx v0.3.29.
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabaseClient";

// ---- Trae TODAS las filas de una consulta, sin importar el tope de fila
// que use el proyecto de Supabase del lado del servidor (ver Almacén v0.3.27).
async function fetchTodasLasFilas(queryFactory, tamanoLote = 1000) {
  let todas = [];
  let desde = 0;
  while (true) {
    const { data, error } = await queryFactory().range(desde, desde + tamanoLote - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    todas = todas.concat(data);
    if (data.length < tamanoLote) break;
    desde += tamanoLote;
  }
  return { data: todas, error: null };
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

// UUID para el id de la compra, generado en el navegador (ver v0.9.0 arriba).
// crypto.randomUUID existe en todos los navegadores modernos; el fallback
// cubre webviews viejos que aún no lo implementan.
function generarUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  (crypto.getRandomValues ? crypto : { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) }).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function normalizarTexto(txt) {
  return (txt || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ============ CONSTANTES ============
const CATEGORIAS = [
  { value: "nutricional", label: "Nutricional" },
  { value: "fitosanitario", label: "Fitosanitario" },
  { value: "bioestimulante", label: "Bioestimulante" },
  { value: "coadyuvante", label: "Coadyuvante" },
];

const TIPOS_DOCUMENTO = [
  { value: "factura", label: "Factura (CFDI)" },
  { value: "remision", label: "Remisión" },
  { value: "sin_comprobante", label: "Sin comprobante" },
];

const ROLES_TXT = {
  admin: "Administrador", encargado: "Encargado",
  agronomo: "Agrónomo", agronomo_externo: "Agrónomo externo", superadmin: "Superadmin",
};

const LINEA_VACIA = {
  producto_id: "", descripcion_factura: "", no_identificacion: "", clave_prod_serv: "",
  clave_unidad_sat: "", unidad_factura: "", cantidad_facturada: "1", precio_unitario: "",
  importe: "", descuento: "0", tasa_iva: "", iva_importe: "0",
  contenido_por_unidad: "1", lote: "", fecha_caducidad: "",
  equivalencia_id: null, _origen: "manual",
};

const CABECERA_VACIA = {
  id: null, proveedor_id: "", proveedor_nuevo: null, bodega_destino_id: "",
  tipo_documento: "factura",
  uuid_cfdi: "", version_cfdi: "", serie: "", folio: "", fecha_emision: "", fecha_timbrado: "",
  rfc_emisor: "", nombre_emisor: "", regimen_fiscal_emisor: "",
  rfc_receptor: "", nombre_receptor: "",
  uso_cfdi: "", lugar_expedicion: "", forma_pago: "", metodo_pago: "", condiciones_pago: "",
  moneda: "MXN", tipo_cambio: "1",
  subtotal: "", descuento: "0", impuestos_trasladados: "0", impuestos_retenidos: "0", total: "",
  fecha_recepcion: todayISO(), fecha_vencimiento: "", referencia_proveedor: "", notas: "",
};

// ============ ESTILOS (idénticos a Almacen.jsx, mismo lenguaje visual) ============
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
  warnBanner: { background: "rgba(232,162,61,0.12)", border: "1px solid rgba(232,162,61,0.3)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "12px", color: "#e8a23d" },
  btnCerrarError: { background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px" },
  navTabs: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
  navTab: { flex: "1 1 120px", border: "1.5px solid", borderRadius: "10px", padding: "10px 8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: "transparent", fontFamily: "inherit" },
  subTab: { border: "1.5px solid", borderRadius: "999px", padding: "6px 14px", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: "transparent", fontFamily: "inherit" },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" },
  selectSm: { background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "8px", padding: "7px 8px", color: "#e8f5e0", fontSize: "12px", boxSizing: "border-box", fontFamily: "inherit" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer", marginBottom: "16px", boxShadow: "0 4px 24px rgba(90,171,46,0.3)", fontFamily: "inherit" },
  btnSecundario: { background: "rgba(127,191,90,0.12)", border: "1.5px solid rgba(127,191,90,0.3)", borderRadius: "10px", padding: "8px 16px", color: "#7fbf5a", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" },
  btnPeligro: { background: "rgba(224,92,92,0.12)", border: "1.5px solid rgba(224,92,92,0.35)", borderRadius: "10px", padding: "8px 16px", color: "#e05c5c", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" },
  formGroup: { marginBottom: "16px" },
  formRow: { display: "flex", gap: "12px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" },
  cardRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "rgba(200,230,180,0.8)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  seccionTitulo: { fontSize: "14px", fontWeight: "700", color: "#ffffff", marginBottom: "10px" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  miniTag: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" },
  dropdownBusqueda: { position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", marginTop: "4px", maxHeight: "260px", overflowY: "auto", background: "#0f2818", border: "1px solid rgba(127,191,90,0.35)", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  dropdownItem: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" },
  lineaCard: { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", marginBottom: "10px", position: "relative" },
  lineaCampo: { fontSize: "10px", letterSpacing: "0.06em", color: "rgba(200,230,180,0.5)", marginBottom: "3px", fontWeight: "600" },
  fileBtn: { display: "inline-block", background: "rgba(127,191,90,0.12)", border: "1.5px dashed rgba(127,191,90,0.4)", borderRadius: "10px", padding: "14px", textAlign: "center", color: "#7fbf5a", fontSize: "12px", fontWeight: "600", cursor: "pointer", width: "100%", boxSizing: "border-box" },
};

// ============ PANTALLA DE LOGIN ============
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
        <div style={S.eyebrow}>JR AGROCONTROL · COMPRAS</div>
        <h1 style={S.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={S.formGroup}>
            <label style={S.label}>CORREO</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={S.select} required />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>CONTRASEÑA</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={S.select} required />
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

// ============ LECTOR DE CFDI 4.0 ============
// Busca elementos por su nombre local, sin importar el prefijo de espacio de
// nombres que use el sistema de facturación del proveedor (cfdi:, o ninguno).
function elementosPorNombre(doc, nombreLocal) {
  return Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === nombreLocal);
}
function elementoPorNombre(doc, nombreLocal) {
  return elementosPorNombre(doc, nombreLocal)[0] || null;
}
function attr(el, nombre) {
  return el ? el.getAttribute(nombre) || "" : "";
}
function attrNum(el, nombre, porDefecto = 0) {
  const v = attr(el, nombre);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : porDefecto;
}

// Devuelve { cabecera, lineas } o lanza un Error con un mensaje entendible.
function leerCFDI(xmlTexto) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlTexto, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El archivo no es un XML válido.");
  }
  const comprobante = elementoPorNombre(doc, "Comprobante");
  if (!comprobante) throw new Error("El archivo no parece ser un CFDI (no se encontró el nodo Comprobante).");

  const emisor = elementoPorNombre(doc, "Emisor");
  const receptor = elementoPorNombre(doc, "Receptor");
  const timbre = elementoPorNombre(doc, "TimbreFiscalDigital");
  const conceptos = elementosPorNombre(doc, "Concepto");

  if (conceptos.length === 0) throw new Error("El CFDI no trae productos (Conceptos).");

  const cabecera = {
    version_cfdi: attr(comprobante, "Version"),
    serie: attr(comprobante, "Serie"),
    folio: attr(comprobante, "Folio"),
    fecha_emision: attr(comprobante, "Fecha").replace("T", " "),
    fecha_timbrado: attr(timbre, "FechaTimbrado").replace("T", " "),
    uuid_cfdi: attr(timbre, "UUID"),
    rfc_emisor: attr(emisor, "Rfc").toUpperCase(),
    nombre_emisor: attr(emisor, "Nombre"),
    regimen_fiscal_emisor: attr(emisor, "RegimenFiscal"),
    rfc_receptor: attr(receptor, "Rfc").toUpperCase(),
    nombre_receptor: attr(receptor, "Nombre"),
    uso_cfdi: attr(receptor, "UsoCFDI"),
    lugar_expedicion: attr(comprobante, "LugarExpedicion"),
    forma_pago: attr(comprobante, "FormaPago"),
    metodo_pago: attr(comprobante, "MetodoPago"),
    condiciones_pago: attr(comprobante, "CondicionesDePago"),
    moneda: attr(comprobante, "Moneda") || "MXN",
    tipo_cambio: attr(comprobante, "TipoCambio") || "1",
    subtotal: attr(comprobante, "SubTotal"),
    descuento: attr(comprobante, "Descuento") || "0",
    total: attr(comprobante, "Total"),
  };

  // Impuestos trasladados totales: si el nodo cfdi:Impuestos de la cabecera
  // no trae TotalImpuestosTrasladados (común cuando todo va exento a 0%),
  // se suma lo que traiga cada concepto.
  const impuestosNodo = elementoPorNombre(doc, "Impuestos");
  let ivaCabecera = attr(impuestosNodo, "TotalImpuestosTrasladados");

  const lineas = conceptos.map((c) => {
    const traslados = elementosPorNombre(c, "Traslado").filter((t) => attr(t, "Impuesto") === "002");
    const traslado = traslados[0] || null;
    const tasaIva = traslado && attr(traslado, "TipoFactor") !== "Exento" ? attr(traslado, "TasaOCuota") : "";
    const ivaImporte = traslado ? attr(traslado, "Importe") : "0";

    return {
      ...LINEA_VACIA,
      descripcion_factura: attr(c, "Descripcion"),
      no_identificacion: attr(c, "NoIdentificacion"),
      clave_prod_serv: attr(c, "ClaveProdServ"),
      clave_unidad_sat: attr(c, "ClaveUnidad"),
      unidad_factura: attr(c, "Unidad"),
      cantidad_facturada: attr(c, "Cantidad") || "1",
      precio_unitario: attr(c, "ValorUnitario"),
      importe: attr(c, "Importe"),
      descuento: attr(c, "Descuento") || "0",
      tasa_iva: tasaIva,
      iva_importe: ivaImporte,
      _origen: "xml",
    };
  });

  if (!ivaCabecera) {
    ivaCabecera = lineas.reduce((acc, l) => acc + (parseFloat(l.iva_importe) || 0), 0).toFixed(2);
  }
  cabecera.impuestos_trasladados = ivaCabecera;
  cabecera.impuestos_retenidos = attr(impuestosNodo, "TotalImpuestosRetenidos") || "0";

  return { cabecera, lineas };
}

// ============ COMPONENTE PRINCIPAL ============
export default function Compras({ onNavigate }) {
  // ---- Sesión ----
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [cargando, setCargando] = useState(true);

  // ---- Datos ----
  const [empresaId, setEmpresaId] = useState(null);
  const [empresaRfc, setEmpresaRfc] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [equivalencias, setEquivalencias] = useState([]);
  const [comprasHist, setComprasHist] = useState([]);
  const [detallePorCompra, setDetallePorCompra] = useState({}); // { [compra_id]: [líneas] }
  const [expandida, setExpandida] = useState(null);

  // ---- Vistas ----
  const [pestana, setPestana] = useState("nueva");
  const [modoCaptura, setModoCaptura] = useState("xml"); // "xml" | "manual"

  // ---- Formulario ----
  const [cab, setCab] = useState(CABECERA_VACIA);
  const [lineas, setLineas] = useState([]);
  const [archivoPdf, setArchivoPdf] = useState(null);
  const [archivoXml, setArchivoXml] = useState(null);
  const [nombreArchivoXml, setNombreArchivoXml] = useState("");
  const [proveedorNoEncontrado, setProveedorNoEncontrado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // ---- Buscador de producto por línea ----
  const [buscarProductoLinea, setBuscarProductoLinea] = useState({});
  const [mostrarBuscadorLinea, setMostrarBuscadorLinea] = useState(null);

  // ---- Cancelación ----
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  // ---- Alta de proveedor en captura manual (cuando el XML no lo trajo) ----
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [nuevoProveedorForm, setNuevoProveedorForm] = useState({ razon_social: "", rfc: "", regimen_fiscal: "" });

  const inputXmlRef = useRef(null);

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setUsuarioActual(null);
    setError(null);
  }, [sesion?.user?.id]);

  // ---- 2. Perfil ----
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
    const [b, p, prov, eq, comp] = await Promise.all([
      supabase.from("bodegas").select("id, nombre, rancho_id, empresa_id").eq("activo", true).order("nombre"),
      fetchTodasLasFilas(() => supabase.from("productos_insumos")
        .select("id, nombre_comercial, marca, categoria, unidad_base, contenido_presentacion, costo_unitario, activo, registro_sanitario")
        .order("nombre_comercial")),
      supabase.from("proveedores").select("*").order("razon_social"),
      fetchTodasLasFilas(() => supabase.from("producto_equivalencias").select("*")),
      supabase.from("compras").select("*").order("creado_en", { ascending: false }).limit(100),
    ]);
    setBodegas(b.data || []);
    if (b.data?.length) {
      setEmpresaId(b.data[0].empresa_id);
      const { data: emp } = await supabase.from("empresas").select("rfc").eq("id", b.data[0].empresa_id).single();
      setEmpresaRfc(emp?.rfc || null);
    }
    setProductos(p.data || []);
    setProveedores(prov.data || []);
    setEquivalencias(eq.data || []);
    setComprasHist(comp.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { if (usuarioActual) cargarDatos(); }, [usuarioActual, cargarDatos]);

  function avisar(texto) { setAviso(texto); setTimeout(() => setAviso(null), 6000); }

  const esAdmin = usuarioActual?.rol === "admin" || usuarioActual?.rol === "superadmin";
  const bodegaCentral = bodegas.find((b) => !b.rancho_id);
  const productosActivos = productos; // se muestran también inactivos en el buscador, marcados aparte

  function nombreProducto(id) {
    const p = productos.find((x) => x.id === id);
    return p ? `${p.nombre_comercial}${p.marca ? " · " + p.marca : ""}` : "";
  }
  function productoDe(id) { return productos.find((x) => x.id === id) || null; }

  function productosParaBuscador(texto) {
    const q = normalizarTexto(texto);
    if (!q) return [];
    return productosActivos
      .filter((p) => normalizarTexto(p.nombre_comercial).includes(q) || normalizarTexto(p.marca).includes(q))
      .slice(0, 40);
  }

  // ================= NUEVA COMPRA — reset =================
  function reiniciarFormulario() {
    setCab({ ...CABECERA_VACIA, bodega_destino_id: bodegaCentral?.id || "" });
    setLineas([]);
    setArchivoPdf(null);
    setArchivoXml(null);
    setNombreArchivoXml("");
    setProveedorNoEncontrado(false);
    setMostrarNuevoProveedor(false);
    setNuevoProveedorForm({ razon_social: "", rfc: "", regimen_fiscal: "" });
  }

  const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
  function confirmarNuevoProveedor() {
    const razon = nuevoProveedorForm.razon_social.trim();
    if (!razon) { setError("Captura la razón social del proveedor."); return; }
    const rfc = nuevoProveedorForm.rfc.trim().toUpperCase();
    if (rfc && !RFC_REGEX.test(rfc)) { setError("El RFC no tiene un formato válido (déjalo vacío si no lo tienes a la mano)."); return; }
    setCab((c) => ({ ...c, proveedor_id: "", proveedor_nuevo: { razon_social: razon, rfc: rfc || null, regimen_fiscal: nuevoProveedorForm.regimen_fiscal.trim() || null } }));
    setMostrarNuevoProveedor(false);
    setError(null);
  }
  useEffect(() => { if (bodegaCentral && !cab.bodega_destino_id) setCab((c) => ({ ...c, bodega_destino_id: bodegaCentral.id })); }, [bodegaCentral]); // eslint-disable-line

  // ================= LECTURA DE XML =================
  async function manejarArchivoXml(file) {
    if (!file) return;
    setArchivoXml(file);
    setNombreArchivoXml(file.name);
    try {
      const texto = await file.text();
      const { cabecera, lineas: lineasXml } = leerCFDI(texto);

      const proveedorExistente = proveedores.find((p) => p.rfc === cabecera.rfc_emisor);
      setProveedorNoEncontrado(!proveedorExistente);

      const proveedorId = proveedorExistente?.id || null;
      const lineasResueltas = lineasXml.map((l) => {
        const norm = normalizarTexto(l.descripcion_factura);
        const eq = proveedorId
          ? equivalencias.find((e) =>
              e.proveedor_id === proveedorId &&
              ((l.no_identificacion && e.no_identificacion === l.no_identificacion) ||
               (!l.no_identificacion && e.descripcion_norm === norm)))
          : null;
        if (eq) {
          const prod = productoDe(eq.producto_id);
          return { ...l, producto_id: eq.producto_id, contenido_por_unidad: String(eq.contenido_por_unidad), equivalencia_id: eq.id, lote: "", fecha_caducidad: prod?.categoria === "fitosanitario" ? l.lote : "" };
        }
        return l;
      });

      setCab((c) => ({
        ...c,
        ...cabecera,
        proveedor_id: proveedorId || "",
        proveedor_nuevo: proveedorExistente ? null : { razon_social: cabecera.nombre_emisor, rfc: cabecera.rfc_emisor, regimen_fiscal: cabecera.regimen_fiscal_emisor },
        tipo_documento: "factura",
        referencia_proveedor: c.referencia_proveedor,
        bodega_destino_id: c.bodega_destino_id || bodegaCentral?.id || "",
      }));
      setLineas(lineasResueltas);
      setError(null);
    } catch (e) {
      setError("No se pudo leer el XML: " + e.message);
    }
  }

  // ================= LÍNEAS (captura manual) =================
  function agregarLineaManual() {
    setLineas((ls) => [...ls, { ...LINEA_VACIA }]);
  }
  function quitarLinea(i) {
    setLineas((ls) => ls.filter((_, idx) => idx !== i));
  }
  function cambiarLinea(i, campo, valor) {
    setLineas((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const nueva = { ...l, [campo]: valor };
      // Si cambia cantidad o precio, recalcula importe automáticamente
      // (el usuario aún puede ajustarlo a mano si la factura trae otro).
      if (campo === "cantidad_facturada" || campo === "precio_unitario") {
        const cant = parseFloat(campo === "cantidad_facturada" ? valor : nueva.cantidad_facturada) || 0;
        const precio = parseFloat(campo === "precio_unitario" ? valor : nueva.precio_unitario) || 0;
        nueva.importe = (cant * precio).toFixed(2);
      }
      return nueva;
    }));
  }
  function elegirProductoLinea(i, producto) {
    setLineas((ls) => ls.map((l, idx) => idx === i
      ? { ...l, producto_id: producto.id, contenido_por_unidad: producto.contenido_presentacion ? String(producto.contenido_presentacion) : l.contenido_por_unidad, equivalencia_id: null }
      : l));
    setMostrarBuscadorLinea(null);
  }

  // ================= CUADRE (validación en vivo, espejo de la función SQL) =================
  const sumaImportes = lineas.reduce((a, l) => a + (parseFloat(l.importe) || 0), 0);
  const sumaDescuentos = lineas.reduce((a, l) => a + (parseFloat(l.descuento) || 0), 0);
  const sumaIva = lineas.reduce((a, l) => a + (parseFloat(l.iva_importe) || 0), 0);
  const tolerancia = Math.max(0.02 * lineas.length, 0.02);
  const cuadraSubtotal = Math.abs(sumaImportes - (parseFloat(cab.subtotal) || 0)) <= tolerancia;
  const cuadraDescuento = Math.abs(sumaDescuentos - (parseFloat(cab.descuento) || 0)) <= tolerancia;
  const cuadraIva = Math.abs(sumaIva - (parseFloat(cab.impuestos_trasladados) || 0)) <= tolerancia;

  const lineasIncompletas = lineas.filter((l) =>
    !l.producto_id || !(parseFloat(l.contenido_por_unidad) > 0) || !(parseFloat(l.cantidad_facturada) > 0));
  const lineasFitoSinLote = lineas.filter((l) => {
    const p = productoDe(l.producto_id);
    return p?.categoria === "fitosanitario" && !l.lote.trim();
  });
  const lineasSinRsco = lineas.filter((l) => {
    const p = productoDe(l.producto_id);
    return p?.categoria === "fitosanitario" && !p.registro_sanitario;
  });

  const puedeGuardar = lineas.length > 0
    && cab.bodega_destino_id
    && (cab.proveedor_id || cab.proveedor_nuevo?.razon_social)
    && lineasIncompletas.length === 0
    && lineasFitoSinLote.length === 0
    && (cab.tipo_documento !== "factura" || (cuadraSubtotal && cuadraDescuento && cuadraIva && cab.uuid_cfdi && cab.fecha_emision));

  // ================= GUARDAR =================
  async function registrarCompra() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    setError(null);

    const compraId = generarUUID();
    let proveedorId = cab.proveedor_id;
    let rutaPdf = null, rutaXml = null;

    try {
      // 1) Alta del proveedor, si vino de un XML de un RFC nuevo
      if (!proveedorId && cab.proveedor_nuevo) {
        const { data: nuevoProv, error: eProv } = await supabase.from("proveedores")
          .insert({
            empresa_id: empresaId,
            rfc: cab.proveedor_nuevo.rfc || null,
            razon_social: cab.proveedor_nuevo.razon_social,
            regimen_fiscal: cab.proveedor_nuevo.regimen_fiscal || null,
          })
          .select().single();
        if (eProv) throw new Error("No se pudo dar de alta al proveedor: " + eProv.message);
        proveedorId = nuevoProv.id;
      }

      // 2) Subir PDF/XML al bucket, con el id que ya generamos para la compra
      if (archivoPdf) {
        rutaPdf = `${empresaId}/${compraId}.pdf`;
        const { error: eUp } = await supabase.storage.from("comprobantes").upload(rutaPdf, archivoPdf, { contentType: "application/pdf" });
        if (eUp) throw new Error("No se pudo subir el PDF: " + eUp.message);
      }
      if (archivoXml) {
        rutaXml = `${empresaId}/${compraId}.xml`;
        const { error: eUp } = await supabase.storage.from("comprobantes").upload(rutaXml, archivoXml, { contentType: "text/xml" });
        if (eUp) throw new Error("No se pudo subir el XML: " + eUp.message);
      }

      // 3) Registrar la compra (valida y mueve inventario en una sola transacción)
      const p_cabecera = {
        id: compraId,
        proveedor_id: proveedorId,
        bodega_destino_id: cab.bodega_destino_id,
        tipo_documento: cab.tipo_documento,
        uuid_cfdi: cab.uuid_cfdi || null,
        version_cfdi: cab.version_cfdi || null,
        serie: cab.serie || null,
        folio: cab.folio || null,
        fecha_emision: cab.fecha_emision || null,
        fecha_timbrado: cab.fecha_timbrado || null,
        rfc_emisor: cab.rfc_emisor || null,
        nombre_emisor: cab.nombre_emisor || null,
        regimen_fiscal_emisor: cab.regimen_fiscal_emisor || null,
        rfc_receptor: cab.rfc_receptor || null,
        nombre_receptor: cab.nombre_receptor || null,
        uso_cfdi: cab.uso_cfdi || null,
        lugar_expedicion: cab.lugar_expedicion || null,
        forma_pago: cab.forma_pago || null,
        metodo_pago: cab.metodo_pago || null,
        condiciones_pago: cab.condiciones_pago || null,
        moneda: cab.moneda || "MXN",
        tipo_cambio: cab.tipo_cambio || "1",
        subtotal: cab.subtotal || String(sumaImportes.toFixed(2)),
        descuento: cab.descuento || "0",
        impuestos_trasladados: cab.impuestos_trasladados || "0",
        impuestos_retenidos: cab.impuestos_retenidos || "0",
        total: cab.total || String((sumaImportes - sumaDescuentos + sumaIva).toFixed(2)),
        fecha_recepcion: cab.fecha_recepcion || todayISO(),
        fecha_vencimiento: cab.fecha_vencimiento || null,
        referencia_proveedor: cab.referencia_proveedor || null,
        archivo_pdf: rutaPdf,
        archivo_xml: rutaXml,
        notas: cab.notas || null,
      };
      const p_lineas = lineas.map((l) => ({
        producto_id: l.producto_id,
        descripcion_factura: l.descripcion_factura || nombreProducto(l.producto_id),
        no_identificacion: l.no_identificacion || null,
        clave_prod_serv: l.clave_prod_serv || null,
        clave_unidad_sat: l.clave_unidad_sat || null,
        unidad_factura: l.unidad_factura || null,
        cantidad_facturada: parseFloat(l.cantidad_facturada) || 0,
        precio_unitario: parseFloat(l.precio_unitario) || 0,
        importe: parseFloat(l.importe) || 0,
        descuento: parseFloat(l.descuento) || 0,
        tasa_iva: l.tasa_iva === "" ? null : parseFloat(l.tasa_iva),
        iva_importe: parseFloat(l.iva_importe) || 0,
        contenido_por_unidad: parseFloat(l.contenido_por_unidad) || 0,
        lote: l.lote || null,
        fecha_caducidad: l.fecha_caducidad || null,
        equivalencia_id: l.equivalencia_id || null,
      }));

      const { data: nuevaCompraId, error: eRpc } = await supabase.rpc("fn_registrar_compra", { p_cabecera, p_lineas });
      if (eRpc) throw new Error(eRpc.message);

      // A partir de aquí la compra YA quedó registrada (con sus archivos
      // correctamente ligados). Un error en estos pasos posteriores NUNCA
      // debe borrar rutaPdf/rutaXml ni mostrarse como si la compra hubiera
      // fallado — por eso van en su propio try/catch, separado del de arriba.
      try {
        // 4) Aprender las líneas que se resolvieron a mano (sin equivalencia
        //    previa), para que la próxima factura de este proveedor las
        //    reconozca sola. Best-effort: si ya existe una igual, el índice
        //    único la rechaza sin romper el flujo (el insert solo regresa
        //    error, no lanza excepción).
        const nuevasEquivalencias = lineas.filter((l) => !l.equivalencia_id && l.producto_id && (l.no_identificacion || l.descripcion_factura));
        for (const l of nuevasEquivalencias) {
          await supabase.from("producto_equivalencias").insert({
            empresa_id: empresaId, proveedor_id: proveedorId, producto_id: l.producto_id,
            no_identificacion: l.no_identificacion || null,
            descripcion_norm: l.no_identificacion ? null : normalizarTexto(l.descripcion_factura),
            contenido_por_unidad: parseFloat(l.contenido_por_unidad) || 1,
            veces_usada: 1, ultima_compra_en: new Date().toISOString(),
          });
        }
        avisar(`Compra registrada correctamente (folio ${cab.folio || cab.referencia_proveedor || nuevaCompraId}).`);
        reiniciarFormulario();
        await cargarDatos();
      } catch {
        // La compra ya se guardó bien; solo avisamos que falta refrescar la pantalla.
        avisar("Compra registrada correctamente. Actualiza la pantalla para ver los datos más recientes.");
      }
    } catch (e) {
      // Esto solo ocurre ANTES de que la compra exista (subida de archivos
      // o la propia función fn_registrar_compra falló): aquí sí es correcto
      // limpiar cualquier archivo que hayamos subido, para no dejar huérfanos.
      if (rutaPdf) await supabase.storage.from("comprobantes").remove([rutaPdf]);
      if (rutaXml) await supabase.storage.from("comprobantes").remove([rutaXml]);
      setError(e.message);
    }
    setGuardando(false);
  }

  // ================= HISTORIAL =================
  async function abrirDetalle(compraId) {
    if (expandida === compraId) { setExpandida(null); return; }
    setExpandida(compraId);
    if (!detallePorCompra[compraId]) {
      const { data, error: e } = await supabase.from("compra_detalle").select("*").eq("compra_id", compraId).order("linea");
      if (e) { setError(e.message); return; }
      setDetallePorCompra((d) => ({ ...d, [compraId]: data || [] }));
    }
  }

  async function confirmarCancelacion(compraId) {
    if (!motivoCancelacion.trim()) { setError("Indica el motivo de la cancelación."); return; }
    const { error: e } = await supabase.rpc("fn_cancelar_compra", { p_compra_id: compraId, p_motivo: motivoCancelacion.trim() });
    if (e) { setError(e.message); return; }
    avisar("Compra cancelada. El inventario ya fue revertido.");
    setCancelandoId(null);
    setMotivoCancelacion("");
    await cargarDatos();
  }

  function nombreProveedor(id) {
    return proveedores.find((p) => p.id === id)?.razon_social || "—";
  }
  function nombreBodegaDe(id) {
    return bodegas.find((b) => b.id === id)?.nombre || "—";
  }

  // ================= RENDER =================
  if (sesion === undefined || (sesion && !usuarioActual && !error)) {
    return <div style={S.page}><div style={S.container}><p style={{ color: "rgba(200,230,180,0.5)", paddingTop: 60 }}>Cargando…</p></div></div>;
  }
  if (!sesion) return <Login />;

  if (usuarioActual && !esAdmin) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.header}>
            <div>
              <div style={S.eyebrow}>JR AGROCONTROL · COMPRAS</div>
              <h1 style={S.title}>Compras</h1>
            </div>
            <button onClick={() => supabase.auth.signOut()} style={S.btnLogout}>Salir</button>
          </div>
          <div style={S.card}>
            <div style={S.empty}>🔒 Este módulo es solo para administradores.</div>
          </div>
          {onNavigate && <button style={S.btnSecundario} onClick={() => onNavigate("almacen")}>← Volver a Almacén</button>}
        </div>
      </div>
    );
  }

  const PESTANAS = [
    { key: "nueva", label: "🧾 Nueva compra" },
    { key: "historial", label: "📚 Historial" },
  ];

  return (
    <div style={S.page}>
      <style>{`select option { background-color: #0f2818; color: #e8f5e0; }`}</style>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · COMPRAS</div>
            <h1 style={S.title}>Compras</h1>
            <div style={S.usuarioTag}>
              {usuarioActual?.nombre_completo} · {ROLES_TXT[usuarioActual?.rol] || usuarioActual?.rol}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>🧾</div>
            <div style={S.version}>v0.9.0</div>
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
          {PESTANAS.map((p) => (
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

        {cargando && <div style={S.empty}>Cargando…</div>}

        {/* ============ NUEVA COMPRA ============ */}
        {!cargando && pestana === "nueva" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button style={{ ...S.subTab, borderColor: modoCaptura === "xml" ? "#7fbf5a" : "rgba(127,191,90,0.2)", color: modoCaptura === "xml" ? "#7fbf5a" : "rgba(200,230,180,0.5)" }}
                onClick={() => setModoCaptura("xml")}>📄 Desde XML</button>
              <button style={{ ...S.subTab, borderColor: modoCaptura === "manual" ? "#7fbf5a" : "rgba(127,191,90,0.2)", color: modoCaptura === "manual" ? "#7fbf5a" : "rgba(200,230,180,0.5)" }}
                onClick={() => { setModoCaptura("manual"); setCab((c) => ({ ...c, tipo_documento: c.tipo_documento === "factura" ? "remision" : c.tipo_documento })); }}>✍️ Captura manual</button>
            </div>

            {modoCaptura === "xml" && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Cargar factura (XML)</div>
                <label style={S.fileBtn}>
                  {nombreArchivoXml ? `📄 ${nombreArchivoXml}` : "Seleccionar XML de la factura"}
                  <input ref={inputXmlRef} type="file" accept=".xml,text/xml" style={{ display: "none" }}
                    onChange={(e) => manejarArchivoXml(e.target.files[0])} />
                </label>
                <div style={{ marginTop: 10 }}>
                  <label style={S.label}>PDF (opcional, para archivo)</label>
                  <label style={S.fileBtn}>
                    {archivoPdf ? `📎 ${archivoPdf.name}` : "Seleccionar PDF"}
                    <input type="file" accept=".pdf,application/pdf" style={{ display: "none" }}
                      onChange={(e) => setArchivoPdf(e.target.files[0])} />
                  </label>
                </div>
              </div>
            )}

            {(lineas.length > 0 || modoCaptura === "manual") && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Datos del documento</div>

                {modoCaptura === "manual" && (
                  <div style={S.formGroup}>
                    <label style={S.label}>TIPO DE DOCUMENTO</label>
                    <select style={S.select} value={cab.tipo_documento} onChange={(e) => setCab({ ...cab, tipo_documento: e.target.value })}>
                      {TIPOS_DOCUMENTO.filter((t) => t.value !== "factura").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                )}

                <div style={S.formGroup}>
                  <label style={S.label}>PROVEEDOR</label>
                  {cab.proveedor_nuevo ? (
                    <div style={{ ...S.select, background: "rgba(127,191,90,0.08)" }}>
                      🆕 {cab.proveedor_nuevo.razon_social}
                      {cab.proveedor_nuevo.rfc && <span style={{ color: "rgba(200,230,180,0.5)" }}> ({cab.proveedor_nuevo.rfc})</span>}
                      <span style={{ color: "rgba(200,230,180,0.5)" }}> — se dará de alta al guardar</span>
                      {" "}
                      <button onClick={() => setCab({ ...cab, proveedor_nuevo: null })} style={{ background: "none", border: "none", color: "#e8a23d", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>cambiar</button>
                    </div>
                  ) : mostrarNuevoProveedor ? (
                    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: 10, padding: 12 }}>
                      <div style={S.formGroup}>
                        <div style={S.lineaCampo}>RAZÓN SOCIAL *</div>
                        <input style={S.select} value={nuevoProveedorForm.razon_social}
                          onChange={(e) => setNuevoProveedorForm({ ...nuevoProveedorForm, razon_social: e.target.value })} />
                      </div>
                      <div style={S.formRow}>
                        <div style={{ flex: 1 }}>
                          <div style={S.lineaCampo}>RFC (opcional, si no traes factura)</div>
                          <input style={S.select} value={nuevoProveedorForm.rfc}
                            onChange={(e) => setNuevoProveedorForm({ ...nuevoProveedorForm, rfc: e.target.value.toUpperCase() })} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button style={S.btnSecundario} onClick={confirmarNuevoProveedor}>Usar este proveedor</button>
                        <button style={S.btnSecundario} onClick={() => setMostrarNuevoProveedor(false)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <select style={S.select} value={cab.proveedor_id} onChange={(e) => setCab({ ...cab, proveedor_id: e.target.value })}>
                        <option value="">— Selecciona —</option>
                        {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}{p.rfc ? ` (${p.rfc})` : ""}</option>)}
                      </select>
                      <button style={{ ...S.btnSecundario, marginTop: 8 }} onClick={() => setMostrarNuevoProveedor(true)}>+ Nuevo proveedor</button>
                    </div>
                  )}
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>BODEGA DESTINO</label>
                  <select style={S.select} value={cab.bodega_destino_id} onChange={(e) => setCab({ ...cab, bodega_destino_id: e.target.value })}>
                    {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}{!b.rancho_id ? " (recomendado)" : ""}</option>)}
                  </select>
                </div>

                <div style={S.formRow}>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>REFERENCIA DEL PROVEEDOR</label>
                    <input style={S.select} value={cab.referencia_proveedor} onChange={(e) => setCab({ ...cab, referencia_proveedor: e.target.value })} placeholder="Ej. SY-68470" />
                  </div>
                  <div style={{ ...S.formGroup, flex: 1 }}>
                    <label style={S.label}>FECHA DE RECEPCIÓN</label>
                    <input type="date" style={S.select} value={cab.fecha_recepcion} onChange={(e) => setCab({ ...cab, fecha_recepcion: e.target.value })} />
                  </div>
                </div>

                {cab.tipo_documento === "factura" && (
                  <>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>SERIE / FOLIO</label>
                        <input style={S.select} value={`${cab.serie || ""}${cab.folio || ""}`} readOnly />
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>FECHA EMISIÓN</label>
                        <input style={S.select} value={cab.fecha_emision} readOnly />
                      </div>
                    </div>
                    <div style={S.formGroup}>
                      <label style={S.label}>RFC RECEPTOR (validado)</label>
                      <div style={{ ...S.select, color: cab.rfc_receptor === empresaRfc ? "#7fbf5a" : "#e05c5c" }}>
                        {cab.rfc_receptor || "—"} {cab.rfc_receptor && (cab.rfc_receptor === empresaRfc ? "✓ coincide" : "✕ no coincide con la empresa")}
                      </div>
                    </div>
                    <div style={S.formRow}>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>SUBTOTAL</label>
                        <div style={{ ...S.select, color: cuadraSubtotal ? "#e8f5e0" : "#e8a23d" }}>${parseFloat(cab.subtotal || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ ...S.formGroup, flex: 1 }}>
                        <label style={S.label}>TOTAL</label>
                        <div style={S.select}>${parseFloat(cab.total || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    {!cuadraSubtotal && lineas.length > 0 && (
                      <div style={S.warnBanner}>⚠️ La suma de las líneas (${sumaImportes.toFixed(2)}) no cuadra con el subtotal de la factura (${parseFloat(cab.subtotal || 0).toFixed(2)}).</div>
                    )}
                  </>
                )}

                <div style={S.formGroup}>
                  <label style={S.label}>NOTAS (opcional)</label>
                  <input style={S.select} value={cab.notas} onChange={(e) => setCab({ ...cab, notas: e.target.value })} />
                </div>
              </div>
            )}

            {(lineas.length > 0 || modoCaptura === "manual") && (
              <div style={S.card}>
                <div style={S.seccionTitulo}>Productos</div>

                {lineas.map((l, i) => {
                  const prod = productoDe(l.producto_id);
                  const esFito = prod?.categoria === "fitosanitario";
                  const costoCalc = (parseFloat(l.cantidad_facturada) > 0 && parseFloat(l.contenido_por_unidad) > 0)
                    ? ((parseFloat(l.importe) - parseFloat(l.descuento || 0)) / (parseFloat(l.cantidad_facturada) * parseFloat(l.contenido_por_unidad)))
                    : null;
                  return (
                    <div key={i} style={S.lineaCard}>
                      <button onClick={() => quitarLinea(i)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#e05c5c", cursor: "pointer", fontSize: 14 }}>✕</button>

                      {l._origen === "xml" && <div style={{ fontSize: 11, color: "rgba(200,230,180,0.45)", marginBottom: 6 }}>Factura: "{l.descripcion_factura}"</div>}

                      <div style={{ position: "relative", marginBottom: 8 }}>
                        <div style={S.lineaCampo}>PRODUCTO EN CATÁLOGO</div>
                        <input style={S.select}
                          placeholder="🔍 Buscar producto…"
                          value={l.producto_id ? nombreProducto(l.producto_id) : (buscarProductoLinea[i] || "")}
                          onFocus={() => { setBuscarProductoLinea({ ...buscarProductoLinea, [i]: "" }); setMostrarBuscadorLinea(i); }}
                          onChange={(e) => { setBuscarProductoLinea({ ...buscarProductoLinea, [i]: e.target.value }); setMostrarBuscadorLinea(i); }} />
                        {mostrarBuscadorLinea === i && (
                          <div style={S.dropdownBusqueda}>
                            {productosParaBuscador(buscarProductoLinea[i]).map((p) => (
                              <div key={p.id} style={S.dropdownItem} onClick={() => elegirProductoLinea(i, p)}>
                                <div style={{ fontWeight: 600, color: p.activo ? "#e8f5e0" : "rgba(200,230,180,0.5)" }}>
                                  {p.nombre_comercial}{!p.activo && " (inactivo — se reactivará)"}
                                </div>
                                <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                                  {CATEGORIAS.find((c) => c.value === p.categoria)?.label}{p.marca && ` · ${p.marca}`}
                                </div>
                              </div>
                            ))}
                            {(buscarProductoLinea[i] || "").length === 0 && <div style={{ ...S.dropdownItem, color: "rgba(200,230,180,0.4)" }}>Escribe para buscar…</div>}
                            <div style={{ ...S.dropdownItem, textAlign: "center", color: "rgba(200,230,180,0.4)", cursor: "pointer" }} onClick={() => setMostrarBuscadorLinea(null)}>Cerrar</div>
                          </div>
                        )}
                      </div>

                      {prod && !prod.registro_sanitario && prod.categoria === "fitosanitario" && (
                        <div style={{ ...S.warnBanner, marginBottom: 8, padding: "6px 10px" }}>⚠️ Sin RSCO registrado en el catálogo</div>
                      )}

                      <div style={S.formRow}>
                        <div style={{ flex: 1 }}>
                          <div style={S.lineaCampo}>CANT. FACTURADA</div>
                          <input style={S.select} type="number" min="0" step="any" value={l.cantidad_facturada}
                            onChange={(e) => cambiarLinea(i, "cantidad_facturada", e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={S.lineaCampo}>PRECIO / PRESENTACIÓN</div>
                          <input style={S.select} type="number" min="0" step="any" value={l.precio_unitario}
                            onChange={(e) => cambiarLinea(i, "precio_unitario", e.target.value)} />
                        </div>
                      </div>

                      <div style={{ ...S.formRow, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={S.lineaCampo}>CONTENIDO POR PRESENTACIÓN ({prod?.unidad_base || "kg/L"})</div>
                          <input style={S.select} type="number" min="0" step="any" value={l.contenido_por_unidad}
                            onChange={(e) => cambiarLinea(i, "contenido_por_unidad", e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={S.lineaCampo}>IMPORTE</div>
                          <input style={S.select} type="number" min="0" step="any" value={l.importe}
                            onChange={(e) => cambiarLinea(i, "importe", e.target.value)} />
                        </div>
                      </div>

                      {esFito && (
                        <div style={{ ...S.formRow, marginTop: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={S.lineaCampo}>LOTE (obligatorio)</div>
                            <input style={{ ...S.select, borderColor: !l.lote.trim() ? "rgba(224,92,92,0.5)" : "rgba(127,191,90,0.25)" }}
                              value={l.lote} onChange={(e) => cambiarLinea(i, "lote", e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={S.lineaCampo}>CADUCIDAD</div>
                            <input type="date" style={S.select} value={l.fecha_caducidad} onChange={(e) => cambiarLinea(i, "fecha_caducidad", e.target.value)} />
                          </div>
                        </div>
                      )}

                      {!esFito && prod?.categoria !== undefined && (
                        <div style={{ marginTop: 8 }}>
                          <div style={S.lineaCampo}>LOTE (opcional)</div>
                          <input style={S.select} value={l.lote} onChange={(e) => cambiarLinea(i, "lote", e.target.value)} />
                        </div>
                      )}

                      {costoCalc !== null && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(200,230,180,0.6)" }}>
                          → entran <b style={{ color: "#7fbf5a" }}>{(parseFloat(l.cantidad_facturada) * parseFloat(l.contenido_por_unidad)).toLocaleString("es-MX")} {prod?.unidad_base}</b>
                          {" "}a <b style={{ color: "#7fbf5a" }}>${costoCalc.toFixed(4)}</b> por {prod?.unidad_base}
                        </div>
                      )}
                    </div>
                  );
                })}

                {modoCaptura === "manual" && (
                  <button style={S.btnSecundario} onClick={agregarLineaManual}>+ Agregar producto</button>
                )}

                {lineasSinRsco.length > 0 && (
                  <div style={{ ...S.warnBanner, marginTop: 10 }}>⚠️ {lineasSinRsco.length} producto(s) sin registro sanitario (RSCO) en el catálogo. Puedes guardar, pero conviene completarlo pronto.</div>
                )}

                <button
                  style={{ ...S.btnPrimary, marginTop: 16, opacity: puedeGuardar && !guardando ? 1 : 0.5, cursor: puedeGuardar && !guardando ? "pointer" : "not-allowed" }}
                  disabled={!puedeGuardar || guardando}
                  onClick={registrarCompra}>
                  {guardando ? "Guardando…" : "Registrar compra"}
                </button>
                {!puedeGuardar && lineas.length > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(200,230,180,0.45)", marginTop: -10, marginBottom: 10 }}>
                    {lineasIncompletas.length > 0 && "Faltan productos o cantidades por completar. "}
                    {lineasFitoSinLote.length > 0 && "Falta el lote en algún fitosanitario. "}
                    {cab.tipo_documento === "factura" && (!cuadraSubtotal || !cuadraDescuento || !cuadraIva) && "Los importes no cuadran con la factura. "}
                    {cab.tipo_documento === "factura" && (!cab.uuid_cfdi || !cab.fecha_emision) && "Faltan datos del CFDI."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ HISTORIAL ============ */}
        {!cargando && pestana === "historial" && (
          <div>
            {comprasHist.length === 0 && <div style={S.empty}>Aún no hay compras registradas.</div>}
            {comprasHist.map((c) => (
              <div key={c.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => abrirDetalle(c.id)}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>{nombreProveedor(c.proveedor_id)}</div>
                    <div style={{ fontSize: 11, color: "rgba(200,230,180,0.5)" }}>
                      {c.serie}{c.folio || c.referencia_proveedor} · {nombreBodegaDe(c.bodega_destino_id)} · {new Date(c.fecha_recepcion).toLocaleDateString("es-MX")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#e8f5e0" }}>${Number(c.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                    <span style={{ ...S.miniTag, color: c.estado === "registrada" ? "#7fbf5a" : "#e05c5c", background: c.estado === "registrada" ? "rgba(127,191,90,0.12)" : "rgba(224,92,92,0.12)" }}>
                      {c.estado === "registrada" ? "✅ Registrada" : "✖ Cancelada"}
                    </span>
                  </div>
                </div>

                {expandida === c.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {(detallePorCompra[c.id] || []).map((d) => (
                      <div key={d.id} style={S.cardRow}>
                        <span>{d.descripcion_factura}{d.lote && ` · lote ${d.lote}`}</span>
                        <span style={{ fontWeight: 700, color: "#e8f5e0" }}>{Number(d.cantidad_base).toLocaleString("es-MX")} · ${Number(d.costo_unitario_base).toFixed(2)}</span>
                      </div>
                    ))}
                    {c.motivo_cancelacion && (
                      <div style={{ fontSize: 11, color: "#e05c5c", marginTop: 6 }}>Motivo de cancelación: {c.motivo_cancelacion}</div>
                    )}
                    {c.estado === "registrada" && (
                      cancelandoId === c.id ? (
                        <div style={{ marginTop: 10 }}>
                          <input style={S.select} placeholder="Motivo de la cancelación" value={motivoCancelacion} onChange={(e) => setMotivoCancelacion(e.target.value)} />
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button style={S.btnPeligro} onClick={() => confirmarCancelacion(c.id)}>Confirmar cancelación</button>
                            <button style={S.btnSecundario} onClick={() => { setCancelandoId(null); setMotivoCancelacion(""); }}>Cerrar</button>
                          </div>
                        </div>
                      ) : (
                        <button style={{ ...S.btnPeligro, marginTop: 10 }} onClick={() => setCancelandoId(c.id)}>Cancelar compra</button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
