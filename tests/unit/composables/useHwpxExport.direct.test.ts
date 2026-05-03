/**
 * ============================================================================
 * [tests/unit/composables/useHwpxExport.direct.test.ts] useHwpxExport 직접 import 테스트
 * ============================================================================
 * composables/useHwpxExport.ts를 직접 import하여 소스 커버리지를 생성합니다.
 *
 * 주요 테스트 대상:
 *  - 빈 html 시 Toast 경고 표시
 *  - 정상 export 흐름 (htmlToHwpxBlob 호출, 다운로드 트리거)
 *  - authorEno 지정 시 $apiFetch로 부서명 조회
 *  - $apiFetch 실패 시에도 내보내기 계속 진행
 *  - htmlToHwpxBlob 실패 시 에러 Toast 표시
 *  - isExporting 상태 변화
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useHwpxExport } from '~/composables/useHwpxExport';

// ============================================================================
// vi.hoisted() — vi.mock 팩토리보다 먼저 초기화되어야 하는 mock 변수
// ============================================================================

const { mockToastAdd, mockHtmlToHwpxBlob, mockLoadScene } = vi.hoisted(() => ({
    mockToastAdd: vi.fn(),
    mockHtmlToHwpxBlob: vi.fn().mockResolvedValue(new Blob(['hwpx'], { type: 'application/zip' })),
    mockLoadScene: vi.fn().mockResolvedValue('{}'),
}));

// ============================================================================
// Mock 설정
// ============================================================================

const mockApiFetch = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:hwpx-url');
const mockRevokeObjectURL = vi.fn();
const mockAnchorClick = vi.fn();

// DOM mock
Object.defineProperty(globalThis, 'URL', {
    value: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
    writable: true, configurable: true,
});

const mockAnchor = { href: '', download: '', click: mockAnchorClick, remove: vi.fn() };
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return mockAnchor as unknown as HTMLElement;
    return document.createElement(tag);
});
vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node);

// Nuxt 전역
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8080' } }));
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));

// primevue/usetoast
vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: mockToastAdd }),
}));

// ~/utils/hwpx
vi.mock('~/utils/hwpx', () => ({
    htmlToHwpxBlob: mockHtmlToHwpxBlob,
}));

// ~/composables/useExcalidrawAttachment
vi.mock('~/composables/useExcalidrawAttachment', () => ({
    useExcalidrawAttachment: () => ({ loadScene: mockLoadScene }),
}));

describe('useHwpxExport (직접 import)', () => {
    beforeEach(() => {
        mockToastAdd.mockReset();
        mockApiFetch.mockReset().mockResolvedValue({ bbrNm: '개발팀' });
        mockLoadScene.mockReset().mockResolvedValue('{}');
        mockHtmlToHwpxBlob.mockReset().mockResolvedValue(new Blob(['hwpx'], { type: 'application/zip' }));
        mockCreateObjectURL.mockClear().mockReturnValue('blob:hwpx-url');
        mockRevokeObjectURL.mockClear();
        mockAnchorClick.mockClear();
    });

    // -------------------------------------------------------------------------
    // 초기 상태
    // -------------------------------------------------------------------------
    it('isExporting 초기값은 false이다', () => {
        const { isExporting } = useHwpxExport();
        expect(isExporting.value).toBe(false);
    });

    it('exportToHwpx 함수가 반환된다', () => {
        const { exportToHwpx } = useHwpxExport();
        expect(typeof exportToHwpx).toBe('function');
    });

    // -------------------------------------------------------------------------
    // 빈 html 처리
    // -------------------------------------------------------------------------
    describe('빈 html 처리', () => {
        it('html이 빈 문자열이면 Toast 경고를 표시한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('', '문서명');
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'warn', summary: '내보낼 내용 없음' })
            );
        });

        it('html이 공백만이면 Toast 경고를 표시한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('   ', '문서명');
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'warn' })
            );
        });

        it('빈 html이면 htmlToHwpxBlob을 호출하지 않는다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('', '문서명');
            expect(mockHtmlToHwpxBlob).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // 정상 export 흐름
    // -------------------------------------------------------------------------
    describe('정상 export 흐름', () => {
        it('htmlToHwpxBlob을 호출한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(mockHtmlToHwpxBlob).toHaveBeenCalledTimes(1);
        });

        it('다운로드 앵커 click을 호출한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(mockAnchorClick).toHaveBeenCalled();
        });

        it('파일명에 .hwpx 확장자를 추가한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '테스트문서');
            expect(mockAnchor.download).toBe('테스트문서.hwpx');
        });

        it('파일명에 이미 .hwpx가 있으면 중복 추가하지 않는다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '테스트문서.hwpx');
            expect(mockAnchor.download).toBe('테스트문서.hwpx');
        });

        it('export 완료 후 isExporting이 false로 복원된다', async () => {
            const { exportToHwpx, isExporting } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(isExporting.value).toBe(false);
        });

        it('URL.createObjectURL을 호출한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(mockCreateObjectURL).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // authorEno 옵션
    // -------------------------------------------------------------------------
    describe('authorEno 옵션', () => {
        it('authorEno가 있으면 $apiFetch로 사용자 정보를 조회한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명', { authorEno: 'E001' });
            expect(mockApiFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/users/E001')
            );
        });

        it('authorEno가 없으면 $apiFetch를 호출하지 않는다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(mockApiFetch).not.toHaveBeenCalled();
        });

        it('$apiFetch 실패 시에도 내보내기를 계속 진행한다', async () => {
            mockApiFetch.mockRejectedValueOnce(new Error('Network error'));
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명', { authorEno: 'E001' });
            expect(mockHtmlToHwpxBlob).toHaveBeenCalled();
        });

        it('bbrNm이 null이면 authorDept가 설정되지 않는다', async () => {
            mockApiFetch.mockResolvedValueOnce({ bbrNm: null });
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명', { authorEno: 'E001' });
            // 에러 없이 완료됨을 확인
            expect(mockHtmlToHwpxBlob).toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // 에러 처리
    // -------------------------------------------------------------------------
    describe('에러 처리', () => {
        it('htmlToHwpxBlob 실패 시 에러 Toast를 표시한다', async () => {
            mockHtmlToHwpxBlob.mockRejectedValueOnce(new Error('변환 실패'));
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'error', summary: '한글 내보내기 실패' })
            );
        });

        it('htmlToHwpxBlob 실패 시에도 isExporting이 false로 복원된다', async () => {
            mockHtmlToHwpxBlob.mockRejectedValueOnce(new Error('실패'));
            const { exportToHwpx, isExporting } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '문서명');
            expect(isExporting.value).toBe(false);
        });

        it('filename이 빈 문자열이면 기본값 "요구사항정의서"를 사용한다', async () => {
            const { exportToHwpx } = useHwpxExport();
            await exportToHwpx('<p>내용</p>', '');
            expect(mockAnchor.download).toBe('요구사항정의서.hwpx');
        });
    });
});
