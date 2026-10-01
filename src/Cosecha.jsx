// ============ JR AGROCONTROL — Cosecha.jsx v0.8.2 ============
// v0.8.2: se agrega la pantalla de inicio de sesión y el botón "Salir",
// con el mismo patrón que el resto de los módulos (Asistencia, Compras).
// Antes, al entrar sin sesión, este módulo solo mostraba un mensaje de
// texto en vez del formulario de acceso.
//
// Módulo 8: Cosecha y Empaque. Primera entrega, con dos pestañas:
//
//   Día   — el encargado de rancho abre el día de cosecha, asigna
//           túneles a los cortadores y, cuando hay más de un
//           carretillero, reparte los sectores entre ellos.
//   Corte — el carretillero registra las cubetas que recibe de cada
//           cortador y cierra el viaje antes de llevarlas al empaque.
//
// Esta versión cubre la modalidad "bote" (Erick y Valdo). La modalidad
// "caja" (Citlali) se agrega en la siguiente entrega junto con el
// control de material de empaque.
//
// Las cubetas se insertan en el momento del toque, no al final: así la
// hora de cada entrega queda real y sirve para las alertas de ritmo.
import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";
import { esEncargado, puedeCapturarCorte } from "./lib/permisos";

// ============ Utilidades ============
function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

function formatFecha(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function iniciales(nombre) {
  return (nombre || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const ESTADO_DIA = {
  abierto:          { label: "Abierto",          color: "#7fbf5a" },
  con_incidencias:  { label: "Con incidencias",  color: "#e8a23d" },
  cerrado:          { label: "Cerrado",          color: "#e05c5c" },
};

// ============ PANTALLA DE LOGIN ============
// Mismo patrón que Asistencia y Compras. Pendiente de limpieza: extraer
// este componente a src/lib/Login.jsx y que todos los módulos lo importen,
// para dejar de repetirlo en cada archivo.
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
    <div style={styles.page}>
      <div style={{ ...styles.container, paddingTop: "60px" }}>
        <div style={styles.eyebrow}>JR AGROCONTROL · COSECHA</div>
        <h1 style={styles.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>CORREO</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.select}
              required
            />
          </div>
          <div style={{ ...styles.selectorGroup, marginTop: "12px" }}>
            <label style={styles.label}>CONTRASEÑA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.select}
              required
            />
          </div>
          {error && <p style={{ color: "#e05c5c", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
          <button type="submit" disabled={cargando} style={{ ...styles.guardarBtn, marginTop: "20px" }}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Cosecha() {
  // ---- Sesión y perfil ----
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);

  // ---- Catálogos ----
  const [ranchos, setRanchos] = useState([]);
  const [ranchoId, setRanchoId] = useState(null);
  const [parametros, setParametros] = useState(null);
  const [tuneles, setTuneles] = useState([]);       // { id, numero, sector, sector_id }
  const [cortadores, setCortadores] = useState([]); // empleados tipo Corte con asistencia
  const [carretilleros, setCarretilleros] = useState([]);

  // ---- Estado del día ----
  const [fecha] = useState(todayISO());
  const [dia, setDia] = useState(null);
  const [asignaciones, setAsignaciones] = useState({}); // { cortadorId: [tunelId] }
  const [zonas, setZonas] = useState({});              // { tunelId: carretilleroId }

  // ---- Corte ----
  const [carretilleroId, setCarretilleroId] = useState(null);
  const [viaje, setViaje] = useState(null);
  const [registros, setRegistros] = useState([]);  // registros del viaje abierto
  const [tunelElegido, setTunelElegido] = useState({}); // { cortadorId: tunelId }

  // ---- UI ----
  const [pestana, setPestana] = useState("dia");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(null); // evita doble toque

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- 1.b Limpieza al cambiar de usuario ----
  useEffect(() => {
    setUsuarioActual(null);
    setRanchoId(null);
    setRanchos([]);
    setDia(null);
    setViaje(null);
    setRegistros([]);
    setError("");
  }, [sesion?.user?.id]);

  // ---- 2. Perfil ----
  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("usuarios")
      .select("nombre_completo, rol, rancho_id")
      .eq("id", sesion.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("Tu usuario no tiene perfil asignado.");
          return;
        }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol, rancho_id: data.rancho_id });
        if (data.rancho_id) setRanchoId(data.rancho_id);
        if (data.rol === "carretillero" || data.rol === "empaque") setPestana("corte");
      });
  }, [sesion]);

  // ---- 3. Ranchos ----
  useEffect(() => {
    if (!usuarioActual) return;
    supabase
      .from("ranchos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data, error }) => {
        if (error) { setError(error.message); return; }
        setRanchos(data || []);
        setRanchoId((prev) => prev || data?.[0]?.id || null);
      });
  }, [usuarioActual]);

  // ---- 4. Parámetros y túneles del rancho ----
  useEffect(() => {
    if (!ranchoId) return;

    supabase
      .from("cosecha_parametros")
      .select("modalidad_cosecha, usa_carretillero, conteo_ciego, minimo_cubetas_dia")
      .eq("rancho_id", ranchoId)
      .single()
      .then(({ data }) => setParametros(data || null));

    supabase
      .from("tuneles")
      .select("id, numero, metros_lineales, sectores!inner(id, nombre, rancho_id)")
      .eq("sectores.rancho_id", ranchoId)
      .eq("activo", true)
      .order("numero")
      .then(({ data, error }) => {
        if (error) { setError(error.message); return; }
        setTuneles(
          (data || []).map((t) => ({
            id: t.id,
            numero: t.numero,
            metros: t.metros_lineales,
            sectorId: t.sectores.id,
            sector: t.sectores.nombre,
          }))
        );
      });
  }, [ranchoId]);

  // ---- 5. Día de cosecha ----
  const cargarDia = async (rid = ranchoId) => {
    if (!rid) return null;
    const { data } = await supabase
      .from("cosecha_dias")
      .select("id, fecha, estado, modalidad")
      .eq("rancho_id", rid)
      .eq("fecha", fecha)
      .maybeSingle();
    setDia(data || null);
    return data || null;
  };

  useEffect(() => { cargarDia(); }, [ranchoId, fecha]);

  // ---- 6. Personal con asistencia del día ----
  useEffect(() => {
    if (!ranchoId) return;
    (async () => {
      setCargando(true);

      const { data: empleados, error: e1 } = await supabase
        .from("empleados")
        .select("id, nombre_completo, tipo_empleo_id, tipos_empleo(nombre)")
        .eq("rancho_id", ranchoId)
        .eq("activo", true)
        .order("nombre_completo");

      if (e1) { setError(e1.message); setCargando(false); return; }

      const { data: asist } = await supabase
        .from("asistencia")
        .select("empleado_id, incidencia")
        .eq("rancho_id", ranchoId)
        .eq("fecha", fecha);

      const presentes = new Set(
        (asist || [])
          .filter((a) => !["falta", "permiso", "incapacidad"].includes(a.incidencia))
          .map((a) => a.empleado_id)
      );

      const conAsistencia = (empleados || []).filter((e) => presentes.has(e.id));

      setCortadores(conAsistencia.filter((e) => e.tipos_empleo?.nombre === "Corte"));
      setCarretilleros(conAsistencia.filter((e) => e.tipos_empleo?.nombre === "Carretillero"));
      setCargando(false);
    })();
  }, [ranchoId, fecha]);

  // ---- 7. Asignaciones vigentes de túnel ----
  const cargarAsignaciones = async () => {
    if (!ranchoId) return;
    const { data } = await supabase
      .from("asignaciones_tunel")
      .select("tunel_id, empleado_id, tuneles!inner(sectores!inner(rancho_id))")
      .is("vigente_hasta", null)
      .eq("tuneles.sectores.rancho_id", ranchoId);

    const mapa = {};
    (data || []).forEach((a) => {
      if (!mapa[a.empleado_id]) mapa[a.empleado_id] = [];
      mapa[a.empleado_id].push(a.tunel_id);
    });
    setAsignaciones(mapa);
  };

  useEffect(() => { cargarAsignaciones(); }, [ranchoId]);

  // ---- 8. Zonas de carretillero del día ----
  const cargarZonas = async (diaId) => {
    if (!diaId) return;
    const { data } = await supabase
      .from("zonas_carretillero")
      .select("tunel_id, carretillero_id")
      .eq("cosecha_dia_id", diaId);

    const mapa = {};
    (data || []).forEach((z) => { mapa[z.tunel_id] = z.carretillero_id; });
    setZonas(mapa);
  };

  useEffect(() => { if (dia?.id) cargarZonas(dia.id); }, [dia?.id]);

  // ---- 9. Viaje abierto del carretillero ----
  const cargarViaje = async (cid = carretilleroId, diaId = dia?.id) => {
    if (!cid || !diaId) { setViaje(null); setRegistros([]); return; }

    const { data: v } = await supabase
      .from("viajes")
      .select("id, numero, estado, abierto_en")
      .eq("cosecha_dia_id", diaId)
      .eq("carretillero_id", cid)
      .eq("estado", "abierto")
      .maybeSingle();

    setViaje(v || null);
    if (!v) { setRegistros([]); return; }

    const { data: regs } = await supabase
      .from("cosecha_registros")
      .select("id, cortador_id, tunel_id, tipo, cantidad, registrado_en")
      .eq("viaje_id", v.id)
      .eq("anulado", false);

    setRegistros(regs || []);
  };

  useEffect(() => { cargarViaje(); }, [carretilleroId, dia?.id]);

  // Si el usuario ES el carretillero, se preselecciona a sí mismo
  useEffect(() => {
    if (usuarioActual?.rol !== "carretillero" || carretilleroId) return;
    const yo = carretilleros.find((c) => c.nombre_completo === usuarioActual.nombre);
    if (yo) setCarretilleroId(yo.id);
  }, [carretilleros, usuarioActual]);

  // ============ Acciones ============

  const abrirDia = async () => {
    setOcupado("dia"); setError(""); setAviso("");
    const { data, error } = await supabase.rpc("fn_abrir_dia_cosecha", {
      p_rancho_id: ranchoId,
      p_fecha: fecha,
    });
    setOcupado(null);
    if (error) { setError(error.message); return; }
    await cargarDia();
    setAviso("Día abierto. Ya se puede registrar corte.");
  };

  const asignarTunel = async (tunelId, cortadorId) => {
    setOcupado(tunelId); setError("");
    const { error } = await supabase.rpc("fn_asignar_tunel", {
      p_tunel_id: tunelId,
      p_empleado_id: cortadorId,
      p_desde: fecha,
      p_motivo_fin: "Reasignación",
    });
    setOcupado(null);
    if (error) { setError(error.message); return; }
    await cargarAsignaciones();
  };

  const asignarZonaSector = async (sectorId, carretilleroIdSel) => {
    if (!dia?.id) { setError("Primero abre el día."); return; }
    setOcupado(sectorId); setError("");
    const { error } = await supabase.rpc("fn_asignar_zona_sector", {
      p_cosecha_dia_id: dia.id,
      p_carretillero_id: carretilleroIdSel,
      p_sector_id: sectorId,
    });
    setOcupado(null);
    if (error) { setError(error.message); return; }
    await cargarZonas(dia.id);
    setAviso("Sector asignado.");
  };

  const abrirViaje = async () => {
    if (!dia?.id || !carretilleroId) return;
    setOcupado("viaje"); setError("");
    const { error } = await supabase.rpc("fn_abrir_viaje", {
      p_cosecha_dia_id: dia.id,
      p_carretillero_id: carretilleroId,
    });
    setOcupado(null);
    if (error) { setError(error.message); return; }
    await cargarViaje();
  };

  const registrarCubeta = async (cortadorId, tipo) => {
    if (!viaje) { setError("Abre un viaje antes de registrar cubetas."); return; }

    const tunelId = tunelElegido[cortadorId] || asignaciones[cortadorId]?.[0];
    if (!tunelId) {
      setError("Ese cortador no tiene túnel asignado. Elige uno en la lista.");
      return;
    }

    const clave = cortadorId + tipo;
    setOcupado(clave); setError("");

    const { data, error } = await supabase
      .from("cosecha_registros")
      .insert({
        cosecha_dia_id: dia.id,
        cortador_id: cortadorId,
        tunel_id: tunelId,
        tipo,
        cantidad: 1,
        viaje_id: viaje.id,
      })
      .select("id, cortador_id, tunel_id, tipo, cantidad, registrado_en")
      .single();

    setOcupado(null);
    if (error) { setError(error.message); return; }
    setRegistros((prev) => [...prev, data]);
  };

  const deshacerUltima = async (cortadorId, tipo) => {
    const propias = registros
      .filter((r) => r.cortador_id === cortadorId && r.tipo === tipo)
      .sort((a, b) => new Date(b.registrado_en) - new Date(a.registrado_en));

    if (propias.length === 0) return;
    const ultima = propias[0];

    setOcupado("undo" + cortadorId); setError("");
    const { error } = await supabase
      .from("cosecha_registros")
      .update({
        anulado: true,
        anulado_por: sesion.user.id,
        anulado_en: new Date().toISOString(),
        motivo_anulacion: "Corrección en campo",
      })
      .eq("id", ultima.id);

    setOcupado(null);
    if (error) { setError(error.message); return; }
    setRegistros((prev) => prev.filter((r) => r.id !== ultima.id));
  };

  const cerrarViaje = async () => {
    if (!viaje) return;
    setOcupado("cerrar"); setError("");
    const { data, error } = await supabase.rpc("fn_cerrar_viaje", { p_viaje_id: viaje.id });
    setOcupado(null);
    if (error) { setError(error.message); return; }
    setAviso(
      `Viaje ${data.viaje} cerrado: ${data.exportacion} de exportación y ${data.proceso} de proceso. ` +
      `Llévalo al empaque.`
    );
    await cargarViaje();
  };

  // ============ Derivados ============

  const conteoPorCortador = useMemo(() => {
    const mapa = {};
    registros.forEach((r) => {
      if (!mapa[r.cortador_id]) mapa[r.cortador_id] = { exportacion: 0, proceso: 0 };
      if (r.tipo === "cubeta_exportacion") mapa[r.cortador_id].exportacion += r.cantidad;
      if (r.tipo === "cubeta_proceso") mapa[r.cortador_id].proceso += r.cantidad;
    });
    return mapa;
  }, [registros]);

  const totalViaje = useMemo(() => {
    let exp = 0, pro = 0;
    registros.forEach((r) => {
      if (r.tipo === "cubeta_exportacion") exp += r.cantidad;
      if (r.tipo === "cubeta_proceso") pro += r.cantidad;
    });
    return { exp, pro, total: exp + pro };
  }, [registros]);

  // Cortadores que puede atender el carretillero según su zona
  const misCortadores = useMemo(() => {
    const hayZonas = Object.keys(zonas).length > 0;
    if (!hayZonas || !carretilleroId) return cortadores;

    return cortadores.filter((c) => {
      const sus = asignaciones[c.id] || [];
      if (sus.length === 0) return true; // sin túnel fijo: visible para todos
      return sus.some((t) => zonas[t] === carretilleroId);
    });
  }, [cortadores, asignaciones, zonas, carretilleroId]);

  const sectores = useMemo(() => {
    const vistos = {};
    tuneles.forEach((t) => { vistos[t.sectorId] = t.sector; });
    return Object.entries(vistos).map(([id, nombre]) => ({ id, nombre }));
  }, [tuneles]);

  // ============ Render ============

  if (sesion === undefined || (sesion && !usuarioActual && !error)) {
    return <div style={styles.page}><div style={styles.container}><p style={styles.empty}>Cargando…</p></div></div>;
  }

  if (!sesion) return <Login />;

  const estadoDia = dia ? ESTADO_DIA[dia.estado] : null;
  const puedeCapturar = puedeCapturarCorte(usuarioActual);

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Encabezado */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>MÓDULO 8</div>
            <h1 style={styles.title}>Cosecha</h1>
            <div style={styles.usuarioTag}>{usuarioActual?.nombre} · {usuarioActual?.rol}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={styles.headerIcon}>🧺</div>
            <div style={styles.version}>v0.8.2</div>
            <button onClick={() => supabase.auth.signOut()} style={styles.logoutLink}>
              Salir
            </button>
          </div>
        </div>

        {/* Selector de rancho */}
        <div style={styles.selectorsCard}>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>RANCHO</label>
            <select
              value={ranchoId || ""}
              onChange={(e) => { setRanchoId(e.target.value); setCarretilleroId(null); }}
              style={styles.select}
            >
              {ranchos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>ESTADO DEL DÍA</label>
            <div style={{
              ...styles.select,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: estadoDia?.color || "rgba(200,230,180,0.5)",
              fontWeight: "700",
            }}>
              {estadoDia ? estadoDia.label : "Sin abrir"}
              {dia?.modalidad && (
                <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)", fontWeight: "400" }}>
                  {dia.modalidad === "caja" ? "corte en caja" : "corte en bote"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={styles.fechaTexto}>{formatFecha(fecha)}</div>

        {/* Pestañas */}
        <div style={styles.tabs}>
          {esEncargado(usuarioActual) && (
            <button
              onClick={() => setPestana("dia")}
              style={{ ...styles.tab, ...(pestana === "dia" ? styles.tabActiva : {}) }}
            >
              📋 Día
            </button>
          )}
          {puedeCapturar && (
            <button
              onClick={() => setPestana("corte")}
              style={{ ...styles.tab, ...(pestana === "corte" ? styles.tabActiva : {}) }}
            >
              🧺 Corte
            </button>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {aviso && <div style={styles.aviso}>{aviso}</div>}

        {/* ======================= PESTAÑA DÍA ======================= */}
        {pestana === "dia" && esEncargado(usuarioActual) && (
          <>
            {!dia && (
              <div style={styles.card}>
                <p style={{ fontSize: "13px", lineHeight: "1.6", marginTop: 0 }}>
                  El día todavía no está abierto. Sin día abierto nadie puede
                  registrar cubetas, lo que evita capturas con fecha equivocada.
                </p>
                <button
                  onClick={abrirDia}
                  disabled={ocupado === "dia"}
                  style={styles.guardarBtn}
                >
                  {ocupado === "dia" ? "Abriendo…" : "Abrir día de cosecha"}
                </button>
              </div>
            )}

            {dia && (
              <>
                {/* Asignación de túneles */}
                <div style={styles.card}>
                  <div style={styles.cardTitulo}>Túneles por cortador</div>
                  <p style={styles.ayuda}>
                    La asignación se mantiene de un día para otro. Solo hay que
                    tocarla cuando alguien cambia de túnel o se da de baja.
                  </p>

                  {tuneles.length === 0 && <p style={styles.empty}>Este rancho no tiene túneles cargados.</p>}

                  {sectores.map((s) => (
                    <div key={s.id} style={{ marginBottom: "14px" }}>
                      <div style={styles.sectorTitulo}>{s.nombre}</div>
                      {tuneles.filter((t) => t.sectorId === s.id).map((t) => {
                        const asignadoA = Object.entries(asignaciones)
                          .find(([, lista]) => lista.includes(t.id))?.[0] || "";
                        return (
                          <div key={t.id} style={styles.tunelRow}>
                            <span style={styles.tunelNombre}>
                              Túnel {t.numero}
                              <span style={styles.tunelMetros}> · {t.metros} m lineales</span>
                            </span>
                            <select
                              value={asignadoA}
                              onChange={(e) => e.target.value && asignarTunel(t.id, e.target.value)}
                              disabled={ocupado === t.id}
                              style={{ ...styles.select, width: "auto", minWidth: "150px", fontSize: "12px", padding: "6px 8px" }}
                            >
                              <option value="">Sin asignar</option>
                              {cortadores.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Zonas de carretillero */}
                {parametros?.usa_carretillero && carretilleros.length > 1 && (
                  <div style={styles.card}>
                    <div style={styles.cardTitulo}>Zona de cada carretillero</div>
                    <p style={styles.ayuda}>
                      Con más de un carretillero conviene repartir los sectores
                      para que no se crucen. Cada uno solo verá a los cortadores
                      de su zona.
                    </p>
                    {sectores.map((s) => {
                      const tunelesSector = tuneles.filter((t) => t.sectorId === s.id);
                      const actual = zonas[tunelesSector[0]?.id] || "";
                      return (
                        <div key={s.id} style={styles.tunelRow}>
                          <span style={styles.tunelNombre}>{s.nombre}</span>
                          <select
                            value={actual}
                            onChange={(e) => e.target.value && asignarZonaSector(s.id, e.target.value)}
                            disabled={ocupado === s.id}
                            style={{ ...styles.select, width: "auto", minWidth: "150px", fontSize: "12px", padding: "6px 8px" }}
                          >
                            <option value="">Sin asignar</option>
                            {carretilleros.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Resumen de personal */}
                <div style={styles.resumenRow}>
                  <div style={{ ...styles.chip, borderColor: "rgba(127,191,90,0.3)" }}>
                    <div style={{ ...styles.chipCount, color: "#7fbf5a" }}>{cortadores.length}</div>
                    <div style={styles.chipLabel}>Cortadores</div>
                  </div>
                  <div style={{ ...styles.chip, borderColor: "rgba(90,155,212,0.3)" }}>
                    <div style={{ ...styles.chipCount, color: "#5a9bd4" }}>{carretilleros.length}</div>
                    <div style={styles.chipLabel}>Carretilleros</div>
                  </div>
                  <div style={{ ...styles.chip, borderColor: "rgba(232,162,61,0.3)" }}>
                    <div style={{ ...styles.chipCount, color: "#e8a23d" }}>{tuneles.length}</div>
                    <div style={styles.chipLabel}>Túneles</div>
                  </div>
                </div>

                {cortadores.length === 0 && (
                  <div style={styles.avisoRestriccion}>
                    No hay cortadores con asistencia registrada hoy. Pasa primero
                    lista en el módulo de Asistencia; sin asistencia el sistema no
                    permite registrarles cubetas.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ======================= PESTAÑA CORTE ======================= */}
        {pestana === "corte" && puedeCapturar && (
          <>
            {!dia && (
              <div style={styles.avisoRestriccion}>
                El día no está abierto. Pide al encargado de rancho que lo abra
                antes de empezar a recibir cubetas.
              </div>
            )}

            {dia && dia.estado === "cerrado" && (
              <div style={styles.avisoRestriccion}>
                El día ya está cerrado. Si falta registrar algo, el encargado
                debe reabrirlo.
              </div>
            )}

            {dia && dia.estado !== "cerrado" && (
              <>
                {/* Carretillero y viaje */}
                <div style={styles.card}>
                  <label style={styles.label}>CARRETILLERO</label>
                  <select
                    value={carretilleroId || ""}
                    onChange={(e) => setCarretilleroId(e.target.value)}
                    style={styles.select}
                    disabled={usuarioActual?.rol === "carretillero"}
                  >
                    <option value="">Selecciona…</option>
                    {carretilleros.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                    ))}
                  </select>

                  {carretilleros.length === 0 && (
                    <p style={{ ...styles.ayuda, color: "#e8a23d" }}>
                      No hay carretilleros con asistencia hoy. Si en este rancho
                      el cortador entrega directo al empaque, captura desde la
                      pestaña Empaque.
                    </p>
                  )}

                  {carretilleroId && !viaje && (
                    <button onClick={abrirViaje} disabled={ocupado === "viaje"} style={{ ...styles.guardarBtn, marginTop: "14px" }}>
                      {ocupado === "viaje" ? "Abriendo…" : "Abrir viaje"}
                    </button>
                  )}

                  {viaje && (
                    <div style={styles.viajeBox}>
                      <div>
                        <div style={styles.viajeNumero}>Viaje {viaje.numero}</div>
                        <div style={styles.chipLabel}>
                          {totalViaje.exp} exportación · {totalViaje.pro} proceso
                        </div>
                      </div>
                      <div style={styles.viajeTotal}>{totalViaje.total}</div>
                    </div>
                  )}
                </div>

                {/* Lista de cortadores */}
                {viaje && (
                  <>
                    <div style={styles.lista}>
                      {misCortadores.map((c) => {
                        const conteo = conteoPorCortador[c.id] || { exportacion: 0, proceso: 0 };
                        const susTuneles = asignaciones[c.id] || [];
                        const tunelActivo = tunelElegido[c.id] || susTuneles[0] || "";
                        const tunelInfo = tuneles.find((t) => t.id === tunelActivo);

                        return (
                          <div key={c.id} style={styles.cortadorCard}>
                            <div style={styles.cortadorHeader}>
                              <div style={styles.cortadorInfo}>
                                <div style={{ ...styles.avatar, background: "rgba(127,191,90,0.15)", color: "#7fbf5a" }}>
                                  {iniciales(c.nombre_completo)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={styles.empleadoNombre}>{c.nombre_completo}</div>
                                  <div style={styles.empleadoTipo}>
                                    {tunelInfo
                                      ? `${tunelInfo.sector} · Túnel ${tunelInfo.numero}`
                                      : "Sin túnel asignado"}
                                  </div>
                                </div>
                              </div>
                              <div style={styles.cortadorConteo}>
                                <span style={{ color: "#7fbf5a" }}>{conteo.exportacion}</span>
                                <span style={{ color: "rgba(200,230,180,0.3)" }}> / </span>
                                <span style={{ color: "#e8a23d" }}>{conteo.proceso}</span>
                              </div>
                            </div>

                            {/* Selector de túnel: necesario cuando trabaja en varios */}
                            {(susTuneles.length > 1 || susTuneles.length === 0) && (
                              <select
                                value={tunelActivo}
                                onChange={(e) => setTunelElegido((p) => ({ ...p, [c.id]: e.target.value }))}
                                style={{ ...styles.select, fontSize: "12px", padding: "7px 10px", marginBottom: "8px" }}
                              >
                                <option value="">¿En qué túnel está cortando?</option>
                                {tuneles.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.sector} · Túnel {t.numero}
                                  </option>
                                ))}
                              </select>
                            )}

                            <div style={styles.botonesCubeta}>
                              <button
                                onClick={() => registrarCubeta(c.id, "cubeta_exportacion")}
                                disabled={ocupado === c.id + "cubeta_exportacion"}
                                style={{ ...styles.btnCubeta, borderColor: "#7fbf5a", color: "#7fbf5a" }}
                              >
                                + Exportación
                              </button>
                              <button
                                onClick={() => registrarCubeta(c.id, "cubeta_proceso")}
                                disabled={ocupado === c.id + "cubeta_proceso"}
                                style={{ ...styles.btnCubeta, borderColor: "#e8a23d", color: "#e8a23d" }}
                              >
                                + Proceso
                              </button>
                              <button
                                onClick={() => deshacerUltima(c.id, "cubeta_exportacion")}
                                disabled={ocupado === "undo" + c.id || conteo.exportacion + conteo.proceso === 0}
                                style={styles.btnDeshacer}
                                title="Deshacer la última cubeta de exportación"
                              >
                                ↶
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {misCortadores.length === 0 && (
                      <p style={styles.empty}>
                        No hay cortadores en tu zona con asistencia de hoy.
                      </p>
                    )}

                    <button
                      onClick={cerrarViaje}
                      disabled={ocupado === "cerrar" || totalViaje.total === 0}
                      style={{
                        ...styles.guardarBtn,
                        opacity: totalViaje.total === 0 ? 0.4 : 1,
                      }}
                    >
                      {ocupado === "cerrar"
                        ? "Cerrando…"
                        : `Cerrar viaje y llevar al empaque (${totalViaje.total} cubetas)`}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {cargando && <p style={styles.empty}>Cargando…</p>}
      </div>
    </div>
  );
}

// ============ Estilos (mismo lenguaje visual que Asistencia) ============
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#e8f5e0",
    padding: "20px 16px 40px",
    boxSizing: "border-box",
  },
  container: { maxWidth: "640px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.12em", color: "#7fbf5a", marginBottom: "4px", fontWeight: "600" },
  title: { fontSize: "26px", fontWeight: "800", margin: 0, color: "#ffffff" },
  headerIcon: { fontSize: "36px" },
  version: { fontSize: "10px", color: "rgba(127,191,90,0.5)", textAlign: "right", marginTop: "2px" },
  usuarioTag: { fontSize: "11px", color: "rgba(200,230,180,0.45)", marginTop: "4px" },
  logoutLink: {
    background: "none",
    border: "none",
    padding: 0,
    color: "#e8a23d",
    fontSize: "11px",
    textDecoration: "underline",
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: "6px",
  },
  selectorsCard: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(127,191,90,0.15)",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    gap: "12px",
    marginBottom: "12px",
  },
  selectorGroup: { flex: 1 },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: {
    width: "100%",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(127,191,90,0.25)",
    borderRadius: "10px",
    padding: "10px 12px",
    color: "#e8f5e0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  fechaTexto: { fontSize: "13px", color: "rgba(200,230,180,0.5)", textTransform: "capitalize", marginBottom: "16px", paddingLeft: "4px" },
  tabs: { display: "flex", gap: "8px", marginBottom: "16px" },
  tab: {
    flex: 1, padding: "10px", borderRadius: "10px",
    border: "1.5px solid rgba(127,191,90,0.2)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(200,230,180,0.5)",
    fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit",
  },
  tabActiva: {
    border: "1.5px solid #7fbf5a",
    background: "rgba(127,191,90,0.15)",
    color: "#7fbf5a",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(127,191,90,0.15)",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "16px",
  },
  cardTitulo: { fontSize: "14px", fontWeight: "700", color: "#ffffff", marginBottom: "6px" },
  ayuda: { fontSize: "12px", lineHeight: "1.5", color: "rgba(200,230,180,0.5)", marginTop: 0, marginBottom: "12px" },
  sectorTitulo: { fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", fontWeight: "700", marginBottom: "6px" },
  tunelRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: "10px", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  tunelNombre: { fontSize: "13px", color: "#e8f5e0" },
  tunelMetros: { fontSize: "11px", color: "rgba(200,230,180,0.4)" },
  resumenRow: { display: "flex", gap: "8px", marginBottom: "20px" },
  chip: { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: "12px", padding: "10px 12px", textAlign: "center" },
  chipCount: { fontSize: "20px", fontWeight: "800" },
  chipLabel: { fontSize: "10px", color: "rgba(200,230,180,0.5)", marginTop: "2px" },
  lista: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" },
  cortadorCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "12px",
  },
  cortadorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "10px" },
  cortadorInfo: { display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 },
  cortadorConteo: { fontSize: "18px", fontWeight: "800", flexShrink: 0 },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 },
  empleadoNombre: { fontSize: "14px", fontWeight: "600", color: "#e8f5e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empleadoTipo: { fontSize: "11px", marginTop: "2px", color: "rgba(200,230,180,0.45)" },
  botonesCubeta: { display: "flex", gap: "8px" },
  btnCubeta: {
    flex: 1, padding: "14px 8px", borderRadius: "12px",
    border: "1.5px solid", background: "rgba(255,255,255,0.03)",
    fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit",
  },
  btnDeshacer: {
    width: "48px", padding: "14px 0", borderRadius: "12px",
    border: "1.5px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(200,230,180,0.6)", fontSize: "16px", cursor: "pointer", fontFamily: "inherit",
  },
  viajeBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(127,191,90,0.12)", border: "1px solid rgba(127,191,90,0.3)",
    borderRadius: "12px", padding: "12px 14px", marginTop: "14px",
  },
  viajeNumero: { fontSize: "14px", fontWeight: "700", color: "#7fbf5a" },
  viajeTotal: { fontSize: "32px", fontWeight: "800", color: "#ffffff" },
  guardarBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #5aab2e, #3d8c1a)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "16px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 24px rgba(90,171,46,0.3)",
    fontFamily: "inherit",
  },
  error: {
    background: "rgba(224,92,92,0.12)", border: "1px solid rgba(224,92,92,0.3)",
    borderRadius: "12px", padding: "12px 14px", fontSize: "12px",
    lineHeight: "1.5", color: "#e05c5c", marginBottom: "14px",
  },
  aviso: {
    background: "rgba(127,191,90,0.12)", border: "1px solid rgba(127,191,90,0.3)",
    borderRadius: "12px", padding: "12px 14px", fontSize: "12px",
    lineHeight: "1.5", color: "#7fbf5a", marginBottom: "14px",
  },
  avisoRestriccion: {
    background: "rgba(232,162,61,0.12)", border: "1px solid rgba(232,162,61,0.3)",
    borderRadius: "12px", padding: "12px 14px", fontSize: "12px",
    lineHeight: "1.5", color: "#e8a23d", marginBottom: "16px",
  },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
};
