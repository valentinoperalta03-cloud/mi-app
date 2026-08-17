"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import type { CreatePostState } from "./post-types";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createPostAction(
  _prev: CreatePostState,
  formData: FormData
): Promise<CreatePostState> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Iniciá sesión para publicar." };
  }

  const content = getText(formData, "content");
  if (!content) {
    return { ok: false, message: "Escribí algo antes de publicar." };
  }
  if (content.length > 4000) {
    return { ok: false, message: "El texto es demasiado largo." };
  }

  const postType = String(formData.get("post_type") ?? "text").trim() as "text" | "photo";
  if (!["text", "photo"].includes(postType)) {
    return { ok: false, message: "Tipo de publicación inválido." };
  }

  // NOTE: Create a 'post-images' bucket in Supabase Storage
  // with public access enabled before testing photo posts.
  let imageUrl: string | null = null;
  if (postType === "photo") {
    const imageFile = formData.get("image") as File | null;
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop() ?? "jpg";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, imageFile, { upsert: false });
      if (!uploadError && uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("post-images").getPublicUrl(uploadData.path);
        imageUrl = publicUrl;
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from(DB_TABLES.posts)
    .insert({
      user_id: user.id,
      content,
      match_id: null,
      post_type: postType,
      image_url: imageUrl,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!inserted?.id) {
    return { ok: false, message: "No se pudo confirmar la publicación. Intentá de nuevo." };
  }

  revalidatePath("/comunidad/para-ti", "page");
  return { ok: true, message: "Publicación creada." };
}
