export default defineNuxtRouteMiddleware((to, from) => {
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
