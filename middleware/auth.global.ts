export default defineNuxtRouteMiddleware((to, from) => {
    // localStorage는 클라이언트에서만 사용 가능하므로 SSR에서는 실행하지 않음
    if (import.meta.server) return;

    const { isAuthenticated, restoreSession } = useAuth();

    // 세션 복원 시도
    restoreSession();

    // 로그인 페이지는 항상 접근 가능
    if (to.path === '/login') {
        // 이미 로그인된 경우 메인 페이지로 리다이렉트
        if (isAuthenticated.value) {
            return navigateTo('/');
        }
        return;
    }

    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    if (!isAuthenticated.value) {
        return navigateTo('/login');
    }
});
