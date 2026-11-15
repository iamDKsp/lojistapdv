import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { formatCurrencyBrl, sanitizePlainText } from './storefront.rules';

export type ExpressVehicleType = 'MOTO' | 'CARRO';
export type ExpressDispatchStatus =
  | 'WAITING'
  | 'FOUND'
  | 'REQUESTED'
  | 'PICKED_UP'
  | 'DISPATCHED'
  | 'DELIVERED';

export interface ExpressDeliveryNeighborhoodOverride {
  id: string;
  neighborhood: string;
  fee: number;
  estimatedMinutes?: number | null;
}

export interface ExpressDeliveryApiIntegration {
  mode: 'HYBRID_PORTAL' | 'API_99_EMPRESAS';
  corporateAccountId: string | null;
  corporateToken: string | null;
  environment: 'sandbox' | 'production';
  autoRequestOnConfirm: boolean;
}

export interface ExpressDeliveryConfig {
  enabled: boolean;
  originZipCode: string;
  originStreet: string;
  originNumber: string;
  originNeighborhood: string;
  originCity: string;
  originState: string;
  originLat: number | null;
  originLng: number | null;
  pricingMode: 'DISTANCE_KM' | 'FIXED';
  baseFee: number;
  baseIncludedKm: number;
  feePerAdditionalKm: number;
  routeFactor: number;
  maxRadiusKm: number;
  fallbackFee: number;
  motoEnabled: boolean;
  carEnabled: boolean;
  carSurcharge: number;
  minOrderAmount: number;
  freeShippingAbove: number | null;
  estimatedPrepMinutes: number;
  neighborhoodOverrides: ExpressDeliveryNeighborhoodOverride[];
  apiIntegration: ExpressDeliveryApiIntegration;
}

export interface ResolvedZipInfo {
  zipCode: string;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  approximate: boolean;
}

export interface ExpressQuoteVehicleOption {
  vehicleType: ExpressVehicleType;
  label: string;
  description: string;
  fee: number;
  originalFee: number;
  freeShippingApplied: boolean;
  estimatedMinutes: number;
}

export interface ExpressDeliveryQuoteResult {
  available: boolean;
  provider: '99_ENTREGAS';
  reasonCode?: 'MODULE_DISABLED' | 'MIN_ORDER_NOT_REACHED' | 'OUT_OF_RADIUS' | 'INVALID_CEP';
  message?: string;
  originLabel: string;
  destination: {
    zipCode: string | null;
    street: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
  distanceKm: number | null;
  maxRadiusKm: number;
  minOrderAmount: number;
  remainingForMinOrder: number;
  freeShippingAbove: number | null;
  remainingForFreeShipping: number;
  freeShippingApplied: boolean;
  pricingSource: 'NEIGHBORHOOD_OVERRIDE' | 'DISTANCE_KM' | 'FIXED' | 'FALLBACK';
  selectedVehicle: ExpressVehicleType;
  selectedFee: number;
  estimatedMinutes: number;
  options: ExpressQuoteVehicleOption[];
}

export interface ExpressDispatchRecord {
  provider: '99_ENTREGAS';
  status: ExpressDispatchStatus;
  vehicleType: ExpressVehicleType;
  courierName: string | null;
  courierPhone: string | null;
  vehiclePlate: string | null;
  trackingUrl: string | null;
  externalOrderId: string | null;
  confirmationPin: string;
  notes: string | null;
  requestedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
}

// Centros geográficos aproximados por primeiro dígito de CEP no Brasil (fallback determinístico offline)
const CEP_REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  '0': { lat: -23.5505, lng: -46.6333 }, // Grande SP
  '1': { lat: -22.9056, lng: -47.0608 }, // Interior SP
  '2': { lat: -22.9068, lng: -43.1729 }, // RJ / ES
  '3': { lat: -19.9167, lng: -43.9345 }, // MG
  '4': { lat: -12.9714, lng: -38.5014 }, // BA / SE
  '5': { lat: -8.0476, lng: -34.877 }, // PE / AL / PB / RN
  '6': { lat: -3.7172, lng: -38.5433 }, // CE / PI / MA / PA / AM
  '7': { lat: -15.7939, lng: -47.8828 }, // DF / GO / TO / MT / MS / RO
  '8': { lat: -25.4284, lng: -49.2733 }, // PR / SC
  '9': { lat: -30.0346, lng: -51.2177 }, // RS
};

@Injectable()
export class StorefrontDeliveryService {
  private readonly logger = new Logger(StorefrontDeliveryService.name);
  private readonly zipCache = new Map<
    string,
    { data: ResolvedZipInfo; expiresAt: number }
  >();

  isExpressModuleEnabledOnTenant(tenant: any): boolean {
    if (!tenant || tenant.status !== 'active') return false;
    const modulos =
      typeof tenant.modulos === 'string'
        ? JSON.parse(tenant.modulos || '{}')
        : tenant.modulos || {};
    return Boolean(modulos.lojaVirtual && modulos.entregaLojaVirtual);
  }

  private round2(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private round1(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;
  }

  private clampNumber(
    raw: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  private normalizeTextKey(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  generateConfirmationPin(): string {
    return String(randomInt(1000, 10000));
  }

  getDefaultConfig(tenant?: any): ExpressDeliveryConfig {
    const zip = String(tenant?.cep || '')
      .replace(/\D/g, '')
      .slice(0, 8);
    return {
      enabled: true,
      originZipCode: zip,
      originStreet: sanitizePlainText(tenant?.logradouro || '', 140),
      originNumber: sanitizePlainText(tenant?.numero || '', 30),
      originNeighborhood: sanitizePlainText(tenant?.bairro || '', 100),
      originCity: sanitizePlainText(tenant?.municipio || '', 100),
      originState: sanitizePlainText(tenant?.uf || '', 2).toUpperCase(),
      originLat: null,
      originLng: null,
      pricingMode: 'DISTANCE_KM',
      baseFee: 7.9,
      baseIncludedKm: 2,
      feePerAdditionalKm: 2.2,
      routeFactor: 1.28,
      maxRadiusKm: 18,
      fallbackFee: 11.9,
      motoEnabled: true,
      carEnabled: true,
      carSurcharge: 8.0,
      minOrderAmount: 0,
      freeShippingAbove: null,
      estimatedPrepMinutes: 15,
      neighborhoodOverrides: [],
      apiIntegration: {
        mode: 'HYBRID_PORTAL',
        corporateAccountId: null,
        corporateToken: null,
        environment: 'production',
        autoRequestOnConfirm: false,
      },
    };
  }

  sanitizeConfig(
    raw: any,
    tenant?: any,
    previousConfig?: ExpressDeliveryConfig | null,
  ): ExpressDeliveryConfig {
    const defaults = previousConfig
      ? { ...this.getDefaultConfig(tenant), ...previousConfig }
      : this.getDefaultConfig(tenant);

    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const originZipCode =
      raw.originZipCode !== undefined
        ? String(raw.originZipCode || '')
            .replace(/\D/g, '')
            .slice(0, 8)
        : defaults.originZipCode;

    const pricingMode =
      raw.pricingMode === 'FIXED' || raw.pricingMode === 'DISTANCE_KM'
        ? raw.pricingMode
        : defaults.pricingMode;

    const motoEnabled =
      raw.motoEnabled !== undefined
        ? Boolean(raw.motoEnabled)
        : defaults.motoEnabled;
    const carEnabled =
      raw.carEnabled !== undefined
        ? Boolean(raw.carEnabled)
        : defaults.carEnabled;

    if (!motoEnabled && !carEnabled) {
      throw new BadRequestException(
        'Habilite pelo menos uma modalidade 99 Entregas (Moto ou Carro).',
      );
    }

    let freeShippingAbove = defaults.freeShippingAbove;
    if (raw.freeShippingAbove !== undefined) {
      if (
        raw.freeShippingAbove === null ||
        raw.freeShippingAbove === '' ||
        Number(raw.freeShippingAbove) <= 0
      ) {
        freeShippingAbove = null;
      } else {
        freeShippingAbove = this.round2(
          this.clampNumber(raw.freeShippingAbove, 0, 1, 50000),
        );
      }
    }

    const rawOverrides = Array.isArray(raw.neighborhoodOverrides)
      ? raw.neighborhoodOverrides.slice(0, 60)
      : defaults.neighborhoodOverrides;

    const neighborhoodOverrides: ExpressDeliveryNeighborhoodOverride[] = [];
    const seenNeighborhoods = new Set<string>();
    for (let i = 0; i < rawOverrides.length; i++) {
      const item = rawOverrides[i];
      const neighborhood = sanitizePlainText(
        item?.neighborhood || '',
        100,
        'Bairro',
      );
      if (!neighborhood) continue;
      const key = this.normalizeTextKey(neighborhood);
      if (seenNeighborhoods.has(key)) continue;
      seenNeighborhoods.add(key);
      neighborhoodOverrides.push({
        id: sanitizePlainText(item?.id || `nb-${i + 1}`, 40),
        neighborhood,
        fee: this.round2(this.clampNumber(item?.fee, 0, 0, 500)),
        estimatedMinutes:
          item?.estimatedMinutes !== undefined &&
          item?.estimatedMinutes !== null &&
          item?.estimatedMinutes !== ''
            ? Math.round(
                this.clampNumber(item.estimatedMinutes, 25, 5, 240),
              )
            : null,
      });
    }

    const rawApi =
      raw.apiIntegration && typeof raw.apiIntegration === 'object'
        ? raw.apiIntegration
        : {};
    const prevApi = defaults.apiIntegration || {
      mode: 'HYBRID_PORTAL',
      corporateAccountId: null,
      corporateToken: null,
      environment: 'production',
      autoRequestOnConfirm: false,
    };

    let corporateToken = prevApi.corporateToken;
    if (rawApi.clearCorporateToken === true) {
      corporateToken = null;
    } else if (
      typeof rawApi.corporateToken === 'string' &&
      rawApi.corporateToken.trim() !== '' &&
      !rawApi.corporateToken.includes('••••')
    ) {
      corporateToken = rawApi.corporateToken.trim().slice(0, 256);
    }

    const originLat =
      raw.originLat !== undefined
        ? raw.originLat === null || raw.originLat === ''
          ? null
          : this.clampNumber(raw.originLat, 0, -90, 90)
        : defaults.originLat;
    const originLng =
      raw.originLng !== undefined
        ? raw.originLng === null || raw.originLng === ''
          ? null
          : this.clampNumber(raw.originLng, 0, -180, 180)
        : defaults.originLng;

    return {
      enabled:
        raw.enabled !== undefined ? Boolean(raw.enabled) : defaults.enabled,
      originZipCode,
      originStreet:
        raw.originStreet !== undefined
          ? sanitizePlainText(raw.originStreet, 140, 'Rua de origem')
          : defaults.originStreet,
      originNumber:
        raw.originNumber !== undefined
          ? sanitizePlainText(raw.originNumber, 30, 'Número de origem')
          : defaults.originNumber,
      originNeighborhood:
        raw.originNeighborhood !== undefined
          ? sanitizePlainText(raw.originNeighborhood, 100, 'Bairro de origem')
          : defaults.originNeighborhood,
      originCity:
        raw.originCity !== undefined
          ? sanitizePlainText(raw.originCity, 100, 'Cidade de origem')
          : defaults.originCity,
      originState:
        raw.originState !== undefined
          ? sanitizePlainText(raw.originState, 2, 'UF de origem').toUpperCase()
          : defaults.originState,
      originLat,
      originLng,
      pricingMode,
      baseFee: this.round2(
        this.clampNumber(raw.baseFee, defaults.baseFee, 0, 500),
      ),
      baseIncludedKm: this.round1(
        this.clampNumber(raw.baseIncludedKm, defaults.baseIncludedKm, 0, 50),
      ),
      feePerAdditionalKm: this.round2(
        this.clampNumber(
          raw.feePerAdditionalKm,
          defaults.feePerAdditionalKm,
          0,
          100,
        ),
      ),
      routeFactor: this.round2(
        this.clampNumber(raw.routeFactor, defaults.routeFactor, 1, 2.5),
      ),
      maxRadiusKm: this.round1(
        this.clampNumber(raw.maxRadiusKm, defaults.maxRadiusKm, 1, 150),
      ),
      fallbackFee: this.round2(
        this.clampNumber(raw.fallbackFee, defaults.fallbackFee, 0, 500),
      ),
      motoEnabled,
      carEnabled,
      carSurcharge: this.round2(
        this.clampNumber(raw.carSurcharge, defaults.carSurcharge, 0, 200),
      ),
      minOrderAmount: this.round2(
        this.clampNumber(raw.minOrderAmount, defaults.minOrderAmount, 0, 10000),
      ),
      freeShippingAbove,
      estimatedPrepMinutes: Math.round(
        this.clampNumber(
          raw.estimatedPrepMinutes,
          defaults.estimatedPrepMinutes,
          0,
          180,
        ),
      ),
      neighborhoodOverrides,
      apiIntegration: {
        mode:
          rawApi.mode === 'API_99_EMPRESAS'
            ? 'API_99_EMPRESAS'
            : rawApi.mode === 'HYBRID_PORTAL'
              ? 'HYBRID_PORTAL'
              : prevApi.mode,
        corporateAccountId:
          rawApi.corporateAccountId !== undefined
            ? sanitizePlainText(rawApi.corporateAccountId, 80) || null
            : prevApi.corporateAccountId,
        corporateToken,
        environment:
          rawApi.environment === 'sandbox'
            ? 'sandbox'
            : rawApi.environment === 'production'
              ? 'production'
              : prevApi.environment,
        autoRequestOnConfirm:
          rawApi.autoRequestOnConfirm !== undefined
            ? Boolean(rawApi.autoRequestOnConfirm)
            : prevApi.autoRequestOnConfirm,
      },
    };
  }

  extractConfigFromTheme(themeJson: any, tenant?: any): ExpressDeliveryConfig {
    const rawExpress =
      themeJson && typeof themeJson === 'object'
        ? themeJson.expressDelivery
        : null;
    return this.sanitizeConfig(rawExpress, tenant);
  }

  toAdminDto(config: ExpressDeliveryConfig, moduleEnabled: boolean) {
    const token = config.apiIntegration?.corporateToken || null;
    const masked =
      token && token.length >= 4
        ? `••••••••${token.slice(-4)}`
        : token
          ? '••••••••'
          : null;

    return {
      moduleEnabled,
      enabled: Boolean(config.enabled),
      effectivelyActive: Boolean(moduleEnabled && config.enabled),
      originZipCode: config.originZipCode,
      originStreet: config.originStreet,
      originNumber: config.originNumber,
      originNeighborhood: config.originNeighborhood,
      originCity: config.originCity,
      originState: config.originState,
      originLat: config.originLat,
      originLng: config.originLng,
      pricingMode: config.pricingMode,
      baseFee: config.baseFee,
      baseIncludedKm: config.baseIncludedKm,
      feePerAdditionalKm: config.feePerAdditionalKm,
      routeFactor: config.routeFactor,
      maxRadiusKm: config.maxRadiusKm,
      fallbackFee: config.fallbackFee,
      motoEnabled: config.motoEnabled,
      carEnabled: config.carEnabled,
      carSurcharge: config.carSurcharge,
      minOrderAmount: config.minOrderAmount,
      freeShippingAbove: config.freeShippingAbove,
      estimatedPrepMinutes: config.estimatedPrepMinutes,
      neighborhoodOverrides: config.neighborhoodOverrides,
      apiIntegration: {
        mode: config.apiIntegration.mode,
        corporateAccountId: config.apiIntegration.corporateAccountId,
        hasCorporateToken: Boolean(token),
        corporateTokenMasked: masked,
        environment: config.apiIntegration.environment,
        autoRequestOnConfirm: config.apiIntegration.autoRequestOnConfirm,
      },
    };
  }

  toPublicDto(config: ExpressDeliveryConfig, moduleEnabled: boolean) {
    const active = Boolean(moduleEnabled && config.enabled);
    return {
      moduleEnabled: Boolean(moduleEnabled),
      enabled: active,
      provider: '99_ENTREGAS' as const,
      pricingMode: config.pricingMode,
      baseFee: config.baseFee,
      baseIncludedKm: config.baseIncludedKm,
      feePerAdditionalKm: config.feePerAdditionalKm,
      maxRadiusKm: config.maxRadiusKm,
      motoEnabled: config.motoEnabled,
      carEnabled: config.carEnabled,
      carSurcharge: config.carSurcharge,
      minOrderAmount: config.minOrderAmount,
      freeShippingAbove: config.freeShippingAbove,
      estimatedPrepMinutes: config.estimatedPrepMinutes,
      originNeighborhood: config.originNeighborhood || null,
      originCity: config.originCity || null,
      originState: config.originState || null,
    };
  }

  approximateCoordsFromCep(zipDigits: string): { lat: number; lng: number } {
    const clean = String(zipDigits || '')
      .replace(/\D/g, '')
      .padEnd(8, '0')
      .slice(0, 8);
    const region =
      CEP_REGION_CENTERS[clean[0]] || CEP_REGION_CENTERS['0'];
    const subRegion = Number(clean.slice(1, 3)) || 0; // 00..99
    const sector = Number(clean.slice(3, 5)) || 0; // 00..99
    const streetSeed = Number(clean.slice(5, 8)) || 0; // 000..999

    // subRegion (2 dígitos) desloca ~1.2km por unidade; sector desloca ~180m; streetSeed ~15m
    const latOffset =
      ((subRegion - 30) * 0.0042) +
      (((sector % 10) - 5) * 0.0016) +
      (((streetSeed % 20) - 10) * 0.00015);
    const lngOffset =
      (((subRegion % 25) - 12) * 0.0048) +
      ((Math.floor(sector / 10) - 5) * 0.0016) +
      (((Math.floor(streetSeed / 20) % 20) - 10) * 0.00015);

    return {
      lat: Number((region.lat + latOffset).toFixed(6)),
      lng: Number((region.lng + lngOffset).toFixed(6)),
    };
  }

  async resolveZipCodeInfo(rawZip: string): Promise<ResolvedZipInfo | null> {
    const zipDigits = String(rawZip || '').replace(/\D/g, '');
    if (zipDigits.length !== 8 || /^(\d)\1+$/.test(zipDigits)) {
      return null;
    }

    const now = Date.now();
    const cached = this.zipCache.get(zipDigits);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const approx = this.approximateCoordsFromCep(zipDigits);
    let resolved: ResolvedZipInfo = {
      zipCode: zipDigits,
      street: null,
      neighborhood: null,
      city: null,
      state: null,
      lat: approx.lat,
      lng: approx.lng,
      approximate: true,
    };

    if (process.env.NODE_ENV !== 'test') {
      try {
        const res = await fetch(
          `https://brasilapi.com.br/api/cep/v2/${zipDigits}`,
          {
            signal: AbortSignal.timeout(2600),
            headers: { Accept: 'application/json' },
          },
        );
        if (res.ok) {
          const data: any = await res.json();
          const lat = Number(data?.location?.coordinates?.latitude);
          const lng = Number(data?.location?.coordinates?.longitude);
          const hasRealCoords =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) > 0.01 &&
            Math.abs(lng) > 0.01;
          resolved = {
            zipCode: zipDigits,
            street: data?.street || null,
            neighborhood: data?.neighborhood || null,
            city: data?.city || null,
            state: data?.state || null,
            lat: hasRealCoords ? lat : approx.lat,
            lng: hasRealCoords ? lng : approx.lng,
            approximate: !hasRealCoords,
          };
        } else {
          const viaRes = await fetch(
            `https://viacep.com.br/ws/${zipDigits}/json/`,
            {
              signal: AbortSignal.timeout(2200),
              headers: { Accept: 'application/json' },
            },
          );
          if (viaRes.ok) {
            const viaData: any = await viaRes.json();
            if (!viaData?.erro) {
              resolved = {
                zipCode: zipDigits,
                street: viaData?.logradouro || null,
                neighborhood: viaData?.bairro || null,
                city: viaData?.localidade || null,
                state: viaData?.uf || null,
                lat: approx.lat,
                lng: approx.lng,
                approximate: true,
              };
            }
          }
        }
      } catch (err: any) {
        this.logger.debug(
          `Fallback local de coordenadas para CEP ${zipDigits}: ${err?.message || 'timeout'}`,
        );
      }
    }

    if (this.zipCache.size > 2000) {
      for (const [k, v] of this.zipCache.entries()) {
        if (v.expiresAt <= now) this.zipCache.delete(k);
      }
    }
    this.zipCache.set(zipDigits, {
      data: resolved,
      expiresAt: now + 12 * 60 * 60 * 1000,
    });
    return resolved;
  }

  computeHaversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async calculateDeliveryQuote(params: {
    config: ExpressDeliveryConfig;
    moduleEnabled: boolean;
    destinationZipCode?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    subtotal: number;
    preferredVehicle?: string | null;
  }): Promise<ExpressDeliveryQuoteResult> {
    const { config, moduleEnabled } = params;
    const subtotal = Math.max(0, this.round2(Number(params.subtotal || 0)));
    const originParts = [config.originNeighborhood, config.originCity]
      .filter(Boolean)
      .join(', ');
    const originLabel = originParts || 'Loja Física';

    const preferredRaw = String(params.preferredVehicle || '')
      .trim()
      .toUpperCase();
    const defaultVehicle: ExpressVehicleType =
      preferredRaw === 'CARRO' && config.carEnabled
        ? 'CARRO'
        : config.motoEnabled
          ? 'MOTO'
          : 'CARRO';

    if (!moduleEnabled || !config.enabled) {
      return {
        available: false,
        provider: '99_ENTREGAS',
        reasonCode: 'MODULE_DISABLED',
        message: 'A cotação automática 99 Entregas não está ativa nesta loja.',
        originLabel,
        destination: {
          zipCode: null,
          street: null,
          neighborhood: params.neighborhood || null,
          city: params.city || null,
          state: params.state || null,
        },
        distanceKm: null,
        maxRadiusKm: config.maxRadiusKm,
        minOrderAmount: config.minOrderAmount,
        remainingForMinOrder: 0,
        freeShippingAbove: config.freeShippingAbove,
        remainingForFreeShipping: 0,
        freeShippingApplied: false,
        pricingSource: 'FALLBACK',
        selectedVehicle: defaultVehicle,
        selectedFee: 0,
        estimatedMinutes: config.estimatedPrepMinutes + 20,
        options: [],
      };
    }

    const zipClean = String(params.destinationZipCode || '').replace(/\D/g, '');
    const destInfo =
      zipClean.length === 8 ? await this.resolveZipCodeInfo(zipClean) : null;

    if (zipClean.length > 0 && !destInfo) {
      return {
        available: false,
        provider: '99_ENTREGAS',
        reasonCode: 'INVALID_CEP',
        message: 'Informe um CEP válido de 8 dígitos para calcular a entrega 99.',
        originLabel,
        destination: {
          zipCode: zipClean || null,
          street: null,
          neighborhood: params.neighborhood || null,
          city: params.city || null,
          state: params.state || null,
        },
        distanceKm: null,
        maxRadiusKm: config.maxRadiusKm,
        minOrderAmount: config.minOrderAmount,
        remainingForMinOrder: Math.max(
          0,
          this.round2(config.minOrderAmount - subtotal),
        ),
        freeShippingAbove: config.freeShippingAbove,
        remainingForFreeShipping: 0,
        freeShippingApplied: false,
        pricingSource: 'FALLBACK',
        selectedVehicle: defaultVehicle,
        selectedFee: 0,
        estimatedMinutes: config.estimatedPrepMinutes + 20,
        options: [],
      };
    }

    const resolvedNeighborhood =
      sanitizePlainText(
        params.neighborhood || destInfo?.neighborhood || '',
        100,
      ) || null;
    const resolvedCity =
      sanitizePlainText(params.city || destInfo?.city || '', 100) || null;
    const resolvedState =
      sanitizePlainText(params.state || destInfo?.state || '', 2).toUpperCase() ||
      null;

    if (config.minOrderAmount > 0 && subtotal < config.minOrderAmount) {
      const remaining = this.round2(config.minOrderAmount - subtotal);
      return {
        available: false,
        provider: '99_ENTREGAS',
        reasonCode: 'MIN_ORDER_NOT_REACHED',
        message: `Pedido mínimo para entrega 99 é de ${formatCurrencyBrl(
          config.minOrderAmount,
        )} (faltam ${formatCurrencyBrl(remaining)}).`,
        originLabel,
        destination: {
          zipCode: destInfo?.zipCode || null,
          street: destInfo?.street || null,
          neighborhood: resolvedNeighborhood,
          city: resolvedCity,
          state: resolvedState,
        },
        distanceKm: null,
        maxRadiusKm: config.maxRadiusKm,
        minOrderAmount: config.minOrderAmount,
        remainingForMinOrder: remaining,
        freeShippingAbove: config.freeShippingAbove,
        remainingForFreeShipping:
          config.freeShippingAbove && config.freeShippingAbove > subtotal
            ? this.round2(config.freeShippingAbove - subtotal)
            : 0,
        freeShippingApplied: false,
        pricingSource: 'FALLBACK',
        selectedVehicle: defaultVehicle,
        selectedFee: 0,
        estimatedMinutes: config.estimatedPrepMinutes + 20,
        options: [],
      };
    }

    // Resolver coordenadas de origem
    let originLat = config.originLat;
    let originLng = config.originLng;
    if (
      (originLat === null || originLng === null) &&
      config.originZipCode &&
      config.originZipCode.length === 8
    ) {
      const originResolved = await this.resolveZipCodeInfo(config.originZipCode);
      if (originResolved) {
        originLat = originResolved.lat;
        originLng = originResolved.lng;
      }
    }

    let distanceKm: number | null = null;
    if (destInfo && originLat !== null && originLng !== null) {
      if (
        config.originZipCode &&
        destInfo.zipCode === config.originZipCode.replace(/\D/g, '')
      ) {
        distanceKm = 0.6;
      } else {
        const straightKm = this.computeHaversineKm(
          originLat,
          originLng,
          destInfo.lat,
          destInfo.lng,
        );
        distanceKm = Math.max(
          0.6,
          this.round1(straightKm * (config.routeFactor || 1.28)),
        );
      }
    }

    // Checar exceção por bairro antes do raio caso seja bairro local cadastrado
    const nbKey = resolvedNeighborhood
      ? this.normalizeTextKey(resolvedNeighborhood)
      : '';
    const matchedOverride = nbKey
      ? config.neighborhoodOverrides.find(
          (ov) => this.normalizeTextKey(ov.neighborhood) === nbKey,
        )
      : undefined;

    if (
      !matchedOverride &&
      distanceKm !== null &&
      config.maxRadiusKm > 0 &&
      distanceKm > config.maxRadiusKm
    ) {
      return {
        available: false,
        provider: '99_ENTREGAS',
        reasonCode: 'OUT_OF_RADIUS',
        message: `O CEP informado fica a aproximadamente ${distanceKm
          .toFixed(1)
          .replace('.', ',')} km da loja (limite de atendimento 99: ${config.maxRadiusKm
          .toFixed(1)
          .replace('.', ',')} km).`,
        originLabel,
        destination: {
          zipCode: destInfo?.zipCode || null,
          street: destInfo?.street || null,
          neighborhood: resolvedNeighborhood,
          city: resolvedCity,
          state: resolvedState,
        },
        distanceKm,
        maxRadiusKm: config.maxRadiusKm,
        minOrderAmount: config.minOrderAmount,
        remainingForMinOrder: 0,
        freeShippingAbove: config.freeShippingAbove,
        remainingForFreeShipping:
          config.freeShippingAbove && config.freeShippingAbove > subtotal
            ? this.round2(config.freeShippingAbove - subtotal)
            : 0,
        freeShippingApplied: false,
        pricingSource: 'DISTANCE_KM',
        selectedVehicle: defaultVehicle,
        selectedFee: 0,
        estimatedMinutes: config.estimatedPrepMinutes + 25,
        options: [],
      };
    }

    let pricingSource: ExpressDeliveryQuoteResult['pricingSource'] = 'FALLBACK';
    let motoBaseFee = config.fallbackFee;

    if (matchedOverride) {
      pricingSource = 'NEIGHBORHOOD_OVERRIDE';
      motoBaseFee = matchedOverride.fee;
    } else if (config.pricingMode === 'FIXED') {
      pricingSource = 'FIXED';
      motoBaseFee = config.baseFee;
    } else if (distanceKm !== null) {
      pricingSource = 'DISTANCE_KM';
      const extraKm = Math.max(0, distanceKm - config.baseIncludedKm);
      motoBaseFee = this.round2(
        config.baseFee + extraKm * config.feePerAdditionalKm,
      );
    }

    const freeShippingEligible =
      config.freeShippingAbove !== null &&
      config.freeShippingAbove > 0 &&
      subtotal >= config.freeShippingAbove;
    const remainingForFreeShipping =
      config.freeShippingAbove !== null && config.freeShippingAbove > subtotal
        ? this.round2(config.freeShippingAbove - subtotal)
        : 0;

    const travelMinutes =
      matchedOverride?.estimatedMinutes != null
        ? Math.max(5, matchedOverride.estimatedMinutes - config.estimatedPrepMinutes)
        : distanceKm !== null
          ? Math.max(6, Math.ceil(distanceKm * 2.6 + 6))
          : 18;
    const motoEta = Math.max(8, config.estimatedPrepMinutes + travelMinutes);

    const options: ExpressQuoteVehicleOption[] = [];
    if (config.motoEnabled) {
      const originalFee = this.round2(motoBaseFee);
      const fee = freeShippingEligible ? 0 : originalFee;
      options.push({
        vehicleType: 'MOTO',
        label: '99Entrega Moto',
        description: 'Ágil para peças, calçados e sacolas compactas',
        fee,
        originalFee,
        freeShippingApplied: freeShippingEligible,
        estimatedMinutes: motoEta,
      });
    }

    if (config.carEnabled) {
      const originalFee = this.round2(motoBaseFee + config.carSurcharge);
      const fee = freeShippingEligible
        ? this.round2(config.carSurcharge)
        : originalFee;
      options.push({
        vehicleType: 'CARRO',
        label: '99Entrega Carro',
        description: 'Ideal para caixas maiores ou pedidos volumosos',
        fee,
        originalFee,
        freeShippingApplied: freeShippingEligible && config.carSurcharge === 0,
        estimatedMinutes: motoEta + 6,
      });
    }

    const chosen =
      options.find((opt) => opt.vehicleType === defaultVehicle) || options[0];

    return {
      available: true,
      provider: '99_ENTREGAS',
      originLabel,
      destination: {
        zipCode: destInfo?.zipCode || null,
        street: destInfo?.street || null,
        neighborhood: resolvedNeighborhood,
        city: resolvedCity,
        state: resolvedState,
      },
      distanceKm,
      maxRadiusKm: config.maxRadiusKm,
      minOrderAmount: config.minOrderAmount,
      remainingForMinOrder: 0,
      freeShippingAbove: config.freeShippingAbove,
      remainingForFreeShipping,
      freeShippingApplied: Boolean(chosen?.freeShippingApplied),
      pricingSource,
      selectedVehicle: chosen.vehicleType,
      selectedFee: chosen.fee,
      estimatedMinutes: chosen.estimatedMinutes,
      options,
    };
  }

  buildCustomerTrackingWhatsappUrl(params: {
    customerPhone: string;
    customerName: string;
    storeName: string;
    reference: string;
    dispatch: ExpressDispatchRecord;
    orderStatusUrl?: string | null;
  }): string | null {
    const digits = String(params.customerPhone || '').replace(/\D/g, '');
    if (!digits) return null;
    const waDigits =
      digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

    const firstName =
      String(params.customerName || '').trim().split(/\s+/)[0] || 'Cliente';
    const vehicleLabel =
      params.dispatch.vehicleType === 'CARRO'
        ? '99Entrega Carro'
        : '99Entrega Moto';

    const statusLine =
      params.dispatch.status === 'DELIVERED'
        ? `Seu pedido *${params.reference}* foi entregue!`
        : params.dispatch.status === 'DISPATCHED'
          ? `O entregador está chegando com seu pedido *${params.reference}* (*${vehicleLabel}*)!`
          : params.dispatch.status === 'PICKED_UP'
            ? `O entregador já coletou seu pacote *${params.reference}* na loja (*${vehicleLabel}*)!`
            : params.dispatch.status === 'REQUESTED'
              ? `O motorista *${vehicleLabel}* está indo até a loja retirar seu pedido *${params.reference}*!`
              : params.dispatch.status === 'FOUND'
                ? `Encontramos um motorista *${vehicleLabel}* para o seu pedido *${params.reference}*!`
                : `Atualização da entrega do seu pedido *${params.reference}*:`;

    const lines: string[] = [
      `Olá, ${firstName}! Aqui é da *${params.storeName || 'Loja'}*.`,
      statusLine,
    ];

    if (params.dispatch.courierName || params.dispatch.vehiclePlate) {
      const parts = [
        params.dispatch.courierName
          ? `Entregador: *${params.dispatch.courierName}*`
          : '',
        params.dispatch.vehiclePlate
          ? `Placa: *${params.dispatch.vehiclePlate}*`
          : '',
      ].filter(Boolean);
      lines.push(parts.join(' · '));
    }

    if (
      params.dispatch.confirmationPin &&
      params.dispatch.status !== 'DELIVERED'
    ) {
      lines.push(
        `Código PIN de segurança no recebimento: *${params.dispatch.confirmationPin}*`,
      );
    }

    if (params.dispatch.trackingUrl) {
      lines.push('');
      lines.push(`Rastreio na 99: ${params.dispatch.trackingUrl}`);
    }

    if (params.orderStatusUrl) {
      lines.push(`Acompanhar pedido na loja: ${params.orderStatusUrl}`);
    }

    return `https://wa.me/${waDigits}?text=${encodeURIComponent(lines.join('\n'))}`;
  }
}
