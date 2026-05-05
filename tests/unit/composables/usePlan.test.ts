/**
 * ============================================================================
 * [tests/unit/composables/usePlan.test.ts] 정보기술부문 계획 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { usePlan } from '~/composables/usePlan';

// ============================================================================
// Mock 설정
// ============================================================================
const mockApiFetch = vi.fn();
const mockUseApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

const BASE = 'http://localhost:8080/api/plans';

describe('usePlan', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    describe('fetchPlans', () => {
        it('계획 목록을 조회한다', () => {
            const { fetchPlans } = usePlan();
            fetchPlans();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE);
        });
    });

    describe('fetchPlan', () => {
        it('계획관리번호로 단일 계획을 조회한다', () => {
            const { fetchPlan } = usePlan();
            fetchPlan('PLN-2026-0001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/PLN-2026-0001`);
        });
    });

    describe('createPlan', () => {
        it('계획을 POST로 등록한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createPlan } = usePlan();
            const payload = {
                plnYy: '2026',
                plnTp: '신규',
                prjMngNos: ['PRJ-2026-0001', 'PRJ-2026-0002'],
                itMngcNos: ['COST-2026-001'],
            };
            await createPlan(payload);
            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                { method: 'POST', body: payload }
            );
        });
    });

    describe('deletePlan', () => {
        it('계획을 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deletePlan } = usePlan();
            await deletePlan('PLN-2026-0001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/PLN-2026-0001`,
                { method: 'DELETE' }
            );
        });
    });
});
