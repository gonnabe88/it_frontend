/**
 * ============================================================================
 * [tests/unit/composables/useFiles.test.ts] 파일 관리 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useFiles } from '~/composables/useFiles';

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

const BASE = 'http://localhost:8080/api/files';

describe('useFiles', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    // -------------------------------------------------------------------------
    // fetchFiles
    // -------------------------------------------------------------------------
    describe('fetchFiles', () => {
        it('orcDtt+orcPkVl 기준으로 파일 목록을 조회한다', () => {
            const { fetchFiles } = useFiles();
            fetchFiles('요구사항정의서', 'DOC-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                BASE,
                expect.objectContaining({
                    query: { orcDtt: '요구사항정의서', orcPkVl: 'DOC-001' },
                    suppressNotFound: true,
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // uploadFile
    // -------------------------------------------------------------------------
    describe('uploadFile', () => {
        it('파일을 POST로 업로드한다', async () => {
            const mockResult = { flMngNo: 'FL-001', orcFlNm: 'test.pdf' };
            mockApiFetch.mockResolvedValue(mockResult);
            const { uploadFile } = useFiles();

            const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
            const result = await uploadFile(file, '첨부파일', 'DOC-001', '요구사항정의서');

            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                expect.objectContaining({ method: 'POST' })
            );
            const callBody = mockApiFetch.mock.calls[0][1].body as FormData;
            expect(callBody.get('flDtt')).toBe('첨부파일');
            expect(callBody.get('orcPkVl')).toBe('DOC-001');
            expect(callBody.get('orcDtt')).toBe('요구사항정의서');
            expect(result).toEqual(mockResult);
        });

        it('이미지 타입으로 업로드한다', async () => {
            mockApiFetch.mockResolvedValue({ flMngNo: 'FL-002' });
            const { uploadFile } = useFiles();

            const file = new File(['img'], 'photo.png', { type: 'image/png' });
            await uploadFile(file, '이미지', '', '에디터');

            const callBody = mockApiFetch.mock.calls[0][1].body as FormData;
            expect(callBody.get('flDtt')).toBe('이미지');
        });
    });

    // -------------------------------------------------------------------------
    // uploadFilesBulk
    // -------------------------------------------------------------------------
    describe('uploadFilesBulk', () => {
        it('여러 파일을 일괄 업로드한다', async () => {
            const mockResult = { successList: [{ flMngNo: 'FL-001' }], failList: [] };
            mockApiFetch.mockResolvedValue(mockResult);
            const { uploadFilesBulk } = useFiles();

            const files = [
                new File(['a'], 'a.pdf', { type: 'application/pdf' }),
                new File(['b'], 'b.pdf', { type: 'application/pdf' }),
            ];
            const result = await uploadFilesBulk(files, '첨부파일', 'DOC-001', '요구사항정의서');

            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/bulk`,
                expect.objectContaining({ method: 'POST' })
            );
            const callBody = mockApiFetch.mock.calls[0][1].body as FormData;
            expect(callBody.get('flDtt')).toBe('첨부파일');
            expect(result).toEqual(mockResult);
        });
    });

    // -------------------------------------------------------------------------
    // updateFileMeta
    // -------------------------------------------------------------------------
    describe('updateFileMeta', () => {
        it('파일 메타데이터를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateFileMeta } = useFiles();
            await updateFileMeta('FL-001', { orcPkVl: 'DOC-002' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/FL-001`,
                { method: 'PUT', body: { orcPkVl: 'DOC-002' } }
            );
        });

        it('orcDtt도 함께 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateFileMeta } = useFiles();
            await updateFileMeta('FL-001', { orcPkVl: 'DOC-003', orcDtt: '사업계획서' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/FL-001`,
                { method: 'PUT', body: { orcPkVl: 'DOC-003', orcDtt: '사업계획서' } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // deleteFile
    // -------------------------------------------------------------------------
    describe('deleteFile', () => {
        it('파일을 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteFile } = useFiles();
            await deleteFile('FL-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/FL-001`,
                { method: 'DELETE' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // getPreviewUrl
    // -------------------------------------------------------------------------
    describe('getPreviewUrl', () => {
        it('문자열 ID를 받으면 preview URL을 반환한다', () => {
            const { getPreviewUrl } = useFiles();
            const url = getPreviewUrl('FL-001');
            expect(url).toBe(`${BASE}/FL-001/preview`);
        });

        it('FileRecord에 previewUrl이 있으면 apiBase를 붙여 반환한다', () => {
            const { getPreviewUrl } = useFiles();
            const fileRecord = {
                flMngNo: 'FL-001',
                orcFlNm: 'test.png',
                svrFlNm: 'uuid.png',
                flKpnPth: '/uploads',
                flDtt: '이미지' as const,
                orcPkVl: 'DOC-001',
                orcDtt: '에디터',
                fstEnrDtm: '2026-04-01T10:00:00',
                fstEnrUsid: 'E001',
                previewUrl: '/api/files/FL-001/preview',
            };
            const url = getPreviewUrl(fileRecord);
            expect(url).toBe('http://localhost:8080/api/files/FL-001/preview');
        });

        it('FileRecord에 previewUrl이 없으면 flMngNo로 구성한다', () => {
            const { getPreviewUrl } = useFiles();
            const fileRecord = {
                flMngNo: 'FL-002',
                orcFlNm: 'file.pdf',
                svrFlNm: 'uuid.pdf',
                flKpnPth: '/uploads',
                flDtt: '첨부파일' as const,
                orcPkVl: 'DOC-001',
                orcDtt: '요구사항정의서',
                fstEnrDtm: '2026-04-01T10:00:00',
                fstEnrUsid: 'E001',
            };
            const url = getPreviewUrl(fileRecord);
            expect(url).toBe(`${BASE}/FL-002/preview`);
        });
    });

    // -------------------------------------------------------------------------
    // getDownloadUrl
    // -------------------------------------------------------------------------
    describe('getDownloadUrl', () => {
        it('문자열 ID를 받으면 download URL을 반환한다', () => {
            const { getDownloadUrl } = useFiles();
            const url = getDownloadUrl('FL-001');
            expect(url).toBe(`${BASE}/FL-001/download`);
        });

        it('FileRecord에 downloadUrl이 있으면 apiBase를 붙여 반환한다', () => {
            const { getDownloadUrl } = useFiles();
            const fileRecord = {
                flMngNo: 'FL-001',
                orcFlNm: 'test.pdf',
                svrFlNm: 'uuid.pdf',
                flKpnPth: '/uploads',
                flDtt: '첨부파일' as const,
                orcPkVl: 'DOC-001',
                orcDtt: '요구사항정의서',
                fstEnrDtm: '2026-04-01T10:00:00',
                fstEnrUsid: 'E001',
                downloadUrl: '/api/files/FL-001/download',
            };
            const url = getDownloadUrl(fileRecord);
            expect(url).toBe('http://localhost:8080/api/files/FL-001/download');
        });

        it('FileRecord에 downloadUrl이 없으면 flMngNo로 구성한다', () => {
            const { getDownloadUrl } = useFiles();
            const fileRecord = {
                flMngNo: 'FL-003',
                orcFlNm: 'doc.xlsx',
                svrFlNm: 'uuid.xlsx',
                flKpnPth: '/uploads',
                flDtt: '첨부파일' as const,
                orcPkVl: 'PRJ-001',
                orcDtt: '프로젝트',
                fstEnrDtm: '2026-04-01T10:00:00',
                fstEnrUsid: 'E001',
            };
            const url = getDownloadUrl(fileRecord);
            expect(url).toBe(`${BASE}/FL-003/download`);
        });
    });
});
