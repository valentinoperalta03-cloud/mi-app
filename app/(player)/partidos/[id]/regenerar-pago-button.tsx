"use client";

import { useState, useTransition } from "react";
import { nativeOpenUrl } from "@/lib/native-open";
import { Button } from "@/components/ui/button";
import { regenerarLinkPago } from "./actions";

type Props = {
  matchId: string;
  paymentId: string;
  label: string;
};

export default function RegenerarPagoButton({ matchId, paymentId, label }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        variant="primary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          const formData = new FormData();
          formData.set("match_id", matchId);
          formData.set("payment_id", paymentId);
          startTransition(async () => {
            const result = await regenerarLinkPago(formData);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            await nativeOpenUrl(result.mpUrl);
          });
        }}
      >
        {isPending ? "Generando..." : label}
      </Button>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
