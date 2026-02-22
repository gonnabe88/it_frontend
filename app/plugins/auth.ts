/**
 * ============================================================================
 * [plugins/auth.ts] 인증 Nuxt 플러그인
 * ============================================================================
 * $apiFetch를 생성하여 앱 전역에 provide합니다.
 * $apiFetch는 $fetch를 기반으로 아래 기능이 자동 적용된 인증 전용 fetch입니다:
 *
 * [자동 처리 기능]
 *  1. 요청 인터셉터(onRequest):
 *     - 모든 요청에 현재 accessToken을 Authorization 헤더로 자동 첨부
 *
 *  2. 응답 에러 인터셉터(onResponseError):
 *     - 401 Unauthorized 응답 시 refreshToken으로 토큰 갱신 시도
 *     - 갱신 실패 시 로그아웃 처리 및 /login으로 리다이렉트
 *     - 로그아웃 API 자체의 401 실패는 무시 (이미 로그아웃 중인 상태)
 *     - isRefreshing 플래그로 토큰 갱신 중복 요청 방지
 *
 * [사용 원칙]
 *  - POST/PUT/DELETE 등 데이터 변경 요청에 사용합니다.
 *  - GET(조회) 요청에는 composables/useApiFetch.ts를 사용합니다.
 *  - stores/auth.ts에서는 순환 참조를 피하기 위해 $apiFetch 사용 불가.
 *
 * [주입 방식]
 *  - provide: { apiFetch }로 등록되므로 useNuxtApp().$apiFetch로 접근합니다.
 *
 * @example
 * // composable/페이지에서 사용
 * const { $apiFetch } = useNuxtApp();
 * await $apiFetch('/api/projects', { method: 'POST', body: payload });
 * ============================================================================
 */
export default defineNuxtPlugin(() => {
    // useAuth composable을 통해 현재 인증 상태 및 액션 접근
    const { accessToken, refresh, logout } = useAuth();

    /**
     * 토큰 갱신 진행 중 여부를 나타내는 플래그
     * 401 응답이 동시에 여러 개 발생할 경우 갱신 요청이 중복으로 실행되는 것을 방지합니다.
     * 모듈 스코프에 선언하여 $fetch.create 내부 클로저에서 공유됩니다.
     */
    let isRefreshing = false;

    /**
     * 인증이 적용된 $fetch 인스턴스 생성
     * $fetch.create()로 기본 $fetch에 인터셉터를 추가한 새 인스턴스를 만듭니다.
     */
    const apiFetch = $fetch.create({
        /**
         * 요청 인터셉터: 모든 요청 전에 실행
         * 현재 accessToken을 Authorization 헤더에 주입합니다.
         * 토큰이 없으면 (비로그인 상태) 헤더 추가를 건너뜁니다.
         */
        onRequest({ options }) {
            if (accessToken.value) {
                // 기존 헤더 객체를 유지하면서 Authorization만 추가/덮어쓰기
                options.headers = {
                    ...(options.headers as any || {}),
                    Authorization: `Bearer ${accessToken.value}`
                };
            }
        },

        /**
         * 응답 에러 인터셉터: HTTP 에러 응답 시 실행
         * 401 Unauthorized 발생 시 토큰 갱신을 시도합니다.
         *
         * [처리 흐름]
         *  1. 로그아웃 API(/auth/logout) 자체의 401은 무시 (이미 로그아웃 중)
         *  2. isRefreshing 플래그 확인 → 이미 갱신 중이면 스킵
         *  3. refresh() 호출 → 성공 시 원래 요청 컴포넌트에서 재시도 가능
         *  4. 갱신 실패 시 logout() → /login 리다이렉트
         *  5. finally에서 isRefreshing 플래그 해제
         */
        async onResponseError({ response, request }) {
            if (response.status === 401) {
                const url = request.toString();

                // 로그아웃 API 자체의 실패는 정상적인 경우이므로 무시
                if (url.includes('/auth/logout')) {
                    console.log('Logout API failed, but continuing with local logout');
                    return;
                }

                // 이미 갱신 진행 중이면 중복 실행 방지
                if (isRefreshing) {
                    console.log('Token refresh already in progress, skipping');
                    return;
                }

                isRefreshing = true;

                try {
                    const refreshed = await refresh();

                    if (!refreshed) {
                        // refreshToken도 만료되었거나 갱신 실패 → 강제 로그아웃
                        await logout();
                        navigateTo('/login');
                    }
                    // 갱신 성공 시: 호출한 컴포넌트에서 재시도 처리 (여기서는 자동 재시도 없음)
                } finally {
                    // 갱신 성공/실패 여부와 상관없이 플래그 반드시 해제
                    isRefreshing = false;
                }
            }
        }
    });

    /**
     * $apiFetch를 전역에 provide
     * composable/페이지에서 useNuxtApp().$apiFetch로 접근 가능합니다.
     *
     * 네이밍 규칙: provide 키가 'apiFetch'이면 $apiFetch로 접근
     */
    return {
        provide: {
            apiFetch
        }
    };
});
