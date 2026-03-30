import { ORDER_API_ENDPOINT } from "./config.js";

const API_ENDPOINTS = [
  "/api/catalog-products",
  "/api/public/products",
  "https://cs-audio-baterias.vercel.app/api/public/products"
];

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

const normalizeProduct = (rawProduct, index) => {
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
    image:
      rawProduct?.image || rawProduct?.imageUrl || rawProduct?.photo || rawProduct?.thumbnail || "",
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

  const query = params.toString();
  const endpointCandidates = API_ENDPOINTS.map((baseUrl) =>
    query ? `${baseUrl}?${query}` : baseUrl
  );

  let lastError = null;

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json"
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
      const products = extractProductsArray(payload).map(normalizeProduct);

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
