// ============ JR AGROCONTROL — Fertilizaciones.jsx v0.3.8 ============
// Módulo Fertilizaciones: recomendaciones del agrónomo, confirmación en
// campo (con motivo si se modifica), recetas y mediciones de CE/pH.
// NOTA: verifica que la ruta del import de supabase coincida con la
// usada en Labores.jsx (misma carpeta src/).
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

const C = {
  verde: "#7fbf5a",
  bordeSuave: "1px solid rgba(127,191,90,0.2)",
  tarjeta: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(127,191,90,0.2)",
    borderRadius: "12px", padding: "14px", marginBottom: "12px",
  },
  input: {
    width: "100%", padding: "10px", borderRadius: "8px",
    border: "1.5px solid rgba(127,191,90,0.3)",
    background: "rgba(255,255,255,0.05)", color: "#e8f5e0",
    fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box",
  },
  etiqueta: {
    display: "block", fontSize: "12px", fontWeight: "700",
    color: "rgba(200,230,180,0.7)", margin: "10px 0 4px",
  },
  boton: {
    padding: "10px 14px", borderRadius: "10px", border: "none",
    background: "#7fbf5a", color: "#0f2818", fontWeight: "800",
    fontSize: "14px", cursor: "pointer", fontFamily: "inherit",
  },
  botonSec: {
    padding: "8px 12px", borderRadius: "10px",
    border: "1.5px solid rgba(127,191,90,0.4)",
    background: "transparent", color: "#7fbf5a", fontWeight: "700",
    fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
  },
};

const VIAS = [
  { valor: "fertirriego", texto: "💧 Fertirriego" },
  { valor: "foliar",      texto: "🍃 Foliar" },
  { valor: "suelo",       texto: "🟤 Suelo / drench" },
];

const MOTIVOS = [
  { valor: "falta_producto",      texto: "Falta de producto en bodega" },
  { valor: "producto_no_surtido", texto: "Producto no surtido a tiempo" },
  { valor: "clima",               texto: "Ajuste por clima" },
  { valor: "indicacion_agronomo", texto: "Indicación del agrónomo" },
  { valor: "otro",                texto: "Otro (describir)" },
];

const MUESTRAS = [
  { valor: "suelo",          texto: "Suelo / sustrato" },
  { valor: "solucion_riego", texto: "Solución de riego" },
  { valor: "drenaje",        texto: "Drenaje" },
];

const CHIP = {
  pendiente:  { texto: "🕓 Pendiente",  color: "#e0c56b" },
  aplicada:   { texto: "✅ Aplicada",   color: "#7fbf5a" },
  modificada: { texto: "✏️ Modificada", color: "#6bb8e0" },
  cancelada:  { texto: "✖ Cancelada",  color: "#e07b7b" },
};

// ¿El producto es compatible con la vía?
const compatible = (p, via) =>
  via === "fertirriego" ? p.via_fertirriego :
  via === "foliar" ? p.via_foliar : p.via_suelo;

export default function Fertilizaciones() {
  const [usuario, setUsuario] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [ranchos, setRanchos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [recetaDet, setRecetaDet] = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [aplicacionDet, setAplicacionDet] = useState([]);
  const [mediciones, setMediciones] = useState([]);
  const [pestana, setPestana] = useState("aplicaciones");
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");

  // ---- Nueva recomendación ----
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ rancho_id: "", sector: "", via: "fertirriego", receta_id: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);

  // ---- Confirmación en campo ----
  const [confirmando, setConfirmando] = useState(null);      // id de la aplicación
  const [aplicadas, setAplicadas] = useState({});            // {detalle_id: cantidad}
  const [motivo, setMotivo] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");

  // ---- Nueva receta ----
  const [nuevaReceta, setNuevaReceta] = useState({ nombre: "", cultivo: "", etapa: "", via: "fertirriego" });
  const [lineasReceta, setLineasReceta] = useState([{ producto_id: "", cantidad: "" }]);
  const [creandoReceta, setCreandoReceta] = useState(false);

  // ---- Nueva medición ----
  const [med, setMed] = useState({ rancho_id: "", sector: "", tipo: "suelo", ce: "", ph: "", notas: "" });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: u } = await supabase.from("usuarios")
      .select("id, nombre_completo, rol, rancho_id").eq("id", auth.user.id).single();
    setUsuario(u);

    const { data: r } = await supabase.from("ranchos")
      .select("id, nombre, empresa_id").order("nombre");
    setRanchos(r || []);
    if (r?.length) setEmpresaId(r[0].empresa_id);

    const { data: p } = await supabase.from("productos_insumos")
      .select("id, nombre_comercial, unidad_base, costo_unitario, via_fertirriego, via_foliar, via_suelo")
      .eq("activo", true).order("nombre_comercial");
    setProductos(p || []);

    const { data: rec } = await supabase.from("recetas").select("*").order("nombre");
    setRecetas(rec || []);
    const { data: rd } = await supabase.from("receta_detalle").select("*");
    setRecetaDet(rd || []);

    const { data: f } = await supabase.from("fertilizaciones")
      .select("*").order("fecha_recomendada", { ascending: false }).limit(100);
    setAplicaciones(f || []);
    const { data: fd } = await supabase.from("fertilizacion_detalle").select("*");
    setAplicacionDet(fd || []);

    const { data: m } = await supabase.from("mediciones_campo")
      .select("*").order("fecha", { ascending: false }).limit(30);
    setMediciones(m || []);
    setCargando(false);
  }

  function avisar(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 7000);
  }

  const esAdmin = usuario?.rol === "admin";
  const esAgronomo = usuario?.rol === "agronomo";
  const esEncargado = usuario?.rol === "encargado";
  const puedeRecomendar = esAdmin || esAgronomo;

  const nombreRancho = id => ranchos.find(r => r.id === id)?.nombre || "?";
  const nombreProducto = id => productos.find(p => p.id === id)?.nombre_comercial || "?";
  const unidadProducto = id => productos.find(p => p.id === id)?.unidad_base || "";

  // ================= RECOMENDACIONES =================
  function usarReceta(recetaId) {
    setNueva(n => ({ ...n, receta_id: recetaId }));
    if (!recetaId) return;
    const rec = recetas.find(x => x.id === recetaId);
    const det = recetaDet.filter(d => d.receta_id === recetaId);
    setNueva(n => ({ ...n, receta_id: recetaId, via: rec.tipo_aplicacion }));
    setLineas(det.map(d => ({ producto_id: d.producto_id, cantidad: String(d.cantidad_por_sector) })));
  }

  function cambiarLinea(setter, arr, i, campo, valor) {
    const nuevas = [...arr];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    setter(nuevas);
  }

  async function guardarRecomendacion() {
    if (!nueva.rancho_id || !nueva.sector) return avisar("error", "Selecciona rancho y sector.");
    const validas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return avisar("error", "Agrega al menos un producto con cantidad.");

    const { data: cab, error: e1 } = await supabase.from("fertilizaciones").insert({
      empresa_id: empresaId,
      rancho_id: nueva.rancho_id,
      sector: nueva.sector,
      tipo_aplicacion: nueva.via,
      receta_id: nueva.receta_id || null,
      fecha_recomendada: nueva.fecha,
      recomendada_por: usuario.id,
      notas: nueva.notas || null,
    }).select("id").single();
    if (e1) return avisar("error", e1.message);

    for (const l of validas) {
      const { error: e2 } = await supabase.from("fertilizacion_detalle").insert({
        fertilizacion_id: cab.id,
        producto_id: l.producto_id,
        cantidad_recomendada: Number(l.cantidad),
      });
      if (e2) return avisar("error", `${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("ok", "Recomendación creada. El encargado la verá como pendiente.");
    setCreando(false);
    setNueva({ rancho_id: "", sector: "", via: "fertirriego", receta_id: "", fecha: new Date().toISOString().slice(0, 10), notas: "" });
    setLineas([{ producto_id: "", cantidad: "" }]);
    cargar();
  }

  // ================= CONFIRMACIÓN EN CAMPO =================
  function abrirConfirmacion(f) {
    const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
    const base = {};
    det.forEach(d => { base[d.id] = String(d.cantidad_recomendada); });
    setAplicadas(base);
    setMotivo(""); setMotivoTexto("");
    setConfirmando(f.id);
  }

  function hayCambios(f) {
    return aplicacionDet
      .filter(d => d.fertilizacion_id === f.id)
      .some(d => Number(aplicadas[d.id]) !== Number(d.cantidad_recomendada));
  }

  async function confirmarAplicacion(f) {
    const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
    if (hayCambios(f) && !motivo)
      return avisar("error", "Las cantidades difieren de lo recomendado: selecciona el motivo.");
    if (motivo === "otro" && !motivoTexto.trim())
      return avisar("error", "Describe el motivo en el campo de texto.");

    for (const d of det) {
      const cant = Number(aplicadas[d.id]);
      if (cant !== Number(d.cantidad_recomendada)) {
        const { error } = await supabase.from("fertilizacion_detalle")
          .update({ cantidad_aplicada: cant }).eq("id", d.id);
        if (error) return avisar("error", error.message);
      }
    }
    const { error } = await supabase.from("fertilizaciones").update({
      estado: "aplicada",
      aplicada_por: usuario.id,
      motivo_modificacion: hayCambios(f) ? motivo : null,
      motivo_otro_texto: motivo === "otro" ? motivoTexto.trim() : null,
    }).eq("id", f.id);
    if (error) return avisar("error", error.message);
    avisar("ok", "Aplicación confirmada. El inventario de la bodega del rancho fue descontado.");
    setConfirmando(null);
    cargar();
  }

  async function cancelarRecomendacion(f) {
    if (!window.confirm("¿Cancelar esta recomendación?")) return;
    const { error } = await supabase.from("fertilizaciones")
      .update({ estado: "cancelada" }).eq("id", f.id);
    if (error) return avisar("error", error.message);
    avisar("ok", "Recomendación cancelada.");
    cargar();
  }

  // ================= RECETAS =================
  async function guardarReceta() {
    if (!nuevaReceta.nombre || !nuevaReceta.cultivo)
      return avisar("error", "La receta necesita nombre y cultivo.");
    const validas = lineasReceta.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return avisar("error", "Agrega al menos un producto con dosis.");

    const { data: cab, error: e1 } = await supabase.from("recetas").insert({
      empresa_id: empresaId,
      nombre: nuevaReceta.nombre.trim(),
      cultivo: nuevaReceta.cultivo.trim(),
      etapa_fenologica: nuevaReceta.etapa.trim() || null,
      tipo_aplicacion: nuevaReceta.via,
      creado_por: usuario.id,
    }).select("id").single();
    if (e1) return avisar("error", e1.message);

    for (const l of validas) {
      const { error: e2 } = await supabase.from("receta_detalle").insert({
        receta_id: cab.id,
        producto_id: l.producto_id,
        cantidad_por_sector: Number(l.cantidad),
      });
      if (e2) return avisar("error", `${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("ok", "Receta guardada.");
    setCreandoReceta(false);
    setNuevaReceta({ nombre: "", cultivo: "", etapa: "", via: "fertirriego" });
    setLineasReceta([{ producto_id: "", cantidad: "" }]);
    cargar();
  }

  async function alternarReceta(r) {
    const { error } = await supabase.from("recetas")
      .update({ activo: !r.activo }).eq("id", r.id);
    if (error) return avisar("error", error.message);
    cargar();
  }

  // ================= MEDICIONES =================
  async function guardarMedicion() {
    const ranchoMed = esEncargado ? usuario.rancho_id : med.rancho_id;
    if (!ranchoMed || !med.sector) return avisar("error", "Selecciona rancho y sector.");
    if (!med.ce && !med.ph) return avisar("error", "Captura al menos CE o pH.");
    const { error } = await supabase.from("mediciones_campo").insert({
      empresa_id: empresaId,
      rancho_id: ranchoMed,
      sector: med.sector,
      tipo_muestra: med.tipo,
      ce: med.ce ? Number(med.ce) : null,
      ph: med.ph ? Number(med.ph) : null,
      registrado_por: usuario.id,
      notas: med.notas || null,
    });
    if (error) return avisar("error", error.message);
    avisar("ok", "Medición registrada.");
    setMed({ rancho_id: "", sector: "", tipo: "suelo", ce: "", ph: "", notas: "" });
    cargar();
  }

  // ================= VISTA =================
  if (cargando) return <div style={{ padding: 24, color: "#7fbf5a" }}>Cargando fertilizaciones…</div>;

  const aplicacionesVisibles = aplicaciones
    .filter(f => !esEncargado || f.rancho_id === usuario.rancho_id)
    .filter(f => filtroEstado === "todas" || f.estado === filtroEstado);

  return (
    <div style={{ padding: "14px", maxWidth: "760px", margin: "0 auto", color: "#e8f5e0" }}>
      <h2 style={{ color: C.verde, margin: "4px 0 12px" }}>💧 Fertilizaciones</h2>

      {mensaje && (
        <div style={{
          ...C.tarjeta, borderColor: mensaje.tipo === "ok" ? C.verde : "#e07b7b",
          color: mensaje.tipo === "ok" ? C.verde : "#e07b7b", fontWeight: 700,
        }}>{mensaje.texto}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { key: "aplicaciones", texto: "🧪 Aplicaciones" },
          { key: "recetas", texto: "📖 Recetas" },
          { key: "mediciones", texto: "🌡️ CE / pH" },
        ].map(p => (
          <button key={p.key} onClick={() => setPestana(p.key)}
            style={{ ...C.botonSec, background: pestana === p.key ? "rgba(127,191,90,0.15)" : "transparent" }}>
            {p.texto}
          </button>
        ))}
      </div>

      {/* ============ APLICACIONES ============ */}
      {pestana === "aplicaciones" && (
        <div>
          {puedeRecomendar && !creando && (
            <button style={{ ...C.boton, width: "100%", marginBottom: 12 }} onClick={() => setCreando(true)}>
              + Nueva recomendación
            </button>
          )}

          {creando && (
            <div style={C.tarjeta}>
              <div style={{ fontWeight: 800, color: C.verde }}>Nueva recomendación</div>

              <label style={C.etiqueta}>Rancho</label>
              <select style={C.input} value={nueva.rancho_id}
                onChange={e => setNueva({ ...nueva, rancho_id: e.target.value })}>
                <option value="">— Selecciona —</option>
                {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>

              <label style={C.etiqueta}>Sector</label>
              <input style={C.input} placeholder="ej. 5" value={nueva.sector}
                onChange={e => setNueva({ ...nueva, sector: e.target.value })} />

              <label style={C.etiqueta}>Vía de aplicación</label>
              <select style={C.input} value={nueva.via}
                onChange={e => { setNueva({ ...nueva, via: e.target.value, receta_id: "" }); }}>
                {VIAS.map(v => <option key={v.valor} value={v.valor}>{v.texto}</option>)}
              </select>

              <label style={C.etiqueta}>Partir de una receta (opcional)</label>
              <select style={C.input} value={nueva.receta_id} onChange={e => usarReceta(e.target.value)}>
                <option value="">— Captura libre —</option>
                {recetas.filter(r => r.activo && r.tipo_aplicacion === nueva.via)
                  .map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>

              <label style={C.etiqueta}>Fecha recomendada</label>
              <input style={C.input} type="date" value={nueva.fecha}
                onChange={e => setNueva({ ...nueva, fecha: e.target.value })} />

              <label style={C.etiqueta}>Productos y cantidades por sector</label>
              {lineas.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select style={{ ...C.input, flex: 2 }} value={l.producto_id}
                    onChange={e => cambiarLinea(setLineas, lineas, i, "producto_id", e.target.value)}>
                    <option value="">— Producto —</option>
                    {productos.filter(p => compatible(p, nueva.via))
                      .map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                  </select>
                  <input style={{ ...C.input, flex: 1 }} type="number" min="0" step="0.001"
                    placeholder="Cant." value={l.cantidad}
                    onChange={e => cambiarLinea(setLineas, lineas, i, "cantidad", e.target.value)} />
                </div>
              ))}
              <button style={C.botonSec} onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "" }])}>
                + Agregar producto
              </button>

              <label style={C.etiqueta}>Notas</label>
              <input style={C.input} value={nueva.notas}
                onChange={e => setNueva({ ...nueva, notas: e.target.value })} />

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={{ ...C.boton, flex: 1 }} onClick={guardarRecomendacion}>Guardar recomendación</button>
                <button style={C.botonSec} onClick={() => setCreando(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Filtro por estado */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {["pendiente", "aplicada", "modificada", "cancelada", "todas"].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                style={{
                  ...C.botonSec, padding: "6px 10px", fontSize: 12,
                  background: filtroEstado === e ? "rgba(127,191,90,0.15)" : "transparent",
                }}>
                {e === "todas" ? "Todas" : CHIP[e].texto}
              </button>
            ))}
          </div>

          {aplicacionesVisibles.map(f => {
            const det = aplicacionDet.filter(d => d.fertilizacion_id === f.id);
            const chip = CHIP[f.estado];
            const abierta = confirmando === f.id;
            const costoTotal = det.reduce((s, d) =>
              s + Number(d.cantidad_aplicada ?? 0) * Number(d.costo_unitario ?? 0), 0);
            return (
              <div key={f.id} style={C.tarjeta}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>
                    {nombreRancho(f.rancho_id)} · Sector {f.sector} ·{" "}
                    {VIAS.find(v => v.valor === f.tipo_aplicacion)?.texto}
                  </div>
                  <div style={{ color: chip.color, fontWeight: 800, fontSize: 13 }}>{chip.texto}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.65, margin: "4px 0" }}>
                  Recomendada: {f.fecha_recomendada}
                  {f.fecha_aplicada && ` · Aplicada: ${new Date(f.fecha_aplicada).toLocaleDateString("es-MX")}`}
                </div>
                {f.motivo_modificacion && (
                  <div style={{ fontSize: 13, color: "#6bb8e0", marginBottom: 4 }}>
                    Motivo: {MOTIVOS.find(m => m.valor === f.motivo_modificacion)?.texto}
                    {f.motivo_otro_texto ? ` — ${f.motivo_otro_texto}` : ""}
                  </div>
                )}

                {det.map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
                    <span>{nombreProducto(d.producto_id)}</span>
                    {abierta ? (
                      <input style={{ ...C.input, width: 90, padding: 6 }} type="number" min="0" step="0.001"
                        value={aplicadas[d.id] ?? ""}
                        onChange={e => setAplicadas({ ...aplicadas, [d.id]: e.target.value })} />
                    ) : (
                      <b>
                        {f.estado === "pendiente"
                          ? `${Number(d.cantidad_recomendada)} ${unidadProducto(d.producto_id)}`
                          : `${Number(d.cantidad_aplicada ?? d.cantidad_recomendada)} ${unidadProducto(d.producto_id)}`}
                        {(f.estado === "modificada" && Number(d.cantidad_aplicada) !== Number(d.cantidad_recomendada)) &&
                          <span style={{ color: "#6bb8e0" }}> (rec. {Number(d.cantidad_recomendada)})</span>}
                      </b>
                    )}
                  </div>
                ))}

                {(f.estado === "aplicada" || f.estado === "modificada") && costoTotal > 0 && (
                  <div style={{ textAlign: "right", fontWeight: 800, color: C.verde, marginTop: 4 }}>
                    Costo: ${costoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                )}

                {abierta && (
                  <>
                    {hayCambios(f) && (
                      <>
                        <label style={C.etiqueta}>Motivo de la modificación</label>
                        <select style={C.input} value={motivo} onChange={e => setMotivo(e.target.value)}>
                          <option value="">— Selecciona —</option>
                          {MOTIVOS.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
                        </select>
                        {motivo === "otro" && (
                          <input style={{ ...C.input, marginTop: 6 }} placeholder="Describe el motivo"
                            value={motivoTexto} onChange={e => setMotivoTexto(e.target.value)} />
                        )}
                      </>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button style={{ ...C.boton, flex: 1 }} onClick={() => confirmarAplicacion(f)}>
                        ✅ Confirmar aplicación
                      </button>
                      <button style={C.botonSec} onClick={() => setConfirmando(null)}>Cerrar</button>
                    </div>
                  </>
                )}

                {f.estado === "pendiente" && !abierta && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button style={{ ...C.boton, flex: 1 }} onClick={() => abrirConfirmacion(f)}>
                      Registrar aplicación
                    </button>
                    {puedeRecomendar && (
                      <button style={{ ...C.botonSec, color: "#e07b7b", borderColor: "#e07b7b" }}
                        onClick={() => cancelarRecomendacion(f)}>Cancelar</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {aplicacionesVisibles.length === 0 && (
            <div style={{ ...C.tarjeta, opacity: 0.7 }}>No hay aplicaciones con este filtro.</div>
          )}
        </div>
      )}

      {/* ============ RECETAS ============ */}
      {pestana === "recetas" && (
        <div>
          {puedeRecomendar && !creandoReceta && (
            <button style={{ ...C.boton, width: "100%", marginBottom: 12 }} onClick={() => setCreandoReceta(true)}>
              + Nueva receta
            </button>
          )}

          {creandoReceta && (
            <div style={C.tarjeta}>
              <div style={{ fontWeight: 800, color: C.verde }}>Nueva receta</div>

              <label style={C.etiqueta}>Nombre</label>
              <input style={C.input} value={nuevaReceta.nombre}
                onChange={e => setNuevaReceta({ ...nuevaReceta, nombre: e.target.value })} />

              <label style={C.etiqueta}>Cultivo</label>
              <input style={C.input} placeholder="ej. Frambuesa" value={nuevaReceta.cultivo}
                onChange={e => setNuevaReceta({ ...nuevaReceta, cultivo: e.target.value })} />

              <label style={C.etiqueta}>Etapa fenológica</label>
              <input style={C.input} placeholder="ej. Fructificación" value={nuevaReceta.etapa}
                onChange={e => setNuevaReceta({ ...nuevaReceta, etapa: e.target.value })} />

              <label style={C.etiqueta}>Vía de aplicación</label>
              <select style={C.input} value={nuevaReceta.via}
                onChange={e => { setNuevaReceta({ ...nuevaReceta, via: e.target.value }); setLineasReceta([{ producto_id: "", cantidad: "" }]); }}>
                {VIAS.map(v => <option key={v.valor} value={v.valor}>{v.texto}</option>)}
              </select>

              <label style={C.etiqueta}>Productos y dosis por sector</label>
              {lineasReceta.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select style={{ ...C.input, flex: 2 }} value={l.producto_id}
                    onChange={e => cambiarLinea(setLineasReceta, lineasReceta, i, "producto_id", e.target.value)}>
                    <option value="">— Producto —</option>
                    {productos.filter(p => compatible(p, nuevaReceta.via))
                      .map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                  </select>
                  <input style={{ ...C.input, flex: 1 }} type="number" min="0" step="0.001"
                    placeholder="Dosis" value={l.cantidad}
                    onChange={e => cambiarLinea(setLineasReceta, lineasReceta, i, "cantidad", e.target.value)} />
                </div>
              ))}
              <button style={C.botonSec} onClick={() => setLineasReceta([...lineasReceta, { producto_id: "", cantidad: "" }])}>
                + Agregar producto
              </button>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={{ ...C.boton, flex: 1 }} onClick={guardarReceta}>Guardar receta</button>
                <button style={C.botonSec} onClick={() => setCreandoReceta(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {recetas.map(r => {
            const det = recetaDet.filter(d => d.receta_id === r.id);
            const costo = det.reduce((s, d) => {
              const p = productos.find(x => x.id === d.producto_id);
              return s + Number(d.cantidad_por_sector) * Number(p?.costo_unitario || 0);
            }, 0);
            return (
              <div key={r.id} style={{ ...C.tarjeta, opacity: r.activo ? 1 : 0.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>{r.nombre}</div>
                  <div style={{ fontSize: 13, color: C.verde }}>
                    {VIAS.find(v => v.valor === r.tipo_aplicacion)?.texto}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>
                  {r.cultivo}{r.etapa_fenologica ? ` · ${r.etapa_fenologica}` : ""}
                </div>
                {det.map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
                    <span>{nombreProducto(d.producto_id)}</span>
                    <b>{Number(d.cantidad_por_sector)} {unidadProducto(d.producto_id)}/sector</b>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 13, color: C.verde, fontWeight: 800 }}>
                    Costo estimado/sector: ${costo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                  {puedeRecomendar && (
                    <button style={{ ...C.botonSec, padding: "4px 10px", fontSize: 12 }}
                      onClick={() => alternarReceta(r)}>
                      {r.activo ? "Desactivar" : "Reactivar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ MEDICIONES CE / pH ============ */}
      {pestana === "mediciones" && (
        <div>
          <div style={C.tarjeta}>
            <div style={{ fontWeight: 800, color: C.verde }}>Registrar medición</div>

            {!esEncargado && (
              <>
                <label style={C.etiqueta}>Rancho</label>
                <select style={C.input} value={med.rancho_id}
                  onChange={e => setMed({ ...med, rancho_id: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </>
            )}

            <label style={C.etiqueta}>Sector</label>
            <input style={C.input} placeholder="ej. 5" value={med.sector}
              onChange={e => setMed({ ...med, sector: e.target.value })} />

            <label style={C.etiqueta}>Tipo de muestra</label>
            <select style={C.input} value={med.tipo} onChange={e => setMed({ ...med, tipo: e.target.value })}>
              {MUESTRAS.map(m => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={C.etiqueta}>CE (dS/m)</label>
                <input style={C.input} type="number" min="0" max="20" step="0.01" value={med.ce}
                  onChange={e => setMed({ ...med, ce: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={C.etiqueta}>pH</label>
                <input style={C.input} type="number" min="0" max="14" step="0.01" value={med.ph}
                  onChange={e => setMed({ ...med, ph: e.target.value })} />
              </div>
            </div>

            <label style={C.etiqueta}>Notas</label>
            <input style={C.input} value={med.notas} onChange={e => setMed({ ...med, notas: e.target.value })} />

            <button style={{ ...C.boton, marginTop: 14, width: "100%" }} onClick={guardarMedicion}>
              Guardar medición
            </button>
          </div>

          <div style={C.tarjeta}>
            <div style={{ fontWeight: 800, color: C.verde, marginBottom: 8 }}>Últimas mediciones</div>
            {mediciones
              .filter(m => !esEncargado || m.rancho_id === usuario.rancho_id)
              .map(m => (
                <div key={m.id} style={{ padding: "6px 0", borderBottom: C.bordeSuave, fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{nombreRancho(m.rancho_id)} · S{m.sector} · {MUESTRAS.find(x => x.valor === m.tipo_muestra)?.texto}</span>
                    <span style={{ fontSize: 12, opacity: 0.65 }}>
                      {new Date(m.fecha).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800 }}>
                    {m.ce != null && <span style={{ marginRight: 14 }}>CE: {Number(m.ce)} dS/m</span>}
                    {m.ph != null && <span>pH: {Number(m.ph)}</span>}
                  </div>
                </div>
              ))}
            {mediciones.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>Sin mediciones registradas.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

