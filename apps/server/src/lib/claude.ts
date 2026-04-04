import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un asistente especializado en derecho laboral, tributario y seguridad social colombiana.
Tu función es responder preguntas con base en los fragmentos de documentos legales y personales que se te proveen.

Reglas:
- Responde siempre en español, de forma clara y sin tecnicismos innecesarios.
- Basa tus respuestas ÚNICAMENTE en el contexto provisto. No inventes normas, artículos ni cifras.
- Si la respuesta no está en el contexto, dilo explícitamente: "Esta información no está en los documentos disponibles."
- Cuando cites una norma, menciona su nombre (ej. "Artículo 65 del CST" o "Ley 2381 de 2024").
- Si el usuario sube un documento personal (contrato, colilla de pago), analízalo junto con la base legal.
- No des consejos que requieran la firma de un abogado. Si el caso es complejo, recomienda consultar a un profesional.`;

export type ConversationMessage = { role: "user" | "assistant"; content: string };

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
      content: `Contexto de documentos relevantes:\n${context}\n\nPregunta: ${query}`,
    },
  ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
