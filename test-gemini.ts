import "dotenv/config";

async function test() {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Return only valid JSON." },
          { role: "user", content: 'Return: {"status":"ok"}' },
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });
    console.log("Status:", resp.status);
    const d = await resp.json();
    console.log("Body:", JSON.stringify(d).substring(0, 500));
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }
}

test();
