const { randomUUID } = require("crypto");

const DEFAULT_ORDER_API_URL = "";
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.ORDER_RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(
  process.env.ORDER_RATE_LIMIT_MAX_REQUESTS || "20",
  10
);
const rateLimitBuckets = new Map();

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

const logEvent = (event, data = {}) => {
  console.info(
    JSON.stringify({
      event,
      level: "info",
      timestamp: new Date().toISOString(),
      ...data
    })
  );
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
};

const isRateLimited = (ip) => {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitBuckets.set(ip, recent);

  if (rateLimitBuckets.size > 1000) {
    for (const [key, timestamps] of rateLimitBuckets.entries()) {
      const valid = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) {
        rateLimitBuckets.delete(key);
      } else {
        rateLimitBuckets.set(key, valid);
      }
    }
  }

  return false;
};

const normalizeTextField = (value, { maxLength, minLength = 0 } = {}) => {
  const normalized = String(value || "").trim();

  if (normalized.length < minLength) {
    return null;
  }

  if (maxLength && normalized.length > maxLength) {
    return null;
  }

  return normalized;
};

const validateOrderPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Payload de pedido invalido", code: "INVALID_ORDER_PAYLOAD" };
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return {
      ok: false,
      message: "El pedido debe incluir al menos un item",
      code: "INVALID_ORDER_ITEMS"
    };
  }

  if (!payload.customer || typeof payload.customer !== "object") {
    return {
      ok: false,
      message: "Datos del cliente incompletos",
      code: "INVALID_CUSTOMER"
    };
  }

  const customer = {
    name: normalizeTextField(payload.customer.name, { minLength: 2, maxLength: 120 }),
    phone: normalizeTextField(payload.customer.phone, { minLength: 6, maxLength: 30 }),
    zone: normalizeTextField(payload.customer.zone, { minLength: 2, maxLength: 120 }),
    delivery: normalizeTextField(payload.customer.delivery, { minLength: 3, maxLength: 80 }),
    notes: normalizeTextField(payload.customer.notes, { maxLength: 500 }) || ""
  };

  if (!customer.name || !customer.phone || !customer.zone || !customer.delivery) {
    return {
      ok: false,
      message: "Datos del cliente invalidos o incompletos",
      code: "INVALID_CUSTOMER"
    };
  }

  const phoneDigits = customer.phone.replace(/[^0-9+]/g, "");
  if (phoneDigits.length < 6) {
    return {
      ok: false,
      message: "Telefono del cliente invalido",
      code: "INVALID_CUSTOMER_PHONE"
    };
  }

  const items = [];

  for (const rawItem of payload.items) {
    const quantity = Number.parseInt(String(rawItem?.quantity ?? ""), 10);
    const unitPrice = Number.parseFloat(String(rawItem?.unitPrice ?? ""));
    const title = normalizeTextField(rawItem?.title, { minLength: 2, maxLength: 180 });
    const productId = rawItem?.productId;

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 200) {
      return {
        ok: false,
        message: "Cantidad invalida en uno de los items",
        code: "INVALID_ITEM_QUANTITY"
      };
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return {
        ok: false,
        message: "Precio invalido en uno de los items",
        code: "INVALID_ITEM_PRICE"
      };
    }

    if (productId === undefined || productId === null || !title) {
      return {
        ok: false,
        message: "Item invalido: falta productId o titulo",
        code: "INVALID_ITEM_DATA"
      };
    }

    items.push({
      productId,
      quantity,
      title,
      unitPrice
    });
  }

  return {
    ok: true,
    payload: {
      channel: normalizeTextField(payload.channel, { maxLength: 30 }) || "web",
      source: normalizeTextField(payload.source, { maxLength: 50 }) || "ecommerce",
      customer,
      items
    }
  };
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
  const requestId = randomUUID();
  const clientIp = getClientIp(req);

  logEvent("order_request_received", {
    requestId,
    method: req.method,
    path: req.url,
    clientIp
  });

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Metodo no permitido",
      requestId
    });
    return;
  }

  if (isRateLimited(clientIp)) {
    logEvent("order_rate_limited", { requestId, clientIp });
    sendJson(res, 429, {
      ok: false,
      code: "RATE_LIMITED",
      message: "Demasiadas solicitudes. Intenta nuevamente en unos segundos",
      requestId
    });
    return;
  }

  const rawPayload = await readBody(req);
  const validation = validateOrderPayload(rawPayload);

  if (!validation.ok) {
    logEvent("order_payload_rejected", {
      requestId,
      clientIp,
      code: validation.code,
      message: validation.message
    });
    sendJson(res, 400, {
      ok: false,
      code: validation.code,
      message: validation.message,
      requestId
    });
    return;
  }

  const payload = validation.payload;

  if (process.env.ENABLE_UPSTREAM_ORDERS !== "true") {
    logEvent("order_upstream_disabled", { requestId });
    sendJson(res, 503, {
      ok: false,
      message: "La API de pedidos aun no esta configurada para descontar stock real",
      code: "ORDER_API_NOT_CONFIGURED",
      requestId
    });
    return;
  }

  const orderApiUrl = process.env.ORDER_API_URL || DEFAULT_ORDER_API_URL;
  if (!orderApiUrl) {
    logEvent("order_api_not_configured", { requestId });
    sendJson(res, 503, {
      ok: false,
      message: "La API de pedidos aun no esta configurada para descontar stock real",
      code: "ORDER_API_NOT_CONFIGURED",
      requestId
    });
    return;
  }
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
    logEvent("order_upstream_unreachable", {
      requestId,
      orderApiUrl
    });
    sendJson(res, 502, {
      ok: false,
      code: "ORDER_UPSTREAM_UNREACHABLE",
      message: "No se pudo conectar con la API de pedidos",
      requestId
    });
    return;
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 404 && !process.env.ORDER_API_URL) {
      logEvent("order_api_not_configured", {
        requestId,
        upstreamStatus: response.status
      });
      sendJson(res, 503, {
        ok: false,
        message: "La API de pedidos todavia no esta habilitada en el backend",
        code: "ORDER_API_NOT_CONFIGURED",
        requestId
      });
      return;
    }

    logEvent("order_upstream_error", {
      requestId,
      upstreamStatus: response.status,
      upstreamBody: responseBody
    });

    sendJson(res, response.status, {
      ok: false,
      requestId,
      ...(responseBody && typeof responseBody === "object"
        ? responseBody
        : { message: "No se pudo registrar el pedido" })
    });
    return;
  }

  logEvent("order_confirmed", {
    requestId,
    upstreamStatus: response.status,
    items: payload.items.length
  });

  sendJson(res, 200, {
    ok: true,
    requestId,
    ...(responseBody && typeof responseBody === "object" ? responseBody : {})
  });
};
