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
    const completion = await openai.chat.completions.create({
      model: "minimax/minimax-m2:free",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Log before returning
    // console.log(completion.choices[0].message);

    // Return the message content directly
    return completion.choices[0].message;
  } catch (error) {
    console.error("OpenAIChat error:", error);
    throw error;
  }
}

// Example usage

