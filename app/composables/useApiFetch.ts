/**
 * ============================================================================
 * [useApiFetch] 인증 기반 HTTP 요청 Composable
 * ============================================================================
 * Nuxt의 useFetch를 래핑하여 아래 기능을 자동으로 처리합니다:
 *  1. accessToken을 Authorization 헤더에 자동 주입
 *  2. accessToken 변경 시 자동 재요청 (watch 설정)
 *  3. 401 Unauthorized 응답 시 토큰 갱신(refresh) 시도
 *  4. 토큰 갱신 실패 시 로그아웃 처리 및 로그인 페이지로 리다이렉트
 *
 * [사용 원칙]
 *  - GET(조회) 요청에 사용합니다.
 *  - POST/PUT/DELETE(변경) 요청에는 plugins/auth.ts의 $apiFetch를 사용합니다.
 * ============================================================================
 */
import type { UseFetchOptions } from 'nuxt/app';

/**
 * 인증이 적용된 useFetch 래퍼 함수
 *
 * @template T - API 응답 데이터 타입
 * @param url - 요청할 API URL (문자열 또는 URL을 반환하는 함수)
 * @param options - useFetch 옵션 (기존 UseFetchOptions 그대로 전달 가능)
 * @returns useFetch의 반환값 ({ data, pending, error, refresh })
 *
 * @example
 * // 프로젝트 목록 조회
 * const { data, pending } = useApiFetch<Project[]>('/api/projects');
 *
 * @example
 * // 쿼리 파라미터와 함께 사용
 * const { data } = useApiFetch<OrgUser[]>('/api/users', {
 *   query: { orgCode: '1001' }
 * });
 */
export const useApiFetch = <T>(url: string | (() => string), options: UseFetchOptions<T> = {}) => {
    // 인증 store에서 토큰 및 인증 관련 함수를 가져옴
    const { accessToken, refresh, logout } = useAuth();

    // 동시에 여러 401 응답이 발생할 경우 토큰 갱신을 중복 실행하지 않기 위한 플래그
    let isRefreshing = false;

    const params = {
        // 기존 옵션을 스프레드하여 덮어쓰기
        ...options,
        // 클라이언트 사이드에서만 실행 (SSR 비활성화)
        server: false,
        // accessToken이 변경될 때마다 자동으로 재요청
        watch: [accessToken],
        /**
         * 요청 시마다 최신 accessToken으로 Authorization 헤더를 동적으로 생성
         * computed를 사용하여 반응형으로 토큰 값을 추적
         */
        headers: computed(() => {
            const headers: Record<string, string> = { ...((options.headers as any) || {}) };
            if (accessToken.value) {
                headers.Authorization = `Bearer ${accessToken.value}`;
            }
            return headers;
        }),
        /**
         * 응답 에러 핸들러
         * - 401 응답 수신 시 토큰 갱신 시도
         * - isRefreshing 플래그로 중복 갱신 방지
         * - 갱신 실패 시 로그아웃 후 로그인 페이지로 이동
         */
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
                    // 갱신 성공/실패 여부와 상관없이 플래그 해제
                    isRefreshing = false;
                }
            }
        }
    };

    return useFetch<T>(url, params as any);
};
