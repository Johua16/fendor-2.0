import { NextRequest, NextResponse } from 'next/server';
import { REVIEW_ACCESS_COOKIE, reviewAccessEnabled, reviewAccessToken, reviewEntryDestination, safeReviewDestination } from '@/lib/review-access';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const submittedCode = String(form.get('code') ?? '').trim();
  const requestedDestination = safeReviewDestination(String(form.get('next') ?? '/'));
  const destination = reviewEntryDestination(process.env.BETA_REVIEW_MODE === 'true', requestedDestination);
  const configuredCode = process.env.REVIEW_ACCESS_CODE?.trim() ?? '';

  if (!reviewAccessEnabled() || !submittedCode || submittedCode !== configuredCode) {
    const retry = new URL('/review-access', request.url);
    retry.searchParams.set('error', 'invalid');
    retry.searchParams.set('next', requestedDestination);
    return NextResponse.redirect(retry, 303);
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set(REVIEW_ACCESS_COOKIE, await reviewAccessToken(configuredCode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
