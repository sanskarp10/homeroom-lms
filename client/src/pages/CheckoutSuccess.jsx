import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { useVerifyStripeQuery } from '../store/api.js';
import { Empty, PageLoader } from '../components/ui.jsx';
import { amount, errorMessage } from '../lib/format.js';

/** Stripe sends buyers back here. The session is confirmed with the server before access is shown. */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const { data, isLoading, error } = useVerifyStripeQuery(sessionId, { skip: !sessionId });

  if (!sessionId) return <div className="page pt-16"><Empty title="Nothing to confirm" action={<Link to="/learning" className="btn-primary">Go to my learning</Link>}>This page is shown after a payment.</Empty></div>;
  if (isLoading) return <PageLoader label="Confirming your payment" />;
  if (error) return <div className="page pt-16"><Empty title="The payment could not be confirmed" action={<Link to="/learning" className="btn-primary">Go to my learning</Link>}>{errorMessage(error)} If you were charged, the course appears in your learning within a minute.</Empty></div>;

  const paid = data.order.status === 'paid';
  return (
    <div className="page grid min-h-[50vh] place-items-center pt-10 text-center">
      <div className="max-w-md">
        <CircleCheck className="mx-auto h-12 w-12 text-pass" strokeWidth={1.6} aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-semibold">{paid ? 'You are enrolled' : 'Payment is still processing'}</h1>
        <p className="mt-2 text-ink-soft">
          {paid ? `${amount(data.order.amount, data.order.currency)} paid for ${data.order.course?.title}.` : 'Your bank has not confirmed the payment yet. Reload this page in a moment.'}
        </p>
        {paid && <Link to={`/learn/${data.courseId}`} className="btn-accent btn-lg mt-6">Start the first lesson</Link>}
      </div>
    </div>
  );
}
