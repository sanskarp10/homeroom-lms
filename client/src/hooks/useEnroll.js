import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useCheckoutMutation, useEnrollFreeMutation } from '../store/api.js';
import { selectUser } from '../store/authSlice.js';
import { toast } from '../store/uiSlice.js';
import { errorMessage } from '../lib/format.js';

/** One entry point for "get this course": free enrollment, test checkout or Stripe. */
export function useEnroll(course) {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [enrollFree, free] = useEnrollFreeMutation();
  const [checkout, paid] = useCheckoutMutation();

  const enroll = useCallback(async () => {
    if (!user) return navigate('/login', { state: { from: location, reason: 'Sign in to enroll in this course.' } });
    try {
      if (course.price === 0) {
        await enrollFree(course.id).unwrap();
        dispatch(toast.success('Enrolled. Your first lesson is ready.'));
        return navigate(`/learn/${course.id}`);
      }
      const result = await checkout(course.id).unwrap();
      if (result.enrolled) return navigate(`/learn/${course.id}`);
      if (result.url) return window.location.assign(result.url); // Stripe Checkout
      navigate(`/checkout/${result.orderId}`);
    } catch (err) {
      dispatch(toast.error(errorMessage(err)));
    }
  }, [user, course, navigate, location, dispatch, enrollFree, checkout]);

  return { enroll, busy: free.isLoading || paid.isLoading };
}
