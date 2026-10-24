import { operationsResponse } from './http-operations.ts';
import { orderResponse } from './http-orders.ts';
import { body } from './http-input.ts';
import { catalogueResponse } from './http-catalogue.ts';
import { database, type Database } from './database.ts';
import { config } from './config.ts';
import { identity, ApiError, fail } from './identity.ts';
const COOKIE = 'fendor_session';
function sessionCookie(req: Request) {
  return req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
}
function cookie(value: string, secure: boolean, clear = false) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${secure ? '; Secure' : ''}`;
}
export async function handleIdentity(req: Request, path: string[], dependencies?: {db: Database; settings: ReturnType<typeof config>}) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  try {
    const settings = dependencies?.settings ?? config();
    if (!['GET', 'POST'].includes(req.method)) fail(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    if (req.method === 'POST' && req.headers.get('origin') !== settings.origin) fail(403, 'INVALID_ORIGIN', 'Request origin is not allowed.');
    const service = identity(dependencies?.db ?? database(), settings), secret = sessionCookie(req), key = path.join('/');
    if(req.method==='POST') await service.throttleWrites();
    const operationsResult=await operationsResponse(req,path,dependencies?.db ?? database(),secret,headers,settings);
    if(operationsResult)return operationsResult;
    const orderResult=await orderResponse(req,path,dependencies?.db ?? database(),secret,headers);
    if(orderResult) return orderResult;
    const catalogueResult = await catalogueResponse(req,path,dependencies?.db ?? database(),secret,headers);
    if(catalogueResult) return catalogueResult;
    if (req.method === 'GET') {
      let data: unknown;
      if (key === 'auth/me') data = { user: await service.me(secret) };
      else if (key === 'vendor/application') data = { application: await service.application(secret) };
      else if (key === 'vendor/access') data = await service.vendorAccess(secret);
      else if (key === 'admin/vendor-applications') data = { applications: await service.applications(secret) };
      else fail(404, 'NOT_FOUND', 'Endpoint not found.');
      return Response.json(data, { headers });
    }
    const input = await body(req);
    const fields: Record<string, string[]> = {
      'auth/signup': ['email', 'password', 'fullName','accountType'], 'auth/login': ['email', 'password'], 'auth/logout': [],
      'auth/profile': ['dateOfBirth','phone'],
      'auth/resend-verification': ['email'], 'auth/forgot-password': ['email'],
      'auth/verify-email': ['token'], 'auth/reset-password': ['token', 'password'],
      'vendor/application': ['businessName', 'businessLocation', 'country', 'registrationNumber','accountType']
    };
    const reviewing = path.length === 4 && path[0] === 'admin' && path[1] === 'vendor-applications' && path[3] === 'review';
    const allowed = reviewing ? ['decision', 'note'] : fields[key];
    if (!allowed) fail(404, 'NOT_FOUND', 'Endpoint not found.');
    if (Object.keys(input).some(k => !allowed.includes(k))) fail(400, 'UNKNOWN_FIELD', 'Unexpected request fields.');
    let data: unknown, status = 200;
    switch (key) {
      case 'auth/signup': data = await service.signup(input); status = 202; break;
      case 'auth/login': {
        const login = await service.login(input);
        if (secret) await service.logout(secret);
        headers.set('Set-Cookie', cookie(login.secret, settings.secure)); data = { user: login.user }; break;
      }
      case 'auth/logout': await service.logout(secret); headers.set('Set-Cookie', cookie('', settings.secure, true)); data = { message: 'Signed out.' }; break;
      case 'auth/profile': data={user:await service.saveProfile(secret,input)}; break;
      case 'auth/resend-verification': data = await service.requestEmail(input, 'verify'); status = 202; break;
      case 'auth/forgot-password': data = await service.requestEmail(input, 'reset'); status = 202; break;
      case 'auth/verify-email': data = await service.consume(input, 'verify'); break;
      case 'auth/reset-password': data = await service.consume(input, 'reset'); headers.set('Set-Cookie', cookie('', settings.secure, true)); break;
      case 'vendor/application': data = { application: await service.apply(secret, input) }; status = 201; break;
      default: data = { application: await service.review(secret, path[2], input) };
    }
    return Response.json(data, { status, headers });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) headers.set('Retry-After', '900');
      return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers });
    }
    console.error('Identity request failed; verify database and server configuration.');
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' } }, { status: 503, headers });
  }
}
