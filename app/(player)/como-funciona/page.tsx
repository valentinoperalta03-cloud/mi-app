import type { Metadata } from "next";
import ComoFuncionaContent from "./page-content";

export const metadata: Metadata = {
  title: "Cómo funciona | Padelibre",
  description: "Conocé cómo funciona Padelibre para jugadores y clubes.",
};

export default function ComoFuncionaPage() {
  return <ComoFuncionaContent />;
}
