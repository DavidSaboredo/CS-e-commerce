const DEFAULT_ORDER_API_URL = "https://cs-audio-baterias.vercel.app/api/orders";

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
};

const parseResponseBody = async (response) => {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return { message: rawBody };
  }
};

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "Metodo no permitido" });
    return;
  }

  const payload = await readBody(req);

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0 || !payload.customer) {
    sendJson(res, 400, { ok: false, message: "Payload de pedido invalido" });
    return;
  }

  const orderApiUrl = process.env.ORDER_API_URL || DEFAULT_ORDER_API_URL;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (process.env.ORDER_API_KEY) {
    headers["x-api-key"] = process.env.ORDER_API_KEY;
  }

  if (process.env.ORDER_API_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ORDER_API_BEARER_TOKEN}`;
  }

  let response;

  try {
    response = await fetch(orderApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch {
    sendJson(res, 502, {
      ok: false,
      message: "No se pudo conectar con la API de pedidos"
    });
    return;
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 404 && !process.env.ORDER_API_URL) {
      sendJson(res, 503, {
        ok: false,
        message: "La API de pedidos todavia no esta habilitada en el backend",
        code: "ORDER_API_NOT_CONFIGURED"
      });
      return;
    }

    sendJson(res, response.status, {
      ok: false,
      ...(responseBody && typeof responseBody === "object"
        ? responseBody
        : { message: "No se pudo registrar el pedido" })
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    ...(responseBody && typeof responseBody === "object" ? responseBody : {})
  });
};