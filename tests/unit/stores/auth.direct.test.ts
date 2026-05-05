/**
 * ============================================================================
 * [tests/unit/stores/auth.direct.test.ts] 인증 Pinia 스토어 직접 import 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';

import { useAuthStore } from '~/stores/auth';

// ============================================================================
// Mock 설정 — stores/auth.ts가 사용하는 Nuxt auto-import를 대체
// ============================================================================

// useCookie: ref를 반환하는 간단한 mock
const mockUserCookieValue = ref<Record<string, unknown> | null>(null);
vi.stubGlobal('useCookie', (_key: string, _opts?: unknown) => mockUserCookieValue);

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('computed', computed);
vi.stubGlobal('refreshCookie', vi.fn());

const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// import.meta.client = true (클라이언트 환경 시뮬레이션)
Object.defineProperty(import.meta, 'client', { get: () => true, configurable: true });

// localStorage 인메모리 mock
const localStorageStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { Reflect.deleteProperty(localStorageStore, key); },
    clear: () => { Object.keys(localStorageStore).forEach(k => Reflect.deleteProperty(localStorageStore, k)); },
});

describe('useAuthStore (직접 import)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockFetch.mockReset();
        mockUserCookieValue.value = null;
        Object.keys(localStorageStore).forEach(k => Reflect.deleteProperty(localStorageStore, k));
    });

    // -------------------------------------------------------------------------
    // isAuthenticated getter
    // -------------------------------------------------------------------------
    describe('isAuthenticated', () => {
        it('user가 null이면 false이다', () => {
            const store = useAuthStore();
            expect(store.isAuthenticated).toBe(false);
        });

        it('user가 설정되면 true이다', () => {
            mockUserCookieValue.value = { eno: 'E001', empNm: '홍길동', athIds: ['ITPAD001'], bbrC: 'BBR001', temC: 'TEM01' };
            const store = useAuthStore();
            expect(store.isAuthenticated).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // login
    // -------------------------------------------------------------------------
    describe('login()', () => {
        it('로그인 성공 시 user 쿠키에 사용자 정보를 저장한다', async () => {
            const loginResponse = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            mockFetch.mockResolvedValue(loginResponse);
            const store = useAuthStore();
            await store.login({ eno: 'E001', password: 'pw123' });
            expect(store.user).toMatchObject({ eno: 'E001', empNm: '홍길동' });
        });

        it('올바른 URL로 로그인 API를 호출한다', async () => {
            mockFetch.mockResolvedValue({ eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' });
            const store = useAuthStore();
            await store.login({ eno: 'E001', password: 'pw123' });
            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/auth/login',
                expect.objectContaining({ method: 'POST', credentials: 'include' })
            );
        });

        it('로그인 실패 시 에러를 throw한다', async () => {
            mockFetch.mockRejectedValue(new Error('Unauthorized'));
            const store = useAuthStore();
            await expect(store.login({ eno: 'E001', password: 'wrong' })).rejects.toThrow();
        });

        it('athIds가 null이면 기본값 ["ITPZZ001"]을 사용한다', async () => {
            mockFetch.mockResolvedValue({ eno: 'E001', empNm: '홍길동', athIds: null, bbrC: 'BBR001', temC: 'TEM01' });
            const store = useAuthStore();
            await store.login({ eno: 'E001', password: 'pw123' });
            expect(store.user?.athIds).toEqual(['ITPZZ001']);
        });
    });

    // -------------------------------------------------------------------------
    // logout
    // -------------------------------------------------------------------------
    describe('logout()', () => {
        it('로그아웃 후 user가 null이 된다', async () => {
            mockUserCookieValue.value = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            mockFetch.mockResolvedValue(undefined);
            const store = useAuthStore();
            await store.logout();
            expect(store.user).toBeNull();
        });

        it('로그아웃 API가 실패해도 user는 null이 된다', async () => {
            mockUserCookieValue.value = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            mockFetch.mockRejectedValue(new Error('Server error'));
            const store = useAuthStore();
            await store.logout();
            expect(store.user).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // refresh
    // -------------------------------------------------------------------------
    describe('refresh()', () => {
        it('user가 null이면 false를 반환한다', async () => {
            const store = useAuthStore();
            const result = await store.refresh();
            expect(result).toBe(false);
        });

        it('토큰 갱신 성공 시 true를 반환한다', async () => {
            mockUserCookieValue.value = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            mockFetch.mockResolvedValue(undefined);
            const store = useAuthStore();
            const result = await store.refresh();
            expect(result).toBe(true);
        });

        it('토큰 갱신 실패 시 false를 반환하고 로그아웃 처리한다', async () => {
            mockUserCookieValue.value = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            // refresh 실패 → logout 내부에서 두 번째 fetch 호출
            mockFetch.mockRejectedValueOnce(new Error('Refresh failed')).mockResolvedValueOnce(undefined);
            const store = useAuthStore();
            const result = await store.refresh();
            expect(result).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // restoreSession
    // -------------------------------------------------------------------------
    describe('restoreSession()', () => {
        it('localStorage에 user 정보가 있으면 쿠키로 복원한다', () => {
            const userData = { eno: 'E001', empNm: '홍길동', athIds: ['ITPZZ001'], bbrC: 'BBR001', temC: 'TEM01' };
            localStorageStore['user'] = JSON.stringify(userData);
            const store = useAuthStore();
            store.restoreSession();
            expect(store.user).toMatchObject({ eno: 'E001' });
        });

        it('localStorage에 user가 없으면 아무것도 하지 않는다', () => {
            const store = useAuthStore();
            store.restoreSession();
            expect(store.user).toBeNull();
        });

        it('localStorage에 손상된 JSON이 있어도 에러가 발생하지 않는다', () => {
            localStorageStore['user'] = 'invalid-json';
            const store = useAuthStore();
            expect(() => store.restoreSession()).not.toThrow();
        });
    });
});
