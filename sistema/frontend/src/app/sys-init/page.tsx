"use client";
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck, Building2, User, Mail, Lock, Database, Loader2, CheckCircle2,
  AlertCircle, ArrowRight, Eye, EyeOff, Search, Edit, Image as ImageIcon,
  Settings, ToggleLeft, ToggleRight, AlertTriangle, Upload, X, Terminal,
  ChevronDown, ChevronRight, Trash2, DollarSign, Users, Plus, Phone, FileText,
  Clock, CreditCard, History, Info, Copy, Check, Edit2, LockKeyhole, Sparkles, UserPlus,
  Activity, CalendarDays, LayoutGrid, LogIn, RefreshCw, Ban, MessageCircle, Send, Server
} from "lucide-react";
import { exportTelemetry, clearTelemetry } from "@/lib/telemetry";
import { db } from "@/lib/db";
import { useAuthStore } from "@/store/auth";
import { useOperatorTokenStore } from "@/store/operatorToken";
import { TenantBillingCalendar } from "@/components/TenantBillingCalendar";
import { TenantInvoicesManager } from "@/components/sys-init/TenantInvoicesManager";
import { LeadgerIntegrationPanel } from "@/components/sys-init/LeadgerIntegrationPanel";
import { LeadsPanel } from "@/components/sys-init/LeadsPanel";
import { TenantXrayPanel } from "@/components/sys-init/TenantXrayPanel";
import { SysInitLogin, SYS_INIT_PROFILES, type SysInitProfile } from "@/components/sys-init/SysInitLogin";
import {
  BASE_PLAN_PRICE,
  BRANCH_PLAN_PRICE,
  BRANCH_DISCOUNT_VALUE,
  COMMERCIAL_MODULES,
  DEFAULT_TENANT_MODULES,
  calculateTenantMonthlyPrice,
  formatBrlCurrency,
  normalizeTenantModules,
} from "@/lib/modular-pricing";
const ImageOptimizationPanel = lazy(() => import("@/components/ImageOptimizationPanel"));


const PIN_LENGTH = 10;

type Step = "pin" | "list" | "create" | "edit" | "success" | "backups";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Avança a data em exatamente 1 mês, preservando o dia e sem overflow (dia 31 → último dia do mês) */
function addOneMonthSafe(date: Date): Date {
  const originalDay = date.getDate();
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const lastDayOfNextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDayOfNextMonth));
  return d;
}

/** Converte string "YYYY-MM-DD" para Date no horário local (sem offset de timezone) */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const MODULE_BADGES: Record<string, { label: string; color: string }> = {
  nfce:                   { label: 'NFC-e & XML',   color: 'bg-support text-brand border-brand' },
  lojaVirtual:            { label: 'Loja Virtual',  color: 'bg-support text-brand border-brand' },
  entregaLojaVirtual:     { label: '99 Entregas',   color: 'bg-support text-brand border-brand' },
  crediario:              { label: 'Crediário',     color: 'bg-support text-brand border-brand' },
  fornecedores:           { label: 'Fornecedores SP', color: 'bg-support text-brand border-brand' },
  vendedores:             { label: 'Vendedores',    color: 'bg-support text-brand border-brand' },
  inteligenciaComercial:  { label: 'Inteligência',  color: 'bg-support text-brand border-brand' },
  vitrineDigital:         { label: 'Vitrine TV',    color: 'bg-support text-brand border-brand' },
  multiEmpresa:           { label: 'Multi-Empresa', color: 'bg-support text-brand border-brand' },
  filialMultiEmpresa:     { label: 'Filial (-R$ 50)', color: 'bg-surface text-ink border-line' },
};

function ModuleBadges({ modulosRaw }: { modulosRaw: any }) {
  const m = normalizeTenantModules(modulosRaw);
  const commercialKeys = COMMERCIAL_MODULES.map((mod) => mod.id).filter((id) => Boolean(m[id]));

  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border bg-surface text-ink border-line">
        {m.filialMultiEmpresa ? 'Base Filial R$ 99,90' : 'Base R$ 149,90'}
      </span>
      {commercialKeys.map(key => {
        const badge = MODULE_BADGES[key] || { label: key, color: 'bg-support text-muted border-line' };
        return (
          <span key={key} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${badge.color}`}>
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

export default function SysInitPage() {
  const [imageOptimizationOpen, setImageOptimizationOpen] = useState(false);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pin");

  const [activeTab, setActiveTab] = useState<"tenants" | "leads" | "groups" | "sql" | "leadger">("tenants");
  const [leadsCount, setLeadsCount] = useState<number>(0);

  // ── SQL EDITOR STATE ──────────────────────────────────────────────────
  const [sqlPinUnlocked, setSqlPinUnlocked] = useState(false);
  const [sqlPinInput, setSqlPinInput] = useState('');
  const [sqlPinError, setSqlPinError] = useState('');
  const [sqlSelectedDb, setSqlSelectedDb] = useState<{ tenantId?: string; useHeart?: boolean; label: string }>({ useHeart: true, label: ' Heart (master)' });
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM tenants LIMIT 10');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState('');
  const [sqlHistory, setSqlHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('lojista-sql-history') || '[]'); } catch { return []; }
  });
  const [sqlTables, setSqlTables] = useState<string[]>([]);
  const [sqlLoadingTables, setSqlLoadingTables] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string; value: string; id: string } | null>(null);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);

  // ── TELEMETRIA LOCAL ───────────────────────────────────────────────────
  const [telemetryCount, setTelemetryCount] = useState<number>(0);
  const refreshTelemetryCount = useCallback(async () => {
    try {
      const count = await db.telemetry_events?.count();
      setTelemetryCount(count || 0);
    } catch { /* silencioso */ }
  }, []);

  const handleExportTelemetry = async () => {
    try {
      const events = await exportTelemetry();
      if (events.length === 0) {
        toast.info("Nenhum evento de telemetria registrado neste navegador.");
        return;
      }
      const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `telemetria-lojista-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${events.length} evento(s) de telemetria exportado(s)!`);
    } catch {
      toast.error("Erro ao exportar telemetria.");
    }
  };

  const handleClearTelemetry = async () => {
    if (!window.confirm("Deseja limpar todos os registros locais de telemetria deste navegador?")) return;
    await clearTelemetry();
    await refreshTelemetryCount();
    toast.success("Telemetria local limpa com sucesso.");
  };

  // ── TENANT LIST & FILTERS ─────────────────────────────────────────────
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "overdue" | "due_soon" | "no_date">("all");
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [includeHeart, setIncludeHeart] = useState(false);
  const [tenantView, setTenantView] = useState<"calendar" | "cards">("cards");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);

  // ── GROUPS LIST ───────────────────────────────────────────────────────
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupUsers, setGroupUsers] = useState<any[]>([]);
  const [loadingGroupUsers, setLoadingGroupUsers] = useState(false);
  const [newMemberTenantId, setNewMemberTenantId] = useState("");
  const [newMemberAlias, setNewMemberAlias] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  // ── DATABASE MIGRATION STATE ──────────────────────────────────────────
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any[]>([]);
  const [activeLogTenantId, setActiveLogTenantId] = useState<string | null>(null);

  // ── PIN step ──────────────────────────────────────────────────────────
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [pinError, setpinError] = useState("");
  const [pinShake, setPinShake] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [sysInitUser, setSysInitUser] = useState<SysInitProfile>(() => {
    try {
      const saved = sessionStorage.getItem("lojista-sysinit-user");
      if (saved) return JSON.parse(saved);
      const savedEmail = localStorage.getItem("lojista_sysinit_remember_profile");
      const found = SYS_INIT_PROFILES.find(p => p.email === savedEmail);
      if (found) return found;
    } catch {}
    return SYS_INIT_PROFILES[0];
  });

  // ── Create Form step ──────────────────────────────────────────────────
  const [tenantName, setTenantName] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbNameManual, setDbNameManual] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [newCnpj, setNewCnpj] = useState("");
  const [newTelefone, setNewTelefone] = useState("");
  const [newSyncLeadger, setNewSyncLeadger] = useState(true);
  const [seedProducts, setSeedProducts] = useState(true);
  const [createModulos, setCreateModulos] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_TENANT_MODULES,
  }));
  const [createAutoPrice, setCreateAutoPrice] = useState(true);
  const [mensalidadeValor, setMensalidadeValor] = useState(BASE_PLAN_PRICE.toFixed(2));
  const [mensalidadeVencimento, setMensalidadeVencimento] = useState("");
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [createLogoPreview, setCreateLogoPreview] = useState<string>("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  // ── Edit Form step ────────────────────────────────────────────────────
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editTab, setEditTab] = useState<"identidade" | "modulos" | "fiscal" | "financeiro" | "usuarios" | "xray">("identidade");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string>("");
  const [modulos, setModulos] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_TENANT_MODULES,
  }));
  const [autoSyncPrice, setAutoSyncPrice] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  const applyModuleChangeRules = (
    current: Record<string, boolean>,
    key: string,
    nextVal: boolean,
  ): Record<string, boolean> => {
    const updated: Record<string, boolean> = {
      ...normalizeTenantModules(current),
      [key]: nextVal,
    };
    if (key === "nfce") {
      updated.importacaoXml = nextVal;
    } else if (key === "importacaoXml") {
      updated.nfce = nextVal;
    }
    if (key === "entregaLojaVirtual" && nextVal) {
      updated.lojaVirtual = true;
    }
    if (key === "lojaVirtual" && !nextVal) {
      updated.entregaLojaVirtual = false;
    }
    return updated;
  };

  const handleToggleCreateModule = (key: string) => {
    setCreateModulos((prev) => {
      const next = applyModuleChangeRules(prev, key, !prev[key]);
      if (createAutoPrice) {
        const calc = calculateTenantMonthlyPrice(next);
        setMensalidadeValor(calc.totalPrice.toFixed(2));
      }
      return next;
    });
  };

  const handleToggleEditModule = (key: string) => {
    setModulos((prev) => {
      const next = applyModuleChangeRules(prev, key, !prev[key]);
      if (autoSyncPrice) {
        const calc = calculateTenantMonthlyPrice(next);
        setEditingTenant((curr: any) =>
          curr ? { ...curr, mensalidadeValor: calc.totalPrice.toFixed(2) } : curr,
        );
      }
      return next;
    });
  };

  const handleApplyEditModulesPreset = (mode: "base" | "full") => {
    setModulos((prev) => {
      const next: Record<string, boolean> = {
        ...DEFAULT_TENANT_MODULES,
        filialMultiEmpresa: Boolean(prev.filialMultiEmpresa),
      };
      if (mode === "full") {
        COMMERCIAL_MODULES.forEach((m) => {
          next[m.id] = true;
        });
        next.importacaoXml = true;
      }
      if (autoSyncPrice) {
        const calc = calculateTenantMonthlyPrice(next);
        setEditingTenant((curr: any) =>
          curr ? { ...curr, mensalidadeValor: calc.totalPrice.toFixed(2) } : curr,
        );
      }
      return next;
    });
  };

  useEffect(() => {
    if (!createLogoFile) {
      setCreateLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(createLogoFile);
    setCreateLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [createLogoFile]);

  useEffect(() => {
    if (!logoFile) {
      setEditLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setEditLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  // Users State
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', pin: '', role: 'operator' });

  // Payment History & Invoices State
  const [tenantInvoices, setTenantInvoices] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);
  const [registeringPayment, setRegisteringPayment] = useState(false);
  const [paymentObservacao, setPaymentObservacao] = useState("");

  // Backups State
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [backupSchedule, setBackupSchedule] = useState({ enabled: false, time: '02:00' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const pin = pinDigits.join('');
      const res = await api.get('/sys-init/backups', { headers: { 'x-setup-pin': pin } });
      setBackupsList(res.data);
      const scheduleRes = await api.get('/sys-init/backups/schedule', { headers: { 'x-setup-pin': pin } });
      setBackupSchedule(scheduleRes.data);
    } catch (e) {
      toast.error('Erro ao carregar backups.');
    } finally {
      setLoadingBackups(false);
    }
  };

  const loadInvoicesAndHistory = useCallback(async (tenantId: string) => {
    setLoadingPaymentHistory(true);
    try {
      const pin = pinDigits.join('');
      const res = await api.get(`/tenants/setup/${tenantId}/invoices`, { headers: { 'x-setup-pin': pin } });
      setTenantInvoices(res.data?.invoices || []);
      setPaymentHistory(res.data?.paymentHistory || res.data?.paymentLogs || []);
      if (res.data?.tenant) {
        setEditingTenant((prev: any) => prev && prev.id === tenantId ? {
          ...prev,
          mensalidadeValor: res.data.tenant.mensalidadeValor,
          mensalidadeVencimento: res.data.tenant.mensalidadeVencimento,
        } : prev);
      }
    } catch {
      try {
        const pin = pinDigits.join('');
        const res = await api.get(`/tenants/setup/${tenantId}/payment-history`, { headers: { 'x-setup-pin': pin } });
        setPaymentHistory(res.data || []);
      } catch {
        toast.error('Erro ao carregar faturas e histórico.');
      }
    } finally {
      setLoadingPaymentHistory(false);
    }
  }, [pinDigits]);

  const handleImpersonate = async (tenant: any, userId?: string) => {
    if (!tenant?.id) return;
    setImpersonatingId(userId || tenant.id);
    try {
      const pin = pinDigits.join('');
      const res = await api.post(
        `/tenants/setup/${tenant.id}/impersonate`,
        userId ? { userId } : {},
        { headers: { 'x-setup-pin': pin } }
      );
      if (res.data?.access_token && res.data?.user) {
        useOperatorTokenStore.getState().clearToken();
        try { localStorage.removeItem('lojista-currentOperator'); } catch {}
        const userWithLogo = {
          ...res.data.user,
          logoUrl: res.data.user.logoUrl ?? tenant.logoUrl ?? null,
        };
        useAuthStore.getState().login(res.data.access_token, userWithLogo);
        toast.success(`Acesso iniciado em "${tenant.name || tenant.nomeFantasia}" como ${res.data.user.name}`);
        if (res.data.user.role === 'operator') {
          navigate('/');
        } else if (res.data.user.role === 'stockist') {
          navigate('/estoque');
        } else {
          navigate('/inicio');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao acessar loja.');
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: 'active' | 'suspended') => {
    if (!selectedTenantIds.length) return;
    const label = newStatus === 'active' ? 'ATIVAR' : 'SUSPENDER';
    if (!window.confirm(`Deseja realmente ${label} ${selectedTenantIds.length} loja(s) selecionada(s)?`)) return;
    setBulkStatusLoading(true);
    try {
      const pin = pinDigits.join('');
      for (const id of selectedTenantIds) {
        await api.patch(`/tenants/setup/${id}`, { status: newStatus }, { headers: { 'x-setup-pin': pin } });
      }
      toast.success(`${selectedTenantIds.length} loja(s) atualizada(s) para ${newStatus === 'active' ? 'Ativo' : 'Suspenso'}.`);
      setSelectedTenantIds([]);
      loadTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar status em lote.');
    } finally {
      setBulkStatusLoading(false);
    }
  };

  const handleLockSession = () => {
    try {
      sessionStorage.removeItem('lojista-sysinit-pin');
      sessionStorage.removeItem('7bar_sysinit_pin');
      sessionStorage.removeItem('lojista-sysinit-user');
    } catch {}
    setPinDigits([]);
    setStep('pin');
    toast.info('Sessão administrativa bloqueada.');
  };

  const loadTenants = async () => {
    setLoadingTenants(true);
    void refreshTelemetryCount();
    try {
      const pin = pinDigits.join('');
      const res = await api.get('/tenants/setup/list', { headers: { 'x-setup-pin': pin } });
      setTenants(res.data);
    } catch (err) {
      toast.error('Erro ao carregar tenants.');
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const pin = pinDigits.join('');
      const res = await api.get('/groups/setup/list', { headers: { 'x-setup-pin': pin } });
      setGroups(res.data);
    } catch (err) {
      toast.error('Erro ao carregar grupos.');
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadGroupUsers = async (groupId: string) => {
    setLoadingGroupUsers(true);
    try {
      const pin = pinDigits.join('');
      const res = await api.get(`/groups/setup/${groupId}/users`, { headers: { 'x-setup-pin': pin } });
      setGroupUsers(res.data);
    } catch (err) {
      toast.error('Erro ao carregar usuários do grupo.');
    } finally {
      setLoadingGroupUsers(false);
    }
  };

  // Auto-restaurar sessão do PIN se já autenticado na aba atual
  useEffect(() => {
    try {
      const savedPin = sessionStorage.getItem('lojista-sysinit-pin') || sessionStorage.getItem('7bar_sysinit_pin');
      if (savedPin && step === 'pin') {
        api.post('/tenants/setup/validate-pin', { pin: savedPin })
          .then(() => {
            setPinDigits(savedPin.split(""));
            setStep("list");
          })
          .catch(() => {
            sessionStorage.removeItem('lojista-sysinit-pin');
            sessionStorage.removeItem('7bar_sysinit_pin');
          });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "list") {
      if (activeTab === "tenants" || activeTab === "leadger") loadTenants();
      else if (activeTab === "groups") loadGroups();
      const pin = pinDigits.join('');
      if (pin) {
        api.get('/tenants/setup/leads', { headers: { 'x-setup-pin': pin } })
          .then(res => {
            if (Array.isArray(res.data)) setLeadsCount(res.data.length);
          })
          .catch(() => {});
      }
    }
  }, [step, activeTab]);

  useEffect(() => {
    if (!dbNameManual && tenantName) {
      setDbName(slugify(tenantName));
    }
  }, [tenantName, dbNameManual]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const pin = pinDigits.join('');
      await api.post('/groups/setup/create', { name: newGroupName }, { headers: { 'x-setup-pin': pin } });
      toast.success('Grupo criado com sucesso!');
      setIsCreateGroupOpen(false);
      setNewGroupName("");
      loadGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar grupo.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddGroupMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberTenantId) return;
    setAddingMember(true);
    try {
      const pin = pinDigits.join('');
      await api.post(`/groups/setup/${selectedGroup.id}/members`, {
        tenantId: newMemberTenantId,
        alias: newMemberAlias
      }, { headers: { 'x-setup-pin': pin } });
      toast.success('Membro adicionado com sucesso!');
      setNewMemberTenantId("");
      setNewMemberAlias("");
      loadGroups();
      const updatedGroup = groups.find(g => g.id === selectedGroup.id);
      if (updatedGroup) setSelectedGroup(updatedGroup);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar membro.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleAddGroupUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setAddingUser(true);
    try {
      const pin = pinDigits.join('');
      await api.post(`/groups/setup/${selectedGroup.id}/users`, {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword
      }, { headers: { 'x-setup-pin': pin } });
      toast.success('Usuário adicionado com sucesso!');
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      loadGroupUsers(selectedGroup.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar usuário.');
    } finally {
      setAddingUser(false);
    }
  };

  const setPinValue = (val: string) => {
    setPinDigits(val.split(""));
    if (pinError) setpinError("");
  };

  const triggerShake = () => { setPinShake(true); setTimeout(() => setPinShake(false), 600); };

  const handleValidatePin = async (profile?: SysInitProfile) => {
    if (profile) {
      setSysInitUser(profile);
    }
    const pin = pinDigits.join("").trim();
    if (pin.length < 4) { setpinError("Digite a senha completa."); triggerShake(); return; }
    setPinLoading(true); setpinError("");
    try {
      await api.post("/tenants/setup/validate-pin", { pin });
      try { sessionStorage.setItem('lojista-sysinit-pin', pin); } catch {}
      setStep("list");
    } catch (err: any) {
      const status = err?.response?.status;
      if (!status || status >= 500) {
        setpinError(`Servidor temporariamente indisponível (${status ? `HTTP ${status}` : 'sem conexão'}). Aguarde alguns instantes e tente novamente.`);
        triggerShake();
      } else {
        setpinError("Credenciais inválidas. Acesso negado.");
        triggerShake();
        setPinDigits([]);
      }
    } finally {
      setPinLoading(false);
    }
  };

  const uploadTenantLogo = async (tenantId: string, file: File, pin: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await api.post(`/tenants/setup/${tenantId}/logo`, formData, {
        headers: { "x-setup-pin": pin },
      });
      return res.data?.logoUrl || null;
    } catch (err: any) {
      if (err?.response?.data?.mode === "demo-local") {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Falha ao ler imagem"));
          reader.readAsDataURL(file);
        });
        await api.patch(
          `/tenants/setup/${tenantId}`,
          { logoUrl: dataUrl },
          { headers: { "x-setup-pin": pin } }
        );
        return dataUrl;
      }
      throw err;
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError("");
    if (adminPassword !== adminPasswordConfirm) { setFormError("As senhas não coincidem."); return; }
    if (adminPassword.length < 6) { setFormError("A senha deve ter pelo menos 6 caracteres."); return; }
    setFormLoading(true);
    try {
      const pin = pinDigits.join("");
      const normalizedCreateModulos = normalizeTenantModules(createModulos);
      const { data } = await api.post("/tenants/setup", {
        pin, tenantName, dbName, adminName, adminEmail, adminPassword, seedProducts,
        cnpj: newCnpj || undefined,
        telefone: newTelefone || undefined,
        telefoneContato: newTelefone || undefined,
        syncWithLeadger: newSyncLeadger,
        syncLeadger: newSyncLeadger,
        modulos: normalizedCreateModulos,
        mensalidadeValor: Number(mensalidadeValor) || BASE_PLAN_PRICE,
        mensalidadeVencimento: mensalidadeVencimento ? parseDateLocal(mensalidadeVencimento).toISOString() : null,
      });

      if (createLogoFile && data?.tenant?.id) {
        try {
          const uploadedLogoUrl = await uploadTenantLogo(data.tenant.id, createLogoFile, pin);
          if (uploadedLogoUrl) {
            data.tenant.logoUrl = uploadedLogoUrl;
          }
        } catch {
          toast.error("Loja criada, mas não foi possível salvar a foto. Você pode enviá-la ao editar o tenant.");
        }
      }

      setCreateLogoFile(null);
      setSuccessData({
        ...data,
        plainPassword: adminPassword,
      });
      setStep("success");
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Erro ao provisionar. Tente novamente.");
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = async (tenant: any, initialTab: "identidade" | "modulos" | "fiscal" | "financeiro" | "usuarios" | "xray" = "identidade") => {
    setEditingTenant(tenant); setLogoFile(null);
    const parsedModulos = normalizeTenantModules(tenant.modulos);
    setModulos(parsedModulos);
    setEditTab(initialTab);
    setPaymentHistory([]);
    setTenantInvoices([]);
    setPaymentObservacao("");
    setStep("edit");
    if (initialTab === 'usuarios') {
      setLoadingUsers(true);
      try {
        const pin = pinDigits.join('');
        const res = await api.get(`/tenants/setup/${tenant.id}/users`, { headers: { 'x-setup-pin': pin } });
        setTenantUsers(res.data || []);
      } catch { toast.error("Erro ao carregar usuários"); }
      finally { setLoadingUsers(false); }
    } else if (initialTab === 'financeiro') {
      loadInvoicesAndHistory(tenant.id);
    }
  };

  const handleSaveEdit = async () => {
    setEditLoading(true);
    try {
      const pin = pinDigits.join('');
      let uploadedLogoUrl: string | null = null;
      if (logoFile) {
        uploadedLogoUrl = await uploadTenantLogo(editingTenant.id, logoFile, pin);
      }
      await api.patch(`/tenants/setup/${editingTenant.id}`, {
        nomeFantasia: editingTenant.nomeFantasia,
        razaoSocial: editingTenant.razaoSocial,
        cnpj: editingTenant.cnpj,
        status: editingTenant.status,
        nfceAmbiente: editingTenant.nfceAmbiente,
        modulos,
        mensalidadeValor: Number(editingTenant.mensalidadeValor) || 0,
        mensalidadeVencimento: editingTenant.mensalidadeVencimento || null,
        telefoneContato: editingTenant.telefoneContato || null,
        emailContato: editingTenant.emailContato || null,
        observacoes: editingTenant.observacoes || null,
        clientExternalId: editingTenant.clientExternalId || null,
        baseExternalId: editingTenant.baseExternalId || null,
        leadgerSyncEnabled: Boolean(editingTenant.leadgerSyncEnabled),
      }, { headers: { 'x-setup-pin': pin } });
      if (uploadedLogoUrl && useAuthStore.getState().user?.tenant === editingTenant.id) {
        useAuthStore.getState().setTenantLogo(uploadedLogoUrl);
      }
      toast.success("Tenant atualizado com sucesso!");
      setLogoFile(null); setStep("list"); loadTenants();
    } catch (err: any) {
      console.error(err.response?.data || err);
      toast.error(err.response?.data?.message || "Erro ao salvar alterações.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteTenant = async (tenant: any) => {
    const confirmName = window.prompt(
      `ATENÇÃO: Isso excluirá PERMANENTEMENTE o banco de dados "${tenant.databaseName}" e todos os registros da empresa "${tenant.name || tenant.nomeFantasia}".\n\nEsta operação NÃO PODE SER DESFEITA.\n\nPara confirmar, digite o nome do banco de dados (${tenant.databaseName}):`
    );
    if (confirmName !== tenant.databaseName) {
      if (confirmName !== null) toast.error("Confirmação incorreta. A exclusão foi cancelada.");
      return;
    }
    try {
      const pin = pinDigits.join('');
      await api.delete(`/tenants/setup/${tenant.id}`, { headers: { 'x-setup-pin': pin } });
      toast.success("Tenant e banco de dados excluídos com sucesso!");
      loadTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao excluir tenant.");
    }
  };

  const handleRegistrarPagamento = async (tenantId: string, observacao?: string) => {
    setRegisteringPayment(true);
    try {
      const pin = pinDigits.join('');
      await api.post(`/tenants/setup/${tenantId}/registrar-pagamento`, { observacao, action: 'pay', paymentMethod: 'pix' }, { headers: { 'x-setup-pin': pin } });
      toast.success("Pagamento registrado! Vencimento avançado 1 mês.");
      loadTenants();
      if (editingTenant?.id === tenantId) {
        loadInvoicesAndHistory(tenantId);
      }
      setPaymentObservacao("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao registrar pagamento.");
    } finally {
      setRegisteringPayment(false);
    }
  };

  const handleMigrateBancos = async () => {
    setMigrationModalOpen(true); setMigrating(true);

    // Montar lista de resultados iniciais (Heart primeiro, depois tenants)
    const initialResults: any[] = [];
    if (includeHeart) {
      initialResults.push({
        tenantId: '__heart__',
        name: ' Banco Heart (master)',
        databaseName: 'heart',
        status: 'processing',
        output: ''
      });
    }
    selectedTenantIds.forEach(id => {
      const tenant = tenants.find(t => t.id === id);
      initialResults.push({ tenantId: id, name: tenant?.name || tenant?.nomeFantasia || 'Tenant', databaseName: tenant?.databaseName || '', status: 'processing', output: '' });
    });
    setMigrationResults(initialResults);

    try {
      const pin = pinDigits.join('');
      const res = await api.post('/tenants/setup/migrate', { tenantIds: selectedTenantIds, includeHeart }, { headers: { 'x-setup-pin': pin } });
      setMigrationResults(res.data);
      toast.success('Migração de bancos concluída!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao executar migração.';
      toast.error(msg);
      setMigrationResults(prev => prev.map(item => item.status === 'processing' ? { ...item, status: 'error', output: msg } : item));
    } finally {
      setMigrating(false); setSelectedTenantIds([]); loadTenants();
    }
  };

  // ── SQL EDITOR HANDLER ────────────────────────────────────────────────
  const handleSqlUnlock = async () => {
    const trimmedPin = sqlPinInput.trim();
    if (!trimmedPin) {
      setSqlPinError('Informe o PIN do SQL Editor.');
      return;
    }
    try {
      const pin = pinDigits.join('');
      const res = await api.post(
        '/tenants/setup/sql',
        {
          sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
          tenantId: sqlSelectedDb.tenantId,
          useHeart: sqlSelectedDb.useHeart,
        },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': trimmedPin } }
      );
      setSqlPinUnlocked(true);
      setSqlPinError('');
      if (res.data?.type === 'query' && Array.isArray(res.data?.rows)) {
        setSqlTables(res.data.rows.map((row: any[]) => String(row[0])).filter(Boolean));
      }
    } catch {
      setSqlPinError('PIN incorreto.');
      setSqlPinInput('');
    }
  };

  const loadTablesForDb = async (targetDb?: { tenantId?: string; useHeart?: boolean; label: string }) => {
    const db = targetDb || sqlSelectedDb;
    setSqlLoadingTables(true);
    try {
      const pin = pinDigits.join('');
      const res = await api.post(
        '/tenants/setup/sql',
        {
          sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
          tenantId: db.tenantId,
          useHeart: db.useHeart,
        },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      if (res.data?.type === 'query' && Array.isArray(res.data?.rows)) {
        const tableList = res.data.rows.map((row: any[]) => String(row[0])).filter(Boolean);
        setSqlTables(tableList);
      } else {
        setSqlTables([]);
      }
    } catch {
      setSqlTables([]);
    } finally {
      setSqlLoadingTables(false);
    }
  };

  const handleExecuteSql = async (sqlOverride?: string, targetDb?: { tenantId?: string; useHeart?: boolean; label: string }) => {
    const queryToRun = (sqlOverride ?? sqlQuery).trim();
    if (!queryToRun) return;
    if (sqlOverride) setSqlQuery(sqlOverride);
    const db = targetDb || sqlSelectedDb;
    setSqlLoading(true);
    setSqlError('');
    setSqlResult(null);
    try {
      const pin = pinDigits.join('');
      const res = await api.post(
        '/tenants/setup/sql',
        { sql: queryToRun, tenantId: db.tenantId, useHeart: db.useHeart },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      setSqlResult(res.data);
      // salvar no histórico
      setSqlHistory(prev => {
        const updated = [queryToRun, ...prev.filter(q => q !== queryToRun)].slice(0, 20);
        localStorage.setItem('lojista-sql-history', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setSqlError(err.response?.data?.message || 'Erro ao executar query.');
    } finally {
      setSqlLoading(false);
    }
  };

  const handleCloseCashRegister = async (cashRegisterId: string) => {
    if (!confirm(`Deseja realmente FECHAR o caixa ${cashRegisterId.slice(0, 8)}...?`)) return;
    setUpdatingRowId(cashRegisterId);
    try {
      const q = `UPDATE "cash_registers" SET status = 'closed', "closingTime" = NOW(), "closingValue" = COALESCE("closingValue", "openingValue", 0) WHERE id = '${cashRegisterId}'`;
      const pin = pinDigits.join('');
      await api.post(
        '/tenants/setup/sql',
        { sql: q, tenantId: sqlSelectedDb.tenantId, useHeart: sqlSelectedDb.useHeart },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      toast.success(`Caixa ${cashRegisterId.slice(0, 8)} fechado com sucesso!`);
      await handleExecuteSql(sqlQuery);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fechar caixa.');
    } finally {
      setUpdatingRowId(null);
    }
  };

  const handleCancelSale = async (saleId: string) => {
    if (!confirm(`Deseja realmente CANCELAR a venda ${saleId.slice(0, 8)}...?`)) return;
    setUpdatingRowId(saleId);
    try {
      const q = `UPDATE "sales" SET status = 'cancelled', "cancelledAt" = NOW(), "cancelReason" = 'Cancelamento administrativo' WHERE id = '${saleId}'`;
      const pin = pinDigits.join('');
      await api.post(
        '/tenants/setup/sql',
        { sql: q, tenantId: sqlSelectedDb.tenantId, useHeart: sqlSelectedDb.useHeart },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      toast.success(`Venda ${saleId.slice(0, 8)} cancelada com sucesso!`);
      await handleExecuteSql(sqlQuery);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar venda.');
    } finally {
      setUpdatingRowId(null);
    }
  };

  const handleDeleteRow = async (tableName: string, rowId: string) => {
    if (!confirm(`ATENÇÃO: Deseja realmente EXCLUIR o registro "${rowId}" da tabela "${tableName}"?`)) return;
    setUpdatingRowId(rowId);
    try {
      const q = `DELETE FROM "${tableName}" WHERE id = '${rowId}'`;
      const pin = pinDigits.join('');
      await api.post(
        '/tenants/setup/sql',
        { sql: q, tenantId: sqlSelectedDb.tenantId, useHeart: sqlSelectedDb.useHeart },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      toast.success(`Registro excluído com sucesso!`);
      await handleExecuteSql(sqlQuery);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir registro.');
    } finally {
      setUpdatingRowId(null);
    }
  };

  const handleSaveInlineEdit = async (tableName: string) => {
    if (!editingCell) return;
    try {
      const val = editingCell.value;
      const sqlVal = val === '' || val.toUpperCase() === 'NULL' ? 'NULL' : `'${val.replace(/'/g, "''")}'`;
      const q = `UPDATE "${tableName}" SET "${editingCell.column}" = ${sqlVal} WHERE id = '${editingCell.id}'`;
      const pin = pinDigits.join('');
      await api.post(
        '/tenants/setup/sql',
        { sql: q, tenantId: sqlSelectedDb.tenantId, useHeart: sqlSelectedDb.useHeart },
        { headers: { 'x-setup-pin': pin, 'x-sql-pin': sqlPinInput.trim() || pin } }
      );
      toast.success(`Campo "${editingCell.column}" atualizado com sucesso!`);
      setEditingCell(null);
      await handleExecuteSql(sqlQuery);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar alteração.');
    }
  };

  const handleCopyValue = (val: any) => {
    if (val === null || val === undefined) return;
    navigator.clipboard.writeText(String(val));
    toast.success('Copiado para a área de transferência!');
  };

  const isCertExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const expDate = new Date(date);
    const diff = expDate.getTime() - new Date().getTime();
    return diff < 30 * 24 * 60 * 60 * 1000 && diff > 0;
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.cnpj?.includes(searchTerm) ||
      t.databaseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.telefoneContato?.includes(searchTerm) ||
      t.emailContato?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const venc = t.mensalidadeVencimento ? new Date(t.mensalidadeVencimento) : null;
    if (venc) venc.setHours(0, 0, 0, 0);
    const diffDays = venc ? Math.round((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (statusFilter === 'active') return t.status === 'active';
    if (statusFilter === 'suspended') return t.status === 'suspended' || t.status === 'inactive' || t.status === 'paused';
    if (statusFilter === 'overdue') return t.status === 'active' && diffDays !== null && diffDays < 0;
    if (statusFilter === 'due_soon') return t.status === 'active' && diffDays !== null && diffDays >= 0 && diffDays <= 5;
    if (statusFilter === 'no_date') return !t.mensalidadeVencimento;
    return true;
  });


  const toggleTenant = (id: string, checked: boolean) => setSelectedTenantIds(ids => checked ? [...new Set([...ids, id])] : ids.filter(value => value !== id));
  const allFilteredSelected = filteredTenants.length > 0 && filteredTenants.every(t => selectedTenantIds.includes(t.id));
  const allTenantsSelected = tenants.length > 0 && tenants.every(t => selectedTenantIds.includes(t.id));
  const toggleSelectAllTenants = () => setSelectedTenantIds(allTenantsSelected ? [] : tenants.map(t => t.id));
  const toggleFilteredTenants = () => setSelectedTenantIds(ids => allFilteredSelected
    ? ids.filter(id => !filteredTenants.some(t => t.id === id))
    : [...new Set([...ids, ...filteredTenants.map(t => t.id)])]);

  const faturamentoEstimado = tenants
    .filter(t => t.status === 'active')
    .reduce((acc, t) => acc + (Number(t.mensalidadeValor) || 0), 0);

  const mensalidadesAtrasadas = tenants.filter(t => {
    if (!t.mensalidadeVencimento || t.status !== 'active') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const venc = new Date(t.mensalidadeVencimento);
    return venc < today;
  }).length;

  const getVencimentoStatus = (vencimento: string | null) => {
    if (!vencimento) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const venc = new Date(vencimento);
    venc.setHours(0, 0, 0, 0);
    const diffDays = Math.round((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { color: "text-brand bg-support border-brand animate-pulse", text: `Atrasado desde ${venc.toLocaleDateString("pt-BR")}` };
    if (diffDays === 0) return { color: "text-brand bg-support border-brand", text: "Vence hoje!" };
    if (diffDays <= 5) return { color: "text-brand bg-support border-brand", text: `Vence em ${diffDays} dias` };
    return { color: "text-brand bg-support border-brand", text: venc.toLocaleDateString("pt-BR") };
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col p-4 sm:p-8">
      {imageOptimizationOpen && <Suspense fallback={<div className="fixed inset-0 z-[100] bg-page p-8">Carregando manutenção de imagens…</div>}><ImageOptimizationPanel
        tenants={tenants.filter(t => selectedTenantIds.includes(t.id))}
        pin={pinDigits.join('')}
        onClose={() => setImageOptimizationOpen(false)}
      /></Suspense>}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand rounded-full blur-[140px] opacity-20 text-on-brand" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand rounded-full blur-[160px] opacity-15 text-on-brand" />
      </div>

      <div className="relative z-10 w-full min-w-0 flex-1 flex flex-col">
        {/* — PIN STEP (Login Teltech Ledger) — */}
        {step === "pin" && (
          <SysInitLogin
            password={pinDigits.join("")}
            onPasswordChange={setPinValue}
            onSubmit={handleValidatePin}
            loading={pinLoading}
            error={pinError}
            shake={pinShake}
          />
        )}

        {/* — LIST STEP — */}
        {step === "list" && (
          <div className="animate-[fadeIn_0.3s_ease] flex flex-col flex-1">
            <div className="flex flex-wrap justify-between items-center gap-5 mb-6 mt-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {activeTab === 'tenants'
                    ? 'Painel Central Multi-Tenant'
                    : activeTab === 'leads'
                    ? 'Leads da Loja Demonstração'
                    : activeTab === 'groups'
                    ? 'Gestão de Grupos'
                    : activeTab === 'sql'
                    ? 'SQL Editor'
                    : 'Integração Teltech Leadger'}
                </h1>
                <p className="text-muted mt-1 text-sm">
                  {activeTab === 'tenants'
                    ? 'Lojas isoladas por banco PostgreSQL, acesso 1-clique, faturas mensais e monitoramento operacional.'
                    : activeTab === 'leads'
                    ? 'Visitantes que acessaram a Loja Demonstração informando nome e WhatsApp, sem duplicidade de cadastro.'
                    : activeTab === 'groups'
                    ? 'Gerencie os grupos de lojas e redes corporativas.'
                    : activeTab === 'sql'
                    ? 'Execute consultas, audite registros e realize alterações diretamente nos bancos de dados.'
                    : 'Sincronize bases, clientes e faturas com a plataforma financeira Teltech Leadger (Webhook v1).'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {sysInitUser && (
                  <div className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-on-brand">
                      {sysInitUser.initials}
                    </span>
                    <span className="font-bold text-ink">{sysInitUser.name}</span>
                  </div>
                )}
                <button
                  onClick={handleLockSession}
                  className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 text-xs font-bold text-muted hover:bg-support hover:text-brand transition"
                  title="Bloquear Sessão Administrativa"
                >
                  <Lock size={15} /> Bloquear Sessão
                </button>
                {activeTab === 'tenants' && (
                  <>
                    <button
                      onClick={loadTenants}
                      disabled={loadingTenants}
                      className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 text-xs font-bold text-ink hover:bg-support transition"
                    >
                      <RefreshCw size={15} className={loadingTenants ? "animate-spin" : ""} /> Atualizar
                    </button>
                    <button onClick={() => setStep("create")} className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-bold text-on-brand transition hover:bg-brand-hover hover:text-on-brand">
                      <Plus size={18} /> Novo cliente
                    </button>
                  </>
                )}
                {activeTab === 'groups' && (
                  <button onClick={() => setIsCreateGroupOpen(true)} className="bg-brand hover:bg-brand-hover text-on-brand px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-line hover:text-on-brand">
                    <Users size={18} /> Novo Grupo
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'tenants' && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-page/50 p-3" aria-label="Ações administrativas">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleMigrateBancos} disabled={!includeHeart && !selectedTenantIds.length} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-brand bg-support px-3 text-sm font-semibold text-brand hover:bg-support disabled:opacity-40"><Database size={16} /> Atualizar Bancos {(includeHeart ? 1 : 0) + selectedTenantIds.length || ''}</button>
                <label className="flex h-10 items-center gap-2 px-2 text-sm text-muted cursor-pointer select-none"><input type="checkbox" checked={includeHeart} onChange={e => setIncludeHeart(e.target.checked)} className="accent-brand w-4 h-4 rounded" /> Incluir Heart</label>
                <button type="button" onClick={toggleSelectAllTenants} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface/80 px-3 text-sm font-semibold text-muted hover:bg-support hover:text-ink transition">
                  <CheckCircle2 size={16} className={allTenantsSelected ? "text-brand" : "text-muted"} />
                  {allTenantsSelected ? 'Desmarcar todos os bancos' : `Selecionar todos os bancos (${tenants.length})`}
                </button>
                {selectedTenantIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={bulkStatusLoading}
                      onClick={() => handleBulkStatusChange('active')}
                      className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-brand bg-support px-3 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand transition"
                    >
                      <CheckCircle2 size={14} /> Ativar ({selectedTenantIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={bulkStatusLoading}
                      onClick={() => handleBulkStatusChange('suspended')}
                      className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted hover:bg-support hover:text-brand transition"
                    >
                      <Ban size={14} /> Suspender ({selectedTenantIds.length})
                    </button>
                  </>
                )}
                <span className="px-2 text-xs text-muted">{selectedTenantIds.length} de {tenants.length} cliente(s) selecionado(s)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <button disabled={!selectedTenantIds.length} onClick={() => setImageOptimizationOpen(true)} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 text-sm text-muted hover:bg-surface disabled:opacity-40"><ImageIcon size={16} /> Otimizar imagens</button>
                <button onClick={() => { setStep('backups'); loadBackups(); }} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 text-sm text-muted hover:bg-surface"><Database size={16} /> Gerenciar Backups</button>
                <button onClick={handleExportTelemetry} className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 text-sm text-muted hover:bg-surface"><Activity size={16} /> Exportar telemetria ({telemetryCount})</button>
                {telemetryCount > 0 && <button onClick={handleClearTelemetry} title="Limpar telemetria local" className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-support hover:text-brand"><Trash2 size={16} /> Limpar telemetria</button>}
              </div>
            </div>}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 border-b border-line">
              <button onClick={() => setActiveTab('tenants')} className={`py-2.5 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tenants' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                <Building2 size={15} /> Tenants ({tenants.length})
              </button>
              <button onClick={() => setActiveTab('leads')} className={`py-2.5 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'leads' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                <UserPlus size={15} /> Leads ({leadsCount})
              </button>
              <button onClick={() => setActiveTab('groups')} className={`py-2.5 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'groups' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                <Users size={15} /> Grupos
              </button>
              <button onClick={() => setActiveTab('leadger')} className={`py-2.5 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'leadger' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                <Send size={15} /> Leadger (Financeiro)
              </button>
              <button onClick={() => setActiveTab('sql')} className={`py-2.5 px-4 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'sql' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
                <Terminal size={15} /> SQL
              </button>
            </div>

            {/* ── TENANTS TAB ── */}
            {activeTab === 'tenants' ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
                    <div className="p-3 bg-support text-brand rounded-xl"><Building2 size={24} /></div>
                    <div>
                      <p className="text-muted text-sm">Total de Clientes</p>
                      <p className="text-2xl font-bold">{tenants.length} <span className="text-xs font-normal text-muted">({tenants.filter(t => t.status === 'active').length} ativos)</span></p>
                    </div>
                  </div>
                  <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
                    <div className="p-3 bg-support text-brand rounded-xl"><DollarSign size={24} /></div>
                    <div>
                      <p className="text-muted text-sm">MRR Ativo Estimado</p>
                      <p className="text-2xl font-bold">R$ {faturamentoEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
                    <div className="p-3 bg-support text-brand rounded-xl"><AlertTriangle size={24} /></div>
                    <div><p className="text-muted text-sm">Mensalidades Atrasadas</p><p className="text-2xl font-bold text-brand">{mensalidadesAtrasadas}</p></div>
                  </div>
                  <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
                    <div className="p-3 bg-support text-brand rounded-xl"><AlertTriangle size={24} /></div>
                    <div><p className="text-muted text-sm">Certificados a Vencer</p><p className="text-2xl font-bold">{tenants.filter(t => isCertExpiringSoon(t.certValidade)).length}</p></div>
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-page/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                      <input type="text" placeholder="Buscar por nome, CNPJ, banco, telefone, e-mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-page border border-line rounded-xl py-2 pl-10 pr-4 text-sm text-ink focus:outline-none focus:border-brand" />
                    </div>
                    <span className="text-sm text-muted">{filteredTenants.length} cliente(s){selectedTenantIds.length > 0 ? ` · ${selectedTenantIds.length} selecionado(s)` : ''} </span>
                    <button type="button" onClick={searchTerm || statusFilter !== 'all' ? toggleFilteredTenants : toggleSelectAllTenants} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-muted hover:bg-surface transition flex items-center gap-1.5">
                      <CheckCircle2 size={14} className={((searchTerm || statusFilter !== 'all') ? allFilteredSelected : allTenantsSelected) ? "text-brand" : "text-muted"} />
                      {(searchTerm || statusFilter !== 'all')
                        ? (allFilteredSelected ? 'Desmarcar filtrados' : `Selecionar filtrados (${filteredTenants.length})`)
                        : (allTenantsSelected ? 'Desmarcar todos' : `Selecionar todos (${tenants.length})`)}
                    </button>
                    <div className="flex rounded-xl border border-line bg-page p-1 sm:ml-auto">
                      <button type="button" onClick={() => setTenantView('cards')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${tenantView === 'cards' ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'}`}><LayoutGrid size={15} /> Clientes</button>
                      <button type="button" onClick={() => setTenantView('calendar')} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${tenantView === 'calendar' ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'}`}><CalendarDays size={15} /> Calendário</button>
                    </div>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line">
                    {[
                      { id: 'all', label: `Todos (${tenants.length})` },
                      { id: 'active', label: `Ativos (${tenants.filter(t => t.status === 'active').length})` },
                      { id: 'overdue', label: `Atrasados (${mensalidadesAtrasadas})` },
                      { id: 'due_soon', label: 'Vence em 5 dias' },
                      { id: 'suspended', label: `Suspensos/Inativos (${tenants.filter(t => t.status !== 'active').length})` },
                      { id: 'no_date', label: 'Sem vencimento' },
                    ].map(chip => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setStatusFilter(chip.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          statusFilter === chip.id
                            ? 'bg-brand text-on-brand border-brand'
                            : 'bg-page text-muted border-line hover:bg-surface hover:text-ink'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tenantView === 'calendar' ? (
                  loadingTenants ? (
                    <div className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-page/60 p-12 text-muted"><Loader2 className="mr-2 animate-spin" /> Carregando clientes...</div>
                  ) : (
                    <TenantBillingCalendar
                      tenants={filteredTenants}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      selectedIds={selectedTenantIds}
                      onToggleTenant={toggleTenant}
                      onEdit={openEdit}
                      onRegisterPayment={handleRegistrarPagamento}
                      onImpersonate={t => handleImpersonate(t)}
                    />
                  )
                ) : (
                <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
                  {loadingTenants ? <p className="p-8 text-muted">Carregando clientes…</p> : !filteredTenants.length ? <p className="p-8 text-muted">Nenhum cliente encontrado.</p> : filteredTenants.map(t => {
                    const selected = selectedTenantIds.includes(t.id);
                    const venc = getVencimentoStatus(t.mensalidadeVencimento);
                    const admin = t.users?.find((u: any) => u.role === 'admin' || u.role === 'superadmin');
                    const cleanPhone = (t.telefoneContato || '').replace(/\D/g, '');
                    return (
                      <article key={t.id} className={`flex min-w-0 flex-col rounded-2xl border p-5 transition ${selected ? 'border-brand bg-support' : 'border-line bg-page/60 hover:border-brand'}`}>
                        <div className="mb-4 flex items-start gap-3">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface text-lg font-bold text-brand">
                            {(t.name || t.nomeFantasia || '?').charAt(0).toUpperCase()}
                            {t.logoUrl && <img src={getFullUrl(t.logoUrl)} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button onClick={() => openEdit(t)} className="text-left font-bold leading-snug text-ink hover:text-brand">
                              {t.name || t.nomeFantasia}
                            </button>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="break-all font-mono text-xs text-muted">{t.databaseName}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyValue(t.databaseName)}
                                className="text-muted hover:text-brand p-0.5 rounded"
                                title="Copiar nome do banco"
                              >
                                <Copy size={11} />
                              </button>
                              {t.leadgerSyncEnabled && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-support text-brand border border-brand">Leadger ON</span>
                              )}
                            </div>
                          </div>
                          <input type="checkbox" aria-label={`Selecionar ${t.name || t.nomeFantasia}`} checked={selected} onChange={e => toggleTenant(t.id, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand" />
                        </div>

                        <div className="mb-3 flex items-end justify-between gap-3 rounded-xl bg-surface p-3 border border-line">
                          <div>
                            <p className="mb-0.5 text-[11px] text-muted uppercase font-bold">Mensalidade</p>
                            <p className="text-xl font-black text-ink tabular-nums">
                              {Number(t.mensalidadeValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${t.status === 'active' ? 'bg-support text-brand border-brand' : 'bg-page text-muted border-line'}`}>
                            {t.status === 'active' ? 'Ativo' : t.status === 'paused' ? 'Pausado' : t.status === 'suspended' ? 'Suspenso' : 'Inativo'}
                          </span>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-xs text-muted">
                            <CalendarDays size={14} className="text-brand" />
                            {t.mensalidadeVencimento ? new Date(t.mensalidadeVencimento).toLocaleDateString('pt-BR') : 'Sem vencimento'}
                          </p>
                          {venc && <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${venc.color.replace('animate-pulse', '')}`}>{venc.text}</span>}
                        </div>

                        <div className="mb-3 space-y-1 text-xs text-muted bg-page/50 p-2.5 rounded-xl border border-line">
                          {t.cnpj && <p className="font-mono">CNPJ: {t.cnpj}</p>}
                          {t.telefoneContato && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{t.telefoneContato}</span>
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/55${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline shrink-0"
                                >
                                  <MessageCircle size={12} /> WhatsApp
                                </a>
                              )}
                            </div>
                          )}
                          {(t.emailContato || admin?.email) && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">Login: {admin?.email || t.emailContato}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyValue(admin?.email || t.emailContato)}
                                className="text-muted hover:text-brand p-0.5"
                                title="Copiar e-mail de login"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mb-4"><ModuleBadges modulosRaw={t.modulos} /></div>

                        {/* Ações Rápidas Superiores: Entrar 1-Clique + Quitar */}
                        <div className="grid grid-cols-2 gap-2 mb-2.5">
                          <button
                            onClick={() => handleImpersonate(t)}
                            disabled={impersonatingId === t.id}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 px-3 text-xs font-bold text-on-brand hover:bg-brand-hover transition disabled:opacity-50"
                            title="Entrar diretamente no painel desta loja como Administrador"
                          >
                            {impersonatingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                            Acessar Painel
                          </button>
                          <button
                            onClick={() => handleRegistrarPagamento(t.id)}
                            disabled={registeringPayment}
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-brand bg-support py-2.5 px-3 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand transition disabled:opacity-40"
                            title="Confirmar pagamento rápido e avançar vencimento em 1 mês"
                          >
                            <DollarSign size={14} /> Quitar (+1 Mês)
                          </button>
                        </div>

                        {/* Barra de Ações Secundárias */}
                        <div className="mt-auto flex items-center justify-between gap-1.5 border-t border-line pt-3">
                          <button
                            onClick={() => openEdit(t, 'xray')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 px-2 text-[11px] font-bold text-ink hover:border-brand hover:text-brand transition"
                            title="Raio-X Operacional do Banco"
                          >
                            <Server size={13} /> Raio-X
                          </button>
                          <button
                            onClick={() => openEdit(t, 'usuarios')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 px-2 text-[11px] font-bold text-ink hover:border-brand hover:text-brand transition"
                            title="Usuários, Senhas e PINs"
                          >
                            <Users size={13} /> Senhas
                          </button>
                          <button
                            onClick={() => openEdit(t, 'financeiro')}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-surface py-1.5 px-2 text-[11px] font-bold text-ink hover:border-brand hover:text-brand transition"
                            title="Faturas Mensais e Histórico"
                          >
                            <CreditCard size={13} /> Faturas
                          </button>
                          <button
                            onClick={() => openEdit(t, 'identidade')}
                            className="rounded-lg border border-line bg-surface p-1.5 text-muted hover:text-ink hover:border-brand transition"
                            title="Configurações Completas"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteTenant(t)}
                            className="rounded-lg border border-line bg-surface p-1.5 text-muted hover:bg-support hover:text-brand transition"
                            title="Excluir Loja e Banco"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                )}
              </>
            ) : activeTab === 'groups' ? (
              <div className="bg-page/60 border border-line rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-page/50 text-muted sticky top-0 z-10 border-b border-line">
                      <tr>
                        <th className="px-6 py-4 font-medium">Nome do Grupo</th>
                        <th className="px-6 py-4 font-medium">Membros</th>
                        <th className="px-6 py-4 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {loadingGroups ? (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-muted"><Loader2 className="animate-spin inline-block mr-2" /> Carregando...</td></tr>
                      ) : groups.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-muted">Nenhum grupo encontrado.</td></tr>
                      ) : (
                        groups.map(g => (
                          <tr key={g.id} className="hover:bg-surface transition">
                            <td className="px-6 py-4 font-semibold text-muted">{g.name}</td>
                            <td className="px-6 py-4 text-muted">{g.members?.length || 0} membros</td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => { setSelectedGroup(g); loadGroupUsers(g.id); }} className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition" title="Gerenciar">
                                <Settings size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'sql' ? (
              /* ── SQL EDITOR TAB ── */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {!sqlPinUnlocked ? (
                  /* PIN GATE */
                  <div className="flex-1 flex items-center justify-center py-20">
                    <div className="bg-page border border-line rounded-3xl p-10 w-full max-w-md text-center shadow-2xl">
                      <div className="w-20 h-20 bg-support border border-brand rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Terminal className="text-brand" size={36} />
                      </div>
                      <h2 className="text-2xl font-black text-muted mb-1">SQL Editor</h2>
                      <p className="text-muted text-sm mb-2">Acesso direto aos bancos de dados do sistema.</p>
                      <p className="text-muted text-xs mb-8">Digite o PIN exclusivo do SQL Editor para continuar.</p>
                      <input
                        type="text"
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        value={sqlPinInput}
                        onChange={e => { setSqlPinInput(e.target.value); setSqlPinError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleSqlUnlock()}
                        placeholder="••••••••"
                        className="pdv-secret-input w-full p-4 bg-page border border-line rounded-2xl text-ink text-center font-mono text-2xl tracking-[0.5em] focus:border-brand outline-none mb-3 placeholder:tracking-normal placeholder:text-2xl"
                        autoFocus
                        maxLength={12}
                      />
                      {sqlPinError && (
                        <div className="flex items-center gap-2 justify-center text-brand text-sm mb-3">
                          <AlertCircle size={14} /> {sqlPinError}
                        </div>
                      )}
                      <button onClick={handleSqlUnlock} className="w-full bg-brand hover:bg-brand text-on-brand font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 hover:text-on-brand">
                        <Terminal size={18} /> Acessar SQL Editor
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SQL EDITOR UI — layout tipo DBeaver */
                  <div className="flex-1 flex gap-0 min-h-0 overflow-hidden rounded-2xl border border-line">

                    {/* ── SIDEBAR: Seletor de Banco + Tabelas + Atalhos ── */}
                    <div className="w-64 shrink-0 bg-page border-r border-line flex flex-col overflow-hidden">
                      {/* Seletor de Banco */}
                      <div className="p-3 border-b border-line">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Conexão do Banco</p>
                        <select
                          value={sqlSelectedDb.useHeart ? '__heart__' : (sqlSelectedDb.tenantId || '__heart__')}
                          onChange={e => {
                            const val = e.target.value;
                            let newDb: { tenantId?: string; useHeart?: boolean; label: string };
                            if (val === '__heart__') {
                              newDb = { useHeart: true, label: ' Heart (master)' };
                              setSqlQuery('SELECT * FROM tenants LIMIT 10');
                            } else {
                              const t = tenants.find(item => item.id === val);
                              newDb = { tenantId: t?.id, useHeart: false, label: ` ${t?.name || t?.nomeFantasia || t?.databaseName} (${t?.databaseName})` };
                              setSqlQuery('SELECT id, status, operatorId, openingTime, closingTime, openingValue, closingValue FROM cash_registers ORDER BY openingTime DESC LIMIT 20');
                            }
                            setSqlSelectedDb(newDb);
                            setSqlResult(null);
                            setSqlError('');
                            loadTablesForDb(newDb);
                          }}
                          className="w-full bg-page border border-line text-ink rounded-xl px-2.5 py-2 text-xs font-mono focus:border-brand outline-none"
                        >
                          <option value="__heart__"> Heart (master)</option>
                          {tenants.map(t => (
                            <option key={t.id} value={t.id}> {t.name || t.nomeFantasia || t.databaseName} ({t.databaseName})</option>
                          ))}
                        </select>
                      </div>

                      {/* Header de Tabelas com botão de refresh */}
                      <div className="px-3 py-2 border-b border-line flex items-center justify-between bg-page">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Database size={12} className="text-brand" />
                          Tabelas {sqlTables.length > 0 && `(${sqlTables.length})`}
                        </span>
                        <button
                          onClick={() => loadTablesForDb(sqlSelectedDb)}
                          disabled={sqlLoadingTables}
                          title="Atualizar lista de tabelas"
                          className="text-xs text-muted hover:text-brand p-1 hover:bg-surface rounded transition"
                        >
                          {sqlLoadingTables ? <Loader2 className="animate-spin" size={13} /> : ''}
                        </button>
                      </div>

                      {/* Lista de tabelas (clicáveis) */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0">
                        {sqlLoadingTables ? (
                          <div className="flex items-center justify-center py-8 text-muted gap-2 text-xs">
                            <Loader2 className="animate-spin" size={14} /> Carregando tabelas...
                          </div>
                        ) : sqlTables.length > 0 ? (
                          <div className="space-y-0.5">
                            {sqlTables.map(tableName => (
                              <button
                                key={tableName}
                                onClick={() => {
                                  const q = `SELECT * FROM ${tableName} LIMIT 50`;
                                  setSqlQuery(q);
                                  handleExecuteSql(q);
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs font-mono text-muted hover:text-ink hover:bg-surface/80 rounded-lg transition flex items-center gap-2 group"
                              >
                                <span className="text-muted group-hover:text-brand text-[10px]">•</span>
                                <span className="truncate">{tableName}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted text-xs">
                            <p>Nenhuma tabela encontrada.</p>
                            <button
                              onClick={() => loadTablesForDb(sqlSelectedDb)}
                              className="mt-2 text-[11px] text-brand underline"
                            >
                              Carregar tabelas
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Atalhos rápidos contextuais */}
                      <div className="p-2.5 border-t border-line max-h-48 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 px-1">Atalhos Úteis</p>
                        <div className="space-y-0.5">
                          {sqlSelectedDb.useHeart ? (
                            <>
                              {[
                                { label: ' Tenants cadastrados', q: 'SELECT id, name, database_name, status, mensalidade_vencimento, mensalidade_valor FROM tenants ORDER BY name' },
                                { label: ' Usuários Master', q: 'SELECT id, email, name, role, "tenantId", "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 30' },
                                { label: '— Integrações Hub', q: 'SELECT * FROM tenant_integrations LIMIT 50' },
                              ].map(item => (
                                <button
                                  key={item.label}
                                  onClick={() => { setSqlQuery(item.q); handleExecuteSql(item.q); }}
                                  className="w-full text-left px-2 py-1.5 text-[11px] text-muted hover:text-brand hover:bg-surface/70 rounded-lg transition truncate block"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </>
                          ) : (
                            <>
                              {[
                                { label: ' Caixas (Todos)', q: 'SELECT id, code, status, "operatorId", "openingTime", "closingTime", "openingValue", "closingValue" FROM cash_registers ORDER BY "openingTime" DESC LIMIT 20' },
                                { label: '“ Caixas Abertos', q: 'SELECT id, code, status, "operatorId", "openingTime", "openingValue" FROM cash_registers WHERE status = \'open\' ORDER BY "openingTime" DESC LIMIT 20' },
                                { label: ' Vendas Recentes', q: 'SELECT id, code, total, status, source, "createdAt" FROM sales ORDER BY "createdAt" DESC LIMIT 30' },
                                { label: ' Produtos do Catálogo', q: 'SELECT id, "shortCode", name, barcode, "priceSell", stock, active FROM products ORDER BY name LIMIT 50' },
                                { label: ' Estoque Baixo/Zerado', q: 'SELECT id, "shortCode", name, stock, "minStock", "priceSell" FROM products WHERE stock <= COALESCE("minStock", 5) ORDER BY stock ASC LIMIT 50' },
                                { label: ' Operadores da Loja', q: 'SELECT id, name, active, "isManager" FROM operators ORDER BY name' },
                                { label: ' Formas de Pagamento', q: 'SELECT id, name, "tPag", active FROM tenant_payment_methods' },
                                { label: ' Fechar Caixa Aberto', q: 'UPDATE cash_registers SET status = \'closed\', "closingTime" = NOW() WHERE id = \'COLOQUE_O_ID_AQUI\'' },
                                { label: '— Cancelar Venda', q: 'UPDATE sales SET status = \'cancelled\', "cancelledAt" = NOW(), "cancelReason" = \'Cancelamento administrativo\' WHERE id = \'COLOQUE_O_ID_AQUI\'' },
                              ].map(item => (
                                <button
                                  key={item.label}
                                  onClick={() => { setSqlQuery(item.q); if (!item.q.includes('COLOQUE_O_ID')) handleExecuteSql(item.q); }}
                                  className="w-full text-left px-2 py-1.5 text-[11px] text-muted hover:text-brand hover:bg-surface/70 rounded-lg transition truncate block"
                                >
                                  {item.label}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── MAIN AREA: Editor + Resultados ── */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-page">

                      {/* Barra superior com banco ativo + executar */}
                      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line bg-page/60 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-brand animate-pulse text-on-brand" />
                          <span className="text-xs font-mono text-muted">Banco: <span className="text-brand font-bold">{sqlSelectedDb.label}</span></span>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                          <span className="text-xs text-muted font-mono hidden sm:block">Ctrl+Enter para executar</span>
                          <button
                            onClick={() => handleExecuteSql()}
                            disabled={sqlLoading}
                            className="bg-brand hover:bg-brand disabled:opacity-50 text-on-brand px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition text-sm shadow-lg shadow-line hover:text-on-brand"
                          >
                            {sqlLoading ? <Loader2 className="animate-spin" size={15} /> : <Terminal size={15} />}
                            Executar
                          </button>
                        </div>
                      </div>

                      {/* Editor SQL */}
                      <div className="relative shrink-0 border-b border-line bg-page">
                        <div className="absolute left-0 top-0 bottom-0 w-10 bg-page border-r border-line flex flex-col items-center pt-3 gap-[21px] select-none pointer-events-none">
                          {Array.from({ length: Math.max(5, sqlQuery.split('\n').length) }, (_, i) => (
                            <span key={i} className="text-[11px] text-muted font-mono leading-none">{i + 1}</span>
                          ))}
                        </div>
                        <textarea
                          value={sqlQuery}
                          onChange={e => setSqlQuery(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleExecuteSql(); }
                            if (e.key === 'Tab') { e.preventDefault(); const s = e.currentTarget.selectionStart; const end = e.currentTarget.selectionEnd; setSqlQuery(v => v.substring(0, s) + '  ' + v.substring(end)); setTimeout(() => { e.currentTarget.selectionStart = e.currentTarget.selectionEnd = s + 2; }, 0); }
                          }}
                          rows={Math.max(5, Math.min(10, sqlQuery.split('\n').length + 1))}
                          spellCheck={false}
                          placeholder="-- Digite sua consulta SQL aqui..."
                          className="w-full pl-12 pr-4 py-3 bg-transparent text-brand font-mono text-sm resize-none focus:outline-none leading-[1.6] custom-scrollbar"
                          style={{ minHeight: '110px' }}
                        />
                      </div>

                      {/* Divider com info de status */}
                      <div className="shrink-0 border-b border-line bg-page px-4 py-1.5 flex items-center gap-3">
                        {sqlLoading && (
                          <span className="flex items-center gap-2 text-xs text-brand font-medium">
                            <Loader2 className="animate-spin" size={13} /> Executando consulta...
                          </span>
                        )}
                        {sqlResult && !sqlLoading && (
                          <span className="flex items-center gap-2 text-xs text-brand font-medium">
                            <CheckCircle2 size={13} />
                            {sqlResult.type === 'query'
                              ? `${sqlResult.rowCount} linha${sqlResult.rowCount !== 1 ? 's' : ''} retornada${sqlResult.rowCount !== 1 ? 's' : ''}`
                              : `${sqlResult.rowsAffected} linha${sqlResult.rowsAffected !== 1 ? 's' : ''} afetada${sqlResult.rowsAffected !== 1 ? 's' : ''}`}
                            {sqlResult.limited && <span className="text-brand font-normal ml-1"> limitado a 500 registros</span>}
                          </span>
                        )}
                        {sqlError && !sqlLoading && (
                          <span className="flex items-center gap-2 text-xs text-brand font-medium"><AlertCircle size={13} /> Erro na execução</span>
                        )}
                        {!sqlLoading && !sqlResult && !sqlError && (
                          <span className="text-xs text-muted">Pronto para executar.</span>
                        )}
                        {sqlResult && <span className="ml-auto text-xs text-muted font-mono">{sqlResult.durationMs}ms</span>}
                      </div>

                      {/* Ãrea de resultado */}
                      <div className="flex-1 overflow-auto custom-scrollbar min-h-0 bg-page">
                        {/* Erro */}
                        {sqlError && (
                          <div className="m-4 bg-support border border-brand rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="text-brand shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-brand font-bold text-sm mb-1">Erro na Query</p>
                              <pre className="text-brand text-xs font-mono whitespace-pre-wrap leading-relaxed">{sqlError}</pre>
                            </div>
                          </div>
                        )}

                        {/* Tabela com dados e ações interativas */}
                        {sqlResult?.type === 'query' && sqlResult.columns.length > 0 && sqlResult.rowCount > 0 && (() => {
                          const currentTableName = /FROM\s+([a-zA-Z0-9_]+)/i.exec(sqlQuery)?.[1] || '';
                          const idColIndex = sqlResult.columns.findIndex((col: string) => col.toLowerCase() === 'id');
                          const statusColIndex = sqlResult.columns.findIndex((col: string) => col.toLowerCase() === 'status');
                          const hasId = idColIndex !== -1 && Boolean(currentTableName);

                          return (
                            <div>
                              {hasId && (
                                <div className="px-4 py-1.5 bg-page/60 border-b border-line text-[11px] text-muted flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-muted">
                                    <Sparkles size={12} className="text-brand" />
                                    Tabela <span className="font-mono text-brand font-bold">{currentTableName}</span> identificada — Dê <strong className="text-ink">duplo clique</strong> em qualquer célula para editar direto no banco.
                                  </span>
                                </div>
                              )}
                              <table className="w-full text-left text-xs font-mono whitespace-nowrap border-collapse">
                                <thead className="sticky top-0 z-10 bg-page border-b border-line">
                                  <tr>
                                    <th className="px-3 py-2.5 text-muted font-bold border-r border-line w-10 text-center">#</th>
                                    {hasId && (
                                      <th className="px-3 py-2.5 text-brand font-bold border-r border-line bg-page">
                                        Ações
                                      </th>
                                    )}
                                    {sqlResult.columns.map((col: string) => (
                                      <th key={col} className="px-4 py-2.5 text-brand font-bold border-r border-line last:border-r-0 bg-page">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sqlResult.rows.map((row: any[], ri: number) => {
                                    const rowId = hasId ? String(row[idColIndex]) : '';
                                    const statusVal = statusColIndex !== -1 ? String(row[statusColIndex]) : '';
                                    const isRowUpdating = updatingRowId === rowId;

                                    return (
                                      <tr key={ri} className={`border-b border-line hover:bg-surface transition ${ri % 2 === 0 ? '' : 'bg-page'}`}>
                                        <td className="px-3 py-2 text-muted border-r border-line text-center select-none">{ri + 1}</td>

                                        {/* Coluna de Ações Rápidas */}
                                        {hasId && (
                                          <td className="px-2.5 py-1.5 border-r border-line bg-page">
                                            <div className="flex items-center gap-1.5">
                                              {/* Botão Fechar Caixa (se status == open) */}
                                              {currentTableName === 'cash_registers' && statusVal === 'open' && (
                                                <button
                                                  onClick={() => handleCloseCashRegister(rowId)}
                                                  disabled={isRowUpdating}
                                                  title="Fechar este caixa no banco agora"
                                                  className="px-2.5 py-1 bg-support hover:bg-brand border border-brand text-brand hover:text-ink rounded-md text-[11px] font-sans font-bold flex items-center gap-1.5 transition shadow-sm hover:text-on-brand"
                                                >
                                                  {isRowUpdating ? <Loader2 size={11} className="animate-spin" /> : <LockKeyhole size={11} />}
                                                  Fechar Caixa
                                                </button>
                                              )}

                                              {/* Botão Cancelar Venda (se completed) */}
                                              {currentTableName === 'sales' && statusVal === 'completed' && (
                                                <button
                                                  onClick={() => handleCancelSale(rowId)}
                                                  disabled={isRowUpdating}
                                                  title="Cancelar esta venda no banco"
                                                  className="px-2 py-0.5 bg-support hover:bg-brand border border-brand text-brand hover:text-ink rounded text-[11px] font-sans font-semibold flex items-center gap-1 transition hover:text-on-brand"
                                                >
                                                  {isRowUpdating ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                                                  Cancelar
                                                </button>
                                              )}

                                              {/* Botão Gerar UPDATE no editor */}
                                              <button
                                                onClick={() => {
                                                  const setClauses = sqlResult.columns
                                                    .filter((c: string) => c.toLowerCase() !== 'id')
                                                    .map((c: string) => {
                                                      const actualIndex = sqlResult.columns.indexOf(c);
                                                      const v = row[actualIndex];
                                                      return `${c} = ${v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`}`;
                                                    })
                                                    .join(',\n  ');
                                                  setSqlQuery(`UPDATE ${currentTableName}\nSET\n  ${setClauses}\nWHERE id = '${rowId}';`);
                                                  toast.info('Comando UPDATE carregado no editor!');
                                                }}
                                                title="Carregar UPDATE completo desta linha no editor SQL"
                                                className="p-1 text-muted hover:text-brand hover:bg-surface rounded transition"
                                              >
                                                <Edit2 size={12} />
                                              </button>

                                              {/* Botão Excluir Linha */}
                                              <button
                                                onClick={() => handleDeleteRow(currentTableName, rowId)}
                                                disabled={isRowUpdating}
                                                title="Excluir este registro do banco"
                                                className="p-1 text-muted hover:text-brand hover:bg-surface rounded transition"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </td>
                                        )}

                                        {/* Células de Dados */}
                                        {row.map((cell: any, ci: number) => {
                                          const colName = sqlResult.columns[ci];
                                          const isEditing = editingCell?.rowIndex === ri && editingCell?.column === colName;

                                          return (
                                            <td
                                              key={ci}
                                              className="px-3 py-1.5 border-r border-line last:border-r-0 max-w-xs"
                                            >
                                              {isEditing ? (
                                                <div className="flex items-center gap-1 min-w-[160px]">
                                                  <input
                                                    type="text"
                                                    value={editingCell.value}
                                                    onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                                    onKeyDown={e => {
                                                      if (e.key === 'Enter') handleSaveInlineEdit(currentTableName);
                                                      if (e.key === 'Escape') setEditingCell(null);
                                                    }}
                                                    placeholder="Valor ou NULL"
                                                    className="bg-page border border-brand text-ink text-xs px-2 py-1 rounded outline-none w-full font-mono"
                                                    autoFocus
                                                  />
                                                  <button
                                                    onClick={() => handleSaveInlineEdit(currentTableName)}
                                                    className="p-1 bg-brand hover:bg-brand text-on-brand rounded transition hover:text-on-brand"
                                                    title="Salvar alteração (Enter)"
                                                  >
                                                    <Check size={12} />
                                                  </button>
                                                  <button
                                                    onClick={() => setEditingCell(null)}
                                                    className="p-1 bg-surface hover:bg-support text-muted rounded transition"
                                                    title="Cancelar (Esc)"
                                                  >
                                                    <X size={12} />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div
                                                  className="flex items-center justify-between gap-1 group/cell cursor-pointer"
                                                  onDoubleClick={() => {
                                                    if (hasId && colName.toLowerCase() !== 'id') {
                                                      setEditingCell({ rowIndex: ri, column: colName, value: cell === null ? '' : String(cell), id: rowId });
                                                    }
                                                  }}
                                                  title={cell === null ? 'NULL (Duplo clique para editar)' : `${String(cell)} (Duplo clique para editar)`}
                                                >
                                                  <span className="truncate max-w-xs">
                                                    {cell === null ? (
                                                      <span className="text-muted italic">NULL</span>
                                                    ) : (colName.toLowerCase() === 'code' || colName.toLowerCase() === 'shortcode') && cell !== null && cell !== '' ? (
                                                      <span className="px-2 py-0.5 bg-support text-brand font-bold rounded-md text-xs border border-brand inline-flex items-center font-mono">
                                                        #{String(cell)}
                                                      </span>
                                                    ) : colName.toLowerCase() === 'status' && String(cell) === 'open' ? (
                                                      <span className="px-1.5 py-0.5 bg-support text-brand font-bold rounded text-[10px] uppercase border border-brand inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse text-on-brand" />
                                                        open
                                                      </span>
                                                    ) : colName.toLowerCase() === 'status' && String(cell) === 'closed' ? (
                                                      <span className="px-1.5 py-0.5 bg-surface text-muted font-semibold rounded text-[10px] uppercase">
                                                        closed
                                                      </span>
                                                    ) : colName.toLowerCase() === 'status' && String(cell) === 'cancelled' ? (
                                                      <span className="px-1.5 py-0.5 bg-support text-brand font-semibold rounded text-[10px] uppercase">
                                                        cancelled
                                                      </span>
                                                    ) : typeof cell === 'string' && cell.startsWith('20') && cell.includes('T') ? (
                                                      <span className="text-brand">{new Date(cell).toLocaleString('pt-BR')}</span>
                                                    ) : typeof cell === 'number' || (!isNaN(Number(cell)) && cell !== '') ? (
                                                      <span className="text-brand">{String(cell)}</span>
                                                    ) : (
                                                      <span className="text-muted">{String(cell)}</span>
                                                    )}
                                                  </span>
                                                  <button
                                                    onClick={e => { e.stopPropagation(); handleCopyValue(cell); }}
                                                    title="Copiar valor integral"
                                                    className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-muted hover:text-muted transition shrink-0"
                                                  >
                                                    <Copy size={10} />
                                                  </button>
                                                </div>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}

                        {/* Query executada mas 0 linhas retornadas */}
                        {sqlResult?.type === 'query' && sqlResult.rowCount === 0 && (
                          <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-12 h-12 bg-page rounded-full flex items-center justify-center mb-3">
                              <CheckCircle2 className="text-muted" size={24} />
                            </div>
                            <p className="text-muted font-bold text-sm">Nenhum registro encontrado</p>
                            <p className="text-muted text-xs mt-1">A consulta foi executada com sucesso em {sqlResult.durationMs}ms, mas não retornou nenhuma linha.</p>
                          </div>
                        )}

                        {/* DML result (UPDATE/DELETE/INSERT) */}
                        {sqlResult?.type === 'exec' && (
                          <div className="m-4 bg-support border border-brand rounded-xl p-6 flex items-center gap-4">
                            <CheckCircle2 className="text-brand shrink-0" size={32} />
                            <div>
                              <p className="text-brand font-black text-lg">{sqlResult.rowsAffected} linha{sqlResult.rowsAffected !== 1 ? 's' : ''} afetada{sqlResult.rowsAffected !== 1 ? 's' : ''}</p>
                              <p className="text-muted text-sm mt-0.5">Comando SQL executado com sucesso em {sqlResult.durationMs}ms</p>
                            </div>
                          </div>
                        )}

                        {/* Histórico recente quando não há resultado */}
                        {!sqlResult && !sqlError && !sqlLoading && sqlHistory.length > 0 && (
                          <div className="p-4">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2.5 flex items-center gap-2"><History size={11} /> Histórico de Consultas</p>
                            <div className="space-y-1">
                              {sqlHistory.map((q, i) => (
                                <div key={i} className="flex items-center gap-3 group px-2 py-1.5 rounded-lg hover:bg-surface/50 transition">
                                  <span className="flex-1 text-xs font-mono text-muted truncate">{q}</span>
                                  <button onClick={() => { setSqlQuery(q); handleExecuteSql(q); }} className="text-xs text-muted hover:text-brand opacity-0 group-hover:opacity-100 transition px-2 py-0.5 rounded border border-line hover:border-brand">executar</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!sqlResult && !sqlError && !sqlLoading && sqlHistory.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                            <Terminal className="text-muted mb-3" size={40} />
                            <p className="text-muted text-sm">Selecione uma tabela ou atalho na barra lateral para consultar.</p>
                            <p className="text-muted text-xs mt-1">Você também pode digitar comandos SQL diretamente no editor.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'leads' ? (
              /* ── LEADS TAB ── */
              <LeadsPanel
                pin={pinDigits.join('')}
                onCountChange={setLeadsCount}
              />
            ) : (
              /* ── LEADGER INTEGRATION TAB ── */
              <LeadgerIntegrationPanel
                pin={pinDigits.join('')}
                tenants={tenants}
                onRefreshTenants={loadTenants}
              />
            )}
          </div>
        )}

        {/* — BACKUPS STEP — */}
        {step === "backups" && (
          <div className="max-w-4xl mx-auto mt-10 animate-[fadeIn_0.3s_ease] w-full">
            <button onClick={() => setStep("list")} className="mb-4 text-muted hover:text-ink flex items-center gap-2 text-sm"><ArrowRight className="rotate-180" size={16} /> Voltar para lista</button>
            <div className="bg-page/70 backdrop-blur-xl border border-line rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3"><Database className="text-brand" /> Gestão de Backups</h2>
                  <p className="text-xs text-muted mt-1">Gere e restaure cópias de segurança. Backups mais antigos que 7 dias são excluídos automaticamente.</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={downloadingAll} onClick={async () => {
                    setDownloadingAll(true);
                    try {
                      const pin = pinDigits.join('');
                      const response = await api.get(`/sys-init/backups/download-all?pin=${pin}`, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a'); link.href = url;
                      link.setAttribute('download', `Backups_Lojista_${new Date().getTime()}.zip`);
                      document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
                    } catch (e) { toast.error("Erro ao baixar ZIP"); } finally { setDownloadingAll(false); }
                  }} className="bg-surface hover:bg-support disabled:opacity-50 text-ink px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition border border-line">
                    {downloadingAll ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} className="rotate-180" />}
                    Baixar Todos (.zip)
                  </button>
                  <button disabled={creatingBackup} onClick={async () => {
                    if (!window.confirm("Deseja criar um backup geral de todos os bancos de dados agora?")) return;
                    setCreatingBackup(true);
                    try {
                      const pin = pinDigits.join('');
                      await api.post('/sys-init/backups/create', { type: 'all' }, { headers: { 'x-setup-pin': pin } });
                      toast.success("Backup geral criado com sucesso!"); loadBackups();
                    } catch (e: any) { toast.error(e.response?.data?.message || "Erro ao criar backup"); } finally { setCreatingBackup(false); }
                  }} className="bg-brand hover:bg-brand disabled:opacity-50 text-on-brand px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition hover:text-on-brand">
                    {creatingBackup ? <Loader2 className="animate-spin" size={18} /> : 'Gerar Backup Geral'}
                  </button>
                </div>
              </div>

              <div className="bg-surface border border-line rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div><h3 className="font-bold text-ink mb-1">Rotina Automática Diária</h3><p className="text-xs text-muted">Gere um backup geral automaticamente num horário fixo.</p></div>
                <div className="flex items-center gap-4">
                  {backupSchedule.enabled && (
                    <input type="time" value={backupSchedule.time} onChange={(e) => setBackupSchedule({ ...backupSchedule, time: e.target.value })} className="bg-page border border-line rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand" />
                  )}
                  <button disabled={savingSchedule} onClick={async () => {
                    setSavingSchedule(true);
                    try {
                      const pin = pinDigits.join(''); const newEnabled = !backupSchedule.enabled;
                      const payload = { ...backupSchedule, enabled: newEnabled };
                      await api.post('/sys-init/backups/schedule', payload, { headers: { 'x-setup-pin': pin } });
                      setBackupSchedule(payload); toast.success(`Rotina ${newEnabled ? 'ativada' : 'desativada'} com sucesso!`);
                    } catch (e) { toast.error("Erro ao salvar rotina"); } finally { setSavingSchedule(false); }
                  }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm transition ${backupSchedule.enabled ? 'bg-support text-brand' : 'bg-support/50 text-muted'}`}>
                    {savingSchedule ? <Loader2 className="animate-spin" size={16} /> : (backupSchedule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />)}
                    {backupSchedule.enabled ? 'Ativada' : 'Desativada'}
                  </button>
                  {backupSchedule.enabled && (
                    <button onClick={async () => {
                      setSavingSchedule(true);
                      try { const pin = pinDigits.join(''); await api.post('/sys-init/backups/schedule', backupSchedule, { headers: { 'x-setup-pin': pin } }); toast.success("Horário salvo!"); }
                      catch (e) { toast.error("Erro ao salvar"); } finally { setSavingSchedule(false); }
                    }} className="bg-brand hover:bg-brand text-on-brand px-3 py-1.5 rounded-lg text-sm font-bold transition hover:text-on-brand">Salvar Hora</button>
                  )}
                </div>
              </div>

              {loadingBackups ? (
                <div className="py-12 text-center text-muted"><Loader2 className="animate-spin inline-block mr-2" /> Carregando backups...</div>
              ) : backupsList.length === 0 ? (
                <div className="py-12 text-center text-muted bg-page/50 rounded-xl border border-line">Nenhum backup encontrado.</div>
              ) : (
                <div className="space-y-4">
                  {backupsList.map((group, i) => (
                    <div key={i} className="border border-line rounded-xl overflow-hidden bg-page/50 transition">
                      <button onClick={() => setExpandedFolder(expandedFolder === group.folderName ? null : group.folderName)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface transition text-left">
                        <div className="flex items-center gap-3">
                          <Database size={20} className={group.isHeart ? 'text-brand' : 'text-brand'} />
                          <div>
                            <p className="font-bold text-muted">{group.isHeart ? 'Sistema Central (Heart)' : `Tenant: ${group.tenantName}`}</p>
                            <p className="text-xs text-muted">{group.files.length} arquivo(s)</p>
                          </div>
                        </div>
                        <ArrowRight size={18} className={`text-muted transition-transform ${expandedFolder === group.folderName ? '-rotate-90' : 'rotate-90'}`} />
                      </button>
                      {expandedFolder === group.folderName && (
                        <div className="border-t border-line bg-page/80">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-page text-muted"><tr>
                              <th className="px-6 py-3 font-medium">Arquivo</th>
                              <th className="px-6 py-3 font-medium">Tamanho</th>
                              <th className="px-6 py-3 font-medium">Data</th>
                              <th className="px-6 py-3 font-medium text-right">Ações</th>
                            </tr></thead>
                            <tbody className="divide-y divide-line">
                              {group.files.map((file: any, j: number) => (
                                <tr key={j} className="hover:bg-surface transition">
                                  <td className="px-6 py-3 font-mono text-xs text-muted">Backup_{group.isHeart ? 'Heart' : group.tenantName}.sql</td>
                                  <td className="px-6 py-3 text-muted">{(file.sizeBytes / 1024 / 1024).toFixed(2)} MB</td>
                                  <td className="px-6 py-3 text-muted">{new Date(file.createdAt).toLocaleString('pt-BR')}</td>
                                  <td className="px-6 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      <button onClick={async () => {
                                        try { const pin = pinDigits.join(''); const response = await api.get(`/sys-init/backups/download/${file.path}?pin=${pin}`, { responseType: 'blob' });
                                          const url = window.URL.createObjectURL(new Blob([response.data])); const link = document.createElement('a'); link.href = url;
                                          link.setAttribute('download', file.filename); document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
                                        } catch (e) { toast.error("Erro ao fazer download"); }
                                      }} className="p-1.5 text-muted hover:text-brand hover:bg-support rounded-lg transition" title="Download"><Upload size={16} className="rotate-180" /></button>
                                      <button onClick={async () => {
                                        if (!window.confirm(`ï¸ Restaurar o backup? Os dados atuais serão substituídos irrevogavelmente.`)) return;
                                        try { const pin = pinDigits.join(''); await api.post(`/sys-init/backups/restore/${file.path}`, {}, { headers: { 'x-setup-pin': pin } }); toast.success("Backup restaurado!"); }
                                        catch (e: any) { toast.error(e.response?.data?.message || "Erro ao restaurar backup"); }
                                      }} className="p-1.5 text-muted hover:text-brand hover:bg-support rounded-lg transition" title="Restaurar"><ArrowRight size={16} /></button>
                                      <button onClick={async () => {
                                        if (!window.confirm("Deseja excluir este backup?")) return;
                                        try { const pin = pinDigits.join(''); await api.delete(`/sys-init/backups/${file.path}`, { headers: { 'x-setup-pin': pin } }); loadBackups(); }
                                        catch (e: any) { toast.error("Erro ao excluir backup"); }
                                      }} className="p-1.5 text-muted hover:text-brand hover:bg-support rounded-lg transition" title="Excluir"><Trash2 size={16} /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* — CREATE STEP — */}
        {step === "create" && (
          <div className="max-w-lg mx-auto mt-10 animate-[fadeIn_0.4s_ease] w-full">
            <button onClick={() => setStep("list")} className="mb-4 text-muted hover:text-ink flex items-center gap-2 text-sm"><ArrowRight className="rotate-180" size={16} /> Voltar para lista</button>
            <div className="p-8 rounded-3xl bg-page/70 backdrop-blur-xl border border-line shadow-2xl">
              <h1 className="text-2xl font-bold tracking-tight mb-6 text-ink">Provisionar Nova Loja</h1>
              <form onSubmit={handleProvision} className="space-y-4">
                <div>
                  <label className="text-xs text-muted uppercase font-bold block mb-1.5">Foto / Logo do Menu Lateral</label>
                  <div className="flex items-center gap-4 p-3 bg-page border border-line rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-support border-2 border-brand flex items-center justify-center overflow-hidden shrink-0">
                      {createLogoPreview ? (
                        <img src={createLogoPreview} alt="Preview da foto da loja" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={22} className="text-brand" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="bg-surface hover:bg-support text-ink px-3.5 py-2 rounded-xl cursor-pointer transition text-xs font-bold flex items-center gap-2 w-max border border-line">
                          <Upload size={14} /> {createLogoFile ? "Trocar Foto" : "Escolher Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files?.[0]) {
                                setCreateLogoFile(e.target.files[0]);
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {createLogoFile && (
                          <button
                            type="button"
                            onClick={() => setCreateLogoFile(null)}
                            className="px-2.5 py-2 rounded-xl text-xs font-semibold text-muted hover:text-brand hover:bg-support border border-line transition flex items-center gap-1"
                          >
                            <X size={13} /> Remover
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-1.5 truncate">
                        {createLogoFile
                          ? createLogoFile.name
                          : "Exibida no ícone circular superior do menu lateral da loja."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-muted uppercase font-bold">Nome da Empresa</label><input required value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Ex: Boutique Roxo" className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                  <div><label className="text-xs text-muted uppercase font-bold">Banco PostgreSQL</label><input required value={dbName} onChange={e => { setDbName(e.target.value); setDbNameManual(true); }} className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink font-mono text-sm focus:border-brand outline-none" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-muted uppercase font-bold">CNPJ (Opcional)</label><input value={newCnpj} onChange={e => setNewCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                  <div><label className="text-xs text-muted uppercase font-bold">Telefone / WhatsApp</label><input value={newTelefone} onChange={e => setNewTelefone(e.target.value)} placeholder="(11) 99999-9999" className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-muted uppercase font-bold">Nome do Admin</label><input required value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Ex: Maria Silva" className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                  <div><label className="text-xs text-muted uppercase font-bold">E-mail de Login</label><input type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@loja.com" className="w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-muted uppercase font-bold">Senha Inicial</label><input type="text" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" required value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="pdv-secret-input w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                  <div><label className="text-xs text-muted uppercase font-bold">Confirmar Senha</label><input type="text" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" required value={adminPasswordConfirm} onChange={e => setAdminPasswordConfirm(e.target.value)} className="pdv-secret-input w-full p-2.5 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" /></div>
                </div>
                {/* — PLANO E MÓDULOS NA CRIAÇÃO — */}
                {(() => {
                  const createPricing = calculateTenantMonthlyPrice(createModulos);
                  return (
                    <div className="bg-page border border-line rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand">Plano Padrão & Módulos Contratados</p>
                          <p className="text-[11px] text-muted">
                            Já inclui: Estoque, Compras & Financeiro, Gestão Mobile e Relatórios.
                          </p>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-support text-brand border border-brand">
                          Total: {formatBrlCurrency(createPricing.totalPrice)}/mês
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface border border-line">
                        <div>
                          <p className="text-xs font-bold text-ink">
                            Filial Conectada Multi-Empresa (Desconto de {formatBrlCurrency(BRANCH_DISCOUNT_VALUE)})
                          </p>
                          <p className="text-[11px] text-muted">
                            Reduz o Plano Padrão de {formatBrlCurrency(BASE_PLAN_PRICE)} para {formatBrlCurrency(BRANCH_PLAN_PRICE)}/mês nesta loja adicional.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleCreateModule("filialMultiEmpresa")}
                          className={`transition-colors shrink-0 ${createModulos.filialMultiEmpresa ? "text-brand" : "text-muted"}`}
                        >
                          {createModulos.filialMultiEmpresa ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                        {COMMERCIAL_MODULES.map((mod) => {
                          const isChecked = Boolean(createModulos[mod.id]);
                          return (
                            <div
                              key={mod.id}
                              onClick={() => handleToggleCreateModule(mod.id)}
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                                isChecked
                                  ? "bg-support border-brand"
                                  : "bg-surface border-line hover:border-brand"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-bold text-ink">{mod.label}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-page text-brand border border-brand">
                                    + {formatBrlCurrency(mod.price)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted truncate">{mod.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleToggleCreateModule(mod.id);
                                }}
                                className={`transition-colors shrink-0 ${isChecked ? "text-brand" : "text-muted"}`}
                              >
                                {isChecked ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-xs text-muted uppercase font-bold tracking-wider">Mensalidade (R$)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextAuto = !createAutoPrice;
                          setCreateAutoPrice(nextAuto);
                          if (nextAuto) {
                            setMensalidadeValor(calculateTenantMonthlyPrice(createModulos).totalPrice.toFixed(2));
                          }
                        }}
                        className="text-[10px] font-bold text-brand hover:underline"
                      >
                        {createAutoPrice ? "Auto (pelos módulos)" : "Manual"}
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="149.90"
                      value={mensalidadeValor}
                      onChange={e => {
                        setCreateAutoPrice(false);
                        setMensalidadeValor(e.target.value);
                      }}
                      className="w-full p-3 bg-page border border-line rounded-2xl mt-1 text-ink font-bold focus:border-brand outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase font-bold tracking-wider">1º Vencimento</label>
                    <input type="date" value={mensalidadeVencimento} onChange={e => setMensalidadeVencimento(e.target.value)} className="w-full p-3 bg-page border border-line rounded-2xl mt-1 text-ink font-bold focus:border-brand outline-none [color-scheme:dark]" />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3 bg-page p-3.5 rounded-xl border border-line">
                    <button type="button" onClick={() => setSeedProducts(!seedProducts)} className={`transition-colors ${seedProducts ? 'text-brand' : 'text-muted'}`}>
                      {seedProducts ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                    <div><p className="text-sm font-semibold text-ink">Produtos Base de Demonstração</p><p className="text-xs text-muted">Popular banco de dados com catálogo inicial e formas de pagamento.</p></div>
                  </div>
                  <div className="flex items-center gap-3 bg-page p-3.5 rounded-xl border border-line">
                    <button type="button" onClick={() => setNewSyncLeadger(!newSyncLeadger)} className={`transition-colors ${newSyncLeadger ? 'text-brand' : 'text-muted'}`}>
                      {newSyncLeadger ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                    <div><p className="text-sm font-semibold text-ink">Sincronizar com Teltech Leadger</p><p className="text-xs text-muted">Gerar IDs permanentes (base/client) e enfileirar faturas no Outbox.</p></div>
                  </div>
                </div>
                {formError && <div className="text-brand text-sm bg-support border border-brand rounded-xl p-3">{formError}</div>}
                <button type="submit" disabled={formLoading} className="w-full bg-brand hover:bg-brand-hover text-on-brand font-bold py-3.5 rounded-xl mt-4 hover:text-on-brand transition">
                  {formLoading ? <Loader2 className="animate-spin mx-auto" /> : "Provisionar Banco & Criar Loja"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* — EDIT STEP — */}
        {step === "edit" && editingTenant && (
          <div className="max-w-4xl mx-auto mt-6 animate-[fadeIn_0.3s_ease] w-full">
            <button onClick={() => setStep("list")} className="mb-4 text-muted hover:text-ink flex items-center gap-2 text-sm"><ArrowRight className="rotate-180" size={16} /> Voltar para lista</button>
            <div className="bg-page/70 backdrop-blur-xl border border-line rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-line flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  {editingTenant.logoUrl ? (
                    <img src={getFullUrl(editingTenant.logoUrl)} alt="Logo" className="w-11 h-11 rounded-xl object-contain border border-line bg-page" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-support border border-brand flex items-center justify-center font-bold text-brand">
                      {(editingTenant.name || editingTenant.nomeFantasia)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-ink">{editingTenant.name || editingTenant.nomeFantasia}</h2>
                    <span className="text-xs font-mono text-muted">{editingTenant.databaseName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleImpersonate(editingTenant)}
                    disabled={impersonatingId === editingTenant.id}
                    className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover transition disabled:opacity-50"
                  >
                    {impersonatingId === editingTenant.id ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                    Acessar Loja (1-Clique)
                  </button>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${editingTenant.status === 'active' ? 'bg-support text-brand border-brand' : 'bg-surface text-muted border-line'}`}>
                    {editingTenant.status === 'active' ? 'Ativo' : editingTenant.status === 'suspended' ? 'Suspenso' : editingTenant.status === 'paused' ? 'Pausado' : 'Inativo'}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-line bg-page/50 overflow-x-auto">
                {[
                  { id: 'identidade', label: 'Identidade', icon: Building2 },
                  { id: 'modulos', label: 'Módulos', icon: Settings },
                  { id: 'fiscal', label: 'Fiscal', icon: FileText },
                  { id: 'financeiro', label: 'Financeiro & Faturas', icon: CreditCard },
                  { id: 'usuarios', label: 'Usuários & Senhas', icon: Users },
                  { id: 'xray', label: 'Raio-X do Banco', icon: Server },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={async () => {
                      setEditTab(tab.id as any);
                      if (tab.id === 'usuarios') {
                        setLoadingUsers(true);
                        try {
                          const pin = pinDigits.join('');
                          const res = await api.get(`/tenants/setup/${editingTenant.id}/users`, { headers: { 'x-setup-pin': pin } });
                          setTenantUsers(res.data || []);
                        } catch (e) { toast.error("Erro ao carregar usuários"); }
                        finally { setLoadingUsers(false); }
                      }
                      if (tab.id === 'financeiro') {
                        loadInvoicesAndHistory(editingTenant.id);
                      }
                    }}
                    className={`flex-shrink-0 px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${editTab === tab.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
                  >
                    <tab.icon size={13} />{tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 flex-1">
                {/* TAB: Identidade */}
                {editTab === 'identidade' && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs text-muted uppercase tracking-wider mb-2 block font-bold">Foto / Logo do Menu Lateral (White Label)</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-support border-2 border-brand rounded-full flex items-center justify-center overflow-hidden shrink-0">
                          {editLogoPreview ? (
                            <img src={editLogoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : editingTenant.logoUrl ? (
                            <img src={getFullUrl(editingTenant.logoUrl)} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon size={26} className="text-brand" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="bg-surface hover:bg-support text-ink px-4 py-2 rounded-xl cursor-pointer transition text-sm flex items-center gap-2 w-max border border-line">
                            <Upload size={16} /> Fazer Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                if (e.target.files?.[0]) {
                                  setLogoFile(e.target.files[0]);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="text-xs text-muted mt-2">Exibida no botão circular superior do menu lateral da loja.</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block font-bold">Nome Fantasia</label>
                        <input type="text" value={editingTenant.nomeFantasia || editingTenant.name || ''} onChange={e => setEditingTenant({...editingTenant, nomeFantasia: e.target.value})} className="w-full p-3 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block font-bold">Razão Social</label>
                        <input type="text" value={editingTenant.razaoSocial || ''} onChange={e => setEditingTenant({...editingTenant, razaoSocial: e.target.value})} className="w-full p-3 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block font-bold">Status da Loja</label>
                        <select value={editingTenant.status} onChange={e => setEditingTenant({...editingTenant, status: e.target.value})} className="w-full p-3 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none">
                          <option value="active">Ativo (Liberado)</option>
                          <option value="paused">Pausado (Retorna em breve)</option>
                          <option value="suspended">Suspenso (Bloqueado / Inadimplente)</option>
                          <option value="inactive">Inativo (Encerrado)</option>
                        </select>
                      </div>
                    </div>

                    {/* Contato */}
                    <div className="border-t border-line pt-4">
                      <p className="text-xs text-muted uppercase tracking-wider mb-3 font-bold flex items-center gap-2"><Phone size={12} /> Contato do Cliente</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted mb-1 block">Telefone / WhatsApp</label>
                          <div className="relative">
                            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input type="text" placeholder="(11) 99999-9999" value={editingTenant.telefoneContato || ''} onChange={e => setEditingTenant({...editingTenant, telefoneContato: e.target.value})} className="w-full p-3 pl-9 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted mb-1 block">E-mail de Contato</label>
                          <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input type="email" placeholder="contato@empresa.com" value={editingTenant.emailContato || ''} onChange={e => setEditingTenant({...editingTenant, emailContato: e.target.value})} className="w-full p-3 pl-9 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integração Teltech Leadger */}
                    <div className="border-t border-line pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-muted uppercase tracking-wider font-bold flex items-center gap-2">
                          <Send size={12} className="text-brand" /> Integração Teltech Leadger (IDs Permanentes)
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditingTenant({ ...editingTenant, leadgerSyncEnabled: !editingTenant.leadgerSyncEnabled })}
                          className={`flex items-center gap-1.5 text-xs font-bold ${editingTenant.leadgerSyncEnabled ? 'text-brand' : 'text-muted'}`}
                        >
                          {editingTenant.leadgerSyncEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                          {editingTenant.leadgerSyncEnabled ? 'Sync Ativo' : 'Sync Desativado'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted mb-1 block">client_external_id</label>
                          <input
                            type="text"
                            placeholder="ex: cli_abc12345"
                            value={editingTenant.clientExternalId || ''}
                            onChange={e => setEditingTenant({ ...editingTenant, clientExternalId: e.target.value })}
                            className="w-full p-2.5 bg-page border border-line rounded-xl text-ink font-mono text-xs focus:border-brand outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted mb-1 block">base_external_id</label>
                          <input
                            type="text"
                            placeholder="ex: base_def67890"
                            value={editingTenant.baseExternalId || ''}
                            onChange={e => setEditingTenant({ ...editingTenant, baseExternalId: e.target.value })}
                            className="w-full p-2.5 bg-page border border-line rounded-xl text-ink font-mono text-xs focus:border-brand outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Observações */}
                    <div>
                      <label className="text-xs text-muted mb-1 block flex items-center gap-1.5"><Info size={12} /> Observações Internas</label>
                      <textarea rows={3} placeholder="Notas sobre o cliente, acordos especiais, etc..." value={editingTenant.observacoes || ''} onChange={e => setEditingTenant({...editingTenant, observacoes: e.target.value})} className="w-full p-3 bg-page border border-line rounded-xl text-ink focus:border-brand outline-none resize-none text-sm" />
                    </div>
                  </div>
                )}

                {/* TAB: Módulos */}
                {editTab === 'modulos' && (() => {
                  const pricing = calculateTenantMonthlyPrice(modulos);
                  const currentSavedPrice = Number(editingTenant.mensalidadeValor || 0);
                  const priceMatchesCalc = Math.abs(currentSavedPrice - pricing.totalPrice) < 0.05;

                  return (
                    <div className="space-y-5">
                      {/* Card de Resumo do Plano Padrão e Calculadora Modular */}
                      <div className="bg-page border border-brand rounded-2xl p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-wider text-brand">
                                Plano Padrão do Sistema
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-support text-brand border border-brand">
                                {pricing.isBranch
                                  ? `${formatBrlCurrency(BRANCH_PLAN_PRICE)}/mês (Filial)`
                                  : `${formatBrlCurrency(BASE_PLAN_PRICE)}/mês`}
                              </span>
                            </div>
                            <p className="text-xs text-muted mt-1">
                              Inclusos nativamente: <strong>Frente de Caixa (PDV)</strong>, <strong>Estoque & Grades</strong>, <strong>Compras & Financeiro</strong>, <strong>Gestão Mobile</strong> e <strong>Relatórios</strong>.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyEditModulesPreset("base")}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface hover:bg-support text-ink border border-line transition"
                            >
                              Apenas Plano Padrão
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyEditModulesPreset("full")}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand transition"
                            >
                              Ativar Todos os 9 Módulos
                            </button>
                          </div>
                        </div>

                        {/* Chave de Desconto de Filial Multi-Empresa */}
                        <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface border border-line">
                          <div>
                            <p className="text-sm font-bold text-ink">
                              Loja Adicional / Filial Conectada Multi-Empresa (Desconto de {formatBrlCurrency(BRANCH_DISCOUNT_VALUE)})
                            </p>
                            <p className="text-xs text-muted">
                              Para lojistas com 2, 3, 4 ou mais lojas conectadas ao Grupo: reduz a base desta unidade de {formatBrlCurrency(BASE_PLAN_PRICE)} para {formatBrlCurrency(BRANCH_PLAN_PRICE)}/mês.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleEditModule("filialMultiEmpresa")}
                            className={`transition-colors shrink-0 ${modulos.filialMultiEmpresa ? "text-brand" : "text-muted"}`}
                          >
                            {modulos.filialMultiEmpresa ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
                          </button>
                        </div>

                        {/* Barra de Cálculo da Mensalidade */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                          <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase text-muted">Base da Loja</p>
                            <p className="text-base font-black text-ink mt-0.5">{formatBrlCurrency(pricing.basePrice)}</p>
                            <p className="text-[10px] text-muted">{pricing.isBranch ? "Filial c/ desconto" : "Loja Padrão / Matriz"}</p>
                          </div>
                          <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase text-muted">Módulos Ativos ({pricing.activeAddons.length}/9)</p>
                            <p className="text-base font-black text-brand mt-0.5">+ {formatBrlCurrency(pricing.addonsTotal)}</p>
                            <p className="text-[10px] text-muted">Soma dos add-ons</p>
                          </div>
                          <div className="bg-support border border-brand rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase text-brand">Total Calculado</p>
                            <p className="text-lg font-black text-brand mt-0.5">{formatBrlCurrency(pricing.totalPrice)}</p>
                            <p className="text-[10px] text-muted">Por mês</p>
                          </div>
                          <div className="bg-surface border border-line rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase text-muted">Mensalidade Salva</span>
                              <button
                                type="button"
                                onClick={() => setAutoSyncPrice(!autoSyncPrice)}
                                className="text-[10px] font-bold text-brand hover:underline"
                              >
                                {autoSyncPrice ? "Auto: ON" : "Auto: OFF"}
                              </button>
                            </div>
                            <p className="text-base font-black text-ink mt-0.5">
                              {formatBrlCurrency(currentSavedPrice)}
                            </p>
                            {!priceMatchesCalc ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingTenant({
                                    ...editingTenant,
                                    mensalidadeValor: pricing.totalPrice.toFixed(2),
                                  })
                                }
                                className="mt-1 w-full py-1 px-2 rounded-lg bg-brand text-on-brand text-[10px] font-bold hover:bg-brand-hover transition"
                              >
                                Aplicar {formatBrlCurrency(pricing.totalPrice)}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-brand">Sincronizada com módulos</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lista dos 9 Módulos de Venda */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted">
                            Módulos Adicionais de Venda (9 Módulos)
                          </p>
                          <p className="text-xs text-muted">
                            Clique para ativar ou desativar no pacote desta loja
                          </p>
                        </div>

                        {COMMERCIAL_MODULES.map((item) => {
                          const isEnabled = Boolean(modulos[item.id]);
                          const badge = MODULE_BADGES[item.id];
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleToggleEditModule(item.id)}
                              className={`flex items-center justify-between gap-4 p-4 border rounded-xl cursor-pointer transition ${
                                isEnabled
                                  ? "bg-support border-brand"
                                  : "bg-page border-line hover:border-brand"
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                {badge && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 mt-0.5 ${badge.color}`}
                                  >
                                    {badge.label}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-ink text-sm">{item.title}</p>
                                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-page text-brand border border-brand">
                                      + {formatBrlCurrency(item.price)}/mês
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted mt-1">{item.description}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleToggleEditModule(item.id);
                                }}
                                className={`transition-colors shrink-0 ${isEnabled ? "text-brand" : "text-muted"}`}
                              >
                                {isEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* TAB: Fiscal */}
                {editTab === 'fiscal' && (
                  <div className="space-y-5">
                    <p className="text-sm text-muted border-b border-line pb-3">Estes dados serão injetados no motor fiscal da loja.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="text-xs text-muted uppercase font-bold">CNPJ</label><input type="text" value={editingTenant.cnpj || ''} onChange={e => setEditingTenant({...editingTenant, cnpj: e.target.value})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm mt-1 focus:border-brand outline-none" /></div>
                      <div><label className="text-xs text-muted uppercase font-bold">Ambiente NFC-e</label>
                        <select value={editingTenant.nfceAmbiente || 2} onChange={e => setEditingTenant({...editingTenant, nfceAmbiente: Number(e.target.value)})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm mt-1 focus:border-brand outline-none">
                          <option value={1}>1 - Produção</option>
                          <option value={2}>2 - Homologação</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Financeiro & Faturas */}
                {editTab === 'financeiro' && (
                  <div className="space-y-6">
                    {/* Analytics de cliente */}
                    {(() => {
                      const validLogs = paymentHistory.filter((l: any) => l.tipo === 'payment' && !l.estornado);
                      const totalPago = validLogs.reduce((sum: number, log: any) => sum + Number(log.valor || 0), 0);
                      const ultimoPag = validLogs[0];
                      const mesesConosco = editingTenant?.createdAt
                        ? Math.max(1, Math.round((Date.now() - new Date(editingTenant.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))
                        : null;
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-support border border-brand rounded-2xl p-3 text-center">
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Cliente há</p>
                            <p className="text-xl font-black text-brand">{mesesConosco ?? '—'}</p>
                            <p className="text-[10px] text-muted">meses</p>
                          </div>
                          <div className="bg-support border border-brand rounded-2xl p-3 text-center">
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Total pago</p>
                            <p className="text-lg font-black text-brand">{totalPago > 0 ? `R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</p>
                            <p className="text-[10px] text-muted">{validLogs.length} pagamentos</p>
                          </div>
                          <div className="bg-support border border-brand rounded-2xl p-3 text-center">
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Média mensal</p>
                            <p className="text-lg font-black text-brand">{mesesConosco && totalPago > 0 ? `R$ ${(totalPago / mesesConosco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</p>
                            <p className="text-[10px] text-muted">por mês</p>
                          </div>
                          <div className="bg-surface border border-line rounded-2xl p-3 text-center">
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Último pag.</p>
                            <p className="text-sm font-black text-ink">{ultimoPag ? new Date(ultimoPag.createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                            <p className="text-[10px] text-muted">{ultimoPag ? `R$ ${Number(ultimoPag.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Nenhum'}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Valor e Vencimento Base */}
                    <div className="bg-page border border-line rounded-2xl p-4">
                      <p className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Configuração Base da Assinatura</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wider mb-1 block font-bold">Valor da Mensalidade (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-3 text-muted font-bold text-sm">R$</span>
                            <input type="number" step="0.01" placeholder="0.00" value={editingTenant.mensalidadeValor || ''} onChange={e => setEditingTenant({...editingTenant, mensalidadeValor: e.target.value})} className="w-full p-2.5 pl-10 bg-surface border border-line rounded-xl text-ink font-bold text-base focus:border-brand outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted uppercase tracking-wider mb-1 block font-bold">Próximo Vencimento</label>
                          <input type="date"
                            value={editingTenant.mensalidadeVencimento ? new Date(editingTenant.mensalidadeVencimento).toISOString().split('T')[0] : ''}
                            onChange={e => setEditingTenant({...editingTenant, mensalidadeVencimento: e.target.value ? parseDateLocal(e.target.value).toISOString() : null})}
                            className="w-full p-2.5 bg-surface border border-line rounded-xl text-ink font-bold text-sm focus:border-brand outline-none [color-scheme:dark]" />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted font-bold uppercase">Atalhos:</span>
                        {[
                          { label: '+30 Dias', action: () => { const d = new Date(); d.setDate(d.getDate() + 30); return d; } },
                          { label: 'Dia 05 Prox.', action: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(5); return d; } },
                          { label: 'Dia 10 Prox.', action: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(10); return d; } },
                          { label: 'Dia 15 Prox.', action: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(15); return d; } },
                        ].map((preset, idx) => (
                          <button key={idx} type="button" onClick={() => setEditingTenant({ ...editingTenant, mensalidadeVencimento: preset.action().toISOString() })} className="py-1.5 px-2.5 bg-surface hover:bg-support border border-line rounded-lg text-xs font-bold text-brand transition">
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gerenciador Completo de Faturas Mensais e Estornos */}
                    <TenantInvoicesManager
                      tenant={editingTenant}
                      pin={pinDigits.join('')}
                      invoices={tenantInvoices}
                      paymentHistory={paymentHistory}
                      loadingHistory={loadingPaymentHistory}
                      onRefresh={() => {
                        loadInvoicesAndHistory(editingTenant.id);
                        loadTenants();
                      }}
                    />
                  </div>
                )}

                {/* TAB: Usuários & Senhas */}
                {editTab === 'usuarios' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted">Gerencie logins, cargos, PINs de caixa e acesse a loja como qualquer operador.</p>
                      <button
                        onClick={() => setShowCreateUser(!showCreateUser)}
                        className="px-4 py-2 text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand rounded-xl transition flex items-center gap-1.5"
                      >
                        {showCreateUser ? <X size={14} /> : <UserPlus size={14} />}
                        {showCreateUser ? 'Cancelar' : 'Novo Usuário'}
                      </button>
                    </div>

                    {showCreateUser && (
                      <div className="bg-page border border-brand rounded-xl p-4 space-y-3 animate-[fadeIn_0.2s_ease]">
                        <h4 className="text-sm font-bold text-brand flex items-center gap-2"><UserPlus size={14} /> Criar Novo Usuário na Loja</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Nome</label>
                            <input type="text" placeholder="Ex: João Estoquista" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm focus:border-brand outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Email (Login)</label>
                            <input type="email" placeholder="estoquista@loja.com" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm focus:border-brand outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Senha de Login</label>
                            <input type="text" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" placeholder="Mínimo 6 caracteres" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} className="pdv-secret-input w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm focus:border-brand outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">PIN do Caixa (Opcional)</label>
                            <input type="text" maxLength={6} placeholder="Ex: 1234" value={newUserForm.pin} onChange={e => setNewUserForm({...newUserForm, pin: e.target.value})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm font-mono focus:border-brand outline-none" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">Perfil de Acesso</label>
                            <select value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})} className="w-full p-2.5 bg-page border border-line rounded-xl text-ink text-sm focus:border-brand outline-none">
                              <option value="operator">Operador (Caixa PDV)</option>
                              <option value="stockist">Estoquista (Catálogo & Estoque)</option>
                              <option value="admin">Administrador (Acesso Total)</option>
                            </select>
                          </div>
                        </div>
                        <button
                          disabled={editLoading || !newUserForm.name || !newUserForm.email || !newUserForm.password}
                          onClick={async () => {
                            try {
                              setEditLoading(true);
                              const pinSetup = pinDigits.join('');
                              await api.post(`/tenants/setup/${editingTenant.id}/users`, newUserForm, { headers: { 'x-setup-pin': pinSetup } });
                              toast.success(`Usuário ${newUserForm.name} criado com sucesso!`);
                              setShowCreateUser(false);
                              setNewUserForm({ name: '', email: '', password: '', pin: '', role: 'operator' });
                              const { data: users } = await api.get(`/tenants/setup/${editingTenant.id}/users`, { headers: { 'x-setup-pin': pinSetup } });
                              setTenantUsers(users || []);
                            } catch (e: any) {
                              toast.error(e.response?.data?.message || 'Erro ao criar usuário');
                            } finally {
                              setEditLoading(false);
                            }
                          }}
                          className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold py-2.5 rounded-xl transition-colors text-sm"
                        >
                          {editLoading ? 'Criando...' : 'Criar Usuário'}
                        </button>
                      </div>
                    )}

                    {loadingUsers ? (
                      <div className="text-center py-10 text-muted"><Loader2 className="animate-spin inline-block mx-auto" size={24} /></div>
                    ) : tenantUsers.length === 0 ? (
                      <div className="text-center py-10 text-muted">Nenhum usuário encontrado.</div>
                    ) : (
                      <div className="space-y-3">
                        {tenantUsers.map(user => (
                          <div key={user.id} className="bg-page border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-ink flex flex-wrap items-center gap-2">
                                <span>{user.name}</span>
                                <select
                                  value={user.role}
                                  onChange={async (e) => {
                                    const newRole = e.target.value;
                                    try {
                                      const pinSetup = pinDigits.join('');
                                      await api.patch(`/tenants/setup/${editingTenant.id}/users/${user.id}`, { role: newRole }, { headers: { 'x-setup-pin': pinSetup } });
                                      toast.success(`Cargo de ${user.name} alterado para ${newRole}.`);
                                      const { data: users } = await api.get(`/tenants/setup/${editingTenant.id}/users`, { headers: { 'x-setup-pin': pinSetup } });
                                      setTenantUsers(users || []);
                                    } catch (err: any) {
                                      toast.error(err.response?.data?.message || 'Erro ao alterar cargo.');
                                    }
                                  }}
                                  className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-brand bg-support text-brand outline-none cursor-pointer"
                                >
                                  <option value="admin">admin</option>
                                  <option value="operator">operator</option>
                                  <option value="stockist">stockist</option>
                                </select>
                                {!user.active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-line">Bloqueado</span>}
                              </div>
                              <p className="text-xs text-muted font-mono mt-0.5">{user.email}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={() => handleImpersonate(editingTenant, user.id)}
                                disabled={impersonatingId === user.id || !user.active}
                                className="px-2.5 py-1.5 text-xs font-bold bg-brand hover:bg-brand-hover text-on-brand rounded-lg transition flex items-center gap-1 disabled:opacity-40"
                                title="Entrar na loja com este usuário"
                              >
                                <LogIn size={12} /> Entrar
                              </button>
                              <button onClick={async () => {
                                const pinSetup = pinDigits.join('');
                                const novaSenha = window.prompt(`Nova SENHA DE LOGIN para ${user.name}:`);
                                if (novaSenha) {
                                  try { await api.patch(`/tenants/setup/${editingTenant.id}/users/${user.id}/password`, { password: novaSenha }, { headers: { 'x-setup-pin': pinSetup } }); toast.success("Senha alterada!"); }
                                  catch (e: any) { toast.error(e.response?.data?.message || "Erro ao alterar senha"); }
                                }
                              }} className="px-2.5 py-1.5 text-xs font-semibold bg-surface hover:bg-support text-ink border border-line rounded-lg transition">Senha Login</button>
                              <button onClick={async () => {
                                const pinSetup = pinDigits.join('');
                                const novoPin = window.prompt(`Novo PIN DO CAIXA para ${user.name} (ex: 1234):`);
                                if (novoPin) {
                                  try { await api.patch(`/tenants/setup/${editingTenant.id}/users/${user.id}/pin`, { pin: novoPin }, { headers: { 'x-setup-pin': pinSetup } }); toast.success("PIN alterado!"); }
                                  catch (e: any) { toast.error(e.response?.data?.message || "Erro ao alterar PIN"); }
                                }
                              }} className="px-2.5 py-1.5 text-xs font-semibold bg-surface hover:bg-support text-ink border border-line rounded-lg transition">PIN Caixa</button>
                              <button
                                onClick={async () => {
                                  try {
                                    const pinSetup = pinDigits.join('');
                                    await api.patch(`/tenants/setup/${editingTenant.id}/users/${user.id}`, { active: !user.active }, { headers: { 'x-setup-pin': pinSetup } });
                                    toast.success(user.active ? 'Usuário bloqueado.' : 'Usuário reativado.');
                                    const { data: users } = await api.get(`/tenants/setup/${editingTenant.id}/users`, { headers: { 'x-setup-pin': pinSetup } });
                                    setTenantUsers(users || []);
                                  } catch (err: any) {
                                    toast.error(err.response?.data?.message || 'Erro ao alterar status.');
                                  }
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold bg-surface hover:bg-support text-muted hover:text-brand border border-line rounded-lg transition"
                                title={user.active ? 'Bloquear acesso deste usuário' : 'Reativar usuário'}
                              >
                                {user.active ? 'Bloquear' : 'Reativar'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Deseja realmente EXCLUIR o usuário ${user.name} (${user.email})?`)) return;
                                  try {
                                    const pinSetup = pinDigits.join('');
                                    await api.delete(`/tenants/setup/${editingTenant.id}/users/${user.id}`, { headers: { 'x-setup-pin': pinSetup } });
                                    toast.success('Usuário excluído.');
                                    const { data: users } = await api.get(`/tenants/setup/${editingTenant.id}/users`, { headers: { 'x-setup-pin': pinSetup } });
                                    setTenantUsers(users || []);
                                  } catch (err: any) {
                                    toast.error(err.response?.data?.message || 'Erro ao excluir usuário.');
                                  }
                                }}
                                className="p-1.5 text-muted hover:text-brand hover:bg-support rounded-lg border border-line transition"
                                title="Excluir usuário"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Raio-X Operacional */}
                {editTab === 'xray' && (
                  <TenantXrayPanel
                    tenant={editingTenant}
                    pin={pinDigits.join('')}
                  />
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-line bg-page/50 flex justify-end gap-3">
                <button onClick={() => setStep("list")} className="px-5 py-2.5 rounded-xl font-medium text-muted hover:text-ink transition">Voltar</button>
                <button onClick={handleSaveEdit} disabled={editLoading} className="bg-brand hover:bg-brand-hover text-on-brand px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition">
                  {editLoading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* — SUCCESS STEP — */}
        {step === "success" && successData && (
          <div className="max-w-lg mx-auto mt-14 animate-[fadeIn_0.5s_ease]">
            <div className="p-8 rounded-3xl bg-page/70 backdrop-blur-xl border border-line shadow-2xl space-y-5">
              <div className="text-center">
                {successData.tenant?.logoUrl ? (
                  <div className="w-16 h-16 rounded-full bg-support border-2 border-brand mx-auto mb-3 overflow-hidden flex items-center justify-center">
                    <img src={getFullUrl(successData.tenant.logoUrl)} alt={successData.tenant.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <CheckCircle2 size={52} className="text-brand mx-auto mb-3" />
                )}
                <h1 className="text-2xl font-bold text-ink">Loja Provisionada com Sucesso!</h1>
                <p className="text-muted text-sm mt-1">{successData.tenant?.name} já está pronta para operar.</p>
              </div>

              <div className="bg-surface border border-line rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Empresa:</span>
                  <span className="font-bold text-ink">{successData.tenant?.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Banco PostgreSQL:</span>
                  <span className="font-mono font-bold text-brand">{successData.tenant?.databaseName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Login Admin:</span>
                  <span className="font-mono font-bold text-ink">{successData.admin?.email || successData.tenant?.admin?.email}</span>
                </div>
                {successData.plainPassword && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">Senha Inicial:</span>
                    <span className="font-mono font-bold text-ink">{successData.plainPassword}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? window.location.origin : '';
                    const adminEmailResolved = successData.admin?.email || successData.tenant?.admin?.email;
                    const msg = [
                      `*Acesso PDV Lojista — ${successData.tenant?.name}*`,
                      `Painel: ${url}/login`,
                      `Login: ${adminEmailResolved}`,
                      successData.plainPassword ? `Senha: ${successData.plainPassword}` : null,
                      `PIN Inicial do Caixa: 1234`,
                    ].filter(Boolean).join('\n');
                    navigator.clipboard.writeText(msg);
                    toast.success('Credenciais formatadas copiadas para enviar no WhatsApp!');
                  }}
                  className="w-full bg-support hover:bg-brand text-brand hover:text-on-brand border border-brand font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                >
                  <Copy size={16} /> Copiar Credenciais para WhatsApp
                </button>

                {successData.tenant?.id && (
                  <button
                    type="button"
                    onClick={() => handleImpersonate(successData.tenant)}
                    className="w-full bg-brand hover:bg-brand-hover text-on-brand font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                  >
                    <LogIn size={16} /> Entrar no Painel da Loja Agora (1-Clique)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setStep("list"); loadTenants(); }}
                  className="w-full bg-surface hover:bg-support text-ink border border-line font-bold py-3 rounded-xl transition text-sm"
                >
                  Voltar para a Lista de Tenants
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL MIGRAÇÃO */}
        {migrationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
            <div className="bg-page/90 border border-line rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-line flex justify-between items-center bg-page">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-brand"><Database size={20} /> Migração de Bancos de Dados</h2>
                  <p className="text-xs text-muted mt-1">
                    {includeHeart
                      ? `Atualizando ${migrationResults.length} banco(s): Heart (master) + tenants selecionados`
                      : `Atualizando estrutura e schemas do Prisma nos ${migrationResults.length} tenant(s) selecionado(s)`
                    }
                  </p>
                </div>
                {!migrating && (
                  <button onClick={() => { setMigrationModalOpen(false); setMigrationResults([]); setActiveLogTenantId(null); }} className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-ink transition"><X size={20} /></button>
                )}
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {migrationResults.map((result) => {
                  const isActiveLog = activeLogTenantId === result.tenantId;
                  return (
                    <div key={result.tenantId} className={`border rounded-xl overflow-hidden transition ${
                      result.tenantId === '__heart__'
                        ? 'border-brand bg-support'
                        : 'border-line bg-page'
                    }`}>
                      <div onClick={() => result.output && setActiveLogTenantId(isActiveLog ? null : result.tenantId)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface transition">
                        <div className="flex items-center gap-3">
                          {result.status === 'processing' && <Loader2 className="animate-spin text-brand" size={18} />}
                          {result.status === 'success' && <CheckCircle2 className="text-brand" size={18} />}
                          {result.status === 'error' && <AlertCircle className="text-brand" size={18} />}
                          <div>
                            <p className="font-semibold text-sm text-muted">{result.name}</p>
                            <p className="text-xs text-muted">Banco: {result.databaseName || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${result.status === 'success' ? 'bg-support text-brand border-brand' : result.status === 'error' ? 'bg-support text-brand border-brand' : 'bg-surface text-muted border-line'}`}>
                            {result.status === 'success' ? 'Sucesso' : result.status === 'error' ? 'Falhou' : 'Processando...'}
                          </span>
                          {result.output && <span className="text-muted">{isActiveLog ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>}
                        </div>
                      </div>
                      {isActiveLog && result.output && (
                        <div className="px-4 pb-4 border-t border-line bg-page">
                          <div className="flex items-center gap-2 py-2 text-xs font-mono text-muted border-b border-line mb-2"><Terminal size={12} /><span>Console Log</span></div>
                          <pre className="text-xs font-mono text-muted whitespace-pre-wrap max-h-60 overflow-y-auto p-3 rounded-lg bg-page/50 border border-line custom-scrollbar">{result.output}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-6 border-t border-line bg-page/50 flex justify-end">
                <button disabled={migrating} onClick={() => { setMigrationModalOpen(false); setMigrationResults([]); setActiveLogTenantId(null); }} className="bg-surface hover:bg-support disabled:opacity-50 text-ink px-5 py-2.5 rounded-xl font-bold transition">
                  {migrating ? 'Migrando bancos...' : 'Fechar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CRIAR GRUPO */}
        {isCreateGroupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
            <div className="bg-page/90 border border-line rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-line flex justify-between items-center bg-page">
                <h2 className="text-xl font-bold flex items-center gap-2 text-brand">Novo Grupo</h2>
                <button onClick={() => setIsCreateGroupOpen(false)} className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-ink transition"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-muted uppercase">Nome do Grupo</label>
                  <input required value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full p-3 bg-page border border-line rounded-xl mt-1 text-ink focus:border-brand outline-none" placeholder="Ex: Rede XYZ" />
                </div>
                <button type="submit" disabled={creatingGroup} className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-on-brand font-bold py-3 rounded-xl transition mt-4 hover:text-on-brand">
                  {creatingGroup ? <Loader2 className="animate-spin mx-auto" /> : "Criar Grupo"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL GERENCIAR GRUPO */}
        {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
            <div className="bg-page/90 border border-line rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-line flex justify-between items-center bg-page">
                <h2 className="text-xl font-bold flex items-center gap-2 text-brand">Gerenciar Grupo: {selectedGroup.name}</h2>
                <button onClick={() => { setSelectedGroup(null); loadGroups(); }} className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-ink transition"><X size={20} /></button>
              </div>
              <div className="px-6 pt-5">
                <div className="bg-support border border-brand/25 rounded-2xl p-4 text-xs text-ink">
                  <strong className="text-brand">Login único ativo:</strong> Ao vincular uma loja (Tenant) como membro deste grupo, o próprio login <strong>admin</strong> de cada loja passa a exibir automaticamente o módulo <strong>Rede Multi-Lojas</strong> e o seletor rápido de unidades no topo do sistema (sem precisar criar um usuário separado).
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-muted border-b border-line pb-2">Membros (Tenants)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {selectedGroup.members?.map((m: any) => (
                      <div key={m.id} className="bg-page border border-line rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-muted text-sm">{m.tenant?.name || m.tenant?.nomeFantasia}</p>
                          {m.alias && <p className="text-xs text-muted">Alias: {m.alias}</p>}
                        </div>
                      </div>
                    ))}
                    {(!selectedGroup.members || selectedGroup.members.length === 0) && <p className="text-muted text-sm italic">Nenhum membro neste grupo.</p>}
                  </div>
                  <form onSubmit={handleAddGroupMember} className="bg-page/50 p-4 border border-line rounded-xl space-y-3 mt-4">
                    <h4 className="text-sm font-bold text-muted">Adicionar Membro</h4>
                    <select required value={newMemberTenantId} onChange={e => setNewMemberTenantId(e.target.value)} className="w-full p-2.5 bg-page border border-line rounded-lg text-ink text-sm focus:border-brand outline-none">
                      <option value="">Selecione um Tenant...</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name || t.nomeFantasia}</option>)}
                    </select>
                    <input type="text" value={newMemberAlias} onChange={e => setNewMemberAlias(e.target.value)} placeholder="Alias (Opcional, ex: Loja Matriz)" className="w-full p-2.5 bg-page border border-line rounded-lg text-ink text-sm focus:border-brand outline-none" />
                    <button type="submit" disabled={addingMember} className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-on-brand text-sm font-bold py-2.5 rounded-lg transition hover:text-on-brand">
                      {addingMember ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Adicionar"}
                    </button>
                  </form>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-muted border-b border-line pb-2">Usuários Proprietários</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {loadingGroupUsers ? (
                      <div className="text-center py-4 text-muted"><Loader2 className="animate-spin inline-block mx-auto" size={18} /></div>
                    ) : groupUsers.length === 0 ? (
                      <p className="text-muted text-sm italic">Nenhum usuário proprietário.</p>
                    ) : (
                      groupUsers.map((u: any) => (
                        <div key={u.id} className="bg-page border border-line rounded-xl p-3 flex justify-between items-center">
                          <div><p className="font-semibold text-muted text-sm">{u.name}</p><p className="text-xs text-muted">{u.email}</p></div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleAddGroupUser} autoComplete="off" className="bg-page/50 p-4 border border-line rounded-xl space-y-3 mt-4">
                    <h4 className="text-sm font-bold text-muted">Novo Usuário do Grupo</h4>
                    <input required type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nome" className="w-full p-2.5 bg-page border border-line rounded-lg text-ink text-sm focus:border-brand outline-none" />
                    <input required type="email" autoComplete="off" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email" className="w-full p-2.5 bg-page border border-line rounded-lg text-ink text-sm focus:border-brand outline-none" />
                    <input required type="text" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Senha" className="pdv-secret-input w-full p-2.5 bg-page border border-line rounded-lg text-ink text-sm focus:border-brand outline-none" />
                    <button type="submit" disabled={addingUser} className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-on-brand text-sm font-bold py-2.5 rounded-lg transition hover:text-on-brand">
                      {addingUser ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Criar Usuário"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
