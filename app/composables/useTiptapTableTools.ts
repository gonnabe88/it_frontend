import type { Editor } from '@tiptap/core';
import { TableMap } from '@tiptap/pm/tables';
import type { Ref } from 'vue';
import { COLOR_PALETTE } from '../components/extensions/tiptap-toolbar-options';

/** Tiptap 표 플로팅 툴바의 상태와 명령을 관리합니다. */
export const useTiptapTableTools = (
    editor: Ref<Editor | null | undefined>,
    normalizeColwidths: (editor: Editor) => void,
) => {
    // ── 셀 서식 (표 플로팅 툴바에서 사용) ──
    
    /** 글자색 팔레트와 동일한 색상 사용 (8열 × 6행 = 48색) */
    const TABLE_CELL_PALETTE = COLOR_PALETTE;
    
    /** 배경색 팔레트 팝오버 표시 여부 */
    const cellBgPaletteVisible = ref(false);
    
    /** 현재 커서가 위치한 셀의 배경색을 반환합니다. */
    const currentCellBg = computed<string | null>(() => {
        if (!editor.value?.isActive('table')) return null;
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.backgroundColor || headerAttrs.backgroundColor || null;
    });
    
    /** 셀 배경색 팔레트에서 색상 선택 */
    const applyCellBgColor = (color: string | null) => {
        editor.value?.chain().focus().setCellAttribute('backgroundColor', color).run();
        cellBgPaletteVisible.value = false;
    };
    
    // ── 테두리 스타일 (FR-06-2) ──
    
    /** 테두리 스타일 옵션 */
    const BORDER_STYLES = [
        { value: null, label: '없음', title: '테두리 없음' },
        { value: 'solid', label: '─', title: '실선' },
        { value: 'dashed', label: '╌', title: '점선' },
        { value: 'dotted', label: '⋯', title: '도트' },
        { value: 'double', label: '═', title: '이중선' },
    ] as const;
    
    /** 테두리 두께 옵션 */
    const BORDER_WIDTHS = [
        { value: '1px', label: '1px' },
        { value: '2px', label: '2px' },
        { value: '3px', label: '3px' },
        { value: '4px', label: '4px' },
        { value: '5px', label: '5px' },
    ] as const;
    
    /** 테두리 설정 팔레트 표시 여부 */
    const borderPaletteVisible = ref(false);
    
    /** 현재 셀의 테두리 스타일 */
    const _currentCellBorderStyle = computed<string | null>(() => {
        if (!editor.value?.isActive('table')) return null;
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.borderStyle || headerAttrs.borderStyle || attrs.borderTopStyle || headerAttrs.borderTopStyle || null;
    });
    
    // ── 테두리 방향별 상세 설정 (FR-06-2 개편) ──
    
    /** 사용자가 현재 선택 중인(아직 적용 전인) 테두리 속성 */
    const pendingBorderStyle = ref<string | null>('solid');
    const pendingBorderWidth = ref<string | null>('1px');
    const pendingBorderColor = ref<string | null>('#374151');
    
    /** 셀 테두리 방향 버튼 정의 */
    const BORDER_DIRECTIONS = [
        { value: 'all', label: '전체 테두리', icon: 'M1 1h12v12H1z M1 7h12 M7 1v12' },
        { value: 'outer', label: '외곽 테두리', icon: 'M1 1h12v12H1z' },
        { value: 'inner', label: '안쪽 전체', icon: 'M1 7h12 M7 1v12' },
        { value: 'top', label: '위 테두리', icon: 'M1 1h12' },
        { value: 'bottom', label: '아래 테두리', icon: 'M1 13h12' },
        { value: 'left', label: '왼쪽 테두리', icon: 'M1 1v12' },
        { value: 'right', label: '오른쪽 테두리', icon: 'M13 1v12' },
        { value: 'inner-h', label: '안쪽 가로', icon: 'M1 7h12' },
        { value: 'inner-v', label: '안쪽 세로', icon: 'M7 1v12' },
        { value: 'clear', label: '지우기', icon: 'M2 2l10 10 M12 2L2 12' }
    ] as const;
    
    /** 현재 셀의 테두리 두께 */
    const _currentCellBorderWidth = computed<string | null>(() => {
        if (!editor.value?.isActive('table')) return null;
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.borderWidth || headerAttrs.borderWidth || null;
    });
    
    /** 현재 셀의 테두리 색상 */
    const currentCellBorderColor = computed<string | null>(() => {
        if (!editor.value?.isActive('table')) return null;
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.borderColor || headerAttrs.borderColor || null;
    });
    
    /** 셀 테두리 스타일 선택 (적용 대기) */
    const applyCellBorderStyle = (style: string | null) => {
        pendingBorderStyle.value = style;
    };
    
    /** 셀 테두리 두께 선택 (적용 대기) */
    const applyCellBorderWidth = (width: string | null) => {
        pendingBorderWidth.value = width;
    };
    
    const applyCellBorderColor = (color: string | null) => {
        pendingBorderColor.value = color;
    };
    
    /**
     * 특정 셀(node)에 지정된 방향(side)의 테두리를 현재 설정값으로 적용합니다.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _updateCellSideAttributes = (editor: any, pos: number, side: string, isHeader: boolean) => {
        const sides = [];
        if (side === 'all') sides.push('Top', 'Bottom', 'Left', 'Right');
        else if (side === 'top') sides.push('Top');
        else if (side === 'bottom') sides.push('Bottom');
        else if (side === 'left') sides.push('Left');
        else if (side === 'right') sides.push('Right');
    
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attrs: any = {};
        const _type = isHeader ? 'tableHeader' : 'tableCell';
    
        sides.forEach(s => {
            attrs[`border${s}Style`] = pendingBorderStyle.value;
            attrs[`border${s}Width`] = pendingBorderWidth.value;
            attrs[`border${s}Color`] = pendingBorderColor.value;
        });
    
        // 팁탭의 기본 setCellAttribute 대신 직접 tr을 조작하여 여러 속성을 한 번에 저장합니다.
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, {
            ...(editor.state.doc.nodeAt(pos)?.attrs || {}),
            ...attrs
        }));
    };
    
    /**
     * 테두리 방향 버튼 클릭 시 실행되는 메인 로직
     */
    const applySideBorder = (side: string) => {
        if (!editor.value) return;
        const { state, view } = editor.value;
        const { selection } = state;
        const tr = state.tr;
        let modified = false;
    
        // 1. 셀 선택 방식 판별 (전용 CellSelection 인스턴스 또는 유사 객체인 경우)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isCellSelection = typeof (selection as any).forEachCell === 'function';
    
        if (!isCellSelection) {
            // 단일 셀에 커서만 있는 경우 (NodeSelection 또는 TextSelection)
            let pos = -1;
            state.doc.nodesBetween(selection.from, selection.to, (node, p) => {
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                    pos = p;
                    return false;
                }
            });
    
            if (pos !== -1) {
                const node = state.doc.nodeAt(pos);
                if (node) {
                    const sides = [];
                    // 단일 셀에서는 '전체(all)', '외곽(outer)', '정리(clear)' 모두 4방향에 해당함
                    if (['all', 'outer', 'clear'].includes(side)) {
                        sides.push('Top', 'Bottom', 'Left', 'Right');
                    } else if (['top', 'bottom', 'left', 'right'].includes(side)) {
                        // 상하좌우 개별 방향
                        sides.push(side.charAt(0).toUpperCase() + side.slice(1));
                    }
    
                    if (sides.length > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const attrs: any = {};
                        sides.forEach(s => {
                            attrs[`border${s}Style`] = side === 'clear' ? null : pendingBorderStyle.value;
                            attrs[`border${s}Width`] = side === 'clear' ? null : pendingBorderWidth.value;
                            attrs[`border${s}Color`] = side === 'clear' ? null : pendingBorderColor.value;
                        });
                        tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs });
                        modified = true;
                    }
                }
            }
        } else {
            // 2. 복수 셀이 선택된 경우 (CellSelection 계열)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sel = selection as any;
    
            // 테이블 노드와 시작 위치 찾기 ($anchorCell 기준)
            const $anchorCell = state.doc.resolve(sel.$anchorCell.pos);
            let tableNode = null;
            let tableStart = -1;
            for (let d = $anchorCell.depth; d >= 0; d--) {
                const n = $anchorCell.node(d);
                if (n.type.name === 'table') {
                    tableNode = n;
                    tableStart = $anchorCell.before(d);
                    break;
                }
            }
    
            if (!tableNode) return;
    
            const map = TableMap.get(tableNode);
            if (!map || !map.map) return;
            const tableContentStart = tableStart + 1;
    
            // 선택 범위(Bounds) 계산
            const anchorRect = map.findCell(sel.$anchorCell.pos - tableContentStart);
            const headRect = map.findCell(sel.$headCell.pos - tableContentStart);
            const minRow = Math.min(anchorRect.top, headRect.top);
            const maxRow = Math.max(anchorRect.bottom, headRect.bottom) - 1;
            const minCol = Math.min(anchorRect.left, headRect.left);
            const maxCol = Math.max(anchorRect.right, headRect.right) - 1;
    
            // 업데이트할 셀들의 위치와 속성을 수집 (pos -> attrs)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cellUpdates = new Map<number, any>();
    
            /** 인접 셀 위치 찾기 및 업데이트 목록 추가 함수 */
            const addNeighborUpdate = (nPos: number, nSide: string, isDeleting: boolean) => {
                const nNode = state.doc.nodeAt(nPos);
                if (!nNode) return;
                const nAttrs = cellUpdates.get(nPos) || { ...nNode.attrs };
                nAttrs[`border${nSide}Style`] = isDeleting ? null : pendingBorderStyle.value;
                nAttrs[`border${nSide}Width`] = isDeleting ? null : pendingBorderWidth.value;
                nAttrs[`border${nSide}Color`] = isDeleting ? null : pendingBorderColor.value;
                cellUpdates.set(nPos, nAttrs);
            };
    
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sel.forEachCell((node: any, pos: number) => {
                if (!map || !map.map) return;
                const pmMap = map.map as number[];
                const pmWidth = map.width as number;
                const pmHeight = map.height as number;
                const rect = map.findCell(pos - tableContentStart);
                if (!rect) return;
                let sidesToUpdate: string[] = [];
                const isDeleting = side === 'clear';
    
                if (side === 'all') {
                    sidesToUpdate = ['Top', 'Bottom', 'Left', 'Right'];
                } else if (isDeleting) {
                    sidesToUpdate = ['Top', 'Bottom', 'Left', 'Right'];
                } else {
                    // 방향별(outer, inner, top 등) 로직
                    if (side === 'outer') {
                        if (rect.top === minRow) sidesToUpdate.push('Top');
                        if (rect.bottom - 1 === maxRow) sidesToUpdate.push('Bottom');
                        if (rect.left === minCol) sidesToUpdate.push('Left');
                        if (rect.right - 1 === maxCol) sidesToUpdate.push('Right');
                    } else if (side === 'inner') {
                        if (rect.top > minRow) sidesToUpdate.push('Top');
                        if (rect.bottom - 1 < maxRow) sidesToUpdate.push('Bottom');
                        if (rect.left > minCol) sidesToUpdate.push('Left');
                        if (rect.right - 1 < maxCol) sidesToUpdate.push('Right');
                    } else if (side === 'inner-h') {
                        if (rect.top > minRow) sidesToUpdate.push('Top');
                        if (rect.bottom - 1 < maxRow) sidesToUpdate.push('Bottom');
                    } else if (side === 'inner-v') {
                        if (rect.left > minCol) sidesToUpdate.push('Left');
                        if (rect.right - 1 < maxCol) sidesToUpdate.push('Right');
                    } else if (side === 'top' && rect.top === minRow) {
                        sidesToUpdate.push('Top');
                    } else if (side === 'bottom' && rect.bottom - 1 === maxRow) {
                        sidesToUpdate.push('Bottom');
                    } else if (side === 'left' && rect.left === minCol) {
                        sidesToUpdate.push('Left');
                    } else if (side === 'right' && rect.right - 1 === maxCol) {
                        sidesToUpdate.push('Right');
                    }
                }
    
                if (sidesToUpdate.length > 0) {
                    const attrs = cellUpdates.get(pos) || { ...node.attrs };
                    sidesToUpdate.forEach(s => {
                        attrs[`border${s}Style`] = isDeleting ? null : pendingBorderStyle.value;
                        attrs[`border${s}Width`] = isDeleting ? null : pendingBorderWidth.value;
                        attrs[`border${s}Color`] = isDeleting ? null : pendingBorderColor.value;
    
                        // ── 인접 셀 미러링 (Mirroring) ──
                        // pmMap/pmWidth/pmHeight는 상단에서 이미 null 체크를 통과한 값입니다.
                        const _m = pmMap!;
                        const _w = pmWidth!;
                        const _h = pmHeight!;
                        if (s === 'Top' && rect.top > 0 && rect.top === minRow) {
                            for (let c = rect.left; c < rect.right; c++) {
                                const idx = (rect.top - 1) * _w + c;
                                if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Bottom', isDeleting);
                            }
                        } else if (s === 'Bottom' && rect.bottom < _h && rect.bottom - 1 === maxRow) {
                            for (let c = rect.left; c < rect.right; c++) {
                                const idx = rect.bottom * _w + c;
                                if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Top', isDeleting);
                            }
                        } else if (s === 'Left' && rect.left > 0 && rect.left === minCol) {
                            for (let r = rect.top; r < rect.bottom; r++) {
                                const idx = r * _w + (rect.left - 1);
                                if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Right', isDeleting);
                            }
                        } else if (s === 'Right' && rect.right < _w && rect.right - 1 === maxCol) {
                            for (let r = rect.top; r < rect.bottom; r++) {
                                const idx = r * _w + rect.right;
                                if (_m[idx] != null) addNeighborUpdate(_m[idx] + tableContentStart, 'Left', isDeleting);
                            }
                        }
                    });
                    cellUpdates.set(pos, attrs);
                    modified = true;
                } else if (isDeleting) {
                    // Clear 시에는 4방향 모두 지우고 인접 셀도 정리 시도 가능하지만 
                    // 안전을 위해 선택된 셀만 지워도 됨. (위에서 all-sides sidesToUpdate로 처리됨)
                }
            });
    
            // 수집된 모든 업데이트 적용
            cellUpdates.forEach((attrs, pos) => {
                tr.setNodeMarkup(pos, null, attrs);
            });
        }
    
        if (modified) {
            view.dispatch(tr);
        }
    };
    
    /**
     * [FR-06-4] 표 너비에 맞추기 (균등 배분 및 고정폭 고정)
     * 테이블을 현재 에디터 컨테이너 너비(px)에 맞춰 100%로 확장하고, 
     * 모든 열의 너비를 균등하게(Equal distribution) 배분합니다.
     */
    const setTableFullWidth = () => {
        if (!editor.value) return;
        const tableEl = getTableElement();
        if (!tableEl) return;
    
        const containerWidth = tableEl.parentElement?.offsetWidth || 800;
        const { state, view } = editor.value;
        let tablePos = -1;
        const $pos = state.selection.$from;
        for (let d = $pos.depth; d > 0; d--) {
            if ($pos.node(d).type.name === 'table') { tablePos = $pos.before(d); break; }
        }
        if (tablePos === -1) return;
    
        const tableNode = state.doc.nodeAt(tablePos);
        if (!tableNode) return;
        const map = TableMap.get(tableNode);
        const colCount = map.width;
    
        // 1. 현재 열들의 너비 수집 및 총합 계산
        const currentWidths = Array.from({ length: colCount }, () => 0);
        const firstRowMap = map.map.slice(0, colCount);
        const seenCells = new Set<number>();
    
        firstRowMap.forEach((cellPos, colIdx) => {
            if (seenCells.has(cellPos)) return;
            seenCells.add(cellPos);
    
            const cellNode = tableNode.nodeAt(cellPos);
            if (cellNode) {
                const colspan = (cellNode.attrs.colspan as number) || 1;
                const colwidths = cellNode.attrs.colwidth as number[] | null;
    
                for (let i = 0; i < colspan; i++) {
                    // 저장된 너비가 없으면 기본값(100px) 사용
                    const w = (colwidths && colwidths[i]) ? colwidths[i]! : 100;
                    if (colIdx + i < colCount) {
                        currentWidths[colIdx + i] = w;
                    }
                }
            }
        });
    
        const totalCurrentWidth = currentWidths.reduce((sum, w) => sum + w, 0);
        // 비례 확대를 위한 배율 계산
        const scaleRatio = containerWidth / totalCurrentWidth;
        const newWidths = currentWidths.map(w => Math.floor(w * scaleRatio));
    
        const tr = state.tr;
        const processedCells = new Set<number>();
    
        // 2. 모든 셀의 colwidth를 비례 너비로 업데이트
        for (let r = 0; r < map.height; r++) {
            for (let c = 0; c < map.width; c++) {
                const cellPos = map.map[r * map.width + c];
                if (cellPos === undefined || processedCells.has(cellPos)) continue;
                processedCells.add(cellPos);
    
                const cellNode = tableNode.nodeAt(cellPos);
                if (cellNode) {
                    const colspan = (cellNode.attrs.colspan as number) || 1;
                    // 해당 셀이 차지하는 컬럼들의 새로운 너비 슬라이스 추출
                    const colWidthsSlice = newWidths.slice(c, c + colspan);
                    tr.setNodeMarkup(tablePos + 1 + cellPos, null, { ...cellNode.attrs, colwidth: colWidthsSlice });
                }
            }
        }
    
        // 4. 테이블 전체 너비 모델 속성 제거 (내부 열 너비 합계에 따라 자연스럽게 결정)
        tr.setNodeMarkup(tablePos, null, { ...tableNode.attrs, width: null });
    
        view.dispatch(tr.setMeta('addToHistory', true));
        nextTick(applyTableWidths);
    };
    
    // ── 테이블 전체 정렬 (FR-06-6) ──
    
    /** 현재 테이블의 정렬 상태 ('left' | 'center' | 'right') */
    const currentTableAlign = computed<string>(() => {
        if (!editor.value?.isActive('table')) return 'left';
        return editor.value.getAttributes('table').align ?? 'left';
    });
    
    /** 테이블 전체 정렬 적용 */
    const setTableAlign = (align: 'left' | 'center' | 'right') => {
        editor.value?.chain().focus().updateAttributes('table', { align }).run();
    };
    
    // ── 셀 텍스트 정렬 (FR-01-2) ──
    
    /** 현재 선택된 셀의 텍스트 정렬 상태 */
    const currentCellTextAlign = computed<string>(() => {
        if (!editor.value?.isActive('table')) return 'left';
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.textAlign || headerAttrs.textAlign || 'left';
    });
    
    /** 셀 텍스트 정렬 적용 */
    const setCellTextAlign = (align: string) => {
        editor.value?.chain().focus().setTextAlign(align).run();
    };

    // ── 셀 수직 정렬 ──

    /** 현재 선택된 셀의 수직 정렬 상태 */
    const currentCellVerticalAlign = computed<string>(() => {
        if (!editor.value?.isActive('table')) return 'top';
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        return attrs.verticalAlign || headerAttrs.verticalAlign || 'top';
    });

    /** 셀 수직 정렬 적용 */
    const setCellVerticalAlign = (align: 'top' | 'middle' | 'bottom') => {
        editor.value?.chain().focus().setCellAttribute('verticalAlign', align).run();
    };

    // ── 셀 높이 (FR-06-5) ──
    
    /** 현재 셀의 min-height 값 (숫자 부분만, px 단위) */
    const _currentCellMinHeight = computed<number>(() => {
        if (!editor.value?.isActive('table')) return 0;
        const attrs = editor.value.getAttributes('tableCell');
        const headerAttrs = editor.value.getAttributes('tableHeader');
        const raw = attrs.minHeight || headerAttrs.minHeight || '';
        return raw ? Number.parseInt(raw, 10) : 0;
    });
    
    /** 셀 min-height 적용 (0이면 제거) */
    const _applyCellMinHeight = (px: number) => {
        const val = px > 0 ? `${px}px` : null;
        editor.value?.chain().focus().setCellAttribute('minHeight', val).run();
    };
    
    /** 컬럼 리사이즈 중 여부 플래그 */
    let _isResizingTable = false;
    
    /**
     * 저장된 CustomTable 속성을 DOM의 table 요소에 직접 적용합니다.
     *
     * ★ 핵심 메커니즘:
     *   Tiptap의 TableView(NodeView)는 addAttributes().renderHTML() 결과를
     *   라이브 DOM에 반영하지 않습니다 (getHTML() 직렬화에만 사용).
     *   따라서 data-table-layout 등 커스텀 속성은 여기서 수동으로 DOM에 동기화해야
     *   CSS 선택자(table[data-table-layout="auto"])가 매치됩니다.
     *
     *   CSS !important 규칙이 매치되면, updateColumns()가 매 트랜잭션마다
     *   설정하는 인라인 픽셀 너비를 브라우저 스타일 엔진이 자동으로 덮어씁니다.
     *   → 타이밍에 의존하지 않는 안정적인 너비 제어.
     */
    /**
     * [FR-06] 테이블 너비 및 정렬 스타일 동기화 (단순화된 고정폭 버전)
     */
    const applyTableWidths = () => {
        if (!editor.value || editor.value.isDestroyed) return;
        const view = editor.value.view;
    
        view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'table') return;
    
            try {
                const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
                if (!wrapperEl) return;
    
                const tableEl = (wrapperEl.tagName === 'TABLE'
                    ? wrapperEl
                    : wrapperEl.querySelector('table')) as HTMLTableElement | null;
                if (!tableEl) return;
    
                // 1. 레이아웃은 항상 fixed로 고정 (반응형 제거)
                tableEl.setAttribute('data-table-layout', 'fixed');
                tableEl.style.tableLayout = 'fixed';
    
                // 2. data-align 속성 동기화
                const align = node.attrs.align || 'left';
                if (tableEl.getAttribute('data-align') !== align) {
                    tableEl.setAttribute('data-align', align);
                }
    
                // 3. 테이블 전체 너비 동기화
                // 드래그 중에는 간섭하지 않으며, width 속성이 있을 때만 적용합니다.
                if (_isResizingTable) return;
    
                const targetWidth = node.attrs.width;
                if (targetWidth) {
                    if (tableEl.style.width !== targetWidth) {
                        tableEl.style.width = targetWidth;
                    }
                } else {
                    // width가 null인 경우 스타일을 제거하여 자연스럽게 열 너비를 따르도록 함
                    if (tableEl.style.width) {
                        tableEl.style.width = '';
                    }
                }
            } catch (e) {
                console.warn('Sync failed:', e);
            }
            return false;
        });
    };
    
    // ── 표 플로팅 툴바 위치 관리 ──
    /** 플로팅 툴바 표시 여부 */
    const tableFloatVisible = ref(false);
    /** 플로팅 툴바 fixed X 좌표 (px) */
    const tableFloatX = ref(0);
    /** 플로팅 툴바 fixed Y 좌표 (px) */
    const tableFloatY = ref(0);
    
    /** 현재 커서가 속한 table DOM 요소를 반환합니다. */
    const getTableElement = (): HTMLTableElement | null => {
        if (!editor.value) return null;
        const { from } = editor.value.state.selection;
        const node = editor.value.view.domAtPos(from).node as Node;
        let el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
        while (el && el.tagName !== 'TABLE') {
            el = el.parentElement;
        }
        return el as HTMLTableElement | null;
    };
    
    /**
     * 플로팅 툴바 위치 갱신 (table 요소 기준 fixed 좌표)
     */
    const updateTableFloat = () => {
        if (!editor.value?.isActive('table')) {
            tableFloatVisible.value = false;
            return;
        }
        const tableEl = getTableElement();
        if (!tableEl) {
            tableFloatVisible.value = false;
            return;
        }
        const rect = tableEl.getBoundingClientRect();
        const TOOLBAR_H = 40;
        const top = rect.top >= TOOLBAR_H + 8
            ? rect.top - TOOLBAR_H - 4
            : rect.top + 4;
    
        tableFloatX.value = rect.left;
        tableFloatY.value = top;
        tableFloatVisible.value = true;
    };
    
    // 스크롤 시 위치 재계산 (main 스크롤 컨테이너 기준)
    let _scrollEl: Element | null = null;
    
    /**
     * 컬럼 리사이즈 완료(mouseup) 시 각 table의 실제 렌더링 너비를
     * CustomTable의 width 속성으로 동기화합니다.
     */
    const syncTableWidths = () => {
        if (!editor.value || editor.value.isDestroyed) return;
        const view = editor.value.view;
    
        let changed = false;
        const tr = view.state.tr;
    
        view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'table') return;
    
            try {
                const wrapperEl = view.nodeDOM(pos) as HTMLElement | null;
                if (!wrapperEl) return;
    
                const tableEl = (wrapperEl.tagName === 'TABLE'
                    ? wrapperEl
                    : wrapperEl.querySelector('table')) as HTMLTableElement | null;
                if (!tableEl) return;
    
                const domWidth = tableEl.style.width;
                if (!domWidth) return;
    
                if (node.attrs.width !== domWidth) {
                    tr.setNodeMarkup(pos, null, { ...node.attrs, width: domWidth });
                    changed = true;
                }
            } catch { /* pos → DOM 매핑 실패 시 무시 */ }
        });
    
        if (changed) {
            view.dispatch(tr.setMeta('addToHistory', false));
        }
    };
    
    /**
     * 표 구조 변경 커맨드를 실행하고 즉시 colwidth를 정규화합니다.
     */
    const tableOp = (fn: () => void) => {
        fn();
        nextTick(() => { if (editor.value) normalizeColwidths(editor.value); });
    };
    
    // 리사이즈 핸들 mousedown → _isResizingTable = true (capture 단계로 조기 감지)
    const _onTableResizeStart = (e: MouseEvent) => {
        if ((e.target as HTMLElement)?.classList.contains('column-resize-handle')) {
            _isResizingTable = true;
        }
    };
    // mouseup → 리사이즈 종료, 이후 syncTableWidths가 새 너비를 캡처
    const _onTableResizeEnd = () => {
        _isResizingTable = false;
        // 드래그 종료 후 updateColumns()가 픽셀값으로 남겨둔 경우를 즉시 교정
        nextTick(applyTableWidths);
    };
    
    /** 팔레트 팝오버 바깥 클릭 시 닫기 */
    const _onClickOutsidePalette = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const isFloatingBtn = !!target.closest('.tf-color-btn') || !!target.closest('.tf-border-main-btn');
        const isFloatingPanel = !!target.closest('.tiptap-table-float');
    
        if (!isFloatingBtn && !isFloatingPanel) {
            cellBgPaletteVisible.value = false;
            // 테두리 상세 설정(borderPaletteVisible)은 Drawer 형식이므로 외부 클릭으로 닫지 않음
        }
    };
    
    onMounted(() => {
        _scrollEl = document.querySelector('main');
        _scrollEl?.addEventListener('scroll', updateTableFloat, { passive: true });
        document.addEventListener('mousedown', _onClickOutsidePalette, true);
        window.addEventListener('mousedown', _onTableResizeStart, true);
        window.addEventListener('mouseup', _onTableResizeEnd, true);
        window.addEventListener('mouseup', syncTableWidths);
    });
    
    onUnmounted(() => {
        _scrollEl?.removeEventListener('scroll', updateTableFloat);
        window.removeEventListener('mousedown', _onTableResizeStart, true);
        document.removeEventListener('mousedown', _onClickOutsidePalette, true);
        window.removeEventListener('mouseup', _onTableResizeEnd, true);
        window.removeEventListener('mouseup', syncTableWidths);
    });

    return {
        TABLE_CELL_PALETTE,
        BORDER_STYLES,
        BORDER_WIDTHS,
        BORDER_DIRECTIONS,
        cellBgPaletteVisible,
        currentCellBg,
        applyCellBgColor,
        borderPaletteVisible,
        pendingBorderStyle,
        pendingBorderWidth,
        pendingBorderColor,
        currentCellBorderColor,
        applyCellBorderStyle,
        applyCellBorderWidth,
        applyCellBorderColor,
        applySideBorder,
        setTableFullWidth,
        currentTableAlign,
        setTableAlign,
        currentCellTextAlign,
        setCellTextAlign,
        currentCellVerticalAlign,
        setCellVerticalAlign,
        applyTableWidths,
        tableFloatVisible,
        tableFloatX,
        tableFloatY,
        updateTableFloat,
        tableOp,
    };
};
