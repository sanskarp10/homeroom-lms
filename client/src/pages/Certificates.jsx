import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Award, Download, Link2 } from 'lucide-react';
import { useGetCertificatesQuery } from '../store/api.js';
import { toast } from '../store/uiSlice.js';
import { Empty, Skeleton } from '../components/ui.jsx';
import { dateLabel, assetUrl } from '../lib/format.js';

export function CertificateCard({ cert, actions }) {
  return (
    <article className="overflow-hidden rounded-panel border border-line bg-white shadow-lift">
      <div className="flex">
        <div className="board flex w-16 shrink-0 flex-col items-center justify-end pb-4 sm:w-20">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-pencil text-board"><Award className="h-5 w-5" aria-hidden="true" /></span>
        </div>
        <div className="min-w-0 flex-1 p-5">
          <p className="text-xs text-ink-faint">Certificate of completion</p>
          <h3 className="mt-1 font-display text-xl font-semibold leading-snug">{cert.courseTitle}</h3>
          <p className="mt-1 text-sm text-ink-soft">Awarded to {cert.studentName}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div><dt className="text-ink-faint">Issued</dt><dd className="font-semibold">{dateLabel(cert.issuedAt)}</dd></div>
            <div><dt className="text-ink-faint">Instructor</dt><dd className="font-semibold">{cert.instructorName}</dd></div>
            <div><dt className="text-ink-faint">Certificate ID</dt><dd className="font-semibold tabular">{cert.code}</dd></div>
          </dl>
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

export default function Certificates() {
  const { data, isLoading } = useGetCertificatesQuery();
  const dispatch = useDispatch();
  const copy = async (code) => {
    const url = `${window.location.origin}/verify/${code}`;
    try { await navigator.clipboard.writeText(url); dispatch(toast.success('Verification link copied.')); }
    catch { dispatch(toast.info(url)); }
  };
  return (
    <div className="page max-w-4xl pt-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">Certificates</h1>
      <p className="mt-2 text-ink-soft">One for every course you finish. Each has an ID that anyone can check.</p>
      <div className="mt-8 space-y-5">
        {isLoading && <><Skeleton className="h-44 rounded-panel" /><Skeleton className="h-44 rounded-panel" /></>}
        {data?.items.map((cert) => (
          <CertificateCard key={cert.id} cert={cert} actions={<>
            <a href={assetUrl(`${cert.pdfUrl}?download=1`)} className="btn-primary btn-sm"><Download className="h-4 w-4" />Download PDF</a>
            <a href={assetUrl(cert.pdfUrl)} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Open</a>
            <button type="button" onClick={() => copy(cert.code)} className="btn-outline btn-sm"><Link2 className="h-4 w-4" />Copy verification link</button>
          </>} />
        ))}
        {data && data.items.length === 0 && (
          <Empty icon={Award} title="No certificates yet" action={<Link to="/learning" className="btn-primary">Go to my learning</Link>}>
            Complete every lesson in a course and pass its quizzes. The certificate appears here straight away.
          </Empty>
        )}
      </div>
    </div>
  );
}
