const pushToDataLayer = (eventName, payload) => {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }

  window.dataLayer.push({
    event: eventName,
    ...payload
  });
};

const persistLocalEvent = (eventName, payload) => {
  try {
    const storageKey = "cs-analytics-events";
    const current = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    const next = [
      ...current,
      {
        event: eventName,
        payload,
        timestamp: new Date().toISOString()
      }
    ].slice(-100);

    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore telemetry persistence failures.
  }
};

export const trackEvent = (eventName, payload = {}) => {
  if (!eventName) return;

  const safePayload = {
    ...payload,
    source: "web-ecommerce"
  };

  pushToDataLayer(eventName, safePayload);
  persistLocalEvent(eventName, safePayload);

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.info("[analytics]", eventName, safePayload);
  }
};
