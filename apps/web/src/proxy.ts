import { NextRequest, NextResponse } from 'next/server';
import { REVIEW_ACCESS_COOKIE, reviewAccessEnabled, reviewAccessToken } from '@/lib/review-access';

const OPEN_PATHS = new Set(['/review-access', '/api/review-access', '/api/health', '/api/ready']);

export async function proxy(request: NextRequest) {
  if (!reviewAccessEnabled() || OPEN_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  const accessCode = process.env.REVIEW_ACCESS_CODE!.trim();
  const presentedToken = request.cookies.get(REVIEW_ACCESS_COOKIE)?.value;
  const expectedToken = await reviewAccessToken(accessCode);
  if (presentedToken === expectedToken) return NextResponse.next();

  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = request.nextUrl.clone();
  url.pathname = '/review-access';
  url.search = '';
  url.searchParams.set('next', destination);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)']
};
