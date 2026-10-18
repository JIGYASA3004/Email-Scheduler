import type { DeliveryItem, FolderName } from '../model';
import { RowsLoading } from '../kit/Blank';
import { Glyph } from '../kit/Glyph';
import { StateTag } from '../kit/StateTag';
import { longStamp, stamp } from '../util/clock';

interface DeliveryTableProps {
  folder: FolderName;
  items: DeliveryItem[] | undefined;
  loading: boolean;
}

/** Email | Subject | Scheduled/Sent time | Status, shared by both tabs. */
export function DeliveryTable({ folder, items, loading }: DeliveryTableProps) {
  const timeLabel = folder === 'sent' ? 'Sent time' : 'Scheduled time';
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0 delivery-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Subject</th>
            <th>{timeLabel}</th>
            <th>Status</th>
            <th aria-label="Preview" />
          </tr>
        </thead>
        {loading && !items ? (
          <RowsLoading cols={5} />
        ) : (
          <tbody>
            {items?.map((item) => {
              const when = folder === 'sent' ? item.sentAt ?? item.dueAt : item.dueAt;
              return (
                <tr key={item.id}>
                  <td className="text-truncate" style={{ maxWidth: 220 }}>
                    <div className="fw-medium">{item.recipient}</div>
                    <div className="tiny text-body-secondary text-truncate">via {item.sender}</div>
                  </td>
                  <td className="text-truncate" style={{ maxWidth: 320 }}>
                    <div>{item.subject}</div>
                    <div className={`tiny text-truncate ${item.state === 'failed' ? 'text-danger' : 'text-body-secondary'}`}>
                      {item.state === 'failed' && item.error ? item.error : item.snippet}
                    </div>
                  </td>
                  <td className="text-nowrap small" title={longStamp(when)}>
                    {stamp(when)}
                  </td>
                  <td>
                    <StateTag state={item.state} />
                  </td>
                  <td className="text-end">
                    {item.previewUrl && (
                      <a className="btn btn-sm btn-link text-body-secondary" href={item.previewUrl} target="_blank" rel="noreferrer" title="View in Ethereal">
                        <Glyph name="external" size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
