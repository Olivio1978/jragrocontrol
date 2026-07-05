import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";

// ============ CONSTANTES DE UI (idénticas al prototipo original) ============
const INCIDENCIAS = [
  { value: "ninguna", label: "Asistió", color: "#7fbf5a", icon: "✓" },
  { value: "falta", label: "Falta", color: "#e05c5c", icon: "✕" },
  { value: "permiso", label: "Permiso", color: "#e8a23d", icon: "P" },
  { value: "tardanza", label: "Tardanza", color: "#5a9bd4", icon: "T" },
];

function formatFecha(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Réplica de la regla de negocio para reflejar tardanza al instante en pantalla.
// El servidor recalcula lo mismo como fuente de verdad (trigger calcular_tardanza_asistencia).
function esTardanza(horaEntrada, tolerancia, horaActual) {
  const [hE, mE] = horaEntrada.split(":").map(Number);
  const [hA, mA] = horaActual.split(":").map(Number);
  const limiteMin = hE * 60 + mE + tolerancia;
  const actualMin = hA * 60 + mA;
  return actualMin > limiteMin;
}

// ============ PANTALLA DE ACCESO ============
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
        <div style={styles.eyebrow}>JR AGROCONTROL</div>
        <h1 style={styles.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.select} required />
          </div>
          <div style={{ ...styles.selectorGroup, marginTop: "12px" }}>
            <label style={styles.label}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.select} required />
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

export default function Asistencia() {
  // ---- Sesión y perfil ----
  const [sesion, setSesion] = useState(undefined); // undefined = verificando, null = sin sesión
  const [usuarioActual, setUsuarioActual] = useState(null); // { nombre, rol, rancho_id }

  // ---- Catálogos desde Supabase ----
  const [ranchos, setRanchos] = useState([]);
  const [infoTipoEmpleo, setInfoTipoEmpleo] = useState({}); // { [tipoEmpleoId]: { nombre, color, horaEntrada, tolerancia } }
  const [empleadosDelRancho, setEmpleadosDelRancho] = useState([]);

  // ---- Estado de la pantalla ----
  const [ranchoId, setRanchoId] = useState(null);
  const [fecha, setFecha] = useState(todayISO());
  const [registros, setRegistros] = useState({});
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- 1.b Reinicio de estado al cambiar de usuario ----
  // Corrige un caso real detectado en campo: si se cierra sesión y se entra
  // con otra cuenta (ej. admin -> encargado) SIN recargar la página, el
  // estado de React conservaba datos del usuario anterior (rancho, empleados,
  // marcas). Esto provocaba selector de rancho vacío y rechazo por RLS al
  // guardar, porque el rancho "atorado" en pantalla no correspondía al
  // usuario real. Este efecto limpia todo en cuanto detecta un cambio de
  // identidad (incluyendo logout), garantizando una sesión limpia cada vez.
  useEffect(() => {
    setUsuarioActual(null);
    setRanchoId(null);
    setRanchos([]);
    setInfoTipoEmpleo({});
    setEmpleadosDelRancho([]);
    setRegistros({});
    setEmpleadoDetalle(null);
    setGuardado(false);
    setErrorCarga("");
    setFecha(todayISO());
  }, [sesion?.user?.id]);

  // ---- 2. Perfil (rol y rancho asignado) ----
  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("usuarios")
      .select("nombre_completo, rol, rancho_id")
      .eq("id", sesion.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErrorCarga("Tu usuario no tiene perfil asignado. Pide a un administrador que te dé de alta en 'usuarios'.");
          return;
        }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol, rancho_id: data.rancho_id });
        if (data.rancho_id) setRanchoId(data.rancho_id);
      });
  }, [sesion]);

  // ---- 3. Catálogo de ranchos (RLS ya filtra: encargado solo ve el suyo) ----
  useEffect(() => {
    if (!usuarioActual) return;
    supabase
      .from("ranchos")
      .select("id, nombre, cultivo, ubicacion")
      .eq("activo", true)
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        setRanchos(data || []);
        setRanchoId((prev) => prev || (data && data[0]?.id) || null);
      });
  }, [usuarioActual]);

  // ---- 4. Tipos de empleo + horario configurado para el rancho activo ----
  useEffect(() => {
    if (!ranchoId) return;
    supabase
      .from("rancho_tipo_empleo")
      .select("hora_entrada, tolerancia_minutos, tipos_empleo(id, nombre, color)")
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        const info = {};
        (data || []).forEach((row) => {
          const t = row.tipos_empleo;
          info[t.id] = {
            nombre: t.nombre,
            color: t.color,
            horaEntrada: row.hora_entrada?.slice(0, 5),
            tolerancia: row.tolerancia_minutos,
          };
        });
        setInfoTipoEmpleo(info);
      });
  }, [ranchoId]);

  // ---- 5. Empleados del rancho activo ----
  useEffect(() => {
    if (!ranchoId) return;
    supabase
      .from("empleados")
      .select("id, nombre_completo, tipo_empleo_id")
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .order("nombre_completo")
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        setEmpleadosDelRancho(data || []);
      });
  }, [ranchoId]);

  // ---- 6. Asistencia existente para rancho + fecha ----
  useEffect(() => {
    if (!ranchoId || !fecha) return;
    setCargandoDatos(true);
    supabase
      .from("asistencia")
      .select("empleado_id, incidencia, jornada, observaciones, hora_registro")
      .eq("rancho_id", ranchoId)
      .eq("fecha", fecha)
      .then(({ data, error }) => {
        setCargandoDatos(false);
        if (error) { setErrorCarga(error.message); return; }
        const mapa = {};
        (data || []).forEach((r) => {
          mapa[r.empleado_id] = {
            incidencia: r.incidencia,
            jornada: r.jornada,
            observaciones: r.observaciones || "",
            horaRegistro: r.hora_registro?.slice(0, 5) || null,
          };
        });
        setRegistros(mapa);
      });
  }, [ranchoId, fecha]);

  const esHoy = fecha === todayISO();
  const puedeEditar = usuarioActual?.rol === "admin" || esHoy;

  const getRegistro = (empleadoId) =>
    registros[empleadoId] || { incidencia: null, jornada: "completa", observaciones: "", horaRegistro: null };

  const marcarRapido = (empleadoId, incidencia) => {
    if (!puedeEditar) return;
    let incidenciaFinal = incidencia;
    const horaRegistro = nowTime();

    if (incidencia === "ninguna" && esHoy) {
      const emp = empleadosDelRancho.find((e) => e.id === empleadoId);
      const info = infoTipoEmpleo[emp?.tipo_empleo_id];
      if (info && esTardanza(info.horaEntrada, info.tolerancia, horaRegistro)) {
        incidenciaFinal = "tardanza";
      }
    }

    setRegistros((prev) => ({
      ...prev,
      [empleadoId]: { ...getRegistro(empleadoId), incidencia: incidenciaFinal, horaRegistro },
    }));
    setGuardado(false);
  };

  const marcarTodos = (incidencia) => {
    if (!puedeEditar) return;
    const horaRegistro = nowTime();
    const nuevos = {};
    empleadosDelRancho.forEach((e) => {
      let incidenciaFinal = incidencia;
      if (incidencia === "ninguna" && esHoy) {
        const info = infoTipoEmpleo[e.tipo_empleo_id];
        if (info && esTardanza(info.horaEntrada, info.tolerancia, horaRegistro)) {
          incidenciaFinal = "tardanza";
        }
      }
      nuevos[e.id] = { ...getRegistro(e.id), incidencia: incidenciaFinal, horaRegistro };
    });
    setRegistros((prev) => ({ ...prev, ...nuevos }));
    setGuardado(false);
  };

  const actualizarDetalle = (empleadoId, campo, valor) => {
    if (!puedeEditar) return;
    setRegistros((prev) => ({
      ...prev,
      [empleadoId]: { ...getRegistro(empleadoId), [campo]: valor },
    }));
    setGuardado(false);
  };

  const totales = useMemo(() => {
    const t = { ninguna: 0, falta: 0, permiso: 0, tardanza: 0, sinMarcar: 0 };
    empleadosDelRancho.forEach((e) => {
      const r = getRegistro(e.id);
      if (!r.incidencia) t.sinMarcar++;
      else t[r.incidencia]++;
    });
    return t;
  }, [empleadosDelRancho, registros]);

  // ---- Guardar: sube en un solo lote los registros marcados en esta sesión ----
  const guardarTodo = async () => {
    const filas = empleadosDelRancho
      .filter((e) => registros[e.id]?.incidencia)
      .map((e) => ({
        empleado_id: e.id,
        fecha,
        hora_registro: registros[e.id].horaRegistro,
        incidencia: registros[e.id].incidencia,
        jornada: registros[e.id].jornada || "completa",
        observaciones: registros[e.id].observaciones || null,
      }));

    if (filas.length === 0) return;

    setGuardando(true);
    const { data, error } = await supabase
      .from("asistencia")
      .upsert(filas, { onConflict: "empleado_id,fecha" })
      .select("empleado_id, incidencia, jornada, observaciones, hora_registro");
    setGuardando(false);

    if (error) {
      setErrorCarga("No se pudo guardar (revisa tu conexión): " + error.message);
      return;
    }

    // Sincroniza con los valores confirmados por el servidor (ej. tardanza recalculada)
    const mapa = { ...registros };
    (data || []).forEach((r) => {
      mapa[r.empleado_id] = {
        incidencia: r.incidencia,
        jornada: r.jornada,
        observaciones: r.observaciones || "",
        horaRegistro: r.hora_registro?.slice(0, 5) || null,
      };
    });
    setRegistros(mapa);
    setGuardado(true);
    setErrorCarga("");
    setTimeout(() => setGuardado(false), 2500);
  };

  const ranchoActual = ranchos.find((r) => r.id === ranchoId);

  // Cierra la sesión de forma explícita. Es la vía correcta para cambiar de
  // usuario: dispara onAuthStateChange -> limpia el estado (ver efecto 1.b)
  // sin depender de que la persona recuerde recargar la página manualmente.
  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  // ---- Estados de carga / acceso ----
  if (sesion === undefined) {
    return <div style={styles.page}><div style={styles.container}>Cargando…</div></div>;
  }
  if (!sesion) {
    return <Login />;
  }
  if (!usuarioActual) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p>{errorCarga || "Cargando perfil…"}</p>
          {errorCarga && (
            <button onClick={cerrarSesion} style={{ ...styles.guardarBtn, marginTop: "16px" }}>
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>JR AGROCONTROL · ASISTENCIA</div>
            <h1 style={styles.title}>Control de Asistencia</h1>
            <div style={styles.usuarioTag}>
              {usuarioActual.nombre} · <span style={{ textTransform: "capitalize" }}>{usuarioActual.rol}</span>
              {" · "}
              <button onClick={cerrarSesion} style={styles.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={styles.headerIcon}>👷</div>
        </div>

        {errorCarga && (
          <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
            {errorCarga}
          </div>
        )}

        {/* Selectores */}
        <div style={styles.selectorsCard}>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>Rancho</label>
            <select
              value={ranchoId || ""}
              onChange={(e) => setRanchoId(e.target.value)}
              style={styles.select}
              disabled={usuarioActual.rol !== "admin" && !!usuarioActual.rancho_id}
            >
              {ranchos.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={styles.select} />
          </div>
        </div>

        <div style={styles.fechaTexto}>
          {formatFecha(fecha)}{cargandoDatos ? " · cargando…" : ""}
        </div>

        {!puedeEditar && (
          <div style={styles.avisoRestriccion}>
            🔒 Como <strong>encargado</strong> solo puedes capturar o modificar la asistencia del día de hoy.
            Para corregir fechas anteriores, pide a un administrador.
          </div>
        )}

        {/* Resumen */}
        <div style={styles.resumenRow}>
          <ResumenChip label="Asistió" count={totales.ninguna} color="#7fbf5a" />
          <ResumenChip label="Faltas" count={totales.falta} color="#e05c5c" />
          <ResumenChip label="Permiso" count={totales.permiso} color="#e8a23d" />
          <ResumenChip label="Tardanza" count={totales.tardanza} color="#5a9bd4" />
          <ResumenChip label="Sin marcar" count={totales.sinMarcar} color="rgba(255,255,255,0.3)" />
        </div>

        {/* Acciones rápidas para todos */}
        <div style={{ ...styles.quickActions, opacity: puedeEditar ? 1 : 0.4, pointerEvents: puedeEditar ? "auto" : "none" }}>
          <span style={styles.quickLabel}>Marcar todos como:</span>
          <div style={styles.quickButtons}>
            {INCIDENCIAS.map((inc) => (
              <button
                key={inc.value}
                onClick={() => marcarTodos(inc.value)}
                style={{ ...styles.quickBtn, borderColor: inc.color, color: inc.color }}
              >
                {inc.icon} {inc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de empleados */}
        <div style={{ ...styles.lista, opacity: puedeEditar ? 1 : 0.6 }}>
          {empleadosDelRancho.map((emp) => {
            const reg = getRegistro(emp.id);
            const tipoEmpleo = infoTipoEmpleo[emp.tipo_empleo_id] || { nombre: "—", color: "#999" };
            return (
              <div key={emp.id} style={styles.empleadoRow}>
                <div style={styles.empleadoInfo} onClick={() => setEmpleadoDetalle(emp.id)}>
                  <div style={{ ...styles.avatar, background: tipoEmpleo.color + "30", color: tipoEmpleo.color }}>
                    {emp.nombre_completo.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div style={styles.empleadoNombre}>{emp.nombre_completo}</div>
                    <div style={{ ...styles.empleadoTipo, color: tipoEmpleo.color }}>
                      {tipoEmpleo.nombre}
                      {reg.incidencia === "tardanza" && " · llegó tarde"}
                      {reg.horaRegistro && ` · ${reg.horaRegistro} hrs`}
                      {reg.observaciones && " · con nota"}
                    </div>
                  </div>
                </div>

                <div style={{ ...styles.botonesIncidencia, pointerEvents: puedeEditar ? "auto" : "none" }}>
                  {INCIDENCIAS.map((inc) => {
                    const activo = reg.incidencia === inc.value;
                    return (
                      <button
                        key={inc.value}
                        onClick={() => marcarRapido(emp.id, inc.value)}
                        style={{
                          ...styles.incBtn,
                          background: activo ? inc.color : "rgba(255,255,255,0.05)",
                          color: activo ? "#0f2818" : "rgba(232,245,224,0.4)",
                          borderColor: activo ? inc.color : "rgba(255,255,255,0.1)",
                        }}
                        title={inc.label}
                      >
                        {inc.icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!cargandoDatos && empleadosDelRancho.length === 0 && (
            <div style={styles.empty}>No hay empleados registrados en {ranchoActual?.nombre}</div>
          )}
        </div>

        {/* Botón guardar */}
        <button onClick={guardarTodo} disabled={guardando} style={styles.guardarBtn}>
          {guardando ? "Guardando…" : guardado ? "✓ Asistencia guardada" : "Guardar asistencia del día"}
        </button>
        <p style={styles.footerNote}>
          {empleadosDelRancho.length} empleados{ranchoActual?.ubicacion ? ` · ${ranchoActual.ubicacion}` : ""}
        </p>
      </div>

      {/* Modal de detalle */}
      {empleadoDetalle && (
        <DetalleModal
          empleado={empleadosDelRancho.find((e) => e.id === empleadoDetalle)}
          tipoEmpleo={infoTipoEmpleo[empleadosDelRancho.find((e) => e.id === empleadoDetalle)?.tipo_empleo_id] || { nombre: "—", color: "#999", horaEntrada: "--:--", tolerancia: 0 }}
          registro={getRegistro(empleadoDetalle)}
          onUpdate={(campo, valor) => actualizarDetalle(empleadoDetalle, campo, valor)}
          onClose={() => setEmpleadoDetalle(null)}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}

function ResumenChip({ label, count, color }) {
  return (
    <div style={{ ...styles.chip, borderColor: color + "40" }}>
      <div style={{ ...styles.chipCount, color }}>{count}</div>
      <div style={styles.chipLabel}>{label}</div>
    </div>
  );
}

function DetalleModal({ empleado, tipoEmpleo, registro, onUpdate, onClose, puedeEditar }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose}>✕</button>

        <div style={{ ...styles.modalAvatar, background: tipoEmpleo.color + "30", color: tipoEmpleo.color }}>
          {empleado.nombre_completo.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <h2 style={styles.modalNombre}>{empleado.nombre_completo}</h2>
        <div style={{ ...styles.modalTipo, color: tipoEmpleo.color }}>{tipoEmpleo.nombre}</div>
        <div style={styles.modalHorario}>
          Entrada: {tipoEmpleo.horaEntrada} hrs · Tolerancia: {tipoEmpleo.tolerancia} min
          {registro.horaRegistro && ` · Registrado a las ${registro.horaRegistro} hrs`}
        </div>

        <div style={styles.modalSection}>
          <label style={styles.label}>Asistencia</label>
          <div style={styles.modalIncidencias}>
            {INCIDENCIAS.map((inc) => {
              const activo = registro.incidencia === inc.value;
              return (
                <button
                  key={inc.value}
                  onClick={() => onUpdate("incidencia", inc.value)}
                  style={{
                    ...styles.modalIncBtn,
                    background: activo ? inc.color : "rgba(255,255,255,0.05)",
                    color: activo ? "#0f2818" : "rgba(232,245,224,0.6)",
                    borderColor: activo ? inc.color : "rgba(255,255,255,0.15)",
                  }}
                >
                  {inc.icon} {inc.label}
                </button>
              );
            })}
          </div>
        </div>

        {registro.incidencia === "ninguna" || registro.incidencia === "tardanza" ? (
          <div style={styles.modalSection}>
            <label style={styles.label}>Tipo de jornada</label>
            <div style={styles.jornadaButtons}>
              <button
                onClick={() => onUpdate("jornada", "completa")}
                style={{
                  ...styles.jornadaBtn,
                  background: registro.jornada === "completa" ? "rgba(127,191,90,0.18)" : "transparent",
                  borderColor: registro.jornada === "completa" ? "#7fbf5a" : "rgba(255,255,255,0.15)",
                  color: registro.jornada === "completa" ? "#c8e89a" : "rgba(232,245,224,0.5)",
                }}
              >
                Jornada completa
              </button>
              <button
                onClick={() => onUpdate("jornada", "media")}
                style={{
                  ...styles.jornadaBtn,
                  background: registro.jornada === "media" ? "rgba(127,191,90,0.18)" : "transparent",
                  borderColor: registro.jornada === "media" ? "#7fbf5a" : "rgba(255,255,255,0.15)",
                  color: registro.jornada === "media" ? "#c8e89a" : "rgba(232,245,224,0.5)",
                }}
              >
                Media jornada
              </button>
            </div>
          </div>
        ) : null}

        <div style={styles.modalSection}>
          <label style={styles.label}>Observaciones</label>
          <textarea
            value={registro.observaciones}
            onChange={(e) => onUpdate("observaciones", e.target.value)}
            placeholder="Notas sobre este registro..."
            style={styles.textarea}
          />
        </div>

        <button onClick={onClose} style={styles.modalGuardar}>
          Listo
        </button>
      </div>
    </div>
  );
}

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
  },
  avisoRestriccion: {
    background: "rgba(232,162,61,0.12)",
    border: "1px solid rgba(232,162,61,0.3)",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#e8a23d",
    marginBottom: "16px",
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
  resumenRow: { display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" },
  chip: { flex: "1 0 auto", minWidth: "70px", background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: "12px", padding: "10px 12px", textAlign: "center" },
  chipCount: { fontSize: "20px", fontWeight: "800" },
  chipLabel: { fontSize: "10px", color: "rgba(200,230,180,0.5)", marginTop: "2px" },
  quickActions: { marginBottom: "16px" },
  quickLabel: { fontSize: "12px", color: "rgba(200,230,180,0.5)", marginBottom: "8px", display: "block" },
  quickButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  quickBtn: { background: "transparent", border: "1.5px solid", borderRadius: "999px", padding: "7px 14px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  lista: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  empleadoRow: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  empleadoInfo: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", flex: 1, minWidth: 0 },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 },
  empleadoNombre: { fontSize: "14px", fontWeight: "600", color: "#e8f5e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empleadoTipo: { fontSize: "11px", marginTop: "2px" },
  botonesIncidencia: { display: "flex", gap: "5px", flexShrink: 0 },
  incBtn: { width: "30px", height: "30px", borderRadius: "8px", border: "1.5px solid", fontSize: "12px", fontWeight: "700", cursor: "pointer" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
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
  },
  footerNote: { textAlign: "center", fontSize: "11px", color: "rgba(200,230,180,0.3)", marginTop: "10px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modal: {
    background: "linear-gradient(160deg, #1a3d25, #0f2818)",
    border: "1px solid rgba(127,191,90,0.25)",
    borderRadius: "24px 24px 0 0",
    padding: "28px 24px",
    width: "100%",
    maxWidth: "480px",
    maxHeight: "85vh",
    overflowY: "auto",
    position: "relative",
    boxSizing: "border-box",
  },
  modalClose: { position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "999px", width: "32px", height: "32px", color: "#e8f5e0", fontSize: "14px", cursor: "pointer" },
  modalAvatar: { width: "56px", height: "56px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700", margin: "0 auto 12px" },
  modalNombre: { fontSize: "18px", fontWeight: "700", textAlign: "center", margin: "0 0 4px", color: "#ffffff" },
  modalTipo: { fontSize: "12px", textAlign: "center", fontWeight: "600", marginBottom: "8px" },
  modalHorario: { fontSize: "11px", textAlign: "center", color: "rgba(200,230,180,0.45)", marginBottom: "24px" },
  modalSection: { marginBottom: "20px" },
  modalIncidencias: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  modalIncBtn: { border: "1.5px solid", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  jornadaButtons: { display: "flex", gap: "8px" },
  jornadaBtn: { flex: 1, border: "1.5px solid", borderRadius: "10px", padding: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  textarea: {
    width: "100%",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(127,191,90,0.25)",
    borderRadius: "10px",
    padding: "10px 12px",
    color: "#e8f5e0",
    fontSize: "13px",
    minHeight: "70px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  modalGuardar: {
    width: "100%",
    background: "linear-gradient(135deg, #5aab2e, #3d8c1a)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
  },
};

