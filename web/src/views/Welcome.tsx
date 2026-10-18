import { GOOGLE_SIGN_IN_URL } from '../net/endpoints';
import { Glyph, type GlyphName } from '../kit/Glyph';

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const POINTS: { icon: GlyphName; text: string }[] = [
  { icon: 'clock', text: 'Schedule thousands of emails to start whenever you like' },
  { icon: 'board', text: 'Per-sender pacing and hourly limits keep providers happy' },
  { icon: 'refresh', text: 'Jobs survive restarts and are never sent twice' },
];

/** Split-screen sign-in: product pitch on the left, Google button on the right. */
export function Welcome({ failed }: { failed: boolean }) {
  return (
    <main className="container-fluid min-vh-100">
      <div className="row min-vh-100">
        <section className="col-lg-6 d-none d-lg-flex flex-column justify-content-center hero-pane text-white p-5">
          <div className="hero-copy">
            <div className="d-flex align-items-center gap-2 mb-4 fs-5 fw-semibold">
              <span className="brand-badge"><Glyph name="send" size={18} /></span> Outbox
            </div>
            <h1 className="display-6 fw-bold mb-4">Bulk email, delivered on your schedule.</h1>
            <ul className="list-unstyled d-grid gap-3 mb-0">
              {POINTS.map((p) => (
                <li key={p.text} className="d-flex gap-3 align-items-start">
                  <span className="hero-icon"><Glyph name={p.icon} /></span>
                  <span className="opacity-75">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="col-lg-6 d-flex align-items-center justify-content-center p-4">
          <div className="w-100" style={{ maxWidth: 380 }}>
            <h2 className="h3 fw-bold mb-1">Welcome back</h2>
            <p className="text-body-secondary mb-4">Sign in with your Google account to open your outbox.</p>
            {failed && <div className="alert alert-danger py-2 small">Google sign-in didn't complete. Please try again.</div>}
            <a href={GOOGLE_SIGN_IN_URL} className="btn btn-outline-secondary btn-lg w-100 d-flex align-items-center justify-content-center gap-3 google-btn">
              <GoogleMark /> Continue with Google
            </a>
            <p className="small text-body-secondary mt-4 mb-0">
              We only read your name, email and profile picture.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
