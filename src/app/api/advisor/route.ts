import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadAnalysis } from "@/lib/data";
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { buildAdvisorContext } from "@/lib/ai/context";
import { ADVISOR_TOOLS, runAdvisorTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const HISTORY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 6;

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}

export async function GET() {
  const auth = await authed();
  if (!auth) return json({ error: "Não autenticado" }, 401);
  const { data } = await auth.supabase
    .from("chat_messages").select("role, content, created_at")
    .order("created_at", { ascending: false }).limit(50);
  return json({ messages: (data ?? []).reverse() });
}

export async function POST(req: Request) {
  const auth = await authed();
  if (!auth) return json({ error: "Não autenticado" }, 401);
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "O consultor de IA ainda não foi configurado (ANTHROPIC_API_KEY ausente no servidor)." }, 503);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Mensagem inválida." }, 400);
  const { supabase, user } = auth;

  // Limite simples de uso: 8 mensagens/minuto e 150/dia por usuário
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: perMin }, { count: perDay }] = await Promise.all([
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", since(60_000)),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", since(86_400_000)),
  ]);
  if ((perMin ?? 0) >= 8 || (perDay ?? 0) >= 150) {
    return json({ error: "Muitas mensagens em pouco tempo. Aguarde um instante e tente novamente." }, 429);
  }

  const { data: historyRows } = await supabase
    .from("chat_messages").select("role, content")
    .order("created_at", { ascending: false }).limit(HISTORY_LIMIT);
  const history = (historyRows ?? []).reverse() as { role: "user" | "assistant"; content: string }[];

  await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: parsed.data.message });

  const { data, analysis, today } = await loadAnalysis();
  const context = buildAdvisorContext(data, analysis, today);

  // Histórico precisa alternar papéis e começar pelo usuário
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const last = messages[messages.length - 1];
    if (!last && m.role !== "user") continue;
    if (last && last.role === m.role) {
      last.content = `${last.content as string}\n\n${m.content}`;
    } else messages.push({ role: m.role, content: m.content });
  }
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop(); // pergunta sem resposta anterior
  messages.push({ role: "user", content: parsed.data.message });

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      const write = (t: string) => { answer += t; controller.enqueue(encoder.encode(t)); };
      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [
              { type: "text", text: ADVISOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              { type: "text", text: context },
            ],
            tools: ADVISOR_TOOLS,
            messages,
          });
          s.on("text", (delta) => write(delta));
          const message = await s.finalMessage();

          if (message.stop_reason === "refusal") {
            if (!answer) write("Não consigo ajudar com esse pedido. Posso apoiar em outras questões sobre suas finanças pessoais.");
            break;
          }
          const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;
          if (round === MAX_TOOL_ROUNDS) break;

          messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
            try {
              return { type: "tool_result", tool_use_id: tu.id, content: runAdvisorTool(tu.name, tu.input, data, analysis) };
            } catch (err) {
              const msg = err instanceof z.ZodError ? `Entrada inválida: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : (err as Error).message;
              return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: msg };
            }
          });
          messages.push({ role: "user", content: results });
          if (answer && !answer.endsWith("\n")) write("\n\n");
        }
      } catch (err) {
        console.error("advisor error", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        const msg = err instanceof Anthropic.RateLimitError
          ? "O consultor está com alta demanda. Tente novamente em instantes."
          : "Não foi possível concluir a análise agora. Tente novamente.";
        write(answer ? `\n\n_${msg}_` : msg);
      } finally {
        if (answer.trim()) {
          await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: answer });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
