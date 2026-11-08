export class ProvisionTenantDto {
  pin: string;
  tenantName: string;
  dbName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  seedProducts?: boolean;
  mensalidadeValor?: number;
  mensalidadeVencimento?: string;
  cnpj?: string;
  telefone?: string;
  telefoneContato?: string;
  emailContato?: string;
  syncLeadger?: boolean;
  syncWithLeadger?: boolean;
  modulos?: Record<string, any>;
}
