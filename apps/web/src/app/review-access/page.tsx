import styles from './review-access.module.css';
import { redirect } from 'next/navigation';
import { reviewAccessEnabled, safeReviewDestination } from '@/lib/review-access';

type ReviewAccessPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function ReviewAccessPage({ searchParams }: ReviewAccessPageProps) {
  if (!reviewAccessEnabled()) redirect('/');
  const params = await searchParams;
  const destination = safeReviewDestination(params.next);

  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-label="Fendora private beta">
        <div className={styles.brand}><span className={styles.mark}>F</span><span>Fendora</span></div>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Private team review</p>
          <h1>Thoughtful gifting, coordinated beautifully.</h1>
          <p>Explore the customer, vendor and operations journeys before Fendora&apos;s public beta.</p>
        </div>
        <div className={styles.orbit} aria-hidden="true"><span /><span /><span /></div>
      </section>

      <section className={styles.access}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Fendora beta</p>
          <h2>Enter the review space</h2>
          <p className={styles.description}>Use the access code shared by the Fendora team. Access lasts for seven days on this device.</p>

          {params.error ? <p className={styles.error} role="alert">That access code is not correct. Please check it and try again.</p> : null}

          <form action="/api/review-access" method="post" className={styles.form}>
            <input type="hidden" name="next" value={destination} />
            <label htmlFor="review-code">Review access code</label>
            <input id="review-code" name="code" type="password" autoComplete="off" required autoFocus placeholder="Enter access code" />
            <button type="submit">Enter Fendora beta</button>
          </form>

          <div className={styles.notice}>
            <strong>For approved reviewers only</strong>
            <span>Use test information. Payments in this environment are simulated.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
