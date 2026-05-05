export class IllegalTransitionError extends Error {
  readonly from: string;
  readonly to: string;
  readonly kind: "match" | "payment" | "match_payment";

  constructor(kind: IllegalTransitionError["kind"], from: string, to: string, message?: string) {
    super(message ?? `Illegal ${kind} transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.to = to;
    this.kind = kind;
  }
}
