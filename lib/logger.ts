/**
 * Logger estructurado mínimo (JSON en producción, pretty en desarrollo).
 * Sin dependencias externas.
 */

export type LogContext = {
  event: string;
  requestId?: string;
  matchId?: string;
  paymentId?: string;
  userId?: string;
  mpPaymentId?: string;
  [key: string]: unknown;
};

const isDev = process.env.NODE_ENV === "development";

function baseRecord(ctx: LogContext) {
  return {
    event: ctx.event,
    ts: new Date().toISOString(),
    requestId: ctx.requestId,
    matchId: ctx.matchId,
    paymentId: ctx.paymentId,
    userId: ctx.userId,
    mpPaymentId: ctx.mpPaymentId,
    ...Object.fromEntries(
      Object.entries(ctx).filter(
        ([k]) => !["event", "requestId", "matchId", "paymentId", "userId", "mpPaymentId"].includes(k)
      )
    ),
  };
}

function formatLine(level: "info" | "warn" | "error", ctx: LogContext & { level: string; msg?: string }) {
  const { msg, level: _ignoreLevel, ...data } = ctx;
  void _ignoreLevel;
  const record = { level, ...baseRecord(data as LogContext), ...(msg != null ? { msg: String(msg) } : {}) };
  if (isDev) {
    return JSON.stringify(record, null, 2);
  }
  return JSON.stringify(record);
}

export function withCorrelation(base: Partial<LogContext>): LogContext {
  return {
    event: base.event ?? "app",
    ...base,
  } as LogContext;
}

export const log = {
  info(ctx: LogContext & { msg?: string }) {
    console.log(formatLine("info", { level: "info", ...ctx }));
  },
  warn(ctx: LogContext & { msg?: string }) {
    console.warn(formatLine("warn", { level: "warn", ...ctx }));
  },
  error(ctx: LogContext & { msg?: string; err?: unknown }) {
    const err = ctx.err;
    const errMsg =
      err instanceof Error
        ? err.message
        : err != null && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : err != null
            ? String(err)
            : undefined;
    console.error(
      formatLine("error", {
        level: "error",
        ...ctx,
        ...(errMsg != null ? { errorMessage: errMsg } : {}),
      })
    );
  },
};
