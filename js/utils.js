// Funciones utilitarias compartidas entre main.js y catalog.js
import { STORAGE_KEY } from "./config.js";

export const formatCurrency = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2
  }).format(value);

export const normalizeText = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function loadCart() {
  try {
    const savedCart = window.localStorage.getItem(STORAGE_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch {
    return [];
  }
}

export const saveCart = (cart) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
};

export const showToast = (message, toastElement, toastTimerRef) => {
  if (!toastElement) return;

  toastElement.textContent = message;
  toastElement.classList.add("is-visible");

  if (toastTimerRef.current) {
    window.clearTimeout(toastTimerRef.current);
  }

  toastTimerRef.current = window.setTimeout(() => {
    toastElement.classList.remove("is-visible");
  }, 2200);
};

export const findProduct = (productId, productsData) =>
  productsData.find((product) => product.id === productId);

export const getMaxStock = (product) => {
  const parsed = Number.parseInt(String(product?.stock ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 9999;
};

export const getQuantityInCart = (productId, cart = []) => {
  if (!Array.isArray(cart)) return 0;
  return cart.find((item) => item.id === productId)?.quantity || 0;
};

export const getCartQuantity = (cart) =>
  cart.reduce((total, item) => total + item.quantity, 0);

export const getCartTotal = (cart, productsData) =>
  cart.reduce((total, item) => {
    const product = findProduct(item.id, productsData);
    return product ? total + product.price * item.quantity : total;
  }, 0);

export const setCartOpen = (isOpen, cartPanel, cartOverlay, cartButton) => {
  if (!cartPanel || !cartOverlay || !cartButton) return;

  cartPanel.classList.toggle("is-open", isOpen);
  cartOverlay.hidden = !isOpen;
  cartOverlay.classList.toggle("is-visible", isOpen);
  cartPanel.setAttribute("aria-hidden", String(!isOpen));
  cartButton.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("cart-open", isOpen);
};

export const setCheckoutOpen = (isOpen, checkoutModal, checkoutOverlay) => {
  if (!checkoutModal || !checkoutOverlay) return;

  checkoutModal.classList.toggle("is-open", isOpen);
  checkoutOverlay.hidden = !isOpen;
  checkoutOverlay.classList.toggle("is-visible", isOpen);
  checkoutModal.setAttribute("aria-hidden", String(!isOpen));
  document.body.classList.toggle("checkout-open", isOpen);
};

export const updateCartBadge = (cartCount, cart) => {
  if (!cartCount) return;
  cartCount.textContent = String(getCartQuantity(cart));
};

export const buildCheckoutMessage = (cart, productsData, WHATSAPP_PHONE, customerData) => {
  const lines = cart
    .map((item) => {
      const product = findProduct(item.id, productsData);
      if (!product) return null;
      return `- ${product.title} x${item.quantity} (${formatCurrency(product.price)})`;
    })
    .filter(Boolean);

  const total = formatCurrency(getCartTotal(cart, productsData));
  const { name, phone, zone, delivery, notes } = customerData;
  return [
    "Hola CS Baterias y Audio, quiero confirmar este pedido:",
    "",
    ...lines,
    "",
    `Total: ${total}`,
    "",
    "Datos del cliente:",
    `Nombre: ${name}`,
    `Telefono: ${phone}`,
    `Zona/Ciudad: ${zone}`,
    `Entrega: ${delivery}`,
    `Comentarios: ${notes || "Sin comentarios"}`
  ].join("%0A");
};
