/**
 * ============================================================================
 * [tests/unit/composables/useBudgetPeriod.test.ts] 예산 신청 기간 검증 Composable 테스트
 * ============================================================================
 * composables/useBudgetPeriod.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useBudgetPeriod } from '~/composables/useBudgetPeriod';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));
vi.stubGlobal('computed', computed);

const mockPeriodData = ref<{ startDate: string; endDate: string } | null>(null);
const mockUseApiFetch = vi.fn().mockImplementation(() => ({ data: mockPeriodData }));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useBudgetPeriod', () => {
    beforeEach(() => {
        mockPeriodData.value = null;
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({ data: mockPeriodData }));
    });

    it('periodData가 없으면(로딩 중) isWithinPeriod는 true를 반환한다', () => {
        mockPeriodData.value = null;
        const { isWithinPeriod } = useBudgetPeriod();
        expect(isWithinPeriod.value).toBe(true);
    });

    it('현재 날짜가 기간 내이면 isWithinPeriod는 true를 반환한다', () => {
        const today = new Date().toISOString().slice(0, 10);
        mockPeriodData.value = {
            startDate: '2020-01-01',
            endDate: '2099-12-31',
        };
        const { isWithinPeriod } = useBudgetPeriod();
        expect(isWithinPeriod.value).toBe(true);
    });

    it('현재 날짜가 기간 이전이면 isWithinPeriod는 false를 반환한다', () => {
        mockPeriodData.value = {
            startDate: '2099-01-01',
            endDate: '2099-12-31',
        };
        const { isWithinPeriod } = useBudgetPeriod();
        expect(isWithinPeriod.value).toBe(false);
    });

    it('현재 날짜가 기간 이후이면 isWithinPeriod는 false를 반환한다', () => {
        mockPeriodData.value = {
            startDate: '2000-01-01',
            endDate: '2000-12-31',
        };
        const { isWithinPeriod } = useBudgetPeriod();
        expect(isWithinPeriod.value).toBe(false);
    });

    it('periodInfo는 periodData를 그대로 반환한다', () => {
        const period = { startDate: '2026-01-01', endDate: '2026-12-31' };
        mockPeriodData.value = period;
        const { periodInfo } = useBudgetPeriod();
        expect(periodInfo.value).toEqual(period);
    });

    it('올바른 URL로 useApiFetch를 호출한다', () => {
        useBudgetPeriod();
        expect(mockUseApiFetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/ccodem/budget-period'
        );
    });
});
