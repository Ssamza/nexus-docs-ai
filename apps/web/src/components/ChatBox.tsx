"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { t } from "@/lib/t";
import { getAnonId } from "@/lib/anonId";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function LimitModal({ isSignedIn, onClose }: { isSignedIn: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-zinc-100">Límite diario alcanzado</h2>
          <p className="text-sm text-zinc-400">
            {isSignedIn
              ? "Has usado todas tus preguntas de hoy. Actualiza a Premium para preguntas ilimitadas."
              : "Has usado todas tus preguntas de hoy. Crea una cuenta gratis para obtener 25 preguntas diarias."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {isSignedIn ? (
            <a
              href="/pricing"
              className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.3)] transition-all duration-200"
            >
              ✦ Ver planes Premium
            </a>
          ) : (
            <>
              <a
                href="/sign-up"
                className="w-full text-center py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.3)] transition-all duration-200"
              >
                Crear cuenta gratis
              </a>
              <a
                href="/pricing"
                className="w-full text-center py-2.5 rounded-xl text-sm font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                Ver todos los planes
              </a>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full text-center py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatBox() {
  const { getToken, isSignedIn } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const reset = () => {
    setMessages([]);
    setConversationId(null);
  };

  const send = async () => {
    if (!input.trim() || loading) return;

    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isSignedIn) {
        const token = await getToken();
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        headers["x-anon-id"] = getAnonId();
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, conversationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setShowLimitModal(true);
          setMessages((prev) => prev.slice(0, -1)); // remove the user message that didn't go through
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || t.errors.generic },
        ]);
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || t.errors.generic },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t.errors.generic },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {showLimitModal && <LimitModal isSignedIn={!!isSignedIn} onClose={() => setShowLimitModal(false)} />}
    <div className="flex flex-col h-96 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      {messages.length > 0 && (
        <div className="border-b border-zinc-800 px-4 py-2 flex justify-end">
          <button
            onClick={reset}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Nueva conversación
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center mt-8">
            Haz una pregunta sobre tus documentos o sobre la ley colombiana.
          </p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white text-black rounded-br-sm"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-500 pl-3 my-2 text-zinc-400">{children}</blockquote>,
                      code: ({ children }) => <code className="bg-zinc-700 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-zinc-700 rounded p-3 my-2 text-xs font-mono overflow-x-auto">{children}</pre>,
                      table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                      th: ({ children }) => <th className="border border-zinc-600 px-2 py-1 bg-zinc-700 font-semibold text-left">{children}</th>,
                      td: ({ children }) => <td className="border border-zinc-600 px-2 py-1">{children}</td>,
                      hr: () => <hr className="border-zinc-600 my-3" />,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">{children}</a>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.dashboard.query.placeholder}
          className="flex-1 bg-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </div>
    </div>
    </>
  );
}
