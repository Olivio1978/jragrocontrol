import { useState, useMemo } from "react";

// ============ DATOS REALES DE RANCHOS ============
const RANCHOS = [
  { id: 1, nombre: "Citlali", cultivo: "Zarzamora Isabella" },
  { id: 2, nombre: "Erick",   cultivo: "Frambuesa VR68" },
  { id: 3, nombre: "Valdo",   cultivo: "Frambuesa Malu" },
];

// Generador de túneles con surcos reales
function generarTuneles(sectorId, numTuneles, surcosPorTunel, tunelesEspeciales = []) {
  const tuneles = [];
  for (let t = 1; t <= numTuneles; t++) {
    const especial = tunelesEspeciales.find(e => e.tunel === t);
    const numSurcos = especial ? especial.surcos : surcosPorTunel;
    const surcos = Array.from({ length: numSurcos }, (_, i) => ({
      id: `${sectorId}-T${t}-S${i + 1}`,
      numero: i + 1,
    }));
    tuneles.push({ id: `${sectorId}-T${t}`, sectorId, numero: `T-${t}`, surcos });
  }
  return tuneles;
}

const SECTORES = [
  // Citlali
  { id: "C-S1", ranchoId: 1, nombre: "Sector 1", totalSurcos: 26 },
  { id: "C-S2", ranchoId: 1, nombre: "Sector 2", totalSurcos: 26 },
  // Erick
  { id: "E-S5", ranchoId: 2, nombre: "Sector 5", totalSurcos: 41 },
  { id: "E-S6", ranchoId: 2, nombre: "Sector 6", totalSurcos: 42 },
  // Valdo
  { id: "V-S1", ranchoId: 3, nombre: "Sector 1", totalSurcos: 39 },
  { id: "V-S4", ranchoId: 3, nombre: "Sector 4", totalSurcos: 39 },
];

const TUNELES = [
  // Citlali Sector 1: 9 tuneles, T-9 con 2 surcos
  ...generarTuneles("C-S1", 9, 3, [{ tunel: 9, surcos: 2 }]),
  // Citlali Sector 2: 9 tuneles, T-9 con 2 surcos
  ...generarTuneles("C-S2", 9, 3, [{ tunel: 9, surcos: 2 }]),
  // Erick Sector 5: 14 tuneles, T-14 con 2 surcos
  ...generarTuneles("E-S5", 14, 3, [{ tunel: 14, surcos: 2 }]),
  // Erick Sector 6: 14 tuneles, todos con 3 surcos
  ...generarTuneles("E-S6", 14, 3),
  // Valdo Sector 1: 13 tuneles, todos con 3 surcos
  ...generarTuneles("V-S1", 13, 3),
  // Valdo Sector 4: 13 tuneles, todos con 3 surcos
  ...generarTuneles("V-S4", 13, 3),
];

const EMPLEADOS_PRUEBA = [
  { id: 1, nombre: "Juan Pérez Hernández",    ranchoId: 1 },
  { id: 2, nombre: "María López Sánchez",      ranchoId: 1 },
  { id: 3, nombre: "Roberto Gómez Díaz",       ranchoId: 1 },
  { id: 4, nombre: "Pedro Ramírez Soto",       ranchoId: 2 },
  { id: 5, nombre: "Guadalupe Torres Vega",    ranchoId: 2 },
  { id: 6, nombre: "Francisco Morales Rey",    ranchoId: 3 },
  { id: 7, nombre: "Rosa Elena Vázquez",       ranchoId: 3 },
];

const LABOR_CATALOGO_INICIAL = [
  { id: 1, nombre: "Poda",              unidadPago: "tarea", color: "#7fbf5a", icono: "✂️" },
  { id: 2, nombre: "Deshierbe",         unidadPago: "dia",   color: "#e8a23d", icono: "🌿" },
  { id: 3, nombre: "Tutorado",          unidadPago: "tarea", color: "#5a9bd4", icono: "🪢" },
  { id: 4, nombre: "Despunte",          unidadPago: "tarea", color: "#c468d4", icono: "🌱" },
  { id: 5, nombre: "Aplicación foliar", unidadPago: "dia",   color: "#e05c5c", icono: "💧" },
  { id: 6, nombre: "Riego manual",      unidadPago: "dia",   color: "#5ad4c4", icono: "🚿" },
];

const TAREAS_CATALOGO_INICIAL = [
  { id: 1, laborId: 1, nombre: "Tarea poda",     equivalencia: 4, unidadEquivalencia: "surcos", valorTarea: 80 },
  { id: 2, laborId: 3, nombre: "Tarea tutorado", equivalencia: 6, unidadEquivalencia: "surcos", valorTarea: 70 },
  { id: 3, laborId: 4, nombre: "Tarea despunte", equivalencia: 5, unidadEquivalencia: "surcos", valorTarea: 60 },
];

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

const VISTAS = { registro: "registro", avance: "avance", catalogo: "catalogo" };

const FORM_INICIAL = {
  empleadoId: "",
  laborId: "",
  sectorId: "",
  tunelId: "",
  surcos: "",
  tareaCompleta: false,
  fraccionTarea: "1",
  notas: "",
};

// ============ COMPONENTE PRINCIPAL ============
export default function Labores() {
  const [vista, setVista] = useState(VISTAS.registro);
  const [ranchoId, setRanchoId] = useState(1);
  const [fecha, setFecha] = useState(todayISO());
  const [registros, setRegistros] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editandoIdx, setEditandoIdx] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [catalogoLabores, setCatalogoLabores] = useState(LABOR_CATALOGO_INICIAL);
  const [catalogoTareas, setCatalogoTareas] = useState(TAREAS_CATALOGO_INICIAL);
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [laborSelec, setLaborSelec] = useState(null);
  const [formLabor, setFormLabor] = useState({ nombre: "", unidadPago: "dia", icono: "🌾" });
  const [formTarea, setFormTarea] = useState({ nombre: "", equivalencia: "", unidadEquivalencia: "surcos", valorTarea: "" });

  // Derivados
  const ranchoActual = RANCHOS.find(r => r.id === ranchoId);
  const sectoresRancho = useMemo(() => SECTORES.filter(s => s.ranchoId === ranchoId), [ranchoId]);
  const empleadosRancho = useMemo(() => EMPLEADOS_PRUEBA.filter(e => e.ranchoId === ranchoId), [ranchoId]);
  const tunelesSector = useMemo(() => TUNELES.filter(t => t.sectorId === form.sectorId), [form.sectorId]);
  const surcosTunel = useMemo(() => {
    const tunel = TUNELES.find(t => t.id === form.tunelId);
    return tunel ? tunel.surcos : [];
  }, [form.tunelId]);

  const registrosFecha = useMemo(() =>
    registros.filter(r => r.ranchoId === ranchoId && r.fecha === fecha),
    [registros, ranchoId, fecha]
  );

  const laborActual = useMemo(() =>
    catalogoLabores.find(l => l.id === parseInt(form.laborId)),
    [form.laborId, catalogoLabores]
  );

  // ============ HANDLERS ============
  const abrirFormNuevo = () => {
    setForm(FORM_INICIAL);
    setEditandoIdx(null);
    setShowForm(true);
  };

  const abrirFormEditar = (idx) => {
    setForm({ ...registros[idx] });
    setEditandoIdx(idx);
    setShowForm(true);
  };

  const guardarRegistro = () => {
    if (!form.empleadoId || !form.laborId || !form.sectorId || !form.tunelId) return;
    const empleado = EMPLEADOS_PRUEBA.find(e => e.id === parseInt(form.empleadoId));
    const labor = catalogoLabores.find(l => l.id === parseInt(form.laborId));
    const sector = SECTORES.find(s => s.id === form.sectorId);
    const tunel = TUNELES.find(t => t.id === form.tunelId);
    const nuevo = {
      ...form,
      id: editandoIdx !== null ? registros[editandoIdx].id : Date.now(),
      ranchoId,
      fecha,
      empleadoNombre: empleado?.nombre,
      laborNombre: labor?.nombre,
      laborColor: labor?.color,
      laborIcono: labor?.icono,
      laborUnidad: labor?.unidadPago,
      sectorNombre: sector?.nombre,
      tunelNumero: tunel?.numero,
    };
    if (editandoIdx !== null) {
      setRegistros(prev => prev.map((r, i) => i === editandoIdx ? nuevo : r));
    } else {
      setRegistros(prev => [...prev, nuevo]);
    }
    setShowForm(false);
    setForm(FORM_INICIAL);
    setEditandoIdx(null);
  };

  const eliminarRegistro = (idx) => {
    setRegistros(prev => prev.filter((_, i) => i !== idx));
  };

  const guardarLabor = () => {
    if (!formLabor.nombre) return;
    setCatalogoLabores(prev => [...prev, { ...formLabor, id: Date.now() }]);
    setFormLabor({ nombre: "", unidadPago: "dia", icono: "🌾" });
    setShowLaborForm(false);
  };

  const guardarTarea = () => {
    if (!laborSelec || !formTarea.nombre) return;
    setCatalogoTareas(prev => [...prev, { ...formTarea, id: Date.now(), laborId: laborSelec.id }]);
    setFormTarea({ nombre: "", equivalencia: "", unidadEquivalencia: "surcos", valorTarea: "" });
    setLaborSelec(null);
  };

  // Avance por sector
  const avancePorSector = useMemo(() => {
    return sectoresRancho.map(sector => {
      const tunelesSec = TUNELES.filter(t => t.sectorId === sector.id);
      return {
        ...sector,
        tuneles: tunelesSec.map(tunel => {
          const regsTunel = registros.filter(r =>
            r.ranchoId === ranchoId && r.tunelId === tunel.id
          );
          const surcosTrabajaos = regsTunel.reduce((acc, r) => acc + (parseInt(r.surcos) || 0), 0);
          const pct = Math.min(100, Math.round((surcosTrabajaos / tunel.surcos.length) * 100));
          return { ...tunel, surcosTrabajaos, pct, registros: regsTunel };
        }),
      };
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

        {/* Tabs de vista */}
        <div style={S.navTabs}>
          {[
            { key: VISTAS.registro, label: "📋 Registro" },
            { key: VISTAS.avance,   label: "📊 Avance" },
            { key: VISTAS.catalogo, label: "📚 Catálogo" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setVista(tab.key)} style={{
              ...S.navTab,
              borderColor: vista === tab.key ? "#7fbf5a" : "rgba(127,191,90,0.2)",
              background: vista === tab.key ? "rgba(127,191,90,0.15)" : "transparent",
              color: vista === tab.key ? "#7fbf5a" : "rgba(200,230,180,0.5)",
            }}>
              {tab.label}
            </button>
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
            {/* Resumen del dia */}
            <div style={S.resumenRow}>
              {[
                { label: "Registros", valor: registrosFecha.length },
                { label: "Empleados", valor: new Set(registrosFecha.map(r => r.empleadoId)).size },
                { label: "Surcos",    valor: registrosFecha.reduce((a, r) => a + (parseInt(r.surcos) || 0), 0) },
                { label: "Tareas",    valor: registrosFecha.filter(r => r.tareaCompleta).length },
              ].map(c => (
                <div key={c.label} style={S.chip}>
                  <div style={S.chipCount}>{c.valor}</div>
                  <div style={S.chipLabel}>{c.label}</div>
                </div>
              ))}
            </div>

            <button onClick={abrirFormNuevo} style={S.btnPrimary}>+ Registrar labor</button>

            {/* Lista de registros del dia */}
            {registrosFecha.length === 0 ? (
              <div style={S.empty}>Sin registros para esta fecha</div>
            ) : (
              <div style={S.lista}>
                {registrosFecha.map((reg, idx) => (
                  <div key={reg.id} style={S.card}>
                    <div style={S.cardTop}>
                      <span style={{ ...S.laborBadge, background: reg.laborColor + "22", color: reg.laborColor }}>
                        {reg.laborIcono} {reg.laborNombre}
                      </span>
                      <div style={S.cardAcciones}>
                        <button onClick={() => abrirFormEditar(idx)} style={S.btnSecundario}>✏️</button>
                        <button onClick={() => eliminarRegistro(idx)} style={S.btnIcono}>🗑</button>
                      </div>
                    </div>
                    <div style={S.cardBody}>
                      <div style={S.cardRow}>
                        <span style={S.cardLabel}>Empleado</span>
                        <span>{reg.empleadoNombre}</span>
                      </div>
                      <div style={S.cardRow}>
                        <span style={S.cardLabel}>Ubicación</span>
                        <span>{reg.sectorNombre} · {reg.tunelNumero}</span>
                      </div>
                      <div style={S.cardRow}>
                        <span style={S.cardLabel}>Surcos trabajados</span>
                        <span>{reg.surcos || "—"}</span>
                      </div>
                      {reg.laborUnidad === "tarea" && (
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Tarea</span>
                          <span style={{ color: reg.tareaCompleta ? "#7fbf5a" : "#e8a23d" }}>
                            {reg.tareaCompleta ? `✅ Completa (${reg.fraccionTarea}x)` : `⏳ Fracción: ${reg.fraccionTarea}x`}
                          </span>
                        </div>
                      )}
                      {reg.notas && (
                        <div style={S.cardRow}>
                          <span style={S.cardLabel}>Notas</span>
                          <span style={{ fontSize: "12px" }}>{reg.notas}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ======== VISTA AVANCE ======== */}
        {vista === VISTAS.avance && (
          <>
            <div style={S.avanceHeader}>
              <div style={S.seccionTitulo}>Avance por sector y túnel</div>
            </div>
            {avancePorSector.map(sector => (
              <div key={sector.id} style={S.sectorCard}>
                <div style={S.sectorNombre}>
                  {sector.nombre} · {sector.totalSurcos} surcos totales
                </div>
                {sector.tuneles.map(tunel => (
                  <div key={tunel.id} style={S.tunelRow}>
                    <div style={S.tunelInfo}>
                      <span style={S.tunelLabel}>{tunel.numero}</span>
                      <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)" }}>
                        {tunel.surcos.length} surcos
                      </span>
                    </div>
                    <div style={S.barraContainer}>
                      <div style={S.barraFondo}>
                        <div style={{
                          ...S.barraRelleno,
                          width: `${tunel.pct}%`,
                          background: tunel.pct >= 100 ? "#7fbf5a" : tunel.pct > 50 ? "#e8a23d" : "#5a9bd4",
                        }} />
                      </div>
                      <span style={S.barraLabel}>{tunel.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {/* ======== VISTA CATALOGO ======== */}
        {vista === VISTAS.catalogo && (
          <>
            <div style={{ ...S.avanceHeader, marginBottom: "12px" }}>
              <div style={S.seccionTitulo}>Catálogo de labores</div>
              <button onClick={() => setShowLaborForm(true)} style={S.btnSecundario}>+ Nueva</button>
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
                      <span style={{ ...S.unidadTag, color: "rgba(200,230,180,0.5)" }}>
                        {labor.unidadPago === "tarea" ? "Por tarea" : labor.unidadPago === "dia" ? "Por día" : "Por hora"}
                      </span>
                    </div>
                    {labor.unidadPago === "tarea" && (
                      <div>
                        {tareas.map(t => (
                          <div key={t.id} style={S.tareaRow}>
                            <span style={{ fontSize: "12px" }}>{t.nombre}</span>
                            <span style={{ fontSize: "12px", color: "#7fbf5a" }}>
                              {t.equivalencia} {t.unidadEquivalencia} · ${t.valorTarea}
                            </span>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setLaborSelec(labor);
                            setFormTarea({ nombre: "", equivalencia: "", unidadEquivalencia: "surcos", valorTarea: "" });
                          }}
                          style={{ ...S.btnMiniLink, marginTop: "8px" }}>
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

      {/* ======== MODAL REGISTRO DE LABOR ======== */}
      {showForm && (
        <div style={S.modalOverlay} onClick={() => setShowForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>{editandoIdx !== null ? "Editar registro" : "Nueva labor"}</h2>

            {/* Empleado */}
            <div style={S.formGroup}>
              <label style={S.label}>EMPLEADO</label>
              <select value={form.empleadoId} onChange={e => setForm({ ...form, empleadoId: e.target.value })} style={S.select}>
                <option value="">Selecciona empleado...</option>
                {empleadosRancho.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {/* Labor */}
            <div style={S.formGroup}>
              <label style={S.label}>LABOR</label>
              <select value={form.laborId} onChange={e => setForm({ ...form, laborId: e.target.value })} style={S.select}>
                <option value="">Selecciona labor...</option>
                {catalogoLabores.map(l => <option key={l.id} value={l.id}>{l.icono} {l.nombre}</option>)}
              </select>
            </div>

            {/* Sector + Tunel */}
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>SECTOR</label>
                <select value={form.sectorId} onChange={e => setForm({ ...form, sectorId: e.target.value, tunelId: "" })} style={S.select}>
                  <option value="">Sector...</option>
                  {sectoresRancho.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>TÚNEL</label>
                <select value={form.tunelId} onChange={e => setForm({ ...form, tunelId: e.target.value })} style={S.select} disabled={!form.sectorId}>
                  <option value="">Túnel...</option>
                  {tunelesSector.map(t => <option key={t.id} value={t.id}>{t.numero}</option>)}
                </select>
              </div>
            </div>

            {/* Surcos trabajados */}
            <div style={S.formGroup}>
              <label style={S.label}>SURCOS TRABAJADOS</label>
              <input
                type="number" min="1"
                value={form.surcos}
                onChange={e => setForm({ ...form, surcos: e.target.value })}
                placeholder={surcosTunel.length > 0 ? `Máx. ${surcosTunel.length} surcos` : "Surcos..."}
                style={S.select}
              />
              {surcosTunel.length > 0 && (
                <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.4)", marginTop: "4px" }}>
                  Este túnel tiene {surcosTunel.length} surcos
                </div>
              )}
            </div>

            {/* Campos especificos para labor por tarea */}
            {laborActual?.unidadPago === "tarea" && (
              <>
                <div style={S.formGroup}>
                  <label style={S.label}>FRACCIÓN DE TAREA REALIZADA</label>
                  <select value={form.fraccionTarea} onChange={e => setForm({ ...form, fraccionTarea: e.target.value })} style={S.select}>
                    <option value="0.25">0.25 tarea</option>
                    <option value="0.5">0.5 tarea</option>
                    <option value="0.75">0.75 tarea</option>
                    <option value="1">1 tarea completa</option>
                    <option value="1.5">1.5 tareas</option>
                    <option value="2">2 tareas</option>
                  </select>
                </div>
                <div style={{ ...S.formGroup, display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="checkbox" id="tareaCompleta"
                    checked={form.tareaCompleta}
                    onChange={e => setForm({ ...form, tareaCompleta: e.target.checked })}
                    style={{ width: "18px", height: "18px", accentColor: "#7fbf5a" }}
                  />
                  <label htmlFor="tareaCompleta" style={{ ...S.label, marginBottom: 0 }}>
                    TAREA COMPLETA
                  </label>
                </div>
              </>
            )}

            {/* Notas */}
            <div style={S.formGroup}>
              <label style={S.label}>NOTAS (opcional)</label>
              <textarea
                value={form.notas}
                onChange={e => setForm({ ...form, notas: e.target.value })}
                placeholder="Observaciones del trabajo..."
                style={S.textarea}
              />
            </div>

            <button onClick={guardarRegistro} style={S.btnPrimary}>
              {editandoIdx !== null ? "Actualizar registro" : "Guardar registro"}
            </button>
          </div>
        </div>
      )}

      {/* ======== MODAL NUEVA LABOR (CATALOGO) ======== */}
      {showLaborForm && (
        <div style={S.modalOverlay} onClick={() => setShowLaborForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowLaborForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>Nueva labor</h2>
            <div style={S.formGroup}>
              <label style={S.label}>NOMBRE</label>
              <input value={formLabor.nombre} onChange={e => setFormLabor({ ...formLabor, nombre: e.target.value })}
                placeholder="Ej: Poda, Deshierbe..." style={S.select} />
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
                  {["✂️","🌿","🪢","🌱","💧","🚿","🔧","⛏️","🧹","🌾"].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <button onClick={guardarLabor} style={S.btnPrimary}>Guardar labor</button>
          </div>
        </div>
      )}

      {/* ======== MODAL EQUIVALENCIA TAREA ======== */}
      {laborSelec && (
        <div style={S.modalOverlay} onClick={() => setLaborSelec(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setLaborSelec(null)}>✕</button>
            <h2 style={S.modalTitulo}>Equivalencia — {laborSelec.nombre}</h2>
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
                  <option value="surcos">Surcos</option>
                  <option value="plantas">Plantas</option>
                  <option value="metros">Metros</option>
                </select>
              </div>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>VALOR POR TAREA ($)</label>
              <input type="number" value={formTarea.valorTarea}
                onChange={e => setFormTarea({ ...formTarea, valorTarea: e.target.value })} style={S.select} />
            </div>
            <button onClick={guardarTarea} style={S.btnPrimary}>Guardar equivalencia</button>
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
  btnIcono: { background: "rgba(224,92,92,0.12)", border: "1px solid rgba(224,92,92,0.2)", borderRadius: "8px", padding: "4px 8px", color: "#e05c5c", cursor: "pointer", fontSize: "14px" },
  btnMiniLink: { background: "transparent", border: "none", color: "#7fbf5a", fontSize: "12px", cursor: "pointer", padding: "4px 0", textDecoration: "underline" },
  lista: { display: "flex", flexDirection: "column", gap: "10px" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  cardBody: { display: "flex", flexDirection: "column", gap: "6px" },
  cardRow: { display: "flex", justifyContent: "space-between", fontSize: "13px", color: "rgba(200,230,180,0.8)" },
  cardLabel: { color: "rgba(200,230,180,0.4)", fontSize: "12px" },
  cardAcciones: { display: "flex", gap: "6px" },
  laborBadge: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" },
  unidadTag: { fontSize: "11px" },
  tareaRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" },
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
  tunelRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" },
  tunelInfo: { minWidth: "60px" },
  tunelLabel: { fontSize: "12px", fontWeight: "600", color: "rgba(200,230,180,0.6)", display: "block", marginBottom: "2px" },
  barraContainer: { flex: 1, display: "flex", alignItems: "center", gap: "8px" },
  barraFondo: { flex: 1, height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" },
  barraRelleno: { height: "100%", borderRadius: "999px", transition: "width 0.4s ease" },
  barraLabel: { fontSize: "12px", fontWeight: "700", minWidth: "36px", textAlign: "right" },
};

