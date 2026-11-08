'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Save,
  RotateCcw,
  ShieldCheck,
  Store,
  Check,
  X,
  Package,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  WholesaleSupplier,
  WholesaleSupplierItem,
  SP_WHOLESALE_REGIONS,
  SP_WHOLESALE_CATEGORIES,
  DEMO_CATALOG_PHOTOS,
  getRegionLabel,
} from '@/lib/sp-wholesale-map';
import { SpCustomMapCanvas } from '@/components/suppliers/SpCustomMapCanvas';

interface WholesaleHubAdminPanelProps {
  setupPin: string;
}

const EMPTY_ITEM = (idx: number): WholesaleSupplierItem => ({
  id: `temp-item-${Date.now()}-${idx}`,
  name: '',
  category: 'Camisetas',
  imageUrl: '/demo-catalogo/fotos/camiseta-preta.png',
  wholesalePrice: 24.9,
  suggestedRetailPrice: 59.9,
  sizesLabel: 'P · M · G · GG',
  colorsLabel: 'Preta, Branca, Marinho',
  minPackQty: 6,
  isPreviewSix: idx < 6,
  sortOrder: idx + 1,
  active: true,
});

export function WholesaleHubAdminPanel({ setupPin }: WholesaleHubAdminPanelProps) {
  const [suppliers, setSuppliers] = useState<WholesaleSupplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state for creating/editing a supplier
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [region, setRegion] = useState<string>('BRAS');
  const [galleryName, setGalleryName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(
    '/demo-catalogo/fotos/camiseta-preta.png',
  );
  const [categories, setCategories] = useState<string[]>(['Camisetas']);
  const [lat, setLat] = useState<number>(-23.5365);
  const [lng, setLng] = useState<number>(-46.618);
  const [minOrderValue, setMinOrderValue] = useState<number>(350);
  const [minOrderPieces, setMinOrderPieces] = useState<number>(10);
  const [guaranteedDelivery, setGuaranteedDelivery] = useState<boolean>(true);
  const [verified, setVerified] = useState<boolean>(true);
  const [shippingMethods, setShippingMethods] = useState<string>(
    'Ônibus de Excursão (Brás), Correios Sedex, Transportadora e Motoboy SP',
  );
  const [openingHours, setOpeningHours] = useState<string>('Seg a Sáb · 05h30 às 16h00');
  const [description, setDescription] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  const [items, setItems] = useState<WholesaleSupplierItem[]>([
    EMPTY_ITEM(0),
    EMPTY_ITEM(1),
    EMPTY_ITEM(2),
    EMPTY_ITEM(3),
    EMPTY_ITEM(4),
    EMPTY_ITEM(5),
  ]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers/setup/sp-hub', {
        headers: { 'x-setup-pin': setupPin },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setSuppliers(list);
    } catch (err: any) {
      setFeedback(err?.response?.data?.message || 'Erro ao carregar Hub Atacado SP.');
    } finally {
      setLoading(false);
    }
  }, [setupPin]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleSelectForEdit = (sup: WholesaleSupplier) => {
    setEditingId(sup.id);
    setName(sup.name);
    setRegion(sup.region || 'BRAS');
    setGalleryName(sup.galleryName || '');
    setAddress(sup.address);
    setWhatsapp(sup.whatsapp);
    setCoverImageUrl(sup.coverImageUrl || '/demo-catalogo/fotos/camiseta-preta.png');
    setCategories(Array.isArray(sup.categories) && sup.categories.length > 0 ? sup.categories : ['Camisetas']);
    setLat(Number(sup.lat));
    setLng(Number(sup.lng));
    setMinOrderValue(Number(sup.minOrderValue || 300));
    setMinOrderPieces(Number(sup.minOrderPieces || 6));
    setGuaranteedDelivery(Boolean(sup.guaranteedDelivery));
    setVerified(Boolean(sup.verified));
    setShippingMethods(
      sup.shippingMethods || 'Ônibus de Excursão (Brás), Correios Sedex, Transportadora e Motoboy SP',
    );
    setOpeningHours(sup.openingHours || 'Seg a Sáb · 05h30 às 16h00');
    setDescription(sup.description || '');
    setActive(Boolean(sup.active));
    setItems(
      Array.isArray(sup.items) && sup.items.length > 0
        ? sup.items.map((it, i) => ({
            ...it,
            sortOrder: i + 1,
          }))
        : [
            EMPTY_ITEM(0),
            EMPTY_ITEM(1),
            EMPTY_ITEM(2),
            EMPTY_ITEM(3),
            EMPTY_ITEM(4),
            EMPTY_ITEM(5),
          ],
    );
    setFeedback(null);
  };

  const handleResetForm = () => {
    setEditingId(null);
    setName('');
    setRegion('BRAS');
    setGalleryName('');
    setAddress('');
    setWhatsapp('');
    setCoverImageUrl('/demo-catalogo/fotos/camiseta-preta.png');
    setCategories(['Camisetas']);
    setLat(-23.5365);
    setLng(-46.618);
    setMinOrderValue(350);
    setMinOrderPieces(10);
    setGuaranteedDelivery(true);
    setVerified(true);
    setShippingMethods('Ônibus de Excursão (Brás), Correios Sedex, Transportadora e Motoboy SP');
    setOpeningHours('Seg a Sáb · 05h30 às 16h00');
    setDescription('');
    setActive(true);
    setItems([
      EMPTY_ITEM(0),
      EMPTY_ITEM(1),
      EMPTY_ITEM(2),
      EMPTY_ITEM(3),
      EMPTY_ITEM(4),
      EMPTY_ITEM(5),
    ]);
  };

  const handleToggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleUpdateItem = (index: number, patch: Partial<WholesaleSupplierItem>) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const handleAddItemRow = () => {
    setItems((prev) => [...prev, EMPTY_ITEM(prev.length)]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !whatsapp.trim()) {
      setFeedback('Preencha Nome da Loja, Endereço e WhatsApp.');
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        pin: setupPin,
        name: name.trim(),
        region,
        galleryName: galleryName.trim() || null,
        address: address.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        coverImageUrl: coverImageUrl.trim(),
        logoUrl: coverImageUrl.trim(),
        categories: categories.length > 0 ? categories : ['Camisetas'],
        lat: Number(lat),
        lng: Number(lng),
        minOrderValue: Number(minOrderValue),
        minOrderPieces: Number(minOrderPieces),
        guaranteedDelivery,
        verified,
        shippingMethods: shippingMethods.trim(),
        openingHours: openingHours.trim(),
        description: description.trim() || null,
        active,
        items: items
          .filter((it) => it.name.trim() !== '')
          .map((it, idx) => ({
            name: it.name.trim(),
            category: it.category,
            imageUrl: it.imageUrl,
            wholesalePrice: Number(it.wholesalePrice || 0),
            suggestedRetailPrice: Number(it.suggestedRetailPrice || 0),
            sizesLabel: it.sizesLabel,
            colorsLabel: it.colorsLabel,
            minPackQty: Number(it.minPackQty || 6),
            isPreviewSix: Boolean(it.isPreviewSix),
            sortOrder: idx + 1,
            active: true,
          })),
      };

      if (editingId) {
        await api.patch(`/suppliers/setup/sp-hub/${editingId}`, payload, {
          headers: { 'x-setup-pin': setupPin },
        });
        setFeedback(`Fornecedor "${name}" atualizado com sucesso no Mapa Atacado SP!`);
      } else {
        await api.post('/suppliers/setup/sp-hub', payload, {
          headers: { 'x-setup-pin': setupPin },
        });
        setFeedback(`Novo fornecedor "${name}" cadastrado no Mapa Atacado SP!`);
        handleResetForm();
      }
      await loadSuppliers();
    } catch (err: any) {
      setFeedback(err?.response?.data?.message || 'Erro ao salvar fornecedor no Hub SP.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (sup: WholesaleSupplier) => {
    if (!window.confirm(`Deseja remover "${sup.name}" do Mapa Atacado SP?`)) return;
    try {
      await api.delete(`/suppliers/setup/sp-hub/${sup.id}`, {
        headers: { 'x-setup-pin': setupPin },
      });
      if (editingId === sup.id) handleResetForm();
      setFeedback(`Fornecedor "${sup.name}" removido.`);
      await loadSuppliers();
    } catch (err: any) {
      setFeedback(err?.response?.data?.message || 'Erro ao excluir fornecedor.');
    }
  };

  const handleRestoreDefaults = async () => {
    setSaving(true);
    try {
      await api.post(
        '/suppliers/setup/sp-hub/seed',
        { pin: setupPin },
        { headers: { 'x-setup-pin': setupPin } },
      );
      setFeedback('Fornecedores padrão do Brás, 25 de Março e Bom Retiro restaurados!');
      await loadSuppliers();
    } catch (err: any) {
      setFeedback(err?.response?.data?.message || 'Erro ao restaurar fornecedores padrão.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-support px-2.5 py-1 text-xs font-extrabold text-brand">
              <MapPin className="h-3.5 w-3.5" />
              CURADORIA SYS-INIT • ATACADO SP
            </span>
            <span className="text-xs font-bold text-muted">
              {suppliers.length} lojas homologadas no mapa
            </span>
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-ink">
            Gestão de Lojas do Mapa de São Paulo (Brás, 25 de Março & Bom Retiro)
          </h2>
          <p className="text-xs text-muted">
            Cadastre os fornecedores exclusivos de São Paulo, clique no mapa para posicionar o marcador e defina os 6 itens (fileiras de 3) que aparecem no preview lateral dos lojistas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-bold text-ink hover:border-brand hover:text-brand"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Lojas Padrão SP
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-on-brand hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" />
            Nova Loja no Mapa
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-brand bg-support px-4 py-3 text-xs font-bold text-brand">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Interactive Map + Registered Stores List */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <SpCustomMapCanvas
            suppliers={suppliers}
            selectedSupplierId={editingId}
            onSelectSupplier={handleSelectForEdit}
            adminPinPos={{ lat, lng }}
            onPickCoordinates={(coords) => {
              setLat(coords.lat);
              setLng(coords.lng);
            }}
          />
        </div>

        {/* Registered Suppliers List */}
        <div className="xl:col-span-5 flex flex-col rounded-2xl border border-line bg-surface p-4 max-h-[540px]">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h3 className="text-sm font-extrabold text-ink">
              Fornecedores Cadastrados ({suppliers.length})
            </h3>
            <span className="text-[11px] text-muted">Clique para editar</span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <p className="text-xs text-muted py-8 text-center">Carregando fornecedores...</p>
            ) : (
              suppliers.map((sup) => {
                const isSelected = editingId === sup.id;
                return (
                  <div
                    key={sup.id}
                    onClick={() => handleSelectForEdit(sup)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand bg-support'
                        : 'border-line bg-page hover:border-brand'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={sup.coverImageUrl}
                        alt={sup.name}
                        className="h-11 w-11 shrink-0 rounded-xl object-cover border border-line bg-surface"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-extrabold text-brand border border-line">
                            {getRegionLabel(sup.region)}
                          </span>
                          <span className="truncate text-xs font-extrabold text-ink">
                            {sup.name}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-muted mt-0.5">{sup.address}</p>
                        <p className="text-[10px] font-semibold text-brand mt-0.5">
                          {(sup.items || []).length} peças • WhatsApp: {sup.whatsapp}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectForEdit(sup);
                        }}
                        className="rounded-lg border border-line bg-surface p-1.5 text-muted hover:text-brand"
                        title="Editar loja"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSupplier(sup);
                        }}
                        className="rounded-lg border border-line bg-surface p-1.5 text-muted hover:text-brand"
                        title="Remover loja"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Store Form */}
      <form
        onSubmit={handleSaveSupplier}
        className="rounded-2xl border-2 border-brand bg-surface p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
          <div>
            <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Store className="h-4 w-4 text-brand" />
              {editingId
                ? `Editando Fornecedor: ${name}`
                : 'Cadastrar Novo Fornecedor no Mapa de São Paulo'}
            </h3>
            <p className="text-xs text-muted">
              Dica: Você pode clicar diretamente no mapa acima para posicionar as coordenadas (Lat/Lng) da loja na rua correta.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="rounded-xl border border-line bg-page px-3 py-1.5 text-xs font-bold text-muted hover:text-ink"
            >
              Cancelar Edição (Criar Novo)
            </button>
          )}
        </div>

        {/* Basic Store Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-ink mb-1">
              Nome da Loja / Fabricante *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Atacadão Pima & Malharia Oriente"
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Polo Comercial SP *
            </label>
            <select
              value={region}
              onChange={(e) => {
                const val = e.target.value;
                setRegion(val);
                const preset = SP_WHOLESALE_REGIONS.find((r) => r.id === val);
                if (preset && !editingId) {
                  setLat(preset.lat);
                  setLng(preset.lng);
                }
              }}
              className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-ink"
            >
              <option value="BRAS">Brás (R. Oriente / R. Miller)</option>
              <option value="FEIRINHA_MADRUGADA">Feirinha da Madrugada</option>
              <option value="VINTE_CINCO_MARCO">25 de Março / Ladeira Porto Geral</option>
              <option value="BOM_RETIRO">Bom Retiro (R. José Paulino)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              WhatsApp Comercial (com DDD) *
            </label>
            <input
              type="text"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5511988887777"
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-ink mb-1">
              Endereço Completo em São Paulo *
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua Oriente, 482 · Loja 14 · Brás, São Paulo - SP"
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Galeria / Shopping Atacadista
            </label>
            <input
              type="text"
              value={galleryName}
              onChange={(e) => setGalleryName(e.target.value)}
              placeholder="Ex: Galeria Oriente Textil"
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Horário de Funcionamento
            </label>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="Seg a Sáb · 05h30 às 16h00"
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Pedido Mínimo (R$)
            </label>
            <input
              type="number"
              step="10"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Mínimo de Peças
            </label>
            <input
              type="number"
              value={minOrderPieces}
              onChange={(e) => setMinOrderPieces(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Latitude (clique no mapa)
            </label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Longitude (clique no mapa)
            </label>
            <input
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-medium text-ink"
            />
          </div>
        </div>

        {/* Cover Photo & Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Foto de Preview no Pino do Mapa
            </label>
            <div className="flex items-center gap-2">
              <img
                src={coverImageUrl}
                alt="Preview"
                className="h-10 w-10 rounded-xl object-cover border border-brand shrink-0"
              />
              <select
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs font-medium text-ink"
              >
                {DEMO_CATALOG_PHOTOS.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink mb-1">
              Peças / Categorias Trabalhadas (para o filtro do mapa)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SP_WHOLESALE_CATEGORIES.filter((c) => c !== 'Todas as Peças').map((cat) => {
                const selected = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                      selected
                        ? 'bg-brand text-on-brand'
                        : 'border border-line bg-page text-muted hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6 Items (3x2 Grid) & Full Catalog Editor */}
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-ink flex items-center gap-2">
                <Package className="h-4 w-4 text-brand" />
                Peças da Loja • As 6 primeiras marcadas compõem a grade 3x2 (2 fileiras de 3) na lateral do mapa
              </h4>
              <p className="text-xs text-muted">
                Defina a foto, nome da peça, preço no atacado e preço sugerido de revenda.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-support px-3 py-1.5 text-xs font-extrabold text-brand hover:bg-brand hover:text-on-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Peça ao Catálogo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="rounded-xl border border-line bg-page p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-support px-2 py-0.5 text-[10px] font-extrabold text-brand">
                    Peça #{idx + 1} {item.isPreviewSix ? '• Na Grade 3x2' : ''}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="text-muted hover:text-brand"
                      title="Remover peça"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <img
                    src={item.imageUrl}
                    alt={item.name || 'Peça'}
                    className="h-12 w-12 rounded-lg object-cover border border-line bg-surface shrink-0"
                  />
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                      placeholder="Nome da peça (ex: Camiseta Pima)"
                      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink"
                    />
                    <select
                      value={item.imageUrl}
                      onChange={(e) => {
                        const chosen = DEMO_CATALOG_PHOTOS.find((p) => p.url === e.target.value);
                        handleUpdateItem(idx, {
                          imageUrl: e.target.value,
                          ...(chosen ? { category: chosen.category } : {}),
                        });
                      }}
                      className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-muted"
                    >
                      {DEMO_CATALOG_PHOTOS.map((p) => (
                        <option key={p.url} value={p.url}>
                          Foto: {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-muted">Atacado R$</label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.wholesalePrice}
                      onChange={(e) =>
                        handleUpdateItem(idx, { wholesalePrice: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold text-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted">Revenda R$</label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.suggestedRetailPrice}
                      onChange={(e) =>
                        handleUpdateItem(idx, { suggestedRetailPrice: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted">Mín. Peças</label>
                    <input
                      type="number"
                      value={item.minPackQty}
                      onChange={(e) =>
                        handleUpdateItem(idx, { minPackQty: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold text-ink"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <select
                    value={item.category}
                    onChange={(e) => handleUpdateItem(idx, { category: e.target.value })}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-ink"
                  >
                    {SP_WHOLESALE_CATEGORIES.filter((c) => c !== 'Todas as Peças').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isPreviewSix}
                      onChange={(e) =>
                        handleUpdateItem(idx, { isPreviewSix: e.target.checked })
                      }
                      className="accent-brand"
                    />
                    Exibir nos 6 (3x2)
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-xs font-extrabold text-on-brand shadow-sm hover:bg-brand-hover disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving
              ? 'Salvando no Mapa Atacado SP...'
              : editingId
                ? 'Salvar Alterações do Fornecedor'
                : 'Publicar Fornecedor no Mapa Atacado SP'}
          </button>
        </div>
      </form>
    </div>
  );
}
