import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Cancela reservas en estado "pendiente" creadas hace más de 15 minutos
 * (libera la cancha). Invocar cada 15 minutos vía pg_cron + pg_net.
 *
 * Deploy: supabase functions deploy expire-pending-reservas
 *
 * Cron (SQL en el SQL Editor; habilitá extensiones pg_cron y pg_net).
 * Guardá la URL del proyecto y una key en Vault (ver docs de Supabase Scheduling).
 *
 * Ejemplo SQL: cron.schedule con net.http_post hacia
 * /functions/v1/expire-pending-reservas (cada 15 min; ver docs Supabase Scheduling).
 *
 * Si tu columna de creación no se llama created_at, cambiá CREATED_AT_COLUMN abajo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TABLE = "reservas";
const STALE_MINUTES = 15;
/** Columna timestamp de creación (por defecto en tablas creadas con Supabase). */
const CREATED_AT_COLUMN = "created_at";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(
    Date.now() - STALE_MINUTES * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .update({ estado: "cancelado" })
    .eq("estado", "pendiente")
    .lt(CREATED_AT_COLUMN, cutoff)
    .select("id");

  if (error) {
    console.error("expire-pending-reservas:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      cancelled_count: data?.length ?? 0,
      ids: data?.map((row) => row.id) ?? [],
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
