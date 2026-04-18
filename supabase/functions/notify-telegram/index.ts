const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  message?: string;
  snapshot?: string | null; // dataURL (jpeg)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Telegram not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets in Lovable Cloud.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const message = body.message?.trim() || "🚨 SARA alert (no body provided)";

    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    let result: unknown;
    if (body.snapshot && body.snapshot.startsWith("data:image/")) {
      // Convert dataURL to Blob and use sendPhoto with caption
      const [, base64] = body.snapshot.split(",");
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: "image/jpeg" });

      const form = new FormData();
      form.append("chat_id", TELEGRAM_CHAT_ID);
      form.append("caption", message);
      form.append("photo", blob, "snapshot.jpg");

      const resp = await fetch(`${baseUrl}/sendPhoto`, { method: "POST", body: form });
      result = await resp.json();
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: `Telegram sendPhoto failed`, result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const resp = await fetch(`${baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
      });
      result = await resp.json();
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: `Telegram sendMessage failed`, result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
