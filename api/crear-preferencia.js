export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN no configurado" });
  }

  try {
    const { items, payer, back_urls, external_reference } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No hay ítems en el pedido" });
    }

    const preference = {
      items: items.map(item => ({
        id: String(item.id || "prod"),
        title: String(item.title || "Producto BLOOM"),
        quantity: Number(item.quantity) || 1,
        currency_id: "ARS",
        unit_price: Number(item.unit_price) || 0,
      })),
      payer: {
        email: payer?.email || "",
        name: payer?.name || "",
        surname: payer?.surname || "",
      },
      back_urls: {
        success: back_urls?.success || "https://tutienda.com",
        failure: back_urls?.failure || "https://tutienda.com",
        pending: back_urls?.pending || "https://tutienda.com",
      },
      auto_return: "approved",
      external_reference: external_reference || ("BL-" + Date.now()),
      statement_descriptor: "BLOOM Store",
      payment_methods: {
        excluded_payment_types: [],
        installments: 12,
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      return res.status(mpRes.status).json({ error: data.message || "Error de Mercado Pago", detail: data });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });

  } catch (err) {
    return res.status(500).json({ error: "Error interno", detail: err.message });
  }
}
