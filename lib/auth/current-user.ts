import "server-only";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * Usuario autenticado del request actual (auth.getUser() valida contra Supabase Auth).
 * React.cache solo deduplica dentro del mismo render de Server Components; en Server
 * Actions y Route Handlers se ejecuta en cada llamada. No convertir a unstable_cache
 * ni "use cache": eso compartiría datos entre requests.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
