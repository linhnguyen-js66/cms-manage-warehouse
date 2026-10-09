import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGhnClient } from '../src/ghn-client.js';
import { createGhnGateway, routes } from '../src/ghn-gateway.js';
import { createGhnProvider } from '../src/providers/ghn.js';
import { createShippingService } from '../src/shipping.js';
import { createStore } from '../src/store.js';
const sample = JSON.parse(readFileSync(new URL('../examples/order.json', import.meta.url)));
const raw = { client_order_code: 'ORDER-GHN-001', to_name: 'Khách mẫu', to_phone: '0900000001', to_address: 'Địa chỉ mẫu', to_province_name: 'Hà Nội', to_ward_name: 'Phường mẫu', is_new_to_address: true, weight: 300, length: 15, width: 10, height: 8, service_type_id: 2, payment_type_id: 1, required_note: 'KHONGCHOXEMHANG', cod_amount: 0, items: [{ name: 'Mẫu', quantity: 1, price: 0 }] };
const ok = data => new Response(JSON.stringify({code:200,data}), { status:200 });
const config = { token:'private-token', shopId:123, environment:'staging' };
test('create mapping, private headers, durable replay and shop identity', async () => {
 const calls=[]; const client=createGhnClient(config, async (url,options)=>{ calls.push({url,options}); return ok({order_code:'GHN123'}); });
 const store=createStore(':memory:');
 try {
  const service=createShippingService(store,createGhnProvider(client));
  const result=await service.create(sample); assert.equal(result.trackingNumber,'GHN123');
  assert.equal((await service.create(sample)).trackingNumber,'GHN123'); assert.equal(calls.length,1);
  assert.equal(calls[0].url.origin,'https://dev-online-gateway.ghn.vn');
  assert.equal(calls[0].options.headers.Token,config.token); assert.equal(calls[0].options.headers.ShopId,'123');
  const body=JSON.parse(calls[0].options.body); assert.equal(body.client_order_code,sample.referenceId);
  assert.equal(body.is_new_to_address,true); assert.equal(body.from_address,undefined); assert.equal(body.items[0].code,sample.items[0].sku);
  const other=createShippingService(store,createGhnProvider(createGhnClient({...config,shopId:456})));
  await assert.rejects(other.create(sample),{code:'REFERENCE_CONFLICT'});
 } finally {store.close();}
});
test('rejected creation allows correction; timeout requires reconciliation without a second create', async () => {
 const store=createStore(':memory:'); let mode='reject'; let creates=0;
 const client=createGhnClient(config,async (url)=>{
  if(url.pathname.endsWith('detail-by-client-code')) {assert.equal(url.searchParams.get('client_order_code'),raw.client_order_code);return ok({order_code:'RECOVERED'});}
  creates++;
  if(mode==='reject') return new Response(JSON.stringify({code:400,message:'private-token invalid',code_message:'INVALID'}),{status:400});
  throw new Error('timeout');
 });
 const service=createShippingService(store,createGhnProvider(client));
 try {
  await assert.rejects(service.createRaw(raw), e=>e.code==='GHN_REJECTED' && !e.message.includes(config.token));
  assert.equal(service.get(raw.client_order_code).status,'REJECTED'); mode='timeout';
  await assert.rejects(service.createRaw({...raw,cod_amount:500}),{code:'SHIPMENT_UNKNOWN'});
  assert.equal(service.get(raw.client_order_code).status,'UNKNOWN');
  await assert.rejects(service.createRaw({...raw,cod_amount:500}),{code:'SHIPMENT_PENDING'});
  assert.equal(creates,2); assert.equal((await service.reconcile(raw.client_order_code)).trackingNumber,'RECOVERED'); assert.equal(creates,2);
 } finally {store.close();}
});
test('every gateway route uses its documented method/path; batch failures preserved',async()=>{
 const calls=[];
 const client=createGhnClient(config,async(url,options)=>{calls.push({url,options});return ok({token:'print-token',result:false});});
 const gateway=createGhnGateway(client);
 for(const [method,path,upstream] of routes){
  let payload={order_code:'GHN123',client_order_code:'ORDER-GHN-001',order_codes:['GHN123'],cod_amount:0,to_district_id:1450,to_ward_code:'12345',weight:300,service_type_id:2,province_id:'201',district_id:'1450',from_district:1450,to_district:1450,shop_id:999};
  if(path.endsWith('/preview'))payload={...raw};
  if(path.endsWith('/update'))payload={order_code:'GHN123',note:'Gọi trước'};
  const response=await gateway.handle(method,path,payload); const call=calls.at(-1);
  assert.equal(call.options.method,method); assert.equal(call.url.pathname,upstream);
  if(method==='GET') assert.equal(call.options.body,undefined);
  if(path.endsWith('/services'))assert.equal(JSON.parse(call.options.body).shop_id,123);
  if(path.endsWith('/update-cod'))assert.deepEqual(JSON.parse(call.options.body),{order_code:'GHN123',cod_amount:0});
  if(path.endsWith('/print'))assert.equal(response.printUrls.A5,'https://dev-online-gateway.ghn.vn/a5/public-api/printA5?token=print-token');
  assert.equal(response.data.result,false);
 }
 await assert.rejects(gateway.handle('POST','/api/ghn/orders/update-cod',{order_code:'x',cod_amount:5000001}),{code:'INVALID_GHN_PAYLOAD'});
 assert.ok((await gateway.handle('GET','/api/ghn/master/statuses',{})).data.length);
});
test('raw payload validation runs before network calls; production base and token-only shop lookup',async()=>{
 const store=createStore(':memory:'); let count=0;
 const client=createGhnClient({...config,environment:'production'},async()=>{count++;return ok({order_code:'P123'});});
 try {
  const service=createShippingService(store,createGhnProvider(client));
  await assert.rejects(service.createRaw({...raw,weight:20000}),{code:'INVALID_GHN_PAYLOAD'});
  await assert.rejects(service.createRaw({...raw,service_type_id:5}),{code:'INVALID_GHN_PAYLOAD'});
  assert.equal(count,0); assert.equal(client.baseURL,'https://online-gateway.ghn.vn');
  const tokenOnly=createGhnClient({token:'token'},async(url,options)=>{assert.equal(options.headers.ShopId,undefined);return ok([]);});
  await createGhnGateway(tokenOnly).handle('GET','/api/ghn/shops',{});
 }finally{store.close();}
});
test('authenticated HTTP raw create, gateway query and reconcile use the GHN service', async () => {
 const { createApp } = await import('../src/app.js');
 const store=createStore(':memory:'); let creates=0;
 const client=createGhnClient(config,async(url)=>{
  if(url.pathname.endsWith('/create')){creates++;return ok({order_code:'HTTP123'});}
  if(url.pathname.endsWith('/detail-by-client-code'))return ok({order_code:'HTTP123'});
  assert.equal(url.searchParams.get('province_id'),'201');return ok([]);
 });
 const server=createApp({shipping:createShippingService(store,createGhnProvider(client)),ghnGateway:createGhnGateway(client),adminPassword:'private-password-16',frontendOrigin:'http://localhost:5173'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  assert.equal((await fetch(base+'/api/ghn/master/provinces')).status,401);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'private-password-16'})});
  const headers={'Content-Type':'application/json',Cookie:login.headers.get('set-cookie').split(';')[0]};
  const create=await fetch(base+'/api/ghn/orders/create',{method:'POST',headers,body:JSON.stringify(raw)});
  assert.equal(create.status,200);assert.equal((await create.json()).trackingNumber,'HTTP123');
  assert.equal((await fetch(base+'/api/ghn/master/districts?province_id=201',{headers})).status,200);
  const reconcile=await fetch(base+`/api/shipments/${raw.client_order_code}/reconcile`,{method:'POST',headers,body:'{}'});
  assert.equal(reconcile.status,200);assert.equal((await reconcile.json()).trackingNumber,'HTTP123');assert.equal(creates,1);
 }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});

test('new two-level catalogs and preview use official paths, headers and canonical names', async () => {
 const calls=[];
 const client=createGhnClient(config,async(url,options)=>{
  calls.push({url,options});
  if(url.pathname.endsWith('/province/all'))return ok([{_id:1,name:'Hà Nội',type:'province',status:1,parent_id:1}]);
  if(url.pathname.endsWith('/ward/all-by-province-id'))return ok([{_id:2,name:'Phường Ba Đình',type:'ward',parent_id:1,status:1}]);
  return ok({order_code:'',total_fee:20000});
 });
 const gateway=createGhnGateway(client);
 await gateway.handle('GET','/api/ghn/master/provinces-new',{offset:'0',limit:'200'});
 await gateway.handle('GET','/api/ghn/master/wards-new',{province_id:'1',offset:'0',limit:'200'});
 const preview=await gateway.handle('POST','/api/ghn/orders/preview',{...raw,client_order_code:undefined,to_ward_name:'Phường Ba Đình'});
 assert.equal(calls[0].url.pathname,'/shiip/public-api/v3/master-data/province/all');
 assert.equal(calls[1].url.pathname,'/shiip/public-api/v3/master-data/ward/all-by-province-id');
 assert.equal(calls[1].url.searchParams.get('province_id'),'1');
 assert.equal(calls[2].url.pathname,'/shiip/public-api/v2/shipping-order/preview');
 const payload=JSON.parse(calls[2].options.body);
 assert.equal(payload.to_province_name,'Hà Nội'); assert.equal(payload.to_ward_name,'Phường Ba Đình');
 assert.equal(payload.is_new_to_address,true); assert.equal(payload.to_district_name,undefined);
 assert.equal(payload.client_order_code,undefined); assert.equal(preview.data.order_code,'');
 for(const call of calls){assert.equal(call.options.headers.Token,'private-token');assert.equal(call.options.headers.ShopId,'123');}
});

test('print accepts documented 10000 codes and rejects overflow before upstream', async () => {
 let calls=0;
 const gateway=createGhnGateway(createGhnClient(config,async()=>{calls++;return ok({token:'test-print'});}));
 await gateway.handle('POST','/api/ghn/orders/print',{order_codes:Array.from({length:10000},(_,i)=>`CODE${i}`)});
 await assert.rejects(gateway.handle('POST','/api/ghn/orders/print',{order_codes:Array(10001).fill('CODE')}),{code:'INVALID_GHN_PAYLOAD'});
 assert.equal(calls,1);
});

test('environment trims incidental whitespace and invalid configuration fails before requests', () => {
 assert.equal(createGhnClient({...config,environment:' production '}).baseURL,'https://online-gateway.ghn.vn');
 assert.throws(()=>createGhnClient({...config,environment:'development'}),/biến GHN_ENV trong terminal/);
});
