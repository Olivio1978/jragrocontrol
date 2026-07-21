// ============ JR AGROCONTROL — Asistencia.jsx v1.1 ============
// v1.1: se incorpora el Reporte Semanal como pestaña interna (antes vivía
// en el módulo/botón "Reporte" separado, ahora fusionado aquí porque solo
// tiene sentido dentro de Asistencia). Exclusivo para admin, igual que antes.
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

// Misma lógica que esTardanza, mas en sentido inverso: se sale ANTES del
// límite (hora de salida programada - tolerancia). El servidor recalcula lo
// mismo como fuente de verdad (trigger calcular_salida_anticipada_asistencia).
function esSalidaAnticipada(horaSalida, tolerancia, horaActual) {
  if (!horaSalida) return false;
  const [hS, mS] = horaSalida.split(":").map(Number);
  const [hA, mA] = horaActual.split(":").map(Number);
  const limiteMin = hS * 60 + mS - tolerancia;
  const actualMin = hA * 60 + mA;
  return actualMin < limiteMin;
}

// ============ Utilidades del Reporte Semanal (pestaña de admin) ============
const DIAS_SEMANA = [
  { corta: "L", larga: "Lunes" },
  { corta: "M", larga: "Martes" },
  { corta: "M", larga: "Miércoles" },
  { corta: "J", larga: "Jueves" },
  { corta: "V", larga: "Viernes" },
  { corta: "S", larga: "Sábado" },
  { corta: "D", larga: "Domingo" },
];

const COLOR_INCIDENCIA = {
  ninguna: "#7fbf5a",
  tardanza: "#5a9bd4",
  falta: "#e05c5c",
  permiso: "#e8a23d",
  sinMarcar: "rgba(255,255,255,0.15)",
};

function formatISO(d) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function lunesDeSemana(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDay(); // 0 = domingo
  const offset = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + offset);
  return d;
}

function sumarDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

function hoyISO() {
  return formatISO(new Date());
}

function money(n) {
  return "$" + (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Toda la regla de negocio del cálculo de nómina de un día vive aquí, en un
// solo lugar fácil de ajustar.
function calcularDia(registro, config, tarifas, esFestivo, esDomingo) {
  if (!registro) {
    return { incidencia: null, montoDia: 0, horasExtraSugeridas: 0, horasExtraAutorizadas: null };
  }

  const trabajado = registro.incidencia === "ninguna" || registro.incidencia === "tardanza";
  const factorJornada = registro.jornada === "media" ? 0.5 : 1;

  let montoDia = 0;
  if (trabajado && config?.salario_diario != null) {
    let multiplicador = 1;
    if (esFestivo) multiplicador = tarifas.tarifa_festivo_multiplicador;
    else if (esDomingo) multiplicador = 1 + tarifas.tarifa_dominical_pct / 100;
    montoDia = config.salario_diario * factorJornada * multiplicador;
  }

  let horasExtraSugeridas = 0;
  if (registro.hora_salida_real && config?.hora_salida && registro.jornada === "completa") {
    const [hR, mR] = registro.hora_salida_real.slice(0, 5).split(":").map(Number);
    const [hP, mP] = config.hora_salida.slice(0, 5).split(":").map(Number);
    const diffMin = (hR * 60 + mR) - (hP * 60 + mP);
    if (diffMin > 0) horasExtraSugeridas = Math.round((diffMin / 60) * 100) / 100;
  }

  return {
    incidencia: registro.incidencia,
    horaRegistro: registro.hora_registro?.slice(0, 5) || null,
    horaSalidaReal: registro.hora_salida_real?.slice(0, 5) || null,
    montoDia,
    horasExtraSugeridas,
    horasExtraAutorizadas: registro.horas_extra_autorizadas,
  };
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
  const [pestana, setPestana] = useState("captura"); // "captura" | "reporte" (reporte exclusivo admin)

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
    setPestana("captura");
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
      .select("hora_entrada, hora_salida, tolerancia_minutos, tipos_empleo(id, nombre, color)")
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
            horaSalida: row.hora_salida?.slice(0, 5),
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
      .select("empleado_id, incidencia, jornada, observaciones, hora_registro, hora_salida_real, salida_anticipada")
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
            horaSalida: r.hora_salida_real?.slice(0, 5) || null,
            salidaAnticipada: r.salida_anticipada || false,
          };
        });
        setRegistros(mapa);
      });
  }, [ranchoId, fecha]);

  const esHoy = fecha === todayISO();
  const puedeEditar = usuarioActual?.rol === "admin" || esHoy;

  const getRegistro = (empleadoId) =>
    registros[empleadoId] || {
      incidencia: null, jornada: "completa", observaciones: "",
      horaRegistro: null, horaSalida: null, salidaAnticipada: false,
    };

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

  // Marca la hora de salida real de un empleado (toque individual, como
  // haría el encargado al ver que esa persona se retira del rancho).
  const marcarSalida = (empleadoId) => {
    if (!puedeEditar) return;
    const horaSalida = nowTime();
    const emp = empleadosDelRancho.find((e) => e.id === empleadoId);
    const info = infoTipoEmpleo[emp?.tipo_empleo_id];
    const salidaAnticipada = info ? esSalidaAnticipada(info.horaSalida, info.tolerancia, horaSalida) : false;

    setRegistros((prev) => ({
      ...prev,
      [empleadoId]: { ...getRegistro(empleadoId), horaSalida, salidaAnticipada },
    }));
    setGuardado(false);
  };

  // Marca la salida de todos a la vez, para el cierre general del día.
  const marcarSalidaTodos = () => {
    if (!puedeEditar) return;
    const horaSalida = nowTime();
    const nuevos = {};
    empleadosDelRancho.forEach((e) => {
      const info = infoTipoEmpleo[e.tipo_empleo_id];
      const salidaAnticipada = info ? esSalidaAnticipada(info.horaSalida, info.tolerancia, horaSalida) : false;
      nuevos[e.id] = { ...getRegistro(e.id), horaSalida, salidaAnticipada };
    });
    setRegistros((prev) => ({ ...prev, ...nuevos }));
    setGuardado(false);
  };

  const actualizarDetalle = (empleadoId, campo, valor) => {
    if (!puedeEditar) return;
    const actual = getRegistro(empleadoId);
    let cambios = { [campo]: valor };

    // Si se edita manualmente la hora de salida (ej. el admin la corrige al
    // cierre de semana), recalcula la vista previa de salida anticipada.
    if (campo === "horaSalida") {
      const emp = empleadosDelRancho.find((e) => e.id === empleadoId);
      const info = infoTipoEmpleo[emp?.tipo_empleo_id];
      cambios.salidaAnticipada = valor && info ? esSalidaAnticipada(info.horaSalida, info.tolerancia, valor) : false;
    }

    setRegistros((prev) => ({
      ...prev,
      [empleadoId]: { ...actual, ...cambios },
    }));
    setGuardado(false);
  };

  const totales = useMemo(() => {
    const t = { ninguna: 0, falta: 0, permiso: 0, tardanza: 0, sinMarcar: 0, salidaAnticipada: 0 };
    empleadosDelRancho.forEach((e) => {
      const r = getRegistro(e.id);
      if (!r.incidencia) t.sinMarcar++;
      else t[r.incidencia]++;
      if (r.salidaAnticipada) t.salidaAnticipada++;
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
        hora_salida_real: registros[e.id].horaSalida || null,
      }));

    if (filas.length === 0) return;

    setGuardando(true);
    const { data, error } = await supabase
      .from("asistencia")
      .upsert(filas, { onConflict: "empleado_id,fecha" })
      .select("empleado_id, incidencia, jornada, observaciones, hora_registro, hora_salida_real, salida_anticipada");
    setGuardando(false);

    if (error) {
      setErrorCarga("No se pudo guardar (revisa tu conexión): " + error.message);
      return;
    }

    // Sincroniza con los valores confirmados por el servidor (ej. tardanza
    // y salida anticipada recalculadas por los triggers correspondientes)
    const mapa = { ...registros };
    (data || []).forEach((r) => {
      mapa[r.empleado_id] = {
        incidencia: r.incidencia,
        jornada: r.jornada,
        observaciones: r.observaciones || "",
        horaRegistro: r.hora_registro?.slice(0, 5) || null,
        horaSalida: r.hora_salida_real?.slice(0, 5) || null,
        salidaAnticipada: r.salida_anticipada || false,
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

        {usuarioActual.rol === "admin" && (
          <div style={styles.navTabs}>
            {[
              { key: "captura", label: "📝 Captura" },
              { key: "reporte", label: "📋 Reporte semanal" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setPestana(t.key)}
                style={{
                  ...styles.navTab,
                  borderColor: pestana === t.key ? "#7fbf5a" : "rgba(127,191,90,0.2)",
                  color: pestana === t.key ? "#7fbf5a" : "rgba(200,230,180,0.5)",
                  background: pestana === t.key ? "rgba(127,191,90,0.12)" : "transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {pestana === "captura" && errorCarga && (
          <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
            {errorCarga}
          </div>
        )}

        {pestana === "reporte" && usuarioActual.rol === "admin" && (
          <ReporteSemanalTab />
        )}

        {pestana === "captura" && (
        <>
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
          <ResumenChip label="Salida antes" count={totales.salidaAnticipada} color="#a08fd4" />
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
            <button
              onClick={marcarSalidaTodos}
              style={{ ...styles.quickBtn, borderColor: "#a08fd4", color: "#a08fd4" }}
            >
              🚪 Marcar salida de todos
            </button>
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
                      {reg.horaRegistro && ` · entró ${reg.horaRegistro} hrs`}
                      {reg.horaSalida && ` · salió ${reg.horaSalida} hrs`}
                      {reg.salidaAnticipada && " (antes de tiempo)"}
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
                  <button
                    onClick={() => marcarSalida(emp.id)}
                    style={{
                      ...styles.incBtn,
                      background: reg.horaSalida ? "#a08fd4" : "rgba(255,255,255,0.05)",
                      color: reg.horaSalida ? "#0f2818" : "rgba(232,245,224,0.4)",
                      borderColor: reg.horaSalida ? "#a08fd4" : "rgba(255,255,255,0.1)",
                    }}
                    title="Marcar salida"
                  >
                    🚪
                  </button>
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
        </>
        )}
      </div>

      {/* Modal de detalle */}
      {empleadoDetalle && (
        <DetalleModal
          empleado={empleadosDelRancho.find((e) => e.id === empleadoDetalle)}
          tipoEmpleo={infoTipoEmpleo[empleadosDelRancho.find((e) => e.id === empleadoDetalle)?.tipo_empleo_id] || { nombre: "—", color: "#999", horaEntrada: "--:--", horaSalida: "--:--", tolerancia: 0 }}
          registro={getRegistro(empleadoDetalle)}
          onUpdate={(campo, valor) => actualizarDetalle(empleadoDetalle, campo, valor)}
          onClose={() => setEmpleadoDetalle(null)}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}

// ============ PESTAÑA: REPORTE SEMANAL (exclusiva admin) ============
// Antes vivía como módulo/botón "Reporte" independiente; se fusiona aquí
// porque el reporte de nómina solo tiene sentido dentro de Asistencia.
// Reutiliza la sesión ya validada por el componente padre: no repite
// login, verificación de sesión ni encabezado propio.
function ReporteSemanalTab() {
  const [errorCarga, setErrorCarga] = useState("");
  const [ranchos, setRanchos] = useState([]);
  const [ranchoId, setRanchoId] = useState("");
  const [tarifasRancho, setTarifasRancho] = useState({ tarifa_dominical_pct: 25, tarifa_festivo_multiplicador: 2 });
  const [fechaRef, setFechaRef] = useState(hoyISO());
  const [empleados, setEmpleados] = useState([]);
  const [config, setConfig] = useState({});
  const [festivos, setFestivos] = useState(new Set());
  const [asistencia, setAsistencia] = useState({});
  const [expandido, setExpandido] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(null);

  // ---- Catálogo de ranchos ----
  useEffect(() => {
    supabase.from("ranchos").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        setRanchos(data || []);
        if (data?.length && !ranchoId) setRanchoId(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Semana visible (lunes a domingo) ----
  const lunes = useMemo(() => lunesDeSemana(fechaRef), [fechaRef]);
  const diasSemana = useMemo(
    () => DIAS_SEMANA.map((d, i) => ({ ...d, fecha: formatISO(sumarDias(lunes, i)) })),
    [lunes]
  );
  const domingoISO = diasSemana[6]?.fecha;

  // ---- Datos de la semana para el rancho seleccionado ----
  useEffect(() => {
    if (!ranchoId || !diasSemana.length) return;
    setCargandoDatos(true);

    Promise.all([
      supabase.from("ranchos").select("tarifa_dominical_pct, tarifa_festivo_multiplicador").eq("id", ranchoId).single(),
      supabase.from("empleados").select("id, nombre_completo, tipo_empleo_id, tipos_empleo(nombre, color)")
        .eq("rancho_id", ranchoId).eq("activo", true).order("nombre_completo"),
      supabase.from("rancho_tipo_empleo").select("tipo_empleo_id, salario_diario, costo_hora_extra, hora_salida")
        .eq("rancho_id", ranchoId),
      supabase.from("dias_festivos").select("fecha").eq("activo", true)
        .gte("fecha", diasSemana[0].fecha).lte("fecha", domingoISO),
      supabase.from("asistencia").select("empleado_id, fecha, incidencia, jornada, hora_registro, hora_salida_real, horas_extra_autorizadas")
        .eq("rancho_id", ranchoId).gte("fecha", diasSemana[0].fecha).lte("fecha", domingoISO),
    ]).then(([rTarifas, rEmpleados, rConfig, rFestivos, rAsistencia]) => {
      setCargandoDatos(false);

      const err = rTarifas.error || rEmpleados.error || rConfig.error || rFestivos.error || rAsistencia.error;
      if (err) { setErrorCarga(err.message); return; }

      setTarifasRancho(rTarifas.data || { tarifa_dominical_pct: 25, tarifa_festivo_multiplicador: 2 });
      setEmpleados(rEmpleados.data || []);

      const cfg = {};
      (rConfig.data || []).forEach((r) => { cfg[r.tipo_empleo_id] = r; });
      setConfig(cfg);

      setFestivos(new Set((rFestivos.data || []).map((f) => f.fecha)));

      const mapa = {};
      (rAsistencia.data || []).forEach((r) => {
        if (!mapa[r.empleado_id]) mapa[r.empleado_id] = {};
        mapa[r.empleado_id][r.fecha] = r;
      });
      setAsistencia(mapa);
    });
  }, [ranchoId, diasSemana]);

  // ---- Cálculo completo por empleado ----
  const reporte = useMemo(() => {
    return empleados.map((emp) => {
      const cfg = config[emp.tipo_empleo_id];
      const dias = diasSemana.map((d) => {
        const registro = asistencia[emp.id]?.[d.fecha] || null;
        const esFestivo = festivos.has(d.fecha);
        const esDomingo = d.larga === "Domingo";
        const calc = calcularDia(registro, cfg, tarifasRancho, esFestivo, esDomingo);
        return { ...d, esFestivo, esDomingo, ...calc };
      });

      const totales = dias.reduce(
        (acc, d) => {
          if (d.incidencia === "ninguna" || d.incidencia === "tardanza") acc.diasTrabajados++;
          if (d.incidencia === "falta") acc.faltas++;
          if (d.incidencia === "permiso") acc.permisos++;
          if (d.incidencia === "tardanza") acc.tardanzas++;
          acc.horasExtraSugeridas += d.horasExtraSugeridas || 0;
          acc.horasExtraAutorizadas += d.horasExtraAutorizadas || 0;
          acc.montoBase += d.montoDia || 0;
          return acc;
        },
        { diasTrabajados: 0, faltas: 0, permisos: 0, tardanzas: 0, horasExtraSugeridas: 0, horasExtraAutorizadas: 0, montoBase: 0 }
      );
      const montoHorasExtra = totales.horasExtraAutorizadas * (cfg?.costo_hora_extra || 0);

      return {
        empleado: emp,
        tipoEmpleo: emp.tipos_empleo,
        dias,
        totales: { ...totales, montoHorasExtra, montoTotal: totales.montoBase + montoHorasExtra },
      };
    });
  }, [empleados, config, festivos, asistencia, diasSemana, tarifasRancho]);

  const totalGeneral = useMemo(
    () => reporte.reduce((acc, r) => acc + r.totales.montoTotal, 0),
    [reporte]
  );

  // ---- Autorizar / ajustar horas extra de un día ----
  const guardarHorasExtra = async (empleadoId, fecha, valorTexto) => {
    const valor = valorTexto === "" ? null : Number(valorTexto);
    if (valor !== null && (isNaN(valor) || valor < 0)) return;

    setGuardandoClave(`${empleadoId}-${fecha}`);
    const { error } = await supabase
      .from("asistencia")
      .update({ horas_extra_autorizadas: valor })
      .eq("empleado_id", empleadoId)
      .eq("fecha", fecha);
    setGuardandoClave(null);

    if (error) { setErrorCarga("No se pudo guardar: " + error.message); return; }

    setAsistencia((prev) => ({
      ...prev,
      [empleadoId]: {
        ...prev[empleadoId],
        [fecha]: { ...prev[empleadoId][fecha], horas_extra_autorizadas: valor },
      },
    }));
  };

  // ---- Exportar a CSV (abre directo en Excel) ----
  const exportarCSV = () => {
    const encabezado = [
      "Rancho", "Semana", "Empleado", "Tipo de empleo",
      "Días trabajados", "Faltas", "Permisos", "Tardanzas",
      "Horas extra sugeridas", "Horas extra autorizadas",
      "Monto base", "Monto horas extra", "Monto total",
    ];
    const ranchoNombre = ranchos.find((r) => r.id === ranchoId)?.nombre || "";
    const filas = reporte.map((r) => [
      ranchoNombre,
      `${diasSemana[0].fecha} a ${domingoISO}`,
      r.empleado.nombre_completo,
      r.tipoEmpleo?.nombre || "",
      r.totales.diasTrabajados, r.totales.faltas, r.totales.permisos, r.totales.tardanzas,
      r.totales.horasExtraSugeridas.toFixed(2), r.totales.horasExtraAutorizadas.toFixed(2),
      r.totales.montoBase.toFixed(2), r.totales.montoHorasExtra.toFixed(2), r.totales.montoTotal.toFixed(2),
    ]);
    const csv = [encabezado, ...filas]
      .map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomina_${ranchoNombre}_${diasSemana[0].fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ranchoId) {
    return <div style={styles.empty}>Cargando ranchos…</div>;
  }

  return (
    <div>
      {errorCarga && (
        <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
          {errorCarga}
        </div>
      )}

      <div style={styles.selectorsCard}>
        <div style={styles.selectorGroup}>
          <label style={styles.label}>Rancho</label>
          <select value={ranchoId} onChange={(e) => setRanchoId(e.target.value)} style={styles.select}>
            {ranchos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={styles.selectorGroup}>
          <label style={styles.label}>Cualquier día de la semana</label>
          <input type="date" value={fechaRef} onChange={(e) => setFechaRef(e.target.value)} style={styles.select} />
        </div>
      </div>

      <div style={styles.semanaTag}>
        Semana del {diasSemana[0]?.fecha} al {domingoISO}
      </div>

      <div style={styles.resumenGeneral}>
        <span>Total de la semana</span>
        <strong>{money(totalGeneral)}</strong>
      </div>

      <button onClick={exportarCSV} style={{ ...styles.guardarBtn, marginBottom: "16px" }}>
        ⬇️ Exportar a Excel (CSV)
      </button>

      {cargandoDatos ? (
        <div style={styles.empty}>Cargando…</div>
      ) : reporte.length === 0 ? (
        <div style={styles.empty}>No hay empleados activos en este rancho.</div>
      ) : (
        <div style={styles.lista}>
          {reporte.map((r) => {
            const abierto = expandido === r.empleado.id;
            const color = r.tipoEmpleo?.color || "#7fbf5a";
            return (
              <div key={r.empleado.id} style={styles.empleadoCard}>
                <div style={styles.empleadoHeaderRow} onClick={() => setExpandido(abierto ? null : r.empleado.id)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={styles.empleadoNombre}>{r.empleado.nombre_completo}</div>
                    <div style={{ ...styles.empleadoTipo, color }}>{r.tipoEmpleo?.nombre}</div>
                  </div>
                  <div style={styles.diasChips}>
                    {r.dias.map((d) => (
                      <div
                        key={d.fecha}
                        title={`${d.larga}: ${d.incidencia || "sin marcar"}`}
                        style={{
                          ...styles.diaChip,
                          background: COLOR_INCIDENCIA[d.incidencia || "sinMarcar"],
                          boxShadow: d.horasExtraSugeridas > 0 ? "0 0 0 2px #a08fd4" : "none",
                        }}
                      >
                        {d.corta}
                      </div>
                    ))}
                  </div>
                  <div style={styles.montoChico}>{money(r.totales.montoTotal)}</div>
                </div>

                {abierto && (
                  <div style={styles.detalleExpandido}>
                    <div style={styles.resumenMini}>
                      <span>✓ {r.totales.diasTrabajados} trabajados</span>
                      <span style={{ color: "#e05c5c" }}>✕ {r.totales.faltas} faltas</span>
                      <span style={{ color: "#e8a23d" }}>P {r.totales.permisos} permisos</span>
                      <span style={{ color: "#5a9bd4" }}>T {r.totales.tardanzas} tardanzas</span>
                    </div>

                    {r.dias.map((d) => (
                      <div key={d.fecha} style={styles.filaDia}>
                        <div style={styles.filaDiaEtiqueta}>
                          <strong>{d.larga}</strong> {d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}
                          {d.esFestivo && <span style={{ color: "#e8a23d" }}> · festivo</span>}
                          {d.esDomingo && !d.esFestivo && <span style={{ color: "#5a9bd4" }}> · dominical</span>}
                        </div>
                        <div style={styles.filaDiaInfo}>
                          {d.incidencia
                            ? <span style={{ color: COLOR_INCIDENCIA[d.incidencia] }}>{d.incidencia}</span>
                            : <span style={{ color: "rgba(255,255,255,0.3)" }}>sin marcar</span>}
                          {d.horaRegistro && ` · entró ${d.horaRegistro}`}
                          {d.horaSalidaReal && ` · salió ${d.horaSalidaReal}`}
                          {" · "}{money(d.montoDia)}
                        </div>
                        {d.horasExtraSugeridas > 0 && (
                          <div style={styles.horasExtraFila}>
                            <span style={{ color: "#a08fd4", fontSize: "12px" }}>
                              🕐 {d.horasExtraSugeridas}h extra sugeridas
                            </span>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              placeholder="autorizar hrs"
                              defaultValue={d.horasExtraAutorizadas ?? ""}
                              onBlur={(e) => guardarHorasExtra(r.empleado.id, d.fecha, e.target.value)}
                              style={styles.inputHorasExtra}
                            />
                            {guardandoClave === `${r.empleado.id}-${d.fecha}` && <span style={{ fontSize: "11px" }}>guardando…</span>}
                          </div>
                        )}
                      </div>
                    ))}

                    <div style={styles.totalEmpleado}>
                      <span>Base: {money(r.totales.montoBase)}</span>
                      <span>Hrs. extra: {money(r.totales.montoHorasExtra)}</span>
                      <strong>Total: {money(r.totales.montoTotal)}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
          Entrada: {tipoEmpleo.horaEntrada} hrs · Salida: {tipoEmpleo.horaSalida} hrs · Tolerancia: {tipoEmpleo.tolerancia} min
          {registro.horaRegistro && ` · Entró a las ${registro.horaRegistro} hrs`}
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
          <label style={styles.label}>Hora de salida real</label>
          <input
            type="time"
            value={registro.horaSalida || ""}
            disabled={!puedeEditar}
            onChange={(e) => onUpdate("horaSalida", e.target.value)}
            style={styles.select}
          />
          {registro.salidaAnticipada && (
            <p style={{ color: "#a08fd4", fontSize: "11px", marginTop: "6px" }}>
              🚪 Se retiró antes de la hora programada.
            </p>
          )}
        </div>

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
  // ---- Pestañas (captura / reporte) ----
  navTabs: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" },
  navTab: { flex: "1 1 140px", border: "1.5px solid", borderRadius: "10px", padding: "10px 8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", background: "transparent", fontFamily: "inherit" },
  // ---- Reporte semanal (pestaña admin) ----
  semanaTag: { textAlign: "center", fontSize: "12px", color: "rgba(200,230,180,0.6)", marginBottom: "12px" },
  resumenGeneral: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(127,191,90,0.1)", border: "1px solid rgba(127,191,90,0.3)", borderRadius: "14px", padding: "14px 18px", marginBottom: "16px", fontSize: "15px" },
  empleadoCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" },
  empleadoHeaderRow: { display: "flex", alignItems: "center", gap: "8px", padding: "12px", cursor: "pointer" },
  diasChips: { display: "flex", gap: "3px", flexShrink: 0 },
  diaChip: { width: "18px", height: "18px", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "#0f2818" },
  montoChico: { fontSize: "12px", fontWeight: "700", color: "#c8e89a", flexShrink: 0, minWidth: "68px", textAlign: "right" },
  detalleExpandido: { borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px" },
  resumenMini: { display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "11px", marginBottom: "12px", color: "rgba(200,230,180,0.7)" },
  filaDia: { padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  filaDiaEtiqueta: { fontSize: "12px", color: "#c8e89a" },
  filaDiaInfo: { fontSize: "11px", color: "rgba(232,245,224,0.7)", marginTop: "2px" },
  horasExtraFila: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
  inputHorasExtra: { width: "90px", background: "rgba(160,143,212,0.15)", border: "1px solid #a08fd4", borderRadius: "8px", padding: "6px 8px", color: "#e8f5e0", fontSize: "12px" },
  totalEmpleado: { display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(127,191,90,0.2)", color: "#c8e89a" },
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



