import { useState, useEffect } from "react";

const modules = [
  { icon: "💧", label: "Fertirrigación" },
  { icon: "🍃", label: "Foliares" },
  { icon: "🔍", label: "Plagas" },
  { icon: "🧺", label: "Cosecha" },
  { icon: "📦", label: "Inventario" },
  { icon: "💰", label: "Gastos" },
  { icon: "📅", label: "Calendario" },
  { icon: "🌾", label: "Labores" },
  { icon: "👷", label: "Asistencia" },
  { icon: "📊", label: "Reportes" },
];

const roles = ["Administrador", "Encargado", "Empleado de campo", "Agrónomo"];

export default function App() {
  const [visible, setVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Administrador");
  const [moduleIndex, setModuleIndex] = useState(0);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    const interval = setInterval(() => {
      setModuleIndex((i) => (i + 1) % modules.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f2818 0%, #1a3d25 50%, #0f2818 100%)",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e8f5e0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      boxSizing: "border-box",
    }}>

      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-16px)",
        transition: "all 0.6s ease",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(134,197,98,0.3)",
        borderRadius: "999px",
        padding: "6px 18px",
        fontSize: "12px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#a8d878",
        marginBottom: "32px",
      }}>
        Sayula, Jalisco — Sistema de Gestión Agrícola
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.7s ease 0.15s",
        textAlign: "center",
        marginBottom: "12px",
      }}>
        <div style={{ fontSize: "52px", marginBottom: "8px" }}>🌱</div>
        <h1 style={{
          fontSize: "clamp(28px, 6vw, 48px)",
          fontWeight: "800",
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: "#ffffff",
        }}>
          Rancho El Milagro
        </h1>
        <p style={{
          margin: "10px 0 0",
          fontSize: "15px",
          color: "#7fbf5a",
          letterSpacing: "0.05em",
        }}>
          Frambuesa Malu · Temporada 2026
        </p>
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease 0.35s",
        fontSize: "13px",
        color: "rgba(200,230,180,0.55)",
        marginBottom: "40px",
        textTransform: "capitalize",
      }}>
        {today}
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease 0.45s",
        background: "rgba(100,180,60,0.12)",
        border: "1px solid rgba(100,180,60,0.25)",
        borderRadius: "16px",
        padding: "20px 36px",
        textAlign: "center",
        marginBottom: "36px",
        minWidth: "200px",
      }}>
        <div style={{ fontSize: "11px", color: "#7fbf5a", letterSpacing: "0.1em", marginBottom: "10px" }}>
          MÓDULOS DEL SISTEMA
        </div>
        <div style={{ fontSize: "32px", marginBottom: "6px" }}>
          {modules[moduleIndex].icon}
        </div>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "#d4efb8" }}>
          {modules[moduleIndex].label}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "5px", marginTop: "12px" }}>
          {modules.map((_, i) => (
            <div key={i} style={{
              width: i === moduleIndex ? "18px" : "5px",
              height: "5px",
              borderRadius: "999px",
              background: i === moduleIndex ? "#7fbf5a" : "rgba(127,191,90,0.25)",
              transition: "all 0.4s ease",
            }} />
          ))}
        </div>
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease 0.55s",
        marginBottom: "40px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "11px", color: "#7fbf5a", letterSpacing: "0.1em", marginBottom: "12px" }}>
          ACCEDER COMO
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {roles.map((rol) => (
            <button key={rol} onClick={() => setSelectedRole(rol)} style={{
              padding: "8px 18px",
              borderRadius: "999px",
              border: selectedRole === rol ? "1.5px solid #7fbf5a" : "1.5px solid rgba(127,191,90,0.2)",
              background: selectedRole === rol ? "rgba(127,191,90,0.18)" : "transparent",
              color: selectedRole === rol ? "#c8e89a" : "rgba(200,230,180,0.45)",
              fontSize: "13px",
              fontWeight: selectedRole === rol ? "600" : "400",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}>
              {rol}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "all 0.7s ease 0.65s",
      }}>
        <button style={{
          background: "linear-gradient(135deg, #5aab2e, #3d8c1a)",
          color: "#ffffff",
          border: "none",
          borderRadius: "14px",
          padding: "16px 48px",
          fontSize: "16px",
          fontWeight: "700",
          cursor: "pointer",
          letterSpacing: "0.03em",
          boxShadow: "0 4px 24px rgba(90,171,46,0.35)",
        }}>
          Entrar al sistema →
        </button>
        <p style={{
          textAlign: "center",
          marginTop: "12px",
          fontSize: "12px",
          color: "rgba(200,230,180,0.35)",
        }}>
          Ingresando como <strong style={{ color: "rgba(200,230,180,0.6)" }}>{selectedRole}</strong>
        </p>
      </div>

      <div style={{
        position: "fixed",
        bottom: "16px",
        fontSize: "11px",
        color: "rgba(200,230,180,0.2)",
        letterSpacing: "0.08em",
      }}>
        PHYTOMONITOR · v1.0.0
      </div>
    </div>
  );
}
