import { CalendarDays, ChevronLeft, ChevronRight, DollarSign, Edit, AlertTriangle, CheckSquare, Square, LogIn } from 'lucide-react';

type Tenant = any;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCurrency(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dueTone(tenant: Tenant, now: Date) {
  const due = tenant.mensalidadeVencimento ? new Date(tenant.mensalidadeVencimento) : null;
  if (!due || tenant.status !== 'active') return 'border-line bg-page text-muted';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay < today) return 'border-brand bg-support text-brand';
  if (dueDay.getTime() === today.getTime()) return 'border-brand bg-support text-brand';
  return 'border-brand bg-support text-brand';
}

export function TenantBillingCalendar({
  tenants, month, onMonthChange, selectedIds, onToggleTenant, onEdit, onRegisterPayment, onImpersonate,
}: {
  tenants: Tenant[];
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedIds: string[];
  onToggleTenant: (tenantId: string, selected: boolean) => void;
  onEdit: (tenant: Tenant) => void;
  onRegisterPayment: (tenantId: string) => void;
  onImpersonate?: (tenant: Tenant) => void;
}) {
  const current = startOfMonth(month);
  const today = new Date();
  const firstWeekday = current.getDay();
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1);
  const byDay = new Map<string, Tenant[]>();
  const withoutDate: Tenant[] = [];
  const overdue: Tenant[] = [];

  for (const tenant of tenants) {
    const key = dateKey(tenant.mensalidadeVencimento);
    if (!key) { withoutDate.push(tenant); continue; }
    const due = new Date(tenant.mensalidadeVencimento);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (tenant.status === 'active' && dueDay < todayDay) overdue.push(tenant);
    const items = byDay.get(key) || [];
    items.push(tenant);
    byDay.set(key, items);
  }

  const monthLabel = current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const isToday = (day: number) => day === today.getDate() && current.getMonth() === today.getMonth() && current.getFullYear() === today.getFullYear();
  const changeMonth = (delta: number) => onMonthChange(new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-line bg-page/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-support p-2.5 text-brand"><CalendarDays size={20} /></div>
          <div><h2 className="font-bold capitalize">{monthLabel}</h2><p className="text-xs text-muted">Vencimentos das mensalidades</p></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Mês anterior"><ChevronLeft size={19} /></button>
          <button type="button" onClick={() => onMonthChange(startOfMonth(new Date()))} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted hover:bg-surface">Hoje</button>
          <button type="button" onClick={() => changeMonth(1)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Próximo mês"><ChevronRight size={19} /></button>
        </div>
      </header>
      <div className="overflow-x-auto">
      <div className="min-w-[700px]">
      <div className="grid grid-cols-7 border-b border-line bg-page text-center text-xs font-semibold text-muted">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <span className="py-3" key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const active = day > 0 && day <= daysInMonth;
          const key = active ? `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const items = byDay.get(key) || [];
          return <div key={index} className={`min-h-28 border-b border-r border-line p-2 ${active ? 'bg-page' : 'bg-page'} ${isToday(day) ? 'ring-1 ring-inset ring-brand bg-support' : ''}`}>
            {active && <p className={`mb-1 ml-1 text-xs font-bold ${isToday(day) ? 'text-brand' : 'text-muted'}`}>{day}</p>}
            <div className="space-y-1 overflow-y-auto pr-0.5">
              {items.map(tenant => <div key={tenant.id} className={`group rounded-lg border p-1.5 ${dueTone(tenant, today)}`}>
                <div className="flex items-start gap-1">
                  <button type="button" aria-label={`Selecionar ${tenant.name || tenant.nomeFantasia}`} aria-pressed={selectedIds.includes(tenant.id)} onClick={() => onToggleTenant(tenant.id, !selectedIds.includes(tenant.id))} className="mt-0.5 shrink-0" title="Selecionar para ações em lote">
                    {selectedIds.includes(tenant.id) ? <CheckSquare size={13} className="text-brand" /> : <Square size={13} className="text-muted" />}
                  </button>
                  <button type="button" onClick={() => onEdit(tenant)} className="min-w-0 flex-1 text-left" title="Abrir cadastro do cliente">
                    <p className="break-words text-xs font-semibold leading-snug">{tenant.name || tenant.nomeFantasia}</p>
                    <p className="mt-1 text-[11px] tabular-nums opacity-75">{formatCurrency(tenant.mensalidadeValor)}</p>
                  </button>
                  {onImpersonate && <button type="button" onClick={() => onImpersonate(tenant)} className="rounded p-1 text-brand hover:bg-support" title="Acessar painel da loja"><LogIn size={13} /></button>}
                  <button type="button" onClick={() => onRegisterPayment(tenant.id)} className="rounded p-1 text-brand hover:bg-support" title="Registrar pagamento"><DollarSign size={13} /></button>
                </div>
              </div>)}
            </div>
          </div>;
        })}
      </div>
      </div>
      </div>
      <div className="flex flex-wrap gap-4 px-4 py-3 text-xs text-muted"><span className="text-brand">● Em atraso</span><span className="text-brand">● Vence hoje</span><span className="text-brand">● Próximo vencimento</span><span>● Cliente não ativo</span></div>
    </section>

    <aside className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-brand bg-support p-4">
        <div className="mb-3 flex items-center gap-2 text-brand"><AlertTriangle size={17} /><h3 className="font-bold">Em atraso ({overdue.length})</h3></div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {overdue.map(tenant => <div key={tenant.id} className="flex items-center justify-between gap-2 rounded-xl bg-page/45 p-3">
            <button type="button" onClick={() => onEdit(tenant)} className="min-w-0 text-left"><p className="truncate text-xs font-bold text-muted">{tenant.name || tenant.nomeFantasia}</p><p className="text-[10px] text-brand">{new Date(tenant.mensalidadeVencimento).toLocaleDateString('pt-BR')}</p></button>
            <button type="button" onClick={() => onRegisterPayment(tenant.id)} className="rounded-lg p-2 text-brand hover:bg-support" title="Registrar pagamento"><DollarSign size={15} /></button>
          </div>)}
          {!overdue.length && <p className="text-xs text-muted">Nenhuma mensalidade em atraso.</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-page/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-muted"><Edit size={16} /><h3 className="font-bold">Sem vencimento ({withoutDate.length})</h3></div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {withoutDate.map(tenant => <button key={tenant.id} type="button" onClick={() => onEdit(tenant)} className="block w-full rounded-xl bg-page/50 p-3 text-left hover:bg-surface"><p className="truncate text-xs font-bold text-muted">{tenant.name || tenant.nomeFantasia}</p><p className="text-[10px] text-muted">Definir data de cobrança</p></button>)}
          {!withoutDate.length && <p className="text-xs text-muted">Todos os clientes possuem vencimento.</p>}
        </div>
      </section>
    </aside>
  </div>;
}
