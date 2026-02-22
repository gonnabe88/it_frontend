/**
 * ============================================================================
 * [stores/auth.ts] 인증 Pinia 스토어
 * ============================================================================
 * 사용자 인증 상태를 전역으로 관리하는 Pinia 스토어입니다.
 * 로그인/로그아웃/토큰 갱신/세션 복원의 핵심 비즈니스 로직을 담당합니다.
 *
 * [관리 상태]
 *  - user         : 현재 로그인한 사용자 정보 (eno, empNm)
 *  - accessToken  : JWT 액세스 토큰 (API 요청 인증에 사용)
 *  - refreshToken : JWT 리프레시 토큰 (액세스 토큰 갱신에 사용)
 *  - isAuthenticated: 로그인 여부 (accessToken + user 모두 존재할 때 true)
 *
 * [인증 흐름]
 *  1. 로그인  → login()    → 상태 업데이트 + localStorage 저장
 *  2. 새로고침→ restoreSession() (middleware/auth.global.ts에서 호출)
 *  3. 토큰 만료→ useApiFetch / plugins/auth.ts의 401 핸들러 → refresh()
 *  4. 로그아웃→ logout()   → 서버 API 호출 + 상태/스토리지 초기화
 *
 * [순환 참조 방지]
 *  - 이 스토어에서는 $apiFetch(plugins/auth.ts 제공) 대신
 *    Nuxt 내장 $fetch를 직접 사용합니다.
 *    ($apiFetch는 이 스토어의 accessToken에 의존하므로 순환 참조 발생)
 *
 * [localStorage 키]
 *  - 'accessToken'  : JWT 액세스 토큰 문자열
 *  - 'refreshToken' : JWT 리프레시 토큰 문자열
 *  - 'user'         : User 객체 JSON 직렬화 문자열
 * ============================================================================
 */
import { defineStore } from 'pinia';
import type { LoginRequest, LoginResponse, User } from '~/types/auth';

/**
 * 인증 Pinia 스토어 정의 (Composition API 스타일)
 * 스토어 ID: 'auth' (devtools 및 SSR hydration 키로 사용)
 */
export const useAuthStore = defineStore('auth', () => {
    // =========================================================================
    // State: 반응형 상태 변수
    // =========================================================================

    /** 현재 로그인한 사용자 정보. 비로그인 시 null */
    const user = ref<User | null>(null);

    /** JWT 액세스 토큰. 모든 API 요청의 Authorization 헤더에 사용. 비로그인 시 null */
    const accessToken = ref<string | null>(null);

    /** JWT 리프레시 토큰. 액세스 토큰 만료 시 갱신 요청에 사용. 비로그인 시 null */
    const refreshToken = ref<string | null>(null);

    // =========================================================================
    // Getters: 계산된 상태
    // =========================================================================

    /**
     * 로그인 여부 계산 getter
     * accessToken과 user 정보가 모두 존재할 때만 true를 반환합니다.
     * 둘 중 하나라도 null이면 인증되지 않은 상태로 처리합니다.
     */
    const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

    // =========================================================================
    // 내부 설정
    // =========================================================================

    // runtimeConfig에서 API 베이스 URL 조회 (.env의 NUXT_PUBLIC_API_BASE 참조)
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/auth`;

    // =========================================================================
    // Actions: 비즈니스 로직
    // =========================================================================

    /**
     * 로그인 처리
     * 사원번호(eno)와 비밀번호로 서버에 인증을 요청하고,
     * 성공 시 토큰과 사용자 정보를 상태 및 localStorage에 저장합니다.
     *
     * [주의] $apiFetch 대신 $fetch를 사용합니다.
     * 로그인 시에는 아직 accessToken이 없으므로 인터셉터 없이 직접 호출합니다.
     *
     * @param credentials - 로그인 자격증명 (사원번호 + 비밀번호)
     * @throws 로그인 실패 시 서버 에러를 그대로 throw (컴포넌트에서 처리)
     */
    const login = async (credentials: LoginRequest): Promise<void> => {
        try {
            // 순환 참조 방지를 위해 기본 $fetch 사용 (Authorization 헤더 불필요)
            const response = await $fetch<LoginResponse>(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: credentials
            });

            // 응답받은 토큰과 사용자 정보를 Pinia 상태에 반영
            setAuth(response);

            // 클라이언트 환경에서만 localStorage에 저장 (SSR 환경 분기)
            if (process.client) {
                saveToStorage();
            }
        } catch (error) {
            console.error('Login failed:', error);
            throw error; // 로그인 페이지 컴포넌트에서 에러 메시지 처리
        }
    };

    /**
     * 로그아웃 처리
     * 서버에 로그아웃 API를 호출한 후(실패해도 무시),
     * 클라이언트의 인증 상태와 localStorage를 초기화합니다.
     *
     * [설계 의도]
     * - 서버 API 호출이 실패하더라도 (토큰 만료 등) 로컬 상태는 반드시 초기화합니다.
     * - finally 블록에서 clearAuth()를 호출하여 이를 보장합니다.
     */
    const logout = async (): Promise<void> => {
        try {
            if (accessToken.value) {
                // 서버에 토큰 무효화 요청 (실패 시 로그만 출력하고 계속 진행)
                await $fetch(`${API_BASE_URL}/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken.value}`
                    }
                }).catch(err => {
                    // 토큰이 이미 만료된 경우 401이 발생할 수 있으므로 무시
                    console.log('Logout API call failed (expected if token expired):', err);
                });
            }
        } finally {
            // API 성공/실패 여부와 상관없이 클라이언트 상태 초기화 보장
            clearAuth();
        }
    };

    /**
     * JWT 액세스 토큰 갱신
     * refreshToken을 사용하여 서버로부터 새로운 액세스 토큰을 발급받습니다.
     * 갱신 실패 시 자동으로 로그아웃 처리합니다.
     *
     * [호출 시점]
     * - useApiFetch의 onResponseError (401 응답 감지 시)
     * - plugins/auth.ts의 onResponseError (401 응답 감지 시)
     *
     * @returns 토큰 갱신 성공 여부 (true: 성공, false: 실패 또는 refreshToken 없음)
     */
    const refresh = async (): Promise<boolean> => {
        // refreshToken이 없으면 갱신 불가
        if (!refreshToken.value) {
            return false;
        }

        try {
            const response = await $fetch<LoginResponse>(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                body: {
                    refreshToken: refreshToken.value
                }
            });

            // 새로 발급받은 토큰으로 상태 업데이트
            accessToken.value = response.accessToken;
            refreshToken.value = response.refreshToken;

            // localStorage도 최신 토큰으로 갱신 (다음 새로고침 시 세션 복원용)
            if (process.client) {
                localStorage.setItem('accessToken', response.accessToken);
                localStorage.setItem('refreshToken', response.refreshToken);
            }

            return true;
        } catch (error) {
            // refreshToken도 만료된 경우 → 강제 로그아웃 처리
            console.error('Token refresh failed:', error);
            await logout();
            return false;
        }
    };

    /**
     * 페이지 새로고침 후 세션 복원
     * localStorage에 저장된 토큰과 사용자 정보를 읽어 Pinia 상태를 복원합니다.
     * middleware/auth.global.ts에서 매 라우트 네비게이션마다 호출됩니다.
     *
     * [localStorage 데이터 형식]
     *  - 'accessToken'  : 문자열 (JWT)
     *  - 'refreshToken' : 문자열 (JWT)
     *  - 'user'         : JSON 문자열 ({ eno, empNm })
     *
     * [예외 처리]
     * - JSON.parse 실패(데이터 손상) 시 clearAuth()로 초기화합니다.
     */
    const restoreSession = (): void => {
        if (process.client) {
            const storedAccessToken  = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');
            const storedUser         = localStorage.getItem('user');

            if (storedAccessToken && storedRefreshToken && storedUser) {
                try {
                    // 세 가지 값이 모두 존재할 때만 상태 복원
                    accessToken.value  = storedAccessToken;
                    refreshToken.value = storedRefreshToken;
                    user.value         = JSON.parse(storedUser); // 손상된 JSON 대비 try/catch
                } catch {
                    // JSON 파싱 실패 시 손상된 데이터를 제거하고 초기 상태로 복원
                    clearAuth();
                }
            }
        }
    };

    // =========================================================================
    // 내부 헬퍼 함수 (외부로 노출하지 않음)
    // =========================================================================

    /**
     * 서버 응답(LoginResponse)으로 Pinia 상태를 한 번에 설정하는 헬퍼
     * login() 및 향후 자동 로그인 기능에서 재사용할 수 있도록 분리합니다.
     *
     * @param data - 서버의 로그인/갱신 응답 객체
     */
    const setAuth = (data: LoginResponse) => {
        accessToken.value  = data.accessToken;
        refreshToken.value = data.refreshToken;
        user.value = {
            eno:   data.eno,
            empNm: data.empNm
        };
    };

    /**
     * 현재 Pinia 상태(accessToken, refreshToken, user)를 localStorage에 저장
     * 브라우저 새로고침 후 restoreSession()이 이 값을 읽어 상태를 복원합니다.
     * 클라이언트 환경 체크는 호출부(login 등)에서 처리합니다.
     */
    const saveToStorage = () => {
        if (accessToken.value)  localStorage.setItem('accessToken',  accessToken.value);
        if (refreshToken.value) localStorage.setItem('refreshToken', refreshToken.value);
        if (user.value)         localStorage.setItem('user',         JSON.stringify(user.value));
    };

    /**
     * Pinia 상태 및 localStorage 인증 데이터를 모두 초기화
     * 로그아웃, 토큰 갱신 실패, 세션 데이터 손상 시 호출됩니다.
     */
    const clearAuth = () => {
        accessToken.value  = null;
        refreshToken.value = null;
        user.value         = null;

        if (process.client) {
            // localStorage에서 인증 관련 키 모두 제거
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        }
    };

    // =========================================================================
    // 외부 노출 (composables/useAuth.ts를 통해 컴포넌트에서 사용)
    // =========================================================================
    return {
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        login,
        logout,
        refresh,
        restoreSession
    };
});
