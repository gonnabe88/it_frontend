/**
 * ============================================================================
 * [tests/unit/composables/useBudgetStatus.test.ts] 예산 현황 Composable 테스트
 * ============================================================================
 * composables/useBudgetStatus.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBudgetStatus } from '~/composables/useBudgetStatus';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: ref([]),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useBudgetStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({
            data: ref([]),
            pending: ref(false),
            error: ref(null),
            refresh: vi.fn(),
        }));
    });

    describe('fetchProjectStatus', () => {
        it('정보화사업 현황 URL로 useApiFetch를 호출한다', () => {
            const { fetchProjectStatus } = useBudgetStatus();
            const bgYy = ref('2026');
            fetchProjectStatus(bgYy);
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/budget/status/projects',
                expect.objectContaining({ query: { bgYy } })
            );
        });

        it('반응형 Ref를 반환한다', () => {
            const { fetchProjectStatus } = useBudgetStatus();
            const result = fetchProjectStatus(ref('2026'));
            expect(result).toHaveProperty('data');
        });
    });

    describe('fetchCostStatus', () => {
        it('전산업무비 현황 URL로 useApiFetch를 호출한다', () => {
            const { fetchCostStatus } = useBudgetStatus();
            const bgYy = ref('2026');
            fetchCostStatus(bgYy);
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/budget/status/costs',
                expect.objectContaining({ query: { bgYy } })
            );
        });
    });

    describe('fetchOrdinaryStatus', () => {
        it('경상사업 현황 URL로 useApiFetch를 호출한다', () => {
            const { fetchOrdinaryStatus } = useBudgetStatus();
            const bgYy = ref('2026');
            fetchOrdinaryStatus(bgYy);
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/budget/status/ordinary',
                expect.objectContaining({ query: { bgYy } })
            );
        });
    });
});
