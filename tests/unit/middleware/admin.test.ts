/**
 * ============================================================================
 * [tests/unit/middleware/admin.test.ts] 관리자 접근 제어 미들웨어 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import adminMiddleware from '~/middleware/admin';

// ============================================================================
// Mock 설정
// ============================================================================
const mockNavigateTo = vi.fn();
const mockUser = ref<{ athIds: string[] } | null>(null);
type MiddlewareHandler = (...args: unknown[]) => unknown;

vi.stubGlobal('navigateTo', mockNavigateTo);

// useAuth는 정적 import이므로 vi.mock으로 모듈 수준에서 대체합니다.
vi.mock('~/composables/useAuth', () => ({
    useAuth: () => ({ user: mockUser }),
}));

describe('middleware/admin', () => {
    beforeEach(() => {
        mockNavigateTo.mockReset();
        mockUser.value = null;
    });

    it('ROLE.ADMIN(ITPAD001)을 보유한 사용자는 통과한다', () => {
        mockUser.value = { athIds: ['ITPAD001'] };
        (adminMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('ROLE.ADMIN이 없는 일반사용자는 홈("/")으로 리다이렉트된다', () => {
        mockUser.value = { athIds: ['ITPZZ001'] };
        (adminMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('user가 null이면 홈("/")으로 리다이렉트된다', () => {
        mockUser.value = null;
        (adminMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('기획통할담당자(ITPZZ002)는 홈("/")으로 리다이렉트된다', () => {
        mockUser.value = { athIds: ['ITPZZ002'] };
        (adminMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).toHaveBeenCalledWith('/');
    });

    it('여러 역할 중 ITPAD001이 포함되면 통과한다', () => {
        mockUser.value = { athIds: ['ITPZZ001', 'ITPAD001'] };
        (adminMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });
});
