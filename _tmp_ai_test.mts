import { invokeLLM } from "./server/_core/llm.ts";
const t0 = Date.now();
const res = await invokeLLM({
  messages: [
    { role: "system", content: "You are a concise B2B sales analyst. Answer in 2-3 sentences." },
    { role: "user", content: "Account: Vertex Cloud Systems, Cloud Infrastructure, 1500 employees, intent score 95. Give the single best next action for the rep." },
  ],
});
const text = res.choices?.[0]?.message?.content ?? "(no content)";
console.log("=== AI OUTPUT (local Ollama qwen3.5:9b, free, no paid key) ===");
console.log(typeof text === "string" ? text.trim() : JSON.stringify(text));
console.log(`[generated in ${((Date.now()-t0)/1000).toFixed(1)}s]`);
