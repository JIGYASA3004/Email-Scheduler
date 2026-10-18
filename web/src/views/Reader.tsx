import type { Profile } from '../model';
import { server } from '../net/endpoints';
import { useFetched } from '../hooks/useFetched';
import { Action } from '../kit/Action';
import { Blank } from '../kit/Blank';
import { Glyph } from '../kit/Glyph';
import { Portrait } from '../kit/Portrait';
import { StateTag } from '../kit/StateTag';
import { longStamp } from '../util/clock';

/** Full view of one email: subject header, sender line, timestamp and body. */
export function Reader({ id, me, onBack }: { id: string; me: Profile; onBack: () => void }) {
  const { data: mail, error, pending, refresh } = useFetched(() => server.delivery(id), [id], 5000);

  return (
    <section className="flex-grow-1 overflow-auto bg-white">
      <header className="d-flex align-items-center gap-3 px-4 py-3">
        <Action tone="plain" icon="back" aria-label="Back" onClick={onBack} />
        <h1 className="h5 m-0 flex-grow-1 text-truncate">{mail?.subject ?? (pending ? 'Loading…' : 'Email')}</h1>
        {mail?.previewUrl && (
          <a className="btn btn-link text-body-secondary p-1" href={mail.previewUrl} target="_blank" rel="noreferrer" title="Open in Ethereal">
            <Glyph name="external" />
          </a>
        )}
        <span className="vr mx-1" />
        <Portrait src={me.picture} name={me.name} size={30} />
      </header>

      {pending && !mail ? (
        <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
      ) : error && !mail ? (
        <Blank icon="close" title="Couldn't open this email" hint={error} action={<Action tone="outline" small onClick={refresh}>Try again</Action>} />
      ) : (
        mail && (
          <article className="reader-body mx-auto px-3 pb-5">
            <div className="d-flex align-items-start gap-3 mb-4">
              <Portrait src={null} name={mail.sender} size={40} />
              <div className="flex-grow-1">
                <div className="small">
                  <span className="fw-semibold">{mail.sender.split('@')[0]}</span>{' '}
                  <span className="text-body-secondary">&lt;{mail.sender}&gt;</span>
                </div>
                <div className="tiny text-body-secondary">to {mail.recipient}</div>
              </div>
              <div className="text-end">
                <div className="tiny text-body-secondary mb-1">{longStamp(mail.sentAt ?? mail.dueAt)}</div>
                <StateTag state={mail.state} at={mail.dueAt} />
              </div>
            </div>
            {mail.state === 'failed' && mail.error && <div className="alert alert-danger py-2 small">{mail.error}</div>}
            <div className="mail-text small">{mail.body}</div>
          </article>
        )
      )}
    </section>
  );
}
