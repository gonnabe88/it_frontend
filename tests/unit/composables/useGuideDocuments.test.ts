/**
 * ============================================================================
 * [tests/unit/composables/useGuideDocuments.test.ts] 가이드 문서 Composable 테스트
 * ============================================================================
 * composables/useGuideDocuments.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useGuideDocuments } from '~/composables/useGuideDocuments';

const mockApiFetch = vi.fn();
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useGuideDocuments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({
            data: ref(null),
            pending: ref(false),
            error: ref(null),
            refresh: vi.fn(),
        }));
    });

    describe('fetchGuideDocuments', () => {
        it('가이드 문서 목록 URL로 useApiFetch를 호출한다', () => {
            const { fetchGuideDocuments } = useGuideDocuments();
            fetchGuideDocuments();
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/guide-documents'
            );
        });
    });

    describe('fetchGuideDocument', () => {
        it('단건 조회 URL로 useApiFetch를 호출한다', () => {
            const { fetchGuideDocument } = useGuideDocuments();
            fetchGuideDocument('GDOC-2026-0001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/guide-documents/GDOC-2026-0001'
            );
        });
    });

    describe('createGuideDocument', () => {
        it('POST 요청으로 가이드 문서를 생성한다', async () => {
            mockApiFetch.mockResolvedValueOnce('GDOC-2026-0001');
            const { createGuideDocument } = useGuideDocuments();
            const result = await createGuideDocument({ docNm: '테스트 문서', docCone: '<p>내용</p>' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/guide-documents',
                expect.objectContaining({ method: 'POST' })
            );
            expect(result).toBe('GDOC-2026-0001');
        });
    });

    describe('updateGuideDocument', () => {
        it('PUT 요청으로 가이드 문서를 수정한다', async () => {
            mockApiFetch.mockResolvedValueOnce(undefined);
            const { updateGuideDocument } = useGuideDocuments();
            await updateGuideDocument('GDOC-2026-0001', { docNm: '수정된 문서', docCone: '<p>수정 내용</p>' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/guide-documents/GDOC-2026-0001',
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    describe('deleteGuideDocument', () => {
        it('DELETE 요청으로 가이드 문서를 삭제한다', async () => {
            mockApiFetch.mockResolvedValueOnce(undefined);
            const { deleteGuideDocument } = useGuideDocuments();
            await deleteGuideDocument('GDOC-2026-0001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/guide-documents/GDOC-2026-0001',
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });
});
