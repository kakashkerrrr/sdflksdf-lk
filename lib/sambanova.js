const BASE_URL = "https://api.sambanova.ai/v1";

export async function callMetaChat({ messages, temperature = 0.1, top_p = 0.1 }) {
  const apiKey = process.env.SAMBANOVA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SAMBANOVA_API_KEY is not set. Put your Meta (SambaNova) key into environment, not into the code."
    );
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Meta-Llama-3.1-8B-Instruct",
      messages,
      temperature,
      top_p,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SambaNova API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content || "(Пустой ответ от модели Meta)";

  return { data, content };
}
