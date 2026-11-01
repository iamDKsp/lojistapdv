import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import pino from 'pino';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { normalizeBrazilWhatsappPhone } from './crediario.rules';

export type WhatsappConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_READY'
  | 'CONNECTED';

export interface TenantWhatsappStateSnapshot {
  tenantId: string;
  status: WhatsappConnectionStatus;
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface InternalSessionEntry {
  tenantId: string;
  databaseUrl: string;
  status: WhatsappConnectionStatus;
  qrRaw: string | null;
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
  updatedAt: Date;
  socket: any | null;
  reconnectTimer: NodeJS.Timeout | null;
  manualDisconnect: boolean;
}

// Carregador dinâmico compatível com CommonJS + ESM no Node 20/22
const importBaileys = (): Promise<any> =>
  new Function('return import("@whiskeysockets/baileys")')();

@Injectable()
export class WhatsappBaileysService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappBaileysService.name);
  private readonly sessions = new Map<string, InternalSessionEntry>();
  private readonly silentLogger = pino({ level: 'silent' });

  constructor(private readonly tenantManager: TenantConnectionManager) {}

  onModuleDestroy() {
    for (const entry of this.sessions.values()) {
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      try {
        entry.socket?.end?.(undefined);
      } catch {
        // ignore
      }
    }
    this.sessions.clear();
  }

  private getOrCreateEntry(
    tenantId: string,
    databaseUrl: string,
  ): InternalSessionEntry {
    let entry = this.sessions.get(tenantId);
    if (!entry) {
      entry = {
        tenantId,
        databaseUrl,
        status: 'DISCONNECTED',
        qrRaw: null,
        qrDataUrl: null,
        connectedPhone: null,
        connectedName: null,
        lastError: null,
        updatedAt: new Date(),
        socket: null,
        reconnectTimer: null,
        manualDisconnect: false,
      };
      this.sessions.set(tenantId, entry);
    } else {
      entry.databaseUrl = databaseUrl;
    }
    return entry;
  }

  private toSnapshot(entry: InternalSessionEntry): TenantWhatsappStateSnapshot {
    return {
      tenantId: entry.tenantId,
      status: entry.status,
      qrDataUrl: entry.qrDataUrl,
      connectedPhone: entry.connectedPhone,
      connectedName: entry.connectedName,
      lastError: entry.lastError,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  /**
   * Estado de autenticação do Baileys persistido na tabela `whatsapp_auth_states` do banco do tenant.
   * Permite que a sessão sobreviva a reinicializações do servidor sem exigir novo QR Code.
   */
  private async createPostgresAuthState(prisma: any, baileys: any) {
    const { initAuthCreds, BufferJSON, proto } = baileys;

    const readData = async (id: string) => {
      try {
        const row = await prisma.whatsappAuthState.findUnique({ where: { id } });
        if (!row?.data) return null;
        return JSON.parse(row.data, BufferJSON.reviver);
      } catch {
        return null;
      }
    };

    const writeData = async (id: string, value: any) => {
      const serialized = JSON.stringify(value, BufferJSON.replacer);
      await prisma.whatsappAuthState.upsert({
        where: { id },
        update: { data: serialized },
        create: { id, data: serialized },
      });
    };

    const removeData = async (id: string) => {
      try {
        await prisma.whatsappAuthState.deleteMany({ where: { id } });
      } catch {
        // ignore
      }
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const data: Record<string, any> = {};
            await Promise.all(
              ids.map(async (id) => {
                let value = await readData(`${type}-${id}`);
                if (type === 'app-state-sync-key' && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                data[id] = value;
              }),
            );
            return data;
          },
          set: async (data: Record<string, Record<string, any>>) => {
            const tasks: Promise<any>[] = [];
            for (const category of Object.keys(data)) {
              for (const id of Object.keys(data[category])) {
                const value = data[category][id];
                const key = `${category}-${id}`;
                tasks.push(value ? writeData(key, value) : removeData(key));
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: async () => {
        await writeData('creds', creds);
      },
      clearAll: async () => {
        await prisma.whatsappAuthState.deleteMany({});
      },
    };
  }

  async getStatus(
    tenantId: string,
    databaseUrl: string,
  ): Promise<TenantWhatsappStateSnapshot> {
    const entry = this.getOrCreateEntry(tenantId, databaseUrl);
    if (entry.status === 'DISCONNECTED' && !entry.socket && !entry.manualDisconnect) {
      // Verifica se já existem credenciais salvas no banco para restaurar automaticamente
      try {
        const prisma = await this.tenantManager.getTenantClient(
          tenantId,
          databaseUrl,
        );
        const existingCreds = await prisma.whatsappAuthState.findUnique({
          where: { id: 'creds' },
          select: { id: true },
        });
        if (existingCreds) {
          void this.startSocket(tenantId, databaseUrl, false);
        }
      } catch {
        // Tabela pode ainda não existir se o tenant não rodou atualização no Sys-Init
      }
    }
    return this.toSnapshot(entry);
  }

  async connect(
    tenantId: string,
    databaseUrl: string,
    resetSession = false,
  ): Promise<TenantWhatsappStateSnapshot> {
    const entry = this.getOrCreateEntry(tenantId, databaseUrl);
    entry.manualDisconnect = false;
    entry.lastError = null;

    if (resetSession) {
      await this.disconnect(tenantId, databaseUrl);
    }

    await this.startSocket(tenantId, databaseUrl, true);
    return this.toSnapshot(entry);
  }

  async disconnect(
    tenantId: string,
    databaseUrl: string,
  ): Promise<TenantWhatsappStateSnapshot> {
    const entry = this.getOrCreateEntry(tenantId, databaseUrl);
    entry.manualDisconnect = true;
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }

    if (entry.socket) {
      try {
        await entry.socket.logout?.();
      } catch {
        // ignore logout error if socket was not open
      }
      try {
        entry.socket.end?.(undefined);
      } catch {
        // ignore
      }
      entry.socket = null;
    }

    try {
      const prisma = await this.tenantManager.getTenantClient(
        tenantId,
        databaseUrl,
      );
      await prisma.whatsappAuthState.deleteMany({});
    } catch {
      // ignore
    }

    entry.status = 'DISCONNECTED';
    entry.qrRaw = null;
    entry.qrDataUrl = null;
    entry.connectedPhone = null;
    entry.connectedName = null;
    entry.updatedAt = new Date();
    return this.toSnapshot(entry);
  }

  private async startSocket(
    tenantId: string,
    databaseUrl: string,
    waitForQrOrOpen = false,
  ): Promise<void> {
    const entry = this.getOrCreateEntry(tenantId, databaseUrl);
    if (
      entry.socket &&
      (entry.status === 'CONNECTING' ||
        entry.status === 'QR_READY' ||
        entry.status === 'CONNECTED')
    ) {
      return;
    }

    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }

    entry.status = 'CONNECTING';
    entry.updatedAt = new Date();

    try {
      const prisma = await this.tenantManager.getTenantClient(
        tenantId,
        databaseUrl,
      );
      const baileys = await importBaileys();
      const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
      const { DisconnectReason, fetchLatestBaileysVersion } = baileys;

      const { state, saveCreds, clearAll } = await this.createPostgresAuthState(
        prisma,
        baileys,
      );

      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const latest = await fetchLatestBaileysVersion();
        if (latest?.version) version = latest.version;
      } catch {
        // fallback para versão padrão se sem acesso externo no momento
      }

      const sock = makeWASocket({
        version,
        auth: state,
        logger: this.silentLogger as any,
        printQRInTerminal: false,
        browser: ['PDV Lojista', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
      });

      entry.socket = sock;

      let resolvedInitialWait = false;
      let resolveInitialPromise: (() => void) | null = null;
      const initialWaitPromise = waitForQrOrOpen
        ? new Promise<void>((resolve) => {
            resolveInitialPromise = resolve;
            setTimeout(() => {
              if (!resolvedInitialWait) {
                resolvedInitialWait = true;
                resolve();
              }
            }, 6500);
          })
        : Promise.resolve();

      const completeWait = () => {
        if (!resolvedInitialWait && resolveInitialPromise) {
          resolvedInitialWait = true;
          resolveInitialPromise();
        }
      };

      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
        } catch (err: any) {
          this.logger.warn(
            `Falha ao salvar credenciais WhatsApp do tenant ${tenantId}: ${err.message}`,
          );
        }
      });

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          entry.qrRaw = qr;
          try {
            entry.qrDataUrl = await QRCode.toDataURL(qr, {
              width: 280,
              margin: 2,
              color: {
                dark: '#272321',
                light: '#FFFFFF',
              },
            });
          } catch {
            entry.qrDataUrl = null;
          }
          entry.status = 'QR_READY';
          entry.lastError = null;
          entry.updatedAt = new Date();
          completeWait();
        }

        if (connection === 'open') {
          const rawId: string = sock.user?.id || '';
          const phonePart = rawId.split(':')[0]?.split('@')[0] || null;
          entry.status = 'CONNECTED';
          entry.qrRaw = null;
          entry.qrDataUrl = null;
          entry.connectedPhone = phonePart;
          entry.connectedName = sock.user?.name || sock.user?.verifiedName || 'WhatsApp da Loja';
          entry.lastError = null;
          entry.updatedAt = new Date();
          this.logger.log(
            `WhatsApp (Baileys) conectado com sucesso para o tenant ${tenantId} (${phonePart})`,
          );
          completeWait();
        }

        if (connection === 'close') {
          const statusCode =
            (lastDisconnect?.error as any)?.output?.statusCode ??
            (lastDisconnect?.error as any)?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;

          entry.socket = null;
          entry.qrRaw = null;
          entry.qrDataUrl = null;
          entry.updatedAt = new Date();

          if (isLoggedOut || entry.manualDisconnect) {
            await clearAll();
            entry.status = 'DISCONNECTED';
            entry.connectedPhone = null;
            entry.connectedName = null;
            if (isLoggedOut && !entry.manualDisconnect) {
              entry.lastError =
                'A sessão do WhatsApp foi desconectada pelo aparelho. Gere um novo QR Code para reconectar.';
            }
            completeWait();
          } else {
            entry.status = 'CONNECTING';
            entry.lastError =
              lastDisconnect?.error?.message || 'Reconectando ao WhatsApp...';
            entry.reconnectTimer = setTimeout(() => {
              void this.startSocket(tenantId, databaseUrl, false);
            }, 5000);
            completeWait();
          }
        }
      });

      await initialWaitPromise;
    } catch (err: any) {
      entry.status = 'DISCONNECTED';
      entry.socket = null;
      entry.lastError = err?.message || 'Erro ao inicializar conexão com WhatsApp.';
      entry.updatedAt = new Date();
      this.logger.error(
        `Erro ao iniciar Baileys para o tenant ${tenantId}: ${entry.lastError}`,
      );
    }
  }

  /**
   * Envia uma mensagem de texto pelo WhatsApp da loja conectada via Baileys.
   * Resolve automaticamente o JID com ou sem o 9º dígito brasileiro.
   */
  async sendTextMessage(
    tenantId: string,
    databaseUrl: string,
    rawPhone: string,
    text: string,
  ): Promise<{ jid: string; messageId?: string }> {
    const normalized = normalizeBrazilWhatsappPhone(rawPhone);
    const entry = this.getOrCreateEntry(tenantId, databaseUrl);

    if (entry.status !== 'CONNECTED' || !entry.socket) {
      // Tenta restaurar caso existam credenciais salvas no banco
      await this.getStatus(tenantId, databaseUrl);
    }

    if (entry.status !== 'CONNECTED' || !entry.socket) {
      throw new BadRequestException(
        'O WhatsApp desta loja não está conectado. Acesse a aba WhatsApp do Crediário e escaneie o QR Code.',
      );
    }

    const sock = entry.socket;
    let targetJid = normalized.primaryJid;

    try {
      if (typeof sock.onWhatsApp === 'function') {
        for (const candidate of normalized.candidateJids) {
          const numOnly = candidate.replace('@s.whatsapp.net', '');
          const results = await sock.onWhatsApp(numOnly);
          if (Array.isArray(results) && results[0]?.exists && results[0]?.jid) {
            targetJid = results[0].jid;
            break;
          }
        }
      }
    } catch {
      // Se a consulta onWhatsApp falhar, tenta o envio direto para o JID primário
    }

    const sent = await sock.sendMessage(targetJid, { text });
    return {
      jid: targetJid,
      messageId: sent?.key?.id,
    };
  }
}
