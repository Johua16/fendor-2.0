'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  AccountType, AuthApiError, forgotPassword, resendVerification, resetPassword,
  accountDestination, signInDestination, signIn, signUp, verifyEmail,
} from '../../lib/client/auth';
import styles from './auth-page.module.css';

type Mode = 'login' | 'signup' | 'forgot' | 'verify' | 'reset' | 'password-created';
const copy: Record<Mode, [string, string]> = {
  login: ['Welcome back', 'Sign in to continue your Fendor journey.'],
  signup: ['Create an account', 'Join Fendor as a customer or marketplace vendor.'],
  forgot: ['Forgot password?', 'Enter your email to request a secure reset link.'],
  verify: ['Verify your email', 'We are confirming your email address.'],
  reset: ['Create new password', 'Choose a secure password you have not used before.'],
  'password-created': ['Password created', 'Your password has been updated. Sign in to continue.'],
};

function errorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.status === 503) return 'This service is temporarily unavailable. Please try again shortly.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Fendor could not complete this request.';
}

export function AuthPage({ mode }: { mode: Mode }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(mode === 'verify');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [show, setShow] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [loginReason, setLoginReason] = useState('');
  const [reviewSignup, setReviewSignup] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('role') === 'vendor') setAccountType('vendor');
    if (mode === 'login') {
      if (query.get('reason') === 'expired') setLoginReason('Your session has expired. Sign in again to continue.');
      if (query.get('reason') === 'signed-out') setLoginReason('You have signed out securely.');
    }
    if (mode !== 'verify' && mode !== 'reset') return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const secret = params.get('token') ?? '';
    setToken(secret);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (mode === 'verify') {
      if (!secret) {
        setMessage('Open the verification link sent to your email, or request a new one below.');
        setBusy(false);
        return;
      }
      verifyEmail(secret)
        .then((result) => { setMessage(result.message); setSuccess(true); })
        .catch((error: unknown) => setMessage(errorMessage(error)))
        .finally(() => setBusy(false));
    }
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setSuccess(false);
    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = signInDestination(result.user, next);
        return;
      }
      if (mode === 'signup') {
        if (password !== confirm) throw Error('Passwords do not match.');
        const result = await signUp(fullName, email, password, accountType);
        if (result.reviewMode === true) {
          setMessage('Your review account is ready. Signing you in…');
          try {
            const login = await signIn(email, password);
            const destination = accountDestination(login.user);
            window.location.replace(destination === '/account' ? '/' : destination);
          } catch {
            setMessage('Your review account is ready, but automatic sign-in did not complete. Continue to sign in.');
            setReviewSignup(true);
            setSuccess(true);
          }
          return;
        }
        setMessage(result.message);
        setReviewSignup(false);
        setSuccess(true);
      }
      if (mode === 'forgot') {
        const result = await forgotPassword(email);
        setMessage(result.message);
        setSuccess(true);
      }
      if (mode === 'reset') {
        if (password !== confirm) throw Error('Passwords do not match.');
        await resetPassword(token, password);
        window.location.replace('/password-created');
        return;
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resend(event: FormEvent) {
    event.preventDefault();
    setResendBusy(true);
    setResendMessage('');
    try {
      const result = await resendVerification(resendEmail);
      setResendMessage(result.message);
    } catch (error) {
      setResendMessage(errorMessage(error));
    } finally {
      setResendBusy(false);
    }
  }

  const submitLabel = busy ? 'Please wait…' : mode === 'login' ? 'Sign in'
    : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Reset password';
  return <main className={styles.page}>
    <section className={styles.visual} aria-hidden="true">
      <Link href="/" className={styles.logo}><Image src="/icons/home/logo.svg" width={42} height={42} alt="" /><b>Fendor</b></Link>
      <Image className={styles.ribbon} src="/images/onboarding/74583795-5c3f-4f99-bd29-e22e03973ebe" width={896} height={1200} alt="" priority />
      <p>Thoughtful gifting, coordinated by Fendor.</p>
    </section>
    <section className={styles.formSide}><div className={styles.card}>
      <Link className={styles.back} href={mode === 'signup' ? '/welcome' : '/'}>← Back</Link>
      <p className={styles.eyebrow}>{mode === 'signup' ? accountType.toUpperCase() : 'FENDOR ACCOUNT'}</p>
      <h1>{copy[mode][0]}</h1><p className={styles.intro}>{copy[mode][1]}</p>
      {loginReason && <div className={styles.notice} role="status">{loginReason}</div>}
      {message && <div className={success ? styles.success : mode === 'verify' && !token ? styles.notice : styles.error} role={success || (mode === 'verify' && !token) ? 'status' : 'alert'}>{message}</div>}
      {mode === 'verify' ? <div className={styles.verify}>
        {busy ? <><i /><p>Checking your verification link…</p></> : success
          ? <><b>✓ Email verified</b><Link href="/login">Continue to sign in</Link></>
          : !token ? <><b>Check your inbox</b><p>Follow the email link to verify your account. You can request another link below.</p></> : <><b>Verification could not be completed</b><p>The link may have expired or already been used.</p></>}
      </div> : mode === 'password-created' ? <div className={styles.verify}>
        <b>✓ Your new password is ready</b><p>Use it to sign in to your Fendor account.</p>
        <Link href="/login">Continue to sign in</Link>
      </div> : success && mode === 'signup' ? <div className={styles.verify}>
        <span className={styles.mail}>{reviewSignup ? '✓' : '✉'}</span><b>{reviewSignup ? 'Private-review account ready' : 'Check your inbox'}</b>
        <p>{reviewSignup ? 'Email verification is temporarily bypassed for this private product review. No payment will be collected.' : `If the address is eligible, Fendor will send a verification link to ${email}.`}</p>
        <Link href="/login">Go to sign in</Link>
        {!reviewSignup && <Link className={styles.secondaryLink} href="/verify-email">Need another verification link?</Link>}
      </div> : <form onSubmit={submit}>
        {mode === 'signup' && <>
          <div className={styles.roleTabs} role="group" aria-label="Account type">
            <button type="button" aria-pressed={accountType === 'customer'} className={accountType === 'customer' ? styles.active : ''} onClick={() => setAccountType('customer')}>Customer</button>
            <button type="button" aria-pressed={accountType === 'vendor'} className={accountType === 'vendor' ? styles.active : ''} onClick={() => setAccountType('vendor')}>Vendor</button>
          </div>
          <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        </>}
        {['login', 'signup', 'forgot'].includes(mode) && <label>Email address<input required type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
        {['login', 'signup', 'reset'].includes(mode) && <label>{mode === 'reset' ? 'New password' : 'Password'}
          <span className={styles.password}><input required minLength={mode === 'login' ? 1 : 12} maxLength={128} type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••••••" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></span>
          {mode !== 'login' && <small>Use at least 12 characters.</small>}</label>}
        {['signup', 'reset'].includes(mode) && <label>Confirm password<input required minLength={12} maxLength={128} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>}
        {mode === 'signup' && <label className={styles.consent}><input required type="checkbox" /><span>I agree to Fendor’s <Link href="/policies/terms">Terms</Link> and <Link href="/policies/privacy">Privacy Policy</Link>.</span></label>}
        {mode === 'login' && <Link className={styles.forgot} href="/forgot-password">Forgot password?</Link>}
        {mode === 'reset' && !token && <div className={styles.error} role="alert">This reset link is incomplete. Request a new one.</div>}
        <button className={styles.primary} disabled={busy || (mode === 'reset' && !token)}>{submitLabel}</button>
      </form>}
      {mode === 'verify' && !success && !busy && <form className={styles.resend} onSubmit={resend}>
        <label>Email address<input required type="email" autoComplete="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} placeholder="name@example.com" /></label>
        <button className={styles.primary} disabled={resendBusy}>{resendBusy ? 'Please wait…' : 'Resend verification link'}</button>
        {resendMessage && <div className={styles.notice} role="status">{resendMessage}</div>}
      </form>}
      <div className={styles.switch}>{mode === 'login' ? <>New to Fendor? <Link href="/welcome">Create account</Link></>
        : mode === 'signup' ? <>Already have an account? <Link href={accountType === 'vendor' ? '/login?next=/vendor' : '/login'}>Sign in</Link></>
          : mode === 'forgot' || mode === 'reset' ? <Link href="/login">Back to sign in</Link> : null}</div>
    </div></section>
  </main>;
}
