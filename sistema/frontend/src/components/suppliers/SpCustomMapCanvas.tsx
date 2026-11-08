'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Plus,
  Minus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  WholesaleSupplier,
  latLngToMapPercent,
  mapPercentToLatLng,
  getRegionLabel,
} from '@/lib/sp-wholesale-map';

interface SpCustomMapCanvasProps {
  suppliers: WholesaleSupplier[];
  selectedSupplierId: string | null;
  onSelectSupplier: (supplier: WholesaleSupplier) => void;
  activeRegion?: string;
  adminPinPos?: { lat: number; lng: number } | null;
  onPickCoordinates?: (coords: { lat: number; lng: number }) => void;
  className?: string;
}

export function SpCustomMapCanvas({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  activeRegion = 'ALL',
  adminPinPos = null,
  onPickCoordinates,
  className = '',
}: SpCustomMapCanvasProps) {
  const [zoom, setZoom] = useState<number>(1);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPickCoordinates) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const coords = mapPercentToLatLng(xPct, yPct);
    onPickCoordinates(coords);
  };

  const getLowestPrice = (supplier: WholesaleSupplier) => {
    if (!supplier.items || supplier.items.length === 0) return null;
    const prices = supplier.items.map((i) => Number(i.wholesalePrice)).filter((n) => n > 0);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-page select-none ${className}`}
      style={{ minHeight: '520px' }}
    >
      {/* Top Map HUD Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-support text-brand">
            <Navigation className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink">
                Mapa Atacado SP • Brás, 25 de Março & Bom Retiro
              </span>
              <span className="rounded-md bg-support px-1.5 py-0.5 text-[10px] font-bold text-brand">
                {suppliers.length} {suppliers.length === 1 ? 'fornecedor' : 'fornecedores'}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              {onPickCoordinates
                ? 'Modo Admin Sys-Init: clique em qualquer rua do mapa para definir a posição do pino da loja'
                : 'Clique em um marcador com foto para abrir a vitrine rápida da loja à direita'}
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink hover:bg-support hover:text-brand transition-colors"
            title="Diminuir zoom"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-[11px] font-bold text-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.15).toFixed(2))))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink hover:bg-support hover:text-brand transition-colors"
            title="Aumentar zoom"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-support hover:text-brand transition-colors"
              title="Restaurar visão"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map Vector Stage */}
      <div
        onClick={handleCanvasClick}
        className={`relative h-full w-full transition-transform duration-300 ease-out ${
          onPickCoordinates ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{
          minHeight: '520px',
          transform: `scale(${zoom})`,
          transformOrigin:
            activeRegion === 'BRAS'
              ? '78% 46%'
              : activeRegion === 'VINTE_CINCO_MARCO'
                ? '31% 80%'
                : activeRegion === 'BOM_RETIRO'
                  ? '18% 20%'
                  : activeRegion === 'FEIRINHA_MADRUGADA'
                    ? '66% 34%'
                    : '50% 50%',
        }}
      >
        {/* Custom Cartography SVG of Central São Paulo Wholesale Zones */}
        <svg
          viewBox="0 0 1000 650"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Base Urban Blocks Background */}
          <rect width="1000" height="650" fill="#F8F7FC" />

          {/* Subtle Urban Grid Blocks */}
          <g stroke="#E5E1ED" strokeWidth="1" fill="#FFFFFF">
            {/* Bom Retiro Blocks (Northwest) */}
            <rect x="40" y="55" width="95" height="60" rx="6" />
            <rect x="148" y="55" width="110" height="60" rx="6" />
            <rect x="40" y="128" width="95" height="68" rx="6" />
            <rect x="148" y="128" width="110" height="68" rx="6" />

            {/* Luz / Parque Blocks */}
            <rect x="275" y="65" width="125" height="125" rx="14" fill="#F3E8FF" stroke="#7C3AED" strokeDasharray="4 4" />

            {/* 25 de Março / Centro Histórico Blocks (Southwest) */}
            <rect x="160" y="390" width="110" height="75" rx="6" />
            <rect x="284" y="390" width="115" height="75" rx="6" />
            <rect x="160" y="480" width="110" height="85" rx="6" />
            <rect x="284" y="480" width="115" height="85" rx="6" />
            <rect x="48" y="420" width="98" height="120" rx="6" />

            {/* Feirinha da Madrugada / Pari Blocks (North-East / Center-East) */}
            <rect x="565" y="120" width="150" height="90" rx="10" fill="#F3E8FF" stroke="#7C3AED" />
            <rect x="730" y="120" width="115" height="90" rx="6" />
            <rect x="565" y="226" width="150" height="68" rx="6" />

            {/* Brás Wholesale Heart Blocks (East) */}
            <rect x="640" y="315" width="130" height="72" rx="6" />
            <rect x="784" y="315" width="155" height="72" rx="6" />
            <rect x="640" y="402" width="130" height="78" rx="6" />
            <rect x="784" y="402" width="155" height="78" rx="6" />
            <rect x="640" y="495" width="130" height="80" rx="6" />
            <rect x="784" y="495" width="155" height="80" rx="6" />
          </g>

          {/* Highlighted Wholesale District Zones (Polos de Atacado) */}
          {/* Bom Retiro Zone */}
          <rect
            x="30"
            y="45"
            width="240"
            height="165"
            rx="18"
            fill="#F3E8FF"
            fillOpacity={activeRegion === 'BOM_RETIRO' ? '0.65' : '0.32'}
            stroke="#7C3AED"
            strokeWidth={activeRegion === 'BOM_RETIRO' ? '2.5' : '1.2'}
            strokeDasharray="6 4"
          />

          {/* 25 de Março Zone */}
          <rect
            x="145"
            y="375"
            width="270"
            height="205"
            rx="18"
            fill="#F3E8FF"
            fillOpacity={activeRegion === 'VINTE_CINCO_MARCO' ? '0.65' : '0.32'}
            stroke="#7C3AED"
            strokeWidth={activeRegion === 'VINTE_CINCO_MARCO' ? '2.5' : '1.2'}
            strokeDasharray="6 4"
          />

          {/* Feirinha da Madrugada Zone */}
          <rect
            x="550"
            y="108"
            width="305"
            height="188"
            rx="18"
            fill="#F3E8FF"
            fillOpacity={activeRegion === 'FEIRINHA_MADRUGADA' ? '0.65' : '0.32'}
            stroke="#7C3AED"
            strokeWidth={activeRegion === 'FEIRINHA_MADRUGADA' ? '2.5' : '1.2'}
            strokeDasharray="6 4"
          />

          {/* Brás Zone */}
          <rect
            x="622"
            y="302"
            width="332"
            height="285"
            rx="18"
            fill="#F3E8FF"
            fillOpacity={activeRegion === 'BRAS' ? '0.65' : '0.32'}
            stroke="#7C3AED"
            strokeWidth={activeRegion === 'BRAS' ? '2.5' : '1.2'}
            strokeDasharray="6 4"
          />

          {/* Rio Tamanduateí & Av. do Estado (Diagonal Corridor separating Centro/25 de Março and Brás) */}
          <path
            d="M 430 0 C 455 180, 480 340, 535 650"
            stroke="#E5E1ED"
            strokeWidth="28"
            fill="none"
          />
          <path
            d="M 430 0 C 455 180, 480 340, 535 650"
            stroke="#F3E8FF"
            strokeWidth="12"
            fill="none"
          />

          {/* Major Avenues & Wholesale Streets */}
          <g stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" fill="none">
            {/* Rua José Paulino (Bom Retiro) */}
            <line x1="35" y1="120" x2="265" y2="120" />
            {/* Av. Tiradentes */}
            <line x1="270" y1="20" x2="295" y2="380" />
            {/* Rua 25 de Março */}
            <line x1="280" y1="360" x2="280" y2="600" />
            {/* Ladeira Porto Geral */}
            <line x1="150" y1="472" x2="415" y2="472" />
            {/* Rua Monsenhor Andrade (Feirinha da Madrugada) */}
            <line x1="540" y1="218" x2="960" y2="218" />
            {/* Rua Miller (Brás) */}
            <line x1="600" y1="308" x2="960" y2="308" />
            {/* Rua Oriente (Brás) */}
            <line x1="600" y1="395" x2="965" y2="395" />
            {/* Rua Maria Marcolina / Barão de Ladário */}
            <line x1="600" y1="488" x2="965" y2="488" />
            {/* Eixo Norte-Sul Brás (Rua Barão de Ladário / Rua Bresser) */}
            <line x1="776" y1="115" x2="776" y2="610" />
          </g>

          {/* Street Outlines */}
          <g stroke="#E5E1ED" strokeWidth="1.5" strokeDasharray="3 3" fill="none">
            <line x1="35" y1="120" x2="265" y2="120" />
            <line x1="280" y1="360" x2="280" y2="600" />
            <line x1="150" y1="472" x2="415" y2="472" />
            <line x1="540" y1="218" x2="960" y2="218" />
            <line x1="600" y1="308" x2="960" y2="308" />
            <line x1="600" y1="395" x2="965" y2="395" />
            <line x1="600" y1="488" x2="965" y2="488" />
            <line x1="776" y1="115" x2="776" y2="610" />
          </g>

          {/* CPTM / Metro Railway Line */}
          <path
            d="M 180 235 Q 480 285 980 565"
            stroke="#665F70"
            strokeWidth="2.5"
            strokeDasharray="8 6"
            fill="none"
          />

          {/* District & Street Labels */}
          <g fontFamily="Segoe UI, Inter, sans-serif">
            {/* Zone Badges */}
            <text x="52" y="72" fill="#7C3AED" fontSize="13" fontWeight="800" letterSpacing="0.06em">
              POLO BOM RETIRO
            </text>
            <text x="52" y="114" fill="#665F70" fontSize="11" fontWeight="600">
              Rua José Paulino • Moda & Tricot
            </text>

            <text x="572" y="142" fill="#7C3AED" fontSize="13" fontWeight="800" letterSpacing="0.06em">
              FEIRINHA DA MADRUGADA
            </text>
            <text x="572" y="212" fill="#665F70" fontSize="11" fontWeight="600">
              Rua Monsenhor Andrade • Circuito de Compras
            </text>

            <text x="642" y="334" fill="#7C3AED" fontSize="14" fontWeight="800" letterSpacing="0.06em">
              POLO BRÁS ATACADO
            </text>
            <text x="642" y="302" fill="#665F70" fontSize="11" fontWeight="600">
              Rua Miller (Jeans & Sarja)
            </text>
            <text x="642" y="388" fill="#665F70" fontSize="11" fontWeight="600">
              Rua Oriente (Malharia & Pima)
            </text>
            <text x="642" y="482" fill="#665F70" fontSize="11" fontWeight="600">
              Rua Barão de Ladário & Maria Marcolina
            </text>

            <text x="162" y="405" fill="#7C3AED" fontSize="13" fontWeight="800" letterSpacing="0.06em">
              POLO 25 DE MARÇO
            </text>
            <text x="162" y="465" fill="#665F70" fontSize="11" fontWeight="600">
              Ladeira Porto Geral & Rua 25 de Março
            </text>

            {/* Av do Estado Label */}
            <text
              x="468"
              y="310"
              fill="#665F70"
              fontSize="10"
              fontWeight="700"
              transform="rotate(78 468 310)"
            >
              AV. DO ESTADO / RIO TAMANDUATEÍ
            </text>

            {/* Subway / Train Station Markers */}
            <g transform="translate(295, 222)">
              <rect x="0" y="0" width="96" height="22" rx="6" fill="#272321" />
              <text x="48" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700">
                METRÔ LUZ
              </text>
            </g>

            <g transform="translate(215, 345)">
              <rect x="0" y="0" width="118" height="22" rx="6" fill="#272321" />
              <text x="59" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700">
                METRÔ SÃO BENTO
              </text>
            </g>

            <g transform="translate(650, 545)">
              <rect x="0" y="0" width="112" height="22" rx="6" fill="#272321" />
              <text x="56" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700">
                ESTAÇÃO BRÁS
              </text>
            </g>
          </g>
        </svg>

        {/* Supplier Photo-Preview Pins */}
        {suppliers.map((supplier) => {
          const pos = latLngToMapPercent(supplier.lat, supplier.lng);
          const isSelected = supplier.id === selectedSupplierId;
          const minPrice = getLowestPrice(supplier);
          const previewPhoto =
            supplier.coverImageUrl ||
            supplier.items?.[0]?.imageUrl ||
            '/demo-catalogo/fotos/camiseta-preta.png';

          return (
            <button
              key={supplier.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSupplier(supplier);
              }}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              className={`group absolute -translate-x-1/2 -translate-y-full transition-all duration-200 focus:outline-none ${
                isSelected ? 'z-30 scale-110' : 'z-10 hover:z-20 hover:scale-105'
              }`}
            >
              {/* Store Marker Card with Photo Preview */}
              <div
                className={`flex items-center gap-2 rounded-2xl border-2 p-1.5 pr-3 shadow-md transition-all ${
                  isSelected
                    ? 'border-brand bg-brand text-on-brand ring-4 ring-brand/20'
                    : 'border-brand bg-surface text-ink hover:bg-support'
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-line bg-page">
                  <img
                    src={previewPhoto}
                    alt={supplier.name}
                    className="h-full w-full object-cover"
                  />
                  {supplier.guaranteedDelivery && (
                    <span
                      className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl-md bg-brand text-on-brand"
                      title="Entrega Garantida"
                    >
                      <ShieldCheck className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>

                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1">
                    <span
                      className={`max-w-[125px] truncate text-xs font-extrabold ${
                        isSelected ? 'text-on-brand' : 'text-ink'
                      }`}
                    >
                      {supplier.name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold ${
                        isSelected ? 'text-on-brand/90' : 'text-muted'
                      }`}
                    >
                      {getRegionLabel(supplier.region)}
                    </span>
                    {minPrice !== null && (
                      <span
                        className={`rounded px-1 py-0.2 text-[10px] font-extrabold ${
                          isSelected
                            ? 'bg-surface text-brand'
                            : 'bg-support text-brand'
                        }`}
                      >
                        a partir R$ {minPrice.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pointer Triangle */}
              <div className="mx-auto flex flex-col items-center">
                <div
                  className="h-2.5 w-2.5 rotate-45 -mt-1.5 border-r-2 border-b-2 border-brand"
                  style={{
                    backgroundColor: isSelected ? '#7C3AED' : '#FFFFFF',
                  }}
                />
                <div className="mt-0.5 h-1.5 w-4 rounded-full bg-ink/20" />
              </div>
            </button>
          );
        })}

        {/* Optional Admin Pin Preview when picking coordinates in /sys-init */}
        {adminPinPos && (
          <div
            style={{
              left: `${latLngToMapPercent(adminPinPos.lat, adminPinPos.lng).x}%`,
              top: `${latLngToMapPercent(adminPinPos.lat, adminPinPos.lng).y}%`,
            }}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
          >
            <div className="flex items-center gap-1.5 rounded-xl border-2 border-brand bg-brand px-2.5 py-1.5 text-xs font-bold text-on-brand shadow-lg">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Posição Selecionada</span>
            </div>
            <div className="mx-auto h-2.5 w-2.5 rotate-45 -mt-1 bg-brand" />
          </div>
        )}
      </div>

      {/* Bottom Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2 text-[11px] backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" />
            Pino com Preview da Loja
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            Entrega Garantida & Verificada SP
          </span>
          <span className="hidden sm:inline text-muted">
            • Polos: Brás, Feirinha da Madrugada, 25 de Março e Bom Retiro
          </span>
        </div>
        <span className="font-semibold text-brand">
          Clique no marcador para abrir os 6 itens (3x2) →
        </span>
      </div>
    </div>
  );
}
