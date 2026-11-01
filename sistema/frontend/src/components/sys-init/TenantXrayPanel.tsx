import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Database,
  RefreshCw,
  Loader2,
  Package,
  Layers,
  Users,
  ShoppingCart,
  DollarSign,
  FileText,
  Clock,
  Store,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  pin: string;
  tenant: any;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

export function TenantXrayPanel({ pin, tenant }: Props) {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/tenants/setup/${tenant.id}/stats`, {
        headers: { "x-setup-pin": pin },
      });
      setStats(res.data);
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Erro ao consultar Raio-X do banco."
      );
    } finally {
      setLoading(false);
    }
  }, [pin, tenant?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
        <div>
          <h4 className="text-sm font-bold text-ink flex items-center gap-2">
            <Activity size={16} className="text-brand" />
            <span>
              Diagnóstico Operacional em Tempo Real ({tenant?.databaseName})
            </span>
          </h4>
          <p className="text-xs text-muted">
            Métricas extraídas diretamente do banco PostgreSQL isolado desta
            loja.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-page hover:bg-support text-ink border border-line text-xs font-bold flex items-center gap-1.5 transition"
        >
          <RefreshCw
            size={13}
            className={`text-brand ${loading ? "animate-spin" : ""}`}
          />
          <span>Atualizar Raio-X</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted">
          <Loader2
            size={28}
            className="animate-spin mx-auto mb-2 text-brand"
          />
          <p className="text-xs">
            Consultando métricas em tempo real no PostgreSQL...
          </p>
        </div>
      ) : !stats ? (
        <div className="bg-page border border-line rounded-2xl p-8 text-center text-muted text-xs">
          Não foi possível carregar as estatísticas deste banco de dados.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-page border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Tamanho do Banco
                </span>
                <Database size={14} className="text-brand" />
              </div>
              <p className="text-lg font-extrabold text-brand font-mono">
                {formatBytes(stats.dbSizeBytes)}
              </p>
              <p className="text-[11px] text-muted font-mono truncate">
                {stats.databaseName}
              </p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Produtos / Variações
                </span>
                <Package size={14} className="text-brand" />
              </div>
              <p className="text-lg font-extrabold text-ink font-mono">
                {stats.totalProducts}
              </p>
              <p className="text-[11px] text-muted">
                {stats.totalRetailGroups} grupo(s) · {stats.totalCategories}{" "}
                categoria(s)
              </p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Vendas Realizadas
                </span>
                <ShoppingCart size={14} className="text-brand" />
              </div>
              <p className="text-lg font-extrabold text-ink font-mono">
                {stats.totalSales}
              </p>
              <p className="text-[11px] text-muted">
                Hoje:{" "}
                <strong className="text-brand">{stats.totalSalesToday}</strong>{" "}
                venda(s)
              </p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between text-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Faturamento Acumulado
                </span>
                <DollarSign size={14} className="text-brand" />
              </div>
              <p className="text-lg font-extrabold text-brand font-mono">
                R${" "}
                {Number(stats.totalRevenue || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-muted">
                Hoje: R${" "}
                {Number(stats.revenueToday || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-page border border-line rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-muted text-[10px] font-bold uppercase mb-1">
                <Store size={13} className="text-brand" />
                <span>Caixas Abertos</span>
              </div>
              <p className="text-base font-extrabold text-ink font-mono">
                {stats.openRegisters} ativo(s)
              </p>
              <p className="text-[11px] text-muted">
                {stats.totalOperators} operador(es) cadastrado(s)
              </p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-muted text-[10px] font-bold uppercase mb-1">
                <Users size={13} className="text-brand" />
                <span>Clientes & Fornecedores</span>
              </div>
              <p className="text-base font-extrabold text-ink font-mono">
                {stats.totalCustomers} cliente(s)
              </p>
              <p className="text-[11px] text-muted">
                {stats.totalSuppliers} fornecedor(es)
              </p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-muted text-[10px] font-bold uppercase mb-1">
                <FileText size={13} className="text-brand" />
                <span>NFC-e Autorizadas</span>
              </div>
              <p className="text-base font-extrabold text-ink font-mono">
                {stats.totalNfceEmitidas} nota(s)
              </p>
              <p className="text-[11px] text-muted">Emitidas pela SEFAZ</p>
            </div>

            <div className="bg-page border border-line rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-muted text-[10px] font-bold uppercase mb-1">
                <Clock size={13} className="text-brand" />
                <span>Última Venda</span>
              </div>
              <p className="text-xs font-bold text-ink">
                {stats.lastSaleAt
                  ? new Date(stats.lastSaleAt).toLocaleString("pt-BR")
                  : "Nenhuma venda"}
              </p>
              {stats.lastSaleTotal != null && (
                <p className="text-[11px] text-brand font-mono font-bold">
                  Valor: R$ {Number(stats.lastSaleTotal).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
