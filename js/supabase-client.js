/* Supabase v2 공통 연결 설정.
 * HTML에서 CDN 스크립트 다음에 이 파일을 로드합니다.
 * 추후 DB·Storage 연동에는 window.supabaseClient를 사용합니다.
 * 기존 견적 계산과 브라우저 저장 방식은 그대로 유지합니다. */
(function () {
  'use strict';

  const projectUrl = 'https://abkpkuqwpbxmhvfshxua.supabase.co';
  // 브라우저에 공개 가능한 Publishable Key입니다. Secret Key를 넣지 마세요.
  const publishableKey = 'sb_publishable_FW3lgGkl5S7Ge6RTd-kn0g_NwKQDIxq';

  // CDN의 window.supabase는 SDK이며, 클라이언트는 별도 이름으로 관리합니다.
  if (window.supabaseClient) return;
  window.supabaseClient = null;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('Supabase SDK를 불러오지 못했습니다. CDN 연결을 확인해 주세요.');
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(projectUrl, publishableKey, {
      // 새로고침·화면 이동 후에도 로그인 유지 및 만료된 토큰 자동 갱신.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    // 초기화 실패는 auth.js에서 사용자에게 안내합니다.
    console.warn('Supabase 클라이언트 초기화에 실패했습니다.', error);
  }
})();
