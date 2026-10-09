// Copy into React. Keep GHN_TOKEN and ADMIN_PASSWORD on the server, never in VITE_*.
export function createShippingApi(baseURL = 'http://localhost:3001') {
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${baseURL}${path}`, {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || 'Không gọi được server');
      Object.assign(error, { code: data.error?.code, upstreamCode: data.error?.upstreamCode, status: response.status });
      throw error;
    }
    return data;
  }
  const post = (path, body) => request(path, 'POST', body);
  const get = (path, query = {}) => request(`${path}?${new URLSearchParams(query)}`);
  return {
    login: password => post('/api/auth/login', { password }),
    logout: () => post('/api/auth/logout', {}),
    createShipment: order => post('/api/shipments', order),
    getShipment: id => request(`/api/shipments/${encodeURIComponent(id)}`),
    reconcile: id => post(`/api/shipments/${encodeURIComponent(id)}/reconcile`, {}),
    // GHN payloads use snake_case. GET query objects become URL parameters.
    ghnGet: (path, query) => get(`/api/ghn/${path}`, query),
    ghnPost: (path, payload) => post(`/api/ghn/${path}`, payload),
    createRaw: payload => post('/api/ghn/orders/create', payload),
    detail: order_code => get('/api/ghn/orders/detail', { order_code }),
    preview: payload => post('/api/ghn/orders/preview', payload),
    print: order_codes => post('/api/ghn/orders/print', { order_codes }),
  };
}
