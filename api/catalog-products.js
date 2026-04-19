const DEFAULT_PRODUCTS_API_URL = "";

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  // Always serve fresh catalog data.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildQueryParams = (reqQuery) => {
  const page = parsePositiveInt(reqQuery?.page, 1);
  const limit = Math.min(parsePositiveInt(reqQuery?.limit, 40), 200);
  const search = String(reqQuery?.search || "").trim();
  const availableRaw = reqQuery?.available;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));

  if (search) {
    params.set("search", search);
  }

  if (availableRaw !== undefined) {
    params.set("available", String(availableRaw));
  }

  return params;
};

const parseJsonResponse = async (response) => {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
};

const getOriginFromUrl = (value) => {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
};

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Metodo no permitido"
    });
    return;
  }

  if (process.env.ENABLE_UPSTREAM_PRODUCTS !== "true") {
    sendJson(res, 503, {
      ok: false,
      code: "PRODUCTS_API_NOT_CONFIGURED",
      message: "Stock online deshabilitado"
    });
    return;
  }

  const apiKey =
    process.env.PRODUCTS_API_KEY ||
    process.env.PUBLIC_PRODUCTS_API_KEY ||
    process.env.STOCK_API_KEY ||
    process.env.ORDER_API_KEY ||
    "";
  const bearerToken = process.env.PRODUCTS_API_BEARER_TOKEN || "";

  if (!apiKey && !bearerToken) {
    sendJson(res, 503, {
      ok: false,
      code: "PRODUCTS_API_NOT_CONFIGURED",
      message: "Falta configurar PRODUCTS_API_KEY o PRODUCTS_API_BEARER_TOKEN"
    });
    return;
  }

  const productsApiUrl = process.env.PRODUCTS_API_URL || DEFAULT_PRODUCTS_API_URL;
  if (!productsApiUrl) {
    sendJson(res, 503, {
      ok: false,
      code: "PRODUCTS_API_NOT_CONFIGURED",
      message: "Falta configurar PRODUCTS_API_URL"
    });
    return;
  }
  const productsOrigin = getOriginFromUrl(productsApiUrl);
  const queryParams = buildQueryParams(req.query || {});
  const endpoint = `${productsApiUrl}?${queryParams.toString()}`;

  if (productsOrigin) {
    res.setHeader("x-products-origin", productsOrigin);
  }

  const headers = {
    Accept: "application/json"
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers
    });
  } catch {
    sendJson(res, 502, {
      ok: false,
      code: "PRODUCTS_API_UNREACHABLE",
      message: "No se pudo conectar con la API de productos"
    });
    return;
  }

  const payload = await parseJsonResponse(upstreamResponse);

  if (!upstreamResponse.ok) {
    sendJson(res, upstreamResponse.status, {
      ok: false,
      code: "PRODUCTS_API_ERROR",
      ...(payload && typeof payload === "object"
        ? payload
        : { message: "No se pudieron obtener productos" })
    });
    return;
  }

  sendJson(res, 200, payload && typeof payload === "object" ? payload : { data: [] });
};
