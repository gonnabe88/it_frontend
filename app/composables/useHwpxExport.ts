/**
 * ============================================================================
 * [composables/useHwpxExport.ts] HWPX 파일 내보내기 Composable
 * ============================================================================
 * Tiptap HTML 콘텐츠를 한글(.hwpx) 파일로 변환하고 브라우저 다운로드를 실행합니다.
 *
 * [사용 예시]
 *   const { exportToHwpx, isExporting } = useHwpxExport();
 *   await exportToHwpx(doc.reqCone, doc.reqNm);
 * ============================================================================
 */

import { htmlToHwpxBlob } from '~/utils/hwpx';

/**
 * HWPX 내보내기 Composable
 * @returns exportToHwpx 함수와 isExporting 상태
 */
export const useHwpxExport = () => {
    /** 내보내기 진행 중 여부 */
    const isExporting = ref(false);

    /**
     * HTML을 HWPX 파일로 변환하여 브라우저 다운로드를 실행합니다.
     * 클라이언트 전용 기능입니다 (DOMParser, URL.createObjectURL 사용).
     *
     * @param html     - Tiptap HTML 문자열
     * @param filename - 저장할 파일명 (.hwpx 확장자 자동 추가)
     */
    const exportToHwpx = async (html: string, filename: string): Promise<void> => {
        if (!html?.trim()) return;

        isExporting.value = true;
        try {
            // HTML → HWPX Blob 변환
            const blob = await htmlToHwpxBlob(html);

            // 파일명에 .hwpx 확장자가 없으면 추가
            const safeFilename = filename.endsWith('.hwpx') ? filename : `${filename}.hwpx`;

            // 가상 <a> 태그로 다운로드 트리거
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = safeFilename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } finally {
            isExporting.value = false;
        }
    };

    return { exportToHwpx, isExporting };
};
