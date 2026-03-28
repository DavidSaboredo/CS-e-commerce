import { catalogProducts } from "./products.js";
import { fetchAllProducts } from "./api.js";
import {
  WHATSAPP_PHONE,
  STORAGE_KEY,
  PAGE_SIZE,
  AUTO_REFRESH_MS
} from "./config.js";
import {
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
  buildCheckoutMessage
} from "./utils.js";

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
const cartItemsContainer = document.querySelector("#catalog-cart-items");
const cartTotal = document.querySelector("#catalog-cart-total");

const checkoutOverlay = document.querySelector("#catalog-checkout-overlay");
const checkoutModal = document.querySelector("#catalog-checkout-modal");
const checkoutClose = document.querySelector("#catalog-checkout-close");
const checkoutForm = document.querySelector("#catalog-checkout-form");
const toast = document.querySelector("#catalog-toast");

let cart = loadCart();
let productsData = [...catalogProducts];
let toastTimer = null;
let currentPage = 1;
let isSyncingCatalog = false;

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
          <article class=\"cart-item\">
            <div class=\"cart-item-copy\">
              <h3>${product.title}</h3>
              <p>${product.subtitle}</p>
              <strong>${formatCurrency(product.price)}</strong>
            </div>
            <div class=\"cart-item-controls\">
              <div class=\"quantity-control\">
                <button type=\"button\" data-cart-action=\"decrease\" data-product-id=\"${product.id}\">−</button>
                <span>${item.quantity}</span>
                <button type=\"button\" data-cart-action=\"increase\" data-product-id=\"${product.id}\">+</button>
              </div>
              <button class=\"remove-btn\" type=\"button\" data-cart-action=\"remove\" data-product-id=\"${product.id}\">
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

const getFilteredProducts = () => {
  const normalizedQuery = normalizeText(state.search.trim());
  const minPrice = state.minPrice !== "" ? Number(state.minPrice) : null;
  const maxPrice = state.maxPrice !== "" ? Number(state.maxPrice) : null;

  let filtered = productsData.filter((product) => {
    const matchesCategory = state.category === "Todos" || product.category === state.category;
    const searchableText = normalizeText(`${product.title} ${product.subtitle} ${product.category}`);
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
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  return {
    totalPages,
    items: products.slice(start, start + PAGE_SIZE)
  };
};

const renderPagination = (totalPages) => {
  if (!pageNumbers || !pagePrev || !pageNext) return;

  pageNumbers.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `<button type="button" class="page-btn ${page === currentPage ? "is-active" : ""}" data-page="${page}">${page}</button>`;
  }).join("");

  pagePrev.disabled = currentPage === 1;
  pageNext.disabled = currentPage === totalPages;
};

const renderCatalog = () => {
  if (!catalogGrid) return;

  const filteredProducts = getFilteredProducts();
  const { items, totalPages } = getPagedProducts(filteredProducts);

  if (resultsCount) {
    resultsCount.textContent = `${filteredProducts.length} producto${filteredProducts.length === 1 ? "" : "s"}`;
  }

  if (items.length === 0) {
    catalogGrid.innerHTML = `
      <article class="empty-results">
        <h3>Sin resultados</h3>
        <p>No encontramos productos con los filtros actuales.</p>
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
            ${
              soldOut
                ? "Sin stock"
                : limitReached
                  ? "Tope en carrito"
                  : "Agregar al carrito"
            }
          </button>, cart
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

const syncCatalogFromApi = async ({ silent = false } = {}) => {
  if (isSyncingCatalog) return;
  isSyncingCatalog = true;

  try {
    const apiProducts = await fetchAllProducts({ maxPages: 8, limit: 40 });
    if (apiProducts.length === 0) {
      isSyncingCatalog = false;
      return;
    }

    productsData = apiProducts;
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
  } catch {
    if (!silent) {
      showToast("Usando catalogo local temporalmente");
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

closeCartButton?.addEventListener("click", () => setCartOpen(false, cartPanel, cartOverlay, cartButton));
cartOverlay?.addEventListener("click", () => setCartOpen(false, cartPanel, cartOverlay, cartButton));

clearCartButton?.addEventListener("click", () => {
  cart = [];
  renderCart();
  renderCatalog();
  showToast("Carrito vaciado");
});

checkoutButton?.addEventListener("click", () => {
  if (cart.length === 0) return;
  setCheckoutOpen(true, checkoutModal, checkoutOverlay);
});

checkoutClose?.addEventListener("click", () => setCheckoutOpen(false, checkoutModal, checkoutOverlay));
checkoutOverlay?.addEventListener("click", () => setCheckoutOpen(false, checkoutModal, checkoutOverlay));

checkoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();

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

  const message = buildCheckoutMessageLocal(customerData);
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${message}`, "_blank", "noreferrer");
  setCheckoutOpen(false, checkoutModal, checkoutOverlay);
  event.target.reset();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setCartOpen(false, cartPanel, cartOverlay, cartButton);
    setCheckoutOpen(false, checkoutModal, checkoutOverlay);
  }
});
