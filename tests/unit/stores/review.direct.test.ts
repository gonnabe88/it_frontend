/**
 * ============================================================================
 * [tests/unit/stores/review.direct.test.ts] 사전협의 스토어 직접 import 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================

const mockFetchVersionHistory = vi.fn().mockResolvedValue([]);
const mockFetchComments = vi.fn().mockResolvedValue([]);
const mockCreateComment = vi.fn();
const mockResolveCommentApi = vi.fn().mockResolvedValue(undefined);

vi.mock('~/composables/useDocuments', () => ({
    useDocuments: () => ({ fetchVersionHistory: mockFetchVersionHistory }),
}));

vi.mock('~/composables/useReviewCommentApi', () => ({
    useReviewCommentApi: () => ({
        fetchComments: mockFetchComments,
        createComment: mockCreateComment,
        resolveComment: mockResolveCommentApi,
    }),
}));

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: vi.fn() }));
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8080' } }));
vi.stubGlobal('ref', ref);
vi.stubGlobal('computed', computed);

import { useReviewStore } from '~/stores/review';

describe('useReviewStore (직접 import)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mockFetchVersionHistory.mockReset();
        mockFetchVersionHistory.mockResolvedValue([]);
        mockFetchComments.mockReset();
        mockFetchComments.mockResolvedValue([]);
        mockCreateComment.mockReset();
        mockResolveCommentApi.mockReset();
        mockResolveCommentApi.mockResolvedValue(undefined);
    });

    // -------------------------------------------------------------------------
    // loadSession
    // -------------------------------------------------------------------------
    describe('loadSession()', () => {
        it('세션을 초기화하고 docMngNo와 docTitle을 저장한다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.session?.docMngNo).toBe('DOC-001');
            expect(store.session?.docTitle).toBe('테스트 문서');
        });

        it('초기 status는 "draft"이다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.session?.status).toBe('draft');
        });

        it('initialContent가 draftContent에 설정된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.session?.draftContent).toBe('<p>내용</p>');
        });

        it('docVrs가 0이면 currentVersion은 "0.00"이다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>', 0);
            expect(store.session?.currentVersion).toBe('0.00');
        });

        it('docVrs가 양수이면 해당 버전이 currentVersion으로 설정된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>', 1.0);
            expect(store.session?.currentVersion).toBe('1.00');
        });

        it('기본 검토자 목록이 설정된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.session?.reviewers.length).toBeGreaterThan(0);
        });

        it('viewingVersion과 activeCommentId가 null로 초기화된다', async () => {
            const store = useReviewStore();
            store.viewingVersion = 'old-version';
            store.activeCommentId = 'old-comment';
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.viewingVersion).toBeNull();
            expect(store.activeCommentId).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // updateContent
    // -------------------------------------------------------------------------
    describe('updateContent()', () => {
        it('draftContent를 업데이트한다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>초기</p>');
            store.updateContent('<p>수정됨</p>');
            expect(store.session?.draftContent).toBe('<p>수정됨</p>');
        });

        it('session이 없으면 아무것도 하지 않는다', () => {
            const store = useReviewStore();
            expect(() => store.updateContent('<p>내용</p>')).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // submitForReview
    // -------------------------------------------------------------------------
    describe('submitForReview()', () => {
        it('현재 버전이 "0.00"이면 제출 후 "1.00"이 된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            store.submitForReview();
            expect(store.session?.currentVersion).toBe('1.00');
        });

        it('제출 후 status가 "reviewing"이 된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            store.submitForReview();
            expect(store.session?.status).toBe('reviewing');
        });

        it('제출 후 버전 스냅샷이 추가된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            const initialVersionCount = store.session?.versions.length ?? 0;
            store.submitForReview();
            expect(store.session!.versions.length).toBeGreaterThan(initialVersionCount);
        });

        it('session이 없으면 아무것도 하지 않는다', () => {
            const store = useReviewStore();
            expect(() => store.submitForReview()).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // completeReview
    // -------------------------------------------------------------------------
    describe('completeReview()', () => {
        it('검토자의 status를 "completed"로 변경한다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            const reviewerEno = store.session!.reviewers[0]!.eno;
            store.completeReview(reviewerEno);
            const reviewer = store.session!.reviewers.find(r => r.eno === reviewerEno);
            expect(reviewer?.status).toBe('completed');
        });

        it('전원 완료 시 session status가 "completed"가 된다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            for (const reviewer of store.session!.reviewers) {
                store.completeReview(reviewer.eno);
            }
            expect(store.session?.status).toBe('completed');
        });
    });

    // -------------------------------------------------------------------------
    // setActiveComment
    // -------------------------------------------------------------------------
    describe('setActiveComment()', () => {
        it('activeCommentId를 설정한다', () => {
            const store = useReviewStore();
            store.setActiveComment('CMT-001');
            expect(store.activeCommentId).toBe('CMT-001');
        });

        it('null을 전달하면 activeCommentId가 null이 된다', () => {
            const store = useReviewStore();
            store.activeCommentId = 'CMT-001';
            store.setActiveComment(null);
            expect(store.activeCommentId).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------
    describe('currentContent getter', () => {
        it('session이 없으면 빈 문자열을 반환한다', () => {
            const store = useReviewStore();
            expect(store.currentContent).toBe('');
        });

        it('viewingVersion이 null이면 draftContent를 반환한다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>드래프트</p>');
            expect(store.currentContent).toBe('<p>드래프트</p>');
        });
    });

    describe('sortedComments getter', () => {
        it('session이 없으면 빈 배열을 반환한다', () => {
            const store = useReviewStore();
            expect(store.sortedComments).toEqual([]);
        });
    });

    describe('inlineComments getter', () => {
        it('session이 없으면 빈 배열을 반환한다', () => {
            const store = useReviewStore();
            expect(store.inlineComments).toEqual([]);
        });
    });

    describe('allReviewCompleted getter', () => {
        it('session이 없으면 false이다', () => {
            const store = useReviewStore();
            expect(store.allReviewCompleted).toBe(false);
        });

        it('검토자가 있고 미완료이면 false이다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.allReviewCompleted).toBe(false);
        });
    });

    describe('versionList getter', () => {
        it('session이 없으면 빈 배열을 반환한다', () => {
            const store = useReviewStore();
            expect(store.versionList).toEqual([]);
        });

        it('버전 목록을 label/value 형태로 반환한다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.versionList.length).toBeGreaterThan(0);
            expect(store.versionList[0]).toHaveProperty('label');
            expect(store.versionList[0]).toHaveProperty('value');
        });
    });

    describe('isViewingHistory getter', () => {
        it('session이 없으면 false이다', () => {
            const store = useReviewStore();
            expect(store.isViewingHistory).toBe(false);
        });

        it('viewingVersion이 null이면 false이다', async () => {
            const store = useReviewStore();
            await store.loadSession('DOC-001', '테스트 문서', '<p>내용</p>');
            expect(store.isViewingHistory).toBe(false);
        });
    });
});
