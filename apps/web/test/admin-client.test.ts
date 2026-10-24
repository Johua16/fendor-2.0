import assert from 'node:assert/strict';
import test from 'node:test';
import { adminOrderAction, getAdminDelivery, getAdminRemedy, listMailFailures, retryMail, saveDeliveryZone } from '../src/lib/client/admin.ts';

test('admin operations use protected order, mail, and delivery-zone contracts', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{path:string;method?:string;body?:unknown}> = [];
  globalThis.fetch = async (input, init) => { calls.push({path:String(input),method:init?.method,body:init?.body?JSON.parse(String(init.body)):undefined}); return Response.json(String(input).endsWith('/mail-failures')?{failures:[]}:null); };
  try {
    await getAdminDelivery('order-1'); await getAdminRemedy('order-1'); await listMailFailures(); await retryMail('mail-1');
    await saveDeliveryZone({name:'Central Abuja',state:'FCT',city:'Abuja',active:true,version:0});
    await adminOrderAction('order-1','dispatch',{version:8,note:'Assigned to Fendor delivery.',assignedTo:'admin-1',trackingReference:'FEN-100'});
    assert.deepEqual(calls.map(value=>value.path),['/api/admin/orders/order-1/delivery','/api/admin/orders/order-1/remedy','/api/admin/mail-failures','/api/admin/mail-failures/mail-1/retry','/api/admin/delivery-zones','/api/admin/orders/order-1/dispatch']);
    assert.deepEqual(calls[5].body,{version:8,note:'Assigned to Fendor delivery.',assignedTo:'admin-1',trackingReference:'FEN-100'});
  } finally { globalThis.fetch=originalFetch; }
});
