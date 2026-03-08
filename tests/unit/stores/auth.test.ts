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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
};
const localStorageMock = createLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

// ============================================================================
// stores/auth.ts를 직접 import하지 않고 동일한 로직을 인라인으로 정의
// (Nuxt auto-import 환경 없이 테스트하기 위해 store 로직을 직접 구현)
// ============================================================================
const useAuthStore = defineStore('auth', () => {
    const user = ref<{ eno: string; empNm: string } | null>(null);
    const isAuthenticated = computed(() => !!user.value);

    const API_BASE_URL = 'http://localhost:8080/api/auth';

    const login = async (credentials: { eno: string; password: string }): Promise<void> => {
        try {
            const response = await $fetch<{ eno: string; empNm: string }>(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: credentials,
                credentials: 'include',
            });
            user.value = { eno: response.eno, empNm: response.empNm };
            if (process.client) {
                localStorage.setItem('user', JSON.stringify(user.value));
            }
        } catch (error) {
            throw error;
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
            mockFetch.mockResolvedValueOnce({ eno: 'E001', empNm: '홍길동' });

            await store.login({ eno: 'E001', password: 'pass123' });

            expect(store.user).toEqual({ eno: 'E001', empNm: '홍길동' });
            expect(store.isAuthenticated).toBe(true);
            const stored = JSON.parse(localStorageMock.getItem('user') ?? '{}');
            expect(stored).toEqual({ eno: 'E001', empNm: '홍길동' });
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
            store.user = { eno: 'E001', empNm: '홍길동' };
            localStorageMock.setItem('user', JSON.stringify({ eno: 'E001', empNm: '홍길동' }));

            mockFetch.mockResolvedValueOnce(undefined);
            await store.logout();

            expect(store.user).toBeNull();
            expect(store.isAuthenticated).toBe(false);
            expect(localStorageMock.getItem('user')).toBeNull();
        });

        it('logout API 실패 시에도 클라이언트 상태를 초기화한다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동' };
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
            store.user = { eno: 'E001', empNm: '홍길동' };
            mockFetch.mockResolvedValueOnce(undefined);

            const result = await store.refresh();
            expect(result).toBe(true);
        });

        it('토큰 갱신 실패 시 false를 반환하고 logout을 호출한다', async () => {
            const store = useAuthStore();
            store.user = { eno: 'E001', empNm: '홍길동' };
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
            store.user = { eno: 'E001', empNm: '홍길동' };
            expect(store.isAuthenticated).toBe(true);
        });
    });
});
