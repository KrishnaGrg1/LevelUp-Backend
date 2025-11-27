import OpenAI from "openai";
import env from "../config";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENAI_API_KEY as string,
  // Optional headers for OpenRouter rankings
  // defaultHeaders: {
  //   "HTTP-Referer": "<YOUR_SITE_URL>",
  //   "X-Title": "<YOUR_SITE_NAME>",
  // },
});

export default async function OpenAIChat({ prompt }: { prompt: string }) {
  try {
    const debug = (env.NODE_ENV as string) !== 'production';
    const started = Date.now();
    if (debug) {
      console.debug(
        `[AI] chat.completions.create → model=${env.MODEL_NAME} promptChars=${prompt?.length ?? 0}`
      );
    }
    const completion = await openai.chat.completions.create({
      model: env.MODEL_NAME as string,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const duration = Date.now() - started;
    const msg = completion.choices?.[0]?.message;
    if (debug) {
      const contentPreview = (msg?.content ?? '').slice(0, 200).replace(/\s+/g, ' ');
      const usage = (completion as any).usage || {};
      console.debug(
        `[AI] response ok in ${duration}ms chars=${(msg?.content ?? '').length} preview="${contentPreview}" tokens=${usage.total_tokens ?? 'n/a'}`
      );
    }
    return msg;
  } catch (error) {
    console.error("[AI] OpenAIChat error:", error);
    throw error;
  }
}

// Example usage