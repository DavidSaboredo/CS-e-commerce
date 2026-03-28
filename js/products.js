export const categories = [
  { name: "Subwoofers", active: true },
  { name: "Amplificadores", active: false },
  { name: "Parlantes", active: false },
  { name: "Kits de instalacion", active: false }
];

export const featuredProducts = [
  {
    id: "subwoofer-pro-12",
    title: "Subwoofer de alto rendimiento",
    category: "Subwoofers",
    subtitle: "Serie Pro 12\"",
    price: 299.99,
    image: "",
    mediaLabel: "Subwoofer",
    stock: 5
  },
  {
    id: "amplificador-4-canales",
    title: "Amplificador avanzado",
    category: "Amplificadores",
    subtitle: "4 canales competencia",
    price: 449.99,
    image: "",
    mediaLabel: "Amplificador",
    stock: 3
  },
  {
    id: "tweeter-compacto",
    title: "Tweeter compacto",
    category: "Parlantes",
    subtitle: "Agudos claros",
    price: 129.99,
    image: "",
    mediaLabel: "Tweeter",
    stock: 8
  }
];

export const catalogProducts = [
  ...featuredProducts,
  {
    id: "subwoofer-slim-10",
    title: "Subwoofer Slim",
    category: "Subwoofers",
    subtitle: "Perfil bajo 10\"",
    price: 219.99,
    image: "",
    mediaLabel: "Subwoofer Slim",
    stock: 6
  },
  {
    id: "subwoofer-spl-15",
    title: "Subwoofer SPL",
    category: "Subwoofers",
    subtitle: "Potencia extrema 15\"",
    price: 549.99,
    image: "",
    mediaLabel: "Subwoofer SPL",
    stock: 2
  },
  {
    id: "amplificador-monoblock",
    title: "Amplificador Monoblock",
    category: "Amplificadores",
    subtitle: "Clase D 1800W",
    price: 499.99,
    image: "",
    mediaLabel: "Monoblock",
    stock: 4
  },
  {
    id: "amplificador-mini",
    title: "Amplificador Mini",
    category: "Amplificadores",
    subtitle: "Compacto 2 canales",
    price: 189.99,
    image: "",
    mediaLabel: "Mini Amp",
    stock: 7
  },
  {
    id: "parlante-coaxial-6",
    title: "Parlantes Coaxiales",
    category: "Parlantes",
    subtitle: "Par 6.5\"",
    price: 139.99,
    image: "",
    mediaLabel: "Coaxiales",
    stock: 9
  },
  {
    id: "componente-premium",
    title: "Componente Premium",
    category: "Parlantes",
    subtitle: "Kit 2 vias pro",
    price: 259.99,
    image: "",
    mediaLabel: "Componentes",
    stock: 5
  },
  {
    id: "kit-cableado-4ga",
    title: "Kit de Cableado",
    category: "Kits de instalacion",
    subtitle: "4 GA completo",
    price: 89.99,
    image: "",
    mediaLabel: "Cableado",
    stock: 12
  },
  {
    id: "kit-cableado-0ga",
    title: "Kit de Cableado PRO",
    category: "Kits de instalacion",
    subtitle: "0 GA competencia",
    price: 149.99,
    image: "",
    mediaLabel: "Cableado PRO",
    stock: 8
  },
  {
    id: "bateria-agm-70",
    title: "Bateria AGM 70Ah",
    category: "Baterias",
    subtitle: "Ciclo profundo",
    price: 329.99,
    image: "",
    mediaLabel: "Bateria AGM",
    stock: 6
  },
  {
    id: "bateria-gel-90",
    title: "Bateria GEL 90Ah",
    category: "Baterias",
    subtitle: "Alta reserva",
    price: 419.99,
    image: "",
    mediaLabel: "Bateria GEL",
    stock: 4
  },
  {
    id: "capacitor-5f",
    title: "Capacitor Digital",
    category: "Accesorios",
    subtitle: "5 Farad",
    price: 99.99,
    image: "",
    mediaLabel: "Capacitor",
    stock: 10
  },
  {
    id: "procesador-audio-dsp",
    title: "Procesador DSP",
    category: "Accesorios",
    subtitle: "8 canales",
    price: 379.99,
    image: "",
    mediaLabel: "DSP",
    stock: 3
  }
];
