/**
 * ============================================================================
 * [tests/unit/composables/useReview.direct.test.ts] useReview Composable 직접 import 테스트
 * ============================================================================
 * composables/useReview.ts를 직접 import하여 소스 커버리지를 생성합니다.
 * useReview는 stores/review.ts를 래핑하고 useToast로 알림을 표시합니다.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// ============================================================================
// Mock 설정
// ============================================================================

const mockToastAdd = vi.fn();
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }));

const mockLoadSession = vi.fn().mockResolvedValue(undefined);
const mockSubmitForReview = vi.fn();
const mockAddComment = vi.fn().mockResolvedValue({ id: 'CMT-001' });
const mockResolveComment = vi.fn().mockResolvedValue(undefined);
const mockCompleteReview = vi.fn();
const mockUpdateContent = vi.fn();
const mockViewVersion = vi.fn().mockResolvedValue(undefined);
const mockSetActiveComment = vi.fn();

const mockSession = {
    currentVersion: '1.00',
    reviewers: [
        { eno: 'E001', empNm: '홍길동', team: '개발팀', status: 'pending' },
    ],
};

vi.mock('~/stores/review', () => ({
    useReviewStore: () => ({
        session: mockSession,
        loadSession: mockLoadSession,
        submitForReview: mockSubmitForReview,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
        completeReview: mockCompleteReview,
        updateContent: mockUpdateContent,
        viewVersion: mockViewVersion,
        setActiveComment: mockSetActiveComment,
    }),
}));

import { useReview } from '~/composables/useReview';

describe('useReview (직접 import)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockToastAdd.mockReset();
        mockLoadSession.mockReset().mockResolvedValue(undefined);
        mockSubmitForReview.mockReset();
        mockAddComment.mockReset().mockResolvedValue({ id: 'CMT-001' });
        mockResolveComment.mockReset().mockResolvedValue(undefined);
        mockCompleteReview.mockReset();
        mockUpdateContent.mockReset();
        mockViewVersion.mockReset().mockResolvedValue(undefined);
        mockSetActiveComment.mockReset();
    });

    // -------------------------------------------------------------------------
    // store 노출
    // -------------------------------------------------------------------------
    it('store가 반환된다', () => {
        const { store } = useReview();
        expect(store).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // loadSession
    // -------------------------------------------------------------------------
    describe('loadSession()', () => {
        it('store.loadSession을 호출한다', async () => {
            const { loadSession } = useReview();
            await loadSession('DOC-001', '테스트 문서', '<p>내용</p>', 0);
            expect(mockLoadSession).toHaveBeenCalledWith('DOC-001', '테스트 문서', '<p>내용</p>', 0);
        });

        it('docVrs 기본값 0으로 호출 가능하다', async () => {
            const { loadSession } = useReview();
            await loadSession('DOC-001', '문서', '<p></p>');
            expect(mockLoadSession).toHaveBeenCalledWith('DOC-001', '문서', '<p></p>', 0);
        });
    });

    // -------------------------------------------------------------------------
    // submitForReview
    // -------------------------------------------------------------------------
    describe('submitForReview()', () => {
        it('store.submitForReview를 호출한다', () => {
            const { submitForReview } = useReview();
            submitForReview();
            expect(mockSubmitForReview).toHaveBeenCalledTimes(1);
        });

        it('성공 Toast를 표시한다', () => {
            const { submitForReview } = useReview();
            submitForReview();
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'success', summary: '검토요청 완료' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // addInlineComment
    // -------------------------------------------------------------------------
    describe('addInlineComment()', () => {
        it('store.addComment를 type: "inline"으로 호출한다', async () => {
            const { addInlineComment } = useReview();
            await addInlineComment({
                text: '코멘트 내용',
                markId: 'MARK-001',
                quotedText: '인용 텍스트',
                authorEno: 'E001',
                authorName: '홍길동',
                authorTeam: '개발팀' as any,
            });
            expect(mockAddComment).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'inline', text: '코멘트 내용', markId: 'MARK-001' })
            );
        });

        it('attachments 기본값은 빈 배열이다', async () => {
            const { addInlineComment } = useReview();
            await addInlineComment({
                text: '내용',
                markId: 'M-001',
                quotedText: '인용',
                authorEno: 'E001',
                authorName: '홍',
                authorTeam: '팀' as any,
            });
            expect(mockAddComment).toHaveBeenCalledWith(
                expect.objectContaining({ attachments: [] })
            );
        });
    });

    // -------------------------------------------------------------------------
    // addGeneralComment
    // -------------------------------------------------------------------------
    describe('addGeneralComment()', () => {
        it('store.addComment를 type: "general"로 호출한다', async () => {
            const { addGeneralComment } = useReview();
            await addGeneralComment({
                text: '전반 코멘트',
                authorEno: 'E001',
                authorName: '홍길동',
                authorTeam: '개발팀' as any,
            });
            expect(mockAddComment).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'general', text: '전반 코멘트' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // resolveComment
    // -------------------------------------------------------------------------
    describe('resolveComment()', () => {
        it('store.resolveComment를 호출한다', async () => {
            const { resolveComment } = useReview();
            await resolveComment('CMT-001');
            expect(mockResolveComment).toHaveBeenCalledWith('CMT-001');
        });
    });

    // -------------------------------------------------------------------------
    // completeReview
    // -------------------------------------------------------------------------
    describe('completeReview()', () => {
        it('store.completeReview를 호출한다', () => {
            const { completeReview } = useReview();
            completeReview('E001');
            expect(mockCompleteReview).toHaveBeenCalledWith('E001');
        });

        it('검토완료 Toast를 표시한다', () => {
            const { completeReview } = useReview();
            completeReview('E001');
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'success', summary: '검토완료' })
            );
        });

        it('존재하지 않는 검토자여도 Toast를 표시한다', () => {
            const { completeReview } = useReview();
            completeReview('E999');
            expect(mockToastAdd).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // updateContent
    // -------------------------------------------------------------------------
    describe('updateContent()', () => {
        it('store.updateContent를 호출한다', () => {
            const { updateContent } = useReview();
            updateContent('<p>수정됨</p>');
            expect(mockUpdateContent).toHaveBeenCalledWith('<p>수정됨</p>');
        });
    });

    // -------------------------------------------------------------------------
    // viewVersion
    // -------------------------------------------------------------------------
    describe('viewVersion()', () => {
        it('store.viewVersion을 호출한다', async () => {
            const { viewVersion } = useReview();
            await viewVersion('1.00');
            expect(mockViewVersion).toHaveBeenCalledWith('1.00');
        });

        it('null을 전달하면 현재 버전으로 복귀한다', async () => {
            const { viewVersion } = useReview();
            await viewVersion(null);
            expect(mockViewVersion).toHaveBeenCalledWith(null);
        });
    });

    // -------------------------------------------------------------------------
    // setActiveComment
    // -------------------------------------------------------------------------
    describe('setActiveComment()', () => {
        it('store.setActiveComment를 호출한다', () => {
            const { setActiveComment } = useReview();
            setActiveComment('CMT-001');
            expect(mockSetActiveComment).toHaveBeenCalledWith('CMT-001');
        });

        it('null 전달 시 활성 코멘트를 해제한다', () => {
            const { setActiveComment } = useReview();
            setActiveComment(null);
            expect(mockSetActiveComment).toHaveBeenCalledWith(null);
        });
    });
});
