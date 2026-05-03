/**
 * ============================================================================
 * [composables/useHwpxExport.ts] HWPX 파일 내보내기 Composable
 * ============================================================================
 * Tiptap HTML 콘텐츠를 한글(.hwpx) 파일로 변환하고 브라우저 다운로드를 실행합니다.
 *
 * [사용 예시]
 *   const { exportToHwpx, isExporting } = useHwpxExport();
 *   await exportToHwpx(doc.reqCone, doc.reqNm, { authorEno: doc.fstEnrUsid });
 * ============================================================================
 */

import { useToast } from 'primevue/usetoast';
import { htmlToHwpxBlob } from '~/utils/hwpx';
import { useExcalidrawAttachment } from '~/composables/useExcalidrawAttachment';

/** 작성자 부서명 조회용 사용자 정보 최소 스펙 (/api/users/{eno} 응답의 부분 집합) */
interface UserInfo {
    eno: string;
    bbrNm: string | null;
}

/**
 * HWPX 내보내기 Composable
 * @returns exportToHwpx 함수와 isExporting 상태
 */
export const useHwpxExport = () => {
    /** 내보내기 진행 중 여부 */
    const isExporting = ref(false);

    // useToast는 반드시 컴포넌트 setup 실행 시점(= useHwpxExport 호출 시점)에
    // inject되어야 합니다. 비동기 클릭 핸들러 내부에서 호출하면
    // "No PrimeVue Toast provided!" 에러가 발생합니다.
    const toast = useToast();
    const config = useRuntimeConfig();
    const { $apiFetch } = useNuxtApp();
    // data-attachment-id는 SVG가 아닌 LZ-String 압축 scene 파일을 가리키므로
    // loadScene → exportToSvg로 실제 SVG를 생성해야 합니다.
    const { loadScene } = useExcalidrawAttachment();

    /**
     * HTML을 HWPX 파일로 변환하여 브라우저 다운로드를 실행합니다.
     * 클라이언트 전용 기능입니다 (DOMParser, URL.createObjectURL 사용).
     *
     * @param html     - Tiptap HTML 문자열
     * @param filename - 저장할 파일명(=문서 제목, Title 표 중앙 셀에도 사용)
     * @param opts     - 옵션 ({ authorEno?: 작성자 사번 → 부서명 조회해 Title 좌측 셀에 반영 })
     */
    const exportToHwpx = async (
        html: string,
        filename: string,
        opts?: { authorEno?: string },
    ): Promise<void> => {
        // SSR 가드 — DOMParser / document / URL 은 클라이언트에서만 사용 가능
        if (typeof window === 'undefined') return;

        if (!html?.trim()) {
            // 본문 비어있음 안내 (버튼 disabled가 우회될 경우에도 안전하게)
            toast.add({
                severity: 'warn',
                summary: '내보낼 내용 없음',
                detail: '본문이 비어있어 한글 파일을 만들 수 없습니다.',
                life: 3000,
            });
            return;
        }

        isExporting.value = true;
        try {
            // 작성자 부서명 조회 (실패해도 placeholder로 진행)
            let authorDept: string | undefined;
            if (opts?.authorEno) {
                try {
                    const info = await $apiFetch<UserInfo>(`${config.public.apiBase}/api/users/${opts.authorEno}`);
                    if (info?.bbrNm) authorDept = info.bbrNm;
                } catch {
                    // 조회 실패 시 좌측 셀은 기본 placeholder({부서명}) 유지
                }
            }

            // 파일명(=문서명, reqNm)을 Title 표 중앙 셀 제목으로 사용
            const baseName = (filename || '요구사항정의서').trim();

            // Excalidraw 전처리 — <figure data-type="excalidraw" data-attachment-id="X"> 는
            // data-attachment-id가 SVG가 아닌 LZ-String 압축 scene 파일(JSON)을 가리킵니다.
            // scene 파일을 loadScene()으로 복원 → exportToSvg()로 SVG 생성 → data URL로 변환하여
            // <img src="data:image/svg+xml;base64,..."> 로 치환합니다.
            // hwpx.ts의 isSvgData + svgToPngData가 이 SVG를 PNG로 래스터화합니다.
            let preprocessedHtml = html;
            if (typeof DOMParser !== 'undefined') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(`<div id="__hwpx_root__">${html}</div>`, 'text/html');
                const figures = Array.from(
                    doc.querySelectorAll('figure[data-type="excalidraw"]')
                );
                for (const fig of figures) {
                    const attachmentId = fig.getAttribute('data-attachment-id');
                    if (!attachmentId) continue;  // 구형식(data-scene)은 내부 <img>로 이미 처리됨
                    try {
                        // ① scene 파일 로드 (LZ-String 압축 해제 + 이미지 dataURL 복원)
                        const sceneJson = await loadScene(attachmentId);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const parsed = JSON.parse(sceneJson) as any;
                        // ② Excalidraw exportToSvg로 실제 SVG 생성
                        const { exportToSvg } = await import('@excalidraw/excalidraw');
                        const svgEl = await exportToSvg({
                            elements: parsed.elements || [],
                            appState: {
                                ...(parsed.appState || {}),
                                exportWithDarkMode: false,
                                exportBackground: true,
                            },
                            files: parsed.files || {},
                        });
                        // ③ SVG → UTF-8 safe base64 data URL (hwpx.ts isSvgData가 감지)
                        const svgText = new XMLSerializer().serializeToString(svgEl);
                        const svgBase64 = btoa(unescape(encodeURIComponent(svgText)));
                        const img = doc.createElement('img');
                        img.setAttribute('src', `data:image/svg+xml;base64,${svgBase64}`);
                        img.setAttribute('alt', 'Excalidraw 다이어그램');
                        fig.replaceWith(img);
                    } catch (err) {
                        // SVG 생성 실패 시 figure 제거 (깨진 이미지보다 나음)
                        console.error('[useHwpxExport] Excalidraw SVG 변환 실패', attachmentId, err);
                        fig.remove();
                    }
                }
                const root = doc.getElementById('__hwpx_root__');
                if (root) preprocessedHtml = root.innerHTML;
            }

            // 이미지 fetch 콜백 — $apiFetch를 사용해 httpOnly 쿠키 자동 전송
            // cross-origin(localhost:3000 → localhost:8080) 이미지도 정상 처리됩니다.
            const imageFetch = async (src: string): Promise<ArrayBuffer | null> => {
                try {
                    // 절대 URL이든 상대 URL이든 $apiFetch로 그대로 전달
                    const buf = await $apiFetch<ArrayBuffer>(src, {
                        responseType: 'arrayBuffer',
                    });
                    return buf ?? null;
                } catch {
                    return null;
                }
            };

            const blob = await htmlToHwpxBlob(
                preprocessedHtml,
                { center: baseName, left: authorDept },
                { imageFetch },
            );

            // 파일명에 .hwpx 확장자가 없으면 추가
            const safeFilename = baseName.endsWith('.hwpx') ? baseName : `${baseName}.hwpx`;

            // 가상 <a> 태그로 다운로드 트리거
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = safeFilename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            // 브라우저가 다운로드를 시작할 시간을 확보하기 위해 URL 해제를 지연 처리
            // (동기 해제 시 일부 브라우저에서 다운로드가 취소되는 사례 보고)
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            // 실패 시 사용자에게 알림 — 기존에는 조용히 삼켜져 증상 파악이 어려웠음
             
            console.error('[useHwpxExport] HWPX 변환 실패', e);
            toast.add({
                severity: 'error',
                summary: '한글 내보내기 실패',
                detail: e?.message || '파일 생성 중 오류가 발생했습니다.',
                life: 5000,
            });
        } finally {
            isExporting.value = false;
        }
    };

    return { exportToHwpx, isExporting };
};
