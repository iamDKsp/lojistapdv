/**
 * ConnectionStatus.tsx — Badge de Status de Conexão
 * Mostra ao operador o estado atual: Online / Offline / Sincronizando / Pendente
 */

import { Wifi, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import type { OfflineSyncState } from "@/hooks/useOfflineSync";
import PdvLojistaLoader from "./PdvLojistaLoader";

interface ConnectionStatusProps {
  syncState: OfflineSyncState;
}

export function ConnectionStatus({ syncState }: ConnectionStatusProps) {
  const { isOnline, pendingCount, isSyncing, syncNow } = syncState;

  // ── Sincronizando ────────────────────────────────────────────────────────
  if (isSyncing) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-support border border-brand text-brand text-sm font-semibold"
      >
        <PdvLojistaLoader
          mode="loader"
          compact
          size={16}
          label="Sincronizando…"
        />
        <span>Sincronizando…</span>
      </div>
    );
  }

  // ── Offline ──────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-support border border-brand text-brand text-sm font-bold"
      >
        <WifiOff size={14} />
        <span>OFFLINE</span>
        {pendingCount > 0 && (
          <span className="ml-1 bg-brand text-on-brand text-xs font-black px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // ── Online com pendentes ─────────────────────────────────────────────────
  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={syncNow}
        data-tooltip="Clique para sincronizar agora"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-support border border-brand text-brand text-sm font-semibold hover:bg-support transition-colors cursor-pointer"
      >
        <CloudOff size={14} />
        <span>
          {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
        </span>
        <RefreshCw size={12} className="opacity-70" />
      </button>
    );
  }

  // ── Online e sincronizado ─────────────────────────────────────────────────
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-brand text-xs font-medium"
      data-tooltip="Conexão ativa e sincronizada"
    >
      <Wifi size={13} />
      <span>Online</span>
    </div>
  );
}
