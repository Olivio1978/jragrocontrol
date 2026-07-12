// ============ JR AGROCONTROL — Labores.jsx v0.2.5 ============
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";

// ============ DATOS REALES DE RANCHOS ============
function generarTuneles(sectorId, numTuneles, surcosPorTunel, tunelesEspeciales = []) {
  const tuneles = [];
  for (let t = 1; t <= numTuneles; t++) {
    const especial = tunelesEspeciales.find(e => e.tunel === t);
    const numSurcos = especial ? especial.surcos : surcosPorTunel;
    const surcos = Array.from({ length: numSurcos }, (_, i) => ({
      id: `${sectorId}-T${t}-S${i + 1}`, numero: i + 1,
    }));
    tuneles.push({ id: `${sectorId}-T${t}`, sectorId, numero: `T-${t}`, surcos });
  }
  return tuneles;
}

const SECTORES = [
  { id: "C-S1", ranchoId: "45345e9f-0d4d-4a2c-b534-1eb22876906c", nombre: "Sector 1", totalSurcos: 26, totalTuneles: 9 },
  { id: "C-S2", ranchoId: "45345e9f-0d4d-4a2c-b534-1eb22876906c", nombre: "Sector 2", totalSurcos: 26, totalTuneles: 9 },
  { id: "E-S5", ranchoId: "494562ae-c957-477b-8fb0-3110b65b6a35", nombre: "Sector 5", totalSurcos: 41, totalTuneles: 14 },
  { id: "E-S6", ranchoId: "494562ae-c957-477b-8fb0-3110b65b6a35", nombre: "Sector 6", totalSurcos: 42, totalTuneles: 14 },
  { id: "V-S1", ranchoId: "98e99401-c97f-470e-b34f-88d355a78764", nombre: "Sector 1", totalSurcos: 39, totalTuneles: 13 },
  { id: "V-S4", ranchoId: "98e99401-c97f-470e-b34f-88d355a78764", nombre: "Sector 4", totalSurcos: 39, totalTuneles: 13 },
];

const TUNELES = [
  ...generarTuneles("C-S1", 9, 3, [{ tunel: 9, surcos: 2 }]),
  ...generarTuneles("C-S2", 9, 3, [{ tunel: 9, surcos: 2 }]),
  ...generarTuneles("E-S5", 14, 3, [{ tunel: 14, surcos: 2 }]),
  ...generarTuneles("E-S6", 14, 3),
  ...generarTuneles("V-S1", 13, 3),
  ...generarTuneles("V-S4", 13, 3),
];

const UNIDADES_AVANCE = [
  { value: "surcos",   label: "Surcos" },
  { value: "tuneles",  label: "Túneles" },
  { value: "sectores", label: "Sectores" },
  { value: "plantas",  label: "Plantas" },
  { value: "metros",   label: "Metros" },
];

const ESTATUS = {
  asignado:   { label: "Asignado",   color: "#5a9bd4", icono: "📋" },
  en_proceso: { label: "En proceso", color: "#e8a23d", icono: "⚙️" },
  completado: { label: "Completado", color: "#7fbf5a", icono: "✅" },
  validado:   { label: "Validado",   color: "#c468d4", icono: "🔍" },
};

// ============ UTILIDADES ============
function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
}

function formatFecha(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function labelUnidad(unidad) {
  const mapa = {
    surcos: "Surcos realizados", tuneles: "Túneles realizados",
    sectores: "Sectores realizados", plantas: "Plantas trabajadas", metros: "Metros recorridos",
  };
  return mapa[unidad] || "Unidades realizadas";
}

function totalDisponible(unidadAvance, sectorId, tunelId, sectoresRancho) {
  if (unidadAvance === "surcos") {
    const tunel = TUNELES.find(t => t.id === tunelId);
    return tunel ? tunel.surcos.length : null;
  }
  if (unidadAvance === "tuneles") {
    const sector = SECTORES.find(s => s.id === sectorId);
    return sector ? sector.totalTuneles : null;
  }
  if (unidadAvance === "sectores") return sectoresRancho.length;
  return null;
}

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
        <div style={S.eyebrow}>JR AGROCONTROL · LABORES</div>
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

const VISTAS = { registro: "registro", avance: "avance", catalogo: "catalogo" };
const FORM_ASIGNACION_INICIAL = { empleadoId: "", laborId: "", sectorId: "", tunelId: "", notasAsignacion: "" };
const FORM_RESULTADO_INICIAL  = { cantidad: "", tareaCompleta: false, fraccionTarea: "1", notasResultado: "" };
const FORM_LABOR_INICIAL      = { nombre: "", unidadPago: "dia", icono: "🌾", color: "#7fbf5a", descripcion: "", rendimientoEsperado: "", unidadAvance: "surcos" };
const FORM_TAREA_INICIAL      = { nombre: "", equivalencia: "", unidadEquivalencia: "surcos", valorTarea: "" };

// ============ COMPONENTE PRINCIPAL ============
export default function Labores() {
  // ---- Sesión ----
  const [sesion, setSesion]           = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);

  // ---- Estado ----
  const [vista, setVista]       = useState(VISTAS.registro);
  const [ranchos, setRanchos]   = useState([]);
  const [ranchoId, setRanchoId] = useState(null);
  const [fecha, setFecha]       = useState(todayISO());

  // Datos desde Supabase
  const [empleados, setEmpleados]             = useState([]);
  const [catalogoLabores, setCatalogoLabores] = useState([]);
  const [catalogoTareas, setCatalogoTareas]   = useState([]);
  const [asignaciones, setAsignaciones]       = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [error, setError]                     = useState(null);
  const [guardando, setGuardando]             = useState(false);

  // Modales
  const [showAsignacion, setShowAsignacion]   = useState(false);
  const [showResultado, setShowResultado]     = useState(false);
  const [asignacionSelec, setAsignacionSelec] = useState(null);
  const [formAsignacion, setFormAsignacion]   = useState(FORM_ASIGNACION_INICIAL);
  const [formResultado, setFormResultado]     = useState(FORM_RESULTADO_INICIAL);

  // Catálogo modales
  const [showLaborForm, setShowLaborForm]     = useState(false);
  const [editandoLaborId, setEditandoLaborId] = useState(null);
  const [formLabor, setFormLabor]             = useState(FORM_LABOR_INICIAL);
  const [laborSelec, setLaborSelec]           = useState(null);
  const [editandoTareaId, setEditandoTareaId] = useState(null);
  const [formTarea, setFormTarea]             = useState(FORM_TAREA_INICIAL);

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- 1b. Limpiar estado al cambiar usuario ----
  useEffect(() => {
    setUsuarioActual(null);
    setRanchoId(null);
    setRanchos([]);
    setEmpleados([]);
    setAsignaciones([]);
    setError(null);
    setFecha(todayISO());
  }, [sesion?.user?.id]);

  // ---- 2. Perfil del usuario ----
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
      });
  }, [sesion]);

  // ---- 3. Ranchos disponibles ----
  useEffect(() => {
    if (!usuarioActual) return;
    supabase
      .from("ranchos")
      .select("id, nombre, cultivo")
      .eq("activo", true)
      .then(({ data }) => {
        setRanchos(data || []);
        setRanchoId(prev => prev || data?.[0]?.id || null);
      });
  }, [usuarioActual]);

  // ---- 4. Catálogo de labores y tareas ----
  useEffect(() => {
    if (!usuarioActual) return;
    supabase
      .from("labores_catalogo")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data, error }) => {
        if (error) { setError(error.message); return; }
        setCatalogoLabores((data || []).map(l => ({
          id: l.id, nombre: l.nombre, descripcion: l.descripcion,
          unidadPago: l.unidad_pago, unidadAvance: l.unidad_avance,
          rendimientoEsperado: l.rendimiento_esperado, icono: l.icono, color: l.color,
        })));
      });

    supabase
      .from("labores_tareas")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        setCatalogoTareas((data || []).map(t => ({
          id: t.id, laborId: t.labor_id, nombre: t.nombre,
          equivalencia: t.equivalencia, unidadEquivalencia: t.unidad_equivalencia,
          valorTarea: t.valor_tarea,
        })));
      });
  }, [usuarioActual]);

  // ---- 5. Empleados del rancho ----
  useEffect(() => {
    if (!ranchoId) return;
    supabase
      .from("empleados")
      .select("id, personas(nombres, apellidos)")
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .then(({ data }) => {
        setEmpleados((data || []).map(e => ({
          id: e.id,
          nombre: e.personas
            ? `${e.personas.nombres || ""} ${e.personas.apellidos || ""}`.trim()
            : "Sin nombre",
        })));
      });
  }, [ranchoId]);

  // ---- 6. Asignaciones del rancho y fecha ----
  const cargarAsignaciones = useCallback(async () => {
    if (!ranchoId || !fecha) return;
    setCargando(true);
    const { data, error } = await supabase
      .from("labores_asignaciones")
      .select("*, labores_resultados(*)")
      .eq("rancho_id", ranchoId)
      .eq("fecha", fecha)
      .order("creado_en", { ascending: false });
    if (error) { setError(error.message); }
    else { setAsignaciones(data || []); }
    setCargando(false);
  }, [ranchoId, fecha]);

  useEffect(() => { cargarAsignaciones(); }, [cargarAsignaciones]);

  // ============ DERIVADOS ============
  const ranchoActual    = ranchos.find(r => r.id === ranchoId);
  const sectoresRancho  = useMemo(() => SECTORES.filter(s => s.ranchoId === ranchoId), [ranchoId]);
  const tunelesSectorAsig = useMemo(() => TUNELES.filter(t => t.sectorId === formAsignacion.sectorId), [formAsignacion.sectorId]);
  const laborAsignacion   = useMemo(() => catalogoLabores.find(l => l.id === formAsignacion.laborId), [formAsignacion.laborId, catalogoLabores]);

  const asignacionesEnriquecidas = useMemo(() => {
    return asignaciones.map(a => {
      const labor  = catalogoLabores.find(l => l.id === a.labor_id);
      const sector = SECTORES.find(s => s.id === a.sector_id);
      const tunel  = TUNELES.find(t => t.id === a.tunel_id);
      const emp    = empleados.find(e => e.id === a.empleado_id);
      return {
        ...a,
        laborNombre:         labor?.nombre,
        laborColor:          labor?.color || "#7fbf5a",
        laborIcono:          labor?.icono || "🌾",
        laborUnidad:         labor?.unidadPago,
        laborUnidadAvance:   labor?.unidadAvance,
        rendimientoEsperado: labor?.rendimientoEsperado,
        sectorNombre:        sector?.nombre,
        tunelNumero:         tunel?.numero,
        empleadoNombre:      emp?.nombre,
        resultado:           a.labores_resultados?.[0] || null,
      };
    });
  }, [asignaciones, catalogoLabores, empleados]);

  // ============ HANDLERS ASIGNACIÓN ============
  const guardarAsignacion = async () => {
    if (!formAsignacion.empleadoId || !formAsignacion.laborId || !formAsignacion.sectorId) return;
    const labor = catalogoLabores.find(l => l.id === formAsignacion.laborId);
    if (labor?.unidadAvance === "surcos" && !formAsignacion.tunelId) return;
    const total = totalDisponible(labor?.unidadAvance, formAsignacion.sectorId, formAsignacion.tunelId, sectoresRancho);
    setGuardando(true);
    const { error } = await supabase.from("labores_asignaciones").insert({
      rancho_id:        ranchoId,
      empleado_id:      formAsignacion.empleadoId,
      labor_id:         formAsignacion.laborId,
      fecha,
      sector_id:        formAsignacion.sectorId,
      tunel_id:         formAsignacion.tunelId || null,
      total_unidades:   total,
      estatus:          "asignado",
      notas_asignacion: formAsignacion.notasAsignacion || null,
    });
    if (error) setError(error.message);
    else {
      setShowAsignacion(false);
      setFormAsignacion(FORM_ASIGNACION_INICIAL);
      await cargarAsignaciones();
    }
    setGuardando(false);
  };

  // ============ HANDLERS RESULTADO ============
  const abrirResultado = (asig) => {
    setAsignacionSelec(asig);
    setFormResultado({
      cantidad:       asig.resultado?.cantidad || "",
      tareaCompleta:  asig.resultado?.tarea_completa || false,
      fraccionTarea:  asig.resultado?.fraccion_tarea || "1",
      notasResultado: asig.resultado?.notas_resultado || "",
    });
    setShowResultado(true);
  };

  const guardarResultado = async () => {
    if (!asignacionSelec) return;
    setGuardando(true);
    const payload = {
      cantidad:        parseFloat(formResultado.cantidad) || null,
      tarea_completa:  formResultado.tareaCompleta,
      fraccion_tarea:  parseFloat(formResultado.fraccionTarea) || 1,
      notas_resultado: formResultado.notasResultado || null,
    };
    if (asignacionSelec.resultado) {
      await supabase.from("labores_resultados").update({ ...payload, actualizado_en: new Date().toISOString() })
        .eq("id", asignacionSelec.resultado.id);
    } else {
      await supabase.from("labores_resultados").insert({ ...payload, asignacion_id: asignacionSelec.id });
    }
    await supabase.from("labores_asignaciones")
      .update({ estatus: "completado", actualizado_en: new Date().toISOString() })
      .eq("id", asignacionSelec.id);
    setShowResultado(false);
    setAsignacionSelec(null);
    await cargarAsignaciones();
    setGuardando(false);
  };

  const cambiarEstatus = async (asig, nuevoEstatus) => {
    await supabase.from("labores_asignaciones")
      .update({ estatus: nuevoEstatus, actualizado_en: new Date().toISOString() })
      .eq("id", asig.id);
    await cargarAsignaciones();
  };

  const eliminarAsignacion = async (asig) => {
    await supabase.from("labores_asignaciones").delete().eq("id", asig.id);
    await cargarAsignaciones();
  };

  // ============ HANDLERS CATÁLOGO ============
  const guardarLabor = async () => {
    if (!formLabor.nombre) return;
    setGuardando(true);
    const payload = {
      nombre: formLabor.nombre, descripcion: formLabor.descripcion || null,
      unidad_pago: formLabor.unidadPago, unidad_avance: formLabor.unidadAvance,
      rendimiento_esperado: parseFloat(formLabor.rendimientoEsperado) || null,
      icono: formLabor.icono, color: formLabor.color,
    };
    if (editandoLaborId) {
      await supabase.from("labores_catalogo").update(payload).eq("id", editandoLaborId);
    } else {
      await supabase.from("labores_catalogo").insert(payload);
    }
    setShowLaborForm(false);
    setEditandoLaborId(null);
    setFormLabor(FORM_LABOR_INICIAL);
    // Recargar catálogo
    const { data } = await supabase.from("labores_catalogo").select("*").eq("activo", true).order("nombre");
    setCatalogoLabores((data || []).map(l => ({
      id: l.id, nombre: l.nombre, descripcion: l.descripcion,
      unidadPago: l.unidad_pago, unidadAvance: l.unidad_avance,
      rendimientoEsperado: l.rendimiento_esperado, icono: l.icono, color: l.color,
    })));
    setGuardando(false);
  };

  const guardarTarea = async () => {
    if (!laborSelec || !formTarea.nombre) return;
    setGuardando(true);
    const payload = {
      labor_id: laborSelec.id, nombre: formTarea.nombre,
      equivalencia: parseFloat(formTarea.equivalencia) || 0,
      unidad_equivalencia: formTarea.unidadEquivalencia,
      valor_tarea: parseFloat(formTarea.valorTarea) || 0,
    };
    if (editandoTareaId) {
      await supabase.from("labores_tareas").update(payload).eq("id", editandoTareaId);
    } else {
      await supabase.from("labores_tareas").insert(payload);
    }
    setLaborSelec(null);
    setEditandoTareaId(null);
    setFormTarea(FORM_TAREA_INICIAL);
    const { data } = await supabase.from("labores_tareas").select("*").eq("activo", true).order("nombre");
    setCatalogoTareas((data || []).map(t => ({
      id: t.id, laborId: t.labor_id, nombre: t.nombre,
      equivalencia: t.equivalencia, unidadEquivalencia: t.unidad_equivalencia, valorTarea: t.valor_tarea,
    })));
    setGuardando(false);
  };

  // ============ AVANCE MULTI-LABOR ============
  const avancePorSector = useMemo(() => {
    const completados = asignacionesEnriquecidas.filter(r =>
      r.estatus === "completado" || r.estatus === "validado"
    );
    return sectoresRancho.map(sector => {
      const tunelesSec = TUNELES.filter(t => t.sectorId === sector.id);
      const tuneles = tunelesSec.map(tunel => {
        const laboresEnTunel = completados.filter(r => r.tunel_id === tunel.id && r.laborUnidadAvance === "surcos");
        const porLabor = {};
        laboresEnTunel.forEach(r => {
          if (!porLabor[r.labor_id]) {
            porLabor[r.labor_id] = { laborNombre: r.laborNombre, laborColor: r.laborColor, laborIcono: r.laborIcono, cantidad: 0 };
          }
          porLabor[r.labor_id].cantidad += parseFloat(r.resultado?.cantidad) || 0;
        });
        return {
          ...tunel,
          laboresAvance: Object.values(porLabor).map(l => ({
            ...l,
            pct: Math.min(100, Math.round((l.cantidad / tunel.surcos.length) * 100)),
            total: tunel.surcos.length,
          })),
        };
      });

      const porTunel = completados.filter(r => r.sector_id === sector.id && r.laborUnidadAvance === "tuneles");
      const porLaborTunel = {};
      porTunel.forEach(r => {
        if (!porLaborTunel[r.labor_id]) {
          porLaborTunel[r.labor_id] = { laborNombre: r.laborNombre, laborColor: r.laborColor, laborIcono: r.laborIcono, cantidad: 0 };
        }
        porLaborTunel[r.labor_id].cantidad += parseFloat(r.resultado?.cantidad) || 0;
      });
      const laboresAvanceTunel = Object.values(porLaborTunel).map(l => ({
        ...l,
        pct: Math.min(100, Math.round((l.cantidad / sector.totalTuneles) * 100)),
        total: sector.totalTuneles,
      }));

      return { ...sector, tuneles, laboresAvanceTunel };
    });
  }, [asignacionesEnriquecidas, sectoresRancho]);

  // ============ GUARDS DE SESIÓN ============
  if (sesion === undefined) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>🌾</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (!sesion) return <Login />;

  if (cargando && asignaciones.length === 0) return (
    <div style={S.page}>
      <div style={{ ...S.container, textAlign: "center", paddingTop: "80px" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>🌾</div>
        <div style={{ color: "rgba(200,230,180,0.6)" }}>Cargando módulo Labores...</div>
      </div>
    </div>
  );

  // ============ RENDER ============
  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · LABORES</div>
            <h1 style={S.title}>Control de Labores</h1>
            <div style={S.usuarioTag}>
              {usuarioActual?.nombre} · {usuarioActual?.rol === "admin" ? "Administrador" : "Encargado"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>🌾</div>
            <div style={S.version}>v0.2.5</div>
            <button onClick={() => supabase.auth.signOut()} style={S.btnLogout}>Salir</button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={S.errorBanner}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={S.btnCerrarError}>✕</button>
          </div>
        )}

        {/* Tabs */}
        <div style={S.navTabs}>
          {[
            { key: VISTAS.registro, label: "📋 Registro" },
            { key: VISTAS.avance,   label: "📊 Avance" },
            { key: VISTAS.catalogo, label: "📚 Catálogo" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setVista(tab.key)} style={{
              ...S.navTab,
              borderColor: vista === tab.key ? "#7fbf5a" : "rgba(127,191,90,0.2)",
              background:  vista === tab.key ? "rgba(127,191,90,0.15)" : "transparent",
              color:       vista === tab.key ? "#7fbf5a" : "rgba(200,230,180,0.5)",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Selectores rancho + fecha */}
        <div style={S.selectorsCard}>
          <div style={S.selectorGroup}>
            <label style={S.label}>RANCHO</label>
            <select value={ranchoId || ""} onChange={e => setRanchoId(e.target.value)} style={S.select}>
              {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div style={S.selectorGroup}>
            <label style={S.label}>FECHA</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={S.select} />
          </div>
        </div>
        <div style={S.fechaTexto}>{formatFecha(fecha)}</div>

        {/* ======== VISTA REGISTRO ======== */}
        {vista === VISTAS.registro && (
          <>
            <div style={S.resumenRow}>
              {[
                { label: "Asignadas",   valor: asignacionesEnriquecidas.length },
                { label: "En proceso",  valor: asignacionesEnriquecidas.filter(r => r.estatus === "en_proceso").length },
                { label: "Completadas", valor: asignacionesEnriquecidas.filter(r => r.estatus === "completado" || r.estatus === "validado").length },
                { label: "Validadas",   valor: asignacionesEnriquecidas.filter(r => r.estatus === "validado").length },
              ].map(c => (
                <div key={c.label} style={S.chip}>
                  <div style={S.chipCount}>{c.valor}</div>
                  <div style={S.chipLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            <button onClick={() => { setFormAsignacion(FORM_ASIGNACION_INICIAL); setShowAsignacion(true); }} style={S.btnPrimary}>
              + Asignar labor
            </button>

            {asignacionesEnriquecidas.length === 0 ? (
              <div style={S.empty}>Sin labores asignadas para esta fecha</div>
            ) : (
              <div style={S.lista}>
                {asignacionesEnriquecidas.map(reg => {
                  const est = ESTATUS[reg.estatus] || ESTATUS.asignado;
                  return (
                    <div key={reg.id} style={S.card}>
                      <div style={S.cardTop}>
                        <span style={{ ...S.laborBadge, background: reg.laborColor + "22", color: reg.laborColor }}>
                          {reg.laborIcono} {reg.laborNombre}
                        </span>
                        <span style={{ ...S.estatusBadge, background: est.color + "22", color: est.color }}>
                          {est.icono} {est.label}
                        </span>
                      </div>
                      <div style={S.cardBody}>
                        <div style={S.cardRow}><span style={S.cardLabel}>Empleado</span><span>{reg.empleadoNombre}</span></div>
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Ubicación</span>
                          <span>{reg.sectorNombre}{reg.tunelNumero ? ` · ${reg.tunelNumero}` : ""}</span>
                        </div>
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Modalidad</span>
                          <span>{reg.laborUnidad === "tarea" ? "Por tarea" : "Por día"} · {reg.laborUnidadAvance}</span>
                        </div>
                        {reg.rendimientoEsperado && (
                          <div style={S.cardRow}>
                            <span style={S.cardLabel}>Rend. esperado</span>
                            <span style={{ color: "#7fbf5a" }}>{reg.rendimientoEsperado} {reg.laborUnidadAvance}/día</span>
                          </div>
                        )}
                        {reg.notas_asignacion && (
                          <div style={S.cardRow}>
                            <span style={S.cardLabel}>Instrucciones</span>
                            <span style={{ fontSize: "12px" }}>{reg.notas_asignacion}</span>
                          </div>
                        )}
                        {(reg.estatus === "completado" || reg.estatus === "validado") && reg.resultado?.cantidad && (
                          <div style={S.resultadoBox}>
                            <div style={S.resultadoTitulo}>📊 Resultado</div>
                            <div style={S.cardRow}>
                              <span style={S.cardLabel}>{labelUnidad(reg.laborUnidadAvance)}</span>
                              <span style={{ color: "#7fbf5a", fontWeight: "700" }}>
                                {reg.resultado.cantidad}{reg.total_unidades ? ` / ${reg.total_unidades}` : ""}
                              </span>
                            </div>
                            {reg.laborUnidad === "tarea" && (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>Tareas</span>
                                <span style={{ color: reg.resultado.tarea_completa ? "#7fbf5a" : "#e8a23d" }}>
                                  {reg.resultado.tarea_completa ? `✅ Completa (${reg.resultado.fraccion_tarea}x)` : `⏳ Fracción: ${reg.resultado.fraccion_tarea}x`}
                                </span>
                              </div>
                            )}
                            {reg.rendimientoEsperado && (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>vs. esperado</span>
                                <span style={{ color: parseFloat(reg.resultado.cantidad) >= reg.rendimientoEsperado ? "#7fbf5a" : "#e05c5c", fontWeight: "700" }}>
                                  {parseFloat(reg.resultado.cantidad) >= reg.rendimientoEsperado ? "✅ Cumplido" : "⚠️ Por debajo"}
                                </span>
                              </div>
                            )}
                            {reg.resultado.notas_resultado && (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>Notas</span>
                                <span style={{ fontSize: "12px" }}>{reg.resultado.notas_resultado}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ ...S.cardAcciones, marginTop: "12px", flexWrap: "wrap" }}>
                        {reg.estatus === "asignado" && (
                          <>
                            <button onClick={() => cambiarEstatus(reg, "en_proceso")} style={S.btnAccion}>⚙️ Iniciar</button>
                            <button onClick={() => abrirResultado(reg)} style={S.btnAccion}>📝 Resultado</button>
                          </>
                        )}
                        {reg.estatus === "en_proceso" && (
                          <button onClick={() => abrirResultado(reg)} style={S.btnAccion}>📝 Resultado</button>
                        )}
                        {(reg.estatus === "completado" || reg.estatus === "validado") && (
                          <>
                            <button onClick={() => abrirResultado(reg)} style={S.btnAccion}>✏️ Editar</button>
                            {reg.estatus === "completado" && (
                              <button onClick={() => cambiarEstatus(reg, "validado")}
                                style={{ ...S.btnAccion, color: "#c468d4", borderColor: "rgba(196,104,212,0.3)" }}>🔍 Validar</button>
                            )}
                          </>
                        )}
                        <button onClick={() => eliminarAsignacion(reg)}
                          style={{ ...S.btnAccion, color: "#e05c5c", borderColor: "rgba(224,92,92,0.2)" }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ======== VISTA AVANCE ======== */}
        {vista === VISTAS.avance && (
          <>
            <div style={S.avanceHeader}>
              <div style={S.seccionTitulo}>Avance por sector</div>
              <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)" }}>Solo labores completadas</div>
            </div>
            {avancePorSector.map(sector => (
              <div key={sector.id} style={S.sectorCard}>
                <div style={S.sectorNombre}>{sector.nombre}</div>
                {sector.laboresAvanceTunel.length > 0 && (
                  <div style={S.subSeccion}>
                    <div style={S.subSeccionTitulo}>📦 Por túnel</div>
                    {sector.laboresAvanceTunel.map((l, i) => (
                      <div key={i} style={S.laborAvanceRow}>
                        <div style={S.laborAvanceInfo}>
                          <span style={{ ...S.miniTag, background: l.laborColor + "22", color: l.laborColor }}>
                            {l.laborIcono} {l.laborNombre}
                          </span>
                          <span style={S.avanceDetalle}>{l.cantidad}/{l.total} túneles</span>
                        </div>
                        <div style={S.barraContainer}>
                          <div style={S.barraFondo}>
                            <div style={{ ...S.barraRelleno, width: `${l.pct}%`, background: l.laborColor }} />
                          </div>
                          <span style={S.barraLabel}>{l.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sector.tuneles.map(tunel => (
                  tunel.laboresAvance.length > 0 && (
                    <div key={tunel.id} style={S.tunelCard}>
                      <div style={S.tunelTitulo}>{tunel.numero} · {tunel.surcos.length} surcos</div>
                      {tunel.laboresAvance.map((l, i) => (
                        <div key={i} style={S.laborAvanceRow}>
                          <div style={S.laborAvanceInfo}>
                            <span style={{ ...S.miniTag, background: l.laborColor + "22", color: l.laborColor }}>
                              {l.laborIcono} {l.laborNombre}
                            </span>
                            <span style={S.avanceDetalle}>{l.cantidad}/{l.total} surcos</span>
                          </div>
                          <div style={S.barraContainer}>
                            <div style={S.barraFondo}>
                              <div style={{ ...S.barraRelleno, width: `${l.pct}%`, background: l.laborColor }} />
                            </div>
                            <span style={S.barraLabel}>{l.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ))}
                {sector.laboresAvanceTunel.length === 0 && sector.tuneles.every(t => t.laboresAvance.length === 0) && (
                  <div style={S.sinActividad}>Sin labores completadas en este sector</div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ======== VISTA CATÁLOGO ======== */}
        {vista === VISTAS.catalogo && (
          <>
            <div style={{ ...S.avanceHeader, marginBottom: "12px" }}>
              <div style={S.seccionTitulo}>Catálogo de labores</div>
              {usuarioActual?.rol === "admin" && (
                <button onClick={() => { setFormLabor(FORM_LABOR_INICIAL); setEditandoLaborId(null); setShowLaborForm(true); }}
                  style={S.btnSecundario}>+ Nueva</button>
              )}
            </div>
            <div style={S.lista}>
              {catalogoLabores.map(labor => {
                const tareas = catalogoTareas.filter(t => t.laborId === labor.id);
                return (
                  <div key={labor.id} style={S.card}>
                    <div style={S.cardTop}>
                      <span style={{ ...S.laborBadge, background: labor.color + "22", color: labor.color }}>
                        {labor.icono} {labor.nombre}
                      </span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)" }}>
                          {labor.unidadPago === "tarea" ? "Por tarea" : "Por día"}
                        </span>
                        {usuarioActual?.rol === "admin" && (
                          <button onClick={() => {
                            setFormLabor({ nombre: labor.nombre, unidadPago: labor.unidadPago, icono: labor.icono, color: labor.color, descripcion: labor.descripcion || "", rendimientoEsperado: labor.rendimientoEsperado || "", unidadAvance: labor.unidadAvance || "surcos" });
                            setEditandoLaborId(labor.id);
                            setShowLaborForm(true);
                          }} style={S.btnIconoEdit}>✏️</button>
                        )}
                      </div>
                    </div>
                    {labor.descripcion && (
                      <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)", marginBottom: "8px", lineHeight: "1.5" }}>
                        {labor.descripcion}
                      </div>
                    )}
                    <div style={{ ...S.cardRow, marginBottom: "6px" }}>
                      <span style={S.cardLabel}>Unidad de avance</span>
                      <span style={{ fontSize: "12px" }}>{labor.unidadAvance}</span>
                    </div>
                    {labor.rendimientoEsperado && (
                      <div style={{ ...S.cardRow, marginBottom: "8px" }}>
                        <span style={S.cardLabel}>Rendimiento estándar</span>
                        <span style={{ color: "#7fbf5a", fontSize: "12px", fontWeight: "700" }}>
                          {labor.rendimientoEsperado} {labor.unidadAvance}/día
                        </span>
                      </div>
                    )}
                    {labor.unidadPago === "tarea" && (
                      <div>
                        {tareas.map(t => (
                          <div key={t.id} style={S.tareaRow}>
                            <span style={{ fontSize: "12px" }}>{t.nombre} · {t.equivalencia} {t.unidadEquivalencia}</span>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", color: "#7fbf5a" }}>${t.valorTarea}</span>
                              {usuarioActual?.rol === "admin" && (
                                <button onClick={() => {
                                  setLaborSelec(labor); setEditandoTareaId(t.id);
                                  setFormTarea({ nombre: t.nombre, equivalencia: t.equivalencia, unidadEquivalencia: t.unidadEquivalencia, valorTarea: t.valorTarea });
                                }} style={S.btnIconoEdit}>✏️</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {usuarioActual?.rol === "admin" && (
                          <button onClick={() => { setLaborSelec(labor); setEditandoTareaId(null); setFormTarea(FORM_TAREA_INICIAL); }}
                            style={{ ...S.btnMiniLink, marginTop: "8px" }}>+ Agregar equivalencia</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ======== MODAL ASIGNACIÓN ======== */}
      {showAsignacion && (
        <div style={S.modalOverlay} onClick={() => setShowAsignacion(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowAsignacion(false)}>✕</button>
            <h2 style={S.modalTitulo}>Asignar labor</h2>
            <div style={S.formGroup}>
              <label style={S.label}>EMPLEADO</label>
              <select value={formAsignacion.empleadoId}
                onChange={e => setFormAsignacion({ ...formAsignacion, empleadoId: e.target.value })} style={S.select}>
                <option value="">Selecciona empleado...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>LABOR</label>
              <select value={formAsignacion.laborId}
                onChange={e => setFormAsignacion({ ...formAsignacion, laborId: e.target.value, tunelId: "" })} style={S.select}>
                <option value="">Selecciona labor...</option>
                {catalogoLabores.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.icono} {l.nombre} ({l.unidadPago === "tarea" ? "tarea" : "día"})
                  </option>
                ))}
              </select>
              {laborAsignacion?.rendimientoEsperado && (
                <div style={{ fontSize: "11px", color: "#7fbf5a", marginTop: "4px" }}>
                  ⚡ Estándar: {laborAsignacion.rendimientoEsperado} {laborAsignacion.unidadAvance}/día
                </div>
              )}
              {laborAsignacion?.descripcion && (
                <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)", marginTop: "4px" }}>
                  {laborAsignacion.descripcion}
                </div>
              )}
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>SECTOR</label>
              <select value={formAsignacion.sectorId}
                onChange={e => setFormAsignacion({ ...formAsignacion, sectorId: e.target.value, tunelId: "" })} style={S.select}>
                <option value="">Selecciona sector...</option>
                {sectoresRancho.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            {laborAsignacion?.unidadAvance === "surcos" && (
              <div style={S.formGroup}>
                <label style={S.label}>TÚNEL</label>
                <select value={formAsignacion.tunelId}
                  onChange={e => setFormAsignacion({ ...formAsignacion, tunelId: e.target.value })}
                  style={S.select} disabled={!formAsignacion.sectorId}>
                  <option value="">Selecciona túnel...</option>
                  {tunelesSectorAsig.map(t => <option key={t.id} value={t.id}>{t.numero} ({t.surcos.length} surcos)</option>)}
                </select>
              </div>
            )}
            <div style={S.formGroup}>
              <label style={S.label}>INSTRUCCIONES (opcional)</label>
              <textarea value={formAsignacion.notasAsignacion}
                onChange={e => setFormAsignacion({ ...formAsignacion, notasAsignacion: e.target.value })}
                placeholder="Indicaciones específicas para esta labor..." style={S.textarea} />
            </div>
            <button onClick={guardarAsignacion} style={S.btnPrimary} disabled={guardando}>
              {guardando ? "Guardando..." : "Confirmar asignación"}
            </button>
          </div>
        </div>
      )}

      {/* ======== MODAL RESULTADO ======== */}
      {showResultado && asignacionSelec && (
        <div style={S.modalOverlay} onClick={() => setShowResultado(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowResultado(false)}>✕</button>
            <h2 style={S.modalTitulo}>Registrar resultado</h2>
            <div style={S.infoBoxModal}>
              <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)" }}>
                {asignacionSelec.empleadoNombre} · {asignacionSelec.sectorNombre}
                {asignacionSelec.tunelNumero ? ` · ${asignacionSelec.tunelNumero}` : ""}
              </div>
              {asignacionSelec.rendimientoEsperado && (
                <div style={{ fontSize: "12px", color: "#7fbf5a", marginTop: "4px" }}>
                  ⚡ Esperado: {asignacionSelec.rendimientoEsperado} {asignacionSelec.laborUnidadAvance}/día
                </div>
              )}
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>{labelUnidad(asignacionSelec.laborUnidadAvance).toUpperCase()}</label>
              <input type="number" min="0" value={formResultado.cantidad}
                onChange={e => setFormResultado({ ...formResultado, cantidad: e.target.value })}
                placeholder={asignacionSelec.total_unidades ? `Máx. ${asignacionSelec.total_unidades} ${asignacionSelec.laborUnidadAvance}` : "Cantidad..."}
                style={S.select} />
              {asignacionSelec.total_unidades && (
                <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)", marginTop: "4px" }}>
                  Total disponible: {asignacionSelec.total_unidades} {asignacionSelec.laborUnidadAvance}
                </div>
              )}
            </div>
            {asignacionSelec.laborUnidad === "tarea" && (
              <>
                <div style={S.formGroup}>
                  <label style={S.label}>FRACCIÓN DE TAREA</label>
                  <select value={formResultado.fraccionTarea}
                    onChange={e => setFormResultado({ ...formResultado, fraccionTarea: e.target.value })} style={S.select}>
                    <option value="0.25">0.25 tarea</option>
                    <option value="0.5">0.5 tarea</option>
                    <option value="0.75">0.75 tarea</option>
                    <option value="1">1 tarea completa</option>
                    <option value="1.5">1.5 tareas</option>
                    <option value="2">2 tareas</option>
                  </select>
                </div>
                <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: "12px" }}>
                  <input type="checkbox" id="tareaCompleta" checked={formResultado.tareaCompleta}
                    onChange={e => setFormResultado({ ...formResultado, tareaCompleta: e.target.checked })}
                    style={{ width: "18px", height: "18px", accentColor: "#7fbf5a" }} />
                  <label htmlFor="tareaCompleta" style={{ ...S.label, marginBottom: 0 }}>TAREA COMPLETA</label>
                </div>
              </>
            )}
            <div style={S.formGroup}>
              <label style={S.label}>NOTAS (opcional)</label>
              <textarea value={formResultado.notasResultado}
                onChange={e => setFormResultado({ ...formResultado, notasResultado: e.target.value })}
                placeholder="Observaciones del trabajo realizado..." style={S.textarea} />
            </div>
            <button onClick={guardarResultado} style={S.btnPrimary} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar resultado"}
            </button>
          </div>
        </div>
      )}

      {/* ======== MODAL NUEVA/EDITAR LABOR ======== */}
      {showLaborForm && (
        <div style={S.modalOverlay} onClick={() => setShowLaborForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowLaborForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>{editandoLaborId ? "Editar labor" : "Nueva labor"}</h2>
            <div style={S.formGroup}>
              <label style={S.label}>NOMBRE</label>
              <input value={formLabor.nombre} onChange={e => setFormLabor({ ...formLabor, nombre: e.target.value })}
                placeholder="Ej: Poda, Deshierbe..." style={S.select} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>DESCRIPCIÓN</label>
              <textarea value={formLabor.descripcion} onChange={e => setFormLabor({ ...formLabor, descripcion: e.target.value })}
                placeholder="Describe brevemente en qué consiste esta labor..." style={S.textarea} />
            </div>
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>UNIDAD DE PAGO</label>
                <select value={formLabor.unidadPago} onChange={e => setFormLabor({ ...formLabor, unidadPago: e.target.value })} style={S.select}>
                  <option value="dia">Por día</option>
                  <option value="tarea">Por tarea</option>
                  <option value="hora">Por hora</option>
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>ÍCONO</label>
                <select value={formLabor.icono} onChange={e => setFormLabor({ ...formLabor, icono: e.target.value })} style={S.select}>
                  {["✂️","🌿","🪢","🌱","💧","🚿","🔧","⛏️","🧹","🌾","🧪","🐛"].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>UNIDAD DE AVANCE</label>
              <select value={formLabor.unidadAvance} onChange={e => setFormLabor({ ...formLabor, unidadAvance: e.target.value })} style={S.select}>
                {UNIDADES_AVANCE.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>RENDIMIENTO ESTÁNDAR/DÍA (opcional)</label>
              <input type="number" min="0" value={formLabor.rendimientoEsperado}
                onChange={e => setFormLabor({ ...formLabor, rendimientoEsperado: e.target.value })}
                placeholder={`Ej: 3 ${formLabor.unidadAvance}`} style={S.select} />
            </div>
            <button onClick={guardarLabor} style={S.btnPrimary} disabled={guardando}>
              {guardando ? "Guardando..." : editandoLaborId ? "Guardar cambios" : "Agregar labor"}
            </button>
          </div>
        </div>
      )}

      {/* ======== MODAL EQUIVALENCIA TAREA ======== */}
      {laborSelec && (
        <div style={S.modalOverlay} onClick={() => { setLaborSelec(null); setEditandoTareaId(null); }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => { setLaborSelec(null); setEditandoTareaId(null); }}>✕</button>
            <h2 style={S.modalTitulo}>{editandoTareaId ? "Editar equivalencia" : "Nueva equivalencia"} — {laborSelec.nombre}</h2>
            <div style={S.formGroup}>
              <label style={S.label}>NOMBRE DE LA TAREA</label>
              <input value={formTarea.nombre} onChange={e => setFormTarea({ ...formTarea, nombre: e.target.value })}
                placeholder="Ej: Tarea de poda" style={S.select} />
            </div>
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>EQUIVALENCIA</label>
                <input type="number" value={formTarea.equivalencia}
                  onChange={e => setFormTarea({ ...formTarea, equivalencia: e.target.value })} style={S.select} />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>UNIDAD</label>
                <select value={formTarea.unidadEquivalencia}
                  onChange={e => setFormTarea({ ...formTarea, unidadEquivalencia: e.target.value })} style={S.select}>
                  {UNIDADES_AVANCE.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>VALOR POR TAREA ($)</label>
              <input type="number" value={formTarea.valorTarea}
                onChange={e => setFormTarea({ ...formTarea, valorTarea: e.target.value })} style={S.select} />
            </div>
            <button onClick={guardarTarea} style={S.btnPrimary} disabled={guardando}>
              {guardando ? "Guardando..." : editandoTareaId ? "Guardar cambios" : "Guardar equivalencia"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ESTILOS ============
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
  btnCerrarError: { background: "transparent", border: "none", color: "#e05c5c", cursor: "pointer", fontSize: "14px" },
  navTabs: { display: "flex", gap: "8px", marginBottom: "16px" },
  navTab: { flex: 1, border: "1.5px solid", borderRadius: "10px", padding: "10px 8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: "transparent" },
  selectorsCard: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(127,191,90,0.15)", borderRadius: "16px", padding: "16px", display: "flex", gap: "12px", marginBottom: "12px" },
  selectorGroup: { flex: 1 },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box" },
  fechaTexto: { fontSize: "13px", color: "rgba(200,230,180,0.5)", textTransform: "capitalize", marginBottom: "16px", paddingLeft: "4px" },
  resumenRow: { display: "flex", gap: "8px", marginBottom: "16px" },
  chip: { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 12px", textAlign: "center" },
  chipCount: { fontSize: "20px", fontWeight: "800" },
  chipLabel: { fontSize: "10px", color: "rgba(200,230,180,0.5)", marginTop: "2px" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer", marginBottom: "16px", boxShadow: "0 4px 24px rgba(90,171,46,0.3)" },
  btnSecundario: { background: "rgba(127,191,90,0.12)", border: "1.5px solid rgba(127,191,90,0.3)", borderRadius: "10px", padding: "8px 16px", color: "#7fbf5a", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  btnAccion: { background: "rgba(127,191,90,0.08)", border: "1px solid rgba(127,191,90,0.2)", borderRadius: "8px", padding: "6px 12px", color: "#7fbf5a", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  btnIconoEdit: { background: "transparent", border: "none", cursor: "pointer", fontSize: "13px", padding: "2px 4px" },
  btnMiniLink: { background: "transparent", border: "none", color: "#7fbf5a", fontSize: "12px", cursor: "pointer", padding: "4px 0", textDecoration: "underline" },
  lista: { display: "flex", flexDirection: "column", gap: "10px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  cardBody: { display: "flex", flexDirection: "column", gap: "6px" },
  cardRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "rgba(200,230,180,0.8)" },
  cardLabel: { color: "rgba(200,230,180,0.4)", fontSize: "12px" },
  cardAcciones: { display: "flex", gap: "6px" },
  laborBadge: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" },
  estatusBadge: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600" },
  resultadoBox: { background: "rgba(127,191,90,0.06)", border: "1px solid rgba(127,191,90,0.15)", borderRadius: "10px", padding: "10px 12px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "5px" },
  resultadoTitulo: { fontSize: "11px", fontWeight: "700", color: "#7fbf5a", marginBottom: "4px" },
  infoBoxModal: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px" },
  tareaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modal: { background: "linear-gradient(160deg, #1a3d25, #0f2818)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "24px 24px 0 0", padding: "28px 24px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", position: "relative", boxSizing: "border-box" },
  modalClose: { position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "999px", width: "32px", height: "32px", color: "#e8f5e0", fontSize: "14px", cursor: "pointer" },
  modalTitulo: { fontSize: "18px", fontWeight: "700", color: "#ffffff", margin: "0 0 20px" },
  formGroup: { marginBottom: "16px" },
  formRow: { display: "flex", gap: "12px" },
  textarea: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "13px", minHeight: "70px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  seccionTitulo: { fontSize: "14px", fontWeight: "700", color: "#ffffff" },
  avanceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  sectorCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" },
  sectorNombre: { fontSize: "14px", fontWeight: "700", color: "#ffffff", marginBottom: "12px" },
  subSeccion: { marginBottom: "12px" },
  subSeccionTitulo: { fontSize: "11px", color: "rgba(200,230,180,0.4)", fontWeight: "600", marginBottom: "8px", letterSpacing: "0.06em" },
  tunelCard: { background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "10px 12px", marginBottom: "8px" },
  tunelTitulo: { fontSize: "12px", fontWeight: "700", color: "rgba(200,230,180,0.6)", marginBottom: "8px" },
  laborAvanceRow: { marginBottom: "8px" },
  laborAvanceInfo: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  miniTag: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" },
  avanceDetalle: { fontSize: "11px", color: "rgba(200,230,180,0.4)" },
  barraContainer: { display: "flex", alignItems: "center", gap: "8px" },
  barraFondo: { flex: 1, height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" },
  barraRelleno: { height: "100%", borderRadius: "999px", transition: "width 0.4s ease" },
  barraLabel: { fontSize: "11px", fontWeight: "700", minWidth: "32px", textAlign: "right", color: "rgba(200,230,180,0.7)" },
  sinActividad: { fontSize: "12px", color: "rgba(200,230,180,0.25)", textAlign: "center", padding: "12px 0" },
};

