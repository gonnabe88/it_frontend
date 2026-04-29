/**
 * ============================================================================
 * [tests/unit/composables/useApprovals.test.ts] 전자결재 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { useApprovals } from '~/composables/useApprovals';

const BASE = 'http://localhost:8080/api/applications';

describe('useApprovals', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    // -------------------------------------------------------------------------
    // fetchApprovals
    // -------------------------------------------------------------------------
    describe('fetchApprovals', () => {
        it('전체 신청서 목록을 조회한다', () => {
            const { fetchApprovals } = useApprovals();
            fetchApprovals();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE);
        });
    });

    // -------------------------------------------------------------------------
    // fetchApplication
    // -------------------------------------------------------------------------
    describe('fetchApplication', () => {
        it('단일 신청서 상세를 조회한다', async () => {
            const mockApproval = { apfMngNo: 'APF-2026-001', apfSts: '대기' };
            mockApiFetch.mockResolvedValue(mockApproval);
            const { fetchApplication } = useApprovals();
            const result = await fetchApplication('APF-2026-001');
            expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/APF-2026-001`);
            expect(result).toEqual(mockApproval);
        });
    });

    // -------------------------------------------------------------------------
    // createApplication
    // -------------------------------------------------------------------------
    describe('createApplication', () => {
        it('신청서를 POST로 생성한다', async () => {
            const created = { apfMngNo: 'APF-2026-001', apfSts: '대기' };
            mockApiFetch.mockResolvedValue(created);
            const { createApplication } = useApprovals();
            const request = {
                apfNm: '예산편성 신청',
                rqsEno: 'E001',
                rqsOpnn: '2026년도 IT 예산 편성 신청드립니다.',
                approverEnos: ['E002', 'E003'],
                orcItems: [{ orcTbCd: 'BPRJTM', orcPkVl: 'PRJ-001', orcSnoVl: '1' }],
            };
            const result = await createApplication(request);
            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                { method: 'POST', body: request }
            );
            expect(result).toEqual(created);
        });

        it('orcItems 없이 신청서를 생성한다', async () => {
            mockApiFetch.mockResolvedValue({ apfMngNo: 'APF-001' });
            const { createApplication } = useApprovals();
            const request = {
                apfNm: '단순 신청',
                rqsEno: 'E001',
                approverEnos: ['E002'],
            };
            await createApplication(request);
            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                { method: 'POST', body: request }
            );
        });
    });

    // -------------------------------------------------------------------------
    // bulkApprove
    // -------------------------------------------------------------------------
    describe('bulkApprove', () => {
        it('여러 신청서를 일괄 승인/반려한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { bulkApprove } = useApprovals();
            const approvals = [
                { apfMngNo: 'APF-001', dcdEno: 'E002', dcdOpnn: '승인합니다.', dcdSts: '승인' },
                { apfMngNo: 'APF-002', dcdEno: 'E002', dcdOpnn: '반려합니다.', dcdSts: '반려' },
            ];
            await bulkApprove(approvals);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/bulk-approve`,
                { method: 'POST', body: { approvals } }
            );
        });

        it('단일 신청서도 배열로 처리한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { bulkApprove } = useApprovals();
            const approvals = [
                { apfMngNo: 'APF-001', dcdEno: 'E002', dcdOpnn: '확인', dcdSts: '승인' },
            ];
            await bulkApprove(approvals);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/bulk-approve`,
                { method: 'POST', body: { approvals } }
            );
        });
    });
});
