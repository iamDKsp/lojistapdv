import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useRetailShell } from '@/retail/RetailLayout';
import {
  BarChart2, Package, Tag, ArrowLeftRight, Building2,
  TrendingUp, Star, Search, Plus, RefreshCw, X, AlertCircle,
  Loader2, Activity, DollarSign, Store, Award,
  Clock, Calendar, ShoppingCart, Edit3, Check, AlertTriangle,
  RefreshCcw, Copy, ArrowRight, ExternalLink
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell, LabelList
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TenantDashboard {
  tenantId: string; alias: string; salesToday: number; salesMonth: number;
  countToday: number; topProducts: { productId: string; name: string; imageUrl?: string; totalQty: number }[];
  error?: string;
}
interface DashboardData {
  groupId: string; groupName: string; tenants: TenantDashboard[];
  salesByDate: { date: string; total: number }[];
  salesByHour: { hour: string; total: number }[];
  salesByDayOfWeek: { name: string; total: number }[];
  salesByWeek: { name: string; total: number }[];
  salesByMonth: { name: string; total: number }[];
  payments: { method: string; total: number }[];
}
interface StockCell { qty: number; productId: string; unit: string; }
interface StockRow { name: string; tenants: Record<string, StockCell>; }
interface StockData { groupId: string; tenantLabels: Record<string, string>; rows: StockRow[]; }
interface ForecastRow { productId: string; name: string; totalStock: number; avgDailySales: number; autonomyDays: number; suggestion: number; }
interface TenantDetail {
  tenantId: string; alias: string;
  recentSales: { id: string; total: number; createdAt: string; itemsCount: number; firstItems: string[]; payments: { method: string; label?: string; value: number }[] }[];
  criticalStock: { id: string; name: string; stock: number; unit: string }[];
}
interface CatalogRow { name: string; tenants: Record<string, { id: string; priceSell: number; priceCost: number; stock: number; unit: string; barcode?: string; ncm?: string; imageUrl?: string }>; }
interface CatalogData { groupId: string; groupName: string; tenantLabels: Record<string, string>; rows: CatalogRow[]; }
interface SyncStatus { groupId: string; tenantLabels: Record<string, string>; hasDifferences: boolean; missingProducts: { name: string; presentIn: string[]; missingIn: string[]; productData: any }[]; }

// ─── Constants ───────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v ?? 0);
function getToken(): string | null { try { return JSON.parse(localStorage.getItem('lojista-auth') || '{}')?.state?.token ?? null; } catch { return null; } }
function authHeaders(): Record<string, string> { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }; }

const METHOD_DISPLAY: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', outros: 'Outros' };

// ─── Micro Components (Paleta Roxo, Branco e Neutros) ────────────────────────

function Skeleton({ w = '100%', h = '1rem', r = '0.5rem' }: { w?: string; h?: string; r?: string }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#F8F7FC 25%,#F3E8FF 50%,#F8F7FC 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />;
}

function Badge({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      fontSize: '0.65rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: active ? '#FFFFFF' : '#7C3AED',
      background: active ? '#7C3AED' : '#F3E8FF',
      border: '1px solid #E5E1ED',
      borderRadius: '999px',
      padding: '0.15rem 0.55rem',
    }}>
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children, maxWidth = '520px' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, #272321 45%, transparent)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1.25rem', padding: '1.75rem', width: '100%', maxWidth, boxShadow: '0 24px 64px color-mix(in srgb, #272321 18%, transparent)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#272321' }}>{title}</div>
          <button onClick={onClose} style={{ background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.5rem', color: '#665F70', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const IS: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '0.625rem', color: '#272321', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem' };
const SS: React.CSSProperties = { ...IS, cursor: 'pointer', appearance: 'auto' };
const LS: React.CSSProperties = { fontSize: '0.75rem', color: '#665F70', marginBottom: '0.375rem', display: 'block', fontWeight: 600 };
function FF({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: '0.25rem' }}><label style={LS}>{label}</label>{children}</div>; }

function Btn({ onClick, children, disabled = false, size = 'md', outline = false }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; size?: 'sm' | 'md'; outline?: boolean }) {
  const pad = size === 'sm' ? '0.375rem 0.875rem' : '0.625rem 1.25rem';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: pad,
        background: outline ? '#FFFFFF' : disabled ? '#F8F7FC' : '#7C3AED',
        border: `1px solid ${disabled ? '#E5E1ED' : outline ? '#E5E1ED' : '#7C3AED'}`,
        borderRadius: '0.625rem',
        color: disabled ? '#665F70' : outline ? '#272321' : '#FFFFFF',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px color-mix(in srgb, #272321 4%, transparent)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#7C3AED' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#665F70', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</div>
        <div style={{ width: '36px', height: '36px', borderRadius: '0.625rem', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#272321', letterSpacing: '-0.03em', marginBottom: '0.25rem', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#665F70', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ─── Tenant Detail Drawer ─────────────────────────────────────────────────────

function TenantDetailDrawer({
  tenantId,
  tenantAlias,
  isCurrentStore,
  onSwitchStore,
  switching,
  onClose,
}: {
  tenantId: string;
  tenantAlias: string;
  isCurrentStore: boolean;
  onSwitchStore: () => void;
  switching: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    setLoading(true);
    setFetchError('');
    fetch(`/api/groups/my/tenant-detail/${tenantId}`, { headers: authHeaders() })
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.message || `HTTP ${r.status}`);
        if (!Array.isArray(json?.recentSales)) throw new Error('Resposta inválida do servidor');
        setData(json);
      })
      .catch(e => setFetchError(e.message || 'Erro desconhecido'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1, background: 'color-mix(in srgb, #272321 35%, transparent)', backdropFilter: 'blur(3px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '95vw', background: '#FFFFFF', borderLeft: '1px solid #E5E1ED', height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px color-mix(in srgb, #272321 12%, transparent)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #E5E1ED', background: '#F8F7FC' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '0.75rem', background: '#F3E8FF', border: '1px solid #E5E1ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', fontWeight: 800 }}>
                <Store size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#272321' }}>{tenantAlias}</div>
                <Badge active={isCurrentStore}>{isCurrentStore ? 'Loja Ativa Agora' : 'Unidade da Rede'}</Badge>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '0.5rem', color: '#665F70', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Btn onClick={onSwitchStore} disabled={switching} size="sm">
              {switching ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              {isCurrentStore ? 'Ir para o Painel desta Loja' : 'Entrar e Operar esta Loja (1 clique)'}
            </Btn>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#665F70' }}>
            <Loader2 size={20} className="animate-spin" />
            <span style={{ fontSize: '0.85rem' }}>Conectando à loja...</span>
          </div>
        ) : fetchError || !data ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2rem' }}>
            <AlertTriangle size={28} color="#7C3AED" />
            <div style={{ color: '#272321', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center' }}>Não foi possível carregar os detalhes</div>
            <div style={{ color: '#665F70', fontSize: '0.78rem', textAlign: 'center' }}>{fetchError}</div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(data.criticalStock?.length ?? 0) > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  <AlertTriangle size={16} color="#7C3AED" />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#272321' }}>Estoque Crítico ({data.criticalStock.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.criticalStock.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.625rem', padding: '0.625rem 0.875rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#272321', fontWeight: 600 }}>{p.name}</span>
                      <Badge>{p.stock} {p.unit}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Clock size={16} color="#7C3AED" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#272321' }}>Vendas Recentes</span>
              </div>
              {(data.recentSales?.length ?? 0) === 0 ? (
                <div style={{ color: '#665F70', fontSize: '0.82rem', textAlign: 'center', padding: '2rem', background: '#F8F7FC', borderRadius: '0.75rem' }}>Nenhuma venda recente</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {(data.recentSales ?? []).map(s => (
                    <div key={s.id} style={{ background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#665F70', fontFamily: 'monospace' }}>{new Date(s.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span style={{ fontWeight: 800, color: '#7C3AED', fontSize: '0.9rem' }}>{fmt(s.total)}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#272321', marginBottom: '0.4rem' }}>{(s.firstItems ?? []).join(', ')}{(s.itemsCount ?? 0) > 3 ? ` +${s.itemsCount - 3}` : ''}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(s.payments ?? []).map((p, i) => (
                          <Badge key={i}>{p.label || METHOD_DISPLAY[p.method] || p.method}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Store Card ───────────────────────────────────────────────────────────────

function StoreCard({
  t,
  rank,
  totalToday,
  isCurrentStore,
  switching,
  onOpenDetail,
  onEnterStore,
}: {
  t: TenantDashboard;
  rank: number;
  totalToday: number;
  isCurrentStore: boolean;
  switching: boolean;
  onOpenDetail: () => void;
  onEnterStore: () => void;
}) {
  const pct = totalToday > 0 ? (t.salesToday / totalToday) * 100 : 0;
  const avgTicket = t.countToday > 0 ? t.salesMonth / t.countToday : 0;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: isCurrentStore ? '2px solid #7C3AED' : '1px solid #E5E1ED',
        borderRadius: '1rem',
        padding: '1.25rem',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.2s',
        boxShadow: '0 2px 10px color-mix(in srgb, #272321 4%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '0.625rem', background: '#F3E8FF', border: '1px solid #E5E1ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0, fontWeight: 800 }}>
          {rank === 1 ? <Award size={17} /> : <span style={{ fontSize: '0.85rem' }}>{rank}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#272321', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.alias}</div>
          <Badge active={isCurrentStore}>{isCurrentStore ? 'Conectada neste terminal' : 'Ativa'}</Badge>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1rem' }}>
        {[
          { label: 'Hoje', value: fmt(t.salesToday) },
          { label: 'Período', value: fmt(t.salesMonth) },
          { label: 'Ticket Médio', value: fmt(avgTicket) },
          { label: 'Transações', value: fmtNum(t.countToday) },
        ].map(m => (
          <div key={m.label} style={{ background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.625rem', padding: '0.625rem 0.75rem' }}>
            <div style={{ fontSize: '0.62rem', color: '#665F70', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '0.2rem' }}>{m.label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#272321' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.68rem', color: '#665F70', fontWeight: 600 }}>Participação hoje</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED' }}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{ height: '6px', background: '#F3E8FF', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#7C3AED', borderRadius: '999px', transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', borderTop: '1px solid #E5E1ED', paddingTop: '0.875rem' }}>
        <button
          type="button"
          onClick={onOpenDetail}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #E5E1ED',
            background: '#F8F7FC',
            color: '#272321',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <ArrowRight size={13} color="#7C3AED" />
          Raio-X Rápido
        </button>

        <button
          type="button"
          disabled={switching}
          onClick={onEnterStore}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '0.5rem',
            border: '1px solid #7C3AED',
            background: isCurrentStore ? '#F3E8FF' : '#7C3AED',
            color: isCurrentStore ? '#7C3AED' : '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: switching ? 'not-allowed' : 'pointer',
          }}
        >
          {switching ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
          {isCurrentStore ? 'Abrir Loja' : 'Entrar na Loja'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ dateFilter, onDateFilterChange }: { dateFilter: string; onDateFilterChange: (v: string) => void }) {
  const { user } = useAuthStore();
  const { switchStore, switchingStoreId } = useRetailShell();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartGrouping, setChartGrouping] = useState<'hour' | 'day' | 'week' | 'month'>('hour');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; alias: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let q = '';
      const now = new Date();
      if (dateFilter === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); q = `?startDate=${d.toISOString()}&endDate=${now.toISOString()}`; }
      else if (dateFilter === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); q = `?startDate=${d.toISOString()}&endDate=${now.toISOString()}`; }
      else if (dateFilter === 'hoje') { const d = new Date(); d.setHours(0, 0, 0, 0); q = `?startDate=${d.toISOString()}&endDate=${now.toISOString()}`; }
      const res = await fetch(`/api/groups/my/dashboard${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '1rem' }}>
        {[...Array(4)].map((_, i) => (<div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}><Skeleton h="0.7rem" w="55%" /><Skeleton h="2.2rem" w="75%" /><Skeleton h="0.6rem" w="40%" /></div>))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', gap: '0.75rem', color: '#665F70' }}>
        <Loader2 size={20} className="animate-spin" />
        <span style={{ fontSize: '0.875rem' }}>Consolidando indicadores das lojas...</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', gap: '1rem', background: '#FFFFFF', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>
      <AlertCircle size={36} color="#7C3AED" />
      <div style={{ fontWeight: 700, color: '#272321' }}>Não foi possível carregar a visão consolidada</div>
      <div style={{ fontSize: '0.82rem', color: '#665F70' }}>{error}</div>
      <Btn onClick={load} outline><RefreshCw size={14} /> Tentar novamente</Btn>
    </div>
  );

  if (!data) return null;

  const valid = data.tenants.filter(t => !t.error);
  const totalToday = valid.reduce((s, t) => s + t.salesToday, 0);
  const totalMonth = valid.reduce((s, t) => s + t.salesMonth, 0);
  const totalTxns = valid.reduce((s, t) => s + t.countToday, 0);
  const avgTicket = totalTxns > 0 ? totalMonth / totalTxns : 0;
  const best = valid.reduce((b, t) => (!b || t.salesMonth > b.salesMonth ? t : b), valid[0]);
  const sorted = [...valid].sort((a, b) => b.salesToday - a.salesToday);

  const productMap: Record<string, { name: string; qty: number; imageUrl?: string }> = {};
  for (const t of data.tenants) {
    for (const p of t.topProducts) {
      if (productMap[p.productId]) productMap[p.productId].qty += p.totalQty;
      else productMap[p.productId] = { name: p.name, qty: p.totalQty, imageUrl: p.imageUrl };
    }
  }
  const topProducts = Object.entries(productMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 15);

  let activeChartData: { name: string; total: number }[] = [];
  if (chartGrouping === 'hour') activeChartData = data.salesByHour?.map(d => ({ name: d.hour, total: d.total })) || [];
  else if (chartGrouping === 'day') activeChartData = data.salesByDate?.map(d => ({ name: d.date.split('-').slice(1).reverse().join('/'), total: d.total })) || [];
  else if (chartGrouping === 'week') activeChartData = data.salesByWeek || [];
  else if (chartGrouping === 'month') activeChartData = data.salesByMonth || [];

  const maxTotal = activeChartData.reduce((max, item) => (item.total > max ? item.total : max), 0);
  const chartDataWithPeak = activeChartData.map(item => ({ ...item, isPeak: maxTotal > 0 && item.total === maxTotal }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (<div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', padding: '0.75rem', borderRadius: '0.5rem', boxShadow: '0 8px 24px color-mix(in srgb, #272321 12%, transparent)' }}><div style={{ color: '#665F70', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</div><div style={{ color: '#7C3AED', fontWeight: 800 }}>{fmt(payload[0].value)}</div></div>);
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {selectedTenant && (
        <TenantDetailDrawer
          tenantId={selectedTenant.id}
          tenantAlias={selectedTenant.alias}
          isCurrentStore={selectedTenant.id === user?.tenant}
          switching={switchingStoreId === selectedTenant.id}
          onSwitchStore={() => void switchStore(selectedTenant.id, '/inicio')}
          onClose={() => setSelectedTenant(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
            <Building2 size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#272321' }}>{data.groupName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7C3AED' }} />
              <span style={{ fontSize: '0.75rem', color: '#665F70' }}>{valid.length} lojas sincronizadas · Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F8F7FC', padding: '0.4rem 0.75rem', borderRadius: '0.625rem', border: '1px solid #E5E1ED' }}>
            <Calendar size={14} color="#7C3AED" />
            <select value={dateFilter} onChange={e => onDateFilterChange(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#272321', outline: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
              <option value="hoje">Apenas Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
          <Btn onClick={load} outline size="sm"><RefreshCw size={14} /> Atualizar</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <KpiCard label="Vendas Hoje (Rede)" value={fmt(totalToday)} sub={`${valid.length} lojas operando`} icon={<TrendingUp size={18} />} />
        <KpiCard label="Total do Período" value={fmt(totalMonth)} sub="Faturamento somado" icon={<BarChart2 size={18} />} />
        <KpiCard label="Ticket Médio" value={fmt(avgTicket)} sub={`${fmtNum(totalTxns)} vendas no período`} icon={<DollarSign size={18} />} />
        {best && <KpiCard label="Unidade Destaque" value={fmt(best.salesMonth)} sub={best.alias} icon={<Award size={18} />} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Store size={18} color="#7C3AED" />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#272321' }}>Desempenho e Acesso Rápido por Loja</span>
          <span style={{ fontSize: '0.75rem', color: '#665F70' }}>• entre em qualquer filial com 1 clique</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {sorted.map((t, i) => (
            <StoreCard
              key={t.tenantId}
              t={t}
              rank={i + 1}
              totalToday={totalToday}
              isCurrentStore={t.tenantId === user?.tenant}
              switching={switchingStoreId === t.tenantId}
              onOpenDetail={() => setSelectedTenant({ id: t.tenantId, alias: t.alias })}
              onEnterStore={() => void switchStore(t.tenantId, '/inicio')}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 580px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#7C3AED' }}>
              <Activity size={18} />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#272321' }}>Evolução de Vendas da Rede</span>
            </div>
            {data.salesByDate.length > 0 ? (
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.salesByDate} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} /><stop offset="95%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E1ED" vertical={false} />
                    <XAxis dataKey="date" stroke="#665F70" fontSize={11} tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')} />
                    <YAxis stroke="#665F70" fontSize={11} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#665F70', fontSize: '0.85rem' }}>Sem vendas no período</div>}
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7C3AED' }}>
                <Clock size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#272321' }}>Vendas por {chartGrouping === 'hour' ? 'Hora' : chartGrouping === 'day' ? 'Dia' : chartGrouping === 'week' ? 'Semana' : 'Mês'}</span>
              </div>
              <div style={{ display: 'flex', background: '#F8F7FC', border: '1px solid #E5E1ED', padding: '0.25rem', borderRadius: '0.625rem' }}>
                {(['hour', 'day', 'week', 'month'] as const).map((g) => (
                  <button key={g} onClick={() => setChartGrouping(g)} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.45rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: chartGrouping === g ? '#7C3AED' : 'transparent', color: chartGrouping === g ? '#FFFFFF' : '#665F70' }}>
                    {g === 'hour' ? 'Hora' : g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>
            </div>
            {chartDataWithPeak.length > 0 ? (
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataWithPeak} margin={{ top: 30, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E1ED" vertical={false} />
                    <XAxis dataKey="name" stroke="#665F70" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis stroke="#665F70" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val)}`} />
                    <Tooltip cursor={{ fill: '#F8F7FC' }} contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '0.75rem' }} formatter={(value) => [fmt(Number(value ?? 0)), 'Faturamento']} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chartDataWithPeak.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.isPeak ? '#6D28D9' : '#7C3AED'} />))}
                      {chartDataWithPeak.length <= 14 && <LabelList dataKey="total" position="top" fill="#272321" fontSize={11} fontWeight={700} formatter={(val) => Number(val ?? 0) >= 1000 ? 'R$ ' + (Number(val) / 1000).toFixed(1) + 'k' : 'R$ ' + Math.round(Number(val ?? 0))} />}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#665F70', fontSize: '0.85rem' }}>Sem dados</div>}
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#7C3AED' }}>
              <DollarSign size={18} />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#272321' }}>Meios de Pagamento Consolidados</span>
            </div>
            {data.payments?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {data.payments.slice().sort((a, b) => b.total - a.total).map((entry) => {
                  const totalAll = data.payments.reduce((acc, curr) => acc + curr.total, 0);
                  const pct = totalAll > 0 ? ((entry.total / totalAll) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={entry.method} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED' }} />
                          <span style={{ color: '#272321', fontWeight: 700 }}>{METHOD_DISPLAY[entry.method] || entry.method}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <span style={{ color: '#665F70', fontWeight: 600 }}>{pct}%</span>
                          <span style={{ color: '#7C3AED', fontWeight: 800 }}>{fmt(entry.total)}</span>
                        </div>
                      </div>
                      <div style={{ height: '6px', background: '#F3E8FF', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#7C3AED', borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ padding: '1.5rem', textAlign: 'center', color: '#665F70', fontSize: '0.85rem' }}>Sem dados de pagamento</div>}
          </div>
        </div>

        <div style={{ flex: '1 1 340px', background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#7C3AED' }}>
            <Star size={18} />
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#272321' }}>Top Produtos — Rede</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {topProducts.map(([id, p], i) => {
              const maxQ = topProducts[0]?.[1]?.qty || 1;
              const pct = (p.qty / maxQ) * 100;
              return (
                <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{ color: '#665F70', fontWeight: 700, width: '20px' }}>#{i + 1}</span>
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: '26px', height: '26px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #E5E1ED' }} /> : <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Star size={12} color="#7C3AED" /></div>}
                      <span style={{ color: '#272321', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ color: '#7C3AED', fontWeight: 800, flexShrink: 0 }}>{fmtNum(p.qty)} un</span>
                  </div>
                  <div style={{ height: '5px', background: '#F3E8FF', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#7C3AED', borderRadius: '999px' }} />
                  </div>
                </div>
              );
            })}
            {topProducts.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#665F70', fontSize: '0.82rem' }}>Sem vendas de produtos no período.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Forecast ─────────────────────────────────────────────────────────────

function TabForecast() {
  const [data, setData] = useState<ForecastRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(15);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/groups/my/purchase-forecast?daysToForecast=${days}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: '#FFFFFF', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#272321', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="#7C3AED" /> Previsão Inteligente de Compras da Rede
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#665F70', marginTop: '0.25rem' }}>Média de vendas dos últimos 30 dias cruzada com o saldo somado de todas as lojas.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F8F7FC', padding: '0.4rem 0.75rem', borderRadius: '0.625rem', border: '1px solid #E5E1ED' }}>
          <span style={{ fontSize: '0.75rem', color: '#665F70', fontWeight: 700 }}>Cobertura alvo:</span>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: '#272321', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
            <option value={7}>7 Dias</option><option value={15}>15 Dias</option><option value={30}>30 Dias</option>
          </select>
        </div>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 size={24} className="animate-spin" color="#7C3AED" /></div>
        : error ? <div style={{ color: '#7C3AED', padding: '2rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>{error}</div>
          : (
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#F8F7FC', borderBottom: '1px solid #E5E1ED' }}>
                      {['Produto', 'Estoque Global', 'Venda Média / Dia', 'Autonomia', 'Sugestão de Compra'].map(h => (
                        <th key={h} style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, textAlign: h === 'Sugestão de Compra' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.map(row => (
                      <tr key={row.productId} style={{ borderBottom: '1px solid #E5E1ED' }}>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#272321' }}>{row.name}</td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: '#665F70', fontWeight: 600 }}>{row.totalStock} un</td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', color: '#7C3AED', fontWeight: 700 }}>{row.avgDailySales} un/dia</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <Badge active={row.autonomyDays < 3}>
                            {row.autonomyDays === 999 ? 'Alta autonomia' : `${row.autonomyDays} dias`}
                          </Badge>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          {row.suggestion > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#F3E8FF', border: '1px solid #E5E1ED', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', color: '#7C3AED', fontWeight: 800, fontSize: '0.82rem' }}>
                              <ShoppingCart size={13} /> +{row.suggestion} un
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#665F70', fontWeight: 600 }}>Estoque OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data!.length === 0 && <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#665F70' }}>Sem dados suficientes para previsão.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
    </div>
  );
}

// ─── Tab: Estoque ─────────────────────────────────────────────────────────────

function TabEstoque() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'ok'>('all');
  const [editingCell, setEditingCell] = useState<{ name: string; tenantId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loadingSync, setLoadingSync] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedToSync, setSelectedToSync] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);

  const loadStock = () => {
    setLoading(true);
    fetch('/api/groups/my/stock', { headers: authHeaders() })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  };

  const loadSyncStatus = () => {
    setLoadingSync(true);
    fetch('/api/groups/my/products/sync-status', { headers: authHeaders() })
      .then(r => r.json()).then(d => { setSyncStatus(d); }).finally(() => setLoadingSync(false));
  };

  useEffect(() => { loadStock(); loadSyncStatus(); }, []);

  const startEdit = (name: string, tenantId: string, currentQty: number) => {
    setEditingCell({ name, tenantId });
    setEditValue(String(currentQty));
  };

  const saveEdit = async () => {
    if (!editingCell || !data) return;
    const row = data.rows.find(r => r.name === editingCell.name);
    const cell = row?.tenants[editingCell.tenantId];
    if (!cell) return;
    setSaving(true);
    try {
      const res = await fetch('/api/groups/my/stock-adjust', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ tenantId: editingCell.tenantId, productId: cell.productId, newStock: parseFloat(editValue) }) });
      if (!res.ok) throw new Error('Erro ao salvar');
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map(r => r.name === editingCell!.name ? {
            ...r, tenants: {
              ...r.tenants,
              [editingCell!.tenantId]: { ...r.tenants[editingCell!.tenantId], qty: parseFloat(editValue) }
            }
          } : r)
        };
      });
      setEditingCell(null);
    } catch {
      alert('Erro ao salvar estoque');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncSubmit = async () => {
    if (!syncStatus) return;
    const products = syncStatus.missingProducts
      .filter(p => selectedToSync[p.name])
      .map(p => ({ name: p.name, targetTenantIds: p.missingIn }));
    if (products.length === 0) return;
    setSyncing(true);
    try {
      await fetch('/api/groups/my/products/sync', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ products }) });
      setShowSyncModal(false);
      loadStock();
      loadSyncStatus();
    } catch {
      alert('Erro ao sincronizar produtos');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}><Loader2 size={24} className="animate-spin" color="#7C3AED" /></div>;
  if (!data) return null;

  const filtered = data.rows.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMode !== 'all') {
      const hasLow = Object.values(r.tenants).some(t => t.qty < 3);
      if (filterMode === 'low' && !hasLow) return false;
      if (filterMode === 'ok' && hasLow) return false;
    }
    return true;
  });

  const hasDiff = syncStatus?.hasDifferences && syncStatus.missingProducts.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Modal open={showSyncModal} onClose={() => setShowSyncModal(false)} title="Sincronizar Produtos entre Lojas" maxWidth="680px">
        <div style={{ fontSize: '0.84rem', color: '#665F70', marginBottom: '1.25rem' }}>
          Os produtos abaixo existem em algumas lojas da rede, mas ainda não foram cadastrados nas demais. Selecione quais deseja replicar:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '50vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
          {syncStatus?.missingProducts.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer' }} onClick={() => setSelectedToSync(prev => ({ ...prev, [p.name]: !prev[p.name] }))}>
              <input type="checkbox" checked={!!selectedToSync[p.name]} onChange={() => {}} style={{ width: '16px', height: '16px', accentColor: '#7C3AED', cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#272321', fontSize: '0.85rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.74rem', color: '#665F70', marginTop: '0.2rem' }}>
                  Presente em: {p.presentIn.map(id => syncStatus?.tenantLabels[id]).join(', ')} →
                  Faltando em: <span style={{ color: '#7C3AED', fontWeight: 700 }}>{p.missingIn.map(id => syncStatus?.tenantLabels[id]).join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Btn onClick={() => setShowSyncModal(false)} outline>Cancelar</Btn>
          <Btn onClick={handleSyncSubmit} disabled={syncing || Object.values(selectedToSync).filter(Boolean).length === 0}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Sincronizar Selecionados
          </Btn>
        </div>
      </Modal>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#272321' }}>Estoque Consolidado por Filial</h2>
          <span style={{ fontSize: '0.75rem', color: '#665F70' }}>Clique na quantidade de qualquer loja para ajustar rapidamente</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {loadingSync ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#665F70' }}><Loader2 size={13} className="animate-spin" /> verificando catálogo...</div>
          ) : (
            <button
              type="button"
              onClick={() => { if (hasDiff) { setSelectedToSync({}); setShowSyncModal(true); } else { loadSyncStatus(); } }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.875rem', background: hasDiff ? '#F3E8FF' : '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.625rem', color: hasDiff ? '#7C3AED' : '#665F70', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
            >
              <RefreshCcw size={14} />
              {hasDiff ? `Sincronizar Catálogo (${syncStatus!.missingProducts.length} diferenças)` : 'Catálogo Sincronizado'}
            </button>
          )}

          <div style={{ display: 'flex', background: '#F8F7FC', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #E5E1ED' }}>
            {(['all', 'low', 'ok'] as const).map(m => (
              <button key={m} type="button" onClick={() => setFilterMode(m)} style={{ padding: '0.35rem 0.75rem', background: filterMode === m ? '#7C3AED' : 'transparent', border: 'none', borderRadius: '0.375rem', color: filterMode === m ? '#FFFFFF' : '#665F70', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                {m === 'all' ? 'Todos' : m === 'low' ? 'Estoque Baixo' : 'Estoque OK'}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#665F70' }} />
            <input type="text" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...IS, marginBottom: 0, paddingLeft: '2.25rem', width: '220px' }} />
          </div>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#F8F7FC', borderBottom: '1px solid #E5E1ED' }}>
                <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', fontWeight: 700 }}>Produto</th>
                {Object.entries(data.tenantLabels).map(([id, l]) => <th key={id} style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', textAlign: 'center', fontWeight: 700 }}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.name} style={{ borderBottom: '1px solid #E5E1ED' }}>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#272321' }}>{r.name}</td>
                  {Object.keys(data.tenantLabels).map(tid => {
                    const c = r.tenants[tid];
                    const isEditing = editingCell?.name === r.name && editingCell?.tenantId === tid;
                    if (!c) return <td key={tid} style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#665F70' }}>—</td>;
                    return (
                      <td key={tid} style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="number" step="0.001" autoFocus value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                              style={{ width: '80px', padding: '0.3rem 0.5rem', background: '#FFFFFF', border: '1px solid #7C3AED', borderRadius: '0.4rem', color: '#272321', fontSize: '0.82rem', outline: 'none', textAlign: 'center' }}
                            />
                            <button onClick={saveEdit} disabled={saving} style={{ background: '#7C3AED', border: 'none', borderRadius: '0.35rem', color: '#FFFFFF', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button onClick={() => setEditingCell(null)} style={{ background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.35rem', color: '#665F70', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} onClick={() => startEdit(r.name, tid, c.qty)} title="Clique para ajustar saldo">
                            <Badge active={c.qty <= 0}>{c.qty} {c.unit}</Badge>
                            <Edit3 size={12} color="#665F70" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={Object.keys(data.tenantLabels).length + 1} style={{ padding: '3rem', textAlign: 'center', color: '#665F70' }}>Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Produtos ─────────────────────────────────────────────────────────────

function TabProdutos() {
  const { subTab: routeSubTab } = useParams<{ subTab?: string }>();
  const navigate = useNavigate();
  const resolvedSubTab: 'catalog' | 'create' =
    routeSubTab === 'criar' ? 'create' : 'catalog';
  const [subTab, setSubTab] = useState<'catalog' | 'create'>(resolvedSubTab);

  useEffect(() => {
    setSubTab(resolvedSubTab);
  }, [resolvedSubTab]);

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [search, setSearch] = useState('');
  const [editingPrice, setEditingPrice] = useState<{ name: string; tenantId: string } | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [equalizeModal, setEqualizeModal] = useState<string | null>(null);
  const [equalizePriceValue, setEqualizePriceValue] = useState('');

  // Create form
  const [form, setForm] = useState({ name: '', barcode: '', ncm: '', unit: 'UN', categoryName: 'Geral', priceCost: '' });
  const [tenantPrices, setTenantPrices] = useState<Record<string, string>>({});
  const [selectedTenants, setSelectedTenants] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const loadCatalog = () => {
    setLoadingCatalog(true);
    fetch('/api/groups/my/products-catalog', { headers: authHeaders() })
      .then(r => r.json()).then(d => {
        setCatalog(d);
        const tids = Object.keys(d?.tenantLabels || {});
        setSelectedTenants(Object.fromEntries(tids.map(t => [t, true])));
        setTenantPrices(Object.fromEntries(tids.map(t => [t, ''])));
      })
      .finally(() => setLoadingCatalog(false));
  };

  useEffect(() => { loadCatalog(); }, []);

  const savePricePerTenant = async (productName: string, tenantId: string, price: number) => {
    setSavingPrice(true);
    try {
      await fetch('/api/groups/my/products/price-per-tenant', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ productName, updates: [{ tenantId, priceSell: price }] }) });
      setCatalog(prev => {
        if (!prev) return prev;
        return { ...prev, rows: prev.rows.map(r => r.name === productName ? { ...r, tenants: { ...r.tenants, [tenantId]: { ...r.tenants[tenantId], priceSell: price } } } : r) };
      });
      setEditingPrice(null);
    } catch { alert('Erro ao salvar preço'); }
    finally { setSavingPrice(false); }
  };

  const doEqualizePrice = async (productName: string, price: number) => {
    if (!catalog) return;
    setSavingPrice(true);
    try {
      const updates = Object.keys(catalog.tenantLabels).map(t => ({ tenantId: t, priceSell: price }));
      await fetch('/api/groups/my/products/price-per-tenant', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ productName, updates }) });
      setCatalog(prev => {
        if (!prev) return prev;
        return { ...prev, rows: prev.rows.map(r => r.name === productName ? { ...r, tenants: Object.fromEntries(Object.entries(r.tenants).map(([tid, t]) => [tid, { ...t, priceSell: price }])) } : r) };
      });
      setEqualizeModal(null);
    } catch { alert('Erro ao equalizar preços'); }
    finally { setSavingPrice(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.priceCost) { setCreateMsg('Nome e preço de custo são obrigatórios.'); return; }
    const prices = Object.entries(selectedTenants).filter(([, v]) => v).map(([tid]) => ({ tenantId: tid, priceSell: parseFloat(tenantPrices[tid] || '0') }));
    if (prices.length === 0) { setCreateMsg('Selecione pelo menos uma loja.'); return; }
    setCreating(true); setCreateMsg('');
    try {
      const res = await fetch('/api/groups/my/products/create-in-tenants', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...form, priceCost: parseFloat(form.priceCost), tenantPrices: prices }) });
      const data = await res.json();
      const success = data.results?.filter((r: any) => r.success).length || 0;
      setCreateMsg(`Produto criado em ${success} loja(s)!`);
      setForm({ name: '', barcode: '', ncm: '', unit: 'UN', categoryName: 'Geral', priceCost: '' });
      loadCatalog();
    } catch { setCreateMsg('Erro ao criar produto.'); }
    finally { setCreating(false); }
  };

  const tids = catalog ? Object.keys(catalog.tenantLabels || {}) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Modal open={!!equalizeModal} onClose={() => setEqualizeModal(null)} title={`Equalizar Preço — ${equalizeModal}`}>
        <p style={{ color: '#665F70', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Define o mesmo preço de venda para <strong style={{ color: '#272321' }}>todas as lojas da rede</strong>.</p>
        <FF label="Novo Preço de Venda (todas as lojas)">
          <input type="number" step="0.01" min="0" placeholder="Ex: 49.90" value={equalizePriceValue} onChange={e => setEqualizePriceValue(e.target.value)} style={IS} autoFocus />
        </FF>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Btn onClick={() => setEqualizeModal(null)} outline>Cancelar</Btn>
          <Btn onClick={() => equalizePriceValue && equalizeModal && doEqualizePrice(equalizeModal, parseFloat(equalizePriceValue))} disabled={!equalizePriceValue || savingPrice}>
            {savingPrice ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Equalizar em Todas
          </Btn>
        </div>
      </Modal>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: '1rem', border: '1px solid #E5E1ED' }}>
        {[{ id: 'catalog' as const, label: 'Catálogo e Preços da Rede', icon: Tag }, { id: 'create' as const, label: 'Cadastrar Produto em Múltiplas Lojas', icon: Plus }].map(st => (
          <button
            key={st.id}
            type="button"
            onClick={() => {
              setSubTab(st.id);
              navigate(
                st.id === 'create'
                  ? '/grupo-portal/produtos/criar'
                  : '/grupo-portal/produtos',
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: '1px solid',
              borderColor: subTab === st.id ? '#7C3AED' : 'transparent',
              borderRadius: '0.625rem',
              background: subTab === st.id ? '#F3E8FF' : 'transparent',
              color: subTab === st.id ? '#7C3AED' : '#665F70',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            <st.icon size={15} />{st.label}
          </button>
        ))}
      </div>

      {subTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.82rem', color: '#665F70', fontWeight: 600 }}>
              {catalog ? `${catalog.rows.length} produtos na rede` : '...'} • Clique no preço para editar por filial
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#665F70' }} />
                <input type="text" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...IS, marginBottom: 0, paddingLeft: '2.25rem', width: '220px' }} />
              </div>
              <Btn onClick={loadCatalog} outline size="sm"><RefreshCw size={13} /> Atualizar</Btn>
            </div>
          </div>
          {loadingCatalog ? <div style={{ padding: '4rem', textAlign: 'center' }}><Loader2 size={24} className="animate-spin" color="#7C3AED" /></div>
            : !catalog ? null
              : (
                <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ background: '#F8F7FC', borderBottom: '1px solid #E5E1ED' }}>
                          <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', fontWeight: 700 }}>Produto</th>
                          {tids.map(tid => (
                            <th key={tid} style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', textAlign: 'center', fontWeight: 700 }}>
                              {catalog.tenantLabels[tid]}<div style={{ fontSize: '0.62rem', fontWeight: 500, color: '#665F70' }}>Preço de Venda</div>
                            </th>
                          ))}
                          <th style={{ padding: '0.875rem 1rem', fontSize: '0.72rem', color: '#665F70', textTransform: 'uppercase', textAlign: 'center', fontWeight: 700 }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalog.rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(row => (
                          <tr key={row.name} style={{ borderBottom: '1px solid #E5E1ED' }}>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#272321' }}>{row.name}</div>
                              {Object.values(row.tenants)[0]?.ncm && <div style={{ fontSize: '0.68rem', color: '#665F70' }}>NCM: {Object.values(row.tenants)[0].ncm}</div>}
                            </td>
                            {tids.map(tid => {
                              const cell = row.tenants[tid];
                              const isEditing = editingPrice?.name === row.name && editingPrice?.tenantId === tid;
                              if (!cell) return <td key={tid} style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#665F70', fontSize: '0.75rem' }}>—</td>;
                              return (
                                <td key={tid} style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                                  {isEditing ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <input type="number" step="0.01" autoFocus value={priceValue} onChange={e => setPriceValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') savePricePerTenant(row.name, tid, parseFloat(priceValue)); if (e.key === 'Escape') setEditingPrice(null); }} style={{ width: '84px', padding: '0.3rem 0.5rem', background: '#FFFFFF', border: '1px solid #7C3AED', borderRadius: '0.4rem', color: '#272321', fontSize: '0.82rem', outline: 'none', textAlign: 'center' }} />
                                      <button onClick={() => savePricePerTenant(row.name, tid, parseFloat(priceValue))} disabled={savingPrice} style={{ background: '#7C3AED', border: 'none', borderRadius: '0.35rem', color: '#FFFFFF', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{savingPrice ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}</button>
                                      <button onClick={() => setEditingPrice(null)} style={{ background: '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.35rem', color: '#665F70', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} /></button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }} onClick={() => { setEditingPrice({ name: row.name, tenantId: tid }); setPriceValue(String(cell.priceSell)); }} title="Clique para editar preço">
                                      <span style={{ fontWeight: 800, color: '#7C3AED', fontSize: '0.875rem' }}>{fmt(cell.priceSell)}</span>
                                      <Edit3 size={12} color="#665F70" />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                              <button type="button" onClick={() => { setEqualizeModal(row.name); setEqualizePriceValue(''); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', background: '#F3E8FF', border: '1px solid #E5E1ED', borderRadius: '0.5rem', color: '#7C3AED', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}>
                                <Copy size={11} /> Equalizar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {catalog.rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                          <tr><td colSpan={tids.length + 2} style={{ padding: '3rem', textAlign: 'center', color: '#665F70' }}>Nenhum produto encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </div>
      )}

      {subTab === 'create' && catalog && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.98rem', fontWeight: 800, color: '#272321', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Tag size={16} color="#7C3AED" /> Dados do Produto</h3>
            <FF label="Nome do Produto *"><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={IS} placeholder="Ex: Camiseta Básica Algodão" /></FF>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FF label="Código de Barras (EAN)"><input value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} style={IS} placeholder="Ex: 7891149107302" /></FF>
              <FF label="NCM"><input value={form.ncm} onChange={e => setForm(p => ({ ...p, ncm: e.target.value }))} style={IS} placeholder="Ex: 61091000" /></FF>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FF label="Unidade"><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={SS}>
                {['UN', 'KG', 'LT', 'CX', 'DZ', 'PCT', 'ML'].map(u => <option key={u} value={u}>{u}</option>)}
              </select></FF>
              <FF label="Categoria"><input value={form.categoryName} onChange={e => setForm(p => ({ ...p, categoryName: e.target.value }))} style={IS} placeholder="Ex: Camisetas" /></FF>
            </div>
            <FF label="Preço de Custo *"><input type="number" step="0.01" min="0" value={form.priceCost} onChange={e => setForm(p => ({ ...p, priceCost: e.target.value }))} style={IS} placeholder="Ex: 35.00" /></FF>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.98rem', fontWeight: 800, color: '#272321', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Store size={16} color="#7C3AED" /> Preço por Loja</h3>
            <div style={{ fontSize: '0.78rem', color: '#665F70', marginBottom: '1rem' }}>Selecione as lojas e defina o preço de venda em cada filial.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {tids.map(tid => (
                <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: selectedTenants[tid] ? '#F3E8FF' : '#F8F7FC', border: '1px solid #E5E1ED', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                  <input type="checkbox" checked={!!selectedTenants[tid]} onChange={() => setSelectedTenants(prev => ({ ...prev, [tid]: !prev[tid] }))} style={{ width: '16px', height: '16px', accentColor: '#7C3AED', cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem', color: '#272321' }}>{catalog.tenantLabels[tid]}</div>
                  {selectedTenants[tid] && (
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#665F70', fontSize: '0.75rem', fontWeight: 700 }}>R$</span>
                      <input type="number" step="0.01" min="0" placeholder="0,00" value={tenantPrices[tid] || ''} onChange={e => setTenantPrices(prev => ({ ...prev, [tid]: e.target.value }))} style={{ width: '105px', padding: '0.4rem 0.5rem 0.4rem 2rem', background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '0.5rem', color: '#272321', fontSize: '0.85rem', outline: 'none' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {createMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#F3E8FF', border: '1px solid #E5E1ED', borderRadius: '0.625rem', fontSize: '0.82rem', color: '#7C3AED', fontWeight: 700 }}>
                {createMsg}
              </div>
            )}

            <Btn onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? 'Criando...' : 'Criar Produto nas Lojas Selecionadas'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Transferências ────────────────────────────────────────────────────────

function TabTransferencias() {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fromTenantId: '', toTenantId: '', productId: '', quantity: '' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/groups/my/stock', { headers: authHeaders() })
      .then(r => r.json()).then(setStockData).finally(() => setLoading(false));
  }, []);

  const tids = stockData ? Object.keys(stockData.tenantLabels || {}) : [];

  const availableProducts = form.fromTenantId && stockData
    ? stockData.rows.filter(r => r.tenants[form.fromTenantId]?.qty > 0)
    : [];

  const handleTransfer = async () => {
    if (!form.fromTenantId || !form.toTenantId || !form.productId || !form.quantity) { setMsg('Preencha todos os campos.'); return; }
    if (form.fromTenantId === form.toTenantId) { setMsg('Origem e destino devem ser diferentes.'); return; }
    setSending(true); setMsg('');
    try {
      const res = await fetch('/api/groups/my/stock-transfer', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ fromTenantId: form.fromTenantId, toTenantId: form.toTenantId, productId: form.productId, quantity: parseFloat(form.quantity) }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Erro ao transferir');
      }
      setMsg('Transferência realizada com sucesso!');
      setForm(p => ({ ...p, productId: '', quantity: '' }));
    } catch (e: any) { setMsg(e?.message || 'Erro ao transferir.'); }
    finally { setSending(false); }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}><Loader2 size={24} className="animate-spin" color="#7C3AED" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E1ED', borderRadius: '1rem', padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 800, color: '#272321', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeftRight size={18} color="#7C3AED" /> Transferência de Estoque entre Filiais
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#665F70' }}>Transfira mercadorias entre as lojas da rede com baixa FIFO automática e registro no histórico.</p>

        <FF label="Loja de Origem">
          <select value={form.fromTenantId} onChange={e => setForm(p => ({ ...p, fromTenantId: e.target.value, productId: '' }))} style={SS}>
            <option value="">Selecione a loja de origem...</option>
            {tids.map(tid => <option key={tid} value={tid}>{stockData!.tenantLabels[tid]}</option>)}
          </select>
        </FF>
        <FF label="Loja de Destino">
          <select value={form.toTenantId} onChange={e => setForm(p => ({ ...p, toTenantId: e.target.value }))} style={SS}>
            <option value="">Selecione a loja de destino...</option>
            {tids.filter(t => t !== form.fromTenantId).map(tid => <option key={tid} value={tid}>{stockData!.tenantLabels[tid]}</option>)}
          </select>
        </FF>
        <FF label="Produto">
          <select value={form.productId} onChange={e => setForm(p => ({ ...p, productId: e.target.value }))} style={SS} disabled={!form.fromTenantId}>
            <option value="">Selecione o produto...</option>
            {availableProducts.map(r => <option key={r.tenants[form.fromTenantId].productId} value={r.tenants[form.fromTenantId].productId}>{r.name} (disponível: {r.tenants[form.fromTenantId].qty})</option>)}
          </select>
        </FF>
        <FF label="Quantidade a Transferir">
          <input type="number" step="0.001" min="0.001" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} style={IS} placeholder="Ex: 10" />
        </FF>
        {msg && <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#F3E8FF', border: '1px solid #E5E1ED', borderRadius: '0.625rem', fontSize: '0.82rem', color: '#7C3AED', fontWeight: 700 }}>{msg}</div>}
        <Btn onClick={handleTransfer} disabled={sending}>
          {sending ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
          {sending ? 'Transferindo...' : 'Confirmar Transferência'}
        </Btn>
      </div>
    </div>
  );
}

// ─── Main Page (Integrada ao RetailLayout) ────────────────────────────────────

export default function GroupPortalPage() {
  const location = useLocation();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const [dateFilter, setDateFilter] = useState('30d');

  const activeTab = location.pathname.startsWith('/grupo-portal/produtos')
    ? 'produtos'
    : routeTab === 'previsao'
      ? 'forecast'
      : routeTab === 'estoque'
        ? 'estoque'
        : routeTab === 'produtos'
          ? 'produtos'
          : routeTab === 'transferencias'
            ? 'transferencias'
            : 'dashboard';

  return (
    <div style={{ width: '100%' }}>
      {activeTab === 'dashboard' && (
        <TabDashboard
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
        />
      )}
      {activeTab === 'forecast' && <TabForecast />}
      {activeTab === 'estoque' && <TabEstoque />}
      {activeTab === 'produtos' && <TabProdutos />}
      {activeTab === 'transferencias' && <TabTransferencias />}
    </div>
  );
}
