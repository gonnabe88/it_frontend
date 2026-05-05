/**
 * ============================================================================
 * [tests/unit/composables/useDocuments.test.ts] 요구사항 정의서 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed, isRef } from 'vue';

import { useDocuments } from '~/composables/useDocuments';

// ============================================================================
// Mock 설정 — useDocuments.ts는 isRef/ref/computed를 Nuxt auto-import로 사용하므로
// vi.stubGlobal로 Vue의 실제 구현체를 주입한다
// ============================================================================
const mockApiFetch = vi.fn();
const mockUseApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);
vi.stubGlobal('isRef', isRef);
vi.stubGlobal('ref', ref);
vi.stubGlobal('computed', computed);

const BASE = 'http://localhost:8080/api/documents';

describe('useDocuments', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    // -------------------------------------------------------------------------
    // fetchDocuments
    // -------------------------------------------------------------------------
    describe('fetchDocuments', () => {
        it('요구사항 정의서 전체 목록을 조회한다', () => {
            const { fetchDocuments } = useDocuments();
            fetchDocuments();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE);
        });
    });

    // -------------------------------------------------------------------------
    // fetchDocument
    // -------------------------------------------------------------------------
    describe('fetchDocument', () => {
        it('버전 없이 최신 버전을 조회한다', () => {
            const { fetchDocument } = useDocuments();
            fetchDocument('DOC-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001`,
                expect.objectContaining({ watch: expect.any(Array) })
            );
            const callOptions = mockUseApiFetch.mock.calls[0][1];
            expect(callOptions.query.value).toEqual({});
        });

        it('정적 버전 번호와 함께 조회한다', () => {
            const { fetchDocument } = useDocuments();
            fetchDocument('DOC-001', 1);
            const callOptions = mockUseApiFetch.mock.calls[0][1];
            expect(callOptions.query.value).toEqual({ version: 1 });
        });

        it('Ref 버전으로 조회한다', () => {
            const { fetchDocument } = useDocuments();
            const versionRef = ref<number | undefined>(2);
            fetchDocument('DOC-001', versionRef);
            const callOptions = mockUseApiFetch.mock.calls[0][1];
            expect(callOptions.query.value).toEqual({ version: 2 });
        });
    });

    // -------------------------------------------------------------------------
    // fetchVersionHistory
    // -------------------------------------------------------------------------
    describe('fetchVersionHistory', () => {
        it('버전 히스토리를 조회한다', async () => {
            const mockHistory = [{ docMngNo: 'DOC-001', docVrs: 0.01 }];
            mockApiFetch.mockResolvedValue(mockHistory);
            const { fetchVersionHistory } = useDocuments();
            const result = await fetchVersionHistory('DOC-001');
            expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/DOC-001/versions`);
            expect(result).toEqual(mockHistory);
        });
    });

    // -------------------------------------------------------------------------
    // createNewVersion
    // -------------------------------------------------------------------------
    describe('createNewVersion', () => {
        it('새 버전을 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue('DOC-001-v2');
            const { createNewVersion } = useDocuments();
            const result = await createNewVersion('DOC-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001/versions`,
                { method: 'POST' }
            );
            expect(result).toBe('DOC-001-v2');
        });
    });

    // -------------------------------------------------------------------------
    // createDocument
    // -------------------------------------------------------------------------
    describe('createDocument', () => {
        it('요구사항 정의서를 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue('DOC-001');
            const { createDocument } = useDocuments();
            const body = {
                reqNm: '사용자 로그인 기능',
                reqCone: '<p>내용</p>',
                reqDtt: '2026-04-01',
                bzDtt: '2026-04-30',
                fsgTlm: '2026-05-31',
            };
            const result = await createDocument(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                { method: 'POST', body }
            );
            expect(result).toBe('DOC-001');
        });
    });

    // -------------------------------------------------------------------------
    // updateDocument
    // -------------------------------------------------------------------------
    describe('updateDocument', () => {
        it('요구사항 정의서를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue('DOC-001');
            const { updateDocument } = useDocuments();
            const body = {
                reqNm: '수정된 요구사항',
                reqCone: '<p>수정내용</p>',
                reqDtt: '2026-04-02',
                bzDtt: '2026-05-01',
                fsgTlm: '2026-06-01',
            };
            await updateDocument('DOC-001', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001`,
                { method: 'PUT', body }
            );
        });
    });

    // -------------------------------------------------------------------------
    // deleteDocument
    // -------------------------------------------------------------------------
    describe('deleteDocument', () => {
        it('전체 버전을 삭제한다 (version 미지정)', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteDocument } = useDocuments();
            await deleteDocument('DOC-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001`,
                { method: 'DELETE' }
            );
        });

        it('특정 버전을 삭제한다 (version 지정)', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteDocument } = useDocuments();
            await deleteDocument('DOC-001', 1);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/DOC-001`,
                { method: 'DELETE', query: { version: 1 } }
            );
        });
    });
});
