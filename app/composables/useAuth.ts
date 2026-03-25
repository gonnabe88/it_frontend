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
 * [httpOnly 쿠키 전환]
 *  - accessToken, refreshToken은 httpOnly 쿠키에 저장되어 JS 접근 불가하므로
 *    더 이상 노출하지 않습니다.
 *  - 이전에 accessToken을 사용하던 코드는 제거되었습니다.
 *
 * [사용처]
 *  - 로그인/로그아웃 UI 컴포넌트
 *  - useApiFetch (401 에러 시 갱신/로그아웃 처리)
 *  - middleware/auth.global.ts (인증 상태 확인)
 * ============================================================================
 */
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import { ROLE } from '~/types/auth';

/**
 * types/auth.ts에서 정의된 타입을 re-export합니다.
 * 기존에 useAuth에서 타입을 import하던 코드와의 호환성을 유지하기 위함입니다.
 * (LoginRequest, LoginResponse, User, ROLE 등 포함)
 */
export * from '../types/auth';

/**
 * 인증 상태 및 액션을 반환하는 Composable 함수
 *
 * [RBAC 권한 헬퍼]
 *  - isAdmin()      : 시스템관리자 여부 (ITPAD001 보유 시 true)
 *  - isDeptManager(): 기획통할담당자 여부 (ITPZZ002 또는 ITPAD001 보유 시 true)
 *  - isUser()       : 일반사용자 전용 여부 (Admin/DeptManager가 아닌 경우 true)
 *  - hasRole()      : 특정 자격등급 ID 보유 여부
 *  - canModify()    : 리소스 수정 권한 여부
 *    - Admin: 항상 가능
 *    - DeptManager: 소속 부서 리소스 수정 가능
 *    - User: 본인 작성 리소스만 수정 가능
 *
 * @returns 인증 관련 상태(ref), 액션 함수, 권한 헬퍼 함수 객체
 *   - user           : 현재 로그인한 사용자 정보 (ref<User | null>)
 *   - isAuthenticated: 로그인 여부 (ref<boolean>, getter)
 *   - login          : 로그인 액션 (stores/auth.ts 위임)
 *   - logout         : 로그아웃 액션 (stores/auth.ts 위임)
 *   - refresh        : 액세스 토큰 갱신 액션 (stores/auth.ts 위임)
 *   - restoreSession : 페이지 새로고침 후 세션 복원 액션 (stores/auth.ts 위임)
 *   - isAdmin        : 시스템관리자 여부 확인 함수
 *   - isDeptManager  : 기획통할담당자 여부 확인 함수 (관리자 포함)
 *   - isUser         : 일반사용자 전용 여부 확인 함수
 *   - hasRole        : 특정 자격등급 보유 여부 확인 함수
 *   - canModify      : 리소스 수정 권한 여부 확인 함수
 *
 * @example
 * // 컴포넌트에서 사용
 * const { user, isAuthenticated, login, logout, isAdmin, canModify } = useAuth();
 *
 * @example
 * // 반응형 상태 확인
 * if (isAuthenticated.value) {
 *   console.log('로그인된 사용자:', user.value?.empNm);
 * }
 *
 * @example
 * // 권한 헬퍼 사용
 * if (isAdmin()) { /* 관리자 전용 기능 *\/ }
 * if (canModify(row.fstEnrUsid, row.bbrC)) { /* 수정 버튼 표시 *\/ }
 */
export const useAuth = () => {
    // Pinia 인증 스토어 인스턴스 획득
    const store = useAuthStore();

    /**
     * storeToRefs로 state/getter를 반응형 ref로 변환
     * 구조분해 할당 후에도 반응성이 유지됩니다.
     * (일반 구조분해는 반응성을 잃으므로 주의)
     *
     * [httpOnly 쿠키 전환 후]
     *  - accessToken, refreshToken은 스토어에서 제거되어 더 이상 노출하지 않음
     */
    const { user, isAuthenticated } = storeToRefs(store);

    // =========================================================================
    // RBAC 권한 헬퍼 함수
    // =========================================================================

    /**
     * 시스템관리자(ITPAD001) 여부 확인
     * athIds 배열에 ITPAD001이 포함된 경우 true를 반환합니다.
     *
     * @returns 시스템관리자 자격등급 보유 여부
     */
    const isAdmin = (): boolean =>
        user.value?.athIds?.includes(ROLE.ADMIN) ?? false;

    /**
     * 기획통할담당자 여부 확인
     * ITPZZ002(기획통할담당자) 또는 ITPAD001(관리자)을 보유한 경우 true를 반환합니다.
     * 관리자는 기획통할담당자 권한을 포함하므로 isAdmin()도 true를 반환합니다.
     *
     * @returns 기획통할담당자 이상 자격등급 보유 여부
     */
    const isDeptManager = (): boolean =>
        user.value?.athIds?.some(id => id === ROLE.DEPT_MANAGER || id === ROLE.ADMIN) ?? false;

    /**
     * 일반사용자 전용 여부 확인
     * Admin 또는 DeptManager가 아닌 경우에만 true를 반환합니다.
     * 일반사용자(ITPZZ001)만 해당하는 조건부 UI 표시에 사용합니다.
     *
     * @returns 일반사용자 전용 여부 (Admin/DeptManager 제외)
     */
    const isUser = (): boolean => !isAdmin() && !isDeptManager();

    /**
     * 특정 자격등급 ID 보유 여부 확인
     * athIds 배열에 주어진 athId가 포함된 경우 true를 반환합니다.
     *
     * @param athId - 확인할 자격등급 ID (예: ROLE.ADMIN, ROLE.DEPT_MANAGER)
     * @returns 해당 자격등급 보유 여부
     */
    const hasRole = (athId: string): boolean =>
        user.value?.athIds?.includes(athId) ?? false;

    /**
     * 리소스 수정 권한 여부 확인
     * 사용자의 자격등급에 따라 3단계로 수정 권한을 결정합니다.
     *
     * [권한 단계]
     *  - 시스템관리자(ITPAD001): 모든 리소스 수정 가능
     *  - 기획통할담당자(ITPZZ002): 소속 부서(bbrC) 리소스 수정 가능
     *  - 일반사용자(ITPZZ001): 본인 작성 리소스만 수정 가능 (creatorEno 일치)
     *
     * @param creatorEno   - 리소스 최초 작성자 사번 (FST_ENR_USID)
     * @param resourceBbrC - 리소스 소속 부서코드 (선택적, 부서 단위 권한 확인용)
     * @returns 수정 권한 여부
     *
     * @example
     * // 템플릿에서 사용
     * <Button v-if="canModify(row.fstEnrUsid, row.bbrC)" label="수정" />
     */
    const canModify = (creatorEno: string, resourceBbrC?: string): boolean => {
        // 미로그인 상태에서는 수정 불가
        if (!user.value) return false;

        // 시스템관리자: 모든 리소스 수정 가능
        if (isAdmin()) return true;

        // 기획통할담당자: 소속 부서 리소스 수정 가능
        if (isDeptManager()) {
            // 리소스 부서코드가 전달된 경우 소속 부서와 일치 여부 확인
            if (resourceBbrC) return user.value.bbrC === resourceBbrC;
            // 부서코드 미전달 시 기획통할담당자 권한 허용
            return true;
        }

        // 일반사용자: 본인 작성 리소스만 수정 가능
        return user.value.eno === creatorEno;
    };

    return {
        // 반응형 상태 (ref 형태로 반환)
        user,
        isAuthenticated, // computed getter도 storeToRefs로 ref 변환 가능
        // 인증 액션 (store의 함수를 직접 참조하여 반응성 유지)
        login: store.login,
        logout: store.logout,
        refresh: store.refresh,
        restoreSession: store.restoreSession,
        // RBAC 권한 헬퍼 함수
        isAdmin,
        isDeptManager,
        isUser,
        hasRole,
        canModify,
    };
};
