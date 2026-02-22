export default defineNuxtPlugin(() => {
    const { accessToken, refresh, logout } = useAuth();
    
    // 토큰 갱신 중 플래그 (무한 루프 방지)
    let isRefreshing = false;

    // $fetch 인터셉터 설정
    const apiFetch = $fetch.create({
        onRequest({ options }) {
            // 모든 API 요청에 Access Token 자동 첨부
            if (accessToken.value) {
                // headers를 객체 형태로 초기화
                options.headers = {
                    ...(options.headers as any || {}),
                    Authorization: `Bearer ${accessToken.value}`
                };
            }
        },
        async onResponseError({ response, request }) {
            // 401 Unauthorized 에러 시 토큰 갱신 시도
            if (response.status === 401) {
                // 로그아웃 API 호출 실패는 무시 (이미 로그아웃 중이므로)
                const url = request.toString();
                if (url.includes('/auth/logout')) {
                    console.log('Logout API failed, but continuing with local logout');
                    return;
                }
                
                // 이미 갱신 중이면 중복 요청 방지
                if (isRefreshing) {
                    console.log('Token refresh already in progress, skipping');
                    return;
                }
                
                isRefreshing = true;
                
                try {
                    const refreshed = await refresh();
                    
                    if (!refreshed) {
                        // 토큰 갱신 실패 시 로그아웃 및 로그인 페이지로 리다이렉트
                        await logout();
                        navigateTo('/login');
                    }
                } finally {
                    isRefreshing = false;
                }
            }
        }
    });

    return {
        provide: {
            apiFetch
        }
    };
});
