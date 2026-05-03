/**
 * ============================================================================
 * [tests/unit/composables/useCost.direct.test.ts] IT관리비 Composable 직접 import 테스트
 * ============================================================================
 * composables/useCost.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useCost } from '~/composables/useCost';

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

const BASE = 'http://localhost:8080/api/cost';

describe('useCost (직접 import)', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    describe('fetchCosts', () => {
        it('쿼리 없이 목록을 조회한다', () => {
            const { fetchCosts } = useCost();
            fetchCosts();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE, {});
        });

        it('쿼리 파라미터와 함께 목록을 조회한다', () => {
            const { fetchCosts } = useCost();
            fetchCosts({ apfSts: 'none' });
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE, { query: { apfSts: 'none' } });
        });
    });

    describe('fetchCost', () => {
        it('ID로 단일 항목을 조회한다', () => {
            const { fetchCost } = useCost();
            fetchCost('COST-2026-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/COST-2026-001`);
        });
    });

    describe('fetchCostOnce', () => {
        it('단일 항목을 일회성으로 조회한다', async () => {
            const mockData = { itMngcNo: 'COST-001' };
            mockApiFetch.mockResolvedValue(mockData);
            const { fetchCostOnce } = useCost();
            const result = await fetchCostOnce('COST-001');
            expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/COST-001`);
            expect(result).toEqual(mockData);
        });
    });

    describe('fetchCostsBulk', () => {
        it('관리번호 배열을 POST로 일괄 조회한다', async () => {
            mockApiFetch.mockResolvedValue([]);
            const { fetchCostsBulk } = useCost();
            await fetchCostsBulk(['COST-001', 'COST-002']);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/bulk-get`,
                { method: 'POST', body: { itMngcNos: ['COST-001', 'COST-002'] } }
            );
        });
    });

    describe('createCost', () => {
        it('IT관리비를 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue({ itMngcNo: 'COST-001' });
            const { createCost } = useCost();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = { itMngcNm: '서버유지비', bgYy: 2026 };
            await createCost(payload);
            expect(mockApiFetch).toHaveBeenCalledWith(BASE, { method: 'POST', body: payload });
        });
    });

    describe('updateCost', () => {
        it('IT관리비를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue({});
            const { updateCost } = useCost();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = { itMngcNo: 'COST-001', itMngcNm: '수정됨' };
            await updateCost('COST-001', payload);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/COST-001`,
                { method: 'PUT', body: payload }
            );
        });
    });

    describe('deleteCost', () => {
        it('IT관리비를 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteCost } = useCost();
            await deleteCost('COST-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/COST-001`,
                { method: 'DELETE' }
            );
        });
    });
});
