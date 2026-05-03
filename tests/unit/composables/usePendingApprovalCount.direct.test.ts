/**
 * ============================================================================
 * [tests/unit/composables/usePendingApprovalCount.direct.test.ts]
 * 미상신 건수 조회 Composable 직접 import 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { usePendingApprovalCount } from '~/composables/usePendingApprovalCount';

// ============================================================================
// Mock 설정
// ============================================================================
const mockUseApiFetch = vi.fn();

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('usePendingApprovalCount (직접 import)', () => {
    beforeEach(() => {
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null });
    });

    it('올바른 URL로 미상신 건수를 조회한다', () => {
        usePendingApprovalCount();
        expect(mockUseApiFetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/applications/pending-count'
        );
    });

    it('useApiFetch 반환값을 그대로 반환한다', () => {
        const mockReturn = {
            data: { totalCount: 5, projectCount: 3, costCount: 2 },
            pending: false,
            error: null,
        };
        mockUseApiFetch.mockReturnValue(mockReturn);
        const result = usePendingApprovalCount();
        expect(result).toBe(mockReturn);
    });
});
