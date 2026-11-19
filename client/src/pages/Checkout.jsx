import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { LockKeyhole, FlaskConical } from 'lucide-react';
import { useGetOrderQuery, usePayTestMutation } from '../store/api.js';
import { toast } from '../store/uiSlice.js';
import CourseCover from '../components/CourseCover.jsx';
import { Empty, ErrorNote, Field, PageLoader, Spinner } from '../components/ui.jsx';
import { amount, errorMessage } from '../lib/format.js';

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Built-in test gateway. With Stripe configured, buyers are sent to Stripe Checkout instead and never see this page. */
export default function Checkout() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data, isLoading, error } = useGetOrderQuery(orderId);
  const [pay, payState] = usePayTestMutation();
  const [card, setCard] = useState({ name: '', cardNumber: '', expiry: '', cvc: '' });

  if (isLoading) return <PageLoader />;
  if (error) return <div className="page pt-16"><Empty title="This order could not be found" action={<Link to="/courses" className="btn-primary">Browse courses</Link>}>{errorMessage(error)}</Empty></div>;
  const { order } = data;
  const course = order.course;

  const submit = async (e) => {
    e.preventDefault();
    try {
      const result = await pay({ orderId, ...card }).unwrap();
      dispatch(toast.success('Payment received. You are enrolled.'));
      navigate(`/learn/${result.courseId}`, { replace: true });
    } catch { /* shown in the form */ }
  };
  const fillTestCard = () => setCard((c) => ({ name: c.name || 'Test Student', cardNumber: '4242 4242 4242 4242', expiry: '12/34', cvc: '123' }));

  return (
    <div className="page grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 lg:pt-14">
      <div className="max-w-xl">
        <h1 className="text-4xl font-semibold">Checkout</h1>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-pencil/50 bg-pencil-light px-4 py-3 text-sm text-pencil-deep">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Test mode. No real money moves.</p>
            <p className="mt-0.5">Pay with card 4242 4242 4242 4242, any future expiry and any 3-digit code. Card 4000 0000 0000 0002 is declined on purpose.</p>
            <button type="button" onClick={fillTestCard} className="mt-2 font-semibold underline underline-offset-2">Fill in the test card</button>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <ErrorNote>{payState.error && errorMessage(payState.error)}</ErrorNote>
          <Field label="Name on card"><input className="field h-11" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} required /></Field>
          <Field label="Card number"><input className="field h-11 tabular" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.cardNumber} onChange={(e) => setCard({ ...card, cardNumber: formatCard(e.target.value) })} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry"><input className="field h-11 tabular" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} required /></Field>
            <Field label="Security code"><input className="field h-11 tabular" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })} required /></Field>
          </div>
          <button type="submit" className="btn-accent btn-lg w-full" disabled={payState.isLoading || order.status === 'paid'}>
            {payState.isLoading ? <Spinner /> : <LockKeyhole className="h-4 w-4" />}Pay {amount(order.amount, order.currency)}
          </button>
          {course && <p className="text-center text-sm text-ink-faint">Changed your mind? <Link to={`/courses/${course.slug}`} className="link">Back to the course</Link></p>}
        </form>
      </div>

      <aside>
        <h2 className="font-sans text-sm font-semibold text-ink-faint">Order summary</h2>
        {course && <CourseCover course={course} as="p" className="mt-3" />}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-ink-soft">{course?.title}</dt><dd className="tabular">{amount(order.amount, order.currency)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="tabular">{amount(order.amount, order.currency)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}
