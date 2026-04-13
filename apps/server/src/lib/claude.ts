import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const SYSTEM_PROMPT = `Eres un asistente especializado en derecho laboral, tributario y seguridad social colombiana.
Tu función es responder preguntas con base en los fragmentos de documentos legales y personales que se te proveen.

Reglas:
- Responde siempre en español, de forma clara y sin tecnicismos innecesarios.
- Basa tus respuestas ÚNICAMENTE en el contexto provisto. No inventes normas, artículos ni cifras.
- Si la respuesta no está en el contexto, dilo explícitamente: "Esta información no está en los documentos disponibles."
- Cuando cites una norma, menciona su nombre (ej. "Artículo 65 del CST" o "Ley 2381 de 2024").
- Si el usuario sube un documento personal (contrato, colilla de pago), analízalo junto con la base legal.
- No des consejos que requieran la firma de un abogado. Si el caso es complejo, recomienda consultar a un profesional.`;

export type ConversationMessage = { role: "user" | "assistant"; content: string };

// OCR fallback for scanned PDFs — Claude reads the PDF natively using Vision
// Uses Haiku (cheapest model) since the task is pure text extraction
export async function ocrPdf(buffer: Buffer): Promise<string> {
  try {
    const message = await (anthropic.beta.messages as any).create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      betas: ["pdfs-2024-09-25"],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Extrae todo el texto visible de este documento. Devuelve únicamente el texto extraído, sin comentarios adicionales.",
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    return block.type === "text" ? block.text.trim() : "";
  } catch {
    return "";
  }
}

export async function generateAnswer(
  query: string,
  chunks: string[],
  history: ConversationMessage[] = []
): Promise<string> {
  const context = chunks.join("\n\n---\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      // XML delimiters isolate document context from user input, mitigating prompt injection
      content: `<documents>\n${context}\n</documents>\n\nPregunta del usuario: ${query}`,
    },
  ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // Cache the system prompt — won't activate until it reaches 2048 tokens,
    // but adding it now is free and future-proofs expansion of the prompt.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
    // Automatic caching: caches all content up to the last message on each turn.
    // Multi-turn conversations benefit the most — history is read from cache
    // at 10% of the normal input token cost.
    cache_control: { type: "ephemeral" },
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
