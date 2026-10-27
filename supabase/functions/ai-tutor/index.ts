import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT_BASE = `You are StudySphere's educational AI tutor. Your goals:
- Help the student understand concepts deeply, not just memorize answers.
- Adapt explanations to the student's education level when provided.
- Do not invent or quote content from documents the student has not shared in this chat.
- Encourage questions, practice, and checking official sources.
- Clearly label your replies as AI-generated assistance that may contain errors; the student should verify important facts.`;

const RATE_LIMIT_PER_HOUR = 60;

interface TutorRequestBody {
  conversation_id?: string;
  message: string;
  education_level?: string;
  context_note?: string;
  history?: Array<{ role: string; content: string }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Prefer free Groq; fall back to OpenAI if configured
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const apiKey = groqKey || openAiKey;
  if (!apiKey) {
    return jsonResponse(
      { error: "AI not configured", configured: false },
      503,
    );
  }

  const useGroq = Boolean(groqKey);
  const endpoint = useGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useGroq
    ? (Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b")
    : (Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: TutorRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.message?.trim()) {
    return jsonResponse({ error: "message is required" }, 400);
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("Rate limit check failed:", countError);
    return jsonResponse({ error: "Could not verify rate limit" }, 500);
  }

  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again later.", limit: RATE_LIMIT_PER_HOUR },
      429,
    );
  }

  let systemContent = SYSTEM_PROMPT_BASE;
  if (body.education_level) {
    systemContent += `\n\nStudent education level: ${body.education_level}`;
  }
  if (body.context_note) {
    systemContent += `\n\nAdditional context from the student: ${body.context_note}`;
  }

  const history = body.history ?? [];
  if (body.conversation_id && history.length === 0) {
    const { data: dbHistory } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", body.conversation_id)
      .order("created_at", { ascending: true })
      .limit(40);
    if (dbHistory) history.push(...dbHistory);
  }

  const chatMessages = [
    { role: "system", content: systemContent },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: body.message.trim() },
  ];

  const aiRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      temperature: 0.7,
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("AI provider error:", aiRes.status, errText);
    return jsonResponse({ error: "AI provider error", detail: errText.slice(0, 200) }, 502);
  }

  const completion = await aiRes.json();
  const assistantContent =
    completion.choices?.[0]?.message?.content?.trim() ??
    "I could not generate a response. Please try again.";

  return jsonResponse({
    configured: true,
    conversation_id: body.conversation_id ?? null,
    reply: assistantContent,
    provider: useGroq ? "groq" : "openai",
  });
});
