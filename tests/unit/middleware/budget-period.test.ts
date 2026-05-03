/**
 * ============================================================================
 * [tests/unit/middleware/budget-period.test.ts] 예산 신청기간 미들웨어 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import budgetPeriodMiddleware from '~/middleware/budget-period';

// ============================================================================
// Mock 설정
// ============================================================================
const mockNavigateTo = vi.fn();
const mockIsWithinPeriod = ref(true);
type MiddlewareHandler = (...args: unknown[]) => unknown;

vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: MiddlewareHandler) => fn);
vi.stubGlobal('useBudgetPeriod', () => ({ isWithinPeriod: mockIsWithinPeriod }));

// import.meta.server = false (클라이언트 환경 시뮬레이션)
Object.defineProperty(import.meta, 'server', { get: () => false, configurable: true });

describe('middleware/budget-period', () => {
    beforeEach(() => {
        mockNavigateTo.mockReset();
        mockIsWithinPeriod.value = true;
    });

    it('신청 기간 내이면 통과한다 (navigateTo 미호출)', () => {
        mockIsWithinPeriod.value = true;
        (budgetPeriodMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('신청 기간 외이면 /budget으로 리다이렉트된다', () => {
        mockIsWithinPeriod.value = false;
        (budgetPeriodMiddleware as MiddlewareHandler)();
        expect(mockNavigateTo).toHaveBeenCalledWith('/budget');
    });
});
