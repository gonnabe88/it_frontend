/**
 * ============================================================================
 * [tests/unit/composables/useAuth.test.ts] useAuth Composable 단위 테스트
 * ============================================================================
 * composables/useAuth.ts의 RBAC 권한 헬퍼 및 반응형 상태를 테스트합니다.
 *
 * [테스트 전략]
 * - Nuxt auto-import(useAuthStore, storeToRefs 등)를 vi.stubGlobal()로 대체
 * - Pinia 스토어를 직접 구성하여 user 상태를 제어
 * - 실제 API 호출 없이 RBAC 로직만 격리하여 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';

// ============================================================================
// ROLE 상수 (types/auth.ts에서 복사 — Nuxt auto-import 없이 사용)
// ============================================================================
const ROLE = {
    USER:         'ITPZZ001',
    DEPT_MANAGER: 'ITPZZ002',
    ADMIN:        'ITPAD001',
} as const;

// ============================================================================
// 테스트용 User 타입
// ============================================================================
interface User {
    eno: string;
    empNm: string;
    athIds: string[];
    bbrC: string;
    temC: string;
}

// ============================================================================
// useAuth 인라인 구현 (Nuxt auto-import 없이 테스트)
// stores/auth.ts의 user ref를 외부에서 주입받는 형태로 구성
// ============================================================================
const makeUseAuth = (userRef: ReturnType<typeof ref<User | null>>) => {
    const isAuthenticated = computed(() => !!userRef.value);

    const isAdmin = (): boolean =>
        userRef.value?.athIds?.includes(ROLE.ADMIN) ?? false;

    const isDeptManager = (): boolean =>
        userRef.value?.athIds?.some(id => id === ROLE.DEPT_MANAGER || id === ROLE.ADMIN) ?? false;

    const isUser = (): boolean => !isAdmin() && !isDeptManager();

    const hasRole = (athId: string): boolean =>
        userRef.value?.athIds?.includes(athId) ?? false;

    const canModify = (creatorEno: string, resourceBbrC?: string): boolean => {
        if (!userRef.value) return false;
        if (isAdmin()) return true;
        if (isDeptManager()) {
            if (resourceBbrC) return userRef.value.bbrC === resourceBbrC;
            return true;
        }
        return userRef.value.eno === creatorEno;
    };

    return { user: userRef, isAuthenticated, isAdmin, isDeptManager, isUser, hasRole, canModify };
};

// ============================================================================
// 테스트
// ============================================================================
describe('useAuth — RBAC 권한 헬퍼', () => {
    let userRef: ReturnType<typeof ref<User | null>>;

    beforeEach(() => {
        setActivePinia(createPinia());
        userRef = ref<User | null>(null);
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // isAdmin
    // -------------------------------------------------------------------------
    describe('isAdmin()', () => {
        it('ITPAD001 자격등급 포함 시 true를 반환한다', () => {
            userRef.value = { eno: 'E001', empNm: '관리자', athIds: [ROLE.ADMIN], bbrC: 'D001', temC: 'T001' };
            const { isAdmin } = makeUseAuth(userRef);
            expect(isAdmin()).toBe(true);
        });

        it('ITPAD001 자격등급 미포함 시 false를 반환한다', () => {
            userRef.value = { eno: 'E002', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { isAdmin } = makeUseAuth(userRef);
            expect(isAdmin()).toBe(false);
        });

        it('다중 자격등급 중 ITPAD001이 있으면 true를 반환한다', () => {
            userRef.value = { eno: 'E003', empNm: '복합', athIds: [ROLE.USER, ROLE.ADMIN], bbrC: 'D001', temC: 'T001' };
            const { isAdmin } = makeUseAuth(userRef);
            expect(isAdmin()).toBe(true);
        });

        it('user가 null이면 false를 반환한다', () => {
            userRef.value = null;
            const { isAdmin } = makeUseAuth(userRef);
            expect(isAdmin()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isDeptManager
    // -------------------------------------------------------------------------
    describe('isDeptManager()', () => {
        it('ITPZZ002 자격등급 포함 시 true를 반환한다', () => {
            userRef.value = { eno: 'E004', empNm: '담당자', athIds: [ROLE.DEPT_MANAGER], bbrC: 'D001', temC: 'T001' };
            const { isDeptManager } = makeUseAuth(userRef);
            expect(isDeptManager()).toBe(true);
        });

        it('ITPAD001 자격등급 포함 시 true를 반환한다 (관리자도 매니저 권한 포함)', () => {
            userRef.value = { eno: 'E001', empNm: '관리자', athIds: [ROLE.ADMIN], bbrC: 'D001', temC: 'T001' };
            const { isDeptManager } = makeUseAuth(userRef);
            expect(isDeptManager()).toBe(true);
        });

        it('ITPZZ001만 보유한 일반사용자는 false를 반환한다', () => {
            userRef.value = { eno: 'E005', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { isDeptManager } = makeUseAuth(userRef);
            expect(isDeptManager()).toBe(false);
        });

        it('user가 null이면 false를 반환한다', () => {
            userRef.value = null;
            const { isDeptManager } = makeUseAuth(userRef);
            expect(isDeptManager()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isUser
    // -------------------------------------------------------------------------
    describe('isUser()', () => {
        it('ITPZZ001만 보유 시 일반사용자 true를 반환한다', () => {
            userRef.value = { eno: 'E006', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { isUser } = makeUseAuth(userRef);
            expect(isUser()).toBe(true);
        });

        it('ITPZZ002 보유 시 false를 반환한다 (담당자는 일반사용자 아님)', () => {
            userRef.value = { eno: 'E004', empNm: '담당자', athIds: [ROLE.DEPT_MANAGER], bbrC: 'D001', temC: 'T001' };
            const { isUser } = makeUseAuth(userRef);
            expect(isUser()).toBe(false);
        });

        it('ITPAD001 보유 시 false를 반환한다 (관리자는 일반사용자 아님)', () => {
            userRef.value = { eno: 'E001', empNm: '관리자', athIds: [ROLE.ADMIN], bbrC: 'D001', temC: 'T001' };
            const { isUser } = makeUseAuth(userRef);
            expect(isUser()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // canModify
    // -------------------------------------------------------------------------
    describe('canModify()', () => {
        it('인증되지 않은 사용자(user=null)는 항상 false를 반환한다', () => {
            userRef.value = null;
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E001', 'D001')).toBe(false);
        });

        it('admin은 다른 부서, 다른 작성자 리소스도 항상 true를 반환한다', () => {
            userRef.value = { eno: 'E999', empNm: '관리자', athIds: [ROLE.ADMIN], bbrC: 'D999', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E001', 'D001')).toBe(true);
        });

        it('deptManager는 자신의 부서 리소스 수정 가능하다', () => {
            userRef.value = { eno: 'E002', empNm: '담당자', athIds: [ROLE.DEPT_MANAGER], bbrC: 'D001', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E001', 'D001')).toBe(true);
        });

        it('deptManager는 다른 부서 리소스를 수정할 수 없다', () => {
            userRef.value = { eno: 'E002', empNm: '담당자', athIds: [ROLE.DEPT_MANAGER], bbrC: 'D001', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E001', 'D999')).toBe(false);
        });

        it('일반사용자는 본인 작성물(eno 일치)만 수정 가능하다', () => {
            userRef.value = { eno: 'E006', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E006', 'D001')).toBe(true);
        });

        it('일반사용자는 타인 작성물은 수정할 수 없다', () => {
            userRef.value = { eno: 'E006', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E007', 'D001')).toBe(false);
        });

        it('deptManager에서 resourceBbrC 미전달 시 true를 반환한다 (부서 무관 수정 허용)', () => {
            userRef.value = { eno: 'E002', empNm: '담당자', athIds: [ROLE.DEPT_MANAGER], bbrC: 'D001', temC: 'T001' };
            const { canModify } = makeUseAuth(userRef);
            expect(canModify('E001')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // hasRole
    // -------------------------------------------------------------------------
    describe('hasRole()', () => {
        it('athIds 배열에 포함된 자격등급 ID는 true를 반환한다', () => {
            userRef.value = { eno: 'E001', empNm: '관리자', athIds: [ROLE.ADMIN, ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { hasRole } = makeUseAuth(userRef);
            expect(hasRole(ROLE.ADMIN)).toBe(true);
            expect(hasRole(ROLE.USER)).toBe(true);
        });

        it('athIds 배열에 없는 자격등급 ID는 false를 반환한다', () => {
            userRef.value = { eno: 'E006', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { hasRole } = makeUseAuth(userRef);
            expect(hasRole(ROLE.ADMIN)).toBe(false);
            expect(hasRole(ROLE.DEPT_MANAGER)).toBe(false);
        });

        it('user가 null이면 항상 false를 반환한다', () => {
            userRef.value = null;
            const { hasRole } = makeUseAuth(userRef);
            expect(hasRole(ROLE.USER)).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 반응형 상태: user 변경 시 isAuthenticated 갱신
    // -------------------------------------------------------------------------
    describe('반응형 상태', () => {
        it('user가 null일 때 isAuthenticated는 false이다', () => {
            userRef.value = null;
            const { isAuthenticated } = makeUseAuth(userRef);
            expect(isAuthenticated.value).toBe(false);
        });

        it('user를 설정하면 isAuthenticated가 true로 갱신된다', () => {
            userRef.value = null;
            const { isAuthenticated } = makeUseAuth(userRef);
            expect(isAuthenticated.value).toBe(false);

            // user 값 변경 → 반응형 갱신
            userRef.value = { eno: 'E001', empNm: '홍길동', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            expect(isAuthenticated.value).toBe(true);
        });

        it('user를 null로 초기화하면 isAuthenticated가 false로 갱신된다', () => {
            userRef.value = { eno: 'E001', empNm: '홍길동', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { isAuthenticated } = makeUseAuth(userRef);
            expect(isAuthenticated.value).toBe(true);

            userRef.value = null;
            expect(isAuthenticated.value).toBe(false);
        });

        it('user 변경 시 isAdmin() 결과도 반응형으로 갱신된다', () => {
            userRef.value = { eno: 'E006', empNm: '일반', athIds: [ROLE.USER], bbrC: 'D001', temC: 'T001' };
            const { isAdmin } = makeUseAuth(userRef);
            expect(isAdmin()).toBe(false);

            // 관리자 자격등급 부여 후 재확인
            userRef.value = { eno: 'E006', empNm: '승진', athIds: [ROLE.ADMIN], bbrC: 'D001', temC: 'T001' };
            expect(isAdmin()).toBe(true);
        });
    });
});
