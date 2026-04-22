/**
 * ============================================================================
 * [useExcalidrawAttachment] Excalidraw 장면 첨부파일 저장/로딩 Composable
 * ============================================================================
 * Excalidraw 다이어그램의 sceneData와 임베드 이미지를 /api/files에 분리 저장합니다.
 *
 * [저장 흐름]
 *  1. sceneData.files에서 이미지 dataURL 추출 → 각각 binary로 업로드
 *  2. sceneData.files의 dataURL을 attachmentId 참조로 교체
 *  3. 수정된 sceneData → LZString.compressToBase64() → scene 파일 업로드
 *  4. scene 파일의 flMngNo 반환
 *
 * [로딩 흐름]
 *  1. scene flMngNo → /api/files/{id}/download → LZString 압축 해제
 *  2. sceneData.files의 attachmentId → 각각 /api/files/{id}/preview → dataURL 복원
 *  3. 복원된 sceneData 반환
 * ============================================================================
 */

import LZString from 'lz-string';
import { ref } from 'vue';

/** sceneData.files에서 추출된 이미지 정보 */
export interface ExtractedFile {
    fileId: string;
    dataUrl: string;
    mimeType: string;
}

/**
 * sceneData JSON에서 files를 추출하고 dataURL을 제거한 sceneData를 반환
 */
export const extractFiles = (sceneData: string): {
    modifiedScene: string;
    files: ExtractedFile[];
} => {
    const parsed = JSON.parse(sceneData) as {
        elements: unknown[];
        appState: unknown;
        files?: Record<string, { dataURL?: string; mimeType?: string; [key: string]: unknown }>;
    };
    const files: ExtractedFile[] = [];

    if (parsed.files) {
        for (const [fileId, fileData] of Object.entries(parsed.files)) {
            if (fileData.dataURL) {
                files.push({
                    fileId,
                    dataUrl: fileData.dataURL,
                    mimeType: fileData.mimeType || 'image/png'
                });
                const { dataURL: _removed, ...rest } = fileData;
                parsed.files[fileId] = rest;
            }
        }
    }

    return { modifiedScene: JSON.stringify(parsed), files };
};

/**
 * dataURL 문자열을 File 객체로 변환
 */
export const dataUrlToFile = (dataUrl: string, mimeType: string, fileName: string): File => {
    const parts = dataUrl.split(',');
    const binaryStr = atob(parts[1]!);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mimeType });
};

/** sceneData JSON 문자열을 LZ-String으로 압축 */
export const compressScene = (sceneJson: string): string => {
    return LZString.compressToBase64(sceneJson);
};

/** LZ-String 압축된 문자열을 sceneData JSON으로 복원 */
export const decompressScene = (compressed: string): string => {
    return LZString.decompressFromBase64(compressed) || '';
};

// ── 모듈 레벨 pending 파일 추적 (form.vue에서 orcPkVl 업데이트용) ──
const _pendingFlMngNos = ref<string[]>([]);

/**
 * Excalidraw 첨부파일 저장/로딩 Composable
 */
export const useExcalidrawAttachment = () => {
    const config = useRuntimeConfig();
    const { $apiFetch } = useNuxtApp();
    const API_BASE = `${config.public.apiBase}/api/files`;

    const uploadImageFile = async (dataUrl: string, mimeType: string, fileId: string): Promise<string> => {
        const ext = mimeType.split('/')[1] || 'png';
        const file = dataUrlToFile(dataUrl, mimeType, `excalidraw-img-${fileId}.${ext}`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('flDtt', '이미지');
        formData.append('orcPkVl', '');
        formData.append('orcDtt', '요구사항정의서');

        const result = await $apiFetch<{ flMngNo: string }>(API_BASE, {
            method: 'POST',
            body: formData
        });
        return result.flMngNo;
    };

    const uploadSceneFile = async (compressed: string): Promise<string> => {
        const blob = new Blob([compressed], { type: 'text/plain' });
        const file = new File([blob], 'excalidraw-scene.lzstr', { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('flDtt', '이미지');
        formData.append('orcPkVl', '');
        formData.append('orcDtt', '요구사항정의서');

        const result = await $apiFetch<{ flMngNo: string }>(API_BASE, {
            method: 'POST',
            body: formData
        });
        return result.flMngNo;
    };

    /**
     * sceneData를 첨부파일로 저장
     * @returns scene 파일의 flMngNo
     */
    const saveScene = async (sceneData: string): Promise<string> => {
        const { modifiedScene, files } = extractFiles(sceneData);
        const uploadedFileIds: string[] = [];

        // ① 이미지 병렬 업로드
        const imageFlMngNos = await Promise.all(
            files.map(f => uploadImageFile(f.dataUrl, f.mimeType, f.fileId))
        );
        uploadedFileIds.push(...imageFlMngNos);

        // ② sceneData.files에 attachmentId 참조 삽입
        const parsedScene = JSON.parse(modifiedScene) as {
            files?: Record<string, { mimeType?: string; attachmentId?: string; [key: string]: unknown }>;
            [key: string]: unknown;
        };
        files.forEach((f, idx) => {
            if (parsedScene.files?.[f.fileId]) {
                parsedScene.files[f.fileId]!.attachmentId = imageFlMngNos[idx];
            }
        });

        // ③ sceneData LZ-String 압축 → scene 파일 업로드
        const compressed = compressScene(JSON.stringify(parsedScene));
        const sceneFlMngNo = await uploadSceneFile(compressed);
        uploadedFileIds.push(sceneFlMngNo);

        _pendingFlMngNos.value.push(...uploadedFileIds);

        return sceneFlMngNo;
    };

    /**
     * scene 첨부파일에서 sceneData 복원
     * @returns 복원된 sceneData JSON 문자열
     */
    const loadScene = async (flMngNo: string): Promise<string> => {
        // ① scene 파일 다운로드 → 압축 해제
        const compressed = await $apiFetch<string>(`${API_BASE}/${flMngNo}/download`, {
            responseType: 'text'
        });
        const sceneJson = decompressScene(compressed);
        const parsed = JSON.parse(sceneJson) as {
            files?: Record<string, { attachmentId?: string; mimeType?: string; dataURL?: string; [key: string]: unknown }>;
            [key: string]: unknown;
        };

        // ② 이미지 첨부파일 병렬 fetch → dataURL 복원
        if (parsed.files) {
            const imageEntries = Object.entries(parsed.files).filter(([, v]) => v.attachmentId);
            await Promise.all(
                imageEntries.map(async ([fileId, fileData]) => {
                    const imageFlMngNo = fileData.attachmentId!;
                    const blob = await $apiFetch<Blob>(`${API_BASE}/${imageFlMngNo}/preview`, {
                        responseType: 'blob'
                    });
                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    parsed.files![fileId]!.dataURL = dataUrl;
                    delete parsed.files![fileId]!.attachmentId;
                })
            );
        }

        return JSON.stringify(parsed);
    };

    /** 업로드된 Excalidraw 파일 관리번호 목록 반환 */
    const getPendingFlMngNos = (): string[] => [..._pendingFlMngNos.value];

    /** pending 목록 초기화 */
    const clearPendingFlMngNos = (): void => {
        _pendingFlMngNos.value = [];
    };

    return {
        saveScene,
        loadScene,
        getPendingFlMngNos,
        clearPendingFlMngNos
    };
};
