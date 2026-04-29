/**
 * ============================================================================
 * [tests/unit/composables/useTableCellSelection.direct.test.ts]
 * useTableCellSelection 직접 import 테스트
 * ============================================================================
 * composables/useTableCellSelection.ts를 직접 import하여 소스 커버리지를 생성합니다.
 *
 * 주요 테스트 대상:
 *  - 셀 클릭 → 선택 (cell-selected 클래스)
 *  - 선택된 셀 재클릭 → 선택 해제 (토글)
 *  - Shift+클릭 → 범위 확장
 *  - 드래그 (mousedown → mousemove → mouseup)
 *  - 컨테이너 외부 클릭 → 선택 해제
 *  - Esc 키 → 선택 해제
 *  - Ctrl/Cmd+C → 클립보드 복사 (TSV)
 *  - enabled: false → 선택 무시 + 해제
 *  - clearSelection() 반환값 호출
 *  - 인터랙티브 요소에서 mousedown → 무시
 *  - containerRef가 null인 상태에서 동작 → 에러 없이 처리
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { useTableCellSelection } from '~/composables/useTableCellSelection';

// ============================================================================
// 헬퍼: 테이블 DOM 생성
// ============================================================================

/** rows×cols 크기의 <table><tbody> DOM을 생성하고 document.body에 붙입니다 */
function createTable(rows: number, cols: number): HTMLElement {
    const container = document.createElement('div');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            td.textContent = `R${r}C${c}`;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
    document.body.appendChild(container);
    return container;
}

/** container 내 (row, col) 위치의 <td>를 반환 (0-indexed) */
function getCell(container: HTMLElement, row: number, col: number): HTMLTableCellElement {
    const tbody = container.querySelector('tbody')!;
    const tr = tbody.children[row] as HTMLTableRowElement;
    return tr.children[col] as HTMLTableCellElement;
}

/** MouseEvent 발화 헬퍼 */
function fireMouseEvent(
    el: EventTarget,
    type: string,
    options: Partial<MouseEventInit> = {},
): void {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...options }));
}

/** ClipboardEvent 발화 헬퍼 */
function fireClipboard(el: EventTarget, setData = vi.fn()): ClipboardEvent {
    const dt = { setData } as unknown as DataTransfer;
    const ev = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: dt });
    el.dispatchEvent(ev);
    return ev;
}

// ============================================================================
// 테스트
// ============================================================================

describe('useTableCellSelection (직접 import)', () => {
    let container: HTMLElement;
    let containerRef: ReturnType<typeof ref<HTMLElement | null>>;

    /** composable을 Vue 컴포넌트 생명주기 안에서 실행 */
    function mountComposable(enabledRef?: ReturnType<typeof ref<boolean>>) {
        let result: { clearSelection: () => void } | undefined;
        const TestComp = defineComponent({
            setup() {
                result = useTableCellSelection(containerRef, enabledRef);
                return {};
            },
            template: '<div />',
        });
        const wrapper = mount(TestComp, { attachTo: document.body });
        return { wrapper, get result() { return result!; } };
    }

    beforeEach(() => {
        container = createTable(3, 3);
        containerRef = ref(container);
    });

    afterEach(() => {
        container.remove();
    });

    // -------------------------------------------------------------------------
    // 초기 마운트
    // -------------------------------------------------------------------------
    it('마운트 후 에러 없이 clearSelection을 반환한다', async () => {
        const { result, wrapper } = mountComposable();
        expect(typeof result.clearSelection).toBe('function');
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 단일 셀 선택
    // -------------------------------------------------------------------------
    it('셀 클릭 시 cell-selected 클래스가 추가된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    it('셀 클릭 시 cell-anchor 클래스가 추가된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-anchor')).toBe(true);
        wrapper.unmount();
    });

    it('다른 셀 클릭 시 이전 선택이 해제된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td0 = getCell(container, 0, 0);
        const td1 = getCell(container, 1, 1);
        fireMouseEvent(td0, 'mousedown', { button: 0 });
        fireMouseEvent(td1, 'mousedown', { button: 0 });
        expect(td0.classList.contains('cell-selected')).toBe(false);
        expect(td1.classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 토글 (선택된 셀 재클릭)
    // -------------------------------------------------------------------------
    it('선택된 셀을 다시 클릭하면 선택이 해제된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(true);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // Shift + 클릭 (범위 확장)
    // -------------------------------------------------------------------------
    it('Shift+클릭 시 anchor~focus 범위 내 셀 모두 cell-selected가 된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td00 = getCell(container, 0, 0);
        const td11 = getCell(container, 1, 1);
        fireMouseEvent(td00, 'mousedown', { button: 0, shiftKey: false });
        fireMouseEvent(td11, 'mousedown', { button: 0, shiftKey: true });
        // 2×2 범위 모두 cell-selected여야 함
        expect(getCell(container, 0, 0).classList.contains('cell-selected')).toBe(true);
        expect(getCell(container, 0, 1).classList.contains('cell-selected')).toBe(true);
        expect(getCell(container, 1, 0).classList.contains('cell-selected')).toBe(true);
        expect(getCell(container, 1, 1).classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    it('Shift+클릭 시 anchor 없으면 단순 클릭처럼 동작한다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 1, 1);
        // anchor 없이 Shift+클릭 → anchor 설정
        fireMouseEvent(td, 'mousedown', { button: 0, shiftKey: true });
        expect(td.classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 드래그 (mousemove)
    // -------------------------------------------------------------------------
    it('mousedown 후 mousemove 시 드래그 범위가 갱신된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td00 = getCell(container, 0, 0);
        const td22 = getCell(container, 2, 2);
        fireMouseEvent(td00, 'mousedown', { button: 0 });
        fireMouseEvent(td22, 'mousemove', { button: 0 });
        // 3×3 범위 모두 선택되어야 함
        expect(getCell(container, 2, 2).classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    it('mouseup 시 dragging이 false가 되고 selecting 클래스가 제거된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(container.classList.contains('selecting')).toBe(true);
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        expect(container.classList.contains('selecting')).toBe(false);
        wrapper.unmount();
    });

    it('drag 중이 아닐 때 mouseup은 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        // drag 시작 없이 mouseup
        expect(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }).not.toThrow();
        wrapper.unmount();
    });

    it('drag 중이 아닐 때 mousemove는 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 1, 1);
        // mousedown 없이 mousemove
        expect(() => {
            fireMouseEvent(td, 'mousemove', {});
        }).not.toThrow();
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 컨테이너 외부 클릭 → 선택 해제
    // -------------------------------------------------------------------------
    it('컨테이너 외부 클릭 시 선택이 해제된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(true);
        // document 레벨 mousedown (컨테이너 외부)
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    it('선택 없을 때 외부 클릭은 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        expect(() => {
            document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }).not.toThrow();
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // Esc 키 → 선택 해제
    // -------------------------------------------------------------------------
    it('Esc 키 시 선택이 해제된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    it('Escape 이외 키는 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(td.classList.contains('cell-selected')).toBe(true);
        wrapper.unmount();
    });

    it('선택 없을 때 Esc는 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        expect(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }).not.toThrow();
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // Ctrl/Cmd+C → 클립보드 복사
    // -------------------------------------------------------------------------
    it('선택된 셀 Ctrl+C 시 TSV 텍스트가 clipboardData에 설정된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        const setData = vi.fn();
        fireClipboard(document, setData);
        expect(setData).toHaveBeenCalledWith('text/plain', 'R0C0');
        wrapper.unmount();
    });

    it('선택 없을 때 copy 이벤트는 clipboardData를 설정하지 않는다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const setData = vi.fn();
        fireClipboard(document, setData);
        expect(setData).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('활성 input에 포커스 있을 때는 브라우저 기본 복사를 방해하지 않는다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });

        // input에 포커스를 줘서 document.activeElement가 input이 되게 함
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const setData = vi.fn();
        fireClipboard(document, setData);
        expect(setData).not.toHaveBeenCalled();

        input.remove();
        wrapper.unmount();
    });

    it('다중 행 선택 시 TSV 형식으로 복사된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td00 = getCell(container, 0, 0);
        const td11 = getCell(container, 1, 1);
        fireMouseEvent(td00, 'mousedown', { button: 0 });
        fireMouseEvent(td11, 'mousedown', { button: 0, shiftKey: true });

        const setData = vi.fn();
        fireClipboard(document, setData);
        // 2×2 범위 → 2행 TSV
        expect(setData).toHaveBeenCalledWith('text/plain', 'R0C0\tR0C1\nR1C0\tR1C1');
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // enabled: false
    // -------------------------------------------------------------------------
    it('enabled: false이면 mousedown이 무시된다', async () => {
        const enabledRef = ref<boolean>(false);
        const { wrapper } = mountComposable(enabledRef);
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    it('enabled가 true→false로 바뀌면 기존 선택이 해제된다', async () => {
        const enabledRef = ref(true);
        const { wrapper } = mountComposable(enabledRef);
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(true);
        enabledRef.value = false;
        await nextTick();
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    it('enabled: false이면 copy 이벤트도 무시된다', async () => {
        const enabledRef = ref(false);
        const { wrapper } = mountComposable(enabledRef);
        await nextTick();
        const setData = vi.fn();
        fireClipboard(document, setData);
        expect(setData).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // clearSelection() 직접 호출
    // -------------------------------------------------------------------------
    it('clearSelection() 호출 시 선택 하이라이트가 제거된다', async () => {
        const { result, wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 0 });
        expect(td.classList.contains('cell-selected')).toBe(true);
        result.clearSelection();
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 인터랙티브 요소 무시
    // -------------------------------------------------------------------------
    it('input에서 mousedown 시 셀 선택을 시작하지 않는다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        const input = document.createElement('input');
        td.appendChild(input);
        fireMouseEvent(input, 'mousedown', { button: 0 });
        // 셀에 선택 클래스가 없어야 함
        expect(td.classList.contains('cell-selected')).toBe(false);
        td.removeChild(input);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 우클릭 무시
    // -------------------------------------------------------------------------
    it('우클릭(button:2)은 무시된다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        fireMouseEvent(td, 'mousedown', { button: 2 });
        expect(td.classList.contains('cell-selected')).toBe(false);
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // containerRef가 null → 에러 없이 처리
    // -------------------------------------------------------------------------
    it('containerRef가 null이면 에러 없이 동작한다', async () => {
        const nullRef = ref<HTMLElement | null>(null);
        let res: { clearSelection: () => void } | undefined;
        const TestComp = defineComponent({
            setup() {
                res = useTableCellSelection(nullRef);
                return {};
            },
            template: '<div />',
        });
        const wrapper = mount(TestComp, { attachTo: document.body });
        await nextTick();
        expect(() => res?.clearSelection()).not.toThrow();
        wrapper.unmount();
    });

    // -------------------------------------------------------------------------
    // 언마운트 정리
    // -------------------------------------------------------------------------
    it('언마운트 후 이벤트가 발화되어도 에러가 발생하지 않는다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        wrapper.unmount();
        // 언마운트 후에 document 이벤트 발화해도 에러 없어야 함
        expect(() => {
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }).not.toThrow();
    });

    // -------------------------------------------------------------------------
    // extractCellText: input 값 우선
    // -------------------------------------------------------------------------
    it('input을 포함한 셀 복사 시 input.value를 사용한다', async () => {
        const { wrapper } = mountComposable();
        await nextTick();
        const td = getCell(container, 0, 0);
        const input = document.createElement('input');
        input.value = '직접입력값';
        td.appendChild(input);

        fireMouseEvent(td, 'mousedown', { button: 0 });
        const setData = vi.fn();
        fireClipboard(document, setData);
        expect(setData).toHaveBeenCalledWith('text/plain', '직접입력값');

        td.removeChild(input);
        wrapper.unmount();
    });
});
