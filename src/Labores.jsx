import { useState, useMemo } from "react";

// ============ DATOS DE PRUEBA ============
const ranchosPrueba = [
  { id: 1, nombre: "El Milagro - Zarzamora", parcela: "Parcela 1" },
  { id: 2, nombre: "El Milagro - Frambuesa Sunset", parcela: "Parcela 2A" },
  { id: 3, nombre: "El Milagro - Frambuesa Driscoll", parcela: "Parcela 2B" },
];

const sectoresPrueba = [
  { id: 1, ranchoId: 1, nombre: "Sector 1", hectareas: 0.5 },
  { id: 2, ranchoId: 1, nombre: "Sector 2", hectareas: 0.5 },
  { id: 3, ranchoId: 2, nombre: "Sector 1", hectareas: 0.5 },
  { id: 4, ranchoId: 2, nombre: "Sector 2", hectareas: 0.5 },
  { id: 5, ranchoId: 2, nombre: "Sector 3", hectareas: 0.5 },
  { id: 6, ranchoId: 3, nombre: "Sector 4", hectareas: 0.5 },
  { id: 7, ranchoId: 3, nombre: "Sector 5", hectareas: 0.5 },
  { id: 8, ranchoId: 3, nombre: "Sector 6", hectareas: 0.5 },
];

const tunelesPrueba = [
  { id: 1, sectorId: 1, numero: "T-1" }, { id: 2, sectorId: 1, numero: "T-2" },
  { id: 3, sectorId: 1, numero: "T-3" }, { id: 4, sectorId: 2, numero: "T-1" },
  { id: 5, sectorId: 2, numero: "T-2" }, { id: 6, sectorId: 3, numero: "T-1" },
  { id: 7, sectorId: 3, numero: "T-2" }, { id: 8, sectorId: 3, numero: "T-3" },
  { id: 9, sectorId: 4, numero: "T-1" }, { id: 10, sectorId: 4, numero: "T-2" },
  { id: 11, sectorId: 5, numero: "T-1" }, { id: 12, sectorId: 6, numero: "T-1" },
  { id: 13, sectorId: 6, numero: "T-2" }, { id: 14, sectorId: 7, numero: "T-1" },
  { id: 15, sectorId: 8, numero: "T-1" }, { id: 16, sectorId: 8, numero: "T-2" },
];

const empleadosPrueba = [
  { id: 1, nombre: "Juan Pérez Hernández", ranchoId: 1 },
  { id: 2, nombre: "María López Sánchez", ranchoId: 1 },
  { id: 3, nombre: "Roberto Gómez Díaz", ranchoId: 1 },
  { id: 4, nombre: "Pedro Ramírez Soto", ranchoId: 2 },
  { id: 5, nombre: "Guadalupe Torres Vega", ranchoId: 2 },
  { id: 6, nombre: "Francisco Morales Rey", ranchoId: 3 },
  { id: 7, nombre: "Rosa Elena Vázquez", ranchoId: 3 },
];

const laborCatalogoPrueba = [
  { id: 1, nombre: "Poda", unidadPago: "tarea", color: "#7fbf5a", icono: "✂️" },
  { id: 2, nombre: "Deshierbe", unidadPago: "dia", color: "#e8a23d", icono: "🌿" },
  { id: 3, nombre: "Tutorado", unidadPago: "tarea", color: "#5a9bd4", icono: "🪢" },
  { id: 4, nombre: "Despunte", unidadPago: "tarea", color: "#c468d4", icono: "🌱" },
  { id: 5, nombre: "Aplicación foliar", unidadPago: "dia", color: "#e05c5c", icono: "💧" },
  { id: 6, nombre: "Riego manual", unidadPago: "dia", color: "#5ad4c4", icono: "🚿" },
];

const tareasCatalogoPrueba = [
  { id: 1, laborId: 1, nombre: "Tarea poda", equivalencia: 4, unidadEquivalencia: "surcos", valorTarea: 80 },
  { id: 2, laborId: 3, nombre: "Tarea tutorado", equivalencia: 6, unidadEquivalencia: "surcos", valorTarea: 70 },
  { id: 3, laborId: 4, nombre: "Tarea despunte", equivalencia: 5, unidadEquivalencia: "surcos", valorTarea: 60 },
];

const usuarioActual = { nombre: "Olivio Jiménez", rol: "admin" };

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function formatFecha(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const VISTAS = { registro: "registro", catalogo: "catalogo", avance: "avance" };

export default function Labores() {
  const [vista, setVista] = useState(VISTAS.registro);
  const [ranchoId, setRanchoId] = useState(1);
  const [fecha, setFecha] = useState(todayISO());
  const [registros, setRegistros] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editandoLabor, setEditandoLabor] = useState(null);
  const [showCatalogoForm, setShowCatalogoForm] = useState(false);
  const [catalogoLabores, setCatalogoLabores] = useState(laborCatalogoPrueba);
  const [catalogoTareas, setCatalogoTareas] = useState(tareasCatalogoPrueba);

  const sectoresRancho = useMemo(() => sectoresPrueba.filter(s => s.ranchoId === ranchoId), [ranchoId]);
  const empleadosRancho = useMemo(() => empleadosPrueba.filter(e => e.ranchoId === ranchoId), [ranchoId]);
  const registrosRancho = useMemo(() => registros.filter(r => r.ranchoId === ranchoId), [registros, ranchoId]);
  const registrosFecha = useMemo(() => registrosRancho.filter(r => r.fecha === fecha), [registrosRancho, fecha]);

  const agregarRegistro = (reg) => {
    if (editandoLabor !== null) {
      setRegistros(prev => prev.map((r, i) => i === editandoLabor ? reg : r));
      setEditandoLabor(null);
    } else {
      setRegistros(prev => [...prev, { ...reg, ranchoId, fecha, id: Date.now() }]);
    }
    setShowForm(false);
  };

  const eliminarRegistro = (idx) => {
    setRegistros(prev => prev.filter((_, i) => i !== idx));
  };

  const ranchoActual = ranchosPrueba.find(r => r.id === ranchoId);

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · LABORES</div>
            <h1 style={S.title}>Control de Labores</h1>
            <div style={S.usuarioTag}>{usuarioActual.nombre} · {usuarioActual.rol}</div>
          </div>
          <div style={S.headerIcon}>🌾</div>
        </div>

        {/* Navegación de vistas */}
        <div style={S.navTabs}>
          {[
            { key: VISTAS.registro, label: "📋 Registro" },
            { key: VISTAS.avance, label: "📊 Avance" },
            { key: VISTAS.catalogo, label: "📚 Catálogo" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setVista(tab.key)}
              style={{
                ...S.navTab,
                background: vista === tab.key ? "rgba(127,191,90,0.18)" : "transparent",
                color: vista === tab.key ? "#c8e89a" : "rgba(200,230,180,0.45)",
                borderColor: vista === tab.key ? "#7fbf5a" : "transparent",
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* Selectores de rancho y fecha */}
        {vista !== VISTAS.catalogo && (
          <div style={S.selectorsCard}>
            <div style={S.selectorGroup}>
              <label style={S.label}>Rancho</label>
              <select value={ranchoId} onChange={e => setRanchoId(Number(e.target.value))} style={S.select}>
                {ranchosPrueba.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {vista === VISTAS.registro && (
              <div style={S.selectorGroup}>
                <label style={S.label}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={S.select} />
              </div>
            )}
          </div>
        )}

        {vista === VISTAS.registro && (
          <VistaRegistro
            fecha={fecha}
            registros={registrosFecha}
            catalogoLabores={catalogoLabores}
            sectores={sectoresRancho}
            tuneles={tunelesPrueba}
            empleados={empleadosRancho}
            catalogoTareas={catalogoTareas}
            showForm={showForm}
            setShowForm={setShowForm}
            editandoIdx={editandoLabor}
            setEditandoIdx={setEditandoLabor}
            onGuardar={agregarRegistro}
            onEliminar={eliminarRegistro}
            registrosTotales={registros}
          />
        )}

        {vista === VISTAS.avance && (
          <VistaAvance
            sectores={sectoresRancho}
            tuneles={tunelesPrueba}
            registros={registrosRancho}
            catalogoLabores={catalogoLabores}
            ranchoNombre={ranchoActual?.nombre}
          />
        )}

        {vista === VISTAS.catalogo && (
          <VistaCatalogo
            labores={catalogoLabores}
            tareas={catalogoTareas}
            setLabores={setCatalogoLabores}
            setTareas={setCatalogoTareas}
            showForm={showCatalogoForm}
            setShowForm={setShowCatalogoForm}
          />
        )}
      </div>
    </div>
  );
}

// ============ VISTA REGISTRO ============
function VistaRegistro({ fecha, registros, catalogoLabores, sectores, tuneles, empleados, catalogoTareas, showForm, setShowForm, editandoIdx, setEditandoIdx, onGuardar, onEliminar, registrosTotales }) {
  const [form, setForm] = useState({ laborId: "", sectorId: "", tunelId: "", empleadoId: "", cantidadTareas: 1, porcentajeAvance: 0, observaciones: "" });

  const tunelesSector = useMemo(() => tuneles.filter(t => t.sectorId === Number(form.sectorId)), [tuneles, form.sectorId]);
  const tareaLabor = useMemo(() => catalogoTareas.find(t => t.laborId === Number(form.laborId)), [catalogoTareas, form.laborId]);
  const laborSeleccionada = useMemo(() => catalogoLabores.find(l => l.id === Number(form.laborId)), [catalogoLabores, form.laborId]);

  const abrirNuevo = () => {
    setForm({ laborId: "", sectorId: "", tunelId: "", empleadoId: "", cantidadTareas: 1, porcentajeAvance: 0, observaciones: "" });
    setEditandoIdx(null);
    setShowForm(true);
  };

  const handleGuardar = () => {
    if (!form.laborId || !form.sectorId || !form.tunelId || !form.empleadoId) return;
    onGuardar({ ...form, fecha });
  };

  const labor = (id) => catalogoLabores.find(l => l.id === Number(id));
  const sector = (id) => sectores.find(s => s.id === Number(id));
  const tunel = (id) => tuneles.find(t => t.id === Number(id));
  const empleado = (id) => empleados.find(e => e.id === Number(id));

  return (
    <>
      <div style={S.fechaTexto}>{formatFecha(fecha)}</div>

      <div style={S.resumenRow}>
        <div style={S.chip}>
          <div style={{ ...S.chipCount, color: "#7fbf5a" }}>{registros.length}</div>
          <div style={S.chipLabel}>Registros hoy</div>
        </div>
        <div style={S.chip}>
          <div style={{ ...S.chipCount, color: "#e8a23d" }}>
            {[...new Set(registros.map(r => r.empleadoId))].length}
          </div>
          <div style={S.chipLabel}>Empleados</div>
        </div>
        <div style={S.chip}>
          <div style={{ ...S.chipCount, color: "#5a9bd4" }}>
            {[...new Set(registros.map(r => r.laborId))].length}
          </div>
          <div style={S.chipLabel}>Labores distintas</div>
        </div>
      </div>

      <button onClick={abrirNuevo} style={S.btnPrimary}>+ Agregar registro</button>

      <div style={S.lista}>
        {registros.length === 0 && (
          <div style={S.empty}>No hay registros para esta fecha. Toca "Agregar registro" para comenzar.</div>
        )}
        {registros.map((reg, idx) => {
          const l = labor(reg.laborId);
          const s = sector(reg.sectorId);
          const t = tunel(reg.tunelId);
          const e = empleado(reg.empleadoId);
          return (
            <div key={idx} style={S.card}>
              <div style={S.cardTop}>
                <div style={{ ...S.laborBadge, background: (l?.color || "#888") + "25", color: l?.color || "#888" }}>
                  {l?.icono} {l?.nombre}
                </div>
                <div style={S.cardAcciones}>
                  <button onClick={() => onEliminar(idx)} style={S.btnIcono}>🗑</button>
                </div>
              </div>
              <div style={S.cardBody}>
                <div style={S.cardRow}><span style={S.cardLabel}>Empleado</span><span>{e?.nombre}</span></div>
                <div style={S.cardRow}><span style={S.cardLabel}>Sector</span><span>{s?.nombre} · {t?.numero}</span></div>
                {l?.unidadPago === "tarea" && (
                  <div style={S.cardRow}><span style={S.cardLabel}>Tareas</span><span>{reg.cantidadTareas}</span></div>
                )}
                <div style={S.cardRow}>
                  <span style={S.cardLabel}>Avance</span>
                  <span style={{ color: "#7fbf5a", fontWeight: 700 }}>{reg.porcentajeAvance}%</span>
                </div>
                {reg.observaciones && (
                  <div style={S.cardRow}><span style={S.cardLabel}>Nota</span><span style={{ color: "rgba(200,230,180,0.6)" }}>{reg.observaciones}</span></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div style={S.modalOverlay} onClick={() => setShowForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>Nuevo registro de labor</h2>

            <div style={S.formGroup}>
              <label style={S.label}>Labor</label>
              <select value={form.laborId} onChange={e => setForm({ ...form, laborId: e.target.value, tunelId: "" })} style={S.select}>
                <option value="">Seleccionar labor...</option>
                {catalogoLabores.map(l => <option key={l.id} value={l.id}>{l.icono} {l.nombre}</option>)}
              </select>
            </div>

            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>Sector</label>
                <select value={form.sectorId} onChange={e => setForm({ ...form, sectorId: e.target.value, tunelId: "" })} style={S.select}>
                  <option value="">Sector...</option>
                  {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Túnel</label>
                <select value={form.tunelId} onChange={e => setForm({ ...form, tunelId: e.target.value })} style={S.select} disabled={!form.sectorId}>
                  <option value="">Túnel...</option>
                  {tunelesSector.map(t => <option key={t.id} value={t.id}>{t.numero}</option>)}
                </select>
              </div>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Empleado</label>
              <select value={form.empleadoId} onChange={e => setForm({ ...form, empleadoId: e.target.value })} style={S.select}>
                <option value="">Seleccionar empleado...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            {laborSeleccionada?.unidadPago === "tarea" && tareaLabor && (
              <div style={S.formGroup}>
                <label style={S.label}>Tareas realizadas <span style={{ color: "rgba(200,230,180,0.4)", fontWeight: 400 }}>({tareaLabor.equivalencia} {tareaLabor.unidadEquivalencia} = 1 tarea)</span></label>
                <input type="number" min="0" step="0.5" value={form.cantidadTareas}
                  onChange={e => setForm({ ...form, cantidadTareas: e.target.value })} style={S.select} />
              </div>
            )}

            <div style={S.formGroup}>
              <label style={S.label}>% de avance en el túnel</label>
              <div style={S.sliderRow}>
                <input type="range" min="0" max="100" step="5" value={form.porcentajeAvance}
                  onChange={e => setForm({ ...form, porcentajeAvance: Number(e.target.value) })}
                  style={{ flex: 1 }} />
                <span style={{ ...S.porcentajeLabel, color: "#7fbf5a" }}>{form.porcentajeAvance}%</span>
              </div>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Observaciones <span style={{ color: "rgba(200,230,180,0.4)", fontWeight: 400 }}>(opcional)</span></label>
              <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas adicionales..." style={S.textarea} />
            </div>

            <button onClick={handleGuardar} style={S.btnPrimary}>Guardar registro</button>
          </div>
        </div>
      )}
    </>
  );
}

// ============ VISTA AVANCE ============
function VistaAvance({ sectores, tuneles, registros, catalogoLabores, ranchoNombre }) {
  const [laborFiltro, setLaborFiltro] = useState("");

  const laboresUsadas = useMemo(() => {
    const ids = [...new Set(registros.map(r => r.laborId))];
    return catalogoLabores.filter(l => ids.includes(String(l.id)) || ids.includes(l.id));
  }, [registros, catalogoLabores]);

  const registrosFiltrados = useMemo(() =>
    laborFiltro ? registros.filter(r => String(r.laborId) === laborFiltro) : registros,
    [registros, laborFiltro]
  );

  return (
    <>
      <div style={S.avanceHeader}>
        <div style={S.avanceTitulo}>{ranchoNombre}</div>
        <select value={laborFiltro} onChange={e => setLaborFiltro(e.target.value)} style={{ ...S.select, maxWidth: "200px" }}>
          <option value="">Todas las labores</option>
          {laboresUsadas.map(l => <option key={l.id} value={l.id}>{l.icono} {l.nombre}</option>)}
        </select>
      </div>

      {sectores.length === 0 && <div style={S.empty}>No hay sectores para este rancho.</div>}

      {sectores.map(sector => {
        const tunelesSector = tuneles.filter(t => t.sectorId === sector.id);
        return (
          <div key={sector.id} style={S.sectorCard}>
            <div style={S.sectorNombre}>{sector.nombre}</div>
            {tunelesSector.map(tunel => {
              const regsTunel = registrosFiltrados.filter(r => Number(r.tunelId) === tunel.id);
              const maxAvance = regsTunel.length > 0 ? Math.max(...regsTunel.map(r => Number(r.porcentajeAvance))) : 0;
              const laboresEnTunel = [...new Set(regsTunel.map(r => r.laborId))];

              return (
                <div key={tunel.id} style={S.tunelRow}>
                  <div style={S.tunelInfo}>
                    <span style={S.tunelLabel}>{tunel.numero}</span>
                    <div style={S.laborTags}>
                      {laboresEnTunel.map(lid => {
                        const l = catalogoLabores.find(x => String(x.id) === String(lid));
                        return l ? (
                          <span key={lid} style={{ ...S.miniTag, background: l.color + "25", color: l.color }}>
                            {l.icono} {l.nombre}
                          </span>
                        ) : null;
                      })}
                      {laboresEnTunel.length === 0 && <span style={S.sinLabor}>Sin registros</span>}
                    </div>
                  </div>
                  <div style={S.barraContainer}>
                    <div style={S.barraFondo}>
                      <div style={{
                        ...S.barraRelleno,
                        width: `${maxAvance}%`,
                        background: maxAvance === 100 ? "#7fbf5a" : maxAvance > 50 ? "#e8a23d" : "#5a9bd4",
                      }} />
                    </div>
                    <span style={{ ...S.barraLabel, color: maxAvance === 100 ? "#7fbf5a" : "#e8f5e0" }}>
                      {maxAvance}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ============ VISTA CATÁLOGO ============
function VistaCatalogo({ labores, tareas, setLabores, setTareas, showForm, setShowForm }) {
  const [formLabor, setFormLabor] = useState({ nombre: "", unidadPago: "dia", icono: "🌿" });
  const [laborSelec, setLaborSelec] = useState(null);
  const [formTarea, setFormTarea] = useState({ nombre: "", equivalencia: 1, unidadEquivalencia: "surcos", valorTarea: 0 });

  const guardarLabor = () => {
    if (!formLabor.nombre) return;
    const colores = ["#7fbf5a", "#e8a23d", "#5a9bd4", "#c468d4", "#e05c5c", "#5ad4c4"];
    setLabores(prev => [...prev, { ...formLabor, id: Date.now(), color: colores[prev.length % colores.length] }]);
    setFormLabor({ nombre: "", unidadPago: "dia", icono: "🌿" });
    setShowForm(false);
  };

  const guardarTarea = () => {
    if (!laborSelec || !formTarea.nombre) return;
    setTareas(prev => [...prev, { ...formTarea, id: Date.now(), laborId: laborSelec }]);
    setFormTarea({ nombre: "", equivalencia: 1, unidadEquivalencia: "surcos", valorTarea: 0 });
    setLaborSelec(null);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={S.seccionTitulo}>Labores registradas</div>
        <button onClick={() => setShowForm(true)} style={S.btnSecundario}>+ Nueva labor</button>
      </div>

      {labores.map(labor => {
        const tareasLabor = tareas.filter(t => t.laborId === labor.id);
        return (
          <div key={labor.id} style={S.card}>
            <div style={S.cardTop}>
              <div style={{ ...S.laborBadge, background: labor.color + "25", color: labor.color }}>
                {labor.icono} {labor.nombre}
              </div>
              <span style={{ ...S.unidadTag, color: "rgba(200,230,180,0.5)" }}>
                {labor.unidadPago === "tarea" ? "Por tarea" : labor.unidadPago === "dia" ? "Por día" : "Por hora"}
              </span>
            </div>

            {labor.unidadPago === "tarea" && (
              <div style={{ marginTop: "10px" }}>
                {tareasLabor.length === 0 && (
                  <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.35)", marginBottom: "8px" }}>
                    Sin equivalencias definidas
                  </div>
                )}
                {tareasLabor.map(t => (
                  <div key={t.id} style={S.tareaRow}>
                    <span style={{ fontSize: "12px", color: "rgba(200,230,180,0.7)" }}>
                      1 tarea = {t.equivalencia} {t.unidadEquivalencia}
                    </span>
                    <span style={{ fontSize: "12px", color: "#7fbf5a", fontWeight: 700 }}>
                      ${t.valorTarea}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => setLaborSelec(labor.id)}
                  style={S.btnMiniLink}
                >
                  + Agregar equivalencia
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal nueva labor */}
      {showForm && (
        <div style={S.modalOverlay} onClick={() => setShowForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setShowForm(false)}>✕</button>
            <h2 style={S.modalTitulo}>Nueva labor</h2>
            <div style={S.formGroup}>
              <label style={S.label}>Nombre</label>
              <input value={formLabor.nombre} onChange={e => setFormLabor({ ...formLabor, nombre: e.target.value })}
                placeholder="Ej: Poda, Deshierbe..." style={S.select} />
            </div>
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>Unidad de pago</label>
                <select value={formLabor.unidadPago} onChange={e => setFormLabor({ ...formLabor, unidadPago: e.target.value })} style={S.select}>
                  <option value="dia">Por día</option>
                  <option value="tarea">Por tarea</option>
                  <option value="hora">Por hora</option>
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Ícono</label>
                <select value={formLabor.icono} onChange={e => setFormLabor({ ...formLabor, icono: e.target.value })} style={S.select}>
                  {["✂️","🌿","🪢","🌱","💧","🚿","🔧","⛏️","🧹","🌾"].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <button onClick={guardarLabor} style={S.btnPrimary}>Guardar labor</button>
          </div>
        </div>
      )}

      {/* Modal equivalencia de tarea */}
      {laborSelec && (
        <div style={S.modalOverlay} onClick={() => setLaborSelec(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setLaborSelec(null)}>✕</button>
            <h2 style={S.modalTitulo}>Equivalencia de tarea</h2>
            <div style={S.formGroup}>
              <label style={S.label}>Nombre de la tarea</label>
              <input value={formTarea.nombre} onChange={e => setFormTarea({ ...formTarea, nombre: e.target.value })}
                placeholder="Ej: Tarea de poda" style={S.select} />
            </div>
            <div style={S.formRow}>
              <div style={S.formGroup}>
                <label style={S.label}>Equivalencia</label>
                <input type="number" value={formTarea.equivalencia} onChange={e => setFormTarea({ ...formTarea, equivalencia: e.target.value })} style={S.select} />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Unidad</label>
                <select value={formTarea.unidadEquivalencia} onChange={e => setFormTarea({ ...formTarea, unidadEquivalencia: e.target.value })} style={S.select}>
                  <option value="surcos">Surcos</option>
                  <option value="plantas">Plantas</option>
                  <option value="metros">Metros</option>
                </select>
              </div>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Valor por tarea ($)</label>
              <input type="number" value={formTarea.valorTarea} onChange={e => setFormTarea({ ...formTarea, valorTarea: e.target.value })} style={S.select} />
            </div>
            <button onClick={guardarTarea} style={S.btnPrimary}>Guardar equivalencia</button>
          </div>
        </div>
      )}
    </>
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
  navTab: { flex: 1, border: "1.5px solid", borderRadius: "10px", padding: "10px 8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
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
  sliderRow: { display: "flex", alignItems: "center", gap: "12px" },
  porcentajeLabel: { fontSize: "18px", fontWeight: "700", minWidth: "45px", textAlign: "right" },
  textarea: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "13px", minHeight: "70px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  seccionTitulo: { fontSize: "14px", fontWeight: "700", color: "#ffffff" },
  avanceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" },
  avanceTitulo: { fontSize: "14px", fontWeight: "700", color: "rgba(200,230,180,0.7)" },
  sectorCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" },
  sectorNombre: { fontSize: "14px", fontWeight: "700", color: "#ffffff", marginBottom: "12px" },
  tunelRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" },
  tunelInfo: { minWidth: "120px" },
  tunelLabel: { fontSize: "12px", fontWeight: "600", color: "rgba(200,230,180,0.6)", display: "block", marginBottom: "4px" },
  laborTags: { display: "flex", flexWrap: "wrap", gap: "4px" },
  miniTag: { fontSize: "10px", padding: "2px 7px", borderRadius: "999px", fontWeight: "600" },
  sinLabor: { fontSize: "10px", color: "rgba(200,230,180,0.25)" },
  barraContainer: { flex: 1, display: "flex", alignItems: "center", gap: "8px" },
  barraFondo: { flex: 1, height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" },
  barraRelleno: { height: "100%", borderRadius: "999px", transition: "width 0.4s ease" },
  barraLabel: { fontSize: "12px", fontWeight: "700", minWidth: "36px", textAlign: "right" },
};
