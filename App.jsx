import { useState } from "react";
import Asistencia from "./src/Asistencia";
import Labores from "./src/Labores";

const MODULOS = [
  { key: "asistencia", label: "Asistencia", icono: "👷" },
  { key: "labores",    label: "Labores",    icono: "🌾" },
];

export default function App() {
  const [modulo, setModulo] = useState("asistencia");

  return (
    <div>
      {/* Barra de navegación */}
      <div style={{
        display: "flex", gap: "8px", padding: "12px 16px",
        background: "#0f2818", borderBottom: "1px solid rgba(127,191,90,0.2)",
        position: "sticky", top: 0, zIndex: 200
      }}>
        {MODULOS.map(m => (
          <button
            key={m.key}
            onClick={() => setModulo(m.key)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: "10px",
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
      {modulo === "asistencia" && <Asistencia />}
      {modulo === "labores"    && <Labores />}
    </div>
  );
}