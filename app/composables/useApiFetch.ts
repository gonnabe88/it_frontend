/**
 * ============================================================================
 * [useApiFetch] 인증 기반 HTTP 요청 Composable
 * ============================================================================
 * Nuxt의 useFetch를 래핑하여 아래 기능을 자동으로 처리합니다:
 *  1. credentials:'include'로 httpOnly 쿠키 자동 전송
 *  2. 401 Unauthorized 응답 시 토큰 갱신(refresh) 시도
 *  3. 토큰 갱신 실패 시 로그아웃 처리 및 로그인 페이지로 리다이렉트
 *
 * [인증 전략: httpOnly 쿠키]
 *  - JWT 토큰은 httpOnly 쿠키에 저장되어 브라우저가 자동 전송합니다.
 *  - Authorization 헤더 주입은 불필요합니다.
 *
 * [사용 원칙]
 *  - GET(조회) 요청에 사용합니다.
 *  - POST/PUT/DELETE(변경) 요청에는 plugins/auth.ts의 $apiFetch를 사용합니다.
 * ============================================================================
 */
import type { UseFetchOptions } from 'nuxt/app';
import { useToast } from 'primevue/usetoast';

/**
 * 토큰 갱신 진행 중 여부 플래그 (모듈 레벨 - 모든 useApiFetch 인스턴스 공유)
 * 동시에 여러 401 응답이 발생할 경우 토큰 갱신이 중복으로 실행되는 것을 방지합니다.
 */
let isRefreshing = false;

/**
 * 토큰 갱신 성공 시 증가하는 신호 (모듈 레벨 - 모든 useApiFetch 인스턴스 공유)
 * useFetch의 watch 옵션에 연결되어 있어, 이 값이 변경되면
 * 현재 페이지에서 활성화된 모든 useApiFetch 인스턴스가 자동으로 재요청을 실행합니다.
 *
 * [문제 해결]
 * 토큰이 만료된 상태에서 페이지 진입 시:
 *  1. API 호출 → 401 응답
 *  2. refresh() 성공 (새 쿠키 세팅)
 *  3. tokenRefreshSignal 증가 → useFetch watch 트리거 → 자동 재요청 ✅
 *
 * [이전 동작]
 *  3. refresh() 후 아무것도 하지 않음 → 데이터 미수신 ❌
 */
const tokenRefreshSignal = ref(0);

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
    // 인증 store에서 인증 관련 함수를 가져옴
    const { refresh, logout } = useAuth();
    // 사용자 친화적 에러 메시지 표시용 Toast 서비스
    const toast = useToast();

    // 호출자가 전달한 watch 옵션과 tokenRefreshSignal을 병합합니다.
    // watch: false 인 경우(watch 비활성화 의도)에도 tokenRefreshSignal은 항상 포함합니다.
    const callerWatch = options.watch === false
        ? []
        : Array.isArray(options.watch)
            ? options.watch
            : options.watch
                ? [options.watch]
                : [];

    const params = {
        // 기존 옵션을 스프레드하여 덮어쓰기
        ...options,
        // 클라이언트 사이드에서만 실행 (SSR 비활성화)
        server: false,
        // tokenRefreshSignal 변경 시 자동 재요청하도록 watch 설정
        watch: [tokenRefreshSignal, ...callerWatch],
        /**
         * httpOnly 쿠키 자동 전송을 위한 credentials 설정
         * 브라우저가 accessToken 쿠키를 모든 요청에 자동으로 포함합니다.
         *
         * [httpOnly 쿠키 전환 이전]
         *  - Authorization 헤더를 computed로 동적 생성
         *  - accessToken 변경 시 watch로 자동 재요청
         *
         * [변경 후]
         *  - 쿠키는 브라우저가 관리하므로 헤더 주입/watch 불필요
         *  - credentials: 'include'만 설정
         */
        credentials: 'include' as RequestCredentials,
        /**
         * 네트워크 오류 핸들러 (서버 연결 자체가 불가능한 경우)
         * - fetch가 네트워크 레벨에서 실패(DNS 오류, 연결 거부 등)할 때 호출됩니다.
         */
        onRequestError: () => {
            toast.add({
                severity: 'error',
                summary: '네트워크 오류',
                detail: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.',
                life: 5000
            });
        },
        /**
         * 응답 에러 핸들러
         * - 401: 토큰 갱신 시도 → 실패 시 로그아웃 + 로그인 페이지 이동
         * - 403: 권한 없음 안내 Toast
         * - 404: 데이터 없음 안내 Toast
         * - 5xx: 서버 오류 안내 Toast
         * - isRefreshing 플래그로 중복 401 처리 방지
         */
        onResponseError: async ({ response }: { response: Response }) => {
            if (response.status === 401 && !isRefreshing) {
                isRefreshing = true;
                try {
                    const refreshed = await refresh();
                    if (refreshed) {
                        // 토큰 갱신 성공 → 신호 증가로 모든 useApiFetch 인스턴스 자동 재요청 유발
                        tokenRefreshSignal.value++;
                    } else {
                        // 토큰 갱신 실패 시 로그아웃 및 로그인 페이지로 이동
                        await logout();
                        navigateTo('/login');
                    }
                } finally {
                    // 갱신 성공/실패 여부와 상관없이 플래그 해제
                    isRefreshing = false;
                }
            } else if (response.status === 403) {
                toast.add({
                    severity: 'warn',
                    summary: '권한 없음',
                    detail: '해당 리소스에 접근 권한이 없습니다.',
                    life: 4000
                });
            } else if (response.status === 404) {
                toast.add({
                    severity: 'warn',
                    summary: '데이터 없음',
                    detail: '요청한 데이터를 찾을 수 없습니다.',
                    life: 3000
                });
            } else if (response.status >= 500) {
                toast.add({
                    severity: 'error',
                    summary: '서버 오류',
                    detail: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    life: 5000
                });
            }
        }
    };

    return useFetch<T>(url, params as any);
};
