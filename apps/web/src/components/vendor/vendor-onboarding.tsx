'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AuthApiError, currentUser, CurrentUser, saveOnboardingProfile,
  submitVendorApplication, vendorApplication, VendorApplication,
} from '../../lib/client/auth';
import { DocumentUpload, uploadBusinessDocument } from '../../lib/client/onboarding';
import styles from './vendor-onboarding.module.css';

const places: Record<string, string[]> = {
  Abia: ['Umuahia', 'Aba'], Adamawa: ['Yola'], 'Akwa Ibom': ['Uyo'], Anambra: ['Awka', 'Onitsha'],
  Bauchi: ['Bauchi'], Bayelsa: ['Yenagoa'], Benue: ['Makurdi'], Borno: ['Maiduguri'],
  'Cross River': ['Calabar'], Delta: ['Asaba', 'Warri'], Ebonyi: ['Abakaliki'],
  Edo: ['Benin City'], Ekiti: ['Ado Ekiti'], Enugu: ['Enugu'],
  FCT: ['Abuja', 'Gwarinpa', 'Kubwa'], Gombe: ['Gombe'], Imo: ['Owerri'], Jigawa: ['Dutse'],
  Kaduna: ['Kaduna', 'Zaria'], Kano: ['Kano'], Katsina: ['Katsina'], Kebbi: ['Birnin Kebbi'],
  Kogi: ['Lokoja'], Kwara: ['Ilorin'], Lagos: ['Ikeja', 'Lekki', 'Victoria Island', 'Yaba'],
  Nasarawa: ['Lafia'], Niger: ['Minna'], Ogun: ['Abeokuta'], Ondo: ['Akure'],
  Osun: ['Osogbo'], Oyo: ['Ibadan'], Plateau: ['Jos'], Rivers: ['Port Harcourt'],
  Sokoto: ['Sokoto'], Taraba: ['Jalingo'], Yobe: ['Damaturu'], Zamfara: ['Gusau'],
};
const headings = [
  ['Choose your country', 'Tell us where your business operates.'],
  ['Set up your account', 'Add the contact details Fendor will use for marketplace operations.'],
  ['Confirm your details', 'Review your personal information before adding the business.'],
  ['Business details', 'Tell Fendor about the business you want us to verify.'],
  ['Business document', 'Upload an image of your registration document for separate review.'],
];

export function VendorOnboarding() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [application, setApplication] = useState<VendorApplication | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('NG');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'individual' | 'company'>('individual');
  const [business, setBusiness] = useState('');
  const [rc, setRc] = useState('');
  const [state, setState] = useState('FCT');
  const [city, setCity] = useState('Abuja');
  const [address, setAddress] = useState('');
  const [terms, setTerms] = useState(false);
  const [document, setDocument] = useState<DocumentUpload | null>(null);
  const [documentName, setDocumentName] = useState('');

  useEffect(() => {
    Promise.all([currentUser(), vendorApplication()])
      .then(([account, existing]) => {
        setUser(account.user);
        setApplication(existing.application);
        setDob(account.user.dateOfBirth ?? '');
        setPhone(account.user.phone ?? '');
        if (existing.application) {
          setType(existing.application.account_type);
          setBusiness(existing.application.business_name);
          setRc(existing.application.registration_number);
          const parts = existing.application.business_location.split(',').map((part) => part.trim());
          setAddress(parts[0] ?? '');
          setCity(parts[1] ?? 'Abuja');
          setState(parts[2] ?? 'FCT');
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof AuthApiError && caught.status === 401) {
          window.location.href = '/login?reason=expired&next=/vendor/onboarding';
        } else setError(caught instanceof Error ? caught.message : 'Could not load onboarding.');
      })
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => places[state] ?? [], [state]);
  function next(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStep((current) => Math.min(5, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function saveContact(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await saveOnboardingProfile(dob, phone);
      setUser(result.user);
      setStep(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your details.');
    } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const result = await uploadBusinessDocument(file);
      setDocument(result);
      setDocumentName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload the document.');
    } finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submitVendorApplication({
        accountType: type, businessName: business,
        businessLocation: [address, city, state].filter(Boolean).join(', '),
        country, registrationNumber: rc,
      });
      const result = await vendorApplication();
      setApplication(result.application);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your application.');
    } finally { setBusy(false); }
  }

  if (loading) return <main className={styles.page}><div className={styles.loading} role="status"><i /><p>Preparing your Fendor application…</p></div></main>;
  if (application && !['draft', 'changes_requested'].includes(application.status)) return <Status application={application} />;
  const [title, intro] = headings[step - 1];
  return <main className={styles.page}>
    <Image className={styles.ribbonTop} src="/images/onboarding/74583795-5c3f-4f99-bd29-e22e03973ebe" width={720} height={965} alt="" />
    <Image className={styles.ribbonBottom} src="/images/onboarding/f1af9ffc-3a90-4e5b-8855-a2ee994d3a59" width={320} height={320} alt="" />
    <header><Link href="/"><Image src="/icons/home/logo.svg" width={39} height={39} alt="" /><b>Fendor</b></Link><Link href="/account">Save & exit</Link></header>
    <section className={styles.card}>
      <div className={styles.progress} aria-label={`Step ${step} of 5`}>{[1, 2, 3, 4, 5].map((number) => <span key={number} className={number <= step ? styles.done : ''} />)}</div>
      <p className={styles.kicker}>VENDOR APPLICATION · STEP {step} OF 5</p>
      <h1>{title}</h1><p className={styles.intro}>{intro}</p>
      {application?.status === 'changes_requested' && <div className={styles.note} role="status"><b>Changes requested</b><span>{application.review_note || 'Please update and resubmit your business details.'}</span></div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {step === 1 && <form onSubmit={next}><label>Country<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="NG">Nigeria</option></select><small>Fendor’s first vendor network currently operates in Nigeria.</small></label><button>Next</button></form>}
      {step === 2 && <form onSubmit={saveContact}>
        <label>Date of birth<input required type="date" value={dob} onChange={(event) => setDob(event.target.value)} /><small>You must be at least 18 to operate a vendor account.</small></label>
        <label>Email address<input readOnly value={user?.email ?? ''} /><small className={styles.verified}>{user?.verified ? '✓ Verified through your secure email link' : 'Verify your email before uploading documents.'}</small></label>
        <label>Phone number<input required inputMode="tel" autoComplete="tel" placeholder="0801 234 5678" value={phone} onChange={(event) => setPhone(event.target.value)} /><small>Used by Fendor operations. It is never shown to customers.</small></label>
        <Nav back={() => setStep(1)} busy={busy} />
      </form>}
      {step === 3 && <form onSubmit={next}><div className={styles.review}>
        <span><small>Full name</small><b>{user?.fullName}</b></span><span><small>Email</small><b>{user?.email}</b></span>
        <span><small>Date of birth</small><b>{dob}</b></span><span><small>Phone</small><b>{phone}</b></span>
      </div><p className={styles.privacy}>Fendor keeps vendor and customer contact details private. All order communication stays inside the platform.</p><Nav back={() => setStep(2)} /></form>}
      {step === 4 && <form onSubmit={next}>
        <fieldset><legend>Account type</legend><div className={styles.choice}>
          <label className={type === 'individual' ? styles.selected : ''}><input type="radio" name="type" checked={type === 'individual'} onChange={() => setType('individual')} />Individual</label>
          <label className={type === 'company' ? styles.selected : ''}><input type="radio" name="type" checked={type === 'company'} onChange={() => setType('company')} />Company</label>
        </div></fieldset>
        <label>Business name<input required minLength={2} value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="Your trading or company name" /></label>
        <label>Business registration number<input required value={rc} onChange={(event) => setRc(event.target.value)} placeholder="Registration number" /><small>The current application service requires this number for all applicants.</small></label>
        <div className={styles.location}><label>State<select value={state} onChange={(event) => { const selected = event.target.value; setState(selected); setCity(places[selected][0]); }}>{Object.keys(places).map((item) => <option key={item}>{item}</option>)}</select></label><label>City<select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <p className={styles.privacy}>Pilot city options are limited. If your business city is missing, contact Fendor before submitting.</p>
        <label>Business address<input required minLength={5} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street or area" /></label>
        <Nav back={() => setStep(3)} />
      </form>}
      {step === 5 && <form onSubmit={submit}>
        <label>Business document image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !user?.verified} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><small>JPEG, PNG or WebP, up to 5 MB. Fendor reviews uploaded documents separately. An upload does not mean approval.</small></label>
        {!user?.verified && <p className={styles.privacy}>Verify your email before uploading a business document. <Link href="/verify-email">Request a new link</Link></p>}
        {document && <div className={styles.note} role="status"><b>{documentName} uploaded</b><span>Document status: pending review. Reference {document.id}.</span></div>}
        <p className={styles.privacy}>Your application will be submitted for review. The document upload is a separate review item and is not automatically attached to your application.</p>
        <label className={styles.terms}><input required type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>I agree to the <Link href="/policies/terms">vendor terms</Link> and understand that Fendor will review this application.</span></label>
        <Nav back={() => setStep(4)} busy={busy} final />
      </form>}
    </section>
  </main>;
}

function Nav({ back, busy = false, final = false }: { back: () => void; busy?: boolean; final?: boolean }) {
  return <div className={styles.nav}><button type="button" onClick={back}>Back</button><button disabled={busy}>{busy ? 'Please wait…' : final ? 'Submit for review' : 'Next'}</button></div>;
}

const statusContent: Record<string, { title: string; detail: string; action: string; href: string }> = {
  submitted: { title: 'Application submitted', detail: 'Fendor has received your application. Our team will review your business details and notify you of a decision.', action: 'Return to account', href: '/account' },
  under_review: { title: 'Application under review', detail: 'Our team is reviewing your business details. You do not need to submit again.', action: 'Return to account', href: '/account' },
  approved: { title: 'Your application is approved', detail: 'Your vendor access is active. You can open your workspace and prepare your business profile.', action: 'Open vendor workspace', href: '/vendor' },
  rejected: { title: 'Application rejected', detail: 'This application cannot be resubmitted through the current service. Review the reason below and contact Fendor support if you need help.', action: 'Contact Fendor support', href: '/support' },
  suspended: { title: 'Vendor access suspended', detail: 'Your vendor workspace is unavailable while this suspension is active. Review the reason below and contact Fendor support.', action: 'Contact Fendor support', href: '/support' },
};
function Status({ application }: { application: VendorApplication }) {
  const content = statusContent[application.status] ?? statusContent.submitted;
  return <main className={styles.page}><header><Link href="/"><Image src="/icons/home/logo.svg" width={39} height={39} alt="" /><b>Fendor</b></Link></header>
    <section className={`${styles.card} ${styles.status}`}><span aria-hidden="true">{application.status === 'approved' ? '✓' : application.status === 'rejected' || application.status === 'suspended' ? '!' : '⌛'}</span>
      <p className={styles.kicker}>APPLICATION {application.status.replaceAll('_', ' ').toUpperCase()}</p><h1>{content.title}</h1><p>{content.detail}</p>
      {application.review_note && <div className={styles.note}><b>Fendor review note</b><span>{application.review_note}</span></div>}
      <Link href={content.href}>{content.action}</Link>
    </section>
  </main>;
}
