import axios from 'axios';

/**
 * Cliente HTTP exclusivo para a Loja Virtual pública (/loja/:slug).
 * - NÃO anexa tokens JWT administrativos nem cabeçalhos de sessão do PDV.
 * - NÃO redireciona para /login em respostas 401/403.
 * - Permite que um administrador autenticado na Loja A visite a vitrine da Loja B
 *   no mesmo navegador sem vazamento de sessão ou conflito de tenant.
 */
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const storefrontApi = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});
