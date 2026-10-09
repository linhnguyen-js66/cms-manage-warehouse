import { HttpError } from './errors.js';

export function createGhnClient({ token, shopId, environment = 'staging', timeoutMs = 15000 }, fetchFn = fetch) {
  environment = typeof environment === 'string' ? environment.trim() : environment;
  if (!['staging', 'production'].includes(environment)) throw new Error('GHN_ENV phải là staging hoặc production. Kiểm tra .env và biến GHN_ENV trong terminal (biến terminal được ưu tiên).');
  const baseURL = environment === 'production' ? 'https://online-gateway.ghn.vn' : 'https://dev-online-gateway.ghn.vn';
  const shop = Number(shopId);
  function assertReady(requireShop = true) {
    if (!token || (requireShop && (!Number.isSafeInteger(shop) || shop <= 0))) {
      throw new HttpError(503, 'GHN_NOT_CONFIGURED', 'Cần GHN_TOKEN và GHN_SHOP_ID trong .env server.');
    }
  }
  return {
    baseURL, shopId: shop, environment, assertReady,
    async request(path, { method = 'POST', payload = {}, requireShop = true } = {}) {
      assertReady(requireShop);
      const url = new URL(path, baseURL);
      if (url.origin !== baseURL || !url.pathname.startsWith('/shiip/public-api/')) throw new Error('Invalid GHN endpoint');
      const headers = { Token: token, 'Content-Type': 'application/json' };
      if (requireShop) headers.ShopId = String(shop);
      const options = { method, headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) };
      if (method === 'GET') {
        for (const [key, value] of Object.entries(payload)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      } else options.body = JSON.stringify(payload);
      let response;
      try { response = await fetchFn(url, options); }
      catch { throw new HttpError(502, 'GHN_UNCERTAIN', 'Không nhận được kết quả GHN. Tra cứu mã đơn trước khi gửi lại.'); }
      let body;
      try { body = await response.json(); }
      catch { throw new HttpError(502, 'GHN_UNCERTAIN', 'GHN trả dữ liệu không đọc được.'); }
      if (!response.ok || body?.code !== 200) {
        const statusCode = Number(body?.code ?? response.status);
        const definite = response.status >= 400 && response.status < 500 && statusCode >= 400 && statusCode < 500;
        const safeMessage = String(body?.code_message_value || body?.message || 'GHN từ chối yêu cầu').split(token).join('[hidden]').slice(0, 500);
        const error = new HttpError(definite ? 422 : 502, definite ? 'GHN_REJECTED' : 'GHN_UNCERTAIN', safeMessage);
        error.upstreamCode = body?.code_message ? String(body.code_message).split(token).join('[hidden]').slice(0, 100) : null;
        throw error;
      }
      return body;
    },
  };
}
