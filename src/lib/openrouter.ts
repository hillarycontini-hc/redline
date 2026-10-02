import type { CallModel, ChatMessage } from "./analysis/analyze.ts";

/**
 * The only path to the model. OpenRouter over fetch; never a provider SDK.
 * Key and model id come from the environment. The model is never hardcoded.
 */
export function openRouterCaller(): CallModel {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey) throw new ConfigError("OPENROUTER_API_KEY is not set");
  if (!model) throw new ConfigError("OPENROUTER_MODEL is not set");

  return async (messages: ChatMessage[]) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/hillarycontini-hc/redline",
        "X-Title": "Redline",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        // Pin the provider so the same text gets the same reading. Fallbacks
        // would quietly swap in a host that ignores the parameters below.
        provider: {
          order: ["fireworks"],
          allow_fallbacks: false,
          require_parameters: true,
        },
        reasoning: { effort: "low" },
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenRouter response had no message content");
    }
    return content;
  };
}

export class ConfigError extends Error {}
