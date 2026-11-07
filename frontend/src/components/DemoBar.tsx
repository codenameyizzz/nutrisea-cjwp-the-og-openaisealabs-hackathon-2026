"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Clock,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Store,
  Wallet,
  Camera,
  Utensils,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function DemoBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { logSnack, clearSnack, setIsSeaBankOpen, setMerchantDemoTrigger } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  const runScenario1 = () => {
    clearSnack();
    router.push("/");
  };

  const runScenario2 = () => {
    router.push("/scanner");
  };

  const runScenario3 = () => {
    logSnack();
    router.push("/");
  };

  const runScenario4 = () => {
    setIsSeaBankOpen(true);
  };

  const runScenario5 = () => {
    router.push("/merchant");
  };

  const runScenario6 = () => {
    setMerchantDemoTrigger(true);
    router.push("/merchant");
  };

  const runScenarioAdmin = () => {
    router.push("/admin");
  };

  const runScenarioNutriGraph = () => {
    router.push("/menu/DISH-FS-001");
  };

  return (
    <div
      className="demo-bar-floating-wrap"
      style={{
        zIndex: 900,
        fontFamily: "inherit"
      }}
    >
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          aria-expanded={false}
          style={{
            backgroundColor: "#111827",
            color: "#FFFFFF",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "20px",
            padding: "8px 14px",
            fontSize: "11.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            backdropFilter: "blur(6px)"
          }}
        >
          <Sparkles size={13} color="#FFA439" />
          <span>Demo guide</span>
          <ChevronUp size={13} />
        </button>
      ) : (
        <div
          className="demo-bar-menu-card"
          style={{
            backgroundColor: "#111827",
            color: "#FFFFFF",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "12px 14px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 6 }}>
            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#FFA439", display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={13} />
              <span>Judging demo scenarios</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              aria-label="Close demo guide"
              aria-expanded={true}
              style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 2 }}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <button
              onClick={runScenario1}
              style={{
                textAlign: "left",
                backgroundColor: pathname === "/" ? "#1F2937" : "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#E5E7EB",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Utensils size={12} color="#EE4D2D" />
              <span><strong>11:30 WIB:</strong> Lunch choices</span>
            </button>

            <button
              onClick={runScenario2}
              style={{
                textAlign: "left",
                backgroundColor: pathname === "/scanner" ? "#1F2937" : "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#E5E7EB",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Camera size={12} color="#00B14F" />
              <span><strong>16:00 WIB:</strong> Bakwan photo analysis</span>
            </button>

            <button
              onClick={runScenario3}
              style={{
                textAlign: "left",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#E5E7EB",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <CheckCircle2 size={12} color="#00B14F" />
              <span><strong>18:30 WIB:</strong> Dinner adjustment example</span>
            </button>

            <button
              onClick={runScenario4}
              style={{
                textAlign: "left",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#93C5FD",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Wallet size={12} color="#60A5FA" />
              <span><strong>FinTech:</strong> SeaBank rewards simulation</span>
            </button>

            <button
              onClick={runScenario5}
              style={{
                textAlign: "left",
                backgroundColor: pathname === "/merchant" ? "#1F2937" : "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#FDE68A",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Store size={12} color="#FBBF24" />
              <span><strong>2-Sided:</strong> Warteg Berkah merchant portal</span>
            </button>

            <button
              onClick={runScenario6}
              style={{
                textAlign: "left",
                backgroundColor: "rgba(255, 164, 57, 0.12)",
                border: "1px solid rgba(255, 164, 57, 0.4)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#FFA439",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Sparkles size={12} color="#FFA439" />
              <span><strong>AI Warteg:</strong> Menu nutrition estimates</span>
            </button>

            <button
              onClick={runScenarioAdmin}
              style={{
                textAlign: "left",
                backgroundColor: pathname === "/admin" ? "#1F2937" : "transparent",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#93C5FD",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <ShieldCheck size={12} color="#60A5FA" />
              <span><strong>SuperAdmin:</strong> Hygiene review & platform KPIs</span>
            </button>

            <button
              onClick={runScenarioNutriGraph}
              style={{
                textAlign: "left",
                backgroundColor: pathname?.startsWith("/menu") ? "#1F2937" : "transparent",
                border: "1px solid rgba(0, 177, 79, 0.4)",
                borderRadius: "4px",
                padding: "6px 8px",
                color: "#6EE7B7",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <ShieldCheck size={12} color="#00B14F" />
              <span><strong>NutriGraph:</strong> Graph relationship explanations</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
