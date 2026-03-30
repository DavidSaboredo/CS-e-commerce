import { featuredProducts } from "./products.js";
import { createOrder, fetchAllProducts } from "./api.js";
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

const featuredProductsContainer = document.querySelector("#featured-products");
const syncTime = document.querySelector("#sync-time");
const itemCount = document.querySelector("#item-count");
const searchInput = document.querySelector("#search-input");
const searchButton = document.querySelector("#search-button");
const mainNav = document.querySelector("#main-nav");
const menuToggle = document.querySelector("#menu-toggle");
const returnsLink = document.querySelector("#returns-link");
const toast = document.querySelector("#toast");
const cartButton = document.querySelector("#open-cart");
const cartCount = document.querySelector("#cart-count");
const cartPanel = document.querySelector("#cart-panel");
const cartOverlay = document.querySelector("#cart-overlay");
const closeCartButton = document.querySelector("#close-cart");
const clearCartButton = document.querySelector("#clear-cart");
const checkoutButton = document.querySelector("#checkout-btn");
const contactWhatsAppButton = document.querySelector("#contact-whatsapp-btn");
const cartItemsContainer = document.querySelector("#cart-items");
const cartTotal = document.querySelector("#cart-total");
const featuredCta = document.querySelector("#featured-cta");
const checkoutOverlay = document.querySelector("#checkout-overlay");
const checkoutModal = document.querySelector("#checkout-modal");
const checkoutClose = document.querySelector("#checkout-close");
const checkoutForm = document.querySelector("#checkout-form");

let cart = loadCart();
let toastTimer = null;
let searchTerm = "";
let productsData = [...featuredProducts];
let isSyncingProducts = false;
let isSubmittingCheckout = false;

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

const getVisibleProducts = () => {
  const normalizedQuery = normalizeText(searchTerm.trim());

  return productsData.filter((product) => {
    const productText = normalizeText(`${product.title} ${product.subtitle} ${product.category}`);
    const matchesSearch = normalizedQuery.length === 0 || productText.includes(normalizedQuery);
    return matchesSearch;
  });
};

const setMenuOpen = (isOpen) => {
  if (!mainNav || !menuToggle) return;

  mainNav.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
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
        <p>Agrega productos destacados para empezar a preparar el pedido.</p>
      </div>
    `;
  } else {
    cartItemsContainer.innerHTML = cart
      .map((item) => {
        const product = findProduct(item.id, productsData);

        if (!product) return "";

        return `
          <article class="cart-item" data-cart-id="${product.id}">
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

  const total = getCartTotal(cart, productsData);
  cartTotal.textContent = formatCurrency(total);

  if (clearCartButton) {
    clearCartButton.disabled = cart.length === 0;
  }

  if (checkoutButton) {
    checkoutButton.disabled = cart.length === 0;
  }

  updateCartBadgeLocal();
  saveCart(cart);
};

const renderProducts = () => {
  if (!featuredProductsContainer) return;

  const visibleProducts = getVisibleProducts();

  if (visibleProducts.length === 0) {
    featuredProductsContainer.innerHTML = `
      <article class="empty-results">
        <h3>Sin resultados</h3>
        <p>No encontramos productos con ese filtro. Prueba con otra busqueda o categoria.</p>
      </article>
    `;
    return;
  }

  featuredProductsContainer.innerHTML = visibleProducts
    .map((product) => {
      const media = product.image
        ? `<img src="${product.image}" alt="${product.title}" loading="lazy" />`
        : `<span>${product.mediaLabel}</span>`;

      const maxStock = getMaxStock(product);
      const inCart = getQuantityInCart(product.id, cart);
      const soldOut = maxStock <= 0;
      const lowStock = !soldOut && maxStock <= 5;
      const limitReached = inCart >= maxStock;
      const buttonLabel = soldOut
        ? "Sin stock"
        : limitReached
          ? "Tope en carrito"
          : "Agregar al carrito";
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
            ${buttonLabel}
          </button>
        </article>
      `;
    })
    .join("");
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
  renderProducts();
  setCartOpen(true, cartPanel, cartOverlay, cartButton);
  trackEvent("add_to_cart", { productId });
  showToast(`${product.title} agregado al carrito`);
};

const updateCartItem = (productId, action) => {
  if (action === "remove") {
    cart = cart.filter((item) => item.id !== productId);
    renderCart();
    renderProducts();
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
  renderProducts();
};

const setSyncTimestamp = () => {
  if (!syncTime) return;

  const now = new Date();
  syncTime.textContent = `Actualizado: ${now.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

const randomStock = () => {
  if (!itemCount) return;

  const apiStock = productsData.reduce((total, product) => total + (product.stock || 0), 0);
  const base = apiStock > 0 ? apiStock : 1432;
  const variance = apiStock > 0 ? 0 : Math.floor(Math.random() * 25);
  itemCount.textContent = (base + variance).toLocaleString("es-AR");
};

const getProductsSyncErrorMessage = (error) => {
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

const syncProductsFromApi = async ({ silent = false } = {}) => {
  if (isSyncingProducts) return;
  isSyncingProducts = true;

  try {
    const apiProducts = await fetchAllProducts({ maxPages: 50, limit: 40 });

    if (apiProducts.length === 0) {
      isSyncingProducts = false;
      return;
    }

    productsData = apiProducts;
    renderProducts();
    renderCart();
    randomStock();
    if (!silent) {
      showToast("Catalogo actualizado con stock online");
    }
  } catch (error) {
    if (!silent) {
      showToast(getProductsSyncErrorMessage(error));
    }
  } finally {
    isSyncingProducts = false;
  }
};

const handleSearch = () => {
  searchTerm = searchInput?.value || "";
  renderProducts();
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
  const popup = window.open(url, "_blank", "noopener,noreferrer");

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    window.location.href = url;
  }
};

mainNav?.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement) || target.tagName !== "A") return;

  const sectionId = target.dataset.navTarget;

  if (!sectionId) return;

  event.preventDefault();

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  mainNav.querySelectorAll("a").forEach((link) => link.classList.remove("active"));
  target.classList.add("active");
  setMenuOpen(false);
});

menuToggle?.addEventListener("click", () => {
  const isOpen = mainNav?.classList.contains("is-open");
  setMenuOpen(!isOpen);
});

searchInput?.addEventListener("input", handleSearch);
searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});
searchButton?.addEventListener("click", handleSearch);

featuredProductsContainer?.addEventListener("click", (event) => {
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
  renderProducts();
  showToast("Carrito vaciado");
});

checkoutButton?.addEventListener("click", () => {
  if (cart.length === 0) return;
  trackEvent("checkout_started", {
    itemCount: getCartQuantity(cart),
    cartTotal: getCartTotal(cart, productsData)
  });
  setCheckoutOpen(true, checkoutModal, checkoutOverlay);
});

contactWhatsAppButton?.addEventListener("click", () => {
  const message = buildConsultationMessage(cart, productsData, WHATSAPP_PHONE);
  const whatsappUrl = buildWhatsAppLink(WHATSAPP_PHONE, message);

  trackEvent("whatsapp_contact_requested", {
    context: "home_cart",
    itemCount: getCartQuantity(cart),
    cartTotal: getCartTotal(cart, productsData)
  });

  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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
        itemCount: getCartQuantity(cart),
        cartTotal: getCartTotal(cart, productsData)
      });
      trackEvent("whatsapp_checkout_redirect", { mode: "confirm" });

      redirectToWhatsApp(whatsappUrl);

      cart = [];
      renderCart();
      renderProducts();
      setCheckoutOpen(false, checkoutModal, checkoutOverlay);
      event.target.reset();
      showToast(`Pedido confirmado con ${BRAND_NAME}`);
      await syncProductsFromApi({ silent: true });
    } catch (error) {
      const assistedMessage = buildAssistedCheckoutMessage(
        cart,
        productsData,
        WHATSAPP_PHONE,
        customerData
      );
      const assistedUrl = buildWhatsAppLink(WHATSAPP_PHONE, assistedMessage);

      trackEvent("checkout_failed", {
        reason: error?.payload?.code || error?.message || "unknown"
      });
      trackEvent("whatsapp_checkout_redirect", { mode: "assist" });

      redirectToWhatsApp(assistedUrl);

      showToast(`${getOrderErrorMessage(error)}. Te abrimos WhatsApp para seguir el pedido.`);
    } finally {
      isSubmittingCheckout = false;
      setCheckoutSubmitting(false);
    }
  };

  submitOrder();
});

featuredCta?.addEventListener("click", () => {
  featuredProductsContainer?.scrollIntoView({ behavior: "smooth", block: "start" });
});

returnsLink?.addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Cambios y devoluciones: 10 dias corridos con ticket de compra");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setCartOpen(false, cartPanel, cartOverlay, cartButton);
    setMenuOpen(false);
    setCheckoutOpen(false, checkoutModal, checkoutOverlay);
  }
});

renderProducts();
renderCart();
setMenuOpen(false);
setSyncTimestamp();
randomStock();
syncProductsFromApi();

setInterval(() => {
  syncProductsFromApi({ silent: true });
}, AUTO_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncProductsFromApi({ silent: true });
  }
});

setInterval(setSyncTimestamp, 60000);
setInterval(randomStock, 5000);
