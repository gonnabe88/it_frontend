/**
 * ============================================================================
 * [stores/auth.ts] 인증 Pinia 스토어
 * ============================================================================
 * 사용자 인증 상태를 전역으로 관리하는 Pinia 스토어입니다.
 * 로그인/로그아웃/토큰 갱신/세션 복원의 핵심 비즈니스 로직을 담당합니다.
 *
 * [인증 전략: httpOnly 쿠키]
 *  - JWT 토큰(accessToken, refreshToken)은 서버가 Set-Cookie 헤더로
 *    httpOnly 쿠키에 저장합니다. JavaScript에서 직접 접근할 수 없습니다.
 *  - 모든 API 요청 시 브라우저가 쿠키를 자동으로 전송합니다.
 *  - 프론트엔드는 사용자 정보(user)만 관리하며, 토큰은 관리하지 않습니다.
 *
 * [관리 상태]
 *  - user            : 현재 로그인한 사용자 정보 (eno, empNm)
 *  - isAuthenticated : 로그인 여부 (user 존재 시 true)
 *
 * [인증 흐름]
 *  1. 로그인   → login()          → 서버가 쿠키 세팅 + user 정보 localStorage 저장
 *  2. 새로고침 → restoreSession() → localStorage에서 user 정보 복원
 *  3. 토큰 만료→ 401 핸들러       → refresh() → 서버가 새 쿠키 세팅
 *  4. 로그아웃 → logout()         → 서버가 쿠키 삭제 + localStorage 초기화
 *
 * [순환 참조 방지]
 *  - 이 스토어에서는 $apiFetch(plugins/auth.ts 제공) 대신
 *    Nuxt 내장 $fetch를 직접 사용합니다.
 *
 * [localStorage 키]
 *  - 'user' : User 객체 JSON 직렬화 문자열 (세션 복원 전용)
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

    // =========================================================================
    // Getters: 계산된 상태
    // =========================================================================

    /**
     * 로그인 여부 계산 getter
     * user 정보가 존재할 때 true를 반환합니다.
     *
     * [httpOnly 쿠키 전환 이전]
     *  - accessToken && user 모두 존재할 때 true
     *
     * [변경 후]
     *  - JWT 토큰은 httpOnly 쿠키에 있어 JS에서 접근 불가하므로
     *    user 정보 존재 여부만으로 판단합니다.
     *  - 실제 토큰 유효성은 API 호출 시 서버에서 검증합니다.
     */
    const isAuthenticated = computed(() => !!user.value);

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
     * 사원번호(eno)와 비밀번호로 서버에 인증을 요청합니다.
     * 성공 시 서버가 httpOnly 쿠키로 토큰을 세팅하고,
     * 응답 body의 사용자 정보를 Pinia 상태 및 localStorage에 저장합니다.
     *
     * [주의] $apiFetch 대신 $fetch를 사용합니다.
     * 로그인 시에는 아직 쿠키가 없으므로 인터셉터 없이 직접 호출합니다.
     *
     * @param credentials - 로그인 자격증명 (사원번호 + 비밀번호)
     * @throws 로그인 실패 시 서버 에러를 그대로 throw (컴포넌트에서 처리)
     */
    const login = async (credentials: LoginRequest): Promise<void> => {
        try {
            // credentials: 'include'로 서버가 Set-Cookie한 httpOnly 쿠키를 브라우저가 저장
            const response = await $fetch<LoginResponse>(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: credentials,
                credentials: 'include' // 쿠키 송수신 활성화
            });

            // 응답에서 사용자 정보만 Pinia 상태에 반영 (토큰은 쿠키에 자동 저장됨)
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
     * 서버에 로그아웃 API를 호출하여 쿠키를 만료시킵니다.
     * API 성공/실패 여부와 상관없이 클라이언트 상태를 초기화합니다.
     *
     * [설계 의도]
     * - 서버 API 호출이 실패하더라도 (토큰 만료 등) 로컬 상태는 반드시 초기화합니다.
     * - finally 블록에서 clearAuth()를 호출하여 이를 보장합니다.
     * - 서버가 Set-Cookie로 maxAge=0을 세팅하여 쿠키를 삭제합니다.
     */
    const logout = async (): Promise<void> => {
        try {
            // 서버에 로그아웃 요청 (쿠키가 자동 전송되어 인증됨)
            await $fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include' // httpOnly 쿠키 자동 전송
            }).catch(err => {
                // 토큰이 이미 만료된 경우 401이 발생할 수 있으므로 무시
                console.log('Logout API call failed (expected if token expired):', err);
            });
        } finally {
            // API 성공/실패 여부와 상관없이 클라이언트 상태 초기화 보장
            clearAuth();
        }
    };

    /**
     * JWT 액세스 토큰 갱신
     * 서버에 갱신 요청을 보내면 httpOnly 쿠키의 refreshToken을 자동으로 전송합니다.
     * 서버는 새 accessToken을 Set-Cookie로 세팅합니다.
     * 갱신 실패 시 자동으로 로그아웃 처리합니다.
     *
     * [호출 시점]
     * - useApiFetch의 onResponseError (401 응답 감지 시)
     * - plugins/auth.ts의 onResponseError (401 응답 감지 시)
     *
     * @returns 토큰 갱신 성공 여부 (true: 성공, false: 실패)
     */
    const refresh = async (): Promise<boolean> => {
        // user 정보가 없으면 로그인된 적이 없으므로 갱신 불가
        if (!user.value) {
            return false;
        }

        try {
            // refreshToken은 httpOnly 쿠키로 자동 전송됨 (body 불필요)
            await $fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                credentials: 'include' // httpOnly 쿠키 자동 전송
            });

            // 서버가 새 accessToken을 Set-Cookie로 세팅하므로
            // 프론트엔드에서 별도 처리 불필요
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
     * localStorage에 저장된 사용자 정보를 읽어 Pinia 상태를 복원합니다.
     * middleware/auth.global.ts에서 매 라우트 네비게이션마다 호출됩니다.
     *
     * [httpOnly 쿠키 전환 후]
     *  - JWT 토큰은 httpOnly 쿠키에 저장되어 브라우저가 관리합니다.
     *  - localStorage에는 user 정보만 저장하며, 이를 복원합니다.
     *  - 실제 토큰 유효성은 다음 API 호출 시 서버에서 검증합니다.
     *
     * [예외 처리]
     * - JSON.parse 실패(데이터 손상) 시 clearAuth()로 초기화합니다.
     */
    const restoreSession = (): void => {
        if (process.client) {
            const storedUser = localStorage.getItem('user');

            if (storedUser) {
                try {
                    // user 정보 복원 (토큰은 httpOnly 쿠키에 이미 저장됨)
                    user.value = JSON.parse(storedUser); // 손상된 JSON 대비 try/catch
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
     * 서버 응답(LoginResponse)으로 Pinia 상태를 설정하는 헬퍼
     * httpOnly 쿠키 전환 후 토큰은 관리하지 않으므로 user 정보만 설정합니다.
     *
     * @param data - 서버의 로그인 응답 객체 ({ eno, empNm })
     */
    const setAuth = (data: LoginResponse) => {
        user.value = {
            eno:    data.eno,
            empNm:  data.empNm,
            athIds: data.athIds ?? ['ITPZZ001'], // null 방어: 미등록 사용자 기본값
            bbrC:   data.bbrC ?? '',
        };
    };

    /**
     * 현재 Pinia 상태(user)를 localStorage에 저장
     * 브라우저 새로고침 후 restoreSession()이 이 값을 읽어 상태를 복원합니다.
     * 클라이언트 환경 체크는 호출부(login 등)에서 처리합니다.
     */
    const saveToStorage = () => {
        if (user.value) localStorage.setItem('user', JSON.stringify(user.value));
    };

    /**
     * Pinia 상태 및 localStorage 인증 데이터를 모두 초기화
     * 로그아웃, 토큰 갱신 실패, 세션 데이터 손상 시 호출됩니다.
     *
     * [참고] httpOnly 쿠키(accessToken, refreshToken)는 서버가 삭제합니다.
     * 프론트엔드에서는 user 정보만 초기화하면 됩니다.
     */
    const clearAuth = () => {
        user.value = null;

        if (process.client) {
            // localStorage에서 user 정보 제거
            localStorage.removeItem('user');
        }
    };

    // =========================================================================
    // 외부 노출 (composables/useAuth.ts를 통해 컴포넌트에서 사용)
    // =========================================================================
    return {
        user,
        isAuthenticated,
        login,
        logout,
        refresh,
        restoreSession
    };
});
