import { IAnalysisRequest, IAnalysisResult } from "./types";
import { FeatureRegistry } from "./features";
import { formatConversation } from "./formatter";
import { buildDynamicSchema } from "./schemaBuilder";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function analyzeConversation(req: IAnalysisRequest): Promise<IAnalysisResult> {
  const keys =
    req.requested === "all"
      ? (Object.keys(FeatureRegistry) as string[])
      : (req.requested as string[]);

  const schema = buildDynamicSchema(keys, req.includeNextAction ?? false);

  const systemPrompt = `
Você é um Analista Semântico + Temporal especializado em Vendas.
Extraia cada feature solicitada e retorne APENAS o JSON conforme o schema.

Objetivo da conversa: ${req.goal ?? "não informado"}
Produto/serviço: ${req.productOrService ?? "não informado"}

Para features temporais, use os intervalos [MM:SS].
Retorne APENAS o JSON final, nada fora do formato.
  `;

  const conversationText = formatConversation(req.messages);

  const userPrompt = `
Analise a transcrição abaixo e extraia as features solicitadas.
Retorne SOMENTE o JSON válido conforme o schema.

--- TRANSCRIÇÃO ---
${conversationText}
--- FIM ---
  `;

  const payload = {
    model: process.env.OPENROUTER_MODEL ?? "gpt-4.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema
    }
  };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://your-domain.com",
    "X-Title": "Semantic Temporal CRM Analyzer"
  };

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${errText}`);
      }

      const data = await res.json();

      const text =
        data.choices?.[0]?.message?.content ??
        (() => {
          throw new Error("Resposta inesperada da OpenRouter — sem conteúdo.");
        })();

      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      const backoff = Math.pow(2, attempt) * 800;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  throw new Error(`Falha ao analisar a conversa: ${lastError?.message}`);
  } 
