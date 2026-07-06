import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabaseClient";

// ============ CATÁLOGOS FIJOS DE UI ============
const TIPOS_CONTRATACION = [
  { value: "eventual", label: "Eventual" },
  { value: "fijo", label: "Fijo" },
  { value: "temporada", label: "Temporada" },
  { value: "pasante", label: "Pasante" },
];

const TIPOS_SANGRE = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function limpiar(valor) {
  const v = (valor || "").trim();
  return v === "" ? null : v;
}

function nombreCompleto(persona) {
  if (!persona) return "";
  return `${persona.nombres} ${persona.apellidos}`.trim();
}

function iniciales(persona) {
  const n = (persona?.nombres || "").charAt(0);
  const a = (persona?.apellidos || "").charAt(0);
  return (n + a).toUpperCase() || "?";
}

function vacioPersona() {
  return {
    nombres: "", apellidos: "", fecha_nacimiento: "", sexo: "",
    lugar_origen: "", estado: "", municipio: "", localidad: "", direccion: "",
    celular: "", curp: "", rfc: "", nss: "", tipo_sangre: "", alergias: "",
    contacto_nombre: "", contacto_celular: "",
  };
}

function vacioLaboral(ranchoIdDefault) {
  return {
    rancho_id: ranchoIdDefault || "", tipo_empleo_id: "",
    fecha_ingreso: todayISO(), fecha_salida: "",
    tipo_contratacion: "eventual", registrado_driscolls: true,
    observaciones: "", activo: true,
  };
}

// Traduce errores comunes de Postgres/Supabase a mensajes entendibles en campo
function mensajeError(error) {
  if (!error) return "";
  if (error.code === "23505") {
    if (error.message.includes("curp")) return "Ya existe una persona registrada con ese CURP.";
    if (error.message.includes("rfc")) return "Ya existe una persona registrada con ese RFC.";
    if (error.message.includes("nss")) return "Ya existe una persona registrada con ese NSS.";
    return "Ese dato ya está registrado para otra persona.";
  }
  if (error.message.includes("personas_mayor_de_edad_chk")) {
    return "La fecha de nacimiento indica que la persona es menor de 18 años. No se puede registrar.";
  }
  if (error.message.includes("empleados_fechas_chk")) {
    return "La fecha de salida no puede ser anterior a la fecha de ingreso.";
  }
  return error.message;
}

// ============ PANTALLA DE ACCESO (idéntica a Asistencia.jsx) ============
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

export default function Empleados() {
  // ---- Sesión y perfil ----
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  // ---- Catálogos ----
  const [ranchos, setRanchos] = useState([]);
  const [tiposEmpleo, setTiposEmpleo] = useState([]);

  // ---- Lista de empleados ----
  const [empleados, setEmpleados] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  // ---- Filtros ----
  const [filtroRancho, setFiltroRancho] = useState("todos");
  const [filtroEstatus, setFiltroEstatus] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  // ---- Modal de alta / edición ----
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState(null); // null = alta nueva
  const [modoAlta, setModoAlta] = useState("elegir"); // elegir | nueva | reingreso
  const [curpBusqueda, setCurpBusqueda] = useState("");
  const [personaEncontrada, setPersonaEncontrada] = useState(null);
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState(vacioPersona());
  const [laboralForm, setLaboralForm] = useState(vacioLaboral());
  const [salarioInfo, setSalarioInfo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  // ---- 1. Sesión ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSesion(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- 1.b Limpieza de estado al cambiar de usuario (mismo patrón que Asistencia.jsx) ----
  useEffect(() => {
    setUsuarioActual(null);
    setEmpleados([]);
    setRanchos([]);
    setTiposEmpleo([]);
    setErrorCarga("");
    cerrarModal();
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
          setErrorCarga("Tu usuario no tiene perfil asignado. Pide a un administrador que te dé de alta en 'usuarios'.");
          return;
        }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol, rancho_id: data.rancho_id });
      });
  }, [sesion]);

  // ---- 3. Catálogos (solo si es admin) ----
  useEffect(() => {
    if (!usuarioActual || usuarioActual.rol !== "admin") return;
    supabase.from("ranchos").select("id, nombre").eq("activo", true).order("nombre")
      .then(({ data, error }) => { if (!error) setRanchos(data || []); });
    supabase.from("tipos_empleo").select("id, nombre, color").eq("activo", true).order("nombre")
      .then(({ data, error }) => { if (!error) setTiposEmpleo(data || []); });
  }, [usuarioActual]);

  // ---- 4. Lista de empleados según filtros ----
  const cargarEmpleados = () => {
    if (!usuarioActual || usuarioActual.rol !== "admin") return;
    setCargandoLista(true);
    let query = supabase
      .from("empleados")
      .select(`
        id, fecha_ingreso, fecha_salida, tipo_contratacion, registrado_driscolls,
        observaciones, activo, rancho_id, tipo_empleo_id,
        ranchos ( nombre ),
        tipos_empleo ( nombre, color ),
        personas ( id, nombres, apellidos, curp, rfc, nss, celular, sexo,
                   fecha_nacimiento, tipo_sangre, alergias, lugar_origen,
                   estado, municipio, localidad, direccion,
                   contacto_nombre, contacto_celular, activo )
      `);

    if (filtroRancho !== "todos") query = query.eq("rancho_id", filtroRancho);
    if (filtroEstatus === "activos") query = query.eq("activo", true);
    if (filtroEstatus === "inactivos") query = query.eq("activo", false);

    query.then(({ data, error }) => {
      setCargandoLista(false);
      if (error) { setErrorCarga(error.message); return; }
      setEmpleados(data || []);
    });
  };

  useEffect(cargarEmpleados, [usuarioActual, filtroRancho, filtroEstatus]);

  const empleadosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return empleados;
    return empleados.filter((e) => {
      const nombre = nombreCompleto(e.personas).toLowerCase();
      const curp = (e.personas?.curp || "").toLowerCase();
      return nombre.includes(texto) || curp.includes(texto);
    });
  }, [empleados, busqueda]);

  // ---- Salario configurado para rancho + tipo de empleo elegidos (solo lectura) ----
  useEffect(() => {
    if (!laboralForm.rancho_id || !laboralForm.tipo_empleo_id) { setSalarioInfo(null); return; }
    supabase
      .from("rancho_tipo_empleo")
      .select("salario_diario, costo_hora_extra")
      .eq("rancho_id", laboralForm.rancho_id)
      .eq("tipo_empleo_id", laboralForm.tipo_empleo_id)
      .maybeSingle()
      .then(({ data }) => setSalarioInfo(data || null));
  }, [laboralForm.rancho_id, laboralForm.tipo_empleo_id]);

  // ---- Abrir modal: alta nueva ----
  const abrirAlta = () => {
    setEmpleadoEditando(null);
    setModoAlta("elegir");
    setCurpBusqueda("");
    setPersonaEncontrada(null);
    setPersonaForm(vacioPersona());
    setLaboralForm(vacioLaboral(filtroRancho !== "todos" ? filtroRancho : ""));
    setErrorModal("");
    setModalAbierto(true);
  };

  // ---- Abrir modal: edición de un registro existente ----
  const abrirEdicion = (empleado) => {
    setEmpleadoEditando(empleado);
    setModoAlta("edicion");
    const p = empleado.personas;
    setPersonaForm({
      nombres: p.nombres || "", apellidos: p.apellidos || "",
      fecha_nacimiento: p.fecha_nacimiento || "", sexo: p.sexo || "",
      lugar_origen: p.lugar_origen || "", estado: p.estado || "",
      municipio: p.municipio || "", localidad: p.localidad || "",
      direccion: p.direccion || "", celular: p.celular || "",
      curp: p.curp || "", rfc: p.rfc || "", nss: p.nss || "",
      tipo_sangre: p.tipo_sangre || "", alergias: p.alergias || "",
      contacto_nombre: p.contacto_nombre || "", contacto_celular: p.contacto_celular || "",
    });
    setLaboralForm({
      rancho_id: empleado.rancho_id, tipo_empleo_id: empleado.tipo_empleo_id,
      fecha_ingreso: empleado.fecha_ingreso, fecha_salida: empleado.fecha_salida || "",
      tipo_contratacion: empleado.tipo_contratacion, registrado_driscolls: empleado.registrado_driscolls,
      observaciones: empleado.observaciones || "", activo: empleado.activo,
    });
    setErrorModal("");
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEmpleadoEditando(null);
    setPersonaEncontrada(null);
    setCurpBusqueda("");
    setErrorModal("");
  };

  // ---- Buscar persona por CURP (para reingreso) ----
  const buscarPorCurp = async () => {
    const curp = limpiar(curpBusqueda);
    if (!curp) return;
    setBuscandoPersona(true);
    setErrorModal("");
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .ilike("curp", curp)
      .maybeSingle();
    setBuscandoPersona(false);
    if (error) { setErrorModal(error.message); return; }
    if (!data) { setErrorModal("No se encontró ninguna persona con ese CURP. Puedes registrarla como nueva."); return; }
    setPersonaEncontrada(data);
  };

  const usarPersonaEncontrada = () => {
    const p = personaEncontrada;
    setPersonaForm({
      nombres: p.nombres || "", apellidos: p.apellidos || "",
      fecha_nacimiento: p.fecha_nacimiento || "", sexo: p.sexo || "",
      lugar_origen: p.lugar_origen || "", estado: p.estado || "",
      municipio: p.municipio || "", localidad: p.localidad || "",
      direccion: p.direccion || "", celular: p.celular || "",
      curp: p.curp || "", rfc: p.rfc || "", nss: p.nss || "",
      tipo_sangre: p.tipo_sangre || "", alergias: p.alergias || "",
      contacto_nombre: p.contacto_nombre || "", contacto_celular: p.contacto_celular || "",
    });
    setModoAlta("reingreso");
  };

  // ---- Guardar (alta o edición) ----
  const guardar = async () => {
    if (!personaForm.nombres.trim()) { setErrorModal("El nombre es obligatorio."); return; }
    if (!laboralForm.rancho_id) { setErrorModal("Selecciona el rancho."); return; }
    if (!laboralForm.tipo_empleo_id) { setErrorModal("Selecciona el tipo de empleo."); return; }

    setGuardando(true);
    setErrorModal("");

    const datosPersona = {
      nombres: personaForm.nombres.trim(),
      apellidos: personaForm.apellidos.trim(),
      fecha_nacimiento: limpiar(personaForm.fecha_nacimiento),
      sexo: limpiar(personaForm.sexo),
      lugar_origen: limpiar(personaForm.lugar_origen),
      estado: limpiar(personaForm.estado),
      municipio: limpiar(personaForm.municipio),
      localidad: limpiar(personaForm.localidad),
      direccion: limpiar(personaForm.direccion),
      celular: limpiar(personaForm.celular),
      curp: limpiar(personaForm.curp)?.toUpperCase() || null,
      rfc: limpiar(personaForm.rfc)?.toUpperCase() || null,
      nss: limpiar(personaForm.nss),
      tipo_sangre: limpiar(personaForm.tipo_sangre),
      alergias: limpiar(personaForm.alergias),
      contacto_nombre: limpiar(personaForm.contacto_nombre),
      contacto_celular: limpiar(personaForm.contacto_celular),
    };

    const datosLaboral = {
      rancho_id: laboralForm.rancho_id,
      tipo_empleo_id: laboralForm.tipo_empleo_id,
      fecha_ingreso: laboralForm.fecha_ingreso,
      fecha_salida: limpiar(laboralForm.fecha_salida),
      tipo_contratacion: laboralForm.tipo_contratacion,
      registrado_driscolls: laboralForm.registrado_driscolls,
      observaciones: limpiar(laboralForm.observaciones),
      activo: laboralForm.activo,
    };

    // --- Caso 1: edición de un registro existente ---
    if (empleadoEditando) {
      const { error: errPersona } = await supabase
        .from("personas")
        .update(datosPersona)
        .eq("id", empleadoEditando.personas.id);
      if (errPersona) { setGuardando(false); setErrorModal(mensajeError(errPersona)); return; }

      const { error: errEmpleado } = await supabase
        .from("empleados")
        .update(datosLaboral)
        .eq("id", empleadoEditando.id);
      if (errEmpleado) { setGuardando(false); setErrorModal(mensajeError(errEmpleado)); return; }

      setGuardando(false);
      cerrarModal();
      cargarEmpleados();
      return;
    }

    // --- Caso 2: reingreso de una persona ya existente en el sistema ---
    let personaId = personaEncontrada?.id || null;

    // --- Caso 3: persona nueva -> se crea primero su ficha ---
    if (!personaId) {
      const { data: nuevaPersona, error: errPersona } = await supabase
        .from("personas")
        .insert(datosPersona)
        .select("id")
        .single();
      if (errPersona) { setGuardando(false); setErrorModal(mensajeError(errPersona)); return; }
      personaId = nuevaPersona.id;
    }

    const { error: errEmpleado } = await supabase
      .from("empleados")
      .insert({ ...datosLaboral, persona_id: personaId });
    if (errEmpleado) { setGuardando(false); setErrorModal(mensajeError(errEmpleado)); return; }

    setGuardando(false);
    cerrarModal();
    cargarEmpleados();
  };

  // ---- Baja rápida desde la lista ----
  const darDeBaja = async (empleado) => {
    if (!window.confirm(`¿Dar de baja a ${nombreCompleto(empleado.personas)}? Se registrará hoy como fecha de salida.`)) return;
    const { error } = await supabase
      .from("empleados")
      .update({ activo: false, fecha_salida: todayISO() })
      .eq("id", empleado.id);
    if (error) { setErrorCarga(mensajeError(error)); return; }
    cargarEmpleados();
  };

  const reactivar = async (empleado) => {
    const { error } = await supabase
      .from("empleados")
      .update({ activo: true, fecha_salida: null })
      .eq("id", empleado.id);
    if (error) { setErrorCarga(mensajeError(error)); return; }
    cargarEmpleados();
  };

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  // ---- Estados de carga / acceso ----
  if (sesion === undefined) {
    return <div style={styles.page}><div style={styles.container}>Cargando…</div></div>;
  }
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
          <div style={styles.eyebrow}>JR AGROCONTROL · EMPLEADOS</div>
          <h1 style={styles.title}>Acceso restringido</h1>
          <div style={{ ...styles.avisoRestriccion, marginTop: "16px" }}>
            Esta pantalla es exclusiva para el administrador. Tu cuenta tiene rol de {usuarioActual.rol}.
          </div>
          <button onClick={cerrarSesion} style={{ ...styles.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>
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
            <div style={styles.eyebrow}>JR AGROCONTROL · EMPLEADOS</div>
            <h1 style={styles.title}>Catálogo de Empleados</h1>
            <div style={styles.usuarioTag}>
              {usuarioActual.nombre} · admin
              {" · "}
              <button onClick={cerrarSesion} style={styles.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={styles.headerIcon}>🗂️</div>
        </div>

        {errorCarga && (
          <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
            {errorCarga}
          </div>
        )}

        {/* Filtros */}
        <div style={styles.selectorsCard}>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>Rancho</label>
            <select value={filtroRancho} onChange={(e) => setFiltroRancho(e.target.value)} style={styles.select}>
              <option value="todos">Todos</option>
              {ranchos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div style={styles.selectorGroup}>
            <label style={styles.label}>Estatus</label>
            <select value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value)} style={styles.select}>
              <option value="activos">Activos</option>
              <option value="inactivos">Dados de baja</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="Buscar por nombre o CURP…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.select}
          />
        </div>

        <button onClick={abrirAlta} style={{ ...styles.guardarBtn, marginBottom: "16px" }}>
          + Nuevo empleado
        </button>

        {/* Lista */}
        {cargandoLista ? (
          <div style={styles.empty}>Cargando…</div>
        ) : empleadosFiltrados.length === 0 ? (
          <div style={styles.empty}>No hay empleados con estos filtros.</div>
        ) : (
          <div style={styles.lista}>
            {empleadosFiltrados.map((e) => {
              const color = e.tipos_empleo?.color || "#7fbf5a";
              return (
                <div key={e.id} style={styles.empleadoRow}>
                  <div style={styles.empleadoInfo} onClick={() => abrirEdicion(e)}>
                    <div style={{ ...styles.avatar, background: color + "33", color }}>
                      {iniciales(e.personas)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.empleadoNombre}>{nombreCompleto(e.personas)}</div>
                      <div style={{ ...styles.empleadoTipo, color }}>
                        {e.tipos_empleo?.nombre} · {e.ranchos?.nombre}
                        {!e.registrado_driscolls && " · fuera de lista Driscoll's"}
                      </div>
                    </div>
                  </div>
                  {e.activo ? (
                    <button onClick={() => darDeBaja(e)} style={{ ...styles.quickBtn, borderColor: "#e05c5c", color: "#e05c5c" }}>
                      Baja
                    </button>
                  ) : (
                    <button onClick={() => reactivar(e)} style={{ ...styles.quickBtn, borderColor: "#7fbf5a", color: "#7fbf5a" }}>
                      Reactivar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={styles.footerNote}>{empleadosFiltrados.length} empleado(s)</div>
      </div>

      {/* ============ MODAL: Alta / Edición ============ */}
      {modalAbierto && (
        <div style={styles.modalOverlay} onClick={cerrarModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button onClick={cerrarModal} style={styles.modalClose}>✕</button>
            <h2 style={styles.modalNombre}>
              {empleadoEditando ? "Editar empleado" : "Nuevo empleado"}
            </h2>

            {errorModal && (
              <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>
                {errorModal}
              </div>
            )}

            {/* Paso inicial de alta: nueva persona vs reingreso */}
            {!empleadoEditando && modoAlta === "elegir" && (
              <div style={styles.modalSection}>
                <label style={styles.label}>¿Es una persona que ya trabajó antes en JR AgroControl?</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <input
                    type="text"
                    placeholder="Buscar por CURP"
                    value={curpBusqueda}
                    onChange={(e) => setCurpBusqueda(e.target.value)}
                    style={{ ...styles.select, flex: 1 }}
                  />
                  <button onClick={buscarPorCurp} disabled={buscandoPersona} style={{ ...styles.jornadaBtn, borderColor: "#7fbf5a", color: "#c8e89a" }}>
                    {buscandoPersona ? "…" : "Buscar"}
                  </button>
                </div>

                {personaEncontrada && (
                  <div style={{ ...styles.avisoRestriccion, borderColor: "rgba(127,191,90,0.3)", background: "rgba(127,191,90,0.12)", color: "#c8e89a", marginTop: "12px" }}>
                    Encontrada: <strong>{nombreCompleto(personaEncontrada)}</strong>
                    <button onClick={usarPersonaEncontrada} style={{ ...styles.modalGuardar, marginTop: "10px" }}>
                      Usar esta persona (reingreso)
                    </button>
                  </div>
                )}

                <button onClick={() => setModoAlta("nueva")} style={{ ...styles.guardarBtn, marginTop: "16px" }}>
                  Registrar como persona nueva
                </button>
              </div>
            )}

            {/* Formulario completo: nueva persona, reingreso confirmado, o edición */}
            {(empleadoEditando || modoAlta === "nueva" || modoAlta === "reingreso") && (
              <>
                <div style={styles.modalSection}>
                  <div style={styles.seccionTitulo}>Datos personales</div>
                  <div style={styles.formGrid2}>
                    <Campo label="Nombre(s)" value={personaForm.nombres} onChange={(v) => setPersonaForm({ ...personaForm, nombres: v })} disabled={modoAlta === "reingreso"} />
                    <Campo label="Apellidos" value={personaForm.apellidos} onChange={(v) => setPersonaForm({ ...personaForm, apellidos: v })} disabled={modoAlta === "reingreso"} />
                  </div>
                  <div style={styles.formGrid2}>
                    <Campo label="Fecha de nacimiento" type="date" value={personaForm.fecha_nacimiento} onChange={(v) => setPersonaForm({ ...personaForm, fecha_nacimiento: v })} />
                    <CampoSelect label="Sexo" value={personaForm.sexo} onChange={(v) => setPersonaForm({ ...personaForm, sexo: v })} opciones={[{ v: "M", l: "Masculino" }, { v: "F", l: "Femenino" }]} />
                  </div>
                  <Campo label="Lugar de origen" value={personaForm.lugar_origen} onChange={(v) => setPersonaForm({ ...personaForm, lugar_origen: v })} />
                  <div style={styles.formGrid2}>
                    <Campo label="CURP" value={personaForm.curp} onChange={(v) => setPersonaForm({ ...personaForm, curp: v.toUpperCase() })} />
                    <Campo label="RFC" value={personaForm.rfc} onChange={(v) => setPersonaForm({ ...personaForm, rfc: v.toUpperCase() })} />
                  </div>
                  <Campo label="NSS" value={personaForm.nss} onChange={(v) => setPersonaForm({ ...personaForm, nss: v })} />
                </div>

                <div style={styles.modalSection}>
                  <div style={styles.seccionTitulo}>Domicilio y contacto</div>
                  <div style={styles.formGrid2}>
                    <Campo label="Estado" value={personaForm.estado} onChange={(v) => setPersonaForm({ ...personaForm, estado: v })} />
                    <Campo label="Municipio" value={personaForm.municipio} onChange={(v) => setPersonaForm({ ...personaForm, municipio: v })} />
                  </div>
                  <div style={styles.formGrid2}>
                    <Campo label="Localidad" value={personaForm.localidad} onChange={(v) => setPersonaForm({ ...personaForm, localidad: v })} />
                    <Campo label="Celular" value={personaForm.celular} onChange={(v) => setPersonaForm({ ...personaForm, celular: v })} />
                  </div>
                  <Campo label="Dirección" value={personaForm.direccion} onChange={(v) => setPersonaForm({ ...personaForm, direccion: v })} />
                  <div style={styles.formGrid2}>
                    <Campo label="Contacto de emergencia" value={personaForm.contacto_nombre} onChange={(v) => setPersonaForm({ ...personaForm, contacto_nombre: v })} />
                    <Campo label="Celular de contacto" value={personaForm.contacto_celular} onChange={(v) => setPersonaForm({ ...personaForm, contacto_celular: v })} />
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <div style={styles.seccionTitulo}>Salud (ficha de primeros auxilios)</div>
                  <div style={styles.formGrid2}>
                    <CampoSelect label="Tipo de sangre" value={personaForm.tipo_sangre} onChange={(v) => setPersonaForm({ ...personaForm, tipo_sangre: v })} opciones={TIPOS_SANGRE.map((t) => ({ v: t, l: t }))} />
                    <Campo label="Alergias" value={personaForm.alergias} onChange={(v) => setPersonaForm({ ...personaForm, alergias: v })} />
                  </div>
                </div>

                <div style={styles.modalSection}>
                  <div style={styles.seccionTitulo}>Registro laboral</div>
                  <div style={styles.formGrid2}>
                    <CampoSelect label="Rancho" value={laboralForm.rancho_id} onChange={(v) => setLaboralForm({ ...laboralForm, rancho_id: v })} opciones={ranchos.map((r) => ({ v: r.id, l: r.nombre }))} />
                    <CampoSelect label="Tipo de empleo" value={laboralForm.tipo_empleo_id} onChange={(v) => setLaboralForm({ ...laboralForm, tipo_empleo_id: v })} opciones={tiposEmpleo.map((t) => ({ v: t.id, l: t.nombre }))} />
                  </div>

                  {salarioInfo && (
                    <div style={styles.usuarioTag}>
                      {salarioInfo.salario_diario
                        ? `Salario diario configurado: $${salarioInfo.salario_diario} · Hora extra: $${salarioInfo.costo_hora_extra || "—"}`
                        : "Salario aún no configurado para este rancho/tipo de empleo (pendiente en Configuración de horarios)."}
                    </div>
                  )}

                  <div style={styles.formGrid2}>
                    <Campo label="Fecha de ingreso" type="date" value={laboralForm.fecha_ingreso} onChange={(v) => setLaboralForm({ ...laboralForm, fecha_ingreso: v })} />
                    <Campo label="Fecha de salida" type="date" value={laboralForm.fecha_salida} onChange={(v) => setLaboralForm({ ...laboralForm, fecha_salida: v })} />
                  </div>
                  <CampoSelect label="Tipo de contratación" value={laboralForm.tipo_contratacion} onChange={(v) => setLaboralForm({ ...laboralForm, tipo_contratacion: v })} opciones={TIPOS_CONTRATACION.map((t) => ({ v: t.value, l: t.label }))} />

                  <div style={{ ...styles.selectorGroup, marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={laboralForm.registrado_driscolls} onChange={(e) => setLaboralForm({ ...laboralForm, registrado_driscolls: e.target.checked })} />
                    <label style={{ fontSize: "13px" }}>Registrado ante Driscoll's</label>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>Observaciones</label>
                    <textarea value={laboralForm.observaciones} onChange={(e) => setLaboralForm({ ...laboralForm, observaciones: e.target.value })} style={styles.textarea} />
                  </div>
                </div>

                <button onClick={guardar} disabled={guardando} style={styles.modalGuardar}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Subcomponentes de formulario ============
function Campo({ label, value, onChange, type = "text", disabled = false }) {
  return (
    <div style={{ ...styles.selectorGroup, marginTop: "10px" }}>
      <label style={styles.label}>{label}</label>
      <input type={type} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={styles.select} />
    </div>
  );
}

function CampoSelect({ label, value, onChange, opciones }) {
  return (
    <div style={{ ...styles.selectorGroup, marginTop: "10px" }}>
      <label style={styles.label}>{label}</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={styles.select}>
        <option value="">Selecciona…</option>
        {opciones.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ============ Estilos (mismo lenguaje visual que Asistencia.jsx) ============
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
  usuarioTag: { fontSize: "11px", color: "rgba(200,230,180,0.55)", marginTop: "4px" },
  logoutLink: { background: "none", border: "none", padding: 0, color: "#e8a23d", fontSize: "11px", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" },
  avisoRestriccion: { background: "rgba(232,162,61,0.12)", border: "1px solid rgba(232,162,61,0.3)", borderRadius: "12px", padding: "12px 14px", fontSize: "12px", lineHeight: "1.5", color: "#e8a23d", marginBottom: "16px" },
  selectorsCard: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(127,191,90,0.15)", borderRadius: "16px", padding: "16px", display: "flex", gap: "12px", marginBottom: "12px" },
  selectorGroup: { flex: 1 },
  label: { display: "block", fontSize: "11px", letterSpacing: "0.08em", color: "#7fbf5a", marginBottom: "6px", fontWeight: "600" },
  select: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "14px", boxSizing: "border-box" },
  quickBtn: { background: "transparent", border: "1.5px solid", borderRadius: "999px", padding: "7px 14px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  lista: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  empleadoRow: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" },
  empleadoInfo: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", flex: 1, minWidth: 0 },
  avatar: { width: "40px", height: "40px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 },
  empleadoNombre: { fontSize: "14px", fontWeight: "600", color: "#e8f5e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empleadoTipo: { fontSize: "11px", marginTop: "2px" },
  empty: { textAlign: "center", padding: "40px 20px", color: "rgba(200,230,180,0.4)", fontSize: "13px" },
  guardarBtn: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 24px rgba(90,171,46,0.3)" },
  footerNote: { textAlign: "center", fontSize: "11px", color: "rgba(200,230,180,0.3)", marginTop: "10px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modal: { background: "linear-gradient(160deg, #1a3d25, #0f2818)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "24px 24px 0 0", padding: "28px 24px", width: "100%", maxWidth: "480px", maxHeight: "88vh", overflowY: "auto", position: "relative", boxSizing: "border-box" },
  modalClose: { position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "999px", width: "32px", height: "32px", color: "#e8f5e0", fontSize: "14px", cursor: "pointer" },
  modalNombre: { fontSize: "18px", fontWeight: "700", textAlign: "center", margin: "0 0 16px", color: "#ffffff" },
  modalSection: { marginBottom: "20px" },
  seccionTitulo: { fontSize: "13px", fontWeight: "700", color: "#c8e89a", marginBottom: "4px", borderBottom: "1px solid rgba(127,191,90,0.2)", paddingBottom: "6px" },
  formGrid2: { display: "flex", gap: "10px" },
  jornadaBtn: { border: "1.5px solid", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", background: "transparent" },
  textarea: { width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(127,191,90,0.25)", borderRadius: "10px", padding: "10px 12px", color: "#e8f5e0", fontSize: "13px", minHeight: "70px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  modalGuardar: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: "700", cursor: "pointer" },
};

