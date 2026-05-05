/**
 * ============================================================================
 * [useTableColumnResize] 일반 HTML 테이블 컬럼 리사이즈 Composable
 * ============================================================================
 * PrimeVue DataTable의 resizableColumns(fit 모드)와 동일한 동작을 제공합니다.
 * - 헤더 셀 오른쪽 끝에 드래그 핸들을 자동 삽입합니다.
 * - colspan/rowspan 헤더를 지원합니다.
 * - fit 모드: 드래그한 컬럼이 늘어나면 인접 다음 컬럼이 줄어듭니다.
 *
 * [사용 방법]
 *   const tableRef = ref<HTMLElement | null>(null);
 *   useTableColumnResize(tableRef);
 *   // 템플릿: <div ref="tableRef"><table>...</table></div>
 * ============================================================================
 */
import { type Ref, watch, onUnmounted, nextTick } from 'vue';

/** 컬럼 최소 너비 (px) */
const MIN_COL_WIDTH = 40;

export const useTableColumnResize = (containerRef: Ref<HTMLElement | null>) => {
    let table: HTMLTableElement | null = null;
    let cols: HTMLElement[] = [];

    // 드래그 상태
    let dragging = false;
    let dragColIdx = -1;
    let startX = 0;
    let startWidth = 0;
    let nextStartWidth = 0;

    /** colgroup > col 요소 목록 반환 */
    const getColEls = (): HTMLElement[] => {
        if (!table) return [];
        return Array.from(table.querySelectorAll('colgroup col')) as HTMLElement[];
    };

    /**
     * thead의 각 th를 스캔하여 { 시작 컬럼 인덱스, colspan 수 }를 매핑합니다.
     * colspan/rowspan 점유 추적을 위해 2D 그리드를 사용합니다.
     */
    const buildHeaderGrid = (thead: HTMLElement): Map<HTMLElement, { start: number; span: number }> => {
        const rows = Array.from(thead.querySelectorAll('tr'));
        const maxCols = cols.length;
        const grid: boolean[][] = rows.map(() => new Array(maxCols).fill(false));
        const thMap = new Map<HTMLElement, { start: number; span: number }>();

        for (let ri = 0; ri < rows.length; ri++) {
            const cells = Array.from(rows[ri].querySelectorAll('th')) as HTMLElement[];
            let ci = 0;
            for (const th of cells) {
                // 이미 점유된 셀은 건너뜀
                while (ci < maxCols && grid[ri][ci]) ci++;
                if (ci >= maxCols) break;

                const colSpan = th.colSpan || 1;
                const rowSpan = th.rowSpan || 1;

                thMap.set(th, { start: ci, span: colSpan });

                // 점유 영역 표시
                for (let dr = 0; dr < rowSpan; dr++) {
                    for (let dc = 0; dc < colSpan; dc++) {
                        if (ri + dr < rows.length) grid[ri + dr][ci + dc] = true;
                    }
                }
                ci += colSpan;
            }
        }

        return thMap;
    };

    /**
     * 모든 col 너비를 px로 정규화합니다.
     * % 단위는 table.offsetWidth 기준으로 px로 변환하고,
     * 너비가 없는 col은 남은 공간을 균등 배분합니다.
     */
    const initColWidths = () => {
        if (!table) return;
        const tableWidth = table.offsetWidth || 800;

        // % 단위를 px로 먼저 변환
        for (const col of cols) {
            const raw = col.style.width || '';
            if (raw.endsWith('%')) {
                const px = Math.round(tableWidth * parseFloat(raw) / 100);
                col.style.width = `${px}px`;
            }
        }

        // 너비 미설정 col 처리
        let fixedTotal = 0;
        const unset: HTMLElement[] = [];
        for (const col of cols) {
            const w = parseInt(col.style.width || '0', 10);
            if (w > 0) fixedTotal += w;
            else unset.push(col);
        }
        if (unset.length > 0) {
            const remain = Math.max(MIN_COL_WIDTH * unset.length, tableWidth - fixedTotal);
            const perCol = Math.floor(remain / unset.length);
            for (const col of unset) {
                col.style.width = `${perCol}px`;
            }
        }
    };

    const onMousedown = (e: MouseEvent, colIdx: number) => {
        e.preventDefault();
        dragging = true;
        dragColIdx = colIdx;
        startX = e.clientX;
        startWidth = parseInt(cols[colIdx]?.style.width || '0', 10);
        const nextIdx = colIdx + 1;
        nextStartWidth = nextIdx < cols.length
            ? parseInt(cols[nextIdx]?.style.width || '0', 10)
            : 0;

        document.addEventListener('mousemove', onMousemove);
        document.addEventListener('mouseup', onMouseup);
    };

    const onMousemove = (e: MouseEvent) => {
        if (!dragging || dragColIdx < 0) return;
        const delta = e.clientX - startX;
        const newWidth = Math.max(MIN_COL_WIDTH, startWidth + delta);
        const nextIdx = dragColIdx + 1;

        if (cols[dragColIdx]) {
            cols[dragColIdx].style.width = `${newWidth}px`;
        }

        // fit 모드: 다음 컬럼이 반대 방향으로 조정
        if (nextIdx < cols.length && nextStartWidth > 0) {
            const nextNew = Math.max(MIN_COL_WIDTH, nextStartWidth - delta);
            cols[nextIdx].style.width = `${nextNew}px`;
        }
    };

    const onMouseup = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMousemove);
        document.removeEventListener('mouseup', onMouseup);
    };

    /** 테이블에 리사이즈 핸들을 부착합니다. */
    const init = () => {
        if (!containerRef.value) return;
        table = containerRef.value.querySelector('table');
        if (!table) return;

        // table-layout: fixed 강제 적용 (col 너비 제어에 필수)
        table.style.tableLayout = 'fixed';

        cols = getColEls();
        if (!cols.length) return;

        initColWidths();

        const thead = table.querySelector('thead') as HTMLElement | null;
        if (!thead) return;

        const thMap = buildHeaderGrid(thead);

        for (const [th, { start, span }] of thMap.entries()) {
            // colspan인 경우 스팬의 마지막 컬럼을 드래그 대상으로 사용
            const lastColIdx = start + span - 1;

            // 기존 핸들 제거 후 재부착
            th.querySelector('.tbl-col-resizer')?.remove();
            th.style.position = 'relative';
            th.style.userSelect = 'none';

            const handle = document.createElement('span');
            handle.className = 'tbl-col-resizer';
            handle.style.cssText =
                'position:absolute;top:0;right:0;width:5px;height:100%;cursor:col-resize;z-index:1;';

            handle.addEventListener('mousedown', (e) => onMousedown(e, lastColIdx));
            th.appendChild(handle);
        }
    };

    // containerRef가 마운트되면 초기화
    watch(
        containerRef,
        (el) => {
            if (el) nextTick(() => init());
        },
        { immediate: true }
    );

    onUnmounted(() => {
        document.removeEventListener('mousemove', onMousemove);
        document.removeEventListener('mouseup', onMouseup);
    });
};
