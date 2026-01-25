import type { UseFetchOptions } from 'nuxt/app';
import { defu } from 'defu';

export const useApi = <T>(url: string | (() => string), options: UseFetchOptions<T> = {}) => {
    const { accessToken, refresh, logout } = useAuth();

    // 옵션 병합 (defu 제거 및 수동 병합)
    const params = {
        ...options,
        server: false,
        watch: [accessToken],
        headers: computed(() => {
            // 사용자 헤더와 인증 헤더 병합
            const headers: Record<string, string> = { ...((options.headers as any) || {}) };
            if (accessToken.value) {
                headers.Authorization = `Bearer ${accessToken.value}`;
            }
            return headers;
        }),
        async onResponseError(context: any) {
            // 401 처리
            if (context.response.status === 401) {
                console.log('401 Unauthorized detected. Attempting to refresh token...');
                const refreshed = await refresh();
                if (refreshed) {
                    console.log('Token refreshed successfully.');
                } else {
                    console.log('Token refresh failed. Logging out...');
                    await logout();
                    navigateTo('/login');
                }
            }
            // 사용자 정의 에러 핸들러가 있다면 실행
            const userHandler = options.onResponseError;
            if (userHandler) {
                if (Array.isArray(userHandler)) {
                   for (const handler of userHandler) {
                       await handler(context);
                   }
                } else if (typeof userHandler === 'function') {
                    await (userHandler as any)(context);
                }
            }
        }
    };

    return useFetch<T>(url, params as any);
};
