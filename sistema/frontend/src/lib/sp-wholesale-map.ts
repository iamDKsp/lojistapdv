export type SpWholesaleRegionCode =
  | 'BRAS'
  | 'VINTE_CINCO_MARCO'
  | 'BOM_RETIRO'
  | 'FEIRINHA_MADRUGADA';

export interface WholesaleSupplierItem {
  id: string;
  supplierId?: string;
  name: string;
  category: string;
  imageUrl: string;
  wholesalePrice: number;
  suggestedRetailPrice: number;
  sizesLabel: string;
  colorsLabel: string;
  minPackQty: number;
  isPreviewSix: boolean;
  sortOrder: number;
  active?: boolean;
}

export interface WholesaleSupplier {
  id: string;
  name: string;
  region: SpWholesaleRegionCode | string;
  address: string;
  galleryName: string | null;
  lat: number;
  lng: number;
  whatsapp: string;
  coverImageUrl: string;
  logoUrl: string | null;
  categories: string[];
  minOrderValue: number;
  minOrderPieces: number;
  verified: boolean;
  guaranteedDelivery: boolean;
  shippingMethods: string;
  description: string | null;
  openingHours: string;
  active: boolean;
  featuredOrder: number;
  items: WholesaleSupplierItem[];
}

export const SP_MAP_BOUNDS = {
  minLat: -23.5485,
  maxLat: -23.5255,
  minLng: -46.6425,
  maxLng: -46.6115,
} as const;

export const SP_WHOLESALE_REGIONS = [
  { id: 'ALL', label: 'Todos os Polos SP', shortLabel: 'Centro SP', lat: -23.537, lng: -46.627 },
  { id: 'BRAS', label: 'Brás (R. Oriente / R. Miller)', shortLabel: 'Brás', lat: -23.5362, lng: -46.6175 },
  {
    id: 'FEIRINHA_MADRUGADA',
    label: 'Feirinha da Madrugada',
    shortLabel: 'Feirinha da Madrugada',
    lat: -23.5335,
    lng: -46.6212,
  },
  {
    id: 'VINTE_CINCO_MARCO',
    label: '25 de Março & Ladeira Porto Geral',
    shortLabel: '25 de Março',
    lat: -23.5442,
    lng: -46.633,
  },
  { id: 'BOM_RETIRO', label: 'Bom Retiro (R. José Paulino)', shortLabel: 'Bom Retiro', lat: -23.5294, lng: -46.6378 },
] as const;

export function getRegionLabel(region: string): string {
  const found = SP_WHOLESALE_REGIONS.find((r) => r.id === region);
  if (found) return found.shortLabel;
  return region;
}

export const SP_WHOLESALE_CATEGORIES = [
  'Todas as Peças',
  'Camisetas',
  'Jeans & Calças',
  'Bermudas',
  'Bonés',
  'Relógios',
  'Óculos & Acessórios',
] as const;

export const DEMO_CATALOG_PHOTOS = [
  { label: 'Camiseta Preta Peruana', url: '/demo-catalogo/fotos/camiseta-preta.png', category: 'Camisetas' },
  { label: 'Camiseta Branca Pima', url: '/demo-catalogo/fotos/camiseta-branca.jpg', category: 'Camisetas' },
  { label: 'Camiseta Azul Marinho', url: '/demo-catalogo/fotos/camiseta-marinho.jpg', category: 'Camisetas' },
  { label: 'Camiseta Verde Militar', url: '/demo-catalogo/fotos/camiseta-verde.jpg', category: 'Camisetas' },
  { label: 'Calça Jeans Índigo', url: '/demo-catalogo/fotos/calca-jeans-indigo.jpg', category: 'Jeans & Calças' },
  { label: 'Calça Jeans Azul Destroyed', url: '/demo-catalogo/fotos/calca-jeans-azul.jpg', category: 'Jeans & Calças' },
  { label: 'Calça Jeans Casual', url: '/demo-catalogo/fotos/calca-jeans-casual.jpg', category: 'Jeans & Calças' },
  { label: 'Calça Jogger Sarja Bege', url: '/demo-catalogo/fotos/calca-jogger-bege.jpg', category: 'Jeans & Calças' },
  { label: 'Bermuda Sarja Bege', url: '/demo-catalogo/fotos/bermuda-bege.jpg', category: 'Bermudas' },
  { label: 'Bermuda Linho Branca', url: '/demo-catalogo/fotos/bermuda-branca.jpg', category: 'Bermudas' },
  { label: 'Bermuda Jeans Destroyed', url: '/demo-catalogo/fotos/bermuda-jeans.png', category: 'Bermudas' },
  { label: 'Bermuda Chino Marinho', url: '/demo-catalogo/fotos/bermuda-marinho.jpg', category: 'Bermudas' },
  { label: 'Boné Trucker Preto', url: '/demo-catalogo/fotos/bone-preto.jpg', category: 'Bonés' },
  { label: 'Boné Dad Hat Bege', url: '/demo-catalogo/fotos/bone-bege.jpg', category: 'Bonés' },
  { label: 'Boné Aba Curva Branco', url: '/demo-catalogo/fotos/bone-branco.jpg', category: 'Bonés' },
  { label: 'Boné Snapback Marinho', url: '/demo-catalogo/fotos/bone-marinho.jpg', category: 'Bonés' },
  { label: 'Óculos Aviador Polarizado', url: '/demo-catalogo/fotos/oculos-aviador.jpg', category: 'Óculos & Acessórios' },
  { label: 'Óculos Esportivo UV400', url: '/demo-catalogo/fotos/oculos-esportivo.webp', category: 'Óculos & Acessórios' },
  { label: 'Óculos Gatinho Acetato', url: '/demo-catalogo/fotos/oculos-gatinho.jpg', category: 'Óculos & Acessórios' },
  { label: 'Óculos Quadrado Preto', url: '/demo-catalogo/fotos/oculos-preto.jpg', category: 'Óculos & Acessórios' },
  { label: 'Relógio Cronógrafo Dourado', url: '/demo-catalogo/fotos/relogio-dourado.jpg', category: 'Relógios' },
  { label: 'Relógio Executivo Prata', url: '/demo-catalogo/fotos/relogio-prata.jpg', category: 'Relógios' },
  { label: 'Relógio Pulseira Couro', url: '/demo-catalogo/fotos/relogio-couro.jpg', category: 'Relógios' },
  { label: 'Relógio Digital Sport', url: '/demo-catalogo/fotos/relogio-digital.jpg', category: 'Relógios' },
] as const;

export function latLngToMapPercent(lat: number, lng: number): { x: number; y: number } {
  const rawX = ((lng - SP_MAP_BOUNDS.minLng) / (SP_MAP_BOUNDS.maxLng - SP_MAP_BOUNDS.minLng)) * 100;
  const rawY = ((SP_MAP_BOUNDS.maxLat - lat) / (SP_MAP_BOUNDS.maxLat - SP_MAP_BOUNDS.minLat)) * 100;

  return {
    x: Math.max(6, Math.min(94, Number(rawX.toFixed(2)))),
    y: Math.max(8, Math.min(92, Number(rawY.toFixed(2)))),
  };
}

export function mapPercentToLatLng(xPercent: number, yPercent: number): { lat: number; lng: number } {
  const clampedX = Math.max(0, Math.min(100, xPercent));
  const clampedY = Math.max(0, Math.min(100, yPercent));

  const lng = SP_MAP_BOUNDS.minLng + (clampedX / 100) * (SP_MAP_BOUNDS.maxLng - SP_MAP_BOUNDS.minLng);
  const lat = SP_MAP_BOUNDS.maxLat - (clampedY / 100) * (SP_MAP_BOUNDS.maxLat - SP_MAP_BOUNDS.minLat);

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

export function formatWhatsAppHref(whatsapp: string, message: string): string {
  const clean = String(whatsapp || '').replace(/\D/g, '');
  const fullPhone = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
