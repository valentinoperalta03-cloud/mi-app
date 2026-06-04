import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user_id, title, body, match_id } = await req.json();

    if (!user_id || !title || !body) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_API_KEY;

    if (!appId || !apiKey) {
      return NextResponse.json({ error: "OneSignal not configured" }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: "push",
      include_aliases: {
        external_id: [String(user_id)],
      },
      headings: { en: title },
      contents: { en: body },
    };

    if (match_id) {
      payload.data = { match_id };
    }

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      console.error("[push] OneSignal error:", data);
      return NextResponse.json({ error: "OneSignal rejected", details: data }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Push error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
