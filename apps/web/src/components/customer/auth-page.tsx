'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { forgotPassword, resetPassword, safeNext, signIn, signUp, verifyEmail } from '../../lib/client/auth';
import styles from './auth-page.module.css';

type Mode = 'login' | 'signup' | 'forgot' | 'verify' | 'reset';
const copy = {
  login: ['Welcome back', 'Continue your Fendor orders, gifts and deliveries.'], signup: ['Create your Fendor account', 'Shop verified products and keep every order update in one place.'],
  forgot: ['Reset your password', 'We’ll queue a secure reset link if the account exists.'], verify: ['Verify your email', 'Confirm your address before using protected Fendor services.'], reset: ['Choose a new password', 'Use at least 12 characters for your new password.'],
} as const;

export function AuthPage({ mode }: { mode: Mode }) {
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [token, setToken] = useState(''); const [busy, setBusy] = useState(mode === 'verify'); const [message, setMessage] = useState(''); const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!['verify', 'reset'].includes(mode)) return;
    const params = new URLSearchParams(window.location.hash.slice(1)); const secret = params.get('token') ?? ''; setToken(secret);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (mode === 'verify') {
      if (!secret) { setMessage('This verification link is missing its token. Request a new link.'); setBusy(false); return; }
      verifyEmail(secret).then((result) => { setMessage(result.message); setSuccess(true); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Fendor could not verify this email.')).finally(() => setBusy(false));
    }
  }, [mode]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setSuccess(false);
    try {
      if (mode === 'login') { await signIn(email, password); window.location.href = safeNext(new URLSearchParams(window.location.search).get('next')); return; }
      if (mode === 'signup') { const result = await signUp(fullName, email, password); setMessage(`${result.message} Check your email for the verification link.`); setSuccess(true); }
      if (mode === 'forgot') { const result = await forgotPassword(email); setMessage(result.message); setSuccess(true); }
      if (mode === 'reset') { const result = await resetPassword(token, password); setMessage(result.message); setSuccess(true); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Fendor could not complete this request.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><section className={styles.brand}><Link href="/"><Image src="/icons/home/logo.svg" width={46} height={46} alt="" /><b>Fendor</b></Link><div><p>VERIFIED MARKETPLACE</p><h1>Thoughtful products.<br />Clear coordination.</h1><span>Fendor connects customers with verified products while keeping vendor communication, payment review and delivery inside one dependable process.</span></div><footer>Fendor · Nigeria</footer></section><section className={styles.formSide}><div className={styles.card}><Link className={styles.back} href="/">← Back to marketplace</Link><p className={styles.eyebrow}>CUSTOMER ACCOUNT</p><h2>{copy[mode][0]}</h2><p className={styles.intro}>{copy[mode][1]}</p>{message && <div className={success ? styles.success : styles.error} role="status">{message}</div>}{mode === 'verify' ? <div className={styles.verify}>{busy ? <i /> : success ? <><b>✓ Email verified</b><Link href="/login">Continue to sign in</Link></> : <><b>Verification could not be completed</b><Link href="/signup">Return to account setup</Link></>}</div> : <form onSubmit={submit}>{mode === 'signup' && <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}{['login', 'signup', 'forgot'].includes(mode) && <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}{['login', 'signup', 'reset'].includes(mode) && <label>{mode === 'reset' ? 'New password' : 'Password'}<input required minLength={mode === 'login' ? 1 : 12} maxLength={128} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /><small>{mode !== 'login' && 'Use 12–128 characters.'}</small></label>}{mode === 'login' && <Link className={styles.forgot} href="/forgot-password">Forgot password?</Link>}<button disabled={busy || (mode === 'reset' && !token)}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button></form>}<div className={styles.switch}>{mode === 'login' ? <>New to Fendor? <Link href="/signup">Create an account</Link></> : mode === 'signup' ? <>Already have an account? <Link href="/login">Sign in</Link></> : mode === 'forgot' ? <Link href="/login">Return to sign in</Link> : null}</div><p className={styles.security}>Passwords and session tokens are never stored in browser storage.</p></div></section></main>;
}
