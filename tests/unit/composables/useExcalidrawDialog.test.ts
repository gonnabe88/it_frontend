/**
 * ============================================================================
 * [tests/unit/composables/useExcalidrawDialog.test.ts]
 * Excalidraw 다이얼로그 상태 관리 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computed, reactive } from 'vue';

// useExcalidrawDialog uses module-level reactive() and computed() from Nuxt auto-imports
vi.stubGlobal('reactive', reactive);
vi.stubGlobal('computed', computed);

import { useExcalidrawDialog } from '~/composables/useExcalidrawDialog';

describe('useExcalidrawDialog', () => {
    // Reset singleton state between tests by closing after each
    beforeEach(() => {
        const { close } = useExcalidrawDialog();
        close();
    });

    it('초기 상태에서 다이얼로그는 닫혀 있다', () => {
        const { isOpen } = useExcalidrawDialog();
        expect(isOpen.value).toBe(false);
    });

    it('초기 상태에서 initialSceneData는 null이다', () => {
        const { initialSceneData } = useExcalidrawDialog();
        expect(initialSceneData.value).toBeNull();
    });

    it('open()을 호출하면 다이얼로그가 열린다', () => {
        const { open, isOpen } = useExcalidrawDialog();
        open(null, () => {});
        expect(isOpen.value).toBe(true);
    });

    it('open()에 전달한 sceneData가 initialSceneData에 반영된다', () => {
        const { open, initialSceneData } = useExcalidrawDialog();
        open('{"elements":[]}', () => {});
        expect(initialSceneData.value).toBe('{"elements":[]}');
    });

    it('open()에 null을 전달하면 initialSceneData가 null이다', () => {
        const { open, initialSceneData } = useExcalidrawDialog();
        open(null, () => {});
        expect(initialSceneData.value).toBeNull();
    });

    it('close()를 호출하면 다이얼로그가 닫힌다', () => {
        const { open, close, isOpen } = useExcalidrawDialog();
        open(null, () => {});
        close();
        expect(isOpen.value).toBe(false);
    });

    it('close() 후 initialSceneData가 null로 초기화된다', () => {
        const { open, close, initialSceneData } = useExcalidrawDialog();
        open('{"elements":[]}', () => {});
        close();
        expect(initialSceneData.value).toBeNull();
    });

    it('confirm()을 호출하면 onSave 콜백이 실행된다', () => {
        const { open, confirm } = useExcalidrawDialog();
        const saveData = { svgContent: '<svg/>', sceneData: '{}', attachmentId: null };
        let received: typeof saveData | null = null;
        open(null, (data) => { received = data; });
        confirm(saveData);
        expect(received).toEqual(saveData);
    });

    it('confirm() 후 다이얼로그가 닫힌다', () => {
        const { open, confirm, isOpen } = useExcalidrawDialog();
        open(null, () => {});
        confirm({ svgContent: '', sceneData: null, attachmentId: null });
        expect(isOpen.value).toBe(false);
    });

    it('confirm()에 attachmentId가 포함된 경우도 콜백에 전달된다', () => {
        const { open, confirm } = useExcalidrawDialog();
        const saveData = { svgContent: '<svg/>', sceneData: '{}', attachmentId: 'FILE-001' };
        let received: typeof saveData | null = null;
        open(null, (data) => { received = data as typeof saveData; });
        confirm(saveData);
        expect(received?.attachmentId).toBe('FILE-001');
    });
});
