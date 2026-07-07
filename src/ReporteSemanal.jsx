import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";

const DIAS = [
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

// ============ Utilidades de fecha (semana lunes-domingo) ============
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

// ============ Cálculo del pago de un día individual ============
// Toda la regla de negocio vive aquí, en un solo lugar fácil de ajustar.
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

export default function ReporteSemanal() {
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  const [ranchos, setRanchos] = useState([]);
  const [ranchoId, setRanchoId] = useState("");
  const [tarifasRancho, setTarifasRancho] = useState({ tarifa_dominical_pct: 25, tarifa_festivo_multiplicador: 2 });

  const [fechaRef, setFechaRef] = useState(hoyISO());
  const [empleados, setEmpleados] = useState([]);
  const [config, setConfig] = useState({}); // tipo_empleo_id -> { salario_diario, costo_hora_extra, hora_salida }
  const [festivos, setFestivos] = useState(new Set());
  const [asistencia, setAsistencia] = useState({}); // empleado_id -> fecha -> registro

  const [expandido, setExpandido] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(null); // `${empleadoId}-${fecha}`

  // ---- Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setUsuarioActual(null);
    setErrorCarga("");
    setExpandido(null);
  }, [sesion?.user?.id]);

  useEffect(() => {
    if (!sesion) return;
    supabase.from("usuarios").select("nombre_completo, rol").eq("id", sesion.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErrorCarga("Tu usuario no tiene perfil asignado."); return; }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol });
      });
  }, [sesion]);

  // ---- Catálogo de ranchos ----
  useEffect(() => {
    if (!usuarioActual || usuarioActual.rol !== "admin") return;
    supabase.from("ranchos").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        setRanchos(data || []);
        if (data?.length && !ranchoId) setRanchoId(data[0].id);
      });
  }, [usuarioActual]);

  // ---- Semana visible (lunes a domingo) ----
  const lunes = useMemo(() => lunesDeSemana(fechaRef), [fechaRef]);
  const diasSemana = useMemo(
    () => DIAS.map((d, i) => ({ ...d, fecha: formatISO(sumarDias(lunes, i)) })),
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

  // ---- Cálculo completo por empleado (memo: se recalcula solo si cambian los datos crudos) ----
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

    // BOM para que Excel reconozca acentos/ñ correctamente
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomina_${ranchoNombre}_${diasSemana[0].fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  // ---- Estados de carga / acceso ----
  if (sesion === undefined) return <div style={styles.page}><div style={styles.container}>Cargando…</div></div>;
  if (!sesion) return <Login />;
  if (!usuarioActual) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p>{errorCarga || "Cargando perfil…"}</p>
          {errorCarga && <button onClick={cerrarSesion} style={{ ...styles.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>}
        </div>
      </div>
    );
  }
  if (usuarioActual.rol !== "admin") {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.eyebrow}>JR AGROCONTROL · REPORTE</div>
          <h1 style={styles.title}>Acceso restringido</h1>
          <div style={styles.avisoRestriccion}>Esta pantalla es exclusiva para el administrador.</div>
          <button onClick={cerrarSesion} style={{ ...styles.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>JR AGROCONTROL · NÓMINA</div>
            <h1 style={styles.title}>Reporte Semanal</h1>
            <div style={styles.usuarioTag}>
              {usuarioActual.nombre} · admin
              {" · "}<button onClick={cerrarSesion} style={styles.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={styles.headerIcon}>📋</div>
        </div>

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
    </div>
  );
}

// ============ Estilos (mismo lenguaje visual que el resto de la app) ============
const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8f5e0", padding: "20px 16px 40px", boxSizing: "border-box" },
  container: { maxWidth: "640px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.12em", color: "#7fbf5a", marginBottom: "4px", fontWeight: "600" },
  title: { fontSize: "26px", fontWeight: "800", margin: 0, color: "#ffffff" },
  headerIcon: { fontSize: "36px" },
  usuarioTag: { fontSize: "11px", color: "rgba(200,230,180,0.55)", marginTop: "4px" },
  logoutLink: { background: "none", border: "none", padding: 0, color: "#e8a23d", fontSize: "11px", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" },
  avisoRestriccion: { background: "rgba(232,162,61,0.12)", border: "1px solid rgba(232,162,61,0.3)", borderRadius: "12px", padding: "12px 14px", fontSize: "12px", lineHeight: "1.5", color: "#e8a23d", marginBottom: "16px" },
  selectorsCard: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(127,191,90,0.15)", borderRadius: "16px", padding: "16px", display: "flex", gap: "12px", marginBottom: "12px" },
  selectorGroup: { flex: 1 },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box" },
  semanaTag: { textAlign: "center", fontSize: "12px", color: "rgba(200,230,180,0.6)", marginBottom: "12px" },
  resumenGeneral: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(127,191,90,0.1)", border: "1px solid rgba(127,191,90,0.3)", borderRadius: "14px", padding: "14px 18px", marginBottom: "16px", fontSize: "15px" },
  guardarBtn: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  lista: { display: "flex", flexDirection: "column", gap: "8px" },
  empleadoCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" },
  empleadoHeaderRow: { display: "flex", alignItems: "center", gap: "8px", padding: "12px", cursor: "pointer" },
  empleadoNombre: { fontSize: "13px", fontWeight: "600", color: "#e8f5e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empleadoTipo: { fontSize: "10px", marginTop: "2px" },
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
};

