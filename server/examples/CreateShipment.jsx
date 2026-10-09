import { useRef, useState } from 'react';
import { createShippingApi } from './react-api.js';

const api = createShippingApi();

// Standalone example; copy together with react-api.js into your React project.
export default function CreateShipment() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  // Persist only the reference ID, never phone/address/password, across reloads.
  const referenceId = useRef(sessionStorage.getItem('shippingReference') || crypto.randomUUID());
  const [reference, setReference] = useState(referenceId.current);
  sessionStorage.setItem('shippingReference', referenceId.current);

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get('password');
    setBusy(true);
    try { await api.login(password); setLoggedIn(true); setMessage(''); form.reset(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || result?.status === 'CREATED') return;
    const data = new FormData(event.currentTarget);
    const contact = (prefix) => ({
      name: data.get(`${prefix}.name`),
      phone: data.get(`${prefix}.phone`),
      address: { line1: data.get(`${prefix}.address`), province: data.get(`${prefix}.province`), ward: data.get(`${prefix}.ward`), district: '' },
    });
    setBusy(true); setMessage('');
    try {
      const shipment = await api.createShipment({
        referenceId: referenceId.current,
        recipient: contact('recipient'),
        items: [{ sku: data.get('sku'), name: data.get('productName'), quantity: Number(data.get('quantity')), unitPrice: Number(data.get('unitPrice')) }],
        codAmount: Number(data.get('codAmount')), shippingFeePayer: data.get('shippingFeePayer'),
        parcel: Object.fromEntries(['weightGrams', 'lengthCm', 'widthCm', 'heightCm'].map((key) => [key, Number(data.get(key))])),
        note: data.get('note'),
      });
      setResult(shipment);
      setMessage(shipment.simulated ? `ĐƠN MÔ PHỎNG: ${shipment.trackingNumber}. Chưa gửi GHN.` : `Mã vận đơn: ${shipment.trackingNumber}`);
    } catch (error) {
      setMessage(`${error.message} Giữ nguyên mã đơn ${referenceId.current}; tra cứu kết quả trước khi tạo đơn mới.`);
    } finally { setBusy(false); }
  }
  async function lookup() {
    setBusy(true);
    try { let data = await api.getShipment(referenceId.current); if (data.status === 'UNKNOWN' || data.status === 'SUBMITTING') data = await api.reconcile(referenceId.current); setResult(data); setMessage(`${data.status}: ${data.trackingNumber || 'Cần đối soát'}${data.simulated ? ' (mô phỏng)' : ''}`); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function newOrder() {
    referenceId.current = crypto.randomUUID();
    sessionStorage.setItem('shippingReference', referenceId.current);
    setReference(referenceId.current); setResult(null); setMessage('');
  }
  return (
    <section style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'sans-serif' }}>
      <h2>Tạo vận đơn GHN</h2>
      <p>Địa chỉ lấy hàng mặc định theo shop GHN. Nhập tỉnh và phường/xã theo địa chỉ mới.</p>
      <p role="status">{message}</p>
      {!loggedIn ? (
        <form onSubmit={login}>
          <label>Mật khẩu quản trị <input type="password" name="password" required autoComplete="current-password" /></label>
          <button disabled={busy}>Đăng nhập</button>
        </form>
      ) : (
        <>
          <p>Mã đơn: {reference}</p>
          <form onSubmit={submit}>
            <fieldset disabled={busy || result?.status === 'CREATED'}>
              {['recipient'].map((prefix) => (
                <fieldset key={prefix}>
                  <legend>{prefix === 'sender' ? 'Người gửi / Kho lấy hàng' : 'Người nhận'}</legend>
                  {[['name', 'Tên'], ['phone', 'Điện thoại'], ['address', 'Địa chỉ cụ thể'], ['province', 'Tỉnh/Thành phố'], ['ward', 'Phường/Xã']].map(([key, label]) => (
                    <label key={key} style={{ display: 'block', margin: 8 }}>{label} <input name={`${prefix}.${key}`} required /></label>
                  ))}
                </fieldset>
              ))}
              {[['sku', 'SKU'], ['productName', 'Tên sản phẩm']].map(([key, label]) => <label key={key} style={{ display: 'block', margin: 8 }}>{label} <input name={key} required /></label>)}
              {[['quantity', 'Số lượng', 1, 1], ['unitPrice', 'Đơn giá (đ)', 0, 39000], ['codAmount', 'COD (đ)', 0, 39000], ['weightGrams', 'Khối lượng (g)', 1, 300], ['lengthCm', 'Dài (cm)', 1, 15], ['widthCm', 'Rộng (cm)', 1, 10], ['heightCm', 'Cao (cm)', 1, 8]].map(([key, label, min, initial]) => (
                <label key={key} style={{ display: 'block', margin: 8 }}>{label} <input type="number" name={key} min={min} step="1" defaultValue={initial} required /></label>
              ))}
              <label>Phí ship <select name="shippingFeePayer"><option value="sender">Shop trả</option><option value="recipient">Khách trả</option></select></label>
              <label style={{ display: 'block', margin: 8 }}>Ghi chú <input name="note" /></label>
              <button type="submit">{busy ? 'Đang gửi…' : 'Tạo đơn & gửi'}</button>
            </fieldset>
          </form>
          <button type="button" disabled={busy} onClick={lookup}>Tra cứu kết quả gửi</button>
          {result?.status === 'CREATED' && <button type="button" onClick={newOrder}>Đơn mới</button>}
        </>
      )}
    </section>
  );
}
