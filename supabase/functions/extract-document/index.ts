import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "learning-resources";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExtractRequestBody {
  resource_id: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isTextExtractable(fileName: string, fileType: string | null): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return true;
  if (!fileType) return false;
  const t = fileType.toLowerCase();
  return t === "text/plain" || t === "text/markdown" || t.includes("text/plain");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
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

  let body: ExtractRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.resource_id) {
    return jsonResponse({ error: "resource_id is required" }, 400);
  }

  const { data: resource, error: resourceError } = await supabase
    .from("learning_resources")
    .select("id, user_id, file_name, file_path, file_type, extracted_text")
    .eq("id", body.resource_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (resourceError) {
    console.error("Load resource failed:", resourceError);
    return jsonResponse({ error: "Could not load resource" }, 500);
  }

  if (!resource) {
    return jsonResponse({ error: "Resource not found" }, 404);
  }

  if (!isTextExtractable(resource.file_name, resource.file_type)) {
    return jsonResponse({
      extracted: false,
      message:
        "Text extraction is not supported for this file type yet. Plain text (.txt), Markdown (.md), and text/plain uploads can be extracted.",
      file_type: resource.file_type,
      file_name: resource.file_name,
    });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(resource.file_path);

  if (downloadError || !fileData) {
    console.error("Download failed:", downloadError);
    return jsonResponse({ error: "Could not download file from storage" }, 500);
  }

  const text = await fileData.text();

  const { error: updateError } = await supabase
    .from("learning_resources")
    .update({ extracted_text: text })
    .eq("id", resource.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Update extracted_text failed:", updateError);
    return jsonResponse({ error: "Could not save extracted text" }, 500);
  }

  return jsonResponse({
    extracted: true,
    resource_id: resource.id,
    character_count: text.length,
    extracted_text: text,
  });
});
