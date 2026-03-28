# CS Baterias y Audio - E-commerce

E-commerce estático de Baterías y Audio Automotriz. Sitio web moderno con carrito, filtros, integración con API en vivo y checkout vía WhatsApp.

## 🎯 Características

- **Catálogo dinámico** con búsqueda, filtros por categoría, precio y ordenamiento
- **Carrito persistente** guardado en localStorage
- **Sincronización en vivo** de stock cada 30 segundos + al volver a la pestaña
- **Control de stock** — impide comprar más unidades de las disponibles
- **Checkout directo** — recoge datos del cliente y envía pedido a WhatsApp
- **Diseño responsive** — optimizado para mobile, tablet y desktop
- **Sin login** — experiencia de compra directa y sin fricciones
- **SPA amigable** — navegación suave entre Home y Catálogo

## 📁 Estructura del Proyecto

```
.
├── index.html              # Home page (productos destacados)
├── catalog.html            # Página de catálogo completo con filtros
├── css/
│   └── styles.css          # Estilos únicos (responsive)
├── js/
│   ├── config.js           # Configuración centralizada (constantes)
│   ├── api.js              # Cliente API con normalización de datos
│   ├── utils.js            # Funciones compartidas entre páginas
│   ├── products.js         # Datos locales de fallback
│   ├── main.js             # Lógica de Home
│   └── catalog.js          # Lógica de Catálogo
├── img/
│   ├── logo-2.png
│   ├── logo-3.png
│   ├── banner.png
│   └── banner2.png
├── .gitignore              # Archivos a ignorar en Git
├── vercel.json             # Configuración de deploy en Vercel
└── README.md               # Este archivo
```

## 🚀 Configuración Local

### Requisitos
- Node.js + npm (opcional, solo si quisiera agregar build tools en el futuro)
- Navegador moderno (Chrome, Firefox, Safari, Edge)

### Instalación

1. **Clonar el repositorio**:
   ```sh
   git clone https://github.com/Laruzo/cs-baterias-audio.git
   cd cs-baterias-audio
   ```

2. **Servir localmente** (opción A - Python):
   ```sh
   python -m http.server 5500
   # Luego abre http://localhost:5500
   ```

   O (opción B - Node.js):
   ```sh
   npx http-server -p 5500
   # Luego abre http://localhost:5500
   ```

3. ¡Listo! El sitio correrá en `http://localhost:5500`

## 🔧 Configuración de Constantes

Edita `js/config.js` para cambiar:

```javascript
export const WHATSAPP_PHONE = "5493442461830";  // Número de WhatsApp
export const STORAGE_KEY = "cs-baterias-cart";  // Clave localStorage
export const AUTO_REFRESH_MS = 30000;           // Sync automático cada 30s
export const PAGE_SIZE = 8;                     // Productos por página
```

## 🌐 API Integration

### URL Activa
```
https://cs-audio-baterias.vercel.app/api/public/products
```

### Formato de Respuesta
```json
{
  "data": [
    {
      "id": "1",
      "brand": "CS Audio",
      "model": "XT-1000",
      "displayName": "Amplificador CS Audio XT-1000",
      "category": "Amplificadores",
      "price": 15000,
      "stock": 5,
      "imageUrl": "https://...",
      "available": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

## 💾 LocalStorage

**Clave**: `cs-baterias-cart`

**Formato**:
```json
[
  { "id": "producto-1", "quantity": 2 },
  { "id": "producto-2", "quantity": 1 }
]
```

## 📱 Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| < 720px | Mobile (1 col grillas, nav hamburguesa) |
| 720px - 1024px | Tablet (2-3 cols) |
| > 1024px | Desktop (3-4 cols) |

## 🚢 Deploy en Vercel

### Opción 1: via CLI
```sh
npm install -g vercel
vercel
```

### Opción 2: via GitHub (recomendado)
1. Sube el repo a GitHub
2. Va a vercel.com → New Project → Import GitHub
3. Selecciona el repo
4. Deploy automático en cada push

### Configuración en Vercel
- **Framework**: Static
- **Build Command**: (vacío)
- **Output Directory**: . (raíz)

## 🛠️ Tecnologías

- **HTML5** — Semántico y accesible (ARIA labels)
- **CSS3** — Responsivo, sin frameworks
- **JavaScript (ES Modules)** — Vanilla JS moderno sin dependencias
- **LocalStorage API** — Persistencia de carrito
- **WhatsApp Web API** — Integración de checkout

## 📋 Checklist de Desarrollo

- [x] Home con productos destacados
- [x] Catálogo con filtros y paginación
- [x] Carrito con cantidad y precios
- [x] Control de stock en vivo
- [x] Checkout con formulario
- [x] Integración con WhatsApp
- [x] Mobile responsive
- [x] Auto-refresh 30s
- [x] Sincronización de stock
- [x] Fallback de datos locales
- [ ] Admin panel para stock (futuro)
- [ ] Sistema de pagos online (futuro)

## 📞 Soporte

**WhatsApp**: [+54 3442 461830](https://wa.me/5493442461830)  
**Email**: laruzo_da@hotmail.com  
**Teléfono Técnico**: [+54 3442 462463](https://wa.me/5493442462463)

## 📄 Licencia

MIT License — Libre para usar y modificar.

---

**Desarrollado por**: Laruzo  
**Última actualización**: Marzo 2026

