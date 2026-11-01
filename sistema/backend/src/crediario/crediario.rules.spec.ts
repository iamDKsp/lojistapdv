import { BadRequestException } from '@nestjs/common';
import {
  splitInstallmentsInCents,
  allocateCustomerPaymentFIFO,
  renderBillingTemplate,
  normalizeBrazilWhatsappPhone,
  evaluateReceivableBillingTrigger,
} from './crediario.rules';

describe('CrediarioRules', () => {
  describe('splitInstallmentsInCents', () => {
    it('distributes remainder cents into the first installment without rounding loss', () => {
      const plan = splitInstallmentsInCents(100, 3, '2026-11-15');
      expect(plan).toHaveLength(3);
      expect(plan[0].amount).toBe(33.34);
      expect(plan[1].amount).toBe(33.33);
      expect(plan[2].amount).toBe(33.33);
      expect(plan.map((p) => p.dueDateIso)).toEqual([
        '2026-11-15',
        '2026-12-15',
        '2027-01-15',
      ]);
    });

    it('clamps end-of-month dates safely across shorter months', () => {
      const plan = splitInstallmentsInCents(300, 3, '2026-01-31');
      expect(plan.map((p) => p.dueDateIso)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
      ]);
    });

    it('rejects non-positive amounts or invalid installment counts', () => {
      expect(() => splitInstallmentsInCents(0, 1, '2026-11-15')).toThrow(
        BadRequestException,
      );
      expect(() => splitInstallmentsInCents(100, 0, '2026-11-15')).toThrow(
        BadRequestException,
      );
      expect(() => splitInstallmentsInCents(100, 25, '2026-11-15')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('allocateCustomerPaymentFIFO', () => {
    const sampleReceivables = [
      {
        id: 'rec-2',
        remainingAmount: 50,
        paidAmount: 0,
        dueDate: '2026-12-10T15:00:00Z',
        installmentNumber: 2,
      },
      {
        id: 'rec-1',
        remainingAmount: 50,
        paidAmount: 0,
        dueDate: '2026-11-10T15:00:00Z',
        installmentNumber: 1,
      },
    ];

    it('allocates partial and full payments starting from the oldest due date', () => {
      const result = allocateCustomerPaymentFIFO(sampleReceivables, 70);
      expect(result.totalAllocated).toBe(70);
      expect(result.unallocatedAmount).toBe(0);
      expect(result.allocations).toEqual([
        {
          receivableId: 'rec-1',
          allocatedAmount: 50,
          newPaidAmount: 50,
          newRemainingAmount: 0,
          newStatus: 'PAID',
        },
        {
          receivableId: 'rec-2',
          allocatedAmount: 20,
          newPaidAmount: 20,
          newRemainingAmount: 30,
          newStatus: 'PARTIAL',
        },
      ]);
    });

    it('rejects payments exceeding total open debt', () => {
      expect(() =>
        allocateCustomerPaymentFIFO(sampleReceivables, 100.01),
      ).toThrow(BadRequestException);
    });
  });

  describe('renderBillingTemplate', () => {
    it('replaces all billing placeholders with formatted values', () => {
      const msg = renderBillingTemplate(
        'Olá {cliente} da {loja}: parcela {parcela} de {valor} vence em {vencimento}. Saldo: {saldo_devedor}. PIX: {pix} ({beneficiario_pix})',
        {
          cliente: 'Maria Silva',
          loja: 'Boutique Roxo',
          valor: 89.9,
          vencimento: '2026-11-20',
          parcela: '1/2',
          saldo_devedor: 179.8,
          pix: '12.345.678/0001-99',
          beneficiario_pix: 'Boutique Roxo LTDA',
        },
      );
      expect(msg).toContain('Maria Silva');
      expect(msg).toContain('Boutique Roxo');
      expect(msg).toContain('1/2');
      expect(msg).toContain('20/11/2026');
      expect(msg).toContain('12.345.678/0001-99');
    });
  });

  describe('normalizeBrazilWhatsappPhone', () => {
    it('normalizes 11-digit Brazilian mobile numbers and creates 9-digit/8-digit candidates', () => {
      const res = normalizeBrazilWhatsappPhone('(14) 99876-5432');
      expect(res.digits).toBe('5514998765432');
      expect(res.candidateJids).toEqual([
        '5514998765432@s.whatsapp.net',
        '551498765432@s.whatsapp.net',
      ]);
    });
  });

  describe('evaluateReceivableBillingTrigger', () => {
    const baseSettings = {
      sendBeforeDue: true,
      daysBeforeDue: 3,
      sendOnDueDate: true,
      sendOverdue: true,
      overdueIntervalDays: 3,
      maxOverdueReminders: 5,
    };

    it('triggers BEFORE_DUE when daysBeforeDue matches', () => {
      expect(
        evaluateReceivableBillingTrigger({
          dueDate: '2026-11-10',
          status: 'OPEN',
          remainingAmount: 50,
          reminderCount: 0,
          todayIso: '2026-11-07',
          settings: baseSettings,
        }),
      ).toBe('BEFORE_DUE');
    });

    it('triggers ON_DUE_DATE on the exact due date', () => {
      expect(
        evaluateReceivableBillingTrigger({
          dueDate: '2026-11-10',
          status: 'OPEN',
          remainingAmount: 50,
          reminderCount: 0,
          todayIso: '2026-11-10',
          settings: baseSettings,
        }),
      ).toBe('ON_DUE_DATE');
    });

    it('triggers OVERDUE respecting overdueIntervalDays and maxOverdueReminders', () => {
      expect(
        evaluateReceivableBillingTrigger({
          dueDate: '2026-11-01',
          status: 'PARTIAL',
          remainingAmount: 25,
          lastReminderAt: '2026-11-02T12:00:00Z',
          reminderCount: 1,
          todayIso: '2026-11-04',
          settings: baseSettings,
        }),
      ).toBeNull();

      expect(
        evaluateReceivableBillingTrigger({
          dueDate: '2026-11-01',
          status: 'PARTIAL',
          remainingAmount: 25,
          lastReminderAt: '2026-11-02T12:00:00Z',
          reminderCount: 1,
          todayIso: '2026-11-05',
          settings: baseSettings,
        }),
      ).toBe('OVERDUE');

      expect(
        evaluateReceivableBillingTrigger({
          dueDate: '2026-11-01',
          status: 'PARTIAL',
          remainingAmount: 25,
          lastReminderAt: '2026-11-02T12:00:00Z',
          reminderCount: 5,
          todayIso: '2026-11-10',
          settings: baseSettings,
        }),
      ).toBeNull();
    });
  });
});
