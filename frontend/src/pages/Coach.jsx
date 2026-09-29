import { useState, useEffect, useRef } from "react";
import client from "../api/client";
import Layout from "../components/Layout";
import { IconSend2, IconRobot, IconUser, IconLoader2 } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    client
      .get("/chat/")
      .then((r) => {
        setMessages(
          r.data.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
          }))
        );
      })
      .catch(() => setError("Could not load chat history"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError("");

    // Optimistically add user message
    const userMsg = { role: "user", content: text, id: crypto.randomUUID() };
    const assistantMsg = {
      role: "assistant",
      content: "",
      id: crypto.randomUUID(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const token = localStorage.getItem("token");
      const baseURL =
        import.meta.env.VITE_API_URL || "http://localhost:8000";

      const response = await fetch(`${baseURL}/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: done")) {
            // Stream finished — nothing to parse
            continue;
          }
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (!payload || payload === "{}") continue;
            try {
              const chunk = JSON.parse(payload);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
                return updated;
              });
            } catch {
              // Non-JSON line, skip
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
      // Remove the empty assistant placeholder on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Layout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-brand-accent/15 rounded-xl">
            <IconRobot className="text-brand-accent" size={24} stroke={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main leading-tight">
              AI Coach
            </h1>
            <p className="text-xs text-text-muted">
              Ask anything about your training
            </p>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border-subtle bg-surface/30 backdrop-blur-sm p-4 flex flex-col gap-3 scroll-smooth">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <IconLoader2
                className="text-brand-accent animate-spin"
                size={28}
              />
            </div>
          ) : error && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="p-4 bg-brand-accent/10 rounded-full">
                <IconRobot size={32} className="text-brand-accent/60" />
              </div>
              <p className="text-text-muted text-sm max-w-xs">
                Ask your AI coach about exercises, form tips, recovery, or
                anything training-related.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
                    msg.role === "user"
                      ? "bg-brand-accent/20"
                      : "bg-white/[0.06] border border-border-subtle"
                  }`}
                >
                  {msg.role === "user" ? (
                    <IconUser
                      size={14}
                      className="text-brand-accent"
                      stroke={2}
                    />
                  ) : (
                    <IconRobot
                      size={14}
                      className="text-text-muted"
                      stroke={2}
                    />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-brand-accent text-white rounded-tr-md whitespace-pre-wrap"
                      : "bg-white/[0.04] border border-border-subtle text-text-main rounded-tl-md markdown-body"
                  }`}
                >
                  {msg.role === "user" ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                  {msg.role === "assistant" &&
                    streaming &&
                    msg === messages[messages.length - 1] && (
                      <span className="inline-block w-1.5 h-4 bg-brand-accent/70 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
                    )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error banner */}
        {error && messages.length > 0 && (
          <div className="mt-2 px-3 py-2 text-xs text-red-400 border border-red-400/30 rounded-lg bg-red-400/5 text-center">
            {error}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="mt-3 flex items-center gap-2 bg-input border border-border-subtle rounded-xl px-3 py-2 focus-within:border-brand-accent/50 transition-colors"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={streaming ? "Waiting for response…" : "Ask your coach…"}
            disabled={streaming}
            className="flex-1 bg-transparent text-text-main text-sm placeholder:text-text-muted/50 outline-none disabled:opacity-50"
            id="coach-input"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="p-2 rounded-lg bg-brand-accent text-white hover:bg-brand-accent/85 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            id="coach-send-btn"
          >
            {streaming ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconSend2 size={18} />
            )}
          </button>
        </form>
      </div>
    </Layout>
  );
}