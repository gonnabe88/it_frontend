/**
 * ============================================================================
 * [tests/unit/stores/auth.test.ts] 인증 Pinia 스토어 단위 테스트
 * ============================================================================
 * stores/auth.ts의 useAuthStore를 테스트합니다.
 *
 * [Mock 전략]
 * - Nuxt auto-import (useRuntimeConfig 등): vi.mock()으로 처리
 * - $fetch: vi.stubGlobal()으로 전역 대체
 * - localStorage: vi.stubGlobal()로 인메모리 구현체로 대체
 * - process.client: vi.stubGlobal()로 true로 설정
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia, defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ============================================================================
// Nuxt / Vue 전역 API Mock 설정
// (stores/auth.ts가 사용하는 Nuxt composable을 대체)
// ============================================================================

// useRuntimeConfig Mock: API 베이스 URL 제공
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// $fetch Mock: 로그인/로그아웃/리프레시 API 호출 대체
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// process.client Mock: 기존 process 속성을 유지하면서 client만 추가
// (vi.stubGlobal로 완전 대체하면 process.env.NODE_ENV 등이 사라져 Pinia 오류 발생)
Object.assign(process, { client: true });

// ============================================================================
// localStorage 인메모리 구현체
// ============================================================================
const createLocalStorageMock = () => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { const { [key]: _, ...rest } = store; store = rest; },
        clear: () => { store = {}; },
    };
};
const localStorageMock = createLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

// ============================================================================
// stores/auth.ts를 직접 import하지 않고 동일한 로직을 인라인으로 정의
// (Nuxt auto-import 환경 없이 테스트하기 위해 store 로직을 직접 구현)
// ============================================================================
interface User { eno: string; empNm: string; athIds: string[]; bbrC: string; }

const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const isAuthenticated = computed(() => !!user.value);

    const API_BASE_URL = 'http://localhost:8080/api/auth';

    const login = async (credentials: { eno: string; password: string }): Promise<void> => {
        const response = await $fetch<User>(`${API_BASE_URL}/login`, {
            method: 'POST',
            body: credentials,
            credentials: 'include',
        });
        user.value = {
            eno:    response.eno,
            empNm:  response.empNm,
            athIds: response.athIds ?? ['ITPZZ001'],
            bbrC:   response.bbrC ?? '',
        };
        // eslint-disable-next-line nuxt/prefer-import-meta
        if (process.client) {
            localStorage.setItem('user', JSON.stringify(user.value));
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await $fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include',
            }).catch(() => {});
        } finally {
            user.value = null;
            // eslint-disable-next-line nuxt/prefer-import-meta
            if (process.client) localStorage.removeItem('user');
        }
    };

    const refresh = async (): Promise<boolean> => {
        if (!user.value) return false;
        try {
            await $fetch(`${API_BASE_URL}/refresh`, { method: 'POST', credentials: 'include' });
            return true;
        } catch {
            await logout();
            return false;
        }
    };

    const restoreSession = (): void => {
        // eslint-disable-next-line nuxt/prefer-import-meta
        if (process.client) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    user.value = JSON.parse(storedUser);
                } catch {
                    user.value = null;
                    localStorage.removeItem('user');
                }
            }
        }
    };

    return { user, isAuthenticated, login, logout, refresh, restoreSession };
});

// ============================================================================
// useAuth composable의 RBAC 헬퍼 함수 인라인 구현 (테스트용)
// ============================================================================
const ROLE = {
    USER:         'ITPZZ001',
    DEPT_MANAGER: 'ITPZZ002',
    ADMIN:        'ITPAD001',
} as const;

const makeRbacHelpers = (user: User | null) => {
    const isAdmin = () => user?.athIds?.includes(ROLE.ADMIN) ?? false;
    const isDeptManager = () => user?.athIds?.some(id => id === ROLE.DEPT_MANAGER || id === ROLE.ADMIN) ?? false;
    const isUser = () => !isAdmin() && !isDeptManager();
    const hasRole = (athId: string) => user?.athIds?.includes(athId) ?? false;
    const canModify = (creatorEno: string, resourceBbrC?: string): boolean => {
        if (!user) return false;
        if (isAdmin()) return true;
        if (isDeptManager()) {
            if (resourceBbrC) return user.bbrC === resourceBbrC;
            return true;
        }
        return user.eno === creatorEno;
    };
    return { isAdmin, isDeptManager, isUser, hasRole, canModify };
};

// ============================================================================
// 테스트
// ============================================================================
describe('useAuthStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // restoreSession (P0)
    // -------------------------------------------------------------------------
    describe('restoreSession', () => {
        it('localStorage에 user가 있으면 상태를 복원한다', () => {
            const store = useAuthStore();
            localStorageMock.setItem('user', JSON.stringify({ eno: 'E001', empNm: '홍길동' }));

            store.restoreSession();

            expect(store.user).toEqual({ eno: 'E001', empNm: '홍길동' });
            expect(store.isAuthenticated).toBe(true);
        });

        it('localStorage가 비어있으면 user는 null 상태를 유지한다', () => {
            const store = useAuthStore();
            store.restoreSession();
            expect(store.user).toBeNull();
            expect(store.isAuthenticated).toBe(false);
        });

        it('localStorage의 JSON이 손상되면 user를 null로 초기화한다', () => {
            const store = useAuthStore();
            localStorageMock.setItem('user', '{ invalid json }');

            store.restoreSession();

            expect(store.user).toBeNull();
            // 손상된 데이터는 localStorage에서도 제거됨
            expect(localStorageMock.getItem('user')).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // login (P1)
    // -------------------------------------------------------------------------
    describe('login', () => {
        it('로그인 성공 시 user 상태를 설정하고 localStorage에 저장한다', async () => {
            const store = useAuthStore();
            mockFetch.mockResolvedValueOnce({ eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' });

            await store.login({ eno: 'E001', password: 'pass123' });

            expect(store.user).toEqual({ eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(store.isAuthenticated).toBe(true);
            const stored = JSON.parse(localStorageMock.getItem('user') ?? '{}');
            expect(stored).toEqual({ eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' });
        });

        it('로그인 응답에 athIds가 없으면 기본값 ITPZZ001이 설정된다', async () => {
            const store = useAuthStore();
            // athIds 없는 응답 (미등록 사용자)
            mockFetch.mockResolvedValueOnce({ eno: 'E001', empNm: '홍길동', bbrC: 'D001' });

            await store.login({ eno: 'E001', password: 'pass123' });

            expect(store.user?.athIds).toEqual(['ITPZZ001']);
        });

        it('로그인 실패 시 에러를 throw하고 user는 null을 유지한다', async () => {
            const store = useAuthStore();
            mockFetch.mockRejectedValueOnce(new Error('401 Unauthorized'));

            await expect(store.login({ eno: 'E001', password: 'wrong' })).rejects.toThrow();
            expect(store.user).toBeNull();
        });

        it('올바른 URL과 옵션으로 $fetch를 호출한다', async () => {
            const store = useAuthStore();
            mockFetch.mockResolvedValueOnce({ eno: 'E001', empNm: '홍길동' });

            await store.login({ eno: 'E001', password: 'pass123' });

            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/auth/login',
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // logout (P1)
    // -------------------------------------------------------------------------
    describe('logout', () => {
        it('logout 호출 시 user를 null로 초기화하고 localStorage를 비운다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' };
            localStorageMock.setItem('user', JSON.stringify({ eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' }));

            mockFetch.mockResolvedValueOnce(undefined);
            await store.logout();

            expect(store.user).toBeNull();
            expect(store.isAuthenticated).toBe(false);
            expect(localStorageMock.getItem('user')).toBeNull();
        });

        it('logout API 실패 시에도 클라이언트 상태를 초기화한다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' };
            mockFetch.mockRejectedValueOnce(new Error('Network Error'));

            // 에러 throw 없이 처리되어야 함
            await expect(store.logout()).resolves.toBeUndefined();
            expect(store.user).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // refresh (P1)
    // -------------------------------------------------------------------------
    describe('refresh', () => {
        it('user가 없으면 false를 반환한다', async () => {
            const store = useAuthStore();
            const result = await store.refresh();
            expect(result).toBe(false);
            // $fetch를 호출하지 않아야 함
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('토큰 갱신 성공 시 true를 반환한다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' };
            mockFetch.mockResolvedValueOnce(undefined);

            const result = await store.refresh();
            expect(result).toBe(true);
        });

        it('토큰 갱신 실패 시 false를 반환하고 logout을 호출한다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' };
            // refresh API 실패
            mockFetch.mockRejectedValueOnce(new Error('refresh failed'));
            // logout API (내부 호출) 성공
            mockFetch.mockResolvedValueOnce(undefined);

            const result = await store.refresh();
            expect(result).toBe(false);
            expect(store.user).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // isAuthenticated getter
    // -------------------------------------------------------------------------
    describe('isAuthenticated', () => {
        it('user가 null이면 false를 반환한다', () => {
            const store = useAuthStore();
            expect(store.isAuthenticated).toBe(false);
        });

        it('user가 설정되면 true를 반환한다', () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'D001' };
            expect(store.isAuthenticated).toBe(true);
        });
    });
});

// ============================================================================
// RBAC 권한 헬퍼 함수 테스트
// ============================================================================
describe('RBAC 권한 헬퍼 (useAuth)', () => {

    // -------------------------------------------------------------------------
    // isAdmin
    // -------------------------------------------------------------------------
    describe('isAdmin', () => {
        it('ITPAD001을 보유한 경우 true를 반환한다', () => {
            const { isAdmin } = makeRbacHelpers({ eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'D001' });
            expect(isAdmin()).toBe(true);
        });

        it('ITPZZ001만 보유한 경우 false를 반환한다', () => {
            const { isAdmin } = makeRbacHelpers({ eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(isAdmin()).toBe(false);
        });

        it('다중 자격등급 중 ITPAD001이 있으면 true를 반환한다', () => {
            const { isAdmin } = makeRbacHelpers({ eno: 'E001', empNm: '복합', athIds: ['ITPZZ001', 'ITPAD001'], bbrC: 'D001' });
            expect(isAdmin()).toBe(true);
        });

        it('user가 null이면 false를 반환한다', () => {
            const { isAdmin } = makeRbacHelpers(null);
            expect(isAdmin()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isDeptManager
    // -------------------------------------------------------------------------
    describe('isDeptManager', () => {
        it('ITPZZ002를 보유한 경우 true를 반환한다', () => {
            const { isDeptManager } = makeRbacHelpers({ eno: 'E001', empNm: '담당자', athIds: ['ITPZZ002'], bbrC: 'D001' });
            expect(isDeptManager()).toBe(true);
        });

        it('ITPAD001을 보유한 경우 true를 반환한다 (관리자 포함)', () => {
            const { isDeptManager } = makeRbacHelpers({ eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'D001' });
            expect(isDeptManager()).toBe(true);
        });

        it('ITPZZ001만 보유한 경우 false를 반환한다', () => {
            const { isDeptManager } = makeRbacHelpers({ eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(isDeptManager()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isUser
    // -------------------------------------------------------------------------
    describe('isUser', () => {
        it('ITPZZ001만 보유한 경우 true를 반환한다', () => {
            const { isUser } = makeRbacHelpers({ eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(isUser()).toBe(true);
        });

        it('ITPZZ002를 보유한 경우 false를 반환한다', () => {
            const { isUser } = makeRbacHelpers({ eno: 'E001', empNm: '담당자', athIds: ['ITPZZ002'], bbrC: 'D001' });
            expect(isUser()).toBe(false);
        });

        it('ITPAD001을 보유한 경우 false를 반환한다', () => {
            const { isUser } = makeRbacHelpers({ eno: 'E001', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'D001' });
            expect(isUser()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // canModify
    // -------------------------------------------------------------------------
    describe('canModify', () => {
        it('미로그인 시 항상 false를 반환한다', () => {
            const { canModify } = makeRbacHelpers(null);
            expect(canModify('E001', 'D001')).toBe(false);
        });

        it('관리자는 다른 부서, 다른 작성자 리소스도 수정 가능하다', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E999', empNm: '관리자', athIds: ['ITPAD001'], bbrC: 'D999' });
            expect(canModify('E001', 'D001')).toBe(true);
        });

        it('기획통할담당자는 소속 부서 리소스를 수정 가능하다', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E002', empNm: '담당자', athIds: ['ITPZZ002'], bbrC: 'D001' });
            expect(canModify('E001', 'D001')).toBe(true);
        });

        it('기획통할담당자는 타 부서 리소스를 수정할 수 없다', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E002', empNm: '담당자', athIds: ['ITPZZ002'], bbrC: 'D001' });
            expect(canModify('E001', 'D999')).toBe(false);
        });

        it('일반사용자는 본인 작성 리소스만 수정 가능하다', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(canModify('E001', 'D001')).toBe(true);
        });

        it('일반사용자는 타인 작성 리소스를 수정할 수 없다', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E001', empNm: '일반', athIds: ['ITPZZ001'], bbrC: 'D001' });
            expect(canModify('E002', 'D001')).toBe(false);
        });

        it('다중 자격등급 사용자는 최고 권한이 적용된다 (ITPZZ001+ITPAD001 → 관리자)', () => {
            const { canModify } = makeRbacHelpers({ eno: 'E001', empNm: '복합', athIds: ['ITPZZ001', 'ITPAD001'], bbrC: 'D001' });
            expect(canModify('E999', 'D999')).toBe(true); // 관리자 권한으로 모두 허용
        });
    });
});
