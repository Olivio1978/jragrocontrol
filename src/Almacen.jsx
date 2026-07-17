// ============ JR AGROCONTROL — Almacen.jsx v0.3.8 ============
// Módulo Almacén: existencias, compras/donaciones/ajustes y traspasos
// entre bodegas con confirmación de recepción.
// NOTA: verifica que la ruta del import de supabase coincida con la
// usada en Labores.jsx (misma carpeta src/).
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

// ---------- Estilos base (mismo tema que Labores) ----------
const C = {
  fondo: "#0f2818",
  verde: "#7fbf5a",
  bordeSuave: "1px solid rgba(127,191,90,0.2)",
  tarjeta: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(127,191,90,0.2)",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "12px",
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

const TIPOS_ENTRADA = [
  { valor: "entrada_compra",   texto: "🛒 Compra" },
  { valor: "entrada_donacion", texto: "🎁 Donación / muestra" },
  { valor: "ajuste_entrada",   texto: "➕ Ajuste de entrada (sobrante)" },
  { valor: "ajuste_salida",    texto: "➖ Ajuste de salida (merma)" },
];

export default function Almacen() {
  const [usuario, setUsuario] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [traspasos, setTraspasos] = useState([]);
  const [detalles, setDetalles] = useState([]);      // traspaso_detalle de todos
  const [pestana, setPestana] = useState("existencias");
  const [mensaje, setMensaje] = useState(null);       // {tipo:'ok'|'error', texto}
  const [cargando, setCargando] = useState(true);

  // ---- Formulario de movimiento ----
  const [mov, setMov] = useState({ tipo: "entrada_compra", bodega_id: "", producto_id: "", cantidad: "", costo: "", notas: "" });

  // ---- Formulario de traspaso ----
  const [tras, setTras] = useState({ origen: "", destino: "", notas: "" });
  const [lineas, setLineas] = useState([{ producto_id: "", cantidad: "" }]);

  // ---- Confirmación de recepción ----
  const [confirmando, setConfirmando] = useState(null);   // id del traspaso abierto
  const [recibidas, setRecibidas] = useState({});          // {detalle_id: cantidad}

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: u } = await supabase.from("usuarios")
      .select("id, nombre_completo, rol, rancho_id").eq("id", auth.user.id).single();
    setUsuario(u);

    const { data: b } = await supabase.from("bodegas")
      .select("id, nombre, rancho_id, empresa_id").eq("activo", true).order("nombre");
    setBodegas(b || []);
    if (b?.length) setEmpresaId(b[0].empresa_id);

    const { data: p } = await supabase.from("productos_insumos")
      .select("id, nombre_comercial, unidad_base, costo_unitario, categoria")
      .eq("activo", true).order("nombre_comercial");
    setProductos(p || []);

    const { data: ex } = await supabase.from("inventario_existencias").select("*");
    setExistencias(ex || []);

    const { data: t } = await supabase.from("traspasos")
      .select("*").order("fecha_envio", { ascending: false }).limit(50);
    setTraspasos(t || []);

    const { data: d } = await supabase.from("traspaso_detalle").select("*");
    setDetalles(d || []);
    setCargando(false);
  }

  function avisar(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 6000);
  }

  const esAdmin = usuario?.rol === "admin";
  const esEncargado = usuario?.rol === "encargado";
  const soloLectura = usuario?.rol === "agronomo_externo";
  // Bodega del rancho del encargado (para filtrar su vista)
  const bodegaEncargado = esEncargado
    ? bodegas.find(b => b.rancho_id === usuario?.rancho_id) : null;

  const nombreProducto = id => productos.find(p => p.id === id)?.nombre_comercial || "?";
  const unidadProducto = id => productos.find(p => p.id === id)?.unidad_base || "";
  const nombreBodega = id => bodegas.find(b => b.id === id)?.nombre || "?";

  // ================= MOVIMIENTOS =================
  async function guardarMovimiento() {
    if (!mov.bodega_id || !mov.producto_id || !mov.cantidad) {
      return avisar("error", "Completa bodega, producto y cantidad.");
    }
    const registro = {
      empresa_id: empresaId,
      bodega_id: mov.bodega_id,
      producto_id: mov.producto_id,
      tipo_movimiento: mov.tipo,
      cantidad: Number(mov.cantidad),
      costo_unitario: mov.tipo === "entrada_compra" ? Number(mov.costo || 0) : 0,
      notas: mov.notas || null,
      creado_por: usuario.id,
    };
    const { error } = await supabase.from("inventario_movimientos").insert(registro);
    if (error) return avisar("error", error.message);
    avisar("ok", "Movimiento registrado.");
    setMov({ tipo: "entrada_compra", bodega_id: "", producto_id: "", cantidad: "", costo: "", notas: "" });
    cargar();
  }

  // ================= TRASPASOS =================
  function cambiarLinea(i, campo, valor) {
    const nuevas = [...lineas];
    nuevas[i] = { ...nuevas[i], [campo]: valor };
    setLineas(nuevas);
  }

  async function crearTraspaso() {
    if (!tras.origen || !tras.destino) return avisar("error", "Selecciona bodega origen y destino.");
    if (tras.origen === tras.destino) return avisar("error", "Origen y destino no pueden ser la misma bodega.");
    const validas = lineas.filter(l => l.producto_id && Number(l.cantidad) > 0);
    if (!validas.length) return avisar("error", "Agrega al menos un producto con cantidad.");

    const { data: cab, error: e1 } = await supabase.from("traspasos").insert({
      empresa_id: empresaId,
      bodega_origen_id: tras.origen,
      bodega_destino_id: tras.destino,
      notas: tras.notas || null,
      enviado_por: usuario.id,
    }).select("id").single();
    if (e1) return avisar("error", e1.message);

    // El trigger genera la salida de origen por cada línea; si el stock no
    // alcanza, la línea falla y se informa cuál.
    for (const l of validas) {
      const { error: e2 } = await supabase.from("traspaso_detalle").insert({
        traspaso_id: cab.id,
        producto_id: l.producto_id,
        cantidad_enviada: Number(l.cantidad),
      });
      if (e2) return avisar("error", `${nombreProducto(l.producto_id)}: ${e2.message}`);
    }
    avisar("ok", "Traspaso enviado. Queda en tránsito hasta que el rancho confirme recepción.");
    setTras({ origen: "", destino: "", notas: "" });
    setLineas([{ producto_id: "", cantidad: "" }]);
    cargar();
  }

  function abrirConfirmacion(t) {
    const suyo = detalles.filter(d => d.traspaso_id === t.id);
    const base = {};
    suyo.forEach(d => { base[d.id] = d.cantidad_enviada; });
    setRecibidas(base);
    setConfirmando(t.id);
  }

  async function confirmarRecepcion(t) {
    // Actualiza cantidades recibidas que difieran de lo enviado
    for (const d of detalles.filter(x => x.traspaso_id === t.id)) {
      const cant = Number(recibidas[d.id]);
      if (cant !== Number(d.cantidad_enviada)) {
        const { error } = await supabase.from("traspaso_detalle")
          .update({ cantidad_recibida: cant }).eq("id", d.id);
        if (error) return avisar("error", error.message);
      }
    }
    const { error } = await supabase.from("traspasos")
      .update({ estado: "recibido", recibido_por: usuario.id }).eq("id", t.id);
    if (error) return avisar("error", error.message);
    avisar("ok", "Recepción confirmada. El stock entró a la bodega.");
    setConfirmando(null);
    cargar();
  }

  async function cancelarTraspaso(t) {
    if (!window.confirm("¿Cancelar este traspaso? El producto regresará a la bodega origen.")) return;
    const { error } = await supabase.from("traspasos")
      .update({ estado: "cancelado" }).eq("id", t.id);
    if (error) return avisar("error", error.message);
    avisar("ok", "Traspaso cancelado y producto devuelto al origen.");
    cargar();
  }

  // ¿Este usuario puede confirmar la recepción de este traspaso?
  function puedeConfirmar(t) {
    if (esAdmin) return true;
    if (esEncargado && bodegaEncargado && t.bodega_destino_id === bodegaEncargado.id) return true;
    return false;
  }

  // ================= VISTAS =================
  if (cargando) return <div style={{ padding: 24, color: "#7fbf5a" }}>Cargando almacén…</div>;

  const existenciasVisibles = esEncargado && bodegaEncargado
    ? existencias.filter(e => e.bodega_id === bodegaEncargado.id)
    : existencias;

  const traspasosVisibles = esEncargado && bodegaEncargado
    ? traspasos.filter(t => t.bodega_destino_id === bodegaEncargado.id || t.bodega_origen_id === bodegaEncargado.id)
    : traspasos;

  const PESTANAS = [
    { key: "existencias", texto: "📊 Existencias" },
    ...(!soloLectura ? [{ key: "movimiento", texto: "🛒 Entradas y ajustes" }] : []),
    { key: "traspasos", texto: "🚚 Traspasos" },
  ];

  return (
    <div style={{ padding: "14px", maxWidth: "760px", margin: "0 auto", color: "#e8f5e0" }}>
      <h2 style={{ color: C.verde, margin: "4px 0 12px" }}>📦 Almacén</h2>

      {mensaje && (
        <div style={{
          ...C.tarjeta, borderColor: mensaje.tipo === "ok" ? C.verde : "#e07b7b",
          color: mensaje.tipo === "ok" ? C.verde : "#e07b7b", fontWeight: 700,
        }}>{mensaje.texto}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {PESTANAS.map(p => (
          <button key={p.key} onClick={() => setPestana(p.key)}
            style={{ ...C.botonSec, background: pestana === p.key ? "rgba(127,191,90,0.15)" : "transparent" }}>
            {p.texto}
          </button>
        ))}
      </div>

      {/* ============ EXISTENCIAS ============ */}
      {pestana === "existencias" && (
        <div>
          {bodegas
            .filter(b => !esEncargado || b.id === bodegaEncargado?.id)
            .map(b => {
              const filas = existenciasVisibles.filter(e => e.bodega_id === b.id && Number(e.existencia) !== 0);
              return (
                <div key={b.id} style={C.tarjeta}>
                  <div style={{ fontWeight: 800, color: C.verde, marginBottom: 8 }}>{b.nombre}</div>
                  {filas.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>Sin existencias registradas.</div>}
                  {filas.map(e => (
                    <div key={e.producto_id} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "6px 0", borderBottom: C.bordeSuave, fontSize: 14,
                    }}>
                      <span>{e.producto}</span>
                      <span style={{ fontWeight: 800 }}>
                        {Number(e.existencia).toLocaleString("es-MX")} {e.unidad_base}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      )}

      {/* ============ ENTRADAS Y AJUSTES ============ */}
      {pestana === "movimiento" && !soloLectura && (
        <div style={C.tarjeta}>
          <div style={{ fontWeight: 800, color: C.verde }}>Registrar movimiento</div>

          <label style={C.etiqueta}>Tipo de movimiento</label>
          <select style={C.input} value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value })}>
            {TIPOS_ENTRADA.map(t => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>

          <label style={C.etiqueta}>Bodega</label>
          <select style={C.input} value={mov.bodega_id} onChange={e => setMov({ ...mov, bodega_id: e.target.value })}>
            <option value="">— Selecciona —</option>
            {bodegas.filter(b => !esEncargado || b.id === bodegaEncargado?.id)
              .map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>

          <label style={C.etiqueta}>Producto</label>
          <select style={C.input} value={mov.producto_id} onChange={e => setMov({ ...mov, producto_id: e.target.value })}>
            <option value="">— Selecciona —</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
          </select>

          <label style={C.etiqueta}>Cantidad ({unidadProducto(mov.producto_id) || "kg / L"})</label>
          <input style={C.input} type="number" min="0" step="0.001" value={mov.cantidad}
            onChange={e => setMov({ ...mov, cantidad: e.target.value })} />

          {mov.tipo === "entrada_compra" && (
            <>
              <label style={C.etiqueta}>Costo por {unidadProducto(mov.producto_id) || "unidad"} ($)</label>
              <input style={C.input} type="number" min="0" step="0.01" value={mov.costo}
                onChange={e => setMov({ ...mov, costo: e.target.value })} />
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                Este costo actualizará el precio de referencia del producto.
              </div>
            </>
          )}

          <label style={C.etiqueta}>Notas</label>
          <input style={C.input} value={mov.notas} onChange={e => setMov({ ...mov, notas: e.target.value })} />

          <button style={{ ...C.boton, marginTop: 14, width: "100%" }} onClick={guardarMovimiento}>
            Guardar movimiento
          </button>
        </div>
      )}

      {/* ============ TRASPASOS ============ */}
      {pestana === "traspasos" && (
        <div>
          {/* Crear traspaso: admin (los encargados reciben, no envían) */}
          {esAdmin && (
            <div style={C.tarjeta}>
              <div style={{ fontWeight: 800, color: C.verde }}>Nuevo traspaso</div>

              <label style={C.etiqueta}>Bodega origen</label>
              <select style={C.input} value={tras.origen} onChange={e => setTras({ ...tras, origen: e.target.value })}>
                <option value="">— Selecciona —</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>

              <label style={C.etiqueta}>Bodega destino</label>
              <select style={C.input} value={tras.destino} onChange={e => setTras({ ...tras, destino: e.target.value })}>
                <option value="">— Selecciona —</option>
                {bodegas.filter(b => b.id !== tras.origen)
                  .map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>

              <label style={C.etiqueta}>Productos</label>
              {lineas.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select style={{ ...C.input, flex: 2 }} value={l.producto_id}
                    onChange={e => cambiarLinea(i, "producto_id", e.target.value)}>
                    <option value="">— Producto —</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                  </select>
                  <input style={{ ...C.input, flex: 1 }} type="number" min="0" step="0.001"
                    placeholder="Cant." value={l.cantidad}
                    onChange={e => cambiarLinea(i, "cantidad", e.target.value)} />
                </div>
              ))}
              <button style={C.botonSec} onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "" }])}>
                + Agregar producto
              </button>

              <label style={C.etiqueta}>Notas</label>
              <input style={C.input} value={tras.notas} onChange={e => setTras({ ...tras, notas: e.target.value })} />

              <button style={{ ...C.boton, marginTop: 14, width: "100%" }} onClick={crearTraspaso}>
                Enviar traspaso
              </button>
            </div>
          )}

          {/* Lista de traspasos */}
          {traspasosVisibles.map(t => {
            const suyo = detalles.filter(d => d.traspaso_id === t.id);
            const colorEstado = t.estado === "en_transito" ? "#e0c56b"
              : t.estado === "recibido" ? C.verde : "#e07b7b";
            return (
              <div key={t.id} style={C.tarjeta}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>
                    {nombreBodega(t.bodega_origen_id)} → {nombreBodega(t.bodega_destino_id)}
                  </div>
                  <div style={{ color: colorEstado, fontWeight: 800, fontSize: 13 }}>
                    {t.estado === "en_transito" ? "🚚 En tránsito"
                      : t.estado === "recibido" ? "✅ Recibido" : "✖ Cancelado"}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.65, margin: "4px 0" }}>
                  Enviado: {new Date(t.fecha_envio).toLocaleDateString("es-MX")}
                  {t.fecha_recepcion && ` · Recibido: ${new Date(t.fecha_recepcion).toLocaleDateString("es-MX")}`}
                </div>

                {suyo.map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
                    <span>{nombreProducto(d.producto_id)}</span>
                    <span>
                      {confirmando === t.id ? (
                        <input style={{ ...C.input, width: 90, padding: 6 }} type="number" min="0" step="0.001"
                          value={recibidas[d.id] ?? ""}
                          onChange={e => setRecibidas({ ...recibidas, [d.id]: e.target.value })} />
                      ) : (
                        <b>
                          {Number(d.cantidad_recibida ?? d.cantidad_enviada).toLocaleString("es-MX")} {unidadProducto(d.producto_id)}
                          {d.cantidad_recibida != null && Number(d.cantidad_recibida) !== Number(d.cantidad_enviada) &&
                            <span style={{ color: "#e0c56b" }}> (enviado {d.cantidad_enviada})</span>}
                        </b>
                      )}
                    </span>
                  </div>
                ))}

                {t.estado === "en_transito" && puedeConfirmar(t) && (
                  confirmando === t.id ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button style={{ ...C.boton, flex: 1 }} onClick={() => confirmarRecepcion(t)}>
                        ✅ Confirmar recepción
                      </button>
                      <button style={C.botonSec} onClick={() => setConfirmando(null)}>Cerrar</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button style={{ ...C.boton, flex: 1 }} onClick={() => abrirConfirmacion(t)}>
                        Recibir traspaso
                      </button>
                      {esAdmin && (
                        <button style={{ ...C.botonSec, color: "#e07b7b", borderColor: "#e07b7b" }}
                          onClick={() => cancelarTraspaso(t)}>Cancelar</button>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
          {traspasosVisibles.length === 0 && (
            <div style={{ ...C.tarjeta, opacity: 0.7 }}>Aún no hay traspasos registrados.</div>
          )}
        </div>
      )}
    </div>
  );
}

