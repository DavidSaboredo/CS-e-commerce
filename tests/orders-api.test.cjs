const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/orders.js");

const createResponseMock = () => {
  const headers = {};

  return {
    statusCode: 200,
    headers,
    body: "",
    setHeader(name, value) {
      headers[name] = value;
    },
    end(payload = "") {
      this.body = payload;
    }
  };
};

const parseBody = (res) => {
  try {
    return JSON.parse(res.body || "{}");
  } catch {
    return {};
  }
};

test("rejects methods different from POST", async () => {
  const req = {
    method: "GET",
    url: "/api/orders",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  };
  const res = createResponseMock();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  const body = parseBody(res);
  assert.equal(body.ok, false);
  assert.equal(body.code, "METHOD_NOT_ALLOWED");
  assert.ok(body.requestId);
});

test("rejects invalid payloads", async () => {
  const req = {
    method: "POST",
    url: "/api/orders",
    headers: { "x-forwarded-for": "10.10.10.10" },
    socket: { remoteAddress: "127.0.0.1" },
    body: { customer: { name: "A" }, items: [] }
  };
  const res = createResponseMock();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  const body = parseBody(res);
  assert.equal(body.ok, false);
  assert.ok(body.code);
  assert.ok(body.requestId);
});

test("accepts valid payload and forwards to upstream", async () => {
  const originalFetch = global.fetch;
  const originalEnableUpstream = process.env.ENABLE_UPSTREAM_ORDERS;
  const originalOrderApiUrl = process.env.ORDER_API_URL;

  process.env.ENABLE_UPSTREAM_ORDERS = "true";
  process.env.ORDER_API_URL = "https://example.com/api/orders";

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ orderId: "order-123" })
  });

  const req = {
    method: "POST",
    url: "/api/orders",
    headers: { "x-forwarded-for": "10.10.10.11" },
    socket: { remoteAddress: "127.0.0.1" },
    body: {
      channel: "web",
      source: "ecommerce",
      customer: {
        name: "Cliente Demo",
        phone: "+54 3442 000000",
        zone: "Concepcion del Uruguay",
        delivery: "Envio a domicilio",
        notes: "Probar flujo"
      },
      items: [
        {
          productId: "abc-1",
          quantity: 2,
          title: "Bateria",
          unitPrice: 12000
        }
      ]
    }
  };

  const res = createResponseMock();

  await handler(req, res);

  global.fetch = originalFetch;
  process.env.ENABLE_UPSTREAM_ORDERS = originalEnableUpstream;
  process.env.ORDER_API_URL = originalOrderApiUrl;

  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.ok, true);
  assert.equal(body.orderId, "order-123");
  assert.ok(body.requestId);
});
