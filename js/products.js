// Catálogo de la tienda (se usa mientras el stock online está apagado en config.js).
// Fotos de Unsplash (licencia libre, uso comercial permitido), servidas desde su CDN.
const foto = (id) => `https://images.unsplash.com/photo-${id}?w=640&h=400&fit=crop&q=70&auto=format`;

export const categories = [
  { name: "Baterías", active: true },
  { name: "Subwoofers", active: false },
  { name: "Parlantes", active: false },
  { name: "Estéreos", active: false },
  { name: "Potencias y procesadores", active: false },
  { name: "Accesorios", active: false }
];

export const featuredProducts = [
  {
    id: "subwoofer-12-cajon",
    title: "Subwoofer 12\" en cajón",
    category: "Subwoofers",
    subtitle: "Cajón sellado, listo para instalar",
    price: 189000,
    image: foto("1643067215158-debf59cb504c"),
    mediaLabel: "Subwoofer",
    stock: 4
  },
  {
    id: "bateria-12x65",
    title: "Batería 12x65",
    category: "Baterías",
    subtitle: "Libre de mantenimiento · con colocación",
    price: 165000,
    image: foto("1765211003026-f7666ea3a948"),
    mediaLabel: "Batería",
    stock: 12
  },
  {
    id: "kit-componentes-65",
    title: "Kit de componentes 6,5\"",
    category: "Parlantes",
    subtitle: "Woofer, tweeter y crossover",
    price: 98000,
    image: foto("1529911684551-bfe3a8553f19"),
    mediaLabel: "Componentes",
    stock: 6
  }
];

export const catalogProducts = [
  ...featuredProducts,
  {
    id: "bateria-12x75",
    title: "Batería 12x75 reforzada",
    category: "Baterías",
    subtitle: "Para autos con equipo de audio",
    price: 198000,
    image: foto("1764122623556-90a7d480df53"),
    mediaLabel: "Batería",
    stock: 8
  },
  {
    id: "bateria-12x45",
    title: "Batería 12x45",
    category: "Baterías",
    subtitle: "Para autos chicos y motos grandes",
    price: 128000,
    image: foto("1742899273038-67ff67477663"),
    mediaLabel: "Batería",
    stock: 10
  },
  {
    id: "subwoofer-10-doble-bobina",
    title: "Subwoofer 10\" doble bobina",
    category: "Subwoofers",
    subtitle: "Ideal para cajón chico",
    price: 115000,
    image: foto("1771611755359-bcd64deecce3"),
    mediaLabel: "Subwoofer",
    stock: 5
  },
  {
    id: "parlantes-6x9",
    title: "Parlantes 6x9\" coaxiales",
    category: "Parlantes",
    subtitle: "Par, 3 vías, para bandeja trasera",
    price: 64000,
    image: foto("1703528696307-c9008a679141"),
    mediaLabel: "Parlantes 6x9",
    stock: 7
  },
  {
    id: "parlantes-65-puertas",
    title: "Parlantes 6,5\" para puertas",
    category: "Parlantes",
    subtitle: "Par, reemplazo directo de fábrica",
    price: 46000,
    image: foto("1608538770329-65941f62f9f8"),
    mediaLabel: "Parlantes 6,5",
    stock: 9
  },
  {
    id: "tweeter-compacto",
    title: "Tweeter compacto",
    category: "Parlantes",
    subtitle: "Par, con capacitor de protección",
    price: 28000,
    image: foto("1687858477673-267e301cb186"),
    mediaLabel: "Tweeter",
    stock: 14
  },
  {
    id: "estereo-multimedia-7",
    title: "Estéreo multimedia 7\"",
    category: "Estéreos",
    subtitle: "Pantalla táctil, Bluetooth y cámara de retroceso",
    price: 145000,
    image: foto("1592570714618-15e2d4719c6c"),
    mediaLabel: "Estéreo",
    stock: 5
  },
  {
    id: "estereo-1din-bluetooth",
    title: "Estéreo 1 DIN Bluetooth",
    category: "Estéreos",
    subtitle: "USB, radio y manos libres",
    price: 52000,
    image: foto("1523987659364-8ad26ea657ef"),
    mediaLabel: "Estéreo",
    stock: 11
  },
  {
    id: "procesador-dsp-8",
    title: "Procesador DSP 8 canales",
    category: "Potencias y procesadores",
    subtitle: "Ajuste fino del sonido desde el celular",
    price: 210000,
    image: foto("1756575959912-9da92ce35af3"),
    mediaLabel: "Procesador DSP",
    stock: 3
  },
  {
    id: "potencia-compacta-2",
    title: "Potencia compacta 2 canales",
    category: "Potencias y procesadores",
    subtitle: "Entra debajo del asiento",
    price: 89000,
    image: foto("1687858490665-68306e08c364"),
    mediaLabel: "Potencia",
    stock: 6
  },
  {
    id: "kit-cables-potencia",
    title: "Kit de instalación para potencia",
    category: "Accesorios",
    subtitle: "Cable, portafusible y terminales",
    price: 38000,
    image: foto("1687858490533-0c1c33f152ec"),
    mediaLabel: "Kit de instalación",
    stock: 15
  }
];
