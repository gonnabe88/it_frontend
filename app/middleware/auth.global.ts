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
export default defineNuxtRouteMiddleware((to, _from) => {
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
        return; // 미로그인 → 로그인 페이지 정상 표시
    }

    /**
     * 일반 페이지 인증 가드
     * 인증되지 않은 사용자가 보호된 페이지에 접근하려 할 때 /login으로 리다이렉트합니다.
     */
    if (!isAuthenticated.value) {
        return navigateTo('/login');
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
