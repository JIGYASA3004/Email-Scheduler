import { useState } from 'react';
import { server } from './net/endpoints';
import { useFetched } from './hooks/useFetched';
import { useHashView } from './hooks/useHashView';
import { Ledger } from './views/Ledger';
import { Rail } from './views/Rail';
import { Reader } from './views/Reader';
import { Welcome } from './views/Welcome';
import { Writer } from './views/Writer';

export function Root() {
  const [route, go] = useHashView();
  const [signedOut, setSignedOut] = useState(false);
  const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';

  const session = useFetched(() => server.whoAmI(), [signedOut]);
  const totals = useFetched(
    () => (session.data && !signedOut ? server.totals() : Promise.resolve(undefined)),
    [session.data, signedOut, route.screen],
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

  const me = session.data;
  // compose and reading are full-width pages, like the design; folders sit next to the rail
  if (route.screen === 'compose') {
    return (
      <div className="min-vh-100 d-flex bg-white">
        <Writer
          onClose={() => go({ screen: 'folder', folder: 'scheduled' })}
          onScheduled={() => {
            go({ screen: 'folder', folder: 'scheduled' });
            totals.refresh();
          }}
        />
      </div>
    );
  }
  if (route.screen === 'mail') {
    return (
      <div className="min-vh-100 d-flex bg-white">
        <Reader id={route.id} me={me} onBack={() => go({ screen: 'folder', folder: route.from })} />
      </div>
    );
  }

  return (
    <div className="d-flex min-vh-100 bg-white">
      <Rail
        me={me}
        active={route.folder}
        totals={totals.data}
        openFolder={(folder) => go({ screen: 'folder', folder })}
        onCompose={() => go({ screen: 'compose' })}
        onSignOut={signOut}
      />
      <Ledger
        folder={route.folder}
        onOpen={(id) => go({ screen: 'mail', id, from: route.folder })}
        onCompose={() => go({ screen: 'compose' })}
      />
    </div>
  );
}
