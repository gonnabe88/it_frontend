/**
 * ============================================================================
 * [tests/unit/middleware/auth.global.test.ts] 전역 인증 미들웨어 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import authGlobalMiddleware from '~/middleware/auth.global';

// ============================================================================
// Mock 설정
// ============================================================================
const mockNavigateTo = vi.fn();
const mockAbortNavigation = vi.fn();
const mockRestoreSession = vi.fn();
const mockIsAdmin = vi.fn();
const mockIsAuthenticated = ref(false);
type MiddlewareHandler = (...args: unknown[]) => unknown;

vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: MiddlewareHandler) => fn);
vi.stubGlobal('abortNavigation', mockAbortNavigation);
vi.stubGlobal('useRuntimeConfig', () => ({
    public: {
        apiBase: 'http://localhost:8080',
    },
}));

vi.stubGlobal('useAuth', () => ({
    isAuthenticated: mockIsAuthenticated,
    restoreSession: mockRestoreSession,
    isAdmin: mockIsAdmin,
}));

describe('middleware/auth.global', () => {
    beforeEach(() => {
        mockNavigateTo.mockReset();
        mockAbortNavigation.mockReset();
        mockRestoreSession.mockReset();
        mockIsAdmin.mockReset();
        mockIsAuthenticated.value = false;
    });

    // -------------------------------------------------------------------------
    // restoreSession 호출 확인
    // -------------------------------------------------------------------------
    it('모든 라우트 진입 시 restoreSession을 호출한다', () => {
        mockIsAuthenticated.value = true;
        mockIsAdmin.mockReturnValue(false);
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/info/projects' }, {});
        expect(mockRestoreSession).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------------
    // /login 페이지 처리
    // -------------------------------------------------------------------------
    it('미인증 사용자가 /login에 접근하면 통과한다 (navigateTo 미호출)', () => {
        mockIsAuthenticated.value = false;
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/login' }, {});
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('미인증 사용자가 /login?redirect로 접근하면 로그인 페이지 없이 SSO로 이동한다', () => {
        mockIsAuthenticated.value = false;
        (authGlobalMiddleware as MiddlewareHandler)(
            { path: '/login', query: { redirect: '/info/projects/PRJ-2026-0014' } },
            {},
        );
        expect(mockAbortNavigation).toHaveBeenCalledTimes(1);
    });

    it('인증된 사용자가 /login에 접근하면 홈("/")으로 리다이렉트된다', () => {
        mockIsAuthenticated.value = true;
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/login' }, {});
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    // -------------------------------------------------------------------------
    // 일반 페이지 인증 가드
    // -------------------------------------------------------------------------
    it('미인증 사용자가 보호 페이지에 접근하면 /login으로 리다이렉트된다', () => {
        mockIsAuthenticated.value = false;
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/info/projects', fullPath: '/info/projects' }, {});
        expect(mockAbortNavigation).toHaveBeenCalledTimes(1);
    });

    it('인증된 사용자는 일반 페이지에 통과한다', () => {
        mockIsAuthenticated.value = true;
        mockIsAdmin.mockReturnValue(false);
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/info/projects' }, {});
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // /admin 페이지 접근 가드
    // -------------------------------------------------------------------------
    it('관리자는 /admin 페이지에 통과한다', () => {
        mockIsAuthenticated.value = true;
        mockIsAdmin.mockReturnValue(true);
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/admin/users' }, {});
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('관리자가 아닌 인증 사용자가 /admin에 접근하면 홈("/")으로 리다이렉트된다', () => {
        mockIsAuthenticated.value = true;
        mockIsAdmin.mockReturnValue(false);
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/admin/users' }, {});
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('/admin 하위 경로도 관리자 가드가 적용된다', () => {
        mockIsAuthenticated.value = true;
        mockIsAdmin.mockReturnValue(false);
        (authGlobalMiddleware as MiddlewareHandler)({ path: '/admin/settings/roles' }, {});
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });
});
