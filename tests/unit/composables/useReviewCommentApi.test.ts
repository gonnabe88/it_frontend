/**
 * ============================================================================
 * [tests/unit/composables/useReviewCommentApi.test.ts] 코멘트 API Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock 설정
// ============================================================================
const mockApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));

import { useReviewCommentApi } from '~/composables/useReviewCommentApi';

const BASE = 'http://localhost:8080/api/documents';

describe('useReviewCommentApi', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    // -------------------------------------------------------------------------
    // fetchComments
    // -------------------------------------------------------------------------
    describe('fetchComments', () => {
        it('특정 버전의 코멘트 목록을 조회하고 ReviewComment 배열로 변환한다', async () => {
            const apiComments = [
                {
                    ivgSno: 'CMT-001',
                    docMngNo: 'DOC-001',
                    docVrs: 1,
                    ivgTp: 'I' as const,
                    ivgCone: '인라인 코멘트',
                    markId: 'mark-abc',
                    qtdCone: '인용 텍스트',
                    rslvYn: 'N' as const,
                    authorEno: 'E001',
                    authorName: '홍길동',
                    createdAt: '2026-04-01T10:00:00',
                },
                {
                    ivgSno: 'CMT-002',
                    docMngNo: 'DOC-001',
                    docVrs: 1,
                    ivgTp: 'G' as const,
                    ivgCone: '전반 코멘트',
                    markId: null,
                    qtdCone: null,
                    rslvYn: 'Y' as const,
                    authorEno: 'E002',
                    authorName: '김철수',
                    createdAt: '2026-04-02T09:00:00',
                },
            ];
            mockApiFetch.mockResolvedValue(apiComments);

            const { fetchComments } = useReviewCommentApi();
            const result = await fetchComments('DOC-001', 1);

            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001/review-comments`,
                { query: { docVrs: 1 } }
            );

            // 인라인 코멘트 변환 확인
            expect(result[0]).toMatchObject({
                id: 'CMT-001',
                type: 'inline',
                text: '인라인 코멘트',
                markId: 'mark-abc',
                quotedText: '인용 텍스트',
                resolved: false,
                authorEno: 'E001',
                authorName: '홍길동',
            });

            // 전반 코멘트 변환 확인
            expect(result[1]).toMatchObject({
                id: 'CMT-002',
                type: 'general',
                text: '전반 코멘트',
                resolved: true,
                authorEno: 'E002',
            });
        });

        it('markId/qtdCone이 null이면 undefined로 변환한다', async () => {
            mockApiFetch.mockResolvedValue([
                {
                    ivgSno: 'CMT-001',
                    docMngNo: 'DOC-001',
                    docVrs: 1,
                    ivgTp: 'G' as const,
                    ivgCone: '전반',
                    markId: null,
                    qtdCone: null,
                    rslvYn: 'N' as const,
                    authorEno: 'E001',
                    authorName: '홍길동',
                    createdAt: '2026-04-01T10:00:00',
                },
            ]);

            const { fetchComments } = useReviewCommentApi();
            const result = await fetchComments('DOC-001', 1);
            expect(result[0].markId).toBeUndefined();
            expect(result[0].quotedText).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // createComment
    // -------------------------------------------------------------------------
    describe('createComment', () => {
        it('인라인 코멘트를 POST로 생성하고 ReviewComment로 변환한다', async () => {
            const apiComment = {
                ivgSno: 'CMT-NEW',
                docMngNo: 'DOC-001',
                docVrs: 1,
                ivgTp: 'I' as const,
                ivgCone: '새 코멘트',
                markId: 'mark-xyz',
                qtdCone: '인용',
                rslvYn: 'N' as const,
                authorEno: 'E001',
                authorName: '홍길동',
                createdAt: '2026-04-03T11:00:00',
            };
            mockApiFetch.mockResolvedValue(apiComment);

            const { createComment } = useReviewCommentApi();
            const payload = {
                docVrs: 1,
                ivgTp: 'I' as const,
                ivgCone: '새 코멘트',
                markId: 'mark-xyz',
                qtdCone: '인용',
            };
            const result = await createComment('DOC-001', payload);

            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001/review-comments`,
                { method: 'POST', body: payload }
            );
            expect(result.id).toBe('CMT-NEW');
            expect(result.type).toBe('inline');
        });

        it('전반 코멘트를 생성한다', async () => {
            const apiComment = {
                ivgSno: 'CMT-G01',
                docMngNo: 'DOC-001',
                docVrs: 2,
                ivgTp: 'G' as const,
                ivgCone: '전반 코멘트',
                markId: null,
                qtdCone: null,
                rslvYn: 'N' as const,
                authorEno: 'E002',
                authorName: '이영희',
                createdAt: '2026-04-04T14:00:00',
            };
            mockApiFetch.mockResolvedValue(apiComment);

            const { createComment } = useReviewCommentApi();
            const result = await createComment('DOC-001', {
                docVrs: 2,
                ivgTp: 'G',
                ivgCone: '전반 코멘트',
            });
            expect(result.type).toBe('general');
        });
    });

    // -------------------------------------------------------------------------
    // resolveComment
    // -------------------------------------------------------------------------
    describe('resolveComment', () => {
        it('코멘트 해결 처리를 PATCH로 전송한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { resolveComment } = useReviewCommentApi();
            await resolveComment('DOC-001', 'CMT-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001/review-comments/CMT-001/resolve`,
                { method: 'PATCH' }
            );
        });
    });
});
