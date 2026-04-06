import { catalogProducts } from "./products.js";
import { createOrder, fetchAllProducts, loadProductsCache, saveProductsCache } from "./api.js";
import { BRAND_NAME, WHATSAPP_PHONE, AUTO_REFRESH_MS } from "./config.js";
import {
  buildOrderPayload,
  formatCurrency,
  normalizeText,
  loadCart,
  saveCart,
  findProduct,
  getMaxStock,
  getQuantityInCart,
  getCartQuantity,
  getCartTotal,
  setCartOpen,
  setCheckoutOpen,
  updateCartBadge,
  buildWhatsAppLink,
  buildCheckoutMessage,
  buildAssistedCheckoutMessage,
  buildConsultationMessage,
  getOrderErrorMessage
} from "./utils.js";
import { trackEvent } from "./analytics.js";

const catalogGrid = document.querySelector("#catalog-grid");
const resultsCount = document.querySelector("#catalog-results-count");
const categoryFilter = document.querySelector("#filter-category");
const sortFilter = document.querySelector("#filter-sort");
const minPriceFilter = document.querySelector("#filter-min-price");
const maxPriceFilter = document.querySelector("#filter-max-price");
const clearFiltersButton = document.querySelector("#clear-filters");
const searchInput = document.querySelector("#catalog-search-input");
const searchButton = document.querySelector("#catalog-search-button");

const pagePrev = document.querySelector("#page-prev");
const pageNext = document.querySelector("#page-next");
const pageNumbers = document.querySelector("#page-numbers");

const cartButton = document.querySelector("#catalog-open-cart");
const cartCount = document.querySelector("#catalog-cart-count");
const cartPanel = document.querySelector("#catalog-cart-panel");
const cartOverlay = document.querySelector("#catalog-cart-overlay");
const closeCartButton = document.querySelector("#catalog-close-cart");
const clearCartButton = document.querySelector("#catalog-clear-cart");
const checkoutButton = document.querySelector("#catalog-checkout-btn");
const contactWhatsAppButton = document.querySelector("#catalog-contact-whatsapp-btn");
const cartItemsContainer = document.querySelector("#catalog-cart-items");
const cartTotal = document.querySelector("#catalog-cart-total");

const checkoutOverlay = document.querySelector("#catalog-checkout-overlay");
const checkoutModal = document.querySelector("#catalog-checkout-modal");
const checkoutClose = document.querySelector("#catalog-checkout-close");
const checkoutForm = document.querySelector("#catalog-checkout-form");
const toast = document.querySelector("#catalog-toast");

let cart = loadCart();
const fallbackProducts = [...catalogProducts];
let productsData = loadProductsCache();
let toastTimer = null;
let currentPage = 1;
let isSyncingCatalog = false;
let isSubmittingCheckout = false;
let isCatalogBootstrapping = productsData.length === 0;

const state = {
  search: "",
  category: "Todos",
  sort: "relevance",
  minPrice: "",
  maxPrice: ""
};

const showToast = (message) => {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("is-visible");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
};

const updateCartBadgeLocal = () => updateCartBadge(cartCount, cart);

const renderCart = () => {
  if (!cartItemsContainer || !cartTotal) return;

  cart = cart
    .map((item) => {
      const product = findProduct(item.id, productsData);
      if (!product) return null;

      const maxStock = getMaxStock(product);
      const quantity = Math.min(item.quantity, maxStock);

      if (maxStock <= 0 || quantity <= 0) return null;
      return { ...item, quantity };
    })
    .filter(Boolean);

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <strong>Tu carrito esta vacio</strong>
        <p>Agrega productos del catalogo para empezar el pedido.</p>
      </div>
    `;
  } else {
    cartItemsContainer.innerHTML = cart
      .map((item) => {
        const product = findProduct(item.id, productsData);
        if (!product) return "";

        return `
          <article class="cart-item">
            <div class="cart-item-copy">
              <h3>${product.title}</h3>
              <p>${product.subtitle}</p>
              <strong>${formatCurrency(product.price)}</strong>
            </div>
            <div class="cart-item-controls">
              <div class="quantity-control">
                <button type="button" data-cart-action="decrease" data-product-id="${product.id}">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-action="increase" data-product-id="${product.id}">+</button>
              </div>
              <button class="remove-btn" type="button" data-cart-action="remove" data-product-id="${product.id}">
                Quitar
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  cartTotal.textContent = formatCurrency(getCartTotal(cart, productsData));
  if (clearCartButton) clearCartButton.disabled = cart.length === 0;
  if (checkoutButton) checkoutButton.disabled = cart.length === 0;

  updateCartBadgeLocal();
  saveCart(cart);
};

const addToCart = (productId) => {
  const existingItem = cart.find((item) => item.id === productId);
  const product = findProduct(productId, productsData);
  if (!product) return;

  const maxStock = getMaxStock(product);

  if (maxStock <= 0) {
    showToast("No hay stock disponible de este producto");
    return;
  }

  if (existingItem) {
    if (existingItem.quantity >= maxStock) {
      showToast("Alcanzaste el tope disponible en stock");
      return;
    }

    existingItem.quantity += 1;
  } else {
    cart = [...cart, { id: productId, quantity: 1 }];
  }

  renderCart();
  renderCatalog();
  setCartOpen(true, cartPanel, cartOverlay, cartButton);
  trackEvent("add_to_cart", { productId, context: "catalog" });

  showToast(`${product.title} agregado al carrito`);
};

const updateCartItem = (productId, action) => {
  if (action === "remove") {
    cart = cart.filter((item) => item.id !== productId);
    renderCart();
    renderCatalog();
    return;
  }

  let blockedByStock = false;

  cart = cart
    .map((item) => {
      if (item.id !== productId) return item;

      if (action === "decrease") {
        return { ...item, quantity: item.quantity - 1 };
      }

      if (action === "increase") {
        const product = findProduct(productId, productsData);
        const maxStock = getMaxStock(product);

        if (item.quantity >= maxStock) {
          blockedByStock = true;
          return item;
        }

        return { ...item, quantity: item.quantity + 1 };
      }

      return item;
    })
    .filter((item) => item.quantity > 0);

  if (blockedByStock) {
    showToast("No puedes agregar mas unidades, stock agotado");
  }

  renderCart();
  renderCatalog();
};

const buildCheckoutMessageLocal = (customerData) =>
  buildCheckoutMessage(cart, productsData, WHATSAPP_PHONE, customerData);

const setCheckoutSubmitting = (isSubmitting) => {
  if (!checkoutForm) return;

  const submitButton = checkoutForm.querySelector('button[type="submit"]');

  if (!(submitButton instanceof HTMLButtonElement)) return;

  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Confirmando stock..." : "Confirmar por WhatsApp";
};

const redirectToWhatsApp = (url) => {
  const match = String(url || "").match(/^https?:\/\/wa\.me\/([^?]+)\?text=(.*)$/i);

  if (!match) {
    window.location.href = url;
    return;
  }

  const [, phone, message] = match;
  const appUrl = `whatsapp://send?phone=${phone}&text=${message}`;
  let appOpened = false;

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      appOpened = true;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.location.href = appUrl;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    if (!appOpened) {
      window.location.href = url;
    }
  }, 900);
};

const getFilteredProducts = () => {
  const normalizedQuery = normalizeText(state.search.trim());
  const minPrice = state.minPrice !== "" ? Number(state.minPrice) : null;
  const maxPrice = state.maxPrice !== "" ? Number(state.maxPrice) : null;

  let filtered = productsData.filter((product) => {
    const matchesCategory = state.category === "Todos" || product.category === state.category;
    const searchableText = normalizeText(
      `${product.title} ${product.subtitle} ${product.category}`
    );
    const matchesSearch = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);
    const matchesMin = minPrice === null || product.price >= minPrice;
    const matchesMax = maxPrice === null || product.price <= maxPrice;

    return matchesCategory && matchesSearch && matchesMin && matchesMax;
  });

  if (state.sort === "price-asc") {
    filtered = [...filtered].sort((a, b) => a.price - b.price);
  } else if (state.sort === "price-desc") {
    filtered = [...filtered].sort((a, b) => b.price - a.price);
  } else if (state.sort === "name-asc") {
    filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }

  return filtered;
};

const getPagedProducts = (products) => {
  return {
    totalPages: 1,
    items: products
  };
};

const renderPagination = (_totalPages) => {
  if (!pageNumbers || !pagePrev || !pageNext) return;

  const paginationSection = pageNumbers.closest(".catalog-pagination");
  if (paginationSection) {
    paginationSection.hidden = true;
  }

  pageNumbers.innerHTML = "";

  pagePrev.disabled = true;
  pageNext.disabled = true;
};

const renderCatalog = () => {
  if (!catalogGrid) return;

  const filteredProducts = getFilteredProducts();
  const { items, totalPages } = getPagedProducts(filteredProducts);

  if (resultsCount) {
    resultsCount.textContent = `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"}`;
  }

  if (items.length === 0) {
    const isLoadingCatalog = productsData.length === 0 && (isCatalogBootstrapping || isSyncingCatalog);

    catalogGrid.innerHTML = `
      <article class="empty-results">
        <h3>${isLoadingCatalog ? "Cargando catalogo" : "Sin resultados"}</h3>
        <p>${
          isLoadingCatalog
            ? "Estamos trayendo el stock completo y las imagenes del catalogo online."
            : "No encontramos productos con los filtros actuales."
        }</p>
      </article>
    `;
    renderPagination(1);
    return;
  }

  catalogGrid.innerHTML = items
    .map((product) => {
      const media = product.image
        ? `<img src="${product.image}" alt="${product.title}" loading="lazy" />`
        : `<span>${product.mediaLabel}</span>`;

      const maxStock = getMaxStock(product);
      const inCart = getQuantityInCart(product.id, cart);
      const lowStock = maxStock > 0 && maxStock <= 5;
      const soldOut = maxStock <= 0;
      const limitReached = inCart >= maxStock;

      return `
        <article class="product-card" data-product-id="${product.id}">
          <div class="product-media">${media}</div>
          <div class="product-head">
            <h2 class="product-title">${product.title}</h2>
            <p class="product-price">${formatCurrency(product.price)}</p>
          </div>
          <p class="product-subtitle">${product.subtitle}</p>
          <p class="product-category">${product.category}</p>
          ${lowStock ? '<p class="product-stock-alert">Ultimas unidades</p>' : ""}
          <button class="product-action" type="button" data-add-to-cart="${product.id}" ${
            soldOut || limitReached ? "disabled" : ""
          }>
            ${soldOut ? "Sin stock" : limitReached ? "Tope en carrito" : "Agregar al carrito"}
          </button>
        </article>
      `;
    })
    .join("");

  renderPagination(totalPages);
};

const buildCategoryFilter = () => {
  if (!categoryFilter) return;

  const categoryNames = ["Todos", ...new Set(productsData.map((product) => product.category))];
  categoryFilter.innerHTML = categoryNames
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");
};

const getCatalogSyncErrorMessage = (error) => {
  const code = error?.payload?.code;

  if (code === "PRODUCTS_API_NOT_CONFIGURED") {
    return "Stock online no configurado: falta API key en Vercel";
  }

  if (error?.status === 401 || error?.status === 403) {
    return "Stock online no autorizado: revisa credenciales de la API";
  }

  if (code === "PRODUCTS_API_UNREACHABLE") {
    return "No se pudo conectar con la API de stock";
  }

  return "Usando catalogo local temporalmente";
};

const syncCatalogFromApi = async ({ silent = false } = {}) => {
  if (isSyncingCatalog) return;
  isSyncingCatalog = true;
  renderCatalog();

  try {
    const apiProducts = await fetchAllProducts({ maxPages: 50, limit: 40 });
    if (apiProducts.length === 0) {
      isCatalogBootstrapping = false;
      return;
    }

    productsData = apiProducts;
    isCatalogBootstrapping = false;
    saveProductsCache(apiProducts);
    buildCategoryFilter();

    const categoryExists = [...new Set(productsData.map((product) => product.category))].includes(
      state.category
    );

    if (!categoryExists) {
      state.category = "Todos";
      if (categoryFilter) categoryFilter.value = "Todos";
    }

    currentPage = 1;
    renderCatalog();
    renderCart();
    if (!silent) {
      showToast("Catalogo sincronizado con stock online");
    }
  } catch (error) {
    if (productsData.length === 0) {
      productsData = [...fallbackProducts];
      isCatalogBootstrapping = false;
      buildCategoryFilter();
      renderCatalog();
      renderCart();
    }

    if (!silent) {
      showToast(getCatalogSyncErrorMessage(error));
    }
  } finally {
    isSyncingCatalog = false;
  }
};

buildCategoryFilter();
renderCatalog();
renderCart();
syncCatalogFromApi();

setInterval(() => {
  syncCatalogFromApi({ silent: true });
}, AUTO_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncCatalogFromApi({ silent: true });
  }
});

window.addEventListener("focus", () => {
  syncCatalogFromApi({ silent: true });
});

catalogGrid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const productId = target.dataset.addToCart;
  if (!productId) return;

  addToCart(productId);
});

cartItemsContainer?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.cartAction;
  const productId = target.dataset.productId;
  if (!action || !productId) return;

  updateCartItem(productId, action);
});

pageNumbers?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const page = target.dataset.page;
  if (!page) return;

  currentPage = Number(page);
  renderCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

pagePrev?.addEventListener("click", () => {
  if (currentPage === 1) return;
  currentPage -= 1;
  renderCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

pageNext?.addEventListener("click", () => {
  currentPage += 1;
  renderCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const applyFilters = () => {
  state.search = searchInput?.value || "";
  state.category = categoryFilter?.value || "Todos";
  state.sort = sortFilter?.value || "relevance";
  state.minPrice = minPriceFilter?.value || "";
  state.maxPrice = maxPriceFilter?.value || "";
  currentPage = 1;
  renderCatalog();
};

searchInput?.addEventListener("input", applyFilters);
searchButton?.addEventListener("click", applyFilters);
categoryFilter?.addEventListener("change", applyFilters);
sortFilter?.addEventListener("change", applyFilters);
minPriceFilter?.addEventListener("input", applyFilters);
maxPriceFilter?.addEventListener("input", applyFilters);

clearFiltersButton?.addEventListener("click", () => {
  state.search = "";
  state.category = "Todos";
  state.sort = "relevance";
  state.minPrice = "";
  state.maxPrice = "";

  if (searchInput) searchInput.value = "";
  if (categoryFilter) categoryFilter.value = "Todos";
  if (sortFilter) sortFilter.value = "relevance";
  if (minPriceFilter) minPriceFilter.value = "";
  if (maxPriceFilter) maxPriceFilter.value = "";

  currentPage = 1;
  renderCatalog();
});

cartButton?.addEventListener("click", () => {
  const isOpen = cartPanel?.classList.contains("is-open");
  setCartOpen(!isOpen, cartPanel, cartOverlay, cartButton);
});

closeCartButton?.addEventListener("click", () =>
  setCartOpen(false, cartPanel, cartOverlay, cartButton)
);
cartOverlay?.addEventListener("click", () =>
  setCartOpen(false, cartPanel, cartOverlay, cartButton)
);

clearCartButton?.addEventListener("click", () => {
  cart = [];
  renderCart();
  renderCatalog();
  showToast("Carrito vaciado");
});

checkoutButton?.addEventListener("click", () => {
  if (cart.length === 0) return;
  trackEvent("checkout_started", {
    context: "catalog",
    itemCount: getCartQuantity(cart),
    cartTotal: getCartTotal(cart, productsData)
  });
  setCheckoutOpen(true, checkoutModal, checkoutOverlay);
});

contactWhatsAppButton?.addEventListener("click", () => {
  const message = buildConsultationMessage(cart, productsData, WHATSAPP_PHONE);
  const whatsappUrl = buildWhatsAppLink(WHATSAPP_PHONE, message);

  trackEvent("whatsapp_contact_requested", {
    context: "catalog_cart",
    itemCount: getCartQuantity(cart),
    cartTotal: getCartTotal(cart, productsData)
  });

  redirectToWhatsApp(whatsappUrl);
});

checkoutClose?.addEventListener("click", () =>
  setCheckoutOpen(false, checkoutModal, checkoutOverlay)
);
checkoutOverlay?.addEventListener("click", () =>
  setCheckoutOpen(false, checkoutModal, checkoutOverlay)
);

checkoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (isSubmittingCheckout) return;

  if (!(event.target instanceof HTMLFormElement)) return;

  const formData = new FormData(event.target);
  const customerData = {
    name: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("customerPhone") || "").trim(),
    zone: String(formData.get("customerZone") || "").trim(),
    delivery: String(formData.get("customerDelivery") || "").trim(),
    notes: String(formData.get("customerNotes") || "").trim()
  };

  if (!customerData.name || !customerData.phone || !customerData.zone || !customerData.delivery) {
    showToast("Completa los datos obligatorios para continuar");
    return;
  }

  const submitOrder = async () => {
    isSubmittingCheckout = true;
    setCheckoutSubmitting(true);

    try {
      await createOrder(buildOrderPayload(cart, productsData, customerData));

      const message = buildCheckoutMessageLocal(customerData);
      const whatsappUrl = buildWhatsAppLink(WHATSAPP_PHONE, message);
      trackEvent("checkout_confirmed", {
        context: "catalog",
        itemCount: getCartQuantity(cart),
        cartTotal: getCartTotal(cart, productsData)
      });
      trackEvent("whatsapp_checkout_redirect", { mode: "confirm", context: "catalog" });

      redirectToWhatsApp(whatsappUrl);

      cart = [];
      renderCart();
      renderCatalog();
      setCheckoutOpen(false, checkoutModal, checkoutOverlay);
      event.target.reset();
      showToast(`Pedido confirmado con ${BRAND_NAME}`);
      await syncCatalogFromApi({ silent: true });
    } catch (error) {
      const assistedMessage = buildAssistedCheckoutMessage(
        cart,
        productsData,
        WHATSAPP_PHONE,
        customerData
      );
      const assistedUrl = buildWhatsAppLink(WHATSAPP_PHONE, assistedMessage);

      trackEvent("checkout_failed", {
        context: "catalog",
        reason: error?.payload?.code || error?.message || "unknown"
      });
      trackEvent("whatsapp_checkout_redirect", { mode: "assist", context: "catalog" });

      redirectToWhatsApp(assistedUrl);

      showToast(`${getOrderErrorMessage(error)}. Te abrimos WhatsApp para seguir el pedido.`);
    } finally {
      isSubmittingCheckout = false;
      setCheckoutSubmitting(false);
    }
  };

  submitOrder();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setCartOpen(false, cartPanel, cartOverlay, cartButton);
    setCheckoutOpen(false, checkoutModal, checkoutOverlay);
  }
});
