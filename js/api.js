const PUBLIC_PRODUCTS_API = "https://cs-audio-baterias.vercel.app/api/public/products";

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

  return {
    id: String(rawProduct?.id ?? rawProduct?.productId ?? `api-${index + 1}`),
    title,
    category,
    subtitle: subtitleParts[0] || "Disponible para entrega",
    price: normalizePrice(rawProduct?.price ?? rawProduct?.unitPrice ?? rawProduct?.amount),
    image:
      rawProduct?.image ||
      rawProduct?.imageUrl ||
      rawProduct?.photo ||
      rawProduct?.thumbnail ||
      "",
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

  const endpoint = `${PUBLIC_PRODUCTS_API}?${params.toString()}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const payload = await response.json();
  const products = extractProductsArray(payload).map(normalizeProduct);

  return {
    products,
    payload
  };
};

export const listPublicProducts = async (options = {}) => {
  const { products } = await fetchProductsPage(options);
  return products;
};

export const fetchAllProducts = async ({ maxPages = 8, limit = 40, available } = {}) => {
  const allProducts = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { products } = await fetchProductsPage({ available, page, limit });

    if (products.length === 0) break;

    allProducts.push(...products);

    if (products.length < limit) {
      break;
    }
  }

  const seen = new Set();
  return allProducts.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
};

export const fetchAllAvailableProducts = async ({ maxPages = 8, limit = 40 } = {}) => {
  return fetchAllProducts({ maxPages, limit, available: true });
};
