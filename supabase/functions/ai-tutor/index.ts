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

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) {
    return jsonResponse(
      { error: "AI not configured", configured: false },
      503,
    );
  }

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

  let conversationId = body.conversation_id;

  if (conversationId) {
    const { data: conv, error: convError } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (convError || !conv) {
      return jsonResponse({ error: "Conversation not found" }, 404);
    }
  } else {
    const title = body.message.trim().slice(0, 80) || "New chat";
    const { data: newConv, error: createError } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();

    if (createError || !newConv) {
      console.error("Create conversation failed:", createError);
      return jsonResponse({ error: "Could not create conversation" }, 500);
    }
    conversationId = newConv.id;
  }

  const { error: userMsgError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: body.message.trim(),
  });

  if (userMsgError) {
    console.error("Save user message failed:", userMsgError);
    return jsonResponse({ error: "Could not save message" }, 500);
  }

  const { data: history, error: historyError } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (historyError) {
    console.error("Load history failed:", historyError);
    return jsonResponse({ error: "Could not load conversation history" }, 500);
  }

  let systemContent = SYSTEM_PROMPT_BASE;
  if (body.education_level) {
    systemContent += `\n\nStudent education level: ${body.education_level}`;
  }
  if (body.context_note) {
    systemContent += `\n\nAdditional context from the student: ${body.context_note}`;
  }

  const chatMessages = [
    { role: "system", content: systemContent },
    ...(history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.7,
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error("OpenAI error:", openAiRes.status, errText);
    return jsonResponse({ error: "AI provider error" }, 502);
  }

  const completion = await openAiRes.json();
  const assistantContent =
    completion.choices?.[0]?.message?.content?.trim() ??
    "I could not generate a response. Please try again.";

  const { error: assistantMsgError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "assistant",
    content: assistantContent,
  });

  if (assistantMsgError) {
    console.error("Save assistant message failed:", assistantMsgError);
    return jsonResponse({ error: "Could not save assistant reply" }, 500);
  }

  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return jsonResponse({
    configured: true,
    conversation_id: conversationId,
    reply: assistantContent,
  });
});
