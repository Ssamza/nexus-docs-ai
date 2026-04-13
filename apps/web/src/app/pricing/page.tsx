"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

const CHECK = (
  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const DASH = <span className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center text-zinc-600 text-lg leading-none">–</span>;

const FAQS = [
  {
    q: "¿Puedo usar la herramienta sin crear una cuenta?",
    a: "Sí. El plan Gratuito no requiere registro. Puedes hacer hasta 10 preguntas por día y subir 1 documento por sesión, sin necesidad de crear una cuenta.",
  },
  {
    q: "¿Mis documentos están seguros?",
    a: "Sí. Los documentos personales son accesibles únicamente con tu identidad (cuenta o ID de sesión). Nunca se comparten con otros usuarios ni se usan para entrenar modelos.",
  },
  {
    q: "¿Qué significa OCR para documentos escaneados?",
    a: "Algunos PDFs son imágenes (por ejemplo, documentos escaneados o ciertos formularios de la DIAN). El OCR permite extraer el texto de esas imágenes para que puedas hacer preguntas sobre ellos.",
  },
  {
    q: "¿Puedo cancelar el plan Premium en cualquier momento?",
    a: "Sí. Puedes cancelar cuando quieras. No hay contratos ni penalidades. Al cancelar, tu cuenta pasa automáticamente al plan Básico.",
  },
  {
    q: "¿La base legal colombiana está actualizada?",
    a: "La base incluye el Código Sustantivo del Trabajo, el Estatuto Tributario, la Ley 2381 de 2024 (reforma pensional), la Ley 2277 de 2022 (reforma tributaria) y más. Se actualiza periódicamente.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { isSignedIn } = useAuth();

  const premiumPrice = annual ? "1.99" : "2.99";
  const annualTotal = (1.99 * 12).toFixed(2);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold">NexusDocs AI</Link>
        <Link
          href="/dashboard"
          className="text-sm px-4 py-2 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors"
        >
          {isSignedIn ? "Ir al dashboard" : "Iniciar sesión"}
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 space-y-16">

        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-amber-400 tracking-widest uppercase">Planes</p>
          <h1 className="text-4xl font-bold">Simple. Transparente. Sin sorpresas.</h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Accede a la base legal colombiana gratis. Sube tus documentos y obtén respuestas precisas sobre tus derechos laborales y tributarios.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm ${!annual ? "text-zinc-100" : "text-zinc-500"}`}>Mensual</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-amber-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${annual ? "translate-x-5" : ""}`} />
            </button>
            <span className={`text-sm ${annual ? "text-zinc-100" : "text-zinc-500"}`}>
              Anual <span className="text-emerald-400 font-medium">–33%</span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Gratis */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Gratis</p>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-zinc-400">Sin cuenta. Siempre gratis.</p>
            </div>

            <ul className="space-y-3 text-sm text-zinc-300 flex-1">
              {[
                [true,  "Base legal colombiana completa"],
                [true,  "10 preguntas por día"],
                [true,  "1 documento por sesión"],
                [false, "Historial de conversaciones"],
                [false, "Múltiples documentos"],
                [false, "OCR para documentos escaneados"],
                [false, "Soporte prioritario"],
              ].map(([included, label], i) => (
                <li key={i} className="flex items-start gap-2">
                  {included ? CHECK : DASH}
                  <span className={included ? "" : "text-zinc-500"}>{label as string}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="block text-center py-2.5 rounded-xl border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Registrado */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Básico</p>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-zinc-400">Cuenta gratis. Sin tarjeta.</p>
            </div>

            <ul className="space-y-3 text-sm text-zinc-300 flex-1">
              {[
                [true,  "Todo del plan Gratuito"],
                [true,  "25 preguntas por día"],
                [true,  "5 documentos personales"],
                [true,  "Historial de conversaciones"],
                [false, "Documentos ilimitados"],
                [false, "OCR para documentos escaneados"],
                [false, "Soporte prioritario"],
              ].map(([included, label], i) => (
                <li key={i} className="flex items-start gap-2">
                  {included ? CHECK : DASH}
                  <span className={included ? "" : "text-zinc-500"}>{label as string}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="block text-center py-2.5 rounded-xl border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </div>

          {/* Premium */}
          <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 p-6 flex flex-col gap-6 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-widest">Premium</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Más popular
                </span>
              </div>
              <div className="flex items-end gap-1">
                <p className="text-3xl font-bold">${premiumPrice}</p>
                <p className="text-zinc-400 text-sm mb-1">/mes</p>
              </div>
              <p className="text-sm text-zinc-400">
                {annual ? `$${annualTotal} facturado anualmente` : "Facturado mensualmente"}
              </p>
            </div>

            <ul className="space-y-3 text-sm text-zinc-300 flex-1">
              {[
                [true, "Todo del plan Básico"],
                [true, "Preguntas ilimitadas"],
                [true, "Documentos ilimitados"],
                [true, "OCR para documentos escaneados"],
                [true, "Historial completo"],
                [true, "Soporte prioritario"],
                [true, "Acceso anticipado a nuevas funciones"],
              ].map(([, label], i) => (
                <li key={i} className="flex items-start gap-2">
                  {CHECK}
                  <span>{label as string}</span>
                </li>
              ))}
            </ul>

            <button className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_28px_rgba(251,146,60,0.5)] transition-all duration-200">
              ✦ Hazte Premium
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-center mb-8">Preguntas frecuentes</h2>
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-zinc-800/50 transition-colors"
              >
                <span>{faq.q}</span>
                <svg
                  className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 py-8">
          <p className="text-zinc-400 text-sm">¿Tienes dudas? Prueba gratis sin registrarte.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Empezar ahora →
          </Link>
        </div>
      </main>
    </div>
  );
}
