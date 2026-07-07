import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

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

export default function Configuracion() {
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  const [ranchos, setRanchos] = useState([]);
  const [ranchoId, setRanchoId] = useState("");

  const [tarifas, setTarifas] = useState({ tarifa_dominical_pct: "", tarifa_festivo_multiplicador: "" });
  const [filas, setFilas] = useState([]); // [{ tipo_empleo_id, nombre, color, hora_entrada, hora_salida, tolerancia_minutos, salario_diario, costo_hora_extra }]

  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

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
    supabase.from("usuarios").select("nombre_completo, rol").eq("id", sesion.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErrorCarga("Tu usuario no tiene perfil asignado."); return; }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol });
      });
  }, [sesion]);

  // ---- Ranchos ----
  useEffect(() => {
    if (!usuarioActual || usuarioActual.rol !== "admin") return;
    supabase.from("ranchos").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data, error }) => {
        if (error) { setErrorCarga(error.message); return; }
        setRanchos(data || []);
        if (data?.length && !ranchoId) setRanchoId(data[0].id);
      });
  }, [usuarioActual]);

  // ---- Cargar tarifas + horario/salario del rancho seleccionado ----
  useEffect(() => {
    if (!ranchoId) return;
    setCargandoDatos(true);
    setGuardadoOk(false);

    Promise.all([
      supabase.from("ranchos").select("tarifa_dominical_pct, tarifa_festivo_multiplicador").eq("id", ranchoId).single(),
      supabase.from("tipos_empleo").select("id, nombre, color").eq("activo", true).order("nombre"),
      supabase.from("rancho_tipo_empleo").select("tipo_empleo_id, hora_entrada, hora_salida, tolerancia_minutos, salario_diario, costo_hora_extra").eq("rancho_id", ranchoId),
    ]).then(([rRancho, rTipos, rConfig]) => {
      setCargandoDatos(false);
      const err = rRancho.error || rTipos.error || rConfig.error;
      if (err) { setErrorCarga(err.message); return; }

      setTarifas({
        tarifa_dominical_pct: rRancho.data?.tarifa_dominical_pct ?? "",
        tarifa_festivo_multiplicador: rRancho.data?.tarifa_festivo_multiplicador ?? "",
      });

      const configPorTipo = {};
      (rConfig.data || []).forEach((c) => { configPorTipo[c.tipo_empleo_id] = c; });

      setFilas((rTipos.data || []).map((t) => {
        const c = configPorTipo[t.id] || {};
        return {
          tipo_empleo_id: t.id,
          nombre: t.nombre,
          color: t.color,
          hora_entrada: c.hora_entrada?.slice(0, 5) || "",
          hora_salida: c.hora_salida?.slice(0, 5) || "",
          tolerancia_minutos: c.tolerancia_minutos ?? 15,
          salario_diario: c.salario_diario ?? "",
          costo_hora_extra: c.costo_hora_extra ?? "",
        };
      }));
    });
  }, [ranchoId]);

  const actualizarFila = (tipoEmpleoId, campo, valor) => {
    setFilas((prev) => prev.map((f) => f.tipo_empleo_id === tipoEmpleoId ? { ...f, [campo]: valor } : f));
    setGuardadoOk(false);
  };

  const guardarTodo = async () => {
    setGuardando(true);
    setErrorCarga("");

    const { error: errTarifas } = await supabase
      .from("ranchos")
      .update({
        tarifa_dominical_pct: tarifas.tarifa_dominical_pct === "" ? null : Number(tarifas.tarifa_dominical_pct),
        tarifa_festivo_multiplicador: tarifas.tarifa_festivo_multiplicador === "" ? null : Number(tarifas.tarifa_festivo_multiplicador),
      })
      .eq("id", ranchoId);

    if (errTarifas) { setGuardando(false); setErrorCarga(errTarifas.message); return; }

    for (const f of filas) {
      const { error } = await supabase
        .from("rancho_tipo_empleo")
        .update({
          hora_entrada: f.hora_entrada || null,
          hora_salida: f.hora_salida || null,
          tolerancia_minutos: f.tolerancia_minutos === "" ? null : Number(f.tolerancia_minutos),
          salario_diario: f.salario_diario === "" ? null : Number(f.salario_diario),
          costo_hora_extra: f.costo_hora_extra === "" ? null : Number(f.costo_hora_extra),
        })
        .eq("rancho_id", ranchoId)
        .eq("tipo_empleo_id", f.tipo_empleo_id);

      if (error) { setGuardando(false); setErrorCarga(`Error guardando ${f.nombre}: ${error.message}`); return; }
    }

    setGuardando(false);
    setGuardadoOk(true);
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
          <div style={styles.eyebrow}>JR AGROCONTROL · CONFIGURACIÓN</div>
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
            <div style={styles.eyebrow}>JR AGROCONTROL · CONFIGURACIÓN</div>
            <h1 style={styles.title}>Horarios y Salarios</h1>
            <div style={styles.usuarioTag}>
              {usuarioActual.nombre} · admin
              {" · "}<button onClick={cerrarSesion} style={styles.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={styles.headerIcon}>⚙️</div>
        </div>

        {errorCarga && (
          <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
            {errorCarga}
          </div>
        )}
        {guardadoOk && (
          <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(127,191,90,0.3)", background: "rgba(127,191,90,0.12)", color: "#c8e89a" }}>
            ✓ Cambios guardados. El reporte semanal y la pantalla de Empleados ya usan estos valores.
          </div>
        )}

        <div style={styles.selectorGroup}>
          <label style={styles.label}>Rancho</label>
          <select value={ranchoId} onChange={(e) => setRanchoId(e.target.value)} style={styles.select}>
            {ranchos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        {cargandoDatos ? (
          <div style={styles.empty}>Cargando…</div>
        ) : (
          <>
            <div style={styles.seccion}>
              <div style={styles.seccionTitulo}>Tarifas especiales de este rancho</div>
              <div style={styles.formGrid2}>
                <div>
                  <label style={styles.label}>Prima dominical (%)</label>
                  <input type="number" step="0.01" min="0" value={tarifas.tarifa_dominical_pct}
                    onChange={(e) => { setTarifas({ ...tarifas, tarifa_dominical_pct: e.target.value }); setGuardadoOk(false); }}
                    style={styles.select} />
                </div>
                <div>
                  <label style={styles.label}>Multiplicador día festivo</label>
                  <input type="number" step="0.01" min="0" value={tarifas.tarifa_festivo_multiplicador}
                    onChange={(e) => { setTarifas({ ...tarifas, tarifa_festivo_multiplicador: e.target.value }); setGuardadoOk(false); }}
                    style={styles.select} />
                </div>
              </div>
            </div>

            <div style={styles.seccion}>
              <div style={styles.seccionTitulo}>Horario y salario por tipo de empleo</div>
              {filas.map((f) => (
                <div key={f.tipo_empleo_id} style={styles.tarjetaTipo}>
                  <div style={{ ...styles.tipoNombre, color: f.color }}>{f.nombre}</div>
                  <div style={styles.formGrid2}>
                    <div>
                      <label style={styles.label}>Hora entrada</label>
                      <input type="time" value={f.hora_entrada} onChange={(e) => actualizarFila(f.tipo_empleo_id, "hora_entrada", e.target.value)} style={styles.select} />
                    </div>
                    <div>
                      <label style={styles.label}>Hora salida</label>
                      <input type="time" value={f.hora_salida} onChange={(e) => actualizarFila(f.tipo_empleo_id, "hora_salida", e.target.value)} style={styles.select} />
                    </div>
                  </div>
                  <div style={styles.formGrid2}>
                    <div>
                      <label style={styles.label}>Tolerancia (min)</label>
                      <input type="number" min="0" value={f.tolerancia_minutos} onChange={(e) => actualizarFila(f.tipo_empleo_id, "tolerancia_minutos", e.target.value)} style={styles.select} />
                    </div>
                    <div>
                      <label style={styles.label}>Salario diario ($)</label>
                      <input type="number" step="0.01" min="0" value={f.salario_diario} onChange={(e) => actualizarFila(f.tipo_empleo_id, "salario_diario", e.target.value)} style={styles.select} />
                    </div>
                  </div>
                  <div>
                    <label style={styles.label}>Costo hora extra ($)</label>
                    <input type="number" step="0.01" min="0" value={f.costo_hora_extra} onChange={(e) => actualizarFila(f.tipo_empleo_id, "costo_hora_extra", e.target.value)} style={styles.select} />
                  </div>
                </div>
              ))}
            </div>

            <button onClick={guardarTodo} disabled={guardando} style={styles.guardarBtn}>
              {guardando ? "Guardando…" : "Guardar cambios de " + (ranchos.find((r) => r.id === ranchoId)?.nombre || "")}
            </button>
          </>
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
  selectorGroup: { marginBottom: "16px" },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  seccion: { marginBottom: "20px" },
  seccionTitulo: { fontSize: "13px", fontWeight: "700", color: "#c8e89a", marginBottom: "10px", borderBottom: "1px solid rgba(127,191,90,0.2)", paddingBottom: "6px" },
  formGrid2: { display: "flex", gap: "10px", marginBottom: "10px" },
  tarjetaTipo: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", marginBottom: "10px" },
  tipoNombre: { fontSize: "13px", fontWeight: "700", marginBottom: "10px" },
  guardarBtn: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 24px rgba(90,171,46,0.3)" },
};

