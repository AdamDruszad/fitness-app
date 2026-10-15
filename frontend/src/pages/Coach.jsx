/**
 * @file Coach.jsx
 * @description Interactive AI fitness coach chat interface.
 * Connects to the backend SSE endpoint (/chat/) for real-time streamed responses.
 * Renders rich markdown (tables, lists, bold text) using react-markdown,
 * manages optimistic UI message updates, provides automatic scroll-to-bottom,
 * and maintains conversation history across sessions.
 */

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import client from "../api/client";
import Layout from "../components/Layout";
import { IconSend2, IconUser, IconLoader2, IconSparkles, IconFileText, IconChevronRight } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageHeading from "../components/PageHeading";
import { Link, useNavigate } from "react-router";
import { apiError } from "../utils/plans";
import { useAuth } from "../hooks/useAuth";
import { readToken } from "../api/token";
import { Notice } from "../components/ui";

// The server accepts up to 4000 characters per message (ChatMessageIn).
const MESSAGE_LIMIT = 4000;

const markdownComponents = {
  table: ({ children }) => <div className="coach-table" role="region" aria-label="Coach table, scroll horizontally for more" tabIndex={0}><table>{children}</table></div>,
};

export default function Coach() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [proposing, setProposing] = useState(false);
  const [more, setMore] = useState(true);
  const [routine, setRoutine] = useState("");
  const [keep, setKeep] = useState("");
  const proposalRequest = useRef(null);
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
    client.get("/plans/proposals", { signal: controller.signal }).then(r => setProposals(r.data)).catch(() => {});
    client
      .get("/chat/", { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        setMore(r.data.length === 50);
        setMessages(
          r.data.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
            persisted: true,
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
            setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, id: chunk.id, persisted: true } : m.id === userMsg.id ? { ...m, id: chunk.user_id, persisted: true } : m));
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
        setInput(text);
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, incomplete: true } : m));
        setMessages((prev) => prev.filter((message) =>
          message.id !== assistantMsg.id || message.content
        ));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.message || "Something went wrong");
      setInput(text);
      setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, incomplete: true } : m));
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

  async function earlier() {
    try {
      followMessagesRef.current = false;
      const container = bottomRef.current?.parentElement;
      const height = container?.scrollHeight || 0;
      const { data } = await client.get("/chat/", { params: { before: messages.find(m => m.persisted)?.id } });
      setMessages(prev => [...data.map(m => ({ ...m, persisted: true })), ...prev]); setMore(data.length === 50);
      requestAnimationFrame(() => { if (container) container.scrollTop += container.scrollHeight - height; });
    } catch (e) { setError(apiError(e)); }
  }
  async function propose(messageId) {
    if (proposing) return;
    setProposing(true); setError("");
    try {
      let active = null;
      try { active = (await client.get("/plans/current")).data; } catch (e) { if (e.response?.status !== 404) throw e; }
      const content = { base_plan_id: active?.id || null, source_message_ids: messageId ? [messageId] : [], instructions: routine, keep_exercises: keep.split(",").map(v => v.trim()).filter(Boolean) };
      const hash = JSON.stringify(content);
      if (proposalRequest.current?.hash !== hash) proposalRequest.current = { hash, id: crypto.randomUUID() };
      const { data } = await client.post("/plans/proposals", { ...content, request_id: proposalRequest.current.id });
      navigate(`/plans/proposals/${data.id}`);
    } catch (e) { setError(apiError(e)); } finally { setProposing(false); }
  }

  // Return focus to the composer once a reply finishes. The textarea is disabled while
  // streaming, so focusing it in handleSend's finally block can run too early.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !streaming) inputRef.current?.focus();
    wasStreaming.current = streaming;
  }, [streaming]);

  // Grow the composer with its content, up to the CSS max-height.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [input]);

  /** Enter sends on keyboard devices; Shift+Enter (and Enter on touch screens) adds a line. */
  function handleComposerKey(event) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const openDrafts = proposals.filter(p => p.status !== "applied").slice(0, 3);

  return (
    <Layout contentClassName="coach">
      <PageHeading eyebrow="A little guidance goes a long way" title="AI Coach" description="Talk through your training, technique and recovery." />
      <div className="coach-grid">
        <section className="coach-chat" aria-label="Chat">
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
            className="coach-log"
          >
            {more && messages.length > 0 && <button type="button" className="btn btn--quiet btn--sm coach-earlier" disabled={streaming} onClick={earlier}>Load earlier messages</button>}
            {loading ? (
              <div className="coach-placeholder"><IconLoader2 className="spinner-icon" size={28} aria-hidden="true" /></div>
            ) : error && messages.length === 0 ? (
              <div className="coach-placeholder"><p role="alert" className="coach-load-error">{error}</p></div>
            ) : messages.length === 0 ? (
              /* Empty State */
              <div className="coach-placeholder coach-empty">
                <span className="coach-mark coach-mark--lg" aria-hidden="true"><span className="bar" /></span>
                <p>Ask your AI coach about exercises, form tips, recovery, or anything training-related.</p>
              </div>
            ) : (
              /* Rendered Messages */
              messages.map((msg) => (
                <div key={msg.id} className={`coach-message coach-message--${msg.role === "user" ? "user" : "coach"}`}>
                  {msg.role === "user"
                    ? <span className="coach-avatar" aria-hidden="true"><IconUser size={15} stroke={2} /></span>
                    : <span className="coach-mark" aria-hidden="true"><span className="bar" /></span>}
                  {/* Message Bubble (Markdown formatted for coach, raw for user) */}
                  <div className={`coach-bubble${msg.role === "user" ? "" : " markdown-body"}`}>
                    {msg.role === "user" ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>}
                    {msg.incomplete && <p className="coach-incomplete">Incomplete response — retry your message.</p>}
                    {msg.role === "assistant" && streaming && msg === messages[messages.length - 1] && <span className="coach-caret" aria-hidden="true" />}
                    {msg.role === "assistant" && msg.persisted && <button type="button" className="btn btn--secondary btn--sm coach-to-plan" disabled={proposing || streaming} onClick={() => propose(msg.id)}><IconFileText size={16} stroke={1.75} aria-hidden="true" />Turn this into a plan</button>}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error notification banner */}
          {error && messages.length > 0 && <Notice tone="error" className="coach-error"><p role="alert">{error}</p></Notice>}

          <p className="sr-only" role="status">
            {loading ? "Loading chat history" : streaming ? "Your coach is replying" : "Coach ready"}
          </p>

          {/* Message Input Form */}
          <form onSubmit={handleSend} className="coach-composer">
            <textarea
              ref={inputRef}
              aria-label="Message your coach"
              aria-describedby="coach-composer-hint"
              rows={1}
              maxLength={MESSAGE_LIMIT}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKey}
              placeholder={loading ? "Loading chat history…" : streaming ? "Waiting for response…" : "Ask your coach…"}
              disabled={loading || streaming}
              className="coach-input"
              id="coach-input"
              autoComplete="off"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={loading || streaming || !input.trim()}
              className="btn btn--primary coach-send"
              id="coach-send-btn"
            >
              {streaming ? <IconLoader2 size={18} className="spinner-icon" aria-hidden="true" /> : <IconSend2 size={18} aria-hidden="true" />}
            </button>
          </form>
          <p id="coach-composer-hint" className="coach-hint">
            <span className="coach-hint-keys">Enter to send · Shift+Enter for a new line</span>
            {input.length > MESSAGE_LIMIT - 500 && <span className="num">{input.length}/{MESSAGE_LIMIT}</span>}
          </p>
        </section>

        <aside className="coach-side" aria-label="Plan tools">
          <details className="disclosure coach-routine">
            <summary><IconSparkles size={20} stroke={1.75} className="text-accent-text" aria-hidden="true" />Improve my existing routine</summary>
            <div className="disclosure-body">
              <label className="field">
                <span className="field-label">Paste your routine or describe improvements</span>
                <textarea className="textarea" value={routine} onChange={e => setRoutine(e.target.value)} maxLength={6000} />
              </label>
              <label className="field">
                <span className="field-label">Exercises to keep (comma separated)</span>
                <input className="input" value={keep} onChange={e => setKeep(e.target.value)} />
              </label>
              <button type="button" className="btn btn--primary" disabled={proposing || !routine.trim()} onClick={() => propose()}>{proposing ? <><span className="spinner" aria-hidden="true" />Preparing draft…</> : "Create plan draft"}</button>
            </div>
          </details>
          {openDrafts.length > 0 && <ul className="ledger coach-drafts">{openDrafts.map(p => <li key={p.id}>
            <Link className="ledger-row" to={`/plans/proposals/${p.id}`}>
              <IconFileText size={20} stroke={1.75} className="text-accent-text" aria-hidden="true" />
              <span className="ledger-main"><span className="ledger-title">Plan draft · {p.plan_data?.title || p.status} · Review</span></span>
              <IconChevronRight size={18} stroke={1.75} className="ledger-end" aria-hidden="true" />
            </Link>
          </li>)}</ul>}
          <p className="coach-note">Chat advice becomes your training plan only when you review and save a plan draft. <Link className="link" to="/plans/history">Plan history</Link></p>
        </aside>
      </div>
    </Layout>
  );
}
