import { NextRequest, NextResponse } from 'next/server';
import { canonicalReviewOrigin, REVIEW_ACCESS_COOKIE, reviewAccessEnabled, reviewAccessToken } from '@/lib/review-access';

const OPEN_PATHS = new Set(['/review-access', '/api/review-access', '/api/health', '/api/ready']);

export async function proxy(request: NextRequest) {
  if (!reviewAccessEnabled()) return NextResponse.next();

  const canonicalOrigin = canonicalReviewOrigin(process.env.APP_ORIGIN, request.url);
  if (request.nextUrl.origin !== canonicalOrigin) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonicalOrigin));
  }

  if (OPEN_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  const accessCode = process.env.REVIEW_ACCESS_CODE!.trim();
  const presentedToken = request.cookies.get(REVIEW_ACCESS_COOKIE)?.value;
  const expectedToken = await reviewAccessToken(accessCode);
  if (presentedToken === expectedToken) return NextResponse.next();

  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = new URL('/review-access', canonicalOrigin);
  url.searchParams.set('next', destination);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)']
};
