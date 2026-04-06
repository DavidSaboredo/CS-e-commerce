import { ORDER_API_ENDPOINT } from "./config.js";

const API_ENDPOINTS = ["/api/catalog-products"];
const PRODUCTS_CACHE_KEY = "cs-products-cache-v1";

const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

const getTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

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

const extractProductsArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const normalizePrice = (value) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getPaginationInfo = (payload) => {
  const raw = payload?.meta || payload?.pagination || payload?.pageInfo || payload?.pager;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const page = parsePositiveInt(raw.page ?? raw.currentPage ?? raw.pageNumber);
  const totalPages = parsePositiveInt(raw.totalPages ?? raw.pages ?? raw.lastPage);
  const limit = parsePositiveInt(raw.limit ?? raw.pageSize ?? raw.perPage);
  const nextPage = parsePositiveInt(raw.nextPage ?? raw.next);
  const hasNext =
    typeof raw.hasNext === "boolean"
      ? raw.hasNext
      : typeof raw.hasNextPage === "boolean"
        ? raw.hasNextPage
        : null;

  return {
    page,
    totalPages,
    limit,
    nextPage,
    hasNext
  };
};

const normalizeStock = (value, availableFlag) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return availableFlag ? 1 : 0;
};

const resolveAssetUrl = (value, assetBaseUrl) => {
  const trimmedValue = getTrimmedString(value);

  if (!trimmedValue) {
    return "";
  }

  if (/^(?:https?:|data:|blob:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("//")) {
    return `https:${trimmedValue}`;
  }

  if (!assetBaseUrl) {
    return trimmedValue;
  }

  try {
    return new URL(trimmedValue, assetBaseUrl).href;
  } catch {
    return trimmedValue;
  }
};

const getImageCandidate = (rawProduct) => {
  const images = Array.isArray(rawProduct?.images) ? rawProduct.images : [];
  const gallery = Array.isArray(rawProduct?.gallery) ? rawProduct.gallery : [];
  const media = Array.isArray(rawProduct?.media)
    ? rawProduct.media
    : rawProduct?.media
      ? [rawProduct.media]
      : [];

  const firstImage = images[0] || gallery[0] || media[0] || null;

  return (
    rawProduct?.image ||
    rawProduct?.imageUrl ||
    rawProduct?.photo ||
    rawProduct?.thumbnail ||
    rawProduct?.picture ||
    rawProduct?.imageSrc ||
    rawProduct?.imageURL ||
    rawProduct?.mediaUrl ||
    rawProduct?.assetUrl ||
    rawProduct?.featuredImage?.url ||
    rawProduct?.featuredImage?.src ||
    rawProduct?.cover?.url ||
    rawProduct?.cover?.src ||
    rawProduct?.asset?.url ||
    rawProduct?.asset?.src ||
    firstImage?.url ||
    firstImage?.src ||
    firstImage?.imageUrl ||
    firstImage?.image ||
    ""
  );
};

const getAssetBaseUrl = (payload, responseOrigin) => {
  const payloadBaseUrl =
    payload?.meta?.assetBaseUrl ||
    payload?.meta?.assetsBaseUrl ||
    payload?.meta?.baseUrl ||
    payload?.assetBaseUrl ||
    payload?.assetsBaseUrl ||
    payload?.baseUrl ||
    "";

  return getTrimmedString(payloadBaseUrl) || getTrimmedString(responseOrigin);
};

const normalizeProduct = (rawProduct, index, assetBaseUrl = "") => {
  const availableFlag = Boolean(
    rawProduct?.available ?? rawProduct?.isAvailable ?? rawProduct?.inStock
  );

  const title =
    rawProduct?.displayName ||
    rawProduct?.title ||
    rawProduct?.name ||
    rawProduct?.productName ||
    rawProduct?.producto ||
    `Producto ${index + 1}`;

  const category =
    rawProduct?.category ||
    rawProduct?.categoryName ||
    rawProduct?.type ||
    rawProduct?.categoria ||
    "General";

  const subtitleParts = [
    rawProduct?.subtitle,
    rawProduct?.brand,
    rawProduct?.model,
    rawProduct?.description
  ].filter(Boolean);

  const stock = normalizeStock(
    rawProduct?.stock ?? rawProduct?.quantity ?? rawProduct?.availableStock,
    availableFlag
  );

  const fallbackIdSource =
    rawProduct?.sku ||
    rawProduct?.code ||
    rawProduct?.slug ||
    rawProduct?.displayName ||
    rawProduct?.title ||
    rawProduct?.name ||
    rawProduct?.productName;

  return {
    id: String(
      rawProduct?.id ??
        rawProduct?.productId ??
        rawProduct?._id ??
        rawProduct?.uuid ??
        rawProduct?.uid ??
        (fallbackIdSource
          ? `api-${String(fallbackIdSource).trim().toLowerCase().replace(/\s+/g, "-")}`
          : `api-${index + 1}`)
    ),
    title,
    category,
    subtitle: subtitleParts[0] || "Disponible para entrega",
    price: normalizePrice(rawProduct?.price ?? rawProduct?.unitPrice ?? rawProduct?.amount),
    image: resolveAssetUrl(getImageCandidate(rawProduct), assetBaseUrl),
    mediaLabel: category,
    stock,
    available: availableFlag || stock > 0
  };
};

const fetchProductsPage = async ({ search = "", available, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (available !== undefined) params.set("available", String(available));
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  // Prevent stale browser/CDN cache on catalog sync calls.
  params.set("_ts", String(Date.now()));

  const query = params.toString();
  const endpointCandidates = API_ENDPOINTS.map((baseUrl) =>
    query ? `${baseUrl}?${query}` : baseUrl
  );

  let lastError = null;

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      });

      if (!response.ok) {
        const payload = await parseJsonResponse(response);
        const error = new Error(payload?.message || `API error ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      const payload = await parseJsonResponse(response);
      const assetBaseUrl = getAssetBaseUrl(payload, response.headers.get("x-products-origin"));
      const products = extractProductsArray(payload).map((product, index) =>
        normalizeProduct(product, index, assetBaseUrl)
      );

      return {
        products,
        payload
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No se pudo obtener el catalogo desde la API");
};

export const listPublicProducts = async (options = {}) => {
  const { products } = await fetchProductsPage(options);
  return products;
};

export const fetchAllProducts = async ({ maxPages = 50, limit = 40, available } = {}) => {
  const allProducts = [];
  let currentPage = 1;
  let pageCap = maxPages;
  let previousPageSignature = "";

  while (currentPage <= pageCap) {
    const { products, payload } = await fetchProductsPage({
      available,
      page: currentPage,
      limit
    });

    if (products.length === 0) break;

    allProducts.push(...products);

    const currentPageSignature = products
      .map((product) => String(product.id))
      .sort()
      .join("|");

    const pageInfo = getPaginationInfo(payload);

    if (pageInfo?.totalPages) {
      pageCap = Math.min(maxPages, pageInfo.totalPages);
    }

    if (pageInfo?.hasNext === false) {
      break;
    }

    if (pageInfo?.nextPage && pageInfo.nextPage > currentPage) {
      currentPage = pageInfo.nextPage;
      continue;
    }

    // Some APIs ignore requested limit and always return a fixed page size (e.g. 16).
    // Without metadata, continue paging until empty page or repeated page signature.
    if (!pageInfo && currentPageSignature && currentPageSignature === previousPageSignature) {
      break;
    }

    const hasPagingHints = Boolean(
      pageInfo?.totalPages || pageInfo?.hasNext !== null || pageInfo?.nextPage
    );
    const expectedPageSize = pageInfo?.limit || limit;

    if (!hasPagingHints && products.length < expectedPageSize) {
      previousPageSignature = currentPageSignature;
      currentPage += 1;
      continue;
    }

    previousPageSignature = currentPageSignature;
    currentPage += 1;
  }

  const seen = new Set();
  return allProducts.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
};

export const fetchAllAvailableProducts = async ({ maxPages = 50, limit = 40 } = {}) => {
  return fetchAllProducts({ maxPages, limit, available: true });
};

export const loadProductsCache = () => {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(PRODUCTS_CACHE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    const products = Array.isArray(parsed) ? parsed : parsed?.products;

    if (!Array.isArray(products)) {
      return [];
    }

    return products.map((product, index) => normalizeProduct(product, index));
  } catch {
    return [];
  }
};

export const saveProductsCache = (products) => {
  const storage = getStorage();

  if (!storage || !Array.isArray(products) || products.length === 0) {
    return;
  }

  try {
    storage.setItem(
      PRODUCTS_CACHE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        products
      })
    );
  } catch {
    // Ignore storage quota or privacy mode errors.
  }
};

export const createOrder = async (orderPayload) => {
  const response = await fetch(ORDER_API_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(orderPayload)
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(payload?.message || `Error ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload || { ok: true };
};
