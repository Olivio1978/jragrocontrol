// ============ JR AGROCONTROL — ListasAutorizadas.jsx v0.7.0 ============
// Módulo 7. Carga de listas de productos fitosanitarios autorizados
// (ANEBERRIES global o comercializadora propia de la empresa).
//
// Flujo: elegir modo (lista nueva / agregar a existente) → datos de la
// lista (o selector, si es existente) → subir Excel → vista previa que
// clasifica cada fila contra el catálogo ya cargado → confirmar y guardar
// vía fn_cargar_lista (RPC atómica) → reporte final con descarga de las
// filas omitidas (sin coincidencia exacta en catálogo, o con intervalo de
// seguridad/reentrada no reconocido) para volver a subirlas después.
//
// Acceso: exclusivo para admin/superadmin (esAdmin, src/lib/permisos.js).
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import { esAdmin } from "./lib/permisos";
import * as XLSX from "xlsx";

// ============ Login (idéntico al resto de los módulos) ============
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
        <div style={S.eyebrow}>JR AGROCONTROL</div>
        <h1 style={S.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={S.selectorGroup}>
            <label style={S.label}>Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={S.select} required />
          </div>
          <div style={{ ...S.selectorGroup, marginTop: "12px" }}>
            <label style={S.label}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={S.select} required />
          </div>
          {error && <p style={{ color: "#e05c5c", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
          <button type="submit" disabled={cargando} style={{ ...S.guardarBtn, marginTop: "20px" }}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============ Conversión de intervalos de texto a horas ============
// Solo reconoce patrones simples y explícitos. Si el texto no calza con
// ninguno, regresa null — la fila se marca para revisión manual en vez
// de adivinar un número, porque estos valores son de seguridad del
// trabajador (reentrada) e inocuidad de exportación (seguridad/PHI).
function parsearIntervaloHoras(textoOriginal) {
  if (textoOriginal === null || textoOriginal === undefined) return { horas: null, reconocido: true };
  const t = String(textoOriginal).trim().toLowerCase();
  if (t === "") return { horas: null, reconocido: true };

  if (/^\d+$/.test(t)) return { horas: parseInt(t, 10), reconocido: true };

  let m = t.match(/^(\d+(?:\.\d+)?)\s*d(í|i)as?$/) || t.match(/^(\d+(?:\.\d+)?)\s*d$/);
  if (m) return { horas: Math.round(parseFloat(m[1]) * 24), reconocido: true };

  m = t.match(/^(\d+(?:\.\d+)?)\s*horas?$/) || t.match(/^(\d+(?:\.\d+)?)\s*h(rs?)?\.?$/);
  if (m) return { horas: Math.round(parseFloat(m[1])), reconocido: true };

  return { horas: null, reconocido: false };
}

// ============ Normalización para emparejar nombres de producto ============
function normalizar(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

const COLUMNAS_EXCEL = [
  "nombre_comercial", "ingrediente_activo", "concentracion_ia", "grupo_quimico",
  "clasificacion_resistencia", "tipo_fitosanitario", "plaga_comun", "plaga_cientifica",
  "dosis_etiqueta", "intervalo_entre_aplicaciones", "intervalo_seguridad",
  "intervalo_reentrada", "lmr_ppm", "observaciones",
];

export default function ListasAutorizadas() {
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  // Catálogos base
  const [especies, setEspecies] = useState([]);
  const [comercializadoras, setComercializadoras] = useState([]);
  const [listasActivas, setListasActivas] = useState([]);
  const [productosCatalogo, setProductosCatalogo] = useState([]); // [{id, nombre_comercial}]
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  // Estado del asistente
  const [paso, setPaso] = useState(1); // 1 modo, 2 datos, 3 subir, 4 vista previa, 5 guardando, 6 resultado
  const [modo, setModo] = useState(null); // 'nueva' | 'existente'
  const [listaExistenteId, setListaExistenteId] = useState("");
  const [meta, setMeta] = useState({
    especie_id: "", comercializadora_id: "", mercado: "", fuente: "",
    numero_revision: "", fecha_revision: "", temporada: "",
  });

  const [archivoNombre, setArchivoNombre] = useState("");
  const [filasListas, setFilasListas] = useState([]);   // ✅ para insertar
  const [filasOmitidas, setFilasOmitidas] = useState([]); // ⚠️❌ para reportar

  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [resultado, setResultado] = useState(null); // { listaId, insertadas }

  // ---- Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setUsuarioActual(null);
    setErrorCarga("");
  }, [sesion?.user?.id]);

  useEffect(() => {
    if (!sesion) return;
    supabase.from("usuarios").select("nombre_completo, rol, empresa_id").eq("id", sesion.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErrorCarga("Tu usuario no tiene perfil asignado."); return; }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol, empresa_id: data.empresa_id });
      });
  }, [sesion]);

  // ---- Catálogos (solo si es admin o superadmin) ----
  useEffect(() => {
    if (!usuarioActual || !esAdmin(usuarioActual)) return;
    setCargandoCatalogos(true);

    Promise.all([
      supabase.from("especies").select("id, nombre").order("nombre"),
      supabase.from("comercializadoras").select("id, nombre").order("nombre"),
      supabase.from("listas").select("id, especie_id, comercializadora_id, numero_revision, fecha_revision, empresa_id").eq("activo", true),
      supabase.from("productos_fitosanitarios").select("id, producto_id, productos_insumos(nombre_comercial)"),
    ]).then(([esp, com, lst, prod]) => {
      setCargandoCatalogos(false);
      const err = esp.error || com.error || lst.error || prod.error;
      if (err) { setErrorCarga(err.message); return; }

      setEspecies(esp.data || []);
      setComercializadoras(com.data || []);
      setListasActivas(lst.data || []);
      setProductosCatalogo((prod.data || [])
        .filter(p => p.productos_insumos?.nombre_comercial)
        .map(p => ({ id: p.id, nombre_comercial: p.productos_insumos.nombre_comercial })));
    });
  }, [usuarioActual]);

  // ---- Clasificar una fila del Excel contra el catálogo ya cargado ----
  function clasificarFila(fila) {
    const nombreNorm = normalizar(fila.nombre_comercial);
    const match = productosCatalogo.find(p => normalizar(p.nombre_comercial) === nombreNorm);
    if (!match) {
      return { ok: false, motivo: `Producto no encontrado en catálogo: "${fila.nombre_comercial || "(vacío)"}"` };
    }
    const seg = parsearIntervaloHoras(fila.intervalo_seguridad);
    if (!seg.reconocido) {
      return { ok: false, motivo: `Intervalo de seguridad no reconocido: "${fila.intervalo_seguridad}"` };
    }
    const reen = parsearIntervaloHoras(fila.intervalo_reentrada);
    if (!reen.reconocido) {
      return { ok: false, motivo: `Intervalo de reentrada no reconocido: "${fila.intervalo_reentrada}"` };
    }
    return {
      ok: true,
      datos: {
        producto_fitosanitario_id: match.id,
        plaga_comun: fila.plaga_comun || null,
        plaga_cientifica: fila.plaga_cientifica || null,
        dosis_etiqueta: fila.dosis_etiqueta || null,
        intervalo_entre_aplicaciones: fila.intervalo_entre_aplicaciones || null,
        intervalo_seguridad_horas: seg.horas,
        intervalo_reentrada: reen.horas,
        lmr_ppm: fila.lmr_ppm || null,
        observaciones: fila.observaciones || null,
      },
    };
  }

  // ---- Leer y clasificar el Excel seleccionado ----
  async function handleArchivoSeleccionado(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    setErrorGuardado("");

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filasRaw = XLSX.utils.sheet_to_json(hoja, { defval: "" });

      const ok = [];
      const omitidas = [];
      filasRaw.forEach((fila, i) => {
        const r = clasificarFila(fila);
        if (r.ok) ok.push(r.datos);
        else omitidas.push({ fila_excel: i + 2, motivo: r.motivo, ...fila }); // +2: fila 1 es encabezado
      });

      setFilasListas(ok);
      setFilasOmitidas(omitidas);
      setPaso(4);
    } catch (err) {
      setErrorGuardado("No se pudo leer el archivo: " + err.message);
    }
  }

  // ---- Confirmar y guardar vía RPC atómica ----
  async function confirmarYGuardar() {
    setGuardando(true);
    setErrorGuardado("");

    const payload = {
      p_modo: modo,
      p_lista_id: modo === "existente" ? listaExistenteId : null,
      // Simplificación de esta primera versión: superadmin siempre crea listas
      // globales; un admin de empresa siempre crea listas de su propia empresa.
      // El caso raro de "copia propia de empresa distinta a la global" (superadmin
      // creando una lista para un cliente específico) queda para más adelante.
      p_empresa_id: usuarioActual.rol === "superadmin" ? null : usuarioActual.empresa_id,
      p_especie_id: modo === "nueva" ? meta.especie_id : null,
      p_comercializadora_id: modo === "nueva" ? (meta.comercializadora_id || null) : null,
      p_mercado: modo === "nueva" ? meta.mercado : null,
      p_fuente: modo === "nueva" ? meta.fuente : null,
      p_numero_revision: modo === "nueva" ? meta.numero_revision : null,
      p_fecha_revision: modo === "nueva" ? (meta.fecha_revision || null) : null,
      p_temporada: modo === "nueva" ? meta.temporada : null,
      p_filas: filasListas,
    };

    const { data, error } = await supabase.rpc("fn_cargar_lista", payload);
    setGuardando(false);
    if (error) { setErrorGuardado(error.message); return; }
    setResultado({ listaId: data, insertadas: filasListas.length });
    setPaso(6);
  }

  // ---- Descargar Excel de las filas omitidas ----
  function descargarOmitidas() {
    const ws = XLSX.utils.json_to_sheet(filasOmitidas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Omitidas");
    XLSX.writeFile(wb, `filas_omitidas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ---- Reiniciar el asistente para cargar otra lista ----
  function reiniciar() {
    setPaso(1);
    setModo(null);
    setListaExistenteId("");
    setMeta({ especie_id: "", comercializadora_id: "", mercado: "", fuente: "", numero_revision: "", fecha_revision: "", temporada: "" });
    setArchivoNombre("");
    setFilasListas([]);
    setFilasOmitidas([]);
    setResultado(null);
    setErrorGuardado("");
  }

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  // ---- Estados de carga / acceso ----
  if (sesion === undefined) return <div style={S.page}><div style={S.container}>Cargando…</div></div>;
  if (!sesion) return <Login />;
  if (!usuarioActual) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <p>{errorCarga || "Cargando perfil…"}</p>
          {errorCarga && <button onClick={cerrarSesion} style={{ ...S.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>}
        </div>
      </div>
    );
  }
  if (!esAdmin(usuarioActual)) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.eyebrow}>JR AGROCONTROL · LISTAS AUTORIZADAS</div>
          <div style={S.version}>v0.7.0</div>
          <h1 style={S.title}>Acceso restringido</h1>
          <div style={S.avisoRestriccion}>
            Esta pantalla es exclusiva para el administrador. Tu cuenta tiene rol de {usuarioActual.rol}.
          </div>
          <button onClick={cerrarSesion} style={{ ...S.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · LISTAS AUTORIZADAS</div>
            <h1 style={S.title}>Cargar lista</h1>
            <div style={S.usuarioTag}>
              {usuarioActual.nombre} · {usuarioActual.rol}
              {" · "}<button onClick={cerrarSesion} style={S.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>📋</div>
            <div style={S.version}>v0.7.0</div>
          </div>
        </div>

        {errorCarga && <div style={{ ...S.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>{errorCarga}</div>}

        {cargandoCatalogos ? (
          <div style={S.empty}>Cargando catálogos…</div>
        ) : (
          <>
            {/* ---- Paso 1: elegir modo ---- */}
            {paso === 1 && (
              <div style={S.seccion}>
                <div style={S.seccionTitulo}>¿Qué vas a subir?</div>
                <button style={S.modoBtn} onClick={() => { setModo("nueva"); setPaso(2); }}>
                  Lista nueva
                  <div style={S.modoBtnSub}>Crea una revisión nueva (ej. ANEBERRIES 2026, Giddings 2026-2027)</div>
                </button>
                <button style={S.modoBtn} onClick={() => { setModo("existente"); setPaso(2); }}>
                  Agregar a lista existente
                  <div style={S.modoBtnSub}>Para subir filas que quedaron omitidas la vez pasada</div>
                </button>
              </div>
            )}

            {/* ---- Paso 2a: datos de la lista nueva ---- */}
            {paso === 2 && modo === "nueva" && (
              <div style={S.seccion}>
                <div style={S.seccionTitulo}>Datos de la lista</div>
                <div style={S.selectorGroup}>
                  <label style={S.label}>Especie</label>
                  <select style={S.select} value={meta.especie_id} onChange={(e) => setMeta({ ...meta, especie_id: e.target.value })}>
                    <option value="">Selecciona…</option>
                    {especies.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div style={S.selectorGroup}>
                  <label style={S.label}>Comercializadora</label>
                  <select style={S.select} value={meta.comercializadora_id} onChange={(e) => setMeta({ ...meta, comercializadora_id: e.target.value })}>
                    <option value="">Ninguna — lista base ANEBERRIES</option>
                    {comercializadoras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div style={S.formGrid2}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Mercado</label>
                    <input style={S.select} value={meta.mercado} onChange={(e) => setMeta({ ...meta, mercado: e.target.value })} placeholder="USA / UE / Nacional" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Temporada</label>
                    <input style={S.select} value={meta.temporada} onChange={(e) => setMeta({ ...meta, temporada: e.target.value })} placeholder="2026-2027" />
                  </div>
                </div>
                <div style={S.formGrid2}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>No. de revisión</label>
                    <input style={S.select} value={meta.numero_revision} onChange={(e) => setMeta({ ...meta, numero_revision: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Fecha de revisión</label>
                    <input type="date" style={S.select} value={meta.fecha_revision} onChange={(e) => setMeta({ ...meta, fecha_revision: e.target.value })} />
                  </div>
                </div>
                <div style={S.selectorGroup}>
                  <label style={S.label}>Fuente</label>
                  <input style={S.select} value={meta.fuente} onChange={(e) => setMeta({ ...meta, fuente: e.target.value })} placeholder="ANEBERRIES — app oficial" />
                </div>
                <button style={S.guardarBtn} disabled={!meta.especie_id} onClick={() => setPaso(3)}>Siguiente: subir Excel</button>
                <button style={{ ...S.btnSecundario, marginTop: "10px" }} onClick={() => setPaso(1)}>Atrás</button>
              </div>
            )}

            {/* ---- Paso 2b: elegir lista existente ---- */}
            {paso === 2 && modo === "existente" && (
              <div style={S.seccion}>
                <div style={S.seccionTitulo}>¿A cuál lista le agregamos filas?</div>
                <div style={S.selectorGroup}>
                  <select style={S.select} value={listaExistenteId} onChange={(e) => setListaExistenteId(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {listasActivas.map(l => {
                      const esp = especies.find(e => e.id === l.especie_id)?.nombre || "?";
                      const com = comercializadoras.find(c => c.id === l.comercializadora_id)?.nombre || "ANEBERRIES base";
                      return <option key={l.id} value={l.id}>{esp} · {com} · rev. {l.numero_revision || "s/n"}</option>;
                    })}
                  </select>
                </div>
                <button style={S.guardarBtn} disabled={!listaExistenteId} onClick={() => setPaso(3)}>Siguiente: subir Excel</button>
                <button style={{ ...S.btnSecundario, marginTop: "10px" }} onClick={() => setPaso(1)}>Atrás</button>
              </div>
            )}

            {/* ---- Paso 3: subir Excel ---- */}
            {paso === 3 && (
              <div style={S.seccion}>
                <div style={S.seccionTitulo}>Sube el Excel</div>
                <div style={{ ...S.avisoRestriccion, color: "#c8e89a", background: "rgba(127,191,90,0.08)", borderColor: "rgba(127,191,90,0.25)" }}>
                  Columnas esperadas: {COLUMNAS_EXCEL.join(", ")}
                </div>
                <input type="file" accept=".xlsx,.xls" onChange={handleArchivoSeleccionado} style={S.select} />
                {errorGuardado && <p style={{ color: "#e05c5c", fontSize: "12px", marginTop: "8px" }}>{errorGuardado}</p>}
                <button style={{ ...S.btnSecundario, marginTop: "16px" }} onClick={() => setPaso(2)}>Atrás</button>
              </div>
            )}

            {/* ---- Paso 4: vista previa ---- */}
            {paso === 4 && (
              <div style={S.seccion}>
                <div style={S.seccionTitulo}>Vista previa — {archivoNombre}</div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ ...S.resumenCard, flex: 1 }}>
                    <div style={{ ...S.resumenNum, color: "#7fbf5a" }}>{filasListas.length}</div>
                    <div style={S.resumenLabel}>✅ listas para subir</div>
                  </div>
                  <div style={{ ...S.resumenCard, flex: 1 }}>
                    <div style={{ ...S.resumenNum, color: "#e8a23d" }}>{filasOmitidas.length}</div>
                    <div style={S.resumenLabel}>⚠️ omitidas</div>
                  </div>
                </div>

                {filasOmitidas.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={S.seccionTitulo}>Filas omitidas (revisar después)</div>
                    {filasOmitidas.slice(0, 8).map((f, i) => (
                      <div key={i} style={S.filaOmitida}>
                        <strong>Fila {f.fila_excel}</strong> — {f.motivo}
                      </div>
                    ))}
                    {filasOmitidas.length > 8 && (
                      <div style={{ ...S.resumenLabel, marginTop: "6px" }}>y {filasOmitidas.length - 8} más — descarga el reporte al final para verlas todas.</div>
                    )}
                  </div>
                )}

                {errorGuardado && <p style={{ color: "#e05c5c", fontSize: "12px", marginBottom: "8px" }}>{errorGuardado}</p>}

                <button style={S.guardarBtn} disabled={filasListas.length === 0 || guardando} onClick={confirmarYGuardar}>
                  {guardando ? "Guardando…" : `Confirmar y guardar ${filasListas.length} filas`}
                </button>
                <button style={{ ...S.btnSecundario, marginTop: "10px" }} onClick={() => setPaso(3)} disabled={guardando}>Atrás</button>
              </div>
            )}

            {/* ---- Paso 6: resultado ---- */}
            {paso === 6 && resultado && (
              <div style={S.seccion}>
                <div style={{ ...S.avisoRestriccion, color: "#c8e89a", background: "rgba(127,191,90,0.12)", borderColor: "rgba(127,191,90,0.3)" }}>
                  ✓ Se guardaron {resultado.insertadas} filas correctamente.
                </div>
                {filasOmitidas.length > 0 && (
                  <>
                    <p style={{ fontSize: "13px", color: "rgba(200,230,180,0.7)", marginBottom: "10px" }}>
                      Quedaron {filasOmitidas.length} filas sin subir. Descarga el reporte, corrígelas o crea los productos faltantes en el catálogo, y vuelve con "Agregar a lista existente".
                    </p>
                    <button style={S.btnSecundario} onClick={descargarOmitidas}>Descargar Excel de filas omitidas</button>
                  </>
                )}
                <button style={{ ...S.guardarBtn, marginTop: "16px" }} onClick={reiniciar}>Cargar otra lista</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ Estilos (mismo lenguaje visual que el resto de la app) ============
const S = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8f5e0", padding: "20px 16px 40px", boxSizing: "border-box" },
  container: { maxWidth: "640px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.12em", color: "#7fbf5a", marginBottom: "4px", fontWeight: "600" },
  title: { fontSize: "26px", fontWeight: "800", margin: 0, color: "#ffffff" },
  headerIcon: { fontSize: "36px" },
  version: { fontSize: "10px", color: "rgba(127,191,90,0.5)", textAlign: "right", marginTop: "2px" },
  usuarioTag: { fontSize: "11px", color: "rgba(200,230,180,0.55)", marginTop: "4px" },
  logoutLink: { background: "none", border: "none", padding: 0, color: "#e8a23d", fontSize: "11px", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" },
  avisoRestriccion: { background: "rgba(232,162,61,0.12)", border: "1px solid rgba(232,162,61,0.3)", borderRadius: "12px", padding: "12px 14px", fontSize: "12px", lineHeight: "1.5", color: "#e8a23d", marginBottom: "16px" },
  selectorGroup: { marginBottom: "16px" },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  seccion: { marginBottom: "20px" },
  seccionTitulo: { fontSize: "13px", fontWeight: "700", color: "#c8e89a", marginBottom: "10px", borderBottom: "1px solid rgba(127,191,90,0.2)", paddingBottom: "6px" },
  formGrid2: { display: "flex", gap: "10px", marginBottom: "10px" },
  guardarBtn: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 24px rgba(90,171,46,0.3)" },
  btnSecundario: { width: "100%", background: "rgba(255,255,255,0.06)", color: "#e8f5e0", border: "1px solid rgba(127,191,90,0.3)", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer" },
  modoBtn: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "20px", fontSize: "15px", fontWeight: "700", color: "#e8f5e0", cursor: "pointer", textAlign: "left", marginBottom: "12px" },
  modoBtnSub: { fontSize: "12px", fontWeight: "400", color: "rgba(200,230,180,0.6)", marginTop: "4px" },
  filaOk: { background: "rgba(127,191,90,0.08)", border: "1px solid rgba(127,191,90,0.2)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", marginBottom: "6px" },
  filaOmitida: { background: "rgba(232,162,61,0.08)", border: "1px solid rgba(232,162,61,0.2)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", marginBottom: "6px" },
  resumenCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px", marginBottom: "16px", textAlign: "center" },
  resumenNum: { fontSize: "28px", fontWeight: "800" },
  resumenLabel: { fontSize: "11px", color: "rgba(200,230,180,0.6)", marginTop: "2px" },
};
