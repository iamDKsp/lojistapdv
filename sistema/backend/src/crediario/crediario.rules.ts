import { BadRequestException } from '@nestjs/common';

export const DEFAULT_CREDIARIO_TEMPLATES = {
  templateOnSale:
    'Olá, *{cliente}*! Confirmamos sua compra no crediário na *{loja}* no valor de *{valor}* ({parcela}). Próximo vencimento: *{vencimento}*. Qualquer dúvida, estamos à disposição!',
  templateBeforeDue:
    'Olá, *{cliente}*! Lembrete amigável da *{loja}*: sua parcela ({parcela}) no valor de *{valor}* vence em *{vencimento}*. Chave PIX para pagamento: *{pix}* ({beneficiario_pix}).',
  templateOnDueDate:
    'Olá, *{cliente}*! Hoje (*{vencimento}*) é o vencimento da sua parcela ({parcela}) de *{valor}* na *{loja}*. Você pode pagar na loja ou via PIX: *{pix}* ({beneficiario_pix}).',
  templateOverdue:
    'Olá, *{cliente}*! Identificamos que a parcela ({parcela}) de *{valor}* na *{loja}*, vencida em *{vencimento}*, encontra-se em aberto (Saldo total: *{saldo_devedor}*). Para regularizar via PIX utilize a chave: *{pix}* ({beneficiario_pix}). Caso já tenha efetuado o pagamento, desconsidere.',
  templateOnPayment:
    'Olá, *{cliente}*! Recebemos seu pagamento de *{valor}* na *{loja}*. Seu saldo atualizado em aberto é de *{saldo_devedor}*. Muito obrigado pela preferência!',
};

export interface InstallmentPlanItem {
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: Date;
  dueDateIso: string;
}

export function toCents(value: number | string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function parseLocalIsoDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestException('Data de vencimento inválida. Use o formato AAAA-MM-DD.');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 15, 0, 0));
  if (
    !Number.isFinite(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new BadRequestException('Data de vencimento inexistente no calendário.');
  }
  return dt;
}

export function addMonthsUtcSafe(baseDate: Date, monthsToAdd: number): Date {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const originalDay = baseDate.getUTCDate();

  const targetMonthIndex = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, normalizedMonth, clampedDay, 15, 0, 0));
}

/**
 * Divide um valor total em 1..N parcelas em centavos sem resíduos de arredondamento.
 * O eventual resíduo de centavos fica concentrado na 1ª parcela.
 */
export function splitInstallmentsInCents(
  totalAmount: number | string,
  installmentsCount = 1,
  firstDueDateStr?: string,
  defaultDueDays = 30,
): InstallmentPlanItem[] {
  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) {
    throw new BadRequestException('O valor do crediário deve ser maior que zero.');
  }
  const count = Number(installmentsCount || 1);
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    throw new BadRequestException('O número de parcelas deve ser entre 1 e 24.');
  }

  let firstDate: Date;
  if (firstDueDateStr) {
    firstDate = parseLocalIsoDate(firstDueDateStr.slice(0, 10));
  } else {
    const now = new Date();
    const target = new Date(now.getTime() + Math.max(1, defaultDueDays) * 86400000);
    const iso = target.toISOString().slice(0, 10);
    firstDate = parseLocalIsoDate(iso);
  }

  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  if (baseCents <= 0) {
    throw new BadRequestException('Valor total muito baixo para a quantidade de parcelas informada.');
  }

  const items: InstallmentPlanItem[] = [];
  for (let i = 0; i < count; i++) {
    const itemCents = i === 0 ? baseCents + remainderCents : baseCents;
    const dueDate = i === 0 ? firstDate : addMonthsUtcSafe(firstDate, i);
    items.push({
      installmentNumber: i + 1,
      totalInstallments: count,
      amount: fromCents(itemCents),
      dueDate,
      dueDateIso: dueDate.toISOString().slice(0, 10),
    });
  }

  return items;
}

export interface ReceivableAllocationCandidate {
  id: string;
  remainingAmount: number | string;
  paidAmount: number | string;
  dueDate: Date | string;
  installmentNumber?: number;
}

export interface ReceivableAllocationResult {
  receivableId: string;
  allocatedAmount: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  newStatus: 'PAID' | 'PARTIAL';
}

/**
 * Aloca um pagamento/amortização nas parcelas em aberto do cliente na ordem FIFO
 * (vencimento mais antigo primeiro, menor número de parcela em caso de empate).
 */
export function allocateCustomerPaymentFIFO(
  receivables: ReceivableAllocationCandidate[],
  paymentAmount: number | string,
): {
  allocations: ReceivableAllocationResult[];
  totalAllocated: number;
  unallocatedAmount: number;
} {
  const paymentCents = toCents(paymentAmount);
  if (paymentCents <= 0) {
    throw new BadRequestException('Informe um valor de pagamento maior que zero.');
  }

  const openRows = [...receivables]
    .filter((r) => toCents(r.remainingAmount) > 0)
    .sort((a, b) => {
      const da = new Date(a.dueDate).getTime();
      const db = new Date(b.dueDate).getTime();
      if (da !== db) return da - db;
      const ia = a.installmentNumber ?? 1;
      const ib = b.installmentNumber ?? 1;
      if (ia !== ib) return ia - ib;
      return a.id.localeCompare(b.id);
    });

  if (openRows.length === 0) {
    throw new BadRequestException('Este cliente não possui parcelas em aberto para abater.');
  }

  const totalOpenCents = openRows.reduce((sum, r) => sum + toCents(r.remainingAmount), 0);
  if (paymentCents > totalOpenCents) {
    throw new BadRequestException(
      `O valor informado (R$ ${fromCents(paymentCents).toFixed(2)}) excede o saldo devedor em aberto (R$ ${fromCents(totalOpenCents).toFixed(2)}).`,
    );
  }

  let availableCents = paymentCents;
  const allocations: ReceivableAllocationResult[] = [];

  for (const row of openRows) {
    if (availableCents <= 0) break;
    const remCents = toCents(row.remainingAmount);
    const paidCents = toCents(row.paidAmount);
    const takeCents = Math.min(availableCents, remCents);
    if (takeCents <= 0) continue;

    const nextRemCents = remCents - takeCents;
    const nextPaidCents = paidCents + takeCents;

    allocations.push({
      receivableId: row.id,
      allocatedAmount: fromCents(takeCents),
      newPaidAmount: fromCents(nextPaidCents),
      newRemainingAmount: fromCents(nextRemCents),
      newStatus: nextRemCents === 0 ? 'PAID' : 'PARTIAL',
    });

    availableCents -= takeCents;
  }

  return {
    allocations,
    totalAllocated: fromCents(paymentCents - availableCents),
    unallocatedAmount: fromCents(availableCents),
  };
}

export function formatMoneyPtBr(value: number | string): string {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function formatDatePtBr(dateInput: Date | string): string {
  if (!dateInput) return '';
  const iso =
    typeof dateInput === 'string'
      ? dateInput.slice(0, 10)
      : dateInput.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return String(dateInput);
  return `${d}/${m}/${y}`;
}

export function renderBillingTemplate(
  template: string,
  vars: {
    cliente?: string;
    loja?: string;
    valor?: number | string;
    vencimento?: Date | string;
    parcela?: string;
    saldo_devedor?: number | string;
    pix?: string | null;
    beneficiario_pix?: string | null;
    itens?: string;
  },
): string {
  const valorFmt =
    vars.valor !== undefined ? formatMoneyPtBr(vars.valor) : 'R$ 0,00';
  const saldoFmt =
    vars.saldo_devedor !== undefined
      ? formatMoneyPtBr(vars.saldo_devedor)
      : valorFmt;
  const vencFmt = vars.vencimento ? formatDatePtBr(vars.vencimento) : '—';
  const pixKey = vars.pix?.trim() || 'Consulte a loja';
  const pixBen = vars.beneficiario_pix?.trim() || vars.loja || 'Loja';

  return String(template || '')
    .replace(/\{cliente\}/gi, vars.cliente || 'Cliente')
    .replace(/\{loja\}/gi, vars.loja || 'Nossa Loja')
    .replace(/\{valor\}/gi, valorFmt)
    .replace(/\{vencimento\}/gi, vencFmt)
    .replace(/\{parcela\}/gi, vars.parcela || '1/1')
    .replace(/\{saldo_devedor\}/gi, saldoFmt)
    .replace(/\{pix\}/gi, pixKey)
    .replace(/\{beneficiario_pix\}/gi, pixBen)
    .replace(/\{itens\}/gi, vars.itens || '');
}

/**
 * Normaliza um número de telefone brasileiro para disparo no WhatsApp (Baileys).
 * Retorna o número canônico com DDI 55 e candidatos JID (com e sem o 9º dígito).
 */
export function normalizeBrazilWhatsappPhone(rawPhone: string): {
  digits: string;
  primaryJid: string;
  candidateJids: string[];
} {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (digits.length < 12 || digits.length > 15) {
    throw new BadRequestException(
      'Telefone do cliente inválido para WhatsApp. Informe DDD + número (ex: 11999998888).',
    );
  }

  const candidateJids: string[] = [`${digits}@s.whatsapp.net`];
  if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
    const withoutNine = digits.slice(0, 4) + digits.slice(5);
    candidateJids.push(`${withoutNine}@s.whatsapp.net`);
  } else if (digits.startsWith('55') && digits.length === 12) {
    const withNine = `${digits.slice(0, 4)}9${digits.slice(4)}`;
    candidateJids.push(`${withNine}@s.whatsapp.net`);
  }

  return {
    digits,
    primaryJid: candidateJids[0],
    candidateJids,
  };
}

export function diffDaysIso(dateA: string, dateB: string): number {
  const a = Date.parse(`${dateA.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${dateB.slice(0, 10)}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

/**
 * Avalia se uma parcela deve receber disparo automático na data de referência `todayIso` (YYYY-MM-DD).
 * Retorna o tipo de gatilho ou null caso nenhum disparo seja devido hoje.
 */
export function evaluateReceivableBillingTrigger(params: {
  dueDate: Date | string;
  status: string;
  remainingAmount: number | string;
  lastReminderAt?: Date | string | null;
  reminderCount: number;
  todayIso: string;
  settings: {
    sendBeforeDue: boolean;
    daysBeforeDue: number;
    sendOnDueDate: boolean;
    sendOverdue: boolean;
    overdueIntervalDays: number;
    maxOverdueReminders: number;
  };
}): 'BEFORE_DUE' | 'ON_DUE_DATE' | 'OVERDUE' | null {
  if (params.status !== 'OPEN' && params.status !== 'PARTIAL') return null;
  if (toCents(params.remainingAmount) <= 0) return null;

  const dueIso =
    typeof params.dueDate === 'string'
      ? params.dueDate.slice(0, 10)
      : params.dueDate.toISOString().slice(0, 10);
  const todayIso = params.todayIso.slice(0, 10);

  // daysUntilDue > 0 => ainda vai vencer; === 0 => vence hoje; < 0 => está atrasada
  const daysUntilDue = diffDaysIso(dueIso, todayIso);

  if (daysUntilDue > 0) {
    if (
      params.settings.sendBeforeDue &&
      daysUntilDue === Math.max(1, Number(params.settings.daysBeforeDue || 3))
    ) {
      return 'BEFORE_DUE';
    }
    return null;
  }

  if (daysUntilDue === 0) {
    if (params.settings.sendOnDueDate) {
      return 'ON_DUE_DATE';
    }
    return null;
  }

  // Parcela vencida (daysUntilDue < 0)
  const daysOverdue = Math.abs(daysUntilDue);
  if (!params.settings.sendOverdue) return null;

  const maxReminders = Math.max(1, Number(params.settings.maxOverdueReminders || 5));
  if (params.reminderCount >= maxReminders) return null;

  const interval = Math.max(1, Number(params.settings.overdueIntervalDays || 3));

  if (params.lastReminderAt) {
    const lastIso =
      typeof params.lastReminderAt === 'string'
        ? params.lastReminderAt.slice(0, 10)
        : params.lastReminderAt.toISOString().slice(0, 10);
    const daysSinceLastReminder = diffDaysIso(todayIso, lastIso);
    if (daysSinceLastReminder < interval) return null;
    return 'OVERDUE';
  }

  if (daysOverdue >= interval || daysOverdue === 1) {
    return 'OVERDUE';
  }

  return null;
}
