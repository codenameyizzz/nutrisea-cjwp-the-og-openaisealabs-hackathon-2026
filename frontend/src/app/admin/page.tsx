"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  MapPin,
  Award,
  Activity,
  Layers,
  Wallet
} from "lucide-react";
import IngredientGuard from "@/components/ingredients/IngredientGuard";
import IngredientDialog from "@/components/ingredients/IngredientDialog";
import { responseJson } from "@/lib/api";
import { useIngredientApi } from "@/services/ingredient-api";
import { useApp } from "@/context/AppContext";

interface PlatformStats {
  total_orders: number;
  total_revenue_idr: number;
  total_cashback_distributed_idr: number;
  total_merchants: number;
  total_restaurants: number;
  total_dishes: number;
  total_users: number;
  verified_restaurants: number;
  hygiene_compliance_pct: number;
  platform_commission_saved_idr: number;
}

interface RestaurantAdminRow {
  id: string;
  name: string;
  brand_name: string;
  cuisine_type: string;
  area: string;
  address?: string;
  distance_km: number;
  delivery_radius_km: number;
  rating: number;
  rating_count: number;
  is_verified_hygiene: boolean;
  is_open: boolean;
  dish_count: number;
  merchant: {
    id: string;
    name: string;
    owner_name: string;
    contact_email: string;
    commission_rate: number;
    seabank_account_no: string;
  };
}

interface DemandHeatmapItem {
  district: string;
  radius_km: number;
  unmet_demand_count: number;
  opportunity_detected: string;
  actionable_suggestion: string;
  suggested_healthy_tags: string[];
  estimated_order_boost_pct: number;
}

interface SystemStatus {
  database?: { status?: string };
  nutrition_api?: { status?: string };
  ai_planner?: { status?: string };
}

function systemLabel(status?: string): string {
  const labels: Record<string, string> = { healthy: "Available", unreachable: "Unreachable", online: "Configured", reference_dataset_fallback: "Reference data fallback", ready: "Reported ready" };
  return status ? labels[status] || status : "Status not available";
}

export default function ShopeeAdminPage() {
  return <IngredientGuard mode="admin"><AdminContent /></IngredientGuard>;
}

function AdminContent() {
  const { authenticatedFetch } = useIngredientApi();
  const { setActiveRole } = useApp();
  const [activeTab, setActiveTab] = useState<"kpi" | "hygiene" | "heatmap" | "system">("kpi");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantAdminRow[]>([]);
  const [heatmap, setHeatmap] = useState<DemandHeatmapItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [loadError, setLoadError] = useState("");
  const [flagReview, setFlagReview] = useState<RestaurantAdminRow | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAdminData = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [statsRes, restsRes, heatRes, sysRes] = await Promise.all([
        authenticatedFetch(`/api/admin/overview`),
        authenticatedFetch(`/api/admin/restaurants`),
        authenticatedFetch(`/api/admin/demand-heatmap`),
        authenticatedFetch(`/api/admin/system-status`)
      ]);

      const [overview, outlets, demand, systems] = await Promise.all([
        responseJson<{ data: PlatformStats }>(statsRes),
        responseJson<{ data: RestaurantAdminRow[] }>(restsRes),
        responseJson<{ data: DemandHeatmapItem[] }>(heatRes),
        responseJson<{ components: SystemStatus }>(sysRes),
      ]);
      setStats(overview.data); setRestaurants(outlets.data || []);
      setHeatmap(demand.data || []); setSystemStatus(systems.components);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Admin data could not be loaded. Try refreshing.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setActiveRole("SHOPEE_ADMIN");
    loadAdminData();
  }, []);

  const handleToggleHygiene = async (restaurantId: string, currentStatus: boolean) => {
    setTogglingId(restaurantId);
    try {
      const nextStatus = !currentStatus;
      const res = await authenticatedFetch(`/api/admin/restaurants/${restaurantId}/toggle-hygiene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_verified: nextStatus,
          audit_notes: nextStatus
            ? "Administrator enabled the catalog hygiene flag; this is not independent certification."
            : "Administrator disabled the catalog hygiene flag pending review."
        })
      });

      if (res.ok) {
        setRestaurants((prev) =>
          prev.map((r) => (r.id === restaurantId ? { ...r, is_verified_hygiene: nextStatus } : r))
        );
        showToast("The catalog hygiene flag was updated.");
        setFlagReview(null);
      } else throw new Error("Hygiene flag update failed");
    } catch (err) {
      console.error("Error toggling hygiene badge:", err);
      showToast("The catalog hygiene flag could not be updated.");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const q = searchFilter.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.brand_name.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q) ||
      r.merchant.name.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: "20px 0 60px", color: "#1E293B" }}>
      <Link href="/admin/ingredients" className="btn-shopee-primary" style={{ display: "inline-block", marginBottom: 16 }}>Manage ingredients</Link>
      <Link href="/admin/merchant-applications" className="btn-shopee-primary" style={{ display: "inline-block", marginBottom: 16, marginLeft: 8 }}>Review merchant applications</Link>
      {loadError && <p role="alert">{loadError} Previously loaded data may be out of date.</p>}
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          backgroundColor: "#0F172A",
          color: "#FFFFFF",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "14px",
          fontWeight: 600,
          borderLeft: "4px solid #10B981"
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: "#0F172A",
        color: "#FFFFFF",
        borderRadius: "12px",
        padding: "24px 28px",
        marginBottom: "24px",
        boxShadow: "0 4px 15px rgba(15,23,42,0.12)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <div style={{
                backgroundColor: "#3B82F6",
                padding: "6px",
                borderRadius: "8px",
                display: "flex"
              }}>
                <ShieldCheck size={22} color="#FFFFFF" />
              </div>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                ShopeeFood & NutriSea SuperAdmin Portal
              </h1>
              <span style={{
                backgroundColor: "rgba(59,130,246,0.2)",
                color: "#60A5FA",
                border: "1px solid rgba(59,130,246,0.3)",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
                textTransform: "uppercase"
              }}>
                Platform administration
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#94A3B8", maxWidth: "680px" }}>
              Manage restaurant catalog flags, review reported district demand, and monitor simulated NutriSea rewards. Catalog flags are not independent hygiene certification.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={loadAdminData}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Refresh data
            </button>
          </div>
        </div>

        {/* Live System Pills */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "18px",
          paddingTop: "14px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          flexWrap: "wrap",
          fontSize: "11px"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#4ADE80" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#4ADE80" }} />
            PostgreSQL: {systemLabel(systemStatus?.database?.status)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#60A5FA" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#60A5FA" }} />
            FatSecret API: {systemLabel(systemStatus?.nutrition_api?.status)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#FBBF24" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#FBBF24" }} />
            Recommendation service: {systemLabel(systemStatus?.ai_planner?.status)}
          </span>
        </div>
      </div>

      {/* Admin Sub-Tabs */}
      <div style={{
        display: "flex",
        gap: "6px",
        marginBottom: "20px",
        borderBottom: "1px solid #E2E8F0",
        paddingBottom: "8px"
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("kpi")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            backgroundColor: activeTab === "kpi" ? "#3B82F6" : "#F1F5F9",
            color: activeTab === "kpi" ? "#FFFFFF" : "#475569",
            cursor: "pointer"
          }}
        >
          <Activity size={15} />
          Platform overview and KPIs
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hygiene")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            backgroundColor: activeTab === "hygiene" ? "#3B82F6" : "#F1F5F9",
            color: activeTab === "hygiene" ? "#FFFFFF" : "#475569",
            cursor: "pointer"
          }}
        >
          <Award size={15} />
          Restaurant hygiene flags ({restaurants.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("heatmap")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            backgroundColor: activeTab === "heatmap" ? "#3B82F6" : "#F1F5F9",
            color: activeTab === "heatmap" ? "#FFFFFF" : "#475569",
            cursor: "pointer"
          }}
        >
          <MapPin size={15} />
          District demand map ({heatmap.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("system")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            backgroundColor: activeTab === "system" ? "#3B82F6" : "#F1F5F9",
            color: activeTab === "system" ? "#FFFFFF" : "#475569",
            cursor: "pointer"
          }}
        >
          <Layers size={15} />
          System integration status
        </button>
      </div>

      {/* TAB 1: Platform KPIs */}
      {activeTab === "kpi" && (
        <div>
          {/* Top 4 KPI Metrics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px"
          }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              padding: "18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0"
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Total merchants
              </span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {stats?.total_merchants ?? "Not available"}
              </div>
              <span style={{ fontSize: "12px", color: "#10B981", fontWeight: 600 }}>
                Managing {stats?.total_restaurants ?? "an unknown number of"} restaurant outlets
              </span>
            </div>

            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              padding: "18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0"
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Catalog hygiene flags
              </span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#10B981", marginTop: "4px" }}>
                {stats?.hygiene_compliance_pct != null ? `${stats.hygiene_compliance_pct}%` : "Not available"}
              </div>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                {stats?.verified_restaurants ?? "Unknown"} of {stats?.total_restaurants ?? "unknown"} outlets have a catalog flag
              </span>
            </div>

            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              padding: "18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0"
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Catalog meals
              </span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {stats?.total_dishes ?? "Not available"}
              </div>
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Nutrition sources vary by meal
              </span>
            </div>

            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              padding: "18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "1px solid #E2E8F0"
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Reported merchant commission savings
              </span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#EE4D2D", marginTop: "4px" }}>
                {stats?.platform_commission_saved_idr != null ? `Rp ${stats.platform_commission_saved_idr.toLocaleString("en-GB")}` : "Not available"}
              </div>
              <span style={{ fontSize: "12px", color: "#10B981", fontWeight: 600 }}>
                Application estimate, not a bank settlement
              </span>
            </div>
          </div>

          {/* SeaBank Gamification Integration Banner */}
          <div style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "10px",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "24px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                backgroundColor: "#16A34A",
                color: "#FFFFFF",
                borderRadius: "50%",
                padding: "8px",
                display: "flex"
              }}>
                <Wallet size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: 700, color: "#166534" }}>
                  NutriSea and SeaBank reward simulation
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#15803D" }}>
                  Prototype rewards are recorded in NutriSea. No money is transferred to a SeaBank account.
                </p>
              </div>
            </div>
            <Link
              href="/"
              style={{
                backgroundColor: "#16A34A",
                color: "#FFFFFF",
                padding: "7px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none"
              }}
            >
              Open customer view
            </Link>
          </div>
        </div>
      )}

      {/* TAB 2: Hygiene Audit & Restaurant Management */}
      {activeTab === "hygiene" && (
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          padding: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #E2E8F0"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
              Restaurant outlets and catalog hygiene flags
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
              Administrators can enable or remove the catalog hygiene flag. This action does not certify food safety or independent inspection.
              </p>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "4px 10px"
            }}>
              <Search size={14} color="#94A3B8" />
              <input
                type="search"
                aria-label="Search outlets, brands, or areas"
              placeholder="Search outlets, brands, or areas..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  outline: "none",
                  padding: "4px 8px",
                  fontSize: "12px"
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Outlet ID</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Outlet and brand</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Merchant owner</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Area</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Active meals</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Merchant commission</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>Hygiene flag</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0", textAlign: "center" }}>Admin action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestaurants.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>
                      {r.id}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>{r.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>Brand: {r.brand_name} ({r.cuisine_type})</div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600 }}>{r.merchant.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>SeaBank account: {r.merchant.seabank_account_no}</div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        backgroundColor: "#EEF2F6",
                        color: "#334155",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: 600
                      }}>
                        {r.area} ({r.distance_km} km)
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700 }}>
                      {r.dish_count} meals
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        color: r.is_verified_hygiene ? "#10B981" : "#EF4444",
                        fontWeight: 700
                      }}>
                        {Number.isFinite(r.merchant.commission_rate) ? `${(r.merchant.commission_rate * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}% (recorded)` : "Not available"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {r.is_verified_hygiene ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          backgroundColor: "#DCFCE7",
                          color: "#15803D",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700
                        }}>
                          <CheckCircle2 size={12} /> Flag enabled
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          backgroundColor: "#FEE2E2",
                          color: "#B91C1C",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700
                        }}>
                          <XCircle size={12} /> Flag not enabled
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setFlagReview(r)}
                        disabled={togglingId === r.id}
                        style={{
                          backgroundColor: r.is_verified_hygiene ? "#FEE2E2" : "#DCFCE7",
                          color: r.is_verified_hygiene ? "#991B1B" : "#166534",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {togglingId === r.id ? "Processing..." : (
                          r.is_verified_hygiene ? "Remove flag" : "Enable flag"
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: District Nutritional Deficit Heatmap */}
      {activeTab === "heatmap" && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
              Reported meal demand and supply gaps by district
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
              This endpoint includes fixed demonstration examples. Treat demand figures as examples, not a verified sales forecast or a measure of nutritional deficiency.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px"
          }}>
            {heatmap.map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #E2E8F0"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <span style={{
                      backgroundColor: "#DBEAFE",
                      color: "#1D4ED8",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "10px"
                    }}>
                      District: {item.district}
                    </span>
                    <h4 style={{ margin: "6px 0 0 0", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                      {item.opportunity_detected.replace(/_/g, " ")}
                    </h4>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#EE4D2D" }}>
                      {item.unmet_demand_count}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748B" }}>Example searches per day</div>
                  </div>
                </div>

                <p style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5", margin: "10px 0" }}>
                  {item.actionable_suggestion}
                </p>

                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>
                    Requested menu tags:
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                    {item.suggested_healthy_tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        style={{
                          backgroundColor: "#F0FDF4",
                          color: "#15803D",
                          border: "1px solid #DCFCE7",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}
                      >
                        #{tag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{
                  marginTop: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#10B981",
                  fontWeight: 600
                }}>
                  <span>Example order increase:</span>
                  <span style={{ fontSize: "14px", fontWeight: 800 }}>+{item.estimated_order_boost_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: System Integration Monitor */}
      {activeTab === "system" && (
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          padding: "24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #E2E8F0"
        }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
            Components and external integrations
          </h3>
          <p style={{ margin: "0 0 20px 0", fontSize: "12px", color: "#64748B" }}>
            Backend-reported database, nutrition API, and recommendation service status. Configuration does not confirm a successful live request.
          </p>

          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              backgroundColor: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid #E2E8F0"
            }}>
              <div>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>PostgreSQL Aiven Cloud</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Database connectivity reported by the backend</div>
              </div>
              <span style={{
                backgroundColor: "#DCFCE7",
                color: "#166534",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700
              }}>
                {systemLabel(systemStatus?.database?.status)}
              </span>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              backgroundColor: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid #E2E8F0"
            }}>
              <div>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>FatSecret Platform API (OAuth 1.0a HMAC-SHA1)</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Provider configuration status, not confirmation of a live API request</div>
              </div>
              <span style={{
                backgroundColor: "#DCFCE7",
                color: "#166534",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700
              }}>
                {systemLabel(systemStatus?.nutrition_api?.status)}
              </span>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              backgroundColor: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid #E2E8F0"
            }}>
              <div>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>AI meal planner</div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>Recommendation service status reported by the backend</div>
              </div>
              <span style={{
                backgroundColor: "#DBEAFE",
                color: "#1E40AF",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700
              }}>
                {systemLabel(systemStatus?.ai_planner?.status)}
              </span>
            </div>
          </div>
        </div>
      )}
      {flagReview && <IngredientDialog title={`${flagReview.is_verified_hygiene ? "Remove" : "Enable"} catalog hygiene flag?`} busy={!!togglingId} onClose={() => setFlagReview(null)}>
        <p>{flagReview.name}: this changes an application catalog flag. It does not certify food safety or confirm an independent inspection.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
          <button disabled={!!togglingId} onClick={() => setFlagReview(null)}>Cancel</button>
          <button disabled={!!togglingId} onClick={() => void handleToggleHygiene(flagReview.id, flagReview.is_verified_hygiene)}>{togglingId ? "Saving..." : "Confirm flag change"}</button>
        </div>
      </IngredientDialog>}
    </div>
  );
}
