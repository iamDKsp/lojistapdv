import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export function retailLabel(
  value: unknown,
  field: string,
  max: number,
  optional = false,
): string {
  if (value == null && optional) return '';
  if (typeof value !== 'string')
    throw new BadRequestException(`${field} inválido.`);
  const result = value.trim().replace(/\s+/g, ' ');
  if ((!optional && !result) || result.length > max)
    throw new BadRequestException(`${field} inválido.`);
  return result;
}

export function retailNumber(
  value: unknown,
  field: string,
  integer = false,
): number {
  if (
    value == null ||
    value === '' ||
    !['string', 'number'].includes(typeof value)
  )
    throw new BadRequestException(`${field} inválido.`);
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 9999999 ||
    (integer && !Number.isInteger(number))
  )
    throw new BadRequestException(`${field} inválido.`);
  return number;
}

export function variantIdentity(size: string, color: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [size, color].map((value) =>
          value.normalize('NFKC').toLocaleUpperCase('pt-BR'),
        ),
      ),
    )
    .digest('hex');
}

/** Tamanhos são dimensões da grade; a unidade comercial permanece UN. */
export function assertRetailProduct(data: any) {
  if (
    data.requiresKitchen ||
    data.requiresBar ||
    data.requiresCarvoaria ||
    data.isComposite ||
    data.volumeUnit ||
    data.volumeCapacity != null ||
    data.serviceTimerMinutes != null ||
    data.assetTrackingTotal != null ||
    data.preparationIngredients ||
    data.modifierGroups?.length
  ) {
    throw new BadRequestException(
      'Preparo, bebidas e composição de ingredientes não fazem parte do PDV Lojista.',
    );
  }
  if (data.unit && !['UN', 'PAR', 'CX', 'PCT', 'KIT'].includes(data.unit))
    throw new BadRequestException(
      'Use uma unidade de loja: UN, PAR, CX, PCT ou KIT. Tamanho e cor pertencem à grade.',
    );
}

/** Rateia em centavos, sem criar crédito sobre acréscimos nem perder o desconto. */
export function allocateReturnCents(
  items: { id: string; subtotal: unknown }[],
  saleTotal: unknown,
): Map<string, number> {
  const rows = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const bases = rows.map((item) => Math.round(Number(item.subtotal) * 100));
  const sum = bases.reduce((a, b) => a + b, 0);
  const cap = Math.min(sum, Math.round(Number(saleTotal) * 100));
  if (
    !Number.isSafeInteger(sum) ||
    !Number.isSafeInteger(cap) ||
    cap <= 0 ||
    bases.some((n) => n < 0)
  )
    throw new BadRequestException('Venda sem valor elegível para troca.');
  const allocations = rows.map((item, index) => {
    const product = BigInt(cap) * BigInt(bases[index]);
    return {
      id: item.id,
      value: Number(product / BigInt(sum)),
      fraction: Number(product % BigInt(sum)),
      base: bases[index],
    };
  });
  const remainder =
    cap - allocations.reduce((total, item) => total + item.value, 0);
  const eligible = allocations
    .filter((item) => item.base > 0)
    .sort((a, b) => b.fraction - a.fraction || b.id.localeCompare(a.id));
  for (let index = 0; index < remainder; index++) eligible[index].value++;
  return new Map(allocations.map((item) => [item.id, item.value]));
}

export function partialReturnCents(
  lineCents: number,
  sold: number,
  previousQty: number,
  requested: number,
): number {
  if (
    ![sold, previousQty, requested].every(Number.isInteger) ||
    sold <= 0 ||
    previousQty < 0 ||
    requested <= 0 ||
    previousQty + requested > sold
  )
    throw new BadRequestException(
      'Quantidade de troca excede o saldo da venda.',
    );
  if (!Number.isSafeInteger(lineCents) || lineCents < 0)
    throw new BadRequestException('Valor de troca inválido.');
  return Number(
    (BigInt(lineCents) * BigInt(previousQty + requested)) / BigInt(sold) -
      (BigInt(lineCents) * BigInt(previousQty)) / BigInt(sold),
  );
}
