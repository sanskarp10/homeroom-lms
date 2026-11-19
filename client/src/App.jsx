import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Layout from './components/Layout.jsx';
import Toasts from './components/Toasts.jsx';
import { PageLoader } from './components/ui.jsx';
import { selectToken, selectUser, userUpdated } from './store/authSlice.js';
import { useMeQuery } from './store/api.js';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import CourseDetail from './pages/CourseDetail.jsx';

// Everything past the catalog is split out so the first paint stays small.
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const MyLearning = lazy(() => import('./pages/MyLearning.jsx'));
const Player = lazy(() => import('./pages/Player.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess.jsx'));
const Certificates = lazy(() => import('./pages/Certificates.jsx'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate.jsx'));
const LiveSchedule = lazy(() => import('./pages/LiveSchedule.jsx'));
const LiveRoom = lazy(() => import('./pages/LiveRoom.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Teach = lazy(() => import('./pages/instructor/Teach.jsx'));
const CourseEditor = lazy(() => import('./pages/instructor/CourseEditor.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));

function RequireAuth({ roles, children }) {
  const user = useSelector(selectUser);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

/** Keeps the stored profile fresh (role changes, renamed account) without blocking render. */
function SessionSync() {
  const token = useSelector(selectToken);
  const dispatch = useDispatch();
  const { data } = useMeQuery(undefined, { skip: !token });
  useEffect(() => { if (data?.user) dispatch(userUpdated(data.user)); }, [data, dispatch]);
  return null;
}

export default function App() {
  const staff = ['instructor', 'admin'];
  return (
    <>
      <SessionSync />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="courses" element={<Catalog />} />
            <Route path="courses/:slug" element={<CourseDetail />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="live" element={<LiveSchedule />} />
            <Route path="verify" element={<VerifyCertificate />} />
            <Route path="verify/:code" element={<VerifyCertificate />} />
            <Route path="learning" element={<RequireAuth><MyLearning /></RequireAuth>} />
            <Route path="certificates" element={<RequireAuth><Certificates /></RequireAuth>} />
            <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="checkout/success" element={<RequireAuth><CheckoutSuccess /></RequireAuth>} />
            <Route path="checkout/:orderId" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="teach" element={<RequireAuth roles={staff}><Teach /></RequireAuth>} />
            <Route path="teach/courses/:id" element={<RequireAuth roles={staff}><CourseEditor /></RequireAuth>} />
            <Route path="admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
          {/* Full-screen experiences without the site chrome */}
          <Route path="learn/:courseId" element={<RequireAuth><Player /></RequireAuth>} />
          <Route path="learn/:courseId/:lessonId" element={<RequireAuth><Player /></RequireAuth>} />
          <Route path="live/:id" element={<RequireAuth><LiveRoom /></RequireAuth>} />
        </Routes>
      </Suspense>
      <Toasts />
    </>
  );
}
