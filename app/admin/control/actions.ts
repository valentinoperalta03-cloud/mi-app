"use server";

import { cookies } from "next/headers";

export type UnlockControlState = {
  success: boolean;
  message: string;
};

const initialState: UnlockControlState = { success: false, message: "" };
const ADMIN_CONTROL_PASSWORD = "1234";

export async function unlockControlPanelAction(
  prevState: UnlockControlState = initialState,
  formData: FormData
): Promise<UnlockControlState> {
  void prevState;
  const password = String(formData.get("password") ?? "").trim();

  if (!password) {
    return { success: false, message: "Ingresa la contrasena de administrador." };
  }

  if (password !== ADMIN_CONTROL_PASSWORD) {
    return { success: false, message: "Contrasena incorrecta." };
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_control_access", "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return { success: true, message: "" };
}
