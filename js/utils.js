// Funciones utilitarias compartidas entre main.js y catalog.js
import { BRAND_NAME, STORAGE_KEY } from "./config.js";

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

export const getCartQuantity = (cart) => cart.reduce((total, item) => total + item.quantity, 0);

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

const normalizeProductId = (value) => {
  const numericId = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numericId) ? numericId : String(value ?? "");
};

export const buildOrderPayload = (cart, productsData, customerData) => ({
  channel: "web",
  source: "ecommerce",
  customer: {
    name: customerData.name,
    phone: customerData.phone,
    zone: customerData.zone,
    delivery: customerData.delivery,
    notes: customerData.notes || ""
  },
  items: cart
    .map((item) => {
      const product = findProduct(item.id, productsData);

      if (!product) return null;

      return {
        productId: normalizeProductId(product.id),
        quantity: item.quantity,
        title: product.title,
        unitPrice: product.price
      };
    })
    .filter(Boolean)
});

export const getOrderErrorMessage = (error) => {
  const payload = error?.payload;

  if (payload?.code === "ORDER_API_NOT_CONFIGURED") {
    return "La API de pedidos aun no esta configurada para descontar stock real";
  }

  if (payload?.code === "INSUFFICIENT_STOCK") {
    return "El stock cambio mientras armabas el pedido. Revisa cantidades y vuelve a intentar";
  }

  return payload?.message || error?.message || "No se pudo confirmar el pedido";
};

const getCartMessageLines = (cart, productsData) =>
  cart
    .map((item) => {
      const product = findProduct(item.id, productsData);
      if (!product) return null;
      return `- ${product.title} x${item.quantity} (${formatCurrency(product.price)})`;
    })
    .filter(Boolean);

const getCustomerMessageLines = (customerData = {}) => {
  const { name, phone, zone, delivery, notes } = customerData;

  return [
    "Datos del cliente:",
    `Nombre: ${name || "Sin informar"}`,
    `Telefono: ${phone || "Sin informar"}`,
    `Zona/Ciudad: ${zone || "Sin informar"}`,
    `Entrega: ${delivery || "Sin informar"}`,
    `Comentarios: ${notes || "Sin comentarios"}`
  ];
};

const encodeWhatsAppMessage = (lines) => encodeURIComponent(lines.join("\n"));

export const buildWhatsAppLink = (phone, encodedMessage) => {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  const message = String(encodedMessage || "");
  return `https://wa.me/${cleanPhone}?text=${message}`;
};

const buildWhatsAppMessageByMode = (mode, cart, productsData, customerData) => {
  const productLines = getCartMessageLines(cart, productsData);
  const total = formatCurrency(getCartTotal(cart, productsData));

  if (mode === "assist") {
    return [
      `Hola ${BRAND_NAME}, no pude confirmar stock automatico y necesito ayuda para cerrar este pedido:`,
      "",
      ...(productLines.length > 0 ? productLines : ["- Carrito vacio"]),
      "",
      `Total estimado: ${total}`,
      "",
      ...getCustomerMessageLines(customerData)
    ];
  }

  if (mode === "quote") {
    return [
      `Hola ${BRAND_NAME}, quiero asesoria para armar este pedido:`,
      "",
      ...(productLines.length > 0 ? productLines : ["- Aun no agregue productos"]),
      "",
      `Total estimado: ${total}`,
      "",
      ...getCustomerMessageLines(customerData)
    ];
  }

  return [
    `Hola ${BRAND_NAME}, quiero confirmar este pedido:`,
    "",
    ...productLines,
    "",
    `Total: ${total}`,
    "",
    ...getCustomerMessageLines(customerData)
  ];
};

export const buildCheckoutMessage = (cart, productsData, WHATSAPP_PHONE, customerData) => {
  return encodeWhatsAppMessage(
    buildWhatsAppMessageByMode("confirm", cart, productsData, customerData)
  );
};

export const buildAssistedCheckoutMessage = (cart, productsData, WHATSAPP_PHONE, customerData) => {
  return encodeWhatsAppMessage(
    buildWhatsAppMessageByMode("assist", cart, productsData, customerData)
  );
};

export const buildConsultationMessage = (cart, productsData, WHATSAPP_PHONE, customerData = {}) => {
  return encodeWhatsAppMessage(
    buildWhatsAppMessageByMode("quote", cart, productsData, customerData)
  );
};
