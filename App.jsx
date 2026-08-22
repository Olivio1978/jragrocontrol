// ============ JR AGROCONTROL — App.jsx v0.3.10 ============
// v0.3.10: se agrega el módulo "Listas Autorizadas" (Módulo 7): carga de
// listas de productos fitosanitarios permitidos (ANEBERRIES global o
// comercializadora propia de la empresa), exclusivo para admin/superadmin.
import { useState } from "react";
import Asistencia from "./src/Asistencia";
import Labores from "./src/Labores";
import Empleados from "./src/Empleados";
import Configuracion from "./src/Configuracion";
import Almacen from "./src/Almacen";
import Fertilizaciones from "./src/Fertilizaciones";
import ListasAutorizadas from "./src/ListasAutorizadas";

const MODULOS = [
  { key: "asistencia",      label: "Asistencia",      icono: "👷" },
  { key: "labores",         label: "Labores",         icono: "🌾" },
  { key: "empleados",       label: "Empleados",       icono: "🗂️" },
  { key: "config",          label: "Config",          icono: "⚙️" },
  { key: "almacen",         label: "Almacén",         icono: "📦" },
  { key: "fertilizaciones", label: "Fertilización",   icono: "💧" },
  { key: "listas",          label: "Listas Autorizadas", icono: "📋" },
];

export default function App() {
  const [modulo, setModulo] = useState("asistencia");

  return (
    <div>
      {/* Barra de navegación */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "8px", padding: "12px 16px",
        background: "#0f2818", borderBottom: "1px solid rgba(127,191,90,0.2)",
        position: "sticky", top: 0, zIndex: 200
      }}>
        {MODULOS.map(m => (
          <button
            key={m.key}
            onClick={() => setModulo(m.key)}
            style={{
              flex: "1 1 100px", padding: "10px 8px", borderRadius: "10px",
              border: modulo === m.key
                ? "1.5px solid #7fbf5a"
                : "1.5px solid rgba(127,191,90,0.2)",
              background: modulo === m.key
                ? "rgba(127,191,90,0.15)"
                : "rgba(255,255,255,0.03)",
              color: modulo === m.key ? "#7fbf5a" : "rgba(200,230,180,0.5)",
              fontSize: "13px", fontWeight: "700", cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            {m.icono} {m.label}
          </button>
        ))}
      </div>

      {/* Módulo activo */}
      {modulo === "asistencia"      && <Asistencia />}
      {modulo === "labores"         && <Labores />}
      {modulo === "empleados"       && <Empleados />}
      {modulo === "config"          && <Configuracion />}
      {modulo === "almacen"         && <Almacen onNavigate={setModulo} />}
      {modulo === "fertilizaciones" && <Fertilizaciones />}
      {modulo === "listas"          && <ListasAutorizadas />}
    </div>
  );
}

