"use client";

import { useAuth } from "@clerk/nextjs";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Network,
  X,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  BookOpen,
  CheckCircle2,
  Filter,
  Eye
} from "lucide-react";

export interface GraphNodeData {
  id: string;
  label: string;
  type: "PERSONA" | "CONDITION" | "INGREDIENT" | "COOKING_METHOD" | "DISH" | "ALLERGEN" | "MEMORY_ITEM" | string;
  color: string;
  data?: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdgeData {
  source: string;
  target: string;
  relation: string;
  color?: string;
  severity?: string;
  is_safe?: boolean;
}

export interface NutriGraphVisualizerProps {
  personaId: string;
  focusDishId?: string;
  focusDishName?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export default function NutriGraphVisualizer({
  personaId,
  focusDishId,
  focusDishName,
  isOpen = true,
  onClose,
  isEmbedded = false
}: NutriGraphVisualizerProps) {
  const { getToken } = useAuth();
  const [nodes, setNodes] = useState<GraphNodeData[]>([]);
  const [edges, setEdges] = useState<GraphEdgeData[]>([]);
  const [resolvedPersonaId, setResolvedPersonaId] = useState<string>(personaId);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeData | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Fetch Subgraph Data
  useEffect(() => {
    if (!personaId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const queryUrl = new URL(`http://127.0.0.1:8000/api/graph/visualize/${encodeURIComponent(personaId)}`);
    queryUrl.searchParams.set("max_dishes", "4");
    if (focusDishId) {
      queryUrl.searchParams.set("focus_dish_id", focusDishId);
    }

    getToken().then(token => {
      if (!token) throw new Error("Please sign in to view your graph.");
      return fetch(queryUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setResolvedPersonaId(data.resolved_persona_id || personaId);

        const rawNodes: GraphNodeData[] = data.nodes || [];
        const rawEdges: GraphEdgeData[] = data.edges || [];

        // Compute circular / radial initial positioning
        const personaNode = rawNodes.find((n) => n.type === "PERSONA") || rawNodes[0];
        const conditionNodes = rawNodes.filter((n) => n.type === "CONDITION" || n.type === "ALLERGEN");
        const ingredientNodes = rawNodes.filter((n) => n.type === "INGREDIENT" || n.type === "COOKING_METHOD");
        const dishNodes = rawNodes.filter((n) => n.type === "DISH");
        const otherNodes = rawNodes.filter(
          (n) => !["PERSONA", "CONDITION", "ALLERGEN", "INGREDIENT", "COOKING_METHOD", "DISH"].includes(n.type)
        );

        const cx = 450;
        const cy = 300;

        const positioned: GraphNodeData[] = rawNodes.map((n) => {
          if (personaNode && n.id === personaNode.id) {
            return { ...n, x: cx, y: cy };
          }
          return { ...n, x: cx, y: cy };
        });

        const idMap = new Map<string, GraphNodeData>();
        positioned.forEach((n) => idMap.set(n.id, n));

        // Position Ring 1: Conditions & Allergens (Radius 140)
        conditionNodes.forEach((cn, i) => {
          const angle = (i / Math.max(1, conditionNodes.length)) * 2 * Math.PI - Math.PI / 2;
          const nodeRef = idMap.get(cn.id);
          if (nodeRef) {
            nodeRef.x = cx + Math.cos(angle) * 140;
            nodeRef.y = cy + Math.sin(angle) * 130;
          }
        });

        // Position Ring 2: Ingredients & Cooking Methods (Radius 220)
        ingredientNodes.forEach((ing, i) => {
          const angle = (i / Math.max(1, ingredientNodes.length)) * 2 * Math.PI;
          const nodeRef = idMap.get(ing.id);
          if (nodeRef) {
            nodeRef.x = cx + Math.cos(angle) * 230;
            nodeRef.y = cy + Math.sin(angle) * 200;
          }
        });

        // Position Ring 3: Dishes (Radius 300, spaced towards the right/bottom)
        dishNodes.forEach((dn, i) => {
          const angle = (i / Math.max(1, dishNodes.length)) * Math.PI + Math.PI / 4;
          const nodeRef = idMap.get(dn.id);
          if (nodeRef) {
            nodeRef.x = cx + Math.cos(angle) * 310;
            nodeRef.y = cy + Math.sin(angle) * 240;
          }
        });

        // Position Others (e.g. Memory items)
        otherNodes.forEach((on, i) => {
          const angle = (i / Math.max(1, otherNodes.length)) * Math.PI - Math.PI * 0.8;
          const nodeRef = idMap.get(on.id);
          if (nodeRef) {
            nodeRef.x = cx + Math.cos(angle) * 180;
            nodeRef.y = cy + Math.sin(angle) * 160;
          }
        });

        setNodes(positioned);
        setEdges(rawEdges);

        // Auto select focus dish if available, or persona node
        if (focusDishId) {
          const fDish = positioned.find((n) => n.id.includes(focusDishId) || n.type === "DISH");
          if (fDish) setSelectedNode(fDish);
        } else if (personaNode) {
          setSelectedNode(personaNode);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError("The NutriGraph subgraph could not be loaded. Please check the backend connection.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [personaId, focusDishId]);

  // Filtered Nodes & Edges
  const filteredNodes = useMemo(() => {
    if (activeFilter === "ALL") return nodes;
    if (activeFilter === "CONDITIONS") {
      return nodes.filter((n) => ["PERSONA", "CONDITION", "ALLERGEN"].includes(n.type));
    }
    if (activeFilter === "INGREDIENTS") {
      return nodes.filter((n) => ["PERSONA", "INGREDIENT", "COOKING_METHOD", "CONDITION"].includes(n.type));
    }
    if (activeFilter === "DISHES") {
      return nodes.filter((n) => ["PERSONA", "DISH", "CONDITION"].includes(n.type));
    }
    return nodes;
  }, [nodes, activeFilter]);

  const activeNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [edges, activeNodeIds]);

  // Node position map
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNodeData>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Pan & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "svg") {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingNodeId) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const rawY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === draggingNodeId) {
            return { ...n, x: rawX, y: rawY };
          }
          return n;
        })
      );
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.6, Math.min(2.0, prev + delta)));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  if (!isOpen) return null;

  const content = (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: isEmbedded ? "8px" : "12px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #EAEAEA",
        boxShadow: isEmbedded ? "none" : "0 12px 36px rgba(0,0,0,0.18)",
        width: "100%",
        maxWidth: isEmbedded ? "100%" : "960px",
        height: isEmbedded ? "580px" : "680px",
        position: "relative"
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid #EEEEEE",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#FAFAFA"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#EE4D2D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFF"
            }}
          >
            <Network size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "#222", margin: 0 }}>
                NutriGraph recommendation relationships
              </h3>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  backgroundColor: "#EBF3FE",
                  color: "#0052CC",
                  padding: "2px 8px",
                  borderRadius: 4
                }}
              >
                App rules
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0 0" }}>
              Template, ingredient, and menu relationships reflect app configuration; they are not medical validation or a food safety guarantee.
            </p>
          </div>
        </div>

        {/* Filter Pills & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { id: "ALL", label: "All nodes" },
            { id: "CONDITIONS", label: "Medical conditions" },
            { id: "INGREDIENTS", label: "Ingredients flagged by rules" },
            { id: "DISHES", label: "Menu recommendations" }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              style={{
                backgroundColor: activeFilter === f.id ? "#EE4D2D" : "#FFFFFF",
                color: activeFilter === f.id ? "#FFFFFF" : "#555555",
                border: activeFilter === f.id ? "1px solid #EE4D2D" : "1px solid #D5D5D5",
                borderRadius: "14px",
                fontSize: "11px",
                fontWeight: activeFilter === f.id ? 600 : 400,
                padding: "3px 10px",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {f.label}
            </button>
          ))}

          {!isEmbedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#666",
                marginLeft: 8
              }}
              aria-label="Close visualization"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ position: "relative", flex: 1, backgroundColor: "#FDFDFD", overflow: "hidden" }}>
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              gap: 8
            }}
          >
            <RefreshCw size={26} className="spin-slow" color="#EE4D2D" />
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#333" }}>
              Building the knowledge graph view...
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#C53030",
              fontSize: "12.5px",
              marginTop: 60
            }}
          >
            <AlertTriangle size={24} style={{ margin: "0 auto 8px" }} />
            {error}
          </div>
        )}

        {/* SVG Network Visualizer */}
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%", cursor: isDraggingCanvas ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            {/* Arrowhead Markers */}
            <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#999999" />
            </marker>
            <marker id="arrow-danger" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#E02424" />
            </marker>
            <marker id="arrow-success" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#00B14F" />
            </marker>

            {/* Glowing Drop Shadow Filter for Active Node */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Canvas Transform Container */}
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
            {/* Background Grid Pattern */}
            <g opacity="0.08">
              {Array.from({ length: 15 }).map((_, i) => (
                <line key={`h-${i}`} x1="0" y1={i * 60} x2="900" y2={i * 60} stroke="#444" strokeWidth="1" />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                <line key={`v-${i}`} x1={i * 60} y1="0" x2={i * 60} y2="600" stroke="#444" strokeWidth="1" />
              ))}
            </g>

            {/* Edges */}
            {filteredEdges.map((e, idx) => {
              const src = nodeMap.get(e.source);
              const tgt = nodeMap.get(e.target);
              if (!src || !tgt || src.x === undefined || tgt.x === undefined || src.y === undefined || tgt.y === undefined) return null;

              const isContra = e.relation.includes("CONTRAINDICATE") || e.severity === "CONTRAINDICATED" || e.severity === "CRITICAL";
              const isSafe = e.relation === "RECOMMENDED_DISH" || e.relation.includes("BENEFIT") || e.is_safe === true;

              const strokeColor = isContra ? "#E02424" : isSafe ? "#00B14F" : (e.color || "#A0AEC0");
              const strokeWidth = isContra ? 2.5 : isSafe ? 2.0 : 1.5;
              const isDashed = isContra;

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isDashed ? "5,4" : undefined}
                    opacity="0.8"
                    markerEnd={isContra ? "url(#arrow-danger)" : isSafe ? "url(#arrow-success)" : "url(#arrow)"}
                  />
                  {/* Edge Relation Label */}
                  <text
                    x={midX}
                    y={midY - 4}
                    fontSize="9.5"
                    fill={strokeColor}
                    fontWeight="600"
                    textAnchor="middle"
                    style={{
                      userSelect: "none",
                      backgroundColor: "#FFF",
                      paintOrder: "stroke",
                      stroke: "#FFF",
                      strokeWidth: "3px"
                    }}
                  >
                    {e.relation.replace(/_/g, " ")}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((n) => {
              const isSelected = selectedNode?.id === n.id;
              const isHovered = hoveredNode?.id === n.id;
              const isPersona = n.type === "PERSONA";
              const isDish = n.type === "DISH";
              const isCondition = n.type === "CONDITION";

              const radius = isPersona ? 28 : isDish ? 22 : isCondition ? 20 : 16;
              const color = isPersona
                ? "#EE4D2D"
                : isDish
                ? "#0052CC"
                : isCondition
                ? "#E91E63"
                : n.type === "ALLERGEN"
                ? "#E02424"
                : n.type === "COOKING_METHOD"
                ? "#8E44AD"
                : "#27AE60";

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x || 0}, ${n.y || 0})`}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingNodeId(n.id);
                  }}
                  onClick={() => setSelectedNode(n)}
                  onMouseEnter={() => setHoveredNode(n)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <circle r={radius + 6} fill="none" stroke={color} strokeWidth="3" opacity="0.6" strokeDasharray="3,3" />
                  )}

                  {/* Node Circle */}
                  <circle
                    r={radius}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    filter={isSelected || isHovered ? "url(#glow)" : undefined}
                    style={{ transition: "all 0.15s ease" }}
                  />

                  {/* Node Icon / Letter */}
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#FFFFFF"
                    fontSize={isPersona ? "12" : "10"}
                    fontWeight="700"
                    style={{ userSelect: "none" }}
                  >
                    {isPersona ? "👤" : isDish ? "🍱" : isCondition ? "🩺" : n.type === "ALLERGEN" ? "⚠️" : "🌿"}
                  </text>

                  {/* Node Label Below */}
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={isSelected ? "700" : "500"}
                    fill="#222222"
                    style={{
                      userSelect: "none",
                      paintOrder: "stroke",
                      stroke: "#FFFFFF",
                      strokeWidth: "3px"
                    }}
                  >
                    {n.label.length > 20 ? `${n.label.slice(0, 18)}...` : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Zoom & Control Toolbar */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            display: "flex",
            alignItems: "center",
            gap: 4,
            backgroundColor: "#FFFFFF",
            border: "1px solid #D5D5D5",
            borderRadius: 6,
            padding: "3px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
          }}
        >
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "#444" }}
            title="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "#444" }}
            title="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "#444" }}
            title="Reset position"
          >
            <RotateCcw size={14} />
          </button>
          <span style={{ fontSize: "11px", color: "#777", marginLeft: 4, paddingRight: 4 }}>
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Legend Box */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: "11px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            backdropFilter: "blur(4px)"
          }}
        >
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 4 }}>Graph legend:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#EE4D2D" }}></span>
              <span>Recommendation persona</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#E91E63" }}></span>
              <span>Medical conditions in templates (GERD, hypertension, etc.)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#27AE60" }}></span>
              <span>Food ingredients</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#0052CC" }}></span>
              <span>Menu items</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 2, backgroundColor: "#E02424", borderTop: "2px dashed #E02424" }}></span>
              <span>Red: contraindications in app rules</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 2, backgroundColor: "#00B14F" }}></span>
              <span>Green: match according to recommendation rules</span>
            </div>
          </div>
        </div>

        {/* Side Inspector Panel for Selected Node */}
        {selectedNode && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: "270px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "14px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              fontSize: "12px",
              maxHeight: "85%",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: "#F4F4F4",
                    color: "#555",
                    padding: "2px 6px",
                    borderRadius: 3
                  }}
                >
                  {selectedNode.type}
                </span>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#222", margin: "4px 0 0 0" }}>
                  {selectedNode.label}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Node Metadata Rendering */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {selectedNode.type === "PERSONA" && (
                <>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Archetype:</span>
                    <div style={{ fontWeight: 600 }}>{selectedNode.data?.archetype || "Not available"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Template calorie target:</span>
                    <div style={{ fontWeight: 600, color: "#EE4D2D" }}>{selectedNode.data?.target_kcal != null ? `${selectedNode.data.target_kcal} kcal` : "Not available"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Budget limit:</span>
                    <div style={{ fontWeight: 600 }}>{selectedNode.data?.budget_idr != null ? `Rp ${selectedNode.data.budget_idr.toLocaleString("en-US")}` : "Not available"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Template conditions (not your medical history):</span>
                    <div style={{ fontWeight: 500, color: "#C53030" }}>{selectedNode.data?.medical_conditions || "Not available"}</div>
                  </div>
                </>
              )}

              {selectedNode.type === "CONDITION" && (
                <>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Sources listed in the rules:</span>
                    <div style={{ fontWeight: 600, color: "#0052CC", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <BookOpen size={12} /> {selectedNode.data?.guideline || "Source not provided"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Rule explanation (not clinically validated):</span>
                    <div style={{ fontSize: "11.5px", color: "#444", lineHeight: 1.4, marginTop: 2 }}>
                      {selectedNode.data?.rationale || "Explanation not available."}
                    </div>
                  </div>
                </>
              )}

              {selectedNode.type === "INGREDIENT" && (
                <>
                  <div>
                    <span style={{ color: "#777", fontSize: "11px" }}>Ingredient notes in app rules:</span>
                    <div style={{ fontSize: "11.5px", color: "#444", lineHeight: 1.4, marginTop: 2 }}>
                      {selectedNode.data?.impact || "Ingredient notes not available."}
                    </div>
                  </div>
                  {selectedNode.data?.alternative && (
                    <div>
                      <span style={{ color: "#777", fontSize: "11px" }}>Alternatives in app rules:</span>
                      <div style={{ fontWeight: 600, color: "#00B14F", marginTop: 2 }}>
                        {selectedNode.data.alternative}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedNode.type === "DISH" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, backgroundColor: "#F9F9F9", padding: "6px 8px", borderRadius: 4 }}>
                    <div>
                      <span style={{ color: "#777", fontSize: "10.5px" }}>Calories:</span>
                      <div style={{ fontWeight: 700, color: "#EE4D2D" }}>{selectedNode.data?.calories != null ? `${selectedNode.data.calories} kcal` : "Not available"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#777", fontSize: "10.5px" }}>Protein:</span>
                      <div style={{ fontWeight: 700, color: "#00B14F" }}>{selectedNode.data?.protein_g != null ? `${selectedNode.data.protein_g} g` : "Not available"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#777", fontSize: "10.5px" }}>Sodium:</span>
                      <div style={{ fontWeight: 700 }}>{selectedNode.data?.sodium_mg != null ? `${selectedNode.data.sodium_mg} mg` : "Not available"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#777", fontSize: "10.5px" }}>Price:</span>
                      <div style={{ fontWeight: 700 }}>{selectedNode.data?.price_idr != null ? `Rp ${selectedNode.data.price_idr.toLocaleString("en-US")}` : "Not available"}</div>
                    </div>
                  </div>
                  {selectedNode.data?.clinical_rationale && (
                    <div>
                      <span style={{ color: "#777", fontSize: "11px" }}>Notes from app rules:</span>
                      <div style={{ fontSize: "11.5px", color: "#444", lineHeight: 1.4, marginTop: 2 }}>
                        {selectedNode.data.clinical_rationale}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {content}
    </div>
  );
}
