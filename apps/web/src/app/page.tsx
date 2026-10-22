export default function Home() {
  return <main>
    <p className="eyebrow">FENDOR · DEVELOPMENT PREVIEW</p>
    <h1>One foundation.<br />Built together.</h1>
    <p>The shared application is ready for frontend and backend development. This temporary page will be replaced by the approved Figma homepage.</p>
    <section aria-labelledby="status"><h2 id="status">What is ready?</h2>
      <ul><li>Next.js, React and TypeScript application</li><li>Backend order rules with automated tests</li><li>Shared ownership and integration instructions</li></ul>
      <p>Accounts, persistent storage and checkout are not connected yet.</p>
    </section>
    <a href="/api/health">Check application health →</a>
  </main>;
}
