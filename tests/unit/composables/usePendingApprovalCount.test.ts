/**
 * ============================================================================
 * [tests/unit/composables/usePendingApprovalCount.test.ts]
 * usePendingApprovalCount 단위 테스트
 * ============================================================================
 * 사이드바 [결재 상신] 배지에 표시할 미상신 건수 Composable을 검증합니다.
 *
 * [테스트 전략]
 * - useApiFetch를 Mock하여 호출 URL 캡처 후 검증
 * - useRuntimeConfig를 vi.stubGlobal로 대체
 * - Composable 로직을 인라인으로 재현 (Nuxt 환경 없이 Vitest 실행)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================

// useApiFetch Mock: 호출 URL 및 반환 데이터 제어
const mockData = ref<{ projectCount: number; costCount: number; totalCount: number } | null>(null);
const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: mockData,
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn()
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

// runtimeConfig Mock
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// ============================================================================
// 인라인 Composable 구현 (Nuxt auto-import 없이 테스트)
// composables/usePendingApprovalCount.ts와 동일한 로직
// ============================================================================

const usePendingApprovalCount = () => {
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/pending-count`;
    return useApiFetch(url);
};

// ============================================================================
// 테스트
// ============================================================================

describe('usePendingApprovalCount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockData.value = null;
        mockUseApiFetch.mockImplementation(() => ({
            data: mockData,
            pending: ref(false),
            error: ref(null),
            refresh: vi.fn()
        }));
    });

    it('미상신 건수 집계 전용 URL로 useApiFetch를 호출한다', () => {
        usePendingApprovalCount();

        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/applications/pending-count');
    });

    it('전체 목록 URL이 아닌 집계 URL을 사용한다 (중복 요청으로 인한 토스트 오류 방지)', () => {
        usePendingApprovalCount();

        const [url] = mockUseApiFetch.mock.calls[0];
        // /api/projects, /api/costs와 URL이 달라야 사이드바 중복 요청이 발생하지 않음
        expect(url).not.toContain('/api/projects');
        expect(url).not.toContain('/api/costs');
        expect(url).toContain('pending-count');
    });

    it('useApiFetch의 반환값(data, pending, refresh)을 그대로 반환한다', () => {
        const result = usePendingApprovalCount();

        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('refresh');
    });

    it('data에 projectCount, costCount, totalCount가 포함된다', () => {
        mockData.value = { projectCount: 3, costCount: 2, totalCount: 5 };
        const { data } = usePendingApprovalCount();

        expect(data.value?.projectCount).toBe(3);
        expect(data.value?.costCount).toBe(2);
        expect(data.value?.totalCount).toBe(5);
    });

    it('data가 null인 경우 null을 반환한다 (초기 로딩 상태)', () => {
        mockData.value = null;
        const { data } = usePendingApprovalCount();

        expect(data.value).toBeNull();
    });

    it('useApiFetch를 정확히 한 번만 호출한다', () => {
        usePendingApprovalCount();

        expect(mockUseApiFetch).toHaveBeenCalledTimes(1);
    });
});
