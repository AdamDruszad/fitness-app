/**
 * @file Coach.jsx
 * @description Interactive AI fitness coach chat interface.
 * Connects to the backend SSE endpoint (/chat/) for real-time streamed responses.
 * Renders rich markdown (tables, lists, bold text) using react-markdown,
 * manages optimistic UI message updates, provides automatic scroll-to-bottom,
 * and maintains conversation history across sessions.
 */

import { useState, useEffect, useRef } from "react";
import client from "../api/client";
import Layout from "../components/Layout";
import { IconSend2, IconRobot, IconUser, IconLoader2 } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageHeading from "../components/PageHeading";
import { Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { readToken } from "../api/token";

const markdownComponents = {
  table: ({ children }) => <div className="coach-table" role="region" aria-label="Coach table, scroll horizontally for more" tabIndex={0}><table>{children}</table></div>,
};

export default function Coach() {
  const { logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const streamControllerRef = useRef(null);
  const followMessagesRef = useRef(true);

  /**
   * Auto-scrolls to the bottom of the chat container when messages update.
   */
  useEffect(() => {
    if (followMessagesRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [messages]);

  /**
   * Loads historical messages on component mount.
   */
  useEffect(() => {
    const controller = new AbortController();
    client
      .get("/chat/", { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        setMessages(
          r.data.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
          }))
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load chat history. You can still send a new message.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      streamControllerRef.current?.abort();
    };
  }, []);

  /**
   * Sends user message to the backend and consumes the Server-Sent Events stream.
   * 
   * @param {React.FormEvent} e - Form submission event.
   */
  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || streaming || streamControllerRef.current) return;

    const controller = new AbortController();
    streamControllerRef.current = controller;
    followMessagesRef.current = true;

    setInput("");
    setError("");

    // Optimistically insert user message and empty assistant reply placeholder
    const userMsg = { role: "user", content: text, id: crypto.randomUUID() };
    const assistantMsg = {
      role: "assistant",
      content: "",
      id: crypto.randomUUID(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    let reader;
    // SSE frames carry an event name that decides how the following data line is used.
    let pendingEvent = "message";
    let receivedDone = false;
    let serverError = "";
    try {
      const token = readToken();
      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

      // Initiate SSE streaming request
      const response = await fetch(`${baseURL}/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }
        throw new Error(`Server error: ${response.status}`);
      }

      // Read chunked stream using ReadableStream reader
      if (!response.body) throw new Error("The coach response could not be read. Please try again.");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (controller.signal.aborted) return;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            pendingEvent = line.slice(7).trim();
            if (pendingEvent === "done") receivedDone = true;
            continue;
          }
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (!payload || payload === "{}") {
            pendingEvent = "message";
            continue;
          }
          let chunk;
          try {
            chunk = JSON.parse(payload);
          } catch {
            // Ignore non-JSON ping/heartbeat lines
            pendingEvent = "message";
            continue;
          }
          if (pendingEvent === "error") {
            serverError =
              (typeof chunk === "object" && chunk !== null && typeof chunk.message === "string" && chunk.message) ||
              "Your coach could not finish this response. Please try again.";
            pendingEvent = "message";
            continue;
          }
          if (pendingEvent === "done") {
            receivedDone = true;
            pendingEvent = "message";
            continue;
          }
          pendingEvent = "message";
          if (typeof chunk !== "string") continue;
          // Append newly arrived text chunk to assistant's message content
          setMessages((prev) => prev.map((message) =>
            message.id === assistantMsg.id
              ? { ...message, content: message.content + chunk }
              : message
          ));
        }
      }

      // A stream that stops without the server's closing event is a failure the
      // user must see, not a silently truncated answer.
      if (serverError || !receivedDone) {
        setError(serverError || "The connection closed before your coach finished. Please try again.");
        setMessages((prev) => prev.filter((message) =>
          message.id !== assistantMsg.id || message.content
        ));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message || "Something went wrong");
      // Remove empty assistant placeholder if failed before stream started
      setMessages((prev) => prev.filter((message) =>
        message.id !== assistantMsg.id || message.content
      ));
    } finally {
      reader?.releaseLock();
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
        if (!controller.signal.aborted) {
          setStreaming(false);
          inputRef.current?.focus();
        }
      }
    }
  }

  return (
    <Layout contentClassName="coach-content">
      <div className="coach-layout">
        {/* Header */}
        <PageHeading eyebrow="A little guidance goes a long way" title="AI Coach" description="Talk through your training, technique and recovery." />

        {/* Scrollable Conversation History Container */}
        <div
          role="log"
          aria-label="Conversation with your coach"
          aria-live="off"
          tabIndex={0}
          onScroll={(event) => {
            const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
            followMessagesRef.current = scrollHeight - scrollTop - clientHeight < 80;
          }}
          className="coach-conversation"
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <IconLoader2
                className="text-brand-accent animate-spin"
                size={28}
              aria-hidden="true" />
            </div>
          ) : error && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p role="alert" className="text-danger-text text-sm">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="p-4 bg-brand-accent/10 rounded-full">
                <IconRobot size={32} className="text-brand-accent/60" aria-hidden="true" />
              </div>
              <p className="text-text-muted text-sm max-w-xs">
                Ask your AI coach about exercises, form tips, recovery, or
                anything training-related.
              </p>
            </div>
          ) : (
            /* Rendered Messages */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`coach-message flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* User / Assistant Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
                    msg.role === "user"
                      ? "bg-brand-accent/20"
                      : "bg-raised border border-border-subtle"
                  }`}
                >
                  {msg.role === "user" ? (
                    <IconUser
                      size={14}
                      className="text-brand-accent"
                      stroke={2}
                    aria-hidden="true" />
                  ) : (
                    <IconRobot
                      size={14}
                      className="text-text-muted"
                      stroke={2}
                    aria-hidden="true" />
                  )}
                </div>

                {/* Message Bubble (Markdown formatted for coach, raw for user) */}
                <div
                  className={`coach-bubble rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-brand-strong text-white rounded-tr-md whitespace-pre-wrap"
                      : "bg-raised border border-border-subtle text-text-main rounded-tl-md markdown-body"
                  }`}
                >
                  {msg.role === "user" ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>}
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

        {/* Error notification banner */}
        {error && messages.length > 0 && (
          <div role="alert" className="mt-2 px-3 py-2 text-xs text-danger-text border border-danger-text/30 rounded-lg bg-danger-text/5 text-center">
            {error}
          </div>
        )}

        <p className="sr-only" role="status">
          {loading ? "Loading chat history" : streaming ? "Your coach is replying" : "Coach ready"}
        </p>

        <p className="coach-note">Chat suggestions don't change your saved plan. <Link to="/onboarding">Update your training preferences</Link> to create a new one.</p>

        {/* Message Input Form */}
        <form
          onSubmit={handleSend}
          className="mt-3 flex items-center gap-2 bg-input border border-border-subtle rounded-xl px-3 py-2 focus-within:border-brand-accent/50 transition-colors"
        >
          <input
            ref={inputRef}
            aria-label="Message your coach"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? "Loading chat history…" : streaming ? "Waiting for response…" : "Ask your coach…"}
            disabled={loading || streaming}
            className="min-w-0 flex-1 bg-transparent text-text-main text-sm placeholder:text-text-muted outline-none disabled:opacity-50"
            id="coach-input"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={loading || streaming || !input.trim()}
            className="p-2 rounded-lg bg-brand-strong text-white hover:bg-brand-strong-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            id="coach-send-btn"
          >
            {streaming ? (
              <IconLoader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <IconSend2 size={18} aria-hidden="true" />
            )}
          </button>
        </form>
      </div>
    </Layout>
  );
}
