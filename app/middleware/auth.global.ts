/**
 * ============================================================================
 * [middleware/auth.global.ts] 전역 인증 라우트 미들웨어
 * ============================================================================
 * 파일명의 '.global' 접미사로 인해 Nuxt가 모든 라우트 네비게이션에
 * 자동으로 적용하는 전역 미들웨어입니다.
 *
 * [처리 흐름]
 *  1. useCookie 기반 인증 상태를 확인합니다.
 *  2. restoreSession() 호출 → 구버전 localStorage 사용자 정보를 user 쿠키로 마이그레이션
 *  3. 목적지(to) 라우트 분기 처리:
 *     - /login 페이지:
 *       - 이미 로그인된 상태이면 홈('/')으로 리다이렉트 (로그인 페이지 진입 차단)
 *       - 미로그인 상태이면 정상 접근 허용 (로그인 폼 표시)
 *     - 그 외 페이지:
 *       - 인증되지 않은 상태이면 /login으로 리다이렉트 (인증 가드)
 *       - 인증된 상태이면 정상 접근 허용
 *
 * [restoreSession 호출 위치]
 *  - 이 미들웨어에서만 호출합니다.
 *  - app.vue에서의 중복 호출은 제거되었습니다.
 *
 * [적용 대상]
 *  - 앱의 모든 페이지 네비게이션 (초기 진입 포함)
 * ============================================================================
 */
/**
 * Nuxt 라우트 쿼리 값에서 첫 번째 문자열만 꺼냅니다.
 *
 * Vue Router의 쿼리 값은 string, string[], null 등으로 들어올 수 있습니다.
 * SSO next 경로는 하나의 문자열만 의미가 있으므로 배열이면 첫 번째 값만 사용하고,
 * 문자열이 아니면 안전하지 않은 값으로 보고 무시합니다.
 *
 * @param value 라우트 쿼리에서 읽은 원본 값
 * @returns 사용할 수 있는 문자열 값, 없으면 undefined
 */
const getSingleQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : undefined;
    }
    return typeof value === 'string' ? value : undefined;
};

/**
 * SSO 완료 후 복원할 내부 경로인지 검증합니다.
 *
 * /login?redirect=... 또는 /login?next=...로 들어온 값은 백엔드 SSO 체인으로 전달됩니다.
 * 외부 URL, 프로토콜 상대 URL, /login 경로를 허용하면 오픈 리다이렉트나 인증 루프가
 * 발생할 수 있어 모두 차단합니다.
 *
 * @param value redirect 또는 next 쿼리 값
 * @returns 안전한 내부 경로이면 해당 경로, 아니면 undefined
 */
const getSafeNextPath = (value: unknown): string | undefined => {
    const next = getSingleQueryValue(value);
    if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
        return undefined;
    }
    return next;
};

/**
 * 클라이언트/서버 라우트 미들웨어에서 공통으로 사용하는 SSO 이동 함수입니다.
 *
 * 서버 렌더링 중에는 navigateTo(..., { external: true })가 HTTP 302 응답을 만들고,
 * 클라이언트 라우팅 중에는 window.location.replace로 브라우저 주소를 즉시 교체합니다.
 * 클라이언트 분기에서 abortNavigation을 반환하는 이유는 보호 페이지 컴포넌트가 잠깐
 * 렌더링되는 flash를 막기 위해 Vue Router 진행을 즉시 중단하기 위함입니다.
 *
 * @param nextPath SSO 완료 후 되돌아갈 원본 내부 경로
 * @returns Nuxt 라우트 미들웨어 중단/리다이렉트 결과
 */
const redirectToSso = (nextPath: string) => {
    const config = useRuntimeConfig();
    const searchParams = new URLSearchParams({ next: nextPath });
    if (import.meta.client) {
        searchParams.set('origin', window.location.origin);
    }
    const ssoUrl = `${config.public.apiBase}/sso/business.jsp?${searchParams.toString()}`;

    if (import.meta.client) {
        window.location.replace(ssoUrl);
        return abortNavigation();
    }
    return navigateTo(ssoUrl, { external: true });
};

export default defineNuxtRouteMiddleware((to, _from) => {
    if (import.meta.prerender) {
        return;
    }

    // useAuth composable에서 인증 상태 및 세션 복원 함수 가져오기
    const { isAuthenticated, restoreSession } = useAuth();

    /**
     * 구버전 localStorage 데이터 마이그레이션 (클라이언트 전용, 무시 가능)
     * user가 useCookie로 전환된 이후 기존 localStorage 데이터를 쿠키로 이전합니다.
     * SSR에서는 useCookie가 요청 쿠키를 자동으로 읽어 인증 상태를 복원합니다.
     */
    restoreSession();

    /**
     * /login 페이지 접근 처리
     * - 이미 인증된 사용자가 /login에 접근하면 홈으로 리다이렉트합니다.
     *   (로그인된 상태에서 브라우저 주소창으로 직접 접근하는 경우 처리)
     * - 미인증 사용자는 정상적으로 로그인 페이지를 볼 수 있습니다.
     */
    if (to.path === '/login') {
        if (isAuthenticated.value) {
            // 이미 로그인된 경우 메인 페이지로 리다이렉트
            return navigateTo('/');
        }
        const redirectPath = getSafeNextPath(to.query?.redirect ?? to.query?.next);
        if (redirectPath && to.query?.error !== 'sso') {
            return redirectToSso(redirectPath);
        }
        return; // 미로그인 → 로그인 페이지 정상 표시
    }

    /**
     * 일반 페이지 인증 가드
     * 미인증 사용자는 로그인 페이지를 거치지 않고 SSO로 바로 이동합니다.
     * 원본 경로는 ?next= 쿼리 파라미터로 SSO 체인 전체에 전달해 완료 후 복원합니다.
     *
     * 클라이언트에서는 abortNavigation()으로 vue-router를 즉시 중단해
     * 페이지가 잠깐 렌더링되는 flash를 방지합니다.
     */
    if (!isAuthenticated.value) {
        return redirectToSso(to.fullPath ?? to.path);
    }

    // 인증 확인 완료 — nuxt.config.ts 인라인 스크립트가 숨긴 페이지를 복원
    if (import.meta.client) {
        document.documentElement.style.visibility = '';
    }

    /**
     * 관리자 전용 페이지(/admin/**) 접근 가드
     * 시스템관리자(ITPAD001) 자격등급이 없는 사용자가 접근하면 홈으로 리다이렉트합니다.
     * useAuth의 isAdmin() 헬퍼를 사용하여 athIds 배열 기반으로 확인합니다.
     */
    if (to.path.startsWith('/admin')) {
        const { isAdmin } = useAuth();
        if (!isAdmin()) {
            // 권한 없는 사용자는 홈으로 리다이렉트 (403 대신 홈으로 안전하게 처리)
            return navigateTo('/');
        }
    }
});
