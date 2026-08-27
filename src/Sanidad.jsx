// ============ JR AGROCONTROL — Sanidad.jsx v0.8.2 ============
// v0.8.2: CAMBIO DE FONDO en cómo se captura la dosis, siguiendo la
// bitácora real de campo. Ya no se captura "cantidad total a usar" —
// ahora se captura litros de agua por tambo + gasto total de agua a
// nivel de toda la aplicación (de ahí se calcula el número de tambos),
// y por producto se captura la dosis POR TAMBO — el total sale de
// multiplicar dosis × tambos, sin que el usuario tenga que calcularlo
// a mano. Columnas renombradas: cantidad_recomendada/cantidad_aplicada
// → dosis_por_tambo_recomendada/dosis_por_tambo_aplicada. El costo
// congelado ahora es costo_unitario × dosis_por_tambo × tambos.
// v0.8.1: se muestra el ingrediente_activo junto al nombre comercial en
// los resultados de búsqueda, las líneas agregadas, y la pantalla de
// confirmar — ayuda a identificar qué se está aplicando de verdad,
// más allá del nombre comercial.
// Módulo 8. Registro de aplicaciones foliares — control de plagas/enfermedades
// (ligado a Listas Autorizadas para trazabilidad) y nutrición/coadyuvantes
// acompañantes en el mismo tanque, cuando aplique.
//
// Patrón de dos acciones, igual que Fertilizaciones.jsx: se crea una
// recomendación (pendiente), luego se confirma en campo lo realmente
// aplicado (con motivo si cambia algo). Costos e intervalos de seguridad/
// reentrada se congelan al momento de confirmar — nunca se recalculan
// después ni se tocan existencias todavía (eso queda para más adelante).
//
// Cada línea del detalle puede ser:
//   - "control": ligada a listas_productos (trazabilidad de qué lista/
//     revisión autorizó ese producto para esa plaga, con su dosis e
//     intervalos ya definidos ahí).
//   - "nutriente": un producto suelto del catálogo (nutricional, bioestimulante,
//     coadyuvante) que acompaña en el mismo tanque, sin ligar a ninguna lista.
//
// Alerta de rotación: al agregar una línea de control para una plaga, se
// revisa el historial reciente de ese sector+plaga y se avisa si el grupo
// químico ya se usó — información real de tu propio historial, no una
// decisión automática de qué aplicar.
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import { esAdmin } from "./lib/permisos";

// ---- Paginación: Supabase corta en 1000 filas por consulta si no se pagina ----
async function fetchTodasLasFilas(tabla, columnas, filtro) {
  let todas = [];
  let desde = 0;
  const tamano = 1000;
  while (true) {
    let q = supabase.from(tabla).select(columnas).range(desde, desde + tamano - 1);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw error;
    todas = todas.concat(data || []);
    if (!data || data.length < tamano) break;
    desde += tamano;
  }
  return todas;
}

const DIAS_ROTACION = 30; // ventana para la alerta de rotación de grupo químico

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
    <div style={S.page}>
      <div style={{ ...S.container, paddingTop: "60px" }}>
        <div style={S.eyebrow}>JR AGROCONTROL</div>
        <h1 style={S.title}>Iniciar sesión</h1>
        <form onSubmit={ingresar} style={{ marginTop: "24px" }}>
          <div style={S.selectorGroup}>
            <label style={S.label}>Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={S.select} required />
          </div>
          <div style={{ ...S.selectorGroup, marginTop: "12px" }}>
            <label style={S.label}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={S.select} required />
          </div>
          {error && <p style={{ color: "#e05c5c", fontSize: "12px", marginTop: "8px" }}>{error}</p>}
          <button type="submit" disabled={cargando} style={{ ...S.guardarBtn, marginTop: "20px" }}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sanidad() {
  const [sesion, setSesion] = useState(undefined);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  // Catálogos base
  const [ranchos, setRanchos] = useState([]);
  const [sectores, setSectores] = useState([]);       // id, rancho_id, nombre, cultivo_id, lista_activa_id
  const [cultivos, setCultivos] = useState([]);        // id, especie_id
  const [listas, setListas] = useState([]);            // id, especie_id, comercializadora_id, empresa_id, activo
  const [listasProductos, setListasProductos] = useState([]); // catálogo de control (plaga -> producto)
  const [productosInsumos, setProductosInsumos] = useState([]); // catálogo completo (para nutrientes + costo)

  // Filtros de la pantalla principal
  const [ranchoId, setRanchoId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [aplicaciones, setAplicaciones] = useState([]);
  const [cargandoAplicaciones, setCargandoAplicaciones] = useState(false);

  const [vista, setVista] = useState("lista"); // 'lista' | 'crear' | 'confirmar'
  const [subVista, setSubVista] = useState("pendientes"); // 'pendientes' | 'historial'
  const [conteoLineas, setConteoLineas] = useState({});

  // ---- Formulario: nueva aplicación ----
  const [nuevaSectorId, setNuevaSectorId] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nuevaOrigen, setNuevaOrigen] = useState("reactivo");
  const [nuevaNotas, setNuevaNotas] = useState("");
  const [aguaPorTambo, setAguaPorTambo] = useState("");
  const [gastoTotalAgua, setGastoTotalAgua] = useState("");
  const [repetir, setRepetir] = useState({ activo: false, cadaDias: 7, veces: 4 });
  const [lineas, setLineas] = useState([]);
  const [modoAgregar, setModoAgregar] = useState(null); // null | 'control' | 'nutriente'
  const [textoPlaga, setTextoPlaga] = useState("");
  const [textoNutriente, setTextoNutriente] = useState("");
  const [alertaRotacion, setAlertaRotacion] = useState("");
  const [errorNueva, setErrorNueva] = useState("");
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  // ---- Confirmar aplicación ----
  const [aplicacionConfirmando, setAplicacionConfirmando] = useState(null); // {id, sector_id, fecha_recomendada, notas}
  const [detalleConfirmando, setDetalleConfirmando] = useState([]); // líneas con datos ya resueltos
  const [motivoModificacion, setMotivoModificacion] = useState("");
  const [motivoOtroTexto, setMotivoOtroTexto] = useState("");
  const [aguaPorTamboConfirmar, setAguaPorTamboConfirmar] = useState("");
  const [gastoTotalAguaConfirmar, setGastoTotalAguaConfirmar] = useState("");
  const [errorConfirmar, setErrorConfirmar] = useState("");
  const [guardandoConfirmar, setGuardandoConfirmar] = useState(false);

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
    supabase.from("usuarios").select("nombre_completo, rol, empresa_id, rancho_id").eq("id", sesion.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErrorCarga("Tu usuario no tiene perfil asignado."); return; }
        setUsuarioActual({ nombre: data.nombre_completo, rol: data.rol, empresa_id: data.empresa_id, rancho_id: data.rancho_id });
      });
  }, [sesion]);

  // ---- Catálogos base ----
  useEffect(() => {
    if (!usuarioActual) return;
    setCargandoCatalogos(true);

    (async () => {
      try {
        const [r, s, cul, lst, lp, pi] = await Promise.all([
          supabase.from("ranchos").select("id, nombre").eq("activo", true).order("nombre"),
          supabase.from("sectores").select("id, rancho_id, nombre, cultivo_id, lista_activa_id").eq("activo", true),
          supabase.from("cultivos").select("id, especie_id"),
          supabase.from("listas").select("id, especie_id, comercializadora_id, empresa_id, activo").eq("activo", true),
          fetchTodasLasFilas(
            "listas_productos",
            "id, lista_id, producto_fitosanitario_id, plaga_comun, plaga_cientifica, dosis_etiqueta, intervalo_seguridad_horas, intervalo_reentrada, lmr_ppm, productos_fitosanitarios(producto_id, grupo_quimico, productos_insumos(nombre_comercial, ingrediente_activo, costo_unitario, unidad_base))"
          ),
          fetchTodasLasFilas("productos_insumos", "id, nombre_comercial, categoria, ingrediente_activo, costo_unitario, unidad_base"),
        ]);
        const err = r.error || s.error || cul.error || lst.error;
        if (err) { setErrorCarga(err.message); setCargandoCatalogos(false); return; }

        setRanchos(r.data || []);
        setSectores(s.data || []);
        setCultivos(cul.data || []);
        setListas(lst.data || []);
        setListasProductos(lp || []);
        setProductosInsumos(pi || []);
        if (r.data?.length && !ranchoId) setRanchoId(r.data[0].id);
      } catch (e) {
        setErrorCarga(e.message);
      }
      setCargandoCatalogos(false);
    })();
  }, [usuarioActual]);

  // ---- Lista autorizada activa de un sector (mismo principio que Almacén, a nivel sector) ----
  function listaActivaDeSector(sectorId) {
    const sector = sectores.find(s => s.id === sectorId);
    if (!sector) return null;
    if (sector.lista_activa_id) return sector.lista_activa_id;
    if (!sector.cultivo_id) return null;
    const cultivo = cultivos.find(c => c.id === sector.cultivo_id);
    if (!cultivo) return null;

    const propia = listas.find(l => l.especie_id === cultivo.especie_id && l.comercializadora_id == null && l.empresa_id != null);
    if (propia) return propia.id;
    const global = listas.find(l => l.especie_id === cultivo.especie_id && l.comercializadora_id == null && l.empresa_id == null);
    return global ? global.id : null;
  }

  // ---- Productos de control disponibles para una plaga, en la lista activa del sector ----
  function buscarControlPorPlaga(sectorId, textoPlaga) {
    const listaId = listaActivaDeSector(sectorId);
    if (!listaId) return [];
    const t = (textoPlaga || "").trim().toLowerCase();
    return listasProductos.filter(lp =>
      lp.lista_id === listaId &&
      (t === "" ||
        (lp.plaga_comun || "").toLowerCase().includes(t) ||
        (lp.plaga_cientifica || "").toLowerCase().includes(t))
    );
  }

  // ---- Aplicaciones del rancho seleccionado ----
  async function cargarAplicaciones() {
    if (!ranchoId) return;
    setCargandoAplicaciones(true);
    try {
      const { data, error } = await supabase
        .from("sanidad_aplicaciones")
        .select("id, sector_id, fecha_recomendada, origen, estado, recomendada_por, aplicada_por, motivo_modificacion, notas, agua_por_tambo, gasto_total_agua")
        .eq("rancho_id", ranchoId)
        .order("fecha_recomendada", { ascending: false });
      if (error) throw error;
      setAplicaciones(data || []);

      const ids = (data || []).map(a => a.id);
      if (ids.length) {
        const { data: detalles, error: errDet } = await supabase
          .from("sanidad_aplicacion_detalle")
          .select("sanidad_aplicacion_id")
          .in("sanidad_aplicacion_id", ids);
        if (errDet) throw errDet;
        const conteo = {};
        (detalles || []).forEach(d => { conteo[d.sanidad_aplicacion_id] = (conteo[d.sanidad_aplicacion_id] || 0) + 1; });
        setConteoLineas(conteo);
      } else {
        setConteoLineas({});
      }
    } catch (e) {
      setErrorCarga(e.message);
    }
    setCargandoAplicaciones(false);
  }

  useEffect(() => {
    if (!usuarioActual || cargandoCatalogos) return;
    cargarAplicaciones();
  }, [usuarioActual, cargandoCatalogos, ranchoId]);

  // ---- Alerta de rotación: grupos químicos usados recientemente en este sector+plaga ----
  async function grupoQuimicoRecienteEnSectorPlaga(sectorId, plagaComun) {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_ROTACION);
    const desdeStr = desde.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("sanidad_aplicacion_detalle")
      .select("sanidad_aplicaciones!inner(sector_id, fecha_recomendada), listas_productos(plaga_comun, productos_fitosanitarios(grupo_quimico))")
      .eq("sanidad_aplicaciones.sector_id", sectorId)
      .gte("sanidad_aplicaciones.fecha_recomendada", desdeStr);

    if (error) { console.error(error); return []; }

    const plagaNorm = (plagaComun || "").trim().toLowerCase();
    const grupos = new Set();
    (data || []).forEach(row => {
      const lp = row.listas_productos;
      if (!lp || (lp.plaga_comun || "").trim().toLowerCase() !== plagaNorm) return;
      const grupo = lp.productos_fitosanitarios?.grupo_quimico;
      if (grupo) grupos.add(grupo);
    });
    return Array.from(grupos);
  }

  async function agregarLineaControl(entradaLista) {
    const nombreProducto = entradaLista.productos_fitosanitarios?.productos_insumos?.nombre_comercial || "Producto";
    const ingredienteActivo = entradaLista.productos_fitosanitarios?.productos_insumos?.ingrediente_activo || "";
    const grupoQuimico = entradaLista.productos_fitosanitarios?.grupo_quimico || null;
    const productoId = entradaLista.productos_fitosanitarios?.producto_id;

    setLineas(prev => [...prev, {
      tipo: "control",
      listaProductoId: entradaLista.id,
      productoId,
      nombreProducto,
      ingredienteActivo,
      plagaComun: entradaLista.plaga_comun,
      plagaCientifica: entradaLista.plaga_cientifica,
      dosisEtiqueta: entradaLista.dosis_etiqueta,
      intervaloSeguridad: entradaLista.intervalo_seguridad_horas,
      intervaloReentrada: entradaLista.intervalo_reentrada,
      grupoQuimico,
      unidadBase: entradaLista.productos_fitosanitarios?.productos_insumos?.unidad_base || "",
      costoUnitario: entradaLista.productos_fitosanitarios?.productos_insumos?.costo_unitario ?? 0,
      cantidadRecomendada: "",
    }]);
    setModoAgregar(null);
    setTextoPlaga("");

    if (nuevaSectorId && grupoQuimico) {
      const gruposRecientes = await grupoQuimicoRecienteEnSectorPlaga(nuevaSectorId, entradaLista.plaga_comun);
      if (gruposRecientes.includes(grupoQuimico)) {
        setAlertaRotacion(`Ya aplicaste ${grupoQuimico} para ${entradaLista.plaga_comun} en este sector en los últimos ${DIAS_ROTACION} días — considera rotar a otro grupo químico.`);
      }
    }
  }

  function agregarLineaNutriente(producto) {
    setLineas(prev => [...prev, {
      tipo: "nutriente",
      listaProductoId: null,
      productoId: producto.id,
      nombreProducto: producto.nombre_comercial,
      ingredienteActivo: producto.ingrediente_activo || "",
      unidadBase: producto.unidad_base || "",
      costoUnitario: producto.costo_unitario ?? 0,
      cantidadRecomendada: "",
    }]);
    setModoAgregar(null);
    setTextoNutriente("");
  }

  function quitarLinea(indice) {
    setLineas(prev => prev.filter((_, i) => i !== indice));
  }

  function actualizarCantidadLinea(indice, valor) {
    setLineas(prev => prev.map((l, i) => i === indice ? { ...l, cantidadRecomendada: valor } : l));
  }

  function resetFormularioNueva() {
    setNuevaSectorId("");
    setNuevaFecha(new Date().toISOString().slice(0, 10));
    setNuevaOrigen("reactivo");
    setNuevaNotas("");
    setAguaPorTambo("");
    setGastoTotalAgua("");
    setRepetir({ activo: false, cadaDias: 7, veces: 4 });
    setLineas([]);
    setModoAgregar(null);
    setTextoPlaga("");
    setTextoNutriente("");
    setAlertaRotacion("");
    setErrorNueva("");
  }

  // ---- Guardar: crea la(s) cabecera(s) + su detalle ----
  // Nota: no es una transacción atómica por fecha — cada fecha del rango
  // (cuando se repite) se inserta por separado. Si algún día esto se usa
  // mucho para lotes grandes, vale la pena moverlo a una función RPC
  // atómica, como fn_cargar_lista en Listas Autorizadas.
  async function guardarAplicacion() {
    if (!nuevaSectorId || lineas.length === 0) return;
    setGuardandoNueva(true);
    setErrorNueva("");

    const sector = sectores.find(s => s.id === nuevaSectorId);
    const fechas = [nuevaFecha];
    if (nuevaOrigen === "programado" && repetir.activo && repetir.veces > 1 && repetir.cadaDias > 0) {
      let f = new Date(nuevaFecha + "T00:00:00");
      for (let i = 1; i < repetir.veces; i++) {
        f = new Date(f.getTime() + repetir.cadaDias * 86400000);
        fechas.push(f.toISOString().slice(0, 10));
      }
    }

    try {
      for (const f of fechas) {
        const { data: cab, error: errCab } = await supabase
          .from("sanidad_aplicaciones")
          .insert({
            empresa_id: usuarioActual.empresa_id,
            rancho_id: sector.rancho_id,
            sector_id: nuevaSectorId,
            fecha_recomendada: f,
            origen: nuevaOrigen,
            estado: "pendiente",
            recomendada_por: sesion.user.id,
            notas: nuevaNotas || null,
            agua_por_tambo: aguaPorTambo !== "" ? Number(aguaPorTambo) : null,
            gasto_total_agua: gastoTotalAgua !== "" ? Number(gastoTotalAgua) : null,
          })
          .select("id")
          .single();
        if (errCab) throw errCab;

        const filasDetalle = lineas.map(l => ({
          sanidad_aplicacion_id: cab.id,
          listas_productos_id: l.listaProductoId,
          producto_id: l.productoId,
          dosis_por_tambo_recomendada: l.cantidadRecomendada !== "" ? Number(l.cantidadRecomendada) : null,
        }));
        const { error: errDet } = await supabase.from("sanidad_aplicacion_detalle").insert(filasDetalle);
        if (errDet) throw errDet;
      }

      resetFormularioNueva();
      setVista("lista");
      cargarAplicaciones();
    } catch (e) {
      setErrorNueva(e.message);
    }
    setGuardandoNueva(false);
  }

  // ---- Número de tambos = gasto total de agua ÷ agua por tambo ----
  function calcularTambos(agua, gasto) {
    const a = Number(agua), g = Number(gasto);
    if (!a || !g) return 0;
    return g / a;
  }

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  // ---- Abrir una aplicación pendiente para confirmarla ----
  async function abrirConfirmar(aplicacion) {
    setErrorConfirmar("");
    setMotivoModificacion("");
    setMotivoOtroTexto("");
    setAguaPorTamboConfirmar(aplicacion.agua_por_tambo ?? "");
    setGastoTotalAguaConfirmar(aplicacion.gasto_total_agua ?? "");
    try {
      const { data, error } = await supabase
        .from("sanidad_aplicacion_detalle")
        .select("id, listas_productos_id, producto_id, dosis_por_tambo_recomendada, dosis_por_tambo_aplicada")
        .eq("sanidad_aplicacion_id", aplicacion.id);
      if (error) throw error;

      const lineasResueltas = (data || []).map(d => {
        const lp = listasProductos.find(l => l.id === d.listas_productos_id);
        const prod = productosInsumos.find(p => p.id === d.producto_id);
        return {
          id: d.id,
          listaProductoId: d.listas_productos_id,
          productoId: d.producto_id,
          tipo: d.listas_productos_id ? "control" : "nutriente",
          nombreProducto: lp?.productos_fitosanitarios?.productos_insumos?.nombre_comercial || prod?.nombre_comercial || "Producto",
          ingredienteActivo: lp?.productos_fitosanitarios?.productos_insumos?.ingrediente_activo || prod?.ingrediente_activo || "",
          unidadBase: lp?.productos_fitosanitarios?.productos_insumos?.unidad_base || prod?.unidad_base || "",
          plagaComun: lp?.plaga_comun || null,
          dosisEtiqueta: lp?.dosis_etiqueta || null,
          intervaloSeguridad: lp?.intervalo_seguridad_horas ?? null,
          intervaloReentrada: lp?.intervalo_reentrada ?? null,
          cantidadRecomendada: d.dosis_por_tambo_recomendada,
          cantidadAplicada: d.dosis_por_tambo_aplicada ?? d.dosis_por_tambo_recomendada ?? "",
        };
      });

      setAplicacionConfirmando(aplicacion);
      setDetalleConfirmando(lineasResueltas);
      setVista("confirmar");
    } catch (e) {
      setErrorCarga(e.message);
    }
  }

  function actualizarCantidadAplicada(indice, valor) {
    setDetalleConfirmando(prev => prev.map((l, i) => i === indice ? { ...l, cantidadAplicada: valor } : l));
  }

  const huboModificacion =
    detalleConfirmando.some(l => Number(l.cantidadAplicada) !== Number(l.cantidadRecomendada)) ||
    Number(aguaPorTamboConfirmar) !== Number(aplicacionConfirmando?.agua_por_tambo) ||
    Number(gastoTotalAguaConfirmar) !== Number(aplicacionConfirmando?.gasto_total_agua);

  async function confirmarAplicacion() {
    if (huboModificacion && !motivoModificacion) {
      setErrorConfirmar("Cambió la cantidad de al menos un producto — indica el motivo.");
      return;
    }
    setGuardandoConfirmar(true);
    setErrorConfirmar("");

    try {
      const tambos = calcularTambos(aguaPorTamboConfirmar, gastoTotalAguaConfirmar);

      for (const l of detalleConfirmando) {
        const prod = productosInsumos.find(p => p.id === l.productoId);
        // Costo: costo_unitario vigente × dosis por tambo × número de tambos
        const costoUnitario = prod?.costo_unitario ?? 0;
        const dosisPorTambo = l.cantidadAplicada !== "" ? Number(l.cantidadAplicada) : 0;
        const cantidadTotal = dosisPorTambo * tambos;

        const { error } = await supabase
          .from("sanidad_aplicacion_detalle")
          .update({
            dosis_por_tambo_aplicada: dosisPorTambo,
            costo_unitario_congelado: costoUnitario,
            costo_total: costoUnitario * cantidadTotal,
            intervalo_seguridad_congelado: l.intervaloSeguridad,
            intervalo_reentrada_congelado: l.intervaloReentrada,
          })
          .eq("id", l.id);
        if (error) throw error;
      }

      const { error: errCab } = await supabase
        .from("sanidad_aplicaciones")
        .update({
          estado: huboModificacion ? "modificada" : "aplicada",
          aplicada_por: sesion.user.id,
          fecha_aplicada: new Date().toISOString(),
          motivo_modificacion: huboModificacion ? motivoModificacion : null,
          motivo_otro_texto: huboModificacion && motivoModificacion === "otro" ? motivoOtroTexto : null,
          agua_por_tambo: aguaPorTamboConfirmar !== "" ? Number(aguaPorTamboConfirmar) : null,
          gasto_total_agua: gastoTotalAguaConfirmar !== "" ? Number(gastoTotalAguaConfirmar) : null,
        })
        .eq("id", aplicacionConfirmando.id);
      if (errCab) throw errCab;

      setAplicacionConfirmando(null);
      setDetalleConfirmando([]);
      setAguaPorTamboConfirmar("");
      setGastoTotalAguaConfirmar("");
      setVista("lista");
      cargarAplicaciones();
    } catch (e) {
      setErrorConfirmar(e.message);
    }
    setGuardandoConfirmar(false);
  }



  // ---- Estados de carga / acceso ----
  if (sesion === undefined) return <div style={S.page}><div style={S.container}>Cargando…</div></div>;
  if (!sesion) return <Login />;
  if (!usuarioActual) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <p>{errorCarga || "Cargando perfil…"}</p>
          {errorCarga && <button onClick={cerrarSesion} style={{ ...S.guardarBtn, marginTop: "16px" }}>Cerrar sesión</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>JR AGROCONTROL · SANIDAD</div>
            <h1 style={S.title}>Aplicaciones Fitosanitarias</h1>
            <div style={S.usuarioTag}>
              {usuarioActual.nombre} · {usuarioActual.rol}
              {" · "}<button onClick={cerrarSesion} style={S.logoutLink}>Cerrar sesión</button>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={S.headerIcon}>🧪</div>
            <div style={S.version}>v0.8.2</div>
          </div>
        </div>

        {errorCarga && <div style={{ ...S.avisoRestriccion, borderColor: "rgba(224,92,92,0.3)", background: "rgba(224,92,92,0.12)", color: "#e05c5c" }}>{errorCarga}</div>}

        {cargandoCatalogos ? (
          <div style={S.empty}>Cargando catálogos…</div>
        ) : vista === "lista" ? (
          <>
            <div style={S.selectorGroup}>
              <label style={S.label}>Rancho</label>
              <select value={ranchoId} onChange={(e) => setRanchoId(e.target.value)} style={S.select}>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>

            <button style={{ ...S.guardarBtn, marginBottom: "16px" }} onClick={() => setVista("crear")}>
              + Nueva aplicación
            </button>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                style={{ ...S.btnSecundario, flex: 1, ...(subVista === "pendientes" ? { borderColor: "#7fbf5a", color: "#7fbf5a" } : {}) }}
                onClick={() => setSubVista("pendientes")}
              >
                Pendientes
              </button>
              <button
                style={{ ...S.btnSecundario, flex: 1, ...(subVista === "historial" ? { borderColor: "#7fbf5a", color: "#7fbf5a" } : {}) }}
                onClick={() => setSubVista("historial")}
              >
                Historial
              </button>
            </div>

            {cargandoAplicaciones ? (
              <div style={S.empty}>Cargando aplicaciones…</div>
            ) : (
              (() => {
                const filtradas = aplicaciones.filter(a =>
                  subVista === "pendientes" ? a.estado === "pendiente" : a.estado !== "pendiente"
                );
                if (filtradas.length === 0) {
                  return <div style={S.empty}>{subVista === "pendientes" ? "No hay aplicaciones pendientes." : "Sin historial todavía."}</div>;
                }
                return filtradas.map(a => {
                  const sector = sectores.find(s => s.id === a.sector_id);
                  const tagStyle = a.estado === "pendiente" ? S.tagPendiente : a.estado === "cancelada" ? S.tagCancelada : S.tagAplicada;
                  return (
                    <div key={a.id} style={S.tarjeta}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong>{sector?.nombre || "Sector desconocido"}</strong>
                          <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.6)", marginTop: "2px" }}>
                            {a.fecha_recomendada} · {a.origen === "programado" ? "Programado" : "Reactivo"} · {conteoLineas[a.id] || 0} producto{(conteoLineas[a.id] || 0) === 1 ? "" : "s"}
                          </div>
                        </div>
                        <span style={tagStyle}>{a.estado}</span>
                      </div>
                      {a.estado === "pendiente" && (
                        <button style={{ ...S.btnSecundario, marginTop: "10px" }} onClick={() => abrirConfirmar(a)}>
                          Confirmar aplicación
                        </button>
                      )}
                    </div>
                  );
                });
              })()
            )}
          </>
        ) : vista === "crear" ? (
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>Nueva aplicación</div>

            <div style={S.selectorGroup}>
              <label style={S.label}>Sector</label>
              <select value={nuevaSectorId} onChange={(e) => setNuevaSectorId(e.target.value)} style={S.select}>
                <option value="">Selecciona…</option>
                {sectores.filter(s => s.rancho_id === ranchoId).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div style={S.formGrid2}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Fecha</label>
                <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} style={S.select} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Origen</label>
                <select value={nuevaOrigen} onChange={(e) => setNuevaOrigen(e.target.value)} style={S.select}>
                  <option value="reactivo">Reactivo</option>
                  <option value="programado">Programado</option>
                </select>
              </div>
            </div>

            <div style={S.formGrid2}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Agua por tambo (L)</label>
                <input type="number" step="0.01" min="0" value={aguaPorTambo} onChange={(e) => setAguaPorTambo(e.target.value)} style={S.select} placeholder="200" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Gasto total de agua (L)</label>
                <input type="number" step="0.01" min="0" value={gastoTotalAgua} onChange={(e) => setGastoTotalAgua(e.target.value)} style={S.select} placeholder="1000" />
              </div>
            </div>
            {aguaPorTambo && gastoTotalAgua && (
              <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)", marginTop: "-6px", marginBottom: "12px" }}>
                = {calcularTambos(aguaPorTambo, gastoTotalAgua).toFixed(2)} tambo(s) para todo el sector
              </div>
            )}

            {nuevaOrigen === "programado" && (
              <div style={S.tarjeta}>
                <label style={{ ...S.label, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={repetir.activo} onChange={(e) => setRepetir({ ...repetir, activo: e.target.checked })} />
                  Repetir
                </label>
                {repetir.activo && (
                  <div style={S.formGrid2}>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Cada (días)</label>
                      <input type="number" min="1" value={repetir.cadaDias} onChange={(e) => setRepetir({ ...repetir, cadaDias: Number(e.target.value) })} style={S.select} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Número de veces</label>
                      <input type="number" min="1" value={repetir.veces} onChange={(e) => setRepetir({ ...repetir, veces: Number(e.target.value) })} style={S.select} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={S.seccionTitulo}>Productos</div>

            {lineas.map((l, i) => (
              <div key={i} style={S.lineaProducto}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{l.nombreProducto}</strong>
                    {l.ingredienteActivo && <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)" }}> · {l.ingredienteActivo}</span>}
                    <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.6)" }}>
                      {l.tipo === "control" ? `Control · ${l.plagaComun} · ref. etiqueta: ${l.dosisEtiqueta || "s/d"}` : "Nutriente / coadyuvante"}
                    </div>
                  </div>
                  <button onClick={() => quitarLinea(i)} style={{ background: "none", border: "none", color: "#e05c5c", fontSize: "16px", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="Dosis por tambo"
                    value={l.cantidadRecomendada}
                    onChange={(e) => actualizarCantidadLinea(i, e.target.value)}
                    style={{ ...S.select, flex: 1 }}
                  />
                  {l.unidadBase && <span style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)" }}>{l.unidadBase}/tambo</span>}
                </div>
                {l.cantidadRecomendada && aguaPorTambo && gastoTotalAgua && (
                  <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)", marginTop: "4px" }}>
                    Total para el sector: {(Number(l.cantidadRecomendada) * calcularTambos(aguaPorTambo, gastoTotalAgua)).toFixed(2)} {l.unidadBase}
                  </div>
                )}
              </div>
            ))}

            {alertaRotacion && <div style={S.alertaRotacion}>⚠️ {alertaRotacion}</div>}

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button style={{ ...S.btnSecundario, flex: 1 }} onClick={() => setModoAgregar(modoAgregar === "control" ? null : "control")}>+ Control de plaga</button>
              <button style={{ ...S.btnSecundario, flex: 1 }} onClick={() => setModoAgregar(modoAgregar === "nutriente" ? null : "nutriente")}>+ Nutriente</button>
            </div>

            {modoAgregar === "control" && (
              <div style={S.tarjeta}>
                {!nuevaSectorId ? (
                  <div style={S.empty}>Elige un sector primero.</div>
                ) : (
                  <>
                    <input placeholder="Buscar por plaga…" value={textoPlaga} onChange={(e) => setTextoPlaga(e.target.value)} style={S.select} />
                    {buscarControlPorPlaga(nuevaSectorId, textoPlaga).length === 0 ? (
                      <div style={{ ...S.empty, padding: "16px 0" }}>Sin resultados en la lista autorizada de este sector.</div>
                    ) : (
                      buscarControlPorPlaga(nuevaSectorId, textoPlaga).map(r => (
                        <div key={r.id} style={{ ...S.lineaProducto, cursor: "pointer", marginTop: "10px" }} onClick={() => agregarLineaControl(r)}>
                          <strong>{r.productos_fitosanitarios?.productos_insumos?.nombre_comercial || "Producto"}</strong>
                          {r.productos_fitosanitarios?.productos_insumos?.ingrediente_activo && (
                            <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)" }}> · {r.productos_fitosanitarios.productos_insumos.ingrediente_activo}</span>
                          )}
                          <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.6)", marginTop: "2px" }}>
                            {r.plaga_comun} · dosis {r.dosis_etiqueta || "s/d"} · seguridad {r.intervalo_seguridad_horas ?? "s/d"}h · reentrada {r.intervalo_reentrada ?? "s/d"}h
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}

            {modoAgregar === "nutriente" && (
              <div style={S.tarjeta}>
                <input placeholder="Buscar producto…" value={textoNutriente} onChange={(e) => setTextoNutriente(e.target.value)} style={S.select} />
                {productosInsumos
                  .filter(p => p.categoria !== "fitosanitario" && p.nombre_comercial.toLowerCase().includes(textoNutriente.toLowerCase()))
                  .map(p => (
                    <div key={p.id} style={{ ...S.lineaProducto, cursor: "pointer", marginTop: "10px" }} onClick={() => agregarLineaNutriente(p)}>
                      <strong>{p.nombre_comercial}</strong>
                      {p.ingrediente_activo && <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)" }}> · {p.ingrediente_activo}</span>}
                    </div>
                  ))}
              </div>
            )}

            <div style={{ ...S.selectorGroup, marginTop: "12px" }}>
              <label style={S.label}>Notas (opcional)</label>
              <input value={nuevaNotas} onChange={(e) => setNuevaNotas(e.target.value)} style={S.select} />
            </div>

            {errorNueva && <p style={{ color: "#e05c5c", fontSize: "12px", marginBottom: "8px" }}>{errorNueva}</p>}

            <button style={S.guardarBtn} disabled={!nuevaSectorId || lineas.length === 0 || guardandoNueva} onClick={guardarAplicacion}>
              {guardandoNueva ? "Guardando…" : "Guardar como pendiente"}
            </button>
            <button style={{ ...S.btnSecundario, marginTop: "10px" }} onClick={() => { setVista("lista"); resetFormularioNueva(); }}>Cancelar</button>
          </div>
        ) : (
          <div style={S.seccion}>
            <div style={S.seccionTitulo}>
              Confirmar — {sectores.find(s => s.id === aplicacionConfirmando?.sector_id)?.nombre} · {aplicacionConfirmando?.fecha_recomendada}
            </div>

            <div style={S.formGrid2}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Agua por tambo (L)</label>
                <input type="number" step="0.01" min="0" value={aguaPorTamboConfirmar} onChange={(e) => setAguaPorTamboConfirmar(e.target.value)} style={S.select} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Gasto total de agua (L)</label>
                <input type="number" step="0.01" min="0" value={gastoTotalAguaConfirmar} onChange={(e) => setGastoTotalAguaConfirmar(e.target.value)} style={S.select} />
              </div>
            </div>
            {aguaPorTamboConfirmar && gastoTotalAguaConfirmar && (
              <div style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)", marginTop: "-6px", marginBottom: "12px" }}>
                = {calcularTambos(aguaPorTamboConfirmar, gastoTotalAguaConfirmar).toFixed(2)} tambo(s)
              </div>
            )}

            {detalleConfirmando.map((l, i) => {
              const cambio = l.cantidadAplicada !== "" && Number(l.cantidadAplicada) !== Number(l.cantidadRecomendada);
              const tambos = calcularTambos(aguaPorTamboConfirmar, gastoTotalAguaConfirmar);
              return (
                <div key={l.id} style={S.lineaProducto}>
                  <strong>{l.nombreProducto}</strong>
                  {l.ingredienteActivo && <span style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)" }}> · {l.ingredienteActivo}</span>}
                  <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.6)", marginTop: "2px" }}>
                    {l.tipo === "control"
                      ? `Control · ${l.plagaComun} · seguridad ${l.intervaloSeguridad ?? "s/d"}h · reentrada ${l.intervaloReentrada ?? "s/d"}h`
                      : "Nutriente / coadyuvante"}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)", marginTop: "2px" }}>
                    Recomendado: {l.cantidadRecomendada ?? "s/d"} {l.unidadBase}/tambo
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                    <input
                      type="number" step="0.01" min="0"
                      value={l.cantidadAplicada}
                      onChange={(e) => actualizarCantidadAplicada(i, e.target.value)}
                      style={{ ...S.select, flex: 1, ...(cambio ? { borderColor: "#e8a23d" } : {}) }}
                    />
                    {l.unidadBase && <span style={{ fontSize: "12px", color: "rgba(200,230,180,0.6)" }}>{l.unidadBase}/tambo</span>}
                  </div>
                  {l.cantidadAplicada !== "" && tambos > 0 && (
                    <div style={{ fontSize: "11px", color: "rgba(200,230,180,0.5)", marginTop: "4px" }}>
                      Total aplicado: {(Number(l.cantidadAplicada) * tambos).toFixed(2)} {l.unidadBase}
                    </div>
                  )}
                </div>
              );
            })}

            {huboModificacion && (
              <div style={S.seccion}>
                <label style={S.label}>Motivo del cambio</label>
                <select value={motivoModificacion} onChange={(e) => setMotivoModificacion(e.target.value)} style={S.select}>
                  <option value="">Selecciona…</option>
                  <option value="plaga_mayor">Nivel de plaga mayor al esperado</option>
                  <option value="plaga_menor">Nivel de plaga menor al esperado</option>
                  <option value="clima">Condición climática</option>
                  <option value="disponibilidad">Disponibilidad de producto</option>
                  <option value="otro">Otro</option>
                </select>
                {motivoModificacion === "otro" && (
                  <input
                    placeholder="Describe el motivo"
                    value={motivoOtroTexto}
                    onChange={(e) => setMotivoOtroTexto(e.target.value)}
                    style={{ ...S.select, marginTop: "8px" }}
                  />
                )}
              </div>
            )}

            {errorConfirmar && <p style={{ color: "#e05c5c", fontSize: "12px", marginBottom: "8px" }}>{errorConfirmar}</p>}

            <button style={S.guardarBtn} disabled={guardandoConfirmar} onClick={confirmarAplicacion}>
              {guardandoConfirmar ? "Guardando…" : "Confirmar aplicación"}
            </button>
            <button
              style={{ ...S.btnSecundario, marginTop: "10px" }}
              onClick={() => { setAplicacionConfirmando(null); setDetalleConfirmando([]); setAguaPorTamboConfirmar(""); setGastoTotalAguaConfirmar(""); setVista("lista"); }}
              disabled={guardandoConfirmar}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Estilos (mismo lenguaje visual que el resto de la app) ============
const S = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8f5e0", padding: "20px 16px 40px", boxSizing: "border-box" },
  container: { maxWidth: "640px", margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  eyebrow: { fontSize: "11px", letterSpacing: "0.12em", color: "#7fbf5a", marginBottom: "4px", fontWeight: "600" },
  title: { fontSize: "26px", fontWeight: "800", margin: 0, color: "#ffffff" },
  headerIcon: { fontSize: "36px" },
  version: { fontSize: "10px", color: "rgba(127,191,90,0.5)", textAlign: "right", marginTop: "2px" },
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
  guardarBtn: { width: "100%", background: "linear-gradient(135deg, #5aab2e, #3d8c1a)", color: "#ffffff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 24px rgba(90,171,46,0.3)" },
  btnSecundario: { width: "100%", background: "rgba(255,255,255,0.06)", color: "#e8f5e0", border: "1px solid rgba(127,191,90,0.3)", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: "700", cursor: "pointer" },
  tarjeta: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px", marginBottom: "10px" },
  tagPendiente: { display: "inline-block", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px", background: "rgba(232,162,61,0.15)", color: "#e8a23d" },
  tagAplicada: { display: "inline-block", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px", background: "rgba(127,191,90,0.15)", color: "#7fbf5a" },
  tagCancelada: { display: "inline-block", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px", background: "rgba(224,92,92,0.15)", color: "#e05c5c" },
  alertaRotacion: { background: "rgba(224,92,92,0.1)", border: "1px solid rgba(224,92,92,0.3)", borderRadius: "10px", padding: "10px 12px", fontSize: "12px", color: "#e8a23d", marginTop: "8px", marginBottom: "8px" },
  lineaProducto: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px", marginBottom: "8px" },
};
