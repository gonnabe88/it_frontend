/**
 * ============================================================================
 * [tests/unit/composables/useAuth.direct.test.ts] useAuth Composable 직접 import 테스트
 * ============================================================================
 * composables/useAuth.ts를 직접 import하여 소스 커버리지를 생성합니다.
 * 주요 테스트 대상: RBAC 권한 헬퍼(isAdmin, isDeptManager, isUser, hasRole, canModify),
 * 인증 상태(user, isAuthenticated), 액션 위임.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================

const mockUser = ref<{ eno: string; empNm: string; athIds: string[]; bbrC: string; temC: string } | null>(null);
const mockIsAuthenticated = ref(false);
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRefresh = vi.fn();
const mockRestoreSession = vi.fn();

vi.mock('~/stores/auth', () => ({
    useAuthStore: () => ({
        user: mockUser,
        isAuthenticated: mockIsAuthenticated,
        login: mockLogin,
        logout: mockLogout,
        refresh: mockRefresh,
        restoreSession: mockRestoreSession,
    }),
}));

// storeToRefs는 그냥 입력 객체의 ref 속성들을 그대로 반환하는 것처럼 동작
vi.mock('pinia', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        storeToRefs: (store: Record<string, unknown>) => {
            // 스토어 객체의 ref 값을 그대로 반환
            return {
                user: store.user,
                isAuthenticated: store.isAuthenticated,
            };
        },
    };
});

import { useAuth } from '~/composables/useAuth';

describe('useAuth (직접 import)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockUser.value = null;
        mockIsAuthenticated.value = false;
        mockLogin.mockReset();
        mockLogout.mockReset();
        mockRefresh.mockReset();
        mockRestoreSession.mockReset();
    });

    // -------------------------------------------------------------------------
    // 반응형 상태 노출
    // -------------------------------------------------------------------------
    describe('user, isAuthenticated 상태 노출', () => {
        it('user ref가 반환된다', () => {
            const { user } = useAuth();
            expect(user).toBe(mockUser);
        });

        it('isAuthenticated ref가 반환된다', () => {
            const { isAuthenticated } = useAuth();
            expect(isAuthenticated).toBe(mockIsAuthenticated);
        });
    });

    // -------------------------------------------------------------------------
    // 액션 위임
    // -------------------------------------------------------------------------
    describe('액션 위임', () => {
        it('login이 store.login과 동일하다', () => {
            const { login } = useAuth();
            expect(login).toBe(mockLogin);
        });

        it('logout이 store.logout과 동일하다', () => {
            const { logout } = useAuth();
            expect(logout).toBe(mockLogout);
        });

        it('refresh가 store.refresh와 동일하다', () => {
            const { refresh } = useAuth();
            expect(refresh).toBe(mockRefresh);
        });

        it('restoreSession이 store.restoreSession과 동일하다', () => {
            const { restoreSession } = useAuth();
            expect(restoreSession).toBe(mockRestoreSession);
        });
    });

    // -------------------------------------------------------------------------
    // isAdmin
    // -------------------------------------------------------------------------
    describe('isAdmin()', () => {
        it('user가 null이면 false이다', () => {
            mockUser.value = null;
            const { isAdmin } = useAuth();
            expect(isAdmin()).toBe(false);
        });

        it('ITPAD001을 보유하면 true이다', () => {
            mockUser.value = { eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'B001', temC: 'T01' };
            const { isAdmin } = useAuth();
            expect(isAdmin()).toBe(true);
        });

        it('ITPZZ001만 보유하면 false이다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { isAdmin } = useAuth();
            expect(isAdmin()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isDeptManager
    // -------------------------------------------------------------------------
    describe('isDeptManager()', () => {
        it('user가 null이면 false이다', () => {
            mockUser.value = null;
            const { isDeptManager } = useAuth();
            expect(isDeptManager()).toBe(false);
        });

        it('ITPZZ002를 보유하면 true이다', () => {
            mockUser.value = { eno: 'E001', empNm: '기획', athIds: ['ITPZZ002'], bbrC: 'B001', temC: 'T01' };
            const { isDeptManager } = useAuth();
            expect(isDeptManager()).toBe(true);
        });

        it('ITPAD001(관리자)을 보유해도 true이다', () => {
            mockUser.value = { eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'B001', temC: 'T01' };
            const { isDeptManager } = useAuth();
            expect(isDeptManager()).toBe(true);
        });

        it('ITPZZ001만 보유하면 false이다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { isDeptManager } = useAuth();
            expect(isDeptManager()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isUser
    // -------------------------------------------------------------------------
    describe('isUser()', () => {
        it('일반사용자(ITPZZ001)는 true이다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { isUser } = useAuth();
            expect(isUser()).toBe(true);
        });

        it('관리자는 false이다', () => {
            mockUser.value = { eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'B001', temC: 'T01' };
            const { isUser } = useAuth();
            expect(isUser()).toBe(false);
        });

        it('기획통할담당자는 false이다', () => {
            mockUser.value = { eno: 'E001', empNm: '기획', athIds: ['ITPZZ002'], bbrC: 'B001', temC: 'T01' };
            const { isUser } = useAuth();
            expect(isUser()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // hasRole
    // -------------------------------------------------------------------------
    describe('hasRole()', () => {
        it('해당 역할을 보유하면 true이다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { hasRole } = useAuth();
            expect(hasRole('ITPZZ001')).toBe(true);
        });

        it('해당 역할이 없으면 false이다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { hasRole } = useAuth();
            expect(hasRole('ITPAD001')).toBe(false);
        });

        it('user가 null이면 false이다', () => {
            mockUser.value = null;
            const { hasRole } = useAuth();
            expect(hasRole('ITPZZ001')).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // canModify
    // -------------------------------------------------------------------------
    describe('canModify()', () => {
        it('user가 null이면 false이다', () => {
            mockUser.value = null;
            const { canModify } = useAuth();
            expect(canModify('E001')).toBe(false);
        });

        it('관리자는 모든 리소스 수정 가능하다', () => {
            mockUser.value = { eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E999', 'B999')).toBe(true);
        });

        it('기획통할담당자는 같은 부서 리소스 수정 가능하다', () => {
            mockUser.value = { eno: 'E001', empNm: '기획', athIds: ['ITPZZ002'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E999', 'B001')).toBe(true);
        });

        it('기획통할담당자는 다른 부서 리소스 수정 불가하다', () => {
            mockUser.value = { eno: 'E001', empNm: '기획', athIds: ['ITPZZ002'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E999', 'B999')).toBe(false);
        });

        it('기획통할담당자는 부서코드 없으면 수정 가능하다', () => {
            mockUser.value = { eno: 'E001', empNm: '기획', athIds: ['ITPZZ002'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E999')).toBe(true);
        });

        it('일반사용자는 본인 작성 리소스만 수정 가능하다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E001')).toBe(true);
        });

        it('일반사용자는 타인 리소스 수정 불가하다', () => {
            mockUser.value = { eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'B001', temC: 'T01' };
            const { canModify } = useAuth();
            expect(canModify('E999')).toBe(false);
        });
    });
});
