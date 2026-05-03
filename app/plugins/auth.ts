/**
 * ============================================================================
 * [plugins/auth.ts] 인증 Nuxt 플러그인
 * ============================================================================
 * $apiFetch를 생성하여 앱 전역에 provide합니다.
 * $apiFetch는 $fetch를 기반으로 아래 기능이 자동 적용된 인증 전용 fetch입니다:
 *
 * [자동 처리 기능]
 *  1. 모든 요청에 credentials:'include' 설정 → httpOnly 쿠키 자동 전송
 *  2. 401 Unauthorized 응답 시 쿠키의 refreshToken으로 토큰 갱신 시도
 *     - 갱신 성공 → 원래 요청을 재시도하여 결과를 호출자에게 반환 (화면 갱신 보장)
 *     - 갱신 실패 → 로그아웃 처리 및 /login 리다이렉트
 *     - 로그아웃 API 자체의 401은 무시 (이미 로그아웃 중인 상태)
 *     - refreshPromise 공유로 동시 401 요청 모두 갱신 완료 후 재시도 보장
 *       (이전: 두 번째 요청이 isRefreshing=true를 보고 즉시 throw → Promise.all 실패)
 *
 * [이전 방식 → 현재 방식]
 *  이전: $fetch.create + onResponseError 훅
 *       onResponseError는 void 반환 → 재시도 결과를 호출자에게 전달 불가
 *       ofetch가 훅 완료 후 원래 401 에러를 항상 throw → 호출자 catch 블록으로 빠져 화면 미갱신
 *  현재: try/catch 래퍼 방식
 *       재시도 성공 시 결과를 직접 return → 호출자에게 정상 응답 전달 → 화면 갱신
 *
 * [인증 전략: httpOnly 쿠키]
 *  - JWT 토큰은 httpOnly 쿠키에 저장되어 브라우저가 자동 전송합니다.
 *  - Authorization 헤더 주입은 불필요합니다.
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
    // useAuth composable을 통해 인증 액션 접근
    const { refresh, logout } = useAuth();

    /**
     * 진행 중인 토큰 갱신 Promise
     * Promise.all 등으로 동시에 여러 401이 발생할 때, 두 번째 이후 요청이
     * 같은 갱신 결과를 기다렸다가 재시도할 수 있도록 공유합니다.
     */
    let refreshPromise: Promise<boolean> | null = null;

    /**
     * credentials만 설정된 기본 fetch 인스턴스 (401 처리 없음)
     * apiFetch 래퍼 내부에서 실제 HTTP 요청에 사용합니다.
     */
    const internalFetch = $fetch.create({
        onRequest({ options }) {
            // httpOnly 쿠키 자동 전송을 위한 credentials 설정
            options.credentials = 'include';
        }
    });

    /**
     * 인증이 적용된 fetch 래퍼 (try/catch 방식)
     *
     * [처리 흐름]
     *  1. internalFetch로 요청 시도
     *  2. 성공 → 결과 반환
     *  3. 401 에러 발생 → 토큰 갱신 시도
     *  4. 갱신 성공 → 재시도 후 결과를 호출자에게 반환 (화면 갱신 보장)
     *  5. 갱신 실패 → logout() → /login 리다이렉트
     *  6. 401 외 에러 → 그대로 throw
     *
     * [이전 onResponseError 훅 방식의 문제]
     *  onResponseError 내부에서 재시도해도 그 결과는 버려지고,
     *  ofetch가 훅 완료 후 원래 401 에러를 호출자에게 throw합니다.
     *  이로 인해 재시도 성공 후에도 호출자 catch 블록이 실행되어 화면이 갱신되지 않습니다.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiFetch: typeof $fetch = async (request: any, opts?: any) => {
        try {
            return await internalFetch(request, opts);
        } catch (err: unknown) {
            const fetchErr = err as { response?: { status?: number } };

            // 401 이외 에러는 그대로 throw
            if (fetchErr?.response?.status !== 401) throw err;

            const url = String(request);

            // 로그아웃 API 자체의 401은 정상적인 경우이므로 에러 그대로 throw
            if (url.includes('/auth/logout')) {
                console.log('Logout API failed, but continuing with local logout');
                throw err;
            }

            // 이미 갱신 진행 중이면 같은 Promise를 기다렸다가 재시도
            if (refreshPromise) {
                const refreshed = await refreshPromise;
                if (refreshed) return await internalFetch(request, opts);
                throw err;
            }

            // 첫 번째 401 → 갱신 시작, Promise를 모듈 변수에 저장해 동시 요청이 공유
            refreshPromise = refresh();

            try {
                const refreshed = await refreshPromise;

                if (refreshed) {
                    // 갱신 성공 → 재시도 결과를 호출자에게 반환 (화면 갱신 보장)
                    return await internalFetch(request, opts);
                } else {
                    // refreshToken도 만료되었거나 갱신 실패 → 강제 로그아웃
                    await logout();
                    navigateTo('/login');
                    throw err;
                }
            } finally {
                // 갱신 완료 후 다음 401을 위해 반드시 초기화
                refreshPromise = null;
            }
        }
    };

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
