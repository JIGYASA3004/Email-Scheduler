import { useState } from 'react';
import { server } from './net/endpoints';
import { useFetched } from './hooks/useFetched';
import { useHashView } from './hooks/useHashView';
import { ComposeDialog } from './views/ComposeDialog';
import { Overview } from './views/Overview';
import { TopBar } from './views/TopBar';
import { Welcome } from './views/Welcome';

export function Root() {
  const [tab, setTab] = useHashView();
  const [composing, setComposing] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';

  const session = useFetched(() => server.whoAmI(), [signedOut]);
  const totals = useFetched(
    () => (session.data && !signedOut ? server.totals() : Promise.resolve(undefined)),
    [session.data, signedOut, reloadToken],
    5000,
  );

  if (session.pending && !session.data) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!session.data || signedOut) {
    const unreachable = session.error && session.error !== 'Not signed in';
    return (
      <>
        {unreachable && <div className="alert alert-warning rounded-0 m-0 small text-center">{session.error}</div>}
        <Welcome failed={loginFailed} />
      </>
    );
  }

  const signOut = async () => {
    await server.signOut().catch(() => undefined);
    setSignedOut(true);
    window.history.replaceState(null, '', '/');
  };

  return (
    <div className="min-vh-100 app-canvas">
      <TopBar me={session.data} onSignOut={signOut} />
      <Overview tab={tab} setTab={setTab} totals={totals.data} onCompose={() => setComposing(true)} reloadToken={reloadToken} />
      {composing && (
        <ComposeDialog
          onClose={() => setComposing(false)}
          onScheduled={() => {
            setComposing(false);
            setTab('scheduled');
            setReloadToken((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
