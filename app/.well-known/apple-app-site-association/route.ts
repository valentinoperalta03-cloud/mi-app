export const dynamic = "force-static";

export function GET() {
  const aasa = {
    applinks: {
      details: [
        {
          appIDs: ["4M247SD7H6.com.padelibre.app"],
          components: [{ "/": "/*" }],
        },
      ],
    },
  };

  return Response.json(aasa, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
