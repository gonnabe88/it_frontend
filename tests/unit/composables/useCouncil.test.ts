/**
 * ============================================================================
 * [tests/unit/composables/useCouncil.test.ts] 협의회 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useCouncil } from '~/composables/useCouncil';

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

const BASE = 'http://localhost:8080/api/council';

describe('useCouncil', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null });
    });

    // -------------------------------------------------------------------------
    // fetchCouncilList
    // -------------------------------------------------------------------------
    describe('fetchCouncilList', () => {
        it('올바른 URL로 useApiFetch를 호출한다', () => {
            const { fetchCouncilList } = useCouncil();
            fetchCouncilList();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE);
        });
    });

    // -------------------------------------------------------------------------
    // fetchCouncil
    // -------------------------------------------------------------------------
    describe('fetchCouncil', () => {
        it('asctId를 포함한 URL로 useApiFetch를 호출한다', () => {
            const { fetchCouncil } = useCouncil();
            fetchCouncil('ASCT-2026-0001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-2026-0001`);
        });
    });

    // -------------------------------------------------------------------------
    // createCouncil
    // -------------------------------------------------------------------------
    describe('createCouncil', () => {
        it('POST 방식으로 협의회를 생성한다', async () => {
            mockApiFetch.mockResolvedValue('ASCT-2026-0001');
            const { createCouncil } = useCouncil();
            const payload = { prjMngNo: 'PRJ-001', prjSno: 1, dbrTp: 'INFO_SYS' };
            const result = await createCouncil(payload);
            expect(mockApiFetch).toHaveBeenCalledWith(BASE, { method: 'POST', body: payload });
            expect(result).toBe('ASCT-2026-0001');
        });
    });

    // -------------------------------------------------------------------------
    // fetchFeasibility
    // -------------------------------------------------------------------------
    describe('fetchFeasibility', () => {
        it('타당성검토표를 올바른 URL로 조회한다', () => {
            const { fetchFeasibility } = useCouncil();
            fetchFeasibility('ASCT-2026-0001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-2026-0001/feasibility`);
        });
    });

    // -------------------------------------------------------------------------
    // saveFeasibility
    // -------------------------------------------------------------------------
    describe('saveFeasibility', () => {
        it('isUpdate=false이면 POST로 저장한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveFeasibility } = useCouncil();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await saveFeasibility('ASCT-001', {} as any, false);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/feasibility`,
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('isUpdate=true이면 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveFeasibility } = useCouncil();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await saveFeasibility('ASCT-001', {} as any, true);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/feasibility`,
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // requestApproval
    // -------------------------------------------------------------------------
    describe('requestApproval', () => {
        it('결재 요청을 POST로 전송한다', async () => {
            mockApiFetch.mockResolvedValue({ apfMngNo: 'APF-001' });
            const { requestApproval } = useCouncil();
            const result = await requestApproval('ASCT-001', 'E001', '신청합니다');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/approval`,
                expect.objectContaining({
                    method: 'POST',
                    body: { approverEno: 'E001', rqsOpnn: '신청합니다' },
                })
            );
            expect(result).toEqual({ apfMngNo: 'APF-001' });
        });
    });

    // -------------------------------------------------------------------------
    // fetchDefaultCommittee
    // -------------------------------------------------------------------------
    describe('fetchDefaultCommittee', () => {
        it('dbrTp 파라미터와 함께 기본 평가위원을 조회한다', () => {
            const { fetchDefaultCommittee } = useCouncil();
            fetchDefaultCommittee('ASCT-001', 'INFO_SYS');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/committee/default`,
                { query: { dbrTp: 'INFO_SYS' } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // fetchCommittee
    // -------------------------------------------------------------------------
    describe('fetchCommittee', () => {
        it('확정된 평가위원 목록을 조회한다 (suppressNotFound)', () => {
            const { fetchCommittee } = useCouncil();
            fetchCommittee('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/committee`,
                expect.objectContaining({ suppressNotFound: true })
            );
        });
    });

    // -------------------------------------------------------------------------
    // saveCommittee
    // -------------------------------------------------------------------------
    describe('saveCommittee', () => {
        it('평가위원을 PUT으로 저장한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveCommittee } = useCouncil();
            const payload = { dbrTp: 'INFO_SYS', members: [{ eno: 'E001', vlrTp: 'MAND' }] };
            await saveCommittee('ASCT-001', payload);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/committee`,
                { method: 'PUT', body: payload }
            );
        });
    });

    // -------------------------------------------------------------------------
    // fetchScheduleStatus
    // -------------------------------------------------------------------------
    describe('fetchScheduleStatus', () => {
        it('일정 입력 현황을 조회한다', () => {
            const { fetchScheduleStatus } = useCouncil();
            fetchScheduleStatus('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-001/schedule`);
        });
    });

    // -------------------------------------------------------------------------
    // confirmSchedule
    // -------------------------------------------------------------------------
    describe('confirmSchedule', () => {
        it('일정을 확정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { confirmSchedule } = useCouncil();
            await confirmSchedule('ASCT-001', '2026-06-15', '14:00', '회의실 A');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/schedule/confirm`,
                {
                    method: 'PUT',
                    body: { cnrcDt: '2026-06-15', cnrcTm: '14:00', cnrcPlc: '회의실 A' },
                }
            );
        });
    });

    // -------------------------------------------------------------------------
    // QnA 관련
    // -------------------------------------------------------------------------
    describe('QnA 관련', () => {
        it('fetchQnaList: 사전질의 목록을 조회한다', () => {
            const { fetchQnaList } = useCouncil();
            fetchQnaList('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-001/qna`);
        });

        it('createQna: 질의를 POST로 등록한다', async () => {
            mockApiFetch.mockResolvedValue('QTN-001');
            const { createQna } = useCouncil();
            const result = await createQna('ASCT-001', '질의 내용입니다');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/qna`,
                { method: 'POST', body: { qtnCone: '질의 내용입니다' } }
            );
            expect(result).toBe('QTN-001');
        });

        it('updateQna: 질의를 PATCH로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateQna } = useCouncil();
            await updateQna('ASCT-001', 'QTN-001', '수정된 질의');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/qna/QTN-001`,
                { method: 'PATCH', body: { qtnCone: '수정된 질의' } }
            );
        });

        it('replyQna: 답변을 PUT으로 등록한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { replyQna } = useCouncil();
            await replyQna('ASCT-001', 'QTN-001', '답변 내용');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/qna/QTN-001`,
                { method: 'PUT', body: { repCone: '답변 내용' } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 일정 (평가위원)
    // -------------------------------------------------------------------------
    describe('일정 (평가위원)', () => {
        it('fetchMySchedule: 내 일정을 조회한다 (suppressNotFound)', () => {
            const { fetchMySchedule } = useCouncil();
            fetchMySchedule('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/schedule/my`,
                expect.objectContaining({ suppressNotFound: true })
            );
        });

        it('submitSchedule: 일정을 POST로 제출한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { submitSchedule } = useCouncil();
            const slots = [{ dsdDt: '2026-06-15', dsdTm: '14:00', psbYn: 'Y' }];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await submitSchedule('ASCT-001', slots as any);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/schedule`,
                { method: 'POST', body: { availableSlots: slots } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 평가의견
    // -------------------------------------------------------------------------
    describe('평가의견', () => {
        it('fetchEvaluationSummary: 평가 현황을 조회한다', () => {
            const { fetchEvaluationSummary } = useCouncil();
            fetchEvaluationSummary('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-001/evaluation`);
        });

        it('saveEvaluation: 평가의견을 POST로 저장한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveEvaluation } = useCouncil();
            const items = [{ ckgItmC: 'A01', ckgRcrd: 4, ckgOpnn: '좋습니다' }];
            await saveEvaluation('ASCT-001', items);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/evaluation`,
                { method: 'POST', body: { items } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 결과서
    // -------------------------------------------------------------------------
    describe('결과서', () => {
        it('fetchResult: 결과서를 조회한다', () => {
            const { fetchResult } = useCouncil();
            fetchResult('ASCT-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/ASCT-001/result`);
        });

        it('saveResult: isUpdate=false이면 POST로 저장한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveResult } = useCouncil();
            const payload = { synOpnn: '적합', ckgOpnn: '검토완료', flMngNo: '' };
            await saveResult('ASCT-001', payload, false);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/result`,
                expect.objectContaining({ method: 'POST', body: payload })
            );
        });

        it('saveResult: isUpdate=true이면 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { saveResult } = useCouncil();
            const payload = { synOpnn: '수정', ckgOpnn: '재검토', flMngNo: '' };
            await saveResult('ASCT-001', payload, true);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/result`,
                expect.objectContaining({ method: 'PUT', body: payload })
            );
        });

        it('confirmResult: 결과서 확인을 PUT으로 전송한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { confirmResult } = useCouncil();
            await confirmResult('ASCT-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/result/confirm`,
                { method: 'PUT' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 협의회 상태 전이
    // -------------------------------------------------------------------------
    describe('협의회 상태 전이', () => {
        it('startCouncil: 협의회를 PATCH로 시작한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { startCouncil } = useCouncil();
            await startCouncil('ASCT-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/start`,
                { method: 'PATCH' }
            );
        });

        it('skipCouncil: 협의회를 PATCH로 생략한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { skipCouncil } = useCouncil();
            await skipCouncil('ASCT-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/ASCT-001/skip`,
                { method: 'PATCH' }
            );
        });
    });
});
