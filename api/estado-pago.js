// /api/estado-pago.js
// Endpoint para verificar el estado de un pago de Mercado Pago a partir del preference_id.
// Se guarda en: /api/estado-pago.js dentro de tu proyecto de Vercel (bloom-backend-bay).
//
// Variable de entorno requerida en Vercel:
//   MP_ACCESS_TOKEN = "APP_USR-..."   (tu Access Token de producción o de test)
//
// Uso desde el frontend:
//   GET /api/estado-pago?preference_id=<id>
//   Responde: { status: "approved" | "pending" | "rejected" | "cancelled" | null }

export default async function handler(req, res) {
  // ── CORS: permitir llamadas desde el frontend de BLOOM ──────────────────
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { preference_id } = req.query;

  if (!preference_id) {
    return res.status(400).json({ error: "Falta el parámetro preference_id" });
  }

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    console.error("[estado-pago] MP_ACCESS_TOKEN no configurado en Vercel");
    return res.status(500).json({ error: "Configuración incompleta del servidor" });
  }

  try {
    // ── Buscar pagos asociados a esta preferencia ────────────────────────
    // MP no tiene un endpoint directo preference → payment, pero sí permite
    // buscar pagos por external_reference o por preference_id vía search.
    const searchUrl =
      `https://api.mercadopago.com/v1/payments/search` +
      `?sort=date_created&criteria=desc` +
      `&external_reference=${encodeURIComponent(preference_id)}` +
      `&limit=5`;

    const mpResp = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!mpResp.ok) {
      const errBody = await mpResp.text();
      console.error("[estado-pago] Error de MP:", mpResp.status, errBody);
      // Devolver null en vez de error 500 para que el frontend haga retry
      return res.status(200).json({ status: null });
    }

    const data = await mpResp.json();

    // data.results es un array de pagos asociados a esa external_reference
    const payments = data?.results;

    if (!payments || payments.length === 0) {
      // Todavía no hay ningún pago registrado → el usuario aún está en MP
      return res.status(200).json({ status: null });
    }

    // Tomar el pago más reciente
    const latest = payments[0];
    const status = latest.status; // "approved" | "pending" | "in_process" | "rejected" | "cancelled"

    return res.status(200).json({
      status,
      payment_id:  latest.id,
      status_detail: latest.status_detail || null,
    });

  } catch (err) {
    console.error("[estado-pago] Excepción:", err.message);
    // Devolver null para que el frontend reintente en vez de fallar
    return res.status(200).json({ status: null });
  }
}
