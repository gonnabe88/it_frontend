import { describe, it, expect } from 'vitest';
import {
    dataUrlToFile,
    extractFiles,
    compressScene,
    decompressScene
} from '~/composables/useExcalidrawAttachment';

describe('dataUrlToFile', () => {
    it('PNG dataURL을 File 객체로 변환한다', () => {
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const dataUrl = `data:image/png;base64,${base64}`;

        const file = dataUrlToFile(dataUrl, 'image/png', 'test.png');

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('test.png');
        expect(file.type).toBe('image/png');
        expect(file.size).toBeGreaterThan(0);
    });
});

describe('extractFiles', () => {
    it('sceneData에서 files를 추출하고 dataURL을 제거한다', () => {
        const sceneData = JSON.stringify({
            elements: [{ id: 'elem1' }],
            appState: {},
            files: {
                'file-abc': { dataURL: 'data:image/png;base64,abc123', mimeType: 'image/png' },
                'file-def': { dataURL: 'data:image/jpeg;base64,def456', mimeType: 'image/jpeg' }
            }
        });

        const { modifiedScene, files } = extractFiles(sceneData);
        const parsed = JSON.parse(modifiedScene);

        expect(files).toHaveLength(2);
        expect(files[0]!.fileId).toBe('file-abc');
        expect(files[0]!.dataUrl).toBe('data:image/png;base64,abc123');
        expect(files[0]!.mimeType).toBe('image/png');
        expect(files[1]!.fileId).toBe('file-def');

        expect(parsed.files['file-abc'].dataURL).toBeUndefined();
        expect(parsed.files['file-def'].dataURL).toBeUndefined();
        expect(parsed.files['file-abc'].mimeType).toBe('image/png');
        expect(parsed.elements).toEqual([{ id: 'elem1' }]);
    });

    it('files가 없는 sceneData는 빈 배열을 반환한다', () => {
        const sceneData = JSON.stringify({ elements: [], appState: {} });
        const { files } = extractFiles(sceneData);
        expect(files).toHaveLength(0);
    });
});

describe('compressScene / decompressScene', () => {
    it('압축 후 복원하면 원본과 동일하다', () => {
        // 실제 Excalidraw 장면 크기를 모사 — 반복되는 속성이 많아야 압축 효과 검증 가능
        const elements = Array.from({ length: 50 }, (_, i) => ({
            id: `element-${i}`,
            type: 'rectangle',
            x: 100,
            y: 200,
            width: 150,
            height: 100,
            strokeColor: '#000000',
            backgroundColor: 'transparent',
            fillStyle: 'hachure',
            strokeWidth: 1,
            roughness: 1
        }));
        const original = JSON.stringify({
            elements,
            appState: { zoom: { value: 1 }, viewBackgroundColor: '#ffffff' },
            files: {}
        });

        const compressed = compressScene(original);
        expect(compressed).not.toBe(original);
        expect(compressed.length).toBeLessThan(original.length);

        const restored = decompressScene(compressed);
        expect(restored).toBe(original);
    });

    it('빈 객체 압축/복원이 안전하다', () => {
        const compressed = compressScene('{}');
        const restored = decompressScene(compressed);
        expect(restored).toBe('{}');
    });
});
