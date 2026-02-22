import type { UseFetchOptions } from 'nuxt/app';

export const useApiFetch = <T>(url: string | (() => string), options: UseFetchOptions<T> = {}) => {
    const { accessToken, refresh, logout } = useAuth();

    // 토큰 갱신 중복 요청 방지 플래그
    let isRefreshing = false;

    const params = {
        ...options,
        server: false,
        watch: [accessToken],
        headers: computed(() => {
            const headers: Record<string, string> = { ...((options.headers as any) || {}) };
            if (accessToken.value) {
                headers.Authorization = `Bearer ${accessToken.value}`;
            }
            return headers;
        }),
        // 401 응답 시 토큰 갱신 시도 및 로그인 리다이렉트
        onResponseError: async ({ response }: { response: Response }) => {
            if (response.status === 401 && !isRefreshing) {
                isRefreshing = true;
                try {
                    const refreshed = await refresh();
                    if (!refreshed) {
                        // 토큰 갱신 실패 시 로그아웃 및 로그인 페이지로 이동
                        await logout();
                        navigateTo('/login');
                    }
                } finally {
                    isRefreshing = false;
                }
            }
        }
    };

    return useFetch<T>(url, params as any);
};
