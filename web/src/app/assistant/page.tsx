import { connection } from "next/server";
import { AgentChatClient } from "@/components/agent/AgentChatClient";
import { llmSummary } from "@/lib/agent/llm";

export default async function AssistantPage() {
  await connection(); // configuration lue à l'exécution, pas au build
  const s = llmSummary();
  const provider = s.fallback ? `${s.label} · ${s.fallback}` : s.label;
  return <AgentChatClient model={s.model} provider={provider} hasKey={s.hasKey} />;
}
