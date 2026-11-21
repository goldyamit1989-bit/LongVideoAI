import fs from "fs/promises";

export async function createNarration(text, output) {
  if (!process.env.OPENAI_API_KEY) return false;
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "alloy",
      input: text,
      response_format: "mp3"
    })
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  await fs.writeFile(output, Buffer.from(await r.arrayBuffer()));
  return true;
}
