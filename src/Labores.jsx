import { useState, useMemo } from "react";

// V0.2.2
// ============ DATOS REALES DE RANCHOS ============
const RANCHOS = [
  { id: 1, nombre: "Citlali", cultivo: "Zarzamora Isabella" },
  { id: 2, nombre: "Erick",   cultivo: "Frambuesa VR68" },
  { id: 3, nombre: "Valdo",   cultivo: "Frambuesa Malu" },
];

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
  { id: "C-S1", ranchoId: 1, nombre: "Sector 1", totalSurcos: 26, totalTuneles: 9 },
  { id: "C-S2", ranchoId: 1, nombre: "Sector 2", totalSurcos: 26, totalTuneles: 9 },
  { id: "E-S5", ranchoId: 2, nombre: "Sector 5", totalSurcos: 41, totalTuneles: 14 },
  { id: "E-S6", ranchoId: 2, nombre: "Sector 6", totalSurcos: 42, totalTuneles: 14 },
  { id: "V-S1", ranchoId: 3, nombre: "Sector 1", totalSurcos: 39, totalTuneles: 13 },
  { id: "V-S4", ranchoId: 3, nombre: "Sector 4", totalSurcos: 39, totalTuneles: 13 },
];

const TUNELES = [
  ...generarTuneles("C-S1", 9, 3, [{ tunel: 9, surcos: 2 }]),
  ...generarTuneles("C-S2", 9, 3, [{ tunel: 9, surcos: 2 }]),
  ...generarTuneles("E-S5", 14, 3, [{ tunel: 14, surcos: 2 }]),
  ...generarTuneles("E-S6", 14, 3),
  ...generarTuneles("V-S1", 13, 3),
  ...generarTuneles("V-S4", 13, 3),
];

const EMPLEADOS_PRUEBA = [
  { id: 1, nombre: "Juan Pérez Hernández",  ranchoId: 1 },
  { id: 2, nombre: "María López Sánchez",    ranchoId: 1 },
  { id: 3, nombre: "Roberto Gómez Díaz",     ranchoId: 1 },
  { id: 4, nombre: "Pedro Ramírez Soto",     ranchoId: 2 },
  { id: 5, nombre: "Guadalupe Torres Vega",  ranchoId: 2 },
  { id: 6, nombre: "Francisco Morales Rey",  ranchoId: 3 },
  { id: 7, nombre: "Rosa Elena Vázquez",     ranchoId: 3 },
];

// Unidades de medida disponibles para avance
const UNIDADES_AVANCE = [
  { value: "surcos",   label: "Surcos" },
  { value: "tuneles",  label: "Túneles" },
  { value: "sectores", label: "Sectores" },
  { value: "plantas",  label: "Plantas" },
  { value: "metros",   label: "Metros" },
];

const LABOR_CATALOGO_INICIAL = [
  {
    id: 1, nombre: "Poda", unidadPago: "tarea", color: "#7fbf5a", icono: "✂️",
    descripcion: "Corte de ramas para estimular producción y controlar estructura de la planta.",
    rendimientoEsperado: null, unidadAvance: "surcos",
  },
  {
    id: 2, nombre: "Deshierbe", unidadPago: "dia", color: "#e8a23d", icono: "🌿",
    descripcion: "Eliminación manual de maleza entre surcos y pasillos del túnel.",
    rendimientoEsperado: 3, unidadAvance: "surcos",
  },
  {
    id: 3, nombre: "Tutorado", unidadPago: "tarea", color: "#5a9bd4", icono: "🪢",
    descripcion: "Sujeción de tallos a los alambres guía para dar dirección al crecimiento.",
    rendimientoEsperado: null, unidadAvance: "surcos",
  },
  {
    id: 4, nombre: "Despunte", unidadPago: "tarea", color: "#c468d4", icono: "🌱",
    descripcion: "Eliminación de puntas de crecimiento para concentrar energía en frutos.",
    rendimientoEsperado: null, unidadAvance: "surcos",
  },
  {
    id: 5, nombre: "Aplicación foliar", unidadPago: "dia", color: "#e05c5c", icono: "💧",
    descripcion: "Aplicación de nutrientes o agroquímicos directamente sobre el follaje.",
    rendimientoEsperado: null, unidadAvance: "tuneles",
  },
  {
    id: 6, nombre: "Fumigación", unidadPago: "dia", color: "#5ad4c4", icono: "🚿",
    descripcion: "Aplicación de agroquímicos para control de plagas y enfermedades.",
    rendimientoEsperado: null, unidadAvance: "tuneles",
  },
];

const TAREAS_CATALOGO_INICIAL = [
  { id: 1, laborId: 1, nombre: "Tarea poda",     equivalencia: 4, unidadEquivalencia: "surcos", valorTarea: 80 },
  { id: 2, laborId: 3, nombre: "Tarea tutorado", equivalencia: 6, unidadEquivalencia: "surcos", valorTarea: 70 },
  { id: 3, laborId: 4, nombre: "Tarea despunte", equivalencia: 5, unidadEquivalencia: "surcos", valorTarea: 60 },
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

// Etiqueta dinámica según unidad de avance
function labelUnidad(unidad) {
  const mapa = {
    surcos: "Surcos realizados", tuneles: "Túneles realizados",
    sectores: "Sectores realizados", plantas: "Plantas trabajadas", metros: "Metros recorridos",
  };
  return mapa[unidad] || "Unidades realizadas";
}

// Total disponible según unidad y ubicación seleccionada
function totalDisponible(unidadAvance, sectorId, tunelId, sectoresRancho) {
  if (unidadAvance === "surcos") {
    const tunel = TUNELES.find(t => t.id === tunelId);
    return tunel ? tunel.surcos.length : null;
  }
  if (unidadAvance === "tuneles") {
    const sector = SECTORES.find(s => s.id === sectorId);
    return sector ? sector.totalTuneles : null;
  }
  if (unidadAvance === "sectores") {
    return sectoresRancho.length;
  }
  return null;
}

const VISTAS = { registro: "registro", avance: "avance", catalogo: "catalogo" };
const FORM_ASIGNACION_INICIAL = { empleadoId: "", laborId: "", sectorId: "", tunelId: "", notasAsignacion: "" };
const FORM_RESULTADO_INICIAL  = { cantidad: "", tareaCompleta: false, fraccionTarea: "1", notasResultado: "" };
const FORM_LABOR_INICIAL      = { nombre: "", unidadPago: "dia", icono: "🌾", color: "#7fbf5a", descripcion: "", rendimientoEsperado: "", unidadAvance: "surcos" };
const FORM_TAREA_INICIAL      = { nombre: "", equivalencia: "", unidadEquivalencia: "surcos", valorTarea: "" };

// ============ COMPONENTE PRINCIPAL ============
export default function Labores() {
  const [vista, setVista]       = useState(VISTAS.registro);
  const [ranchoId, setRanchoId] = useState(1);
  const [fecha, setFecha]       = useState(todayISO());
  const [registros, setRegistros] = useState([]);

  // Modales
  const [showAsignacion, setShowAsignacion]     = useState(false);
  const [showResultado, setShowResultado]       = useState(false);
  const [registroSelecIdx, setRegistroSelecIdx] = useState(null);
  const [formAsignacion, setFormAsignacion]     = useState(FORM_ASIGNACION_INICIAL);
  const [formResultado, setFormResultado]       = useState(FORM_RESULTADO_INICIAL);

  // Catálogo
  const [catalogoLabores, setCatalogoLabores] = useState(LABOR_CATALOGO_INICIAL);
  const [catalogoTareas, setCatalogoTareas]   = useState(TAREAS_CATALOGO_INICIAL);
  const [showLaborForm, setShowLaborForm]     = useState(false);
  const [editandoLaborId, setEditandoLaborId] = useState(null);
  const [formLabor, setFormLabor]             = useState(FORM_LABOR_INICIAL);
  const [laborSelec, setLaborSelec]           = useState(null);
  const [editandoTareaId, setEditandoTareaId] = useState(null);
  const [formTarea, setFormTarea]             = useState(FORM_TAREA_INICIAL);

  // Derivados
  const ranchoActual    = RANCHOS.find(r => r.id === ranchoId);
  const sectoresRancho  = useMemo(() => SECTORES.filter(s => s.ranchoId === ranchoId), [ranchoId]);
  const empleadosRancho = useMemo(() => EMPLEADOS_PRUEBA.filter(e => e.ranchoId === ranchoId), [ranchoId]);
  const tunelesSectorAsig = useMemo(() => TUNELES.filter(t => t.sectorId === formAsignacion.sectorId), [formAsignacion.sectorId]);
  const laborAsignacion   = useMemo(() => catalogoLabores.find(l => l.id === parseInt(formAsignacion.laborId)), [formAsignacion.laborId, catalogoLabores]);

  const registrosFecha = useMemo(() =>
    registros.filter(r => r.ranchoId === ranchoId && r.fecha === fecha),
    [registros, ranchoId, fecha]
  );

  const regSeleccionado = registroSelecIdx !== null ? registros[registroSelecIdx] : null;

  // ============ HANDLERS ASIGNACIÓN ============
  const abrirAsignacion = () => {
    setFormAsignacion(FORM_ASIGNACION_INICIAL);
    setShowAsignacion(true);
  };

  const guardarAsignacion = () => {
    if (!formAsignacion.empleadoId || !formAsignacion.laborId || !formAsignacion.sectorId) return;
    const empleado = EMPLEADOS_PRUEBA.find(e => e.id === parseInt(formAsignacion.empleadoId));
    const labor    = catalogoLabores.find(l => l.id === parseInt(formAsignacion.laborId));
    const sector   = SECTORES.find(s => s.id === formAsignacion.sectorId);
    const tunel    = TUNELES.find(t => t.id === formAsignacion.tunelId);

    // El túnel solo es requerido para labores por surco
    if (labor?.unidadAvance === "surcos" && !formAsignacion.tunelId) return;

    const total = totalDisponible(labor?.unidadAvance, formAsignacion.sectorId, formAsignacion.tunelId, sectoresRancho);

    setRegistros(prev => [...prev, {
      id: Date.now(), ranchoId, fecha, estatus: "asignado",
      empleadoId:      formAsignacion.empleadoId,
      empleadoNombre:  empleado?.nombre,
      laborId:         formAsignacion.laborId,
      laborNombre:     labor?.nombre,
      laborColor:      labor?.color,
      laborIcono:      labor?.icono,
      laborUnidad:     labor?.unidadPago,
      laborUnidadAvance: labor?.unidadAvance,
      rendimientoEsperado: labor?.rendimientoEsperado,
      sectorId:        formAsignacion.sectorId,
      sectorNombre:    sector?.nombre,
      tunelId:         formAsignacion.tunelId || null,
      tunelNumero:     tunel?.numero || null,
      totalUnidades:   total,
      notasAsignacion: formAsignacion.notasAsignacion,
      // Resultado
      cantidad: null, tareaCompleta: false, fraccionTarea: null, notasResultado: "",
    }]);
    setShowAsignacion(false);
    setFormAsignacion(FORM_ASIGNACION_INICIAL);
  };

  // ============ HANDLERS RESULTADO ============
  const abrirResultado = (idx) => {
    const reg = registrosFecha[idx];
    const idxGlobal = registros.findIndex(r => r.id === reg.id);
    setRegistroSelecIdx(idxGlobal);
    setFormResultado({
      cantidad:       reg.cantidad || "",
      tareaCompleta:  reg.tareaCompleta || false,
      fraccionTarea:  reg.fraccionTarea || "1",
      notasResultado: reg.notasResultado || "",
    });
    setShowResultado(true);
  };

  const guardarResultado = () => {
    setRegistros(prev => prev.map((r, i) => i === registroSelecIdx
      ? { ...r, ...formResultado, estatus: "completado" } : r
    ));
    setShowResultado(false);
    setFormResultado(FORM_RESULTADO_INICIAL);
    setRegistroSelecIdx(null);
  };

  const cambiarEstatus = (idx, nuevoEstatus) => {
    const reg = registrosFecha[idx];
    const idxGlobal = registros.findIndex(r => r.id === reg.id);
    setRegistros(prev => prev.map((r, i) => i === idxGlobal ? { ...r, estatus: nuevoEstatus } : r));
  };

  const eliminarRegistro = (idx) => {
    const reg = registrosFecha[idx];
    setRegistros(prev => prev.filter(r => r.id !== reg.id));
  };

  // ============ HANDLERS CATÁLOGO ============
  const abrirNuevaLabor = () => {
    setFormLabor(FORM_LABOR_INICIAL);
    setEditandoLaborId(null);
    setShowLaborForm(true);
  };

  const abrirEditarLabor = (labor) => {
    setFormLabor({
      nombre: labor.nombre, unidadPago: labor.unidadPago,
      icono: labor.icono, color: labor.color,
      descripcion: labor.descripcion || "",
      rendimientoEsperado: labor.rendimientoEsperado || "",
      unidadAvance: labor.unidadAvance || "surcos",
    });
    setEditandoLaborId(labor.id);
    setShowLaborForm(true);
  };

  const guardarLabor = () => {
    if (!formLabor.nombre) return;
    if (editandoLaborId !== null) {
      setCatalogoLabores(prev => prev.map(l => l.id === editandoLaborId ? { ...l, ...formLabor } : l));
    } else {
      setCatalogoLabores(prev => [...prev, { ...formLabor, id: Date.now() }]);
    }
    setShowLaborForm(false);
    setEditandoLaborId(null);
  };

  const abrirNuevaTarea  = (labor) => { setLaborSelec(labor); setEditandoTareaId(null); setFormTarea(FORM_TAREA_INICIAL); };
  const abrirEditarTarea = (labor, tarea) => {
    setLaborSelec(labor); setEditandoTareaId(tarea.id);
    setFormTarea({ nombre: tarea.nombre, equivalencia: tarea.equivalencia, unidadEquivalencia: tarea.unidadEquivalencia, valorTarea: tarea.valorTarea });
  };

  const guardarTarea = () => {
    if (!laborSelec || !formTarea.nombre) return;
    if (editandoTareaId !== null) {
      setCatalogoTareas(prev => prev.map(t => t.id === editandoTareaId ? { ...t, ...formTarea } : t));
    } else {
      setCatalogoTareas(prev => [...prev, { ...formTarea, id: Date.now(), laborId: laborSelec.id }]);
    }
    setLaborSelec(null); setEditandoTareaId(null);
  };

  // ============ CÁLCULO DE AVANCE MULTI-LABOR ============
  const avancePorSector = useMemo(() => {
    const regsCompletados = registros.filter(r =>
      r.ranchoId === ranchoId && (r.estatus === "completado" || r.estatus === "validado")
    );

    return sectoresRancho.map(sector => {
      const tunelesSec = TUNELES.filter(t => t.sectorId === sector.id);

      // Labores por surco — se muestran dentro de cada túnel
      const tuneles = tunelesSec.map(tunel => {
        const laboresEnTunel = regsCompletados.filter(r =>
          r.tunelId === tunel.id && r.laborUnidadAvance === "surcos"
        );
        // Agrupar por labor
        const porLabor = {};
        laboresEnTunel.forEach(r => {
          if (!porLabor[r.laborId]) {
            porLabor[r.laborId] = { laborNombre: r.laborNombre, laborColor: r.laborColor, laborIcono: r.laborIcono, cantidad: 0 };
          }
          porLabor[r.laborId].cantidad += parseInt(r.cantidad) || 0;
        });
        const laboresAvance = Object.values(porLabor).map(l => ({
          ...l,
          pct: Math.min(100, Math.round((l.cantidad / tunel.surcos.length) * 100)),
          total: tunel.surcos.length,
          unidad: "surcos",
        }));
        return { ...tunel, laboresAvance };
      });

      // Labores por túnel — se muestran a nivel sector
      const laboresPorTunel = regsCompletados.filter(r =>
        r.sectorId === sector.id && r.laborUnidadAvance === "tuneles"
      );
      const porLaborTunel = {};
      laboresPorTunel.forEach(r => {
        if (!porLaborTunel[r.laborId]) {
          porLaborTunel[r.laborId] = { laborNombre: r.laborNombre, laborColor: r.laborColor, laborIcono: r.laborIcono, cantidad: 0 };
        }
        porLaborTunel[r.laborId].cantidad += parseInt(r.cantidad) || 0;
      });
      const laboresAvanceTunel = Object.values(porLaborTunel).map(l => ({
        ...l,
        pct: Math.min(100, Math.round((l.cantidad / sector.totalTuneles) * 100)),
        total: sector.totalTuneles,
        unidad: "túneles",
      }));

      // Labores por sector — se muestran a nivel rancho (aquí a nivel sector como referencia)
      const laboresPorSector = regsCompletados.filter(r =>
        r.sectorId === sector.id && r.laborUnidadAvance === "sectores"
      );
      const porLaborSector = {};
      laboresPorSector.forEach(r => {
        if (!porLaborSector[r.laborId]) {
          porLaborSector[r.laborId] = { laborNombre: r.laborNombre, laborColor: r.laborColor, laborIcono: r.laborIcono, cantidad: 0 };
        }
        porLaborSector[r.laborId].cantidad += parseInt(r.cantidad) || 0;
      });
      const laboresAvanceSector = Object.values(porLaborSector).map(l => ({
        ...l,
        pct: Math.min(100, Math.round((l.cantidad / sectoresRancho.length) * 100)),
        total: sectoresRancho.length,
        unidad: "sectores",
      }));

      return { ...sector, tuneles, laboresAvanceTunel, laboresAvanceSector };
    });
  }, [registros, ranchoId, sectoresRancho]);

  // ============ RENDER ============
  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · LABORES</div>
            <h1 style={S.title}>Control de Labores</h1>
            <div style={S.usuarioTag}>{ranchoActual?.nombre} · {ranchoActual?.cultivo}</div>
          </div>
          <div style={S.headerIcon}>🌾</div>
        </div>

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
            <select value={ranchoId} onChange={e => setRanchoId(parseInt(e.target.value))} style={S.select}>
              {RANCHOS.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
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
                { label: "Asignadas",   valor: registrosFecha.length },
                { label: "En proceso",  valor: registrosFecha.filter(r => r.estatus === "en_proceso").length },
                { label: "Completadas", valor: registrosFecha.filter(r => r.estatus === "completado" || r.estatus === "validado").length },
                { label: "Validadas",   valor: registrosFecha.filter(r => r.estatus === "validado").length },
              ].map(c => (
                <div key={c.label} style={S.chip}>
                  <div style={S.chipCount}>{c.valor}</div>
                  <div style={S.chipLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            <button onClick={abrirAsignacion} style={S.btnPrimary}>+ Asignar labor</button>

            {registrosFecha.length === 0 ? (
              <div style={S.empty}>Sin labores asignadas para esta fecha</div>
            ) : (
              <div style={S.lista}>
                {registrosFecha.map((reg, idx) => {
                  const est = ESTATUS[reg.estatus];
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
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Empleado</span>
                          <span>{reg.empleadoNombre}</span>
                        </div>
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Ubicación</span>
                          <span>{reg.sectorNombre}{reg.tunelNumero ? ` · ${reg.tunelNumero}` : ""}</span>
                        </div>
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Unidad de avance</span>
                          <span>{reg.laborUnidadAvance}</span>
                        </div>
                        {reg.rendimientoEsperado && (
                          <div style={S.cardRow}>
                            <span style={S.cardLabel}>Rend. esperado</span>
                            <span style={{ color: "#7fbf5a" }}>{reg.rendimientoEsperado} {reg.laborUnidadAvance}/día</span>
                          </div>
                        )}
                        {reg.notasAsignacion ? (
                          <div style={S.cardRow}>
                            <span style={S.cardLabel}>Instrucciones</span>
                            <span style={{ fontSize: "12px" }}>{reg.notasAsignacion}</span>
                          </div>
                        ) : null}

                        {/* Resultado */}
                        {(reg.estatus === "completado" || reg.estatus === "validado") && reg.cantidad && (
                          <div style={S.resultadoBox}>
                            <div style={S.resultadoTitulo}>📊 Resultado</div>
                            <div style={S.cardRow}>
                              <span style={S.cardLabel}>{labelUnidad(reg.laborUnidadAvance)}</span>
                              <span style={{ color: "#7fbf5a", fontWeight: "700" }}>
                                {reg.cantidad} {reg.totalUnidades ? `/ ${reg.totalUnidades}` : ""}
                              </span>
                            </div>
                            {reg.laborUnidad === "tarea" && (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>Tareas</span>
                                <span style={{ color: reg.tareaCompleta ? "#7fbf5a" : "#e8a23d" }}>
                                  {reg.tareaCompleta ? `✅ Completa (${reg.fraccionTarea}x)` : `⏳ Fracción: ${reg.fraccionTarea}x`}
                                </span>
                              </div>
                            )}
                            {reg.rendimientoEsperado && (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>vs. esperado</span>
                                <span style={{ color: parseInt(reg.cantidad) >= reg.rendimientoEsperado ? "#7fbf5a" : "#e05c5c", fontWeight: "700" }}>
                                  {parseInt(reg.cantidad) >= reg.rendimientoEsperado ? "✅ Cumplido" : "⚠️ Por debajo"}
                                </span>
                              </div>
                            )}
                            {reg.notasResultado ? (
                              <div style={S.cardRow}>
                                <span style={S.cardLabel}>Notas</span>
                                <span style={{ fontSize: "12px" }}>{reg.notasResultado}</span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div style={{ ...S.cardAcciones, marginTop: "12px", flexWrap: "wrap" }}>
                        {reg.estatus === "asignado" && (
                          <>
                            <button onClick={() => cambiarEstatus(idx, "en_proceso")} style={S.btnAccion}>⚙️ Iniciar</button>
                            <button onClick={() => abrirResultado(idx)} style={S.btnAccion}>📝 Resultado</button>
                          </>
                        )}
                        {reg.estatus === "en_proceso" && (
                          <button onClick={() => abrirResultado(idx)} style={S.btnAccion}>📝 Resultado</button>
                        )}
                        {(reg.estatus === "completado" || reg.estatus === "validado") && (
                          <>
                            <button onClick={() => abrirResultado(idx)} style={S.btnAccion}>✏️ Editar</button>
                            {reg.estatus === "completado" && (
                              <button onClick={() => cambiarEstatus(idx, "validado")} style={{ ...S.btnAccion, color: "#c468d4", borderColor: "rgba(196,104,212,0.3)" }}>🔍 Validar</button>
                            )}
                          </>
                        )}
                        <button onClick={() => eliminarRegistro(idx)} style={{ ...S.btnAccion, color: "#e05c5c", borderColor: "rgba(224,92,92,0.2)" }}>🗑</button>
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

                {/* Labores por túnel (unidad = túneles) */}
                {sector.laboresAvanceTunel.length > 0 && (
                  <div style={S.subSeccion}>
                    <div style={S.subSeccionTitulo}>📦 Por túnel</div>
                    {sector.laboresAvanceTunel.map((l, i) => (
                      <div key={i} style={S.laborAvanceRow}>
                        <div style={S.laborAvanceInfo}>
                          <span style={{ ...S.miniTag, background: l.laborColor + "22", color: l.laborColor }}>
                            {l.laborIcono} {l.laborNombre}
                          </span>
                          <span style={S.avanceDetalle}>{l.cantidad}/{l.total} {l.unidad}</span>
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

                {/* Labores por surco dentro de cada túnel */}
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

                {/* Sin actividad */}
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
              <button onClick={abrirNuevaLabor} style={S.btnSecundario}>+ Nueva</button>
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
                          {labor.unidadPago === "tarea" ? "Por tarea" : labor.unidadPago === "dia" ? "Por día" : "Por hora"}
                        </span>
                        <button onClick={() => abrirEditarLabor(labor)} style={S.btnIconoEdit}>✏️</button>
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
                              <button onClick={() => abrirEditarTarea(labor, t)} style={S.btnIconoEdit}>✏️</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => abrirNuevaTarea(labor)} style={{ ...S.btnMiniLink, marginTop: "8px" }}>
                          + Agregar equivalencia
                        </button>
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
                {empleadosRancho.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>LABOR</label>
              <select value={formAsignacion.laborId}
                onChange={e => setFormAsignacion({ ...formAsignacion, laborId: e.target.value, tunelId: "" })} style={S.select}>
                <option value="">Selecciona labor...</option>
                {catalogoLabores.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.icono} {l.nombre} ({l.unidadPago === "tarea" ? "tarea" : l.unidadPago === "dia" ? "día" : "hora"})
                  </option>
                ))}
              </select>
              {laborAsignacion?.rendimientoEsperado && (
                <div style={{ fontSize: "11px", color: "#7fbf5a", marginTop: "4px" }}>
                  ⚡ Rendimiento estándar: {laborAsignacion.rendimientoEsperado} {laborAsignacion.unidadAvance}/día
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

            {/* Túnel solo para labores por surco */}
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

            <button onClick={guardarAsignacion} style={S.btnPrimary}>Confirmar asignación</button>
          </div>
        </div>
      )}

      {/* ======== MODAL RESULTADO ======== */}
      {showResultado && regSeleccionado && (
        <div style={S.modalOverlay} onClick={() => setShowResultado(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowResultado(false)}>✕</button>
            <h2 style={S.modalTitulo}>Registrar resultado</h2>

            <div style={S.infoBoxModal}>
              <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)" }}>
                {regSeleccionado.empleadoNombre} · {regSeleccionado.sectorNombre}
                {regSeleccionado.tunelNumero ? ` · ${regSeleccionado.tunelNumero}` : ""}
              </div>
              {regSeleccionado.rendimientoEsperado && (
                <div style={{ fontSize: "12px", color: "#7fbf5a", marginTop: "4px" }}>
                  ⚡ Esperado: {regSeleccionado.rendimientoEsperado} {regSeleccionado.laborUnidadAvance}/día
                </div>
              )}
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>{labelUnidad(regSeleccionado.laborUnidadAvance).toUpperCase()}</label>
              <input type="number" min="0"
                value={formResultado.cantidad}
                onChange={e => setFormResultado({ ...formResultado, cantidad: e.target.value })}
                placeholder={regSeleccionado.totalUnidades ? `Máx. ${regSeleccionado.totalUnidades} ${regSeleccionado.laborUnidadAvance}` : "Cantidad..."}
                style={S.select} />
              {regSeleccionado.totalUnidades && (
                <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)", marginTop: "4px" }}>
                  Total disponible: {regSeleccionado.totalUnidades} {regSeleccionado.laborUnidadAvance}
                </div>
              )}
            </div>

            {regSeleccionado.laborUnidad === "tarea" && (
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
                  <input type="checkbox" id="tareaCompleta"
                    checked={formResultado.tareaCompleta}
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

            <button onClick={guardarResultado} style={S.btnPrimary}>Guardar resultado</button>
          </div>
        </div>
      )}

      {/* ======== MODAL NUEVA/EDITAR LABOR ======== */}
      {showLaborForm && (
        <div style={S.modalOverlay} onClick={() => setShowLaborForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowLaborForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>{editandoLaborId !== null ? "Editar labor" : "Nueva labor"}</h2>

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
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>RENDIMIENTO ESTÁNDAR/DÍA</label>
                <input type="number" min="0" value={formLabor.rendimientoEsperado}
                  onChange={e => setFormLabor({ ...formLabor, rendimientoEsperado: e.target.value })}
                  placeholder="Ej: 3" style={S.select} />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>UNIDAD</label>
                <input value={formLabor.unidadAvance} disabled style={{ ...S.select, opacity: 0.5 }} />
              </div>
            </div>
            <button onClick={guardarLabor} style={S.btnPrimary}>
              {editandoLaborId !== null ? "Guardar cambios" : "Agregar labor"}
            </button>
          </div>
        </div>
      )}

      {/* ======== MODAL EQUIVALENCIA TAREA ======== */}
      {laborSelec && (
        <div style={S.modalOverlay} onClick={() => { setLaborSelec(null); setEditandoTareaId(null); }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => { setLaborSelec(null); setEditandoTareaId(null); }}>✕</button>
            <h2 style={S.modalTitulo}>
              {editandoTareaId !== null ? "Editar equivalencia" : "Nueva equivalencia"} — {laborSelec.nombre}
            </h2>
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
            <button onClick={guardarTarea} style={S.btnPrimary}>
              {editandoTareaId !== null ? "Guardar cambios" : "Guardar equivalencia"}
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
