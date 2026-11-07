"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_UPDATED } from "@/services/account-session";
import { useUser, useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
}

interface PendingAction {
  action_id: string; field: string; old_value: unknown; proposed_value: unknown;
  scope: string; expires_at: string; today_only?: boolean;
}
interface SavedMessage { id: number; role: "user" | "assistant"; content: string; created_at: string }
const fromSaved = (m: SavedMessage): Message => ({ id: String(m.id), sender: m.role === "user" ? "user" : "ai", text: m.content,
  time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
const QUICK_PROMPTS = ["My lunch budget is now Rp60,000", "I'm trying to eat less fried food", "No rice today"];

export default function AiAssistantModal({ inlineTrigger = false }: { inlineTrigger?: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: "Hello! Tell me your food preferences and budget. I will ask before saving permanent changes.",
      time: "Just now"
    }
  ]);

  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [historyReady, setHistoryReady] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const revealingOlder = useRef(false);
  const lastScrollTop = useRef(0);
  const { user } = useUser();
  const { getToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener("nutrisea:open-assistant", open);
    return () => window.removeEventListener("nutrisea:open-assistant", open);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trigger = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeys);
    return () => { document.removeEventListener("keydown", handleKeys); document.body.style.overflow = previousOverflow; trigger?.focus(); };
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !revealingOlder.current) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    let cancelled = false;
    setHistoryReady(false);
    setMessages([]);
    setPendingActions([]);
    setVisibleCount(20);
    revealingOlder.current = false;
    lastScrollTop.current = 0;
    if (!isOpen || !user?.id) return;
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Please sign in to use chat.");
        const data = await responseJson<{ messages: SavedMessage[]; pending_actions: PendingAction[] }>(await fetch(
          `${API_BASE_URL}/api/ai/history/${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }));
        if (cancelled) return;
        setMessages(data.messages.map(fromSaved)); setPendingActions(data.pending_actions); setHistoryReady(true); setError("");
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your conversation."); }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, user?.id, getToken]);

  const refreshRecommendations = (permanent = false) => {
    window.dispatchEvent(new Event("nutrisea:preferences-updated"));
    if (permanent) window.dispatchEvent(new Event(ACCOUNT_UPDATED));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading || !historyReady) return;
    setIsLoading(true); setError(""); revealingOlder.current = false;
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in to use chat.");
      const data = await responseJson<{ reply: string; message: SavedMessage; pending_actions: PendingAction[]; profile_changed: boolean }>(
        await fetch(`${API_BASE_URL}/api/ai/chat`, { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: textToSend }),
        }));
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, sender: "user", text: textToSend, time: "Now" }, fromSaved(data.message)]);
      setPendingActions(data.pending_actions); setInputMessage("");
      if (data.profile_changed) refreshRecommendations(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Your message could not be sent. Please retry."); }
    finally { setIsLoading(false); }
  };

  const confirm = async (actionId: string, choice: "permanent" | "today" | "reject") => {
    if (isLoading) return;
    setIsLoading(true); setError(""); revealingOlder.current = false;
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in to continue.");
      const data = await responseJson<{ message: SavedMessage; pending_actions: PendingAction[] }>(await fetch(
        `${API_BASE_URL}/api/ai/actions/${encodeURIComponent(actionId)}/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ choice }),
        }));
      setMessages(prev => [...prev, fromSaved(data.message)]); setPendingActions(data.pending_actions);
      refreshRecommendations(choice === "permanent");
    } catch (err) { setError(err instanceof Error ? err.message : "The change could not be confirmed."); }
    finally { setIsLoading(false); }
  };

  const revealOlder = () => {
    const el = scrollRef.current;
    if (!el || visibleCount >= messages.length) return;
    const oldHeight = el.scrollHeight;
    revealingOlder.current = true;
    setVisibleCount(count => count + 20);
    requestAnimationFrame(() => { el.scrollTop += el.scrollHeight - oldHeight; });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className={inlineTrigger ? "ai-inline-btn" : "ai-floating-btn"}
        aria-label="Ask NutriSea AI"
        aria-expanded={isOpen}
        aria-controls="nutrisea-assistant"
        style={{
          position: inlineTrigger ? "static" : "fixed",
          bottom: "78px",
          right: "16px",
          backgroundColor: "#C43E20",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "8px",
          padding: "10px 16px",
          minHeight: "44px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 2px 6px rgba(0,0,0,.12)",
          cursor: "pointer",
          zIndex: 900,
          fontSize: "13px",
          fontWeight: 500,
          transition: "transform 0.15s ease"
        }}
      >
        <MessageCircle size={20} aria-hidden="true" />
        <span>Ask NutriSea</span>
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
            justifyContent: user ? "flex-end" : "center",
            alignItems: user ? "stretch" : "center",
            padding: user ? 0 : 16
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={dialogRef}
            id="nutrisea-assistant"
            className="nutrisea-assistant"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrisea-assistant-title"
            style={{
              width: "100%",
              maxWidth: "420px",
              height: user ? "100dvh" : "auto",
              maxHeight: "100dvh",
              borderRadius: user ? 0 : 8,
              overflow: "hidden",
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
                backgroundColor: "#C43E20",
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
                  <MessageCircle size={18} color="#FFFFFF" />
                </div>
                <div>
                  <h2 id="nutrisea-assistant-title" style={{ fontSize: "18px", fontWeight: 600 }}>
                    NutriSea assistant
                  </h2>
                  <div style={{ fontSize: "13px" }}>
                    Help with choosing food
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
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
            {user && <div
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
                  disabled={isLoading || !historyReady}
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
            </div>}

            {/* Chat Messages */}
            <div ref={scrollRef} onScroll={event => { const top = event.currentTarget.scrollTop; if (top < 8 && top < lastScrollTop.current) revealOlder(); lastScrollTop.current = top; }}
              style={{
                flex: user ? 1 : undefined,
                minHeight: 0,
                overflowY: "auto",
                padding: "16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                backgroundColor: "#F8F9FA"
              }}
            >
              {!user && <><p>Sign in to discuss your food preferences and saved budget.</p><Link className="btn-shopee-primary assistant-sign-in" href={`/sign-in?redirect_url=${encodeURIComponent(pathname || "/")}`}>Sign in to chat</Link></>}
              {user && !historyReady && !error && <p role="status">Loading your conversation...</p>}
              {visibleCount < messages.length && <button type="button" onClick={revealOlder}>Show older messages</button>}
              {messages.slice(-visibleCount).map((msg) => (
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

              {pendingActions.map(action => (
                <section key={action.action_id} aria-label="Confirm profile change" style={{ padding: 14, border: "1px solid #B9371C", borderRadius: 10, background: "#FFF9F6" }}>
                  <strong>{action.field === "meal_budget_idr" ? "Lunch budget" : action.field.replaceAll("_", " ")}</strong>
                  <p>Current: {String(action.old_value ?? "Not set")}<br />Proposed: {String(action.proposed_value)}</p>
                  <p style={{ fontSize: 12 }}>Confirmation expires in 15 minutes. Today-only changes end at midnight in Jakarta.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!action.today_only && <button type="button" className="btn-shopee-primary" disabled={isLoading || !historyReady} onClick={() => void confirm(action.action_id, "permanent")}>Update permanently</button>}
                    {action.field !== "birth_date" && <button type="button" disabled={isLoading || !historyReady} onClick={() => void confirm(action.action_id, "today")}>Just for today</button>}
                    <button type="button" disabled={isLoading || !historyReady} onClick={() => void confirm(action.action_id, "reject")}>Keep existing</button>
                  </div>
                </section>
              ))}
              {error && <p role="alert">{error}</p>}
              {isLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" }}>
                  <RefreshCw size={14} className="spin-icon" color="#EE4D2D" />
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Working on your request...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            {user && <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                padding: "12px",
                backgroundColor: "#FFFFFF",
                borderTop: "1px solid #EEEEEE",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap"
              }}
            >
              <label htmlFor="assistant-message" style={{ width: "100%", fontSize: "14px" }}>Your message</label>
              <input
                id="assistant-message"
                type="text"
                placeholder="Tell me your budget or food preferences..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading || !historyReady}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #DDDDDD",
                  fontSize: "16px",
                  minWidth: 0
                }}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={isLoading || !historyReady || !inputMessage.trim()}
                style={{
                  backgroundColor: !inputMessage.trim() || isLoading ? "#CCCCCC" : "#B9371C",
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
            </form>}
          </div>
        </div>
      )}
    </>
  );
}
