import {
  allocateReturnCents,
  assertRetailProduct,
  partialReturnCents,
  retailNumber,
  variantIdentity,
} from './retail.rules';

describe('regras de mercadorias e trocas', () => {
  it('identifica a mesma grade independentemente de caixa e formas Unicode', () => {
    expect(variantIdentity('M', 'Preta')).toBe(variantIdentity('m', 'preta'));
    expect(variantIdentity('Ｇ', 'Preta')).toBe(variantIdentity('G', 'Preta'));
  });
  it('não confunde delimitadores dentro de tamanhos e cores', () =>
    expect(variantIdentity('A|B', 'C')).not.toBe(variantIdentity('A', 'B|C')));
  it.each([NaN, Infinity, -1, null, '', true, {}])(
    'recusa quantidade inválida %s',
    (value) => expect(() => retailNumber(value, 'Quantidade', true)).toThrow(),
  );
  it('recusa peças fracionadas e aceita quantidade inteira', () => {
    expect(() => retailNumber(1.5, 'Quantidade', true)).toThrow();
    expect(retailNumber('12', 'Quantidade', true)).toBe(12);
  });
  it.each([
    { unit: 'ML' },
    { unit: 'LT' },
    { requiresKitchen: true },
    { requiresBar: true },
    { requiresCarvoaria: true },
    { isComposite: true },
    { volumeCapacity: 1000 },
  ])('recusa conceitos de adega %j', (value) =>
    expect(() => assertRetailProduct(value)).toThrow(),
  );
  it('aceita unidade comercial separada do tamanho', () =>
    expect(() =>
      assertRetailProduct({ unit: 'UN', size: 'GG' }),
    ).not.toThrow());
  it('rateia desconto sem criar nem perder centavos', () => {
    const result = allocateReturnCents(
      [
        { id: 'b', subtotal: 49.9 },
        { id: 'a', subtotal: 49.9 },
      ],
      89.81,
    );
    expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(8981);
    expect(result.get('a')).toBe(4490);
    expect(result.get('b')).toBe(4491);
  });
  it('não credita acréscimo pago além do valor das mercadorias', () =>
    expect(
      allocateReturnCents([{ id: 'a', subtotal: 100 }], 110).get('a'),
    ).toBe(10000));
  it('não entrega centavos de arredondamento a uma mercadoria gratuita', () => {
    const allocated = allocateReturnCents(
      [
        { id: 'a', subtotal: 0.01 },
        { id: 'b', subtotal: 0.01 },
        { id: 'z', subtotal: 0 },
      ],
      0.01,
    );
    expect(allocated.get('z')).toBe(0);
    expect([...allocated.values()].reduce((a, b) => a + b, 0)).toBe(1);
  });
  it('trocas parciais somam exatamente o valor da linha', () => {
    const values = [0, 1, 2].map((previous) =>
      partialReturnCents(10000, 3, previous, 1),
    );
    expect(values).toEqual([3333, 3333, 3334]);
  });
  it.each([
    [10000, 3, 2, 2],
    [10000, 3, 0, 0],
    [10000, 3, 0, 1.5],
    [10000, 0, 0, 1],
  ])('impede devolução inválida %j', (...values) =>
    expect(() =>
      partialReturnCents(...(values as [number, number, number, number])),
    ).toThrow(),
  );
});
