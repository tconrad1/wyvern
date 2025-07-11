// llm.ts
import { ChatCompletionMessageParam  } from 'openai/resources/chat/completions';

export async function callOpenRouterModel(
  model: string,
  messages: ChatCompletionMessageParam[],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost', // Change to your domain if deployed
      'X-Title': 'AI-DM-Tool',
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
