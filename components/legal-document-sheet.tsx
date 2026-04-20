"use client";

export type LegalDocKind = "terms" | "privacy";

export function LegalDocumentSheet({
  open: _open,
  onClose: _onClose,
}: {
  open: LegalDocKind | null;
  onClose: () => void;
}) {
  return null;
}
