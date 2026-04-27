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
 *  - user            : 현재 로그인한 사용자 정보 (eno, empNm 등) — useCookie로 관리
 *  - isAuthenticated : 로그인 여부 (user 존재 시 true)
 *
 * [인증 흐름]
 *  1. 로그인   → login()        → 서버가 JWT 쿠키 세팅 + user 정보 쿠키('it-portal-user') 저장
 *  2. 새로고침 → useCookie 자동 → SSR/클라이언트 모두 쿠키에서 즉시 복원 (플래시 없음)
 *  3. 토큰 만료→ 401 핸들러     → refresh() → 서버가 새 JWT 쿠키 세팅
 *  4. 로그아웃 → logout()       → 서버가 JWT 쿠키 삭제 + user 쿠키 초기화
 *
 * [순환 참조 방지]
 *  - 이 스토어에서는 $apiFetch(plugins/auth.ts 제공) 대신
 *    Nuxt 내장 $fetch를 직접 사용합니다.
 *
 * [쿠키 키]
 *  - 'it-portal-user' : User 객체 (SSR·클라이언트 공유, useCookie가 JSON 자동 직렬화)
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

    /**
     * 현재 로그인한 사용자 정보. 비로그인 시 null.
     * useCookie를 사용하므로 SSR 요청 시 서버에서도 쿠키를 읽어 즉시 복원됩니다.
     * → 새로고침 시 "로그인 풀림" 플래시 없음
     */
    const user = useCookie<User | null>('it-portal-user', {
        default: () => null,
        maxAge: 60 * 60 * 24 * 7, // 7일 (refreshToken 수명과 일치)
        sameSite: 'lax',
        path: '/'
    });

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

            // 응답에서 사용자 정보만 Pinia 상태에 반영 (토큰은 JWT 쿠키에 자동 저장됨)
            // useCookie 기반이므로 별도 저장 호출 불필요 — user.value 할당만으로 쿠키 갱신
            setAuth(response);
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
     * 구버전 localStorage 데이터 → 쿠키 마이그레이션
     * useCookie 전환 전에 localStorage에 저장된 user 정보를 쿠키로 옮깁니다.
     * middleware/auth.global.ts에서 클라이언트 최초 진입 시 호출됩니다.
     *
     * [동작 원리]
     *  - 이미 쿠키에 user가 있으면(정상 케이스) 아무것도 하지 않습니다.
     *  - 쿠키가 없고 localStorage에 데이터가 있으면 쿠키로 이전합니다.
     *  - 이전 후 localStorage 항목은 삭제합니다.
     */
    const restoreSession = (): void => {
        if (import.meta.client && !user.value) {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    user.value = JSON.parse(stored);
                } catch {
                    // 손상된 데이터는 무시
                }
                localStorage.removeItem('user');
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
            temC:   data.temC ?? '',
        };
    };

    /**
     * Pinia 상태(user 쿠키) 및 구버전 localStorage 데이터를 모두 초기화합니다.
     * 로그아웃, 토큰 갱신 실패, 세션 데이터 손상 시 호출됩니다.
     *
     * [참고] JWT 쿠키(accessToken, refreshToken)는 서버가 삭제합니다.
     * 프론트엔드에서는 user 쿠키만 초기화하면 됩니다.
     */
    const clearAuth = () => {
        user.value = null;

        if (import.meta.client) {
            localStorage.removeItem('user'); // 구버전 localStorage 잔존 데이터 정리
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
