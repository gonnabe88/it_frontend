/**
 * ============================================================================
 * [composables/useTableCellSelection.ts] Excel 스타일 셀 선택 · 드래그 · 복사
 * ============================================================================
 * PrimeVue DataTable(또는 일반 <table>)에 엑셀과 유사한 셀 단위 선택 기능을
 * 부여합니다. Vue 반응성은 사용하지 않고 DOM 클래스(td.cell-selected /
 * td.cell-anchor)로 하이라이트를 제어하여 대용량 테이블에서도 가볍게 동작합니다.
 *
 * [제공 동작]
 *   - 셀 클릭         : 해당 셀 단일 선택 (기존 선택 해제)
 *   - 선택된 셀 재클릭: 선택 해제 (토글)
 *   - 셀 드래그       : 시작 셀 ~ 끝 셀 범위를 직사각형으로 선택
 *   - Shift + 클릭    : 시작 셀(anchor) 유지하고 클릭한 셀까지 범위 확장
 *   - Ctrl/Cmd + C    : 선택된 셀 값을 TSV(탭 구분) 텍스트로 클립보드 복사
 *   - Esc / 외부 클릭 : 선택 해제
 *
 * [제외 대상 — 이 요소 위에서 mousedown이 발생하면 셀 선택을 시작하지 않음]
 *   - input / select / textarea / button / [contenteditable]
 *   - PrimeVue 인터랙티브 래퍼 (.p-checkbox, .p-select, .p-autocomplete,
 *     .p-inputnumber, .p-cascadeselect, .p-datepicker, .p-multiselect)
 *   - 테이블 헤더 / 컬럼 리사이저 (.p-datatable-header-cell,
 *     .p-datatable-column-resizer)
 *
 * [사용 예시]
 *   const tableContainerRef = ref<HTMLElement | null>(null);
 *   useTableCellSelection(tableContainerRef);
 *   <div ref="tableContainerRef" class="cell-select-host">
 *     <StyledDataTable ... />
 *   </div>
 *
 *   ※ 하이라이트 CSS는 소비 측에서 제공합니다.
 *     예) `.cell-select-host td.cell-selected { ... }`
 * ============================================================================
 */
import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue';

/** 셀 좌표 (DOM 기준 tbody 내 0-index) */
interface CellCoord { row: number; col: number; }

/** 셀 선택을 시작하지 않아야 하는 인터랙티브 요소 셀렉터 */
const INTERACTIVE_SELECTOR = [
    'input', 'select', 'textarea', 'button', '[contenteditable]',
    '.p-checkbox', '.p-select', '.p-autocomplete', '.p-inputnumber',
    '.p-cascadeselect', '.p-datepicker', '.p-multiselect',
    '.p-datatable-column-resizer', '.p-datatable-header-cell',
].join(',');

export function useTableCellSelection(
    containerRef: Ref<HTMLElement | null>,
    /** 활성화 여부를 제어하는 반응형 플래그 (미지정 시 항상 활성화). false가 되면 모든 이벤트 무시 + 선택 즉시 해제 */
    enabled?: Ref<boolean>,
) {
    /** 현재 활성 여부 계산 헬퍼 */
    const isEnabled = () => !enabled || enabled.value !== false;

    /** 선택 시작 셀 (Shift+Click 기준점) */
    let anchor: CellCoord | null = null;
    /** 현재 드래그 중인 끝 셀 */
    let focus: CellCoord | null = null;
    /** 마우스 드래그 진행 여부 */
    let dragging = false;

    /** 이벤트 타깃에서 소속 <td>의 DOM 좌표(tbody 내 행/열 index)를 추출 */
    const getCellCoord = (el: HTMLElement, container: HTMLElement): (CellCoord & { td: HTMLElement }) | null => {
        const td = el.closest('td') as HTMLTableCellElement | null;
        if (!td || !container.contains(td)) return null;
        const tr = td.parentElement as HTMLTableRowElement | null;
        if (!tr) return null;
        const tbody = tr.parentElement;
        if (!tbody || tbody.tagName !== 'TBODY') return null;
        const row = Array.from(tbody.children).indexOf(tr);
        const col = Array.from(tr.children).indexOf(td);
        if (row < 0 || col < 0) return null;
        return { row, col, td };
    };

    /** 기존 선택 하이라이트 모두 제거 */
    const clearSelection = () => {
        const container = containerRef.value;
        if (!container) return;
        container.querySelectorAll('td.cell-selected, td.cell-anchor').forEach(el => {
            el.classList.remove('cell-selected', 'cell-anchor');
        });
    };

    /** anchor ~ focus 직사각형 범위를 cell-selected로 칠하고 anchor는 cell-anchor로 강조 */
    const paintRange = (a: CellCoord, b: CellCoord) => {
        clearSelection();
        const container = containerRef.value;
        if (!container) return;
        const tbody = container.querySelector('tbody');
        if (!tbody) return;
        const minRow = Math.min(a.row, b.row);
        const maxRow = Math.max(a.row, b.row);
        const minCol = Math.min(a.col, b.col);
        const maxCol = Math.max(a.col, b.col);
        for (let r = minRow; r <= maxRow; r++) {
            const tr = tbody.children[r] as HTMLElement | undefined;
            if (!tr) continue;
            for (let c = minCol; c <= maxCol; c++) {
                const td = tr.children[c] as HTMLElement | undefined;
                if (!td) continue;
                td.classList.add('cell-selected');
            }
        }
        const anchorTr = tbody.children[a.row] as HTMLElement | undefined;
        const anchorTd = anchorTr?.children[a.col] as HTMLElement | undefined;
        anchorTd?.classList.add('cell-anchor');
    };

    /** 선택 상태 완전 초기화 (하이라이트 + anchor/focus) */
    const resetSelection = () => {
        clearSelection();
        anchor = null;
        focus = null;
    };

    /** 현재 단일 셀만 선택된 상태에서 같은 셀을 클릭했는지 여부 */
    const isSameSingleCell = (coord: CellCoord): boolean => {
        if (!anchor || !focus) return false;
        return anchor.row === focus.row && anchor.col === focus.col
            && anchor.row === coord.row && anchor.col === coord.col;
    };

    /** mousedown: 좌클릭 + 비인터랙티브 셀에서 선택 시작 (Shift 포함 시 확장, 같은 셀이면 토글 해제) */
    const onMouseDown = (e: MouseEvent) => {
        if (!isEnabled()) return;
        if (e.button !== 0) return;
        const container = containerRef.value;
        if (!container) return;
        const target = e.target as HTMLElement;
        if (target.closest(INTERACTIVE_SELECTOR)) return;
        const coord = getCellCoord(target, container);
        if (!coord) return;

        if (e.shiftKey && anchor) {
            focus = { row: coord.row, col: coord.col };
            paintRange(anchor, focus);
            e.preventDefault();
            return;
        }
        /* 이미 단독 선택된 셀을 다시 클릭하면 선택 해제 (토글) */
        if (isSameSingleCell(coord)) {
            resetSelection();
            e.preventDefault();
            return;
        }
        anchor = { row: coord.row, col: coord.col };
        focus = { row: coord.row, col: coord.col };
        dragging = true;
        container.classList.add('selecting');
        paintRange(anchor, focus);
        e.preventDefault();
    };

    /** mousemove: 드래그 중이면 focus 갱신 후 범위 다시 칠하기 */
    const onMouseMove = (e: MouseEvent) => {
        if (!isEnabled()) return;
        if (!dragging || !anchor) return;
        const container = containerRef.value;
        if (!container) return;
        const coord = getCellCoord(e.target as HTMLElement, container);
        if (!coord) return;
        focus = { row: coord.row, col: coord.col };
        paintRange(anchor, focus);
    };

    /** mouseup: 드래그 종료 (선택 자체는 유지) */
    const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        containerRef.value?.classList.remove('selecting');
    };

    /** 문서 전역 mousedown: 컨테이너 밖을 클릭하면 선택 해제 */
    const onDocumentMouseDown = (e: MouseEvent) => {
        const container = containerRef.value;
        if (!container) return;
        /* 아무것도 선택되지 않은 상태라면 굳이 처리할 필요 없음 */
        if (!anchor && !focus) return;
        const target = e.target as Node | null;
        if (!target) return;
        /* 컨테이너 내부 클릭은 container mousedown에서 이미 처리 */
        if (container.contains(target)) return;
        resetSelection();
    };

    /** Esc 키: 선택 해제 */
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        if (!anchor && !focus) return;
        resetSelection();
    };

    /** Ctrl/Cmd+C: 선택 셀을 TSV로 만들어 clipboardData에 주입 */
    const onCopy = (e: ClipboardEvent) => {
        if (!isEnabled()) return;
        const container = containerRef.value;
        if (!container) return;
        /* 활성 입력요소에 포커스가 있으면 브라우저 기본 복사 동작을 방해하지 않음 */
        const active = document.activeElement as HTMLElement | null;
        if (active && active.matches('input, textarea, [contenteditable]')) return;
        const tbody = container.querySelector('tbody');
        if (!tbody) return;
        const tsvRows: string[][] = [];
        Array.from(tbody.children).forEach(tr => {
            const row: string[] = [];
            let hasAny = false;
            Array.from(tr.children).forEach(td => {
                if (td.classList.contains('cell-selected')) {
                    hasAny = true;
                    row.push(extractCellText(td as HTMLElement));
                }
            });
            if (hasAny) tsvRows.push(row);
        });
        if (!tsvRows.length) return;
        const tsv = tsvRows.map(r => r.join('\t')).join('\n');
        e.clipboardData?.setData('text/plain', tsv);
        e.preventDefault();
    };

    /** 셀에서 사용자에게 보이는 텍스트 추출 (input 값 우선, 없으면 textContent) */
    const extractCellText = (el: HTMLElement): string => {
        const input = el.querySelector('input:not([type=checkbox]):not([type=radio])') as HTMLInputElement | null;
        if (input && input.value) return input.value;
        return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    };

    onMounted(() => {
        const container = containerRef.value;
        if (!container) return;
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('copy', onCopy);
        document.addEventListener('mousedown', onDocumentMouseDown);
        document.addEventListener('keydown', onKeyDown);
    });

    /** enabled 플래그가 false로 전환되면 남아있는 선택 하이라이트와 상태를 즉시 정리 */
    if (enabled) {
        watch(enabled, (val) => {
            if (val !== false) return;
            resetSelection();
            dragging = false;
            containerRef.value?.classList.remove('selecting');
        });
    }

    onBeforeUnmount(() => {
        const container = containerRef.value;
        if (container) {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
        }
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('copy', onCopy);
        document.removeEventListener('mousedown', onDocumentMouseDown);
        document.removeEventListener('keydown', onKeyDown);
    });

    return { clearSelection };
}
