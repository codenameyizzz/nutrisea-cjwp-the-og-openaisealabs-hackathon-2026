"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot, RefreshCw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useUser, useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
}

const QUICK_PROMPTS = [
  "Saya tidak suka ayam",
  "Saya suka ayam lagi",
  "Rekomendasi menu ramah lambung",
  "Makan siang kenyang < 500 kcal",
  "Menu tinggi protein & hemat",
  "Camilan sore yang aman"
];

export default function AiAssistantModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: "Halo! Saya NutriSea AI Co-Pilot. Ada keluhan kesehatan tertentu, target diet, atau ingin rekomendasi menu sehat dari ShopeeFood hari ini?",
      time: "Baru saja"
    }
  ]);

  const { bmiStats, activeUserId } = useApp();
  const { user } = useUser();
  const { getToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: "u-" + Date.now(),
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage("");
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Silakan masuk terlebih dahulu.");
      const preference = await responseJson<{ recognized: boolean; excluded_foods: string[] }>(
        await fetch(`${API_BASE_URL}/api/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: textToSend }),
        })
      );
      if (preference.recognized) {
        window.dispatchEvent(new Event("nutrisea:preferences-updated"));
        setMessages((prev) => [...prev, {
          id: "preference-" + Date.now(), sender: "ai",
          text: `Preferensi tersimpan. Menu rekomendasi akan diperbarui. ${preference.excluded_foods.length ? `Tidak disukai: ${preference.excluded_foods.join(", ")}.` : "Tidak ada makanan yang dikecualikan berdasarkan preferensi."} Ini preferensi makanan, bukan catatan alergi.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }]);
        return;
      }
      const historyPayload = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          user_id: user?.id || activeUserId || "user_3LdSuzBP84WASHC2BC7vliRK52R",
          history: historyPayload,
          user_bmi_stats: bmiStats
        })
      });

      if (!res.ok) {
        throw new Error("Backend response error");
      }

      const data = await res.json();
      const aiReply: Message = {
        id: "ai-" + Date.now(),
        sender: "ai",
        text: data.reply || "Maaf, respon AI sedang tidak tersedia.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.warn("NutriSea request failed:", err);
      const fallbackReply: Message = {
        id: "ai-fallback-" + Date.now(),
        sender: "ai",
        text: "Permintaan belum berhasil. Preferensi mungkin belum tersimpan. Silakan coba lagi.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="ai-floating-btn"
        aria-label="Tanya NutriSea AI"
        style={{
          position: "fixed",
          bottom: "78px",
          right: "16px",
          backgroundColor: "#EE4D2D",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "50px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 14px rgba(238, 77, 45, 0.4)",
          cursor: "pointer",
          zIndex: 900,
          fontSize: "13px",
          fontWeight: 500,
          transition: "transform 0.15s ease"
        }}
      >
        <div style={{ position: "relative", display: "flex" }}>
          <Sparkles size={16} />
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              width: "6px",
              height: "6px",
              backgroundColor: "#2ECC71",
              borderRadius: "50%",
              boxShadow: "0 0 4px #2ECC71"
            }}
          />
        </div>
        <span>Tanya AI Gizi</span>
      </button>

      {/* Chat Drawer / Modal */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end"
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              height: "100%",
              backgroundColor: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              animation: "slideInRight 0.2s ease"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: "#EE4D2D",
                color: "#FFFFFF",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    padding: 6,
                    borderRadius: "50%",
                    display: "flex"
                  }}
                >
                  <Bot size={18} color="#FFFFFF" />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    NutriSea AI Co-Pilot
                  </div>
                  <div style={{ fontSize: "11px", opacity: 0.9 }}>
                    AI Nutritionist Active
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  padding: 4
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Prompts Bar */}
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "#FFF9F6",
                borderBottom: "1px solid #FFE4DB",
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                whiteSpace: "nowrap"
              }}
            >
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #FFD0C0",
                    color: "#D03E1B",
                    borderRadius: "14px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                backgroundColor: "#F8F9FA"
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.sender === "user" ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: msg.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      backgroundColor: msg.sender === "user" ? "#EE4D2D" : "#FFFFFF",
                      color: msg.sender === "user" ? "#FFFFFF" : "#222222",
                      border: msg.sender === "user" ? "none" : "1px solid #EAEAEA",
                      fontSize: "13px",
                      lineHeight: "1.45",
                      whiteSpace: "pre-line",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}
                  >
                    {msg.text}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#999",
                      marginTop: "4px",
                      padding: "0 4px"
                    }}
                  >
                    {msg.time}
                  </span>
                </div>
              ))}

              {isLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" }}>
                  <RefreshCw size={14} className="spin-icon" color="#EE4D2D" />
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    AI sedang berpikir...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                padding: "12px",
                backgroundColor: "#FFFFFF",
                borderTop: "1px solid #EEEEEE",
                display: "flex",
                gap: "8px"
              }}
            >
              <input
                type="text"
                placeholder="Tanya makanan ramah gizi..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #DDDDDD",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  backgroundColor: !inputMessage.trim() || isLoading ? "#CCCCCC" : "#EE4D2D",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  width: "38px",
                  height: "38px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: !inputMessage.trim() || isLoading ? "not-allowed" : "pointer"
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
