import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import { NoticeHost } from './kit/Notice';
import { Root } from './Root';

createRoot(document.getElementById('mount')!).render(
  <StrictMode>
    <NoticeHost>
      <Root />
    </NoticeHost>
  </StrictMode>,
);
