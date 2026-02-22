/**
 * ============================================================================
 * [useAuth] 인증 상태 노출 Composable
 * ============================================================================
 * Pinia 인증 스토어(stores/auth.ts)를 컴포넌트에서 편리하게 사용하기 위한
 * 래퍼(wrapper) composable입니다.
 *
 * [역할]
 *  - storeToRefs()를 통해 Pinia state를 반응형 ref로 변환하여 구조분해 할당
 *    시에도 반응성이 유지되도록 합니다.
 *  - 인증 관련 액션(login, logout, refresh, restoreSession)을 직접 노출합니다.
 *  - types/auth.ts의 타입들을 re-export하여 기존 import 경로와의 호환성을 유지합니다.
 *
 * [사용처]
 *  - 로그인/로그아웃 UI 컴포넌트
 *  - useApiFetch (토큰 주입 및 갱신)
 *  - middleware/auth.global.ts (인증 상태 확인)
 * ============================================================================
 */
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

/**
 * types/auth.ts에서 정의된 타입을 re-export합니다.
 * 기존에 useAuth에서 타입을 import하던 코드와의 호환성을 유지하기 위함입니다.
 * (LoginRequest, LoginResponse, User 등 포함)
 */
export * from '../types/auth';

/**
 * 인증 상태 및 액션을 반환하는 Composable 함수
 *
 * @returns 인증 관련 상태(ref) 및 액션 함수 객체
 *   - user           : 현재 로그인한 사용자 정보 (ref<User | null>)
 *   - accessToken    : JWT 액세스 토큰 (ref<string | null>)
 *   - refreshToken   : JWT 리프레시 토큰 (ref<string | null>)
 *   - isAuthenticated: 로그인 여부 (ref<boolean>, getter)
 *   - login          : 로그인 액션 (stores/auth.ts 위임)
 *   - logout         : 로그아웃 액션 (stores/auth.ts 위임)
 *   - refresh        : 액세스 토큰 갱신 액션 (stores/auth.ts 위임)
 *   - restoreSession : 페이지 새로고침 후 세션 복원 액션 (stores/auth.ts 위임)
 *
 * @example
 * // 컴포넌트에서 사용
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * @example
 * // 반응형 상태 확인
 * if (isAuthenticated.value) {
 *   console.log('로그인된 사용자:', user.value?.empNm);
 * }
 */
export const useAuth = () => {
    // Pinia 인증 스토어 인스턴스 획득
    const store = useAuthStore();

    /**
     * storeToRefs로 state/getter를 반응형 ref로 변환
     * 구조분해 할당 후에도 반응성이 유지됩니다.
     * (일반 구조분해는 반응성을 잃으므로 주의)
     */
    const { user, accessToken, refreshToken, isAuthenticated } = storeToRefs(store);

    return {
        // 반응형 상태 (ref 형태로 반환)
        user,
        accessToken,
        refreshToken,
        isAuthenticated, // computed getter도 storeToRefs로 ref 변환 가능
        // 인증 액션 (store의 함수를 직접 참조하여 반응성 유지)
        login: store.login,
        logout: store.logout,
        refresh: store.refresh,
        restoreSession: store.restoreSession
    };
};
