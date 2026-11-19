import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, SearchX } from 'lucide-react';
import { useVerifyCertificateQuery } from '../store/api.js';
import { CertificateCard } from './Certificates.jsx';
import { Spinner } from '../components/ui.jsx';
import { assetUrl } from '../lib/format.js';

export default function VerifyCertificate() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || '');
  const { data, isFetching, error } = useVerifyCertificateQuery(code, { skip: !code });

  const submit = (e) => {
    e.preventDefault();
    const value = input.trim().toUpperCase();
    if (value) navigate(`/verify/${encodeURIComponent(value)}`);
  };

  return (
    <div className="page max-w-2xl pt-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">Verify a certificate</h1>
      <p className="mt-2 text-ink-soft">Enter the certificate ID printed at the bottom of a Homeroom certificate.</p>
      <form onSubmit={submit} className="mt-7 flex gap-2">
        <label className="flex-1"><span className="sr-only">Certificate ID</span>
          <input className="field h-12 text-base uppercase tabular placeholder:normal-case" placeholder="For example HR-7KQ2M9XB4T" value={input} onChange={(e) => setInput(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary btn-lg" disabled={isFetching}>{isFetching && <Spinner />}Check</button>
      </form>

      <div className="mt-8" aria-live="polite">
        {code && data && (
          <>
            <p className="mb-4 flex items-center gap-2 font-semibold text-pass"><BadgeCheck className="h-5 w-5" aria-hidden="true" />This certificate is genuine.</p>
            <CertificateCard cert={data.certificate} actions={<a href={assetUrl(data.certificate.pdfUrl)} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Open the PDF</a>} />
          </>
        )}
        {code && error && !isFetching && (
          <p className="flex items-start gap-2 rounded-lg border border-redpen/25 bg-redpen-light px-4 py-3 text-sm text-redpen">
            <SearchX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />No certificate has the ID {code}. Check for typing mistakes: IDs start with HR- and never contain the letters I or O.
          </p>
        )}
      </div>
    </div>
  );
}
