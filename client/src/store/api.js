/**
 * All server state lives in RTK Query: one cache, automatic refetch through
 * tags, and request de-duplication. Components never call fetch directly.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { signedOut } from './authSlice.js';
import { API_ORIGIN } from '../lib/format.js';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_ORIGIN}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQuery = async (args, store, extra) => {
  const result = await rawBaseQuery(args, store, extra);
  // An expired or revoked session: drop it so the UI returns to signed-out state.
  if (result.error?.status === 401 && store.getState().auth.token && !String(args?.url || args).startsWith('/auth/login')) {
    store.dispatch(signedOut());
  }
  return result;
};

const post = (url, body) => ({ url, method: 'POST', body });
const patch = (url, body) => ({ url, method: 'PATCH', body });
const del = (url) => ({ url, method: 'DELETE' });

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'Catalog', 'Course', 'Enrollments', 'Learn', 'Lesson', 'MyCourses', 'ManageCourse', 'Dashboard', 'Live', 'LiveRoom', 'Certificates', 'Orders', 'Admin'],
  keepUnusedDataFor: 120,
  refetchOnReconnect: true,
  endpoints: (b) => ({
    /* Auth */
    login: b.mutation({ query: (body) => post('/auth/login', body) }),
    register: b.mutation({ query: (body) => post('/auth/register', body) }),
    me: b.query({ query: () => '/auth/me', providesTags: ['Me'] }),
    updateProfile: b.mutation({ query: (body) => patch('/auth/me', body), invalidatesTags: ['Me'] }),
    changePassword: b.mutation({ query: (body) => post('/auth/password', body) }),

    /* Catalog */
    getCourses: b.query({ query: (params) => ({ url: '/courses', params }), providesTags: ['Catalog'] }),
    getCategories: b.query({ query: () => '/courses/categories', providesTags: ['Catalog'] }),
    getCourse: b.query({ query: (slug) => `/courses/${slug}`, providesTags: (_r, _e, slug) => [{ type: 'Course', id: slug }, 'Course'] }),

    /* Learning */
    getEnrollments: b.query({ query: () => '/learn/enrollments', providesTags: ['Enrollments'] }),
    enrollFree: b.mutation({ query: (courseId) => post('/learn/enrollments', { courseId }), invalidatesTags: ['Enrollments', 'Course', 'Live'] }),
    getLearnCourse: b.query({ query: (courseId) => `/learn/courses/${courseId}`, providesTags: (_r, _e, id) => [{ type: 'Learn', id }] }),
    getLesson: b.query({ query: (lessonId) => `/learn/lessons/${lessonId}`, providesTags: (_r, _e, id) => [{ type: 'Lesson', id }] }),
    savePosition: b.mutation({ query: ({ lessonId, position }) => post(`/learn/lessons/${lessonId}/position`, { position }) }),
    completeLesson: b.mutation({
      query: ({ lessonId, completed = true }) => post(`/learn/lessons/${lessonId}/complete`, { completed }),
      invalidatesTags: (_r, _e, { lessonId, courseId }) => [{ type: 'Lesson', id: lessonId }, { type: 'Learn', id: courseId }, 'Enrollments', 'Certificates'],
    }),
    submitQuiz: b.mutation({
      query: ({ lessonId, answers }) => post(`/learn/lessons/${lessonId}/quiz`, { answers }),
      invalidatesTags: (_r, _e, { lessonId, courseId }) => [{ type: 'Lesson', id: lessonId }, { type: 'Learn', id: courseId }, 'Enrollments', 'Certificates'],
    }),

    /* Payments */
    getPaymentConfig: b.query({ query: () => '/payments/config' }),
    checkout: b.mutation({ query: (courseId) => post('/payments/checkout', { courseId }) }),
    getOrder: b.query({ query: (id) => `/payments/orders/${id}` }),
    getOrders: b.query({ query: () => '/payments/orders', providesTags: ['Orders'] }),
    payTest: b.mutation({
      query: ({ orderId, ...card }) => post(`/payments/test/${orderId}/pay`, card),
      invalidatesTags: (result) => (result ? ['Enrollments', 'Course', 'Orders', 'Live', 'Catalog'] : []),
    }),
    verifyStripe: b.query({ query: (sessionId) => ({ url: '/payments/stripe/verify', params: { session_id: sessionId } }) }),

    /* Certificates */
    getCertificates: b.query({ query: () => '/certificates', providesTags: ['Certificates'] }),
    verifyCertificate: b.query({ query: (code) => `/certificates/verify/${encodeURIComponent(code)}` }),

    /* Instructor: revenue */
    getDashboard: b.query({ query: (days) => ({ url: '/instructor/dashboard', params: { days } }), providesTags: ['Dashboard'] }),

    /* Instructor: course builder */
    getMyCourses: b.query({ query: () => '/manage/courses', providesTags: ['MyCourses'] }),
    createCourse: b.mutation({ query: (body) => post('/manage/courses', body), invalidatesTags: ['MyCourses'] }),
    getManageCourse: b.query({ query: (id) => `/manage/courses/${id}`, providesTags: (_r, _e, id) => [{ type: 'ManageCourse', id }] }),
    updateCourse: b.mutation({
      query: ({ id, ...body }) => patch(`/manage/courses/${id}`, body),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'MyCourses', 'Catalog', 'Course'],
    }),
    uploadThumbnail: b.mutation({
      query: ({ id, file }) => {
        const body = new FormData();
        body.append('image', file);
        return { url: `/manage/courses/${id}/thumbnail`, method: 'POST', body };
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'MyCourses', 'Catalog', 'Course'],
    }),
    publishCourse: b.mutation({
      query: ({ id, published }) => post(`/manage/courses/${id}/publish`, { published }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'MyCourses', 'Catalog', 'Course', 'Dashboard'],
    }),
    deleteCourse: b.mutation({ query: (id) => del(`/manage/courses/${id}`), invalidatesTags: ['MyCourses', 'Catalog', 'Dashboard'] }),
    addSection: b.mutation({ query: ({ id, title }) => post(`/manage/courses/${id}/sections`, { title }), invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }] }),
    renameSection: b.mutation({ query: ({ id, sectionId, title }) => patch(`/manage/courses/${id}/sections/${sectionId}`, { title }), invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'Course'] }),
    deleteSection: b.mutation({ query: ({ id, sectionId }) => del(`/manage/courses/${id}/sections/${sectionId}`), invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'Course'] }),
    saveOrder: b.mutation({
      query: ({ id, sections }) => ({ url: `/manage/courses/${id}/order`, method: 'PUT', body: { sections } }),
      // Move rows in the cache first so reordering feels instant; roll back if the server refuses.
      async onQueryStarted({ id, sections }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          api.util.updateQueryData('getManageCourse', id, (draft) => {
            const lessons = new Map(draft.curriculum.flatMap((s) => s.lessons).map((l) => [l.id, l]));
            const byId = new Map(draft.curriculum.map((s) => [s.id, s]));
            draft.curriculum = sections.map((s) => ({ ...byId.get(s.id), lessons: s.lessons.map((lid) => lessons.get(lid)).filter(Boolean) }));
          })
        );
        try { await queryFulfilled; } catch { undo.undo(); }
      },
      invalidatesTags: ['Course'],
    }),
    addLesson: b.mutation({ query: ({ id, ...body }) => post(`/manage/courses/${id}/lessons`, body), invalidatesTags: (_r, _e, { id }) => [{ type: 'ManageCourse', id }, 'MyCourses', 'Course'] }),
    updateLesson: b.mutation({
      query: ({ lessonId, courseId, ...body }) => patch(`/manage/lessons/${lessonId}`, body),
      invalidatesTags: (_r, _e, { courseId }) => [{ type: 'ManageCourse', id: courseId }, 'Course', 'Lesson'],
    }),
    deleteLesson: b.mutation({ query: ({ lessonId }) => del(`/manage/lessons/${lessonId}`), invalidatesTags: (_r, _e, { courseId }) => [{ type: 'ManageCourse', id: courseId }, 'MyCourses', 'Course'] }),
    removeVideo: b.mutation({ query: ({ lessonId }) => del(`/manage/lessons/${lessonId}/video`), invalidatesTags: (_r, _e, { courseId }) => [{ type: 'ManageCourse', id: courseId }, 'Course'] }),

    /* Live classes */
    getSchedule: b.query({ query: (limit = 8) => ({ url: '/live/schedule', params: { limit } }), providesTags: ['Live'] }),
    getMyLive: b.query({ query: () => '/live/mine', providesTags: ['Live'] }),
    getCourseLive: b.query({ query: (courseId) => `/live/course/${courseId}`, providesTags: ['Live'] }),
    createLive: b.mutation({ query: (body) => post('/live', body), invalidatesTags: ['Live', 'Course'] }),
    updateLive: b.mutation({ query: ({ id, ...body }) => patch(`/live/${id}`, body), invalidatesTags: ['Live', 'Course'] }),
    deleteLive: b.mutation({ query: (id) => del(`/live/${id}`), invalidatesTags: ['Live', 'Course'] }),
    startLive: b.mutation({ query: (id) => post(`/live/${id}/start`), invalidatesTags: ['Live', 'LiveRoom', 'Course'] }),
    endLive: b.mutation({ query: (id) => post(`/live/${id}/end`), invalidatesTags: ['Live', 'LiveRoom', 'Course'] }),
    getLiveRoom: b.query({ query: (id) => `/live/${id}`, providesTags: ['LiveRoom'], keepUnusedDataFor: 0 }),

    /* Admin */
    getAdminOverview: b.query({ query: () => '/admin/overview', providesTags: ['Admin'] }),
    getAdminUsers: b.query({ query: (params) => ({ url: '/admin/users', params }), providesTags: ['Admin'] }),
    updateAdminUser: b.mutation({ query: ({ id, ...body }) => patch(`/admin/users/${id}`, body), invalidatesTags: ['Admin'] }),
    getAdminCourses: b.query({ query: (params) => ({ url: '/admin/courses', params }), providesTags: ['Admin'] }),
    updateAdminCourse: b.mutation({ query: ({ id, ...body }) => patch(`/admin/courses/${id}`, body), invalidatesTags: ['Admin', 'Catalog', 'Course'] }),
  }),
});

export const {
  useLoginMutation, useRegisterMutation, useMeQuery, useUpdateProfileMutation, useChangePasswordMutation,
  useGetCoursesQuery, useGetCategoriesQuery, useGetCourseQuery,
  useGetEnrollmentsQuery, useEnrollFreeMutation, useGetLearnCourseQuery, useGetLessonQuery, useSavePositionMutation, useCompleteLessonMutation, useSubmitQuizMutation,
  useGetPaymentConfigQuery, useCheckoutMutation, useGetOrderQuery, useGetOrdersQuery, usePayTestMutation, useVerifyStripeQuery,
  useGetCertificatesQuery, useVerifyCertificateQuery,
  useGetDashboardQuery,
  useGetMyCoursesQuery, useCreateCourseMutation, useGetManageCourseQuery, useUpdateCourseMutation, useUploadThumbnailMutation, usePublishCourseMutation, useDeleteCourseMutation,
  useAddSectionMutation, useRenameSectionMutation, useDeleteSectionMutation, useSaveOrderMutation, useAddLessonMutation, useUpdateLessonMutation, useDeleteLessonMutation, useRemoveVideoMutation,
  useGetScheduleQuery, useGetMyLiveQuery, useGetCourseLiveQuery, useCreateLiveMutation, useUpdateLiveMutation, useDeleteLiveMutation, useStartLiveMutation, useEndLiveMutation, useGetLiveRoomQuery,
  useGetAdminOverviewQuery, useGetAdminUsersQuery, useUpdateAdminUserMutation, useGetAdminCoursesQuery, useUpdateAdminCourseMutation,
} = api;

/**
 * Video upload with a real progress bar. fetch() cannot report upload progress,
 * so this one request uses XMLHttpRequest and then refreshes the cache.
 */
export function uploadLessonVideo({ lessonId, courseId, file, token, onProgress, dispatch }) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('video', file);
    xhr.open('POST', `${API_ORIGIN}/api/manage/lessons/${lessonId}/video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        dispatch(api.util.invalidateTags([{ type: 'ManageCourse', id: courseId }]));
        resolve(data);
      } else reject(new Error(data.error || 'The upload failed. Try again.'));
    };
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(body);
  });
  return { promise, cancel: () => xhr.abort() };
}
