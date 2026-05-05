<script setup lang="ts">
import type { Editor } from '@tiptap/core';

type BorderOption = { value: string | null; label: string; title?: string };
type BorderDirection = { value: string; label: string; icon: string };

const props = defineProps<{
    editor: Editor | null;
    readonly?: boolean;
    tableFloatVisible: boolean;
    tableFloatX: number;
    tableFloatY: number;
    tableCellPalette: readonly string[][];
    borderStyles: readonly BorderOption[];
    borderWidths: readonly BorderOption[];
    borderDirections: readonly BorderDirection[];
    currentCellBg: string | null;
    currentCellBorderColor: string | null;
    currentTableAlign: string;
    currentCellTextAlign: string;
    cellBgPaletteVisible: boolean;
    borderPaletteVisible: boolean;
    pendingBorderStyle: string | null;
    pendingBorderWidth: string | null;
    pendingBorderColor: string | null;
    tableOp: (fn: () => void) => void;
    applyCellBgColor: (color: string | null) => void;
    applyCellBorderStyle: (style: string | null) => void;
    applyCellBorderWidth: (width: string | null) => void;
    applyCellBorderColor: (color: string | null) => void;
    applySideBorder: (side: string) => void;
    setTableAlign: (align: 'left' | 'center' | 'right') => void;
    setCellTextAlign: (align: string) => void;
    currentCellVerticalAlign: string;
    setCellVerticalAlign: (align: 'top' | 'middle' | 'bottom') => void;
    setTableFullWidth: () => void;
}>();

const emit = defineEmits<{
    'update:cellBgPaletteVisible': [value: boolean];
    'update:borderPaletteVisible': [value: boolean];
    'update:pendingBorderStyle': [value: string | null];
    'update:pendingBorderWidth': [value: string | null];
    'update:pendingBorderColor': [value: string | null];
}>();

const cellBgPaletteVisible = computed({
    get: () => props.cellBgPaletteVisible,
    set: value => emit('update:cellBgPaletteVisible', value),
});
const borderPaletteVisible = computed({
    get: () => props.borderPaletteVisible,
    set: value => emit('update:borderPaletteVisible', value),
});
const pendingBorderStyle = computed({
    get: () => props.pendingBorderStyle,
    set: value => emit('update:pendingBorderStyle', value),
});
const pendingBorderWidth = computed({
    get: () => props.pendingBorderWidth,
    set: value => emit('update:pendingBorderWidth', value),
});
const pendingBorderColor = computed({
    get: () => props.pendingBorderColor,
    set: value => emit('update:pendingBorderColor', value),
});

const TABLE_CELL_PALETTE = computed(() => props.tableCellPalette);
const BORDER_STYLES = computed(() => props.borderStyles);
const BORDER_WIDTHS = computed(() => props.borderWidths);
const BORDER_DIRECTIONS = computed(() => props.borderDirections);
const currentCellBg = computed(() => props.currentCellBg);
const currentCellBorderColor = computed(() => props.currentCellBorderColor);
const currentTableAlign = computed(() => props.currentTableAlign);
const currentCellTextAlign = computed(() => props.currentCellTextAlign);
const currentCellVerticalAlign = computed(() => props.currentCellVerticalAlign);

const applyCellBorderStyle = (style: string | null) => {
    pendingBorderStyle.value = style;
    props.applyCellBorderStyle(style);
};
const applyCellBorderWidth = (width: string | null) => {
    pendingBorderWidth.value = width;
    props.applyCellBorderWidth(width);
};
const applyCellBorderColor = (color: string | null) => {
    pendingBorderColor.value = color;
    props.applyCellBorderColor(color);
};
</script>

<template>
    <!-- ── 표 플로팅 툴바 (body에 Teleport — overflow-hidden 제약 해제) ── -->
    <!-- @mousedown.prevent: 버튼 클릭 시 에디터 포커스가 해제되지 않도록 기본 동작 방지 -->
    <Teleport to="body">
        <Transition name="table-float">
            <div
v-if="tableFloatVisible && editor && !props.readonly && !borderPaletteVisible"
                class="tiptap-table-float" :style="{ top: tableFloatY + 'px', left: tableFloatX + 'px' }">

                <!-- 행 조작: 위 추가 / 아래 추가 / 행 삭제 -->
                <div class="tf-group">
                    <!-- 위에 행 추가: 새 행 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="위에 행 추가"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addRowBefore().run())">
                        <!-- + 기호(위) + 닫힌 행 2개(아래): rect로 4면 막힘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="7" y1="1.5" x2="7" y2="5.5" />
                            <line x1="5" y1="3.5" x2="9" y2="3.5" />
                            <rect x="1" y="8" width="12" height="5" />
                        </svg>
                    </button>
                    <!-- 아래 행 추가: 새 행 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="아래 행 추가" @mousedown.prevent="tableOp(() => editor?.chain().focus().addRowAfter().run())">
                        <!-- 닫힌 행 2개(위) + + 기호(아래): rect로 4면 막힘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="12" height="5" />
                            <line x1="7" y1="8.5" x2="7" y2="12.5" />
                            <line x1="5" y1="10.5" x2="9" y2="10.5" />
                        </svg>
                    </button>
                    <!-- 행 삭제: 기존 셀만 제거, 정규화 불필요 -->
                    <button
class="tf-btn tf-danger" title="행 삭제"
                        @mousedown.prevent="editor?.chain().focus().deleteRow().run()">
                        <!-- 닫힌 행 1개(왼쪽) + 원형 배경의 X(오른쪽 중앙 정렬) -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="4.5" width="5" height="5" stroke-width="1.5" />
                            <!-- X 영역 배경 원: rect 우측 영역(x=7~14) 중앙 cx=10.5, rect y 중앙 cy=7 -->
                            <circle cx="10.5" cy="7" r="3" fill="currentColor" opacity="0.15" stroke="none" />
                            <!-- X (중앙 10.5,7 기준 ±2) -->
                            <line x1="8.5" y1="5" x2="12.5" y2="9" stroke-width="1.8" />
                            <line x1="12.5" y1="5" x2="8.5" y2="9" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 열 조작: 왼쪽 추가 / 오른쪽 추가 / 열 삭제 -->
                <div class="tf-group">
                    <!-- 왼쪽 열 추가: 새 열 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="왼쪽 열 추가"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addColumnBefore().run())">
                        <!-- + 기호(왼쪽) + 닫힌 열 2개(오른쪽): rect로 4면 막힘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="1.5" y1="7" x2="5.5" y2="7" />
                            <line x1="3.5" y1="5" x2="3.5" y2="9" />
                            <rect x="8" y="1" width="5" height="12" />
                        </svg>
                    </button>
                    <!-- 오른쪽 열 추가: 새 열 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="오른쪽 열 추가"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().addColumnAfter().run())">
                        <!-- 닫힌 열 2개(왼쪽) + + 기호(오른쪽): rect로 4면 막힘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="5" height="12" />
                            <line x1="8.5" y1="7" x2="12.5" y2="7" />
                            <line x1="10.5" y1="5" x2="10.5" y2="9" />
                        </svg>
                    </button>
                    <!-- 열 삭제: 기존 셀만 제거, 정규화 불필요 -->
                    <button
class="tf-btn tf-danger" title="열 삭제"
                        @mousedown.prevent="editor?.chain().focus().deleteColumn().run()">
                        <!-- 닫힌 열 1개(위) + 원형 배경의 X(아래 중앙 정렬) -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4.5" y="1" width="5" height="5" stroke-width="1.5" />
                            <!-- X 영역 배경 원: rect 하단 영역(y=7~14) 중앙 cy=10.5, rect x 중앙 cx=7 -->
                            <circle cx="7" cy="10.5" r="3" fill="currentColor" opacity="0.15" stroke="none" />
                            <!-- X (중앙 7,10.5 기준 ±2) -->
                            <line x1="5" y1="8.5" x2="9" y2="12.5" stroke-width="1.8" />
                            <line x1="9" y1="8.5" x2="5" y2="12.5" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 셀 병합·분리 -->
                <div class="tf-group">
                    <!-- 셀 병합: 병합 후 colwidth 배열 변경 → tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="셀 병합" @mousedown.prevent="tableOp(() => editor?.chain().focus().mergeCells().run())">
                        <!--
                            병합 아이콘: 위 행은 2셀, 아래 행은 병합 셀(강조)
                            ┌──┬──┐
                            │  │  │  ← 위 행 (2셀)
                            ├──┴──┤
                            │ 병합│  ← 병합 셀 (fill 강조)
                            └─────┘
                        -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1" />
                            <!-- 가로 구분선 (2분할) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                            <!-- 위 행 세로 구분선 -->
                            <line x1="7" y1="1" x2="7" y2="7" />
                            <!-- 병합 셀 강조 (아래 행 채우기) -->
                            <rect
x="1.8" y="7.8" width="10.4" height="4.4" rx="0.5" fill="currentColor" opacity="0.3"
                                stroke="none" />
                        </svg>
                    </button>
                    <!-- 셀 분리: 분리된 새 셀에 colwidth 없음 → tableOp로 정규화 -->
                    <button
class="tf-btn" title="셀 분리"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().splitCell().run())">
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="1" y="1" width="12" height="12" rx="1" />
                            <line x1="7" y1="1" x2="7" y2="13" />
                            <polyline points="4.5,5.5 2.5,7 4.5,8.5" />
                            <polyline points="9.5,5.5 11.5,7 9.5,8.5" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 헤더 행·열 -->
                <div class="tf-group">
                    <!-- 헤더 행 토글: tableOp로 정규화 (헤더↔일반 셀 변환 시 colwidth 재확인) -->
                    <button
class="tf-btn"
                        title="헤더 행 토글"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().toggleHeaderRow().run())">
                        <!--
                            헤더 행 아이콘: 상단 행 2셀 강조(fill), 세로 구분선이 헤더를 관통
                            ┌──┬──┐
                            │▒▒│▒▒│  ← 헤더 행 (2개 개별 셀, 강조)
                            ├──┼──┤
                            │  │  │  ← 바디 행
                            └──┴──┘
                        -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.3"
                            stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" />
                            <!-- 헤더 행 배경 강조 (세로 구분선이 위에 그려져 개별 셀처럼 보임) -->
                            <rect
x="1.5" y="1.5" width="11" height="5" fill="currentColor" opacity="0.25"
                                stroke="none" />
                            <!-- 가로 구분선 (헤더/바디 경계) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                            <!-- 세로 구분선 (헤더 영역 관통 → 개별 셀 분리) -->
                            <line x1="7" y1="1" x2="7" y2="13" />
                        </svg>
                    </button>
                    <!-- 헤더 열 토글: tableOp로 정규화 -->
                    <button
class="tf-btn"
                        title="헤더 열 토글"
                        @mousedown.prevent="tableOp(() => editor?.chain().focus().toggleHeaderColumn().run())">
                        <!--
                            헤더 열 아이콘: 좌측 열 2셀 강조(fill), 가로 구분선이 헤더를 관통
                            ┌──┬──┐
                            │▒▒│  │
                            ├──┼──┤  ← 가로선이 헤더 열 관통 → 개별 셀
                            │▒▒│  │
                            └──┴──┘
                        -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.3"
                            stroke-linecap="round" stroke-linejoin="round">
                            <!-- 외곽 테두리 -->
                            <rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" />
                            <!-- 헤더 열 배경 강조 (가로 구분선이 위에 그려져 개별 셀처럼 보임) -->
                            <rect
x="1.5" y="1.5" width="5" height="11" fill="currentColor" opacity="0.25"
                                stroke="none" />
                            <!-- 세로 구분선 (헤더/바디 경계) -->
                            <line x1="7" y1="1" x2="7" y2="13" />
                            <!-- 가로 구분선 (헤더 열 관통 → 개별 셀 분리) -->
                            <line x1="1" y1="7" x2="13" y2="7" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-3: 셀 배경색 팔레트 (16색) -->
                <div class="tf-group" style="position: relative;">
                    <button
class="tf-btn tf-color-btn"
                        title="셀 배경색" @mousedown.prevent="cellBgPaletteVisible = !cellBgPaletteVisible">
                        <i class="pi pi-palette"/>
                        <span
class="tf-color-dot"
                            :style="{ backgroundColor: currentCellBg ?? 'transparent', border: currentCellBg ? 'none' : '1px dashed #aaa' }"/>
                    </button>
                    <!-- 팔레트 팝오버 (글자색 팔레트와 동일한 8열 × 6행) -->
                    <div
v-if="cellBgPaletteVisible" class="tiptap-table-float"
                        style="position: absolute; top: calc(100% + 4px); left: 0; width: 196px; padding: 6px; z-index: 100; display: flex; flex-direction: column; gap: 4px;"
                        @mousedown.prevent>
                        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px;">
                            <template v-for="(row, ri) in TABLE_CELL_PALETTE" :key="ri">
                                <button
v-for="color in row" :key="color" class="tf-palette-swatch"
                                    :style="{ backgroundColor: color }" :title="color"
                                    @mousedown.prevent="applyCellBgColor(color)" />
                            </template>
                        </div>
                        <!-- 배경 없음(지우개) -->
                        <button
class="tf-palette-swatch tf-palette-clear" title="배경 없음"
                            style="width: 100%; height: 20px; border-radius: 3px; gap: 4px;"
                            @mousedown.prevent="applyCellBgColor(null)">
                            <i class="pi pi-times" style="font-size: 9px;"/>
                            <span style="font-size: 10px;">배경 없음</span>
                        </button>
                    </div>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-2: 테두리 통합 상세 설정 (팝업 지원) -->
                <div class="tf-group" style="position: relative;">
                    <button
class="tf-btn tf-border-main-btn" :class="{ 'tf-btn-active': borderPaletteVisible }"
                        title="테두리 상세 설정" @mousedown.prevent="borderPaletteVisible = !borderPaletteVisible">
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.3">
                            <rect x="2" y="2" width="10" height="10" rx="1" />
                            <path d="M2 5h10M5 2v10" opacity="0.4" />
                        </svg>
                        <span
class="tf-border-indicator"
                            :style="{ backgroundColor: (borderPaletteVisible ? pendingBorderColor : currentCellBorderColor) || '#888' }" />
                    </button>

                </div>

                <span class="tf-divider" />

                <!-- FR-06-6: 테이블 전체 위치 정렬 -->
                <div class="tf-group">
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'left' }" title="테이블 좌측 정렬"
                        @mousedown.prevent="setTableAlign('left')">
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="1" y="2" width="8" height="10" rx="1" />
                            <path d="M10 4h3M10 7h2M10 10h3" opacity="0.4" />
                        </svg>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'center' }"
                        title="테이블 중앙 정렬" @mousedown.prevent="setTableAlign('center')">
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="3" y="2" width="8" height="10" rx="1" />
                            <path d="M1 4h1M12 4h1M1 7h1.5M11.5 7h1.5M1 10h1M12 10h1" opacity="0.4" />
                        </svg>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentTableAlign === 'right' }" title="테이블 우측 정렬"
                        @mousedown.prevent="setTableAlign('right')">
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5">
                            <rect x="5" y="2" width="8" height="10" rx="1" />
                            <path d="M1 4h3M2 7h2M1 10h3" opacity="0.4" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-01-2: 셀 텍스트 정렬 -->
                <div class="tf-group">
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'left' }"
                        title="텍스트 좌측 정렬" @mousedown.prevent="setCellTextAlign('left')">
                        <i class="pi pi-align-left"/>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'center' }"
                        title="텍스트 중앙 정렬" @mousedown.prevent="setCellTextAlign('center')">
                        <i class="pi pi-align-center"/>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'right' }"
                        title="텍스트 우측 정렬" @mousedown.prevent="setCellTextAlign('right')">
                        <i class="pi pi-align-right"/>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellTextAlign === 'justify' }"
                        title="텍스트 양쪽 정렬" @mousedown.prevent="setCellTextAlign('justify')">
                        <i class="pi pi-align-justify"/>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 셀 수직 정렬 (Top / Middle / Bottom) -->
                <div class="tf-group">
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellVerticalAlign === 'top' }"
                        title="셀 위쪽 정렬" @mousedown.prevent="setCellVerticalAlign('top')">
                        <!-- 직사각형 셀 안에 선들이 상단에 몰려 있는 아이콘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round">
                            <rect x="1" y="1" width="12" height="12" rx="1" stroke-width="1.2" opacity="0.4" />
                            <line x1="3" y1="4" x2="11" y2="4" />
                            <line x1="3" y1="6.5" x2="9" y2="6.5" />
                        </svg>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellVerticalAlign === 'middle' }"
                        title="셀 중간 정렬" @mousedown.prevent="setCellVerticalAlign('middle')">
                        <!-- 직사각형 셀 안에 선들이 중앙에 위치하는 아이콘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round">
                            <rect x="1" y="1" width="12" height="12" rx="1" stroke-width="1.2" opacity="0.4" />
                            <line x1="3" y1="5.75" x2="11" y2="5.75" />
                            <line x1="3" y1="8.25" x2="9" y2="8.25" />
                        </svg>
                    </button>
                    <button
class="tf-btn" :class="{ 'tf-btn-active': currentCellVerticalAlign === 'bottom' }"
                        title="셀 아래쪽 정렬" @mousedown.prevent="setCellVerticalAlign('bottom')">
                        <!-- 직사각형 셀 안에 선들이 하단에 몰려 있는 아이콘 -->
                        <svg
width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor"
                            stroke-width="1.5" stroke-linecap="round">
                            <rect x="1" y="1" width="12" height="12" rx="1" stroke-width="1.2" opacity="0.4" />
                            <line x1="3" y1="7.5" x2="11" y2="7.5" />
                            <line x1="3" y1="10" x2="9" y2="10" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- FR-06-4: 너비에 맞추기 (균등 배분 및 고정폭 고정) -->
                <div class="tf-group">
                    <button class="tf-btn" title="에디터 너비에 맞추기 (균등 배분)" @mousedown.prevent="setTableFullWidth">
                        <svg
width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 8 1 12 4 16" />
                            <polyline points="20 16 23 12 20 8" />
                            <line x1="1" y1="12" x2="23" y2="12" />
                        </svg>
                    </button>
                </div>

                <span class="tf-divider" />

                <!-- 표 삭제 -->
                <button
class="tf-btn tf-danger" title="표 삭제"
                    @mousedown.prevent="editor?.chain().focus().deleteTable().run()">
                    <i class="pi pi-trash"/>
                </button>
            </div>
        </Transition>
    </Teleport>

    <!-- ── 테두리 상세 설정 Drawer (FR-06-2 개편) ── -->
    <Drawer
v-model:visible="borderPaletteVisible" header="테두리 상세 설정" position="right" :modal="false"
        :dismissable="false" class="!w-[340px] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl"
        @mousedown.prevent>
        <div class="flex flex-col gap-8 py-2">

            <!-- 1. 스타일 & 두께 -->
            <div class="flex gap-6">
                <!-- 스타일 종류 -->
                <div class="drawer-section flex-1">
                    <div class="text-md !mb-3">선 스타일</div>
                    <div class="flex flex-col gap-1.5">
                        <button
v-for="bs in BORDER_STYLES" :key="String(bs.value)"
                            class="tf-btn !h-9 !justify-start !px-3 shadow-none border border-zinc-100 dark:border-zinc-800"
                            :class="{ 'tf-btn-active !border-indigo-500': pendingBorderStyle === bs.value }"
                            :title="bs.title" @mousedown.prevent="applyCellBorderStyle(bs.value)">
                            <span class="text-xs font-semibold">{{ bs.label }}</span>
                            <span class="ml-auto text-[10px] opacity-40">{{ bs.title }}</span>
                        </button>
                    </div>
                </div>

                <!-- 두께 -->
                <div class="drawer-section flex-1">
                    <div class="text-md !mb-3">두께</div>
                    <div class="flex flex-col gap-1.5">
                        <button
v-for="bw in BORDER_WIDTHS" :key="String(bw.value)"
                            class="tf-btn !h-9 !justify-start !px-3 shadow-none border border-zinc-100 dark:border-zinc-800"
                            :class="{ 'tf-btn-active !border-indigo-500': pendingBorderWidth === bw.value }"
                            @mousedown.prevent="applyCellBorderWidth(bw.value)">
                            <span class="text-[11px] font-bold">{{ bw.label }}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 2. 색상 -->
            <div class="drawer-section">
                <div class="text-md !mb-3">선 색상</div>
                <div class="grid grid-cols-8 gap-1.5">
                    <template v-for="(row, ri) in TABLE_CELL_PALETTE" :key="ri">
                        <button
v-for="color in row" :key="color"
                            class="tf-palette-swatch !w-full !h-5 rounded-sm transition-all"
                            :style="{ backgroundColor: color }"
                            :class="{ 'ring-2 ring-indigo-500 ring-offset-2 scale-90': pendingBorderColor === color }"
                            @mousedown.prevent="applyCellBorderColor(color)" />
                    </template>
                    <button
                        class="tf-palette-swatch tf-palette-clear !w-full !h-5 rounded-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700"
                        @mousedown.prevent="applyCellBorderColor(null)">
                        <i class="pi pi-times" style="font-size: 10px;"/>
                    </button>
                </div>
            </div>

            <!-- 3. 방향 선택 (Excel 스타일) -->
            <div class="drawer-section">
                <div class="text-md !mb-3">경계면 선택</div>
                <div class="grid grid-cols-4 gap-2">
                    <button
v-for="dir in BORDER_DIRECTIONS" :key="dir.value"
                        class="tf-btn !h-14 !w-full flex-col !justify-center !items-center !gap-1 !pt-1.5 !pb-0.5 !px-0 shadow-sm border border-zinc-100 dark:border-zinc-800"
                        :title="dir.label" @mousedown.prevent="applySideBorder(dir.value)">
                        <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                            <!-- 배경 그리드 (지우기가 아닐 때만 표시하여 맥락 제공) -->
                            <path
v-if="dir.value !== 'clear'" d="M1 1h12v12H1z M1 7h12 M7 1v12" opacity="0.15"
                                stroke-width="1" />
                            <!-- 실제 방향 아이콘 (강조) -->
                            <path :d="dir.icon" stroke-width="1.8" stroke-linecap="round" />
                        </svg>
                        <span class="text-[9px] font-medium opacity-70">{{ dir.label }}</span>
                    </button>
                </div>
            </div>

            <div class="mt-auto pt-6">
                <Button
label="설정 완료" icon="pi pi-check" class="w-full !h-11" severity="secondary"
                    @click="borderPaletteVisible = false" />
            </div>

        </div>
    </Drawer>
</template>

<style lang="postcss" scoped>
/* ═══════════════════════════════════════════════════════
   표 플로팅 툴바 (.tiptap-table-float)
   Teleport to="body"로 렌더링되므로 :deep() 불필요
   ═══════════════════════════════════════════════════════ */

/* 플로팅 컨테이너 — position: fixed, body 기준 좌표 */
.tiptap-table-float {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    background: #ffffff;
    border: 1px solid rgba(55, 53, 47, 0.13);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
    user-select: none;
    white-space: nowrap;
    /* 다크모드: .dark 클래스가 body가 아닌 html에 적용될 수 있어 별도 미디어쿼리로 처리 */
}

/* 다크모드 플로팅 컨테이너 */
:global(.dark) .tiptap-table-float {
    background: #1e1e1e;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* 버튼 그룹 — 버튼들을 수평으로 묶는 컨테이너 */
.tf-group {
    display: flex;
    align-items: center;
    gap: 2px;
}

/* 기본 버튼 스타일 */
.tf-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 4px 7px;
    font-size: 0.73rem;
    font-weight: 500;
    color: #374151;
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    line-height: 1;
}

.tf-btn:hover {
    background: rgba(55, 53, 47, 0.06);
    color: #111827;
}

/* 활성 버튼 강조 (테두리 스타일, 레이아웃 토글 등) */
.tf-btn.tf-btn-active {
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
}

:global(.dark) .tf-btn.tf-btn-active {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
}

/* 다크모드 버튼 */
:global(.dark) .tf-btn {
    color: #d1d5db;
}

:global(.dark) .tf-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f9fafb;
}

/* 위험(삭제) 버튼 — 빨간 계열 */
.tf-btn.tf-danger {
    color: #ef4444;
}

.tf-btn.tf-danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #dc2626;
}

:global(.dark) .tf-btn.tf-danger {
    color: #f87171;
}

:global(.dark) .tf-btn.tf-danger:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
}

/* 활성(헤더 셀 등) 버튼 — 강조 표시 */
.tf-btn.tf-active {
    color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
}

.tf-btn.tf-active:hover {
    background: rgba(99, 102, 241, 0.18);
}

:global(.dark) .tf-btn.tf-active {
    color: #818cf8;
    background: rgba(129, 140, 248, 0.15);
}

/* 셀 배경색 버튼 — color input을 absolute로 품는 컨테이너 */
.tf-btn.tf-color-btn {
    position: relative;
}

/* 셀 배경색 미리보기 점 */
.tf-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(55, 53, 47, 0.2);
    background-color: #ffffff;
    flex-shrink: 0;
}

/* FR-06-3: 팔레트 색상 스와치 버튼 */
.tf-palette-swatch {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.tf-palette-swatch:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
}

/* 배경 없음(지우개) 스와치 */
.tf-palette-swatch.tf-palette-clear {
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
}

/* FR-06-5: 셀 높이 입력 */
.tf-height-input {
    width: 44px;
    height: 24px;
    font-size: 11px;
    text-align: center;
    border: 1px solid rgba(55, 53, 47, 0.2);
    border-radius: 4px;
    outline: none;
    background: transparent;
    color: inherit;
    padding: 0 2px;
}

.tf-height-input:focus {
    border-color: rgba(99, 102, 241, 0.6);
}

/* 숫자 스피너 숨김 */
.tf-height-input::-webkit-outer-spin-button,
.tf-height-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

/* 그룹 구분선 */
.tf-divider {
    display: inline-block;
    width: 1px;
    height: 18px;
    background: rgba(55, 53, 47, 0.13);
    border-radius: 1px;
    flex-shrink: 0;
    margin: 0 2px;
}

:global(.dark) .tf-divider {
    background: rgba(255, 255, 255, 0.1);
}

.table-float-enter-active,
.table-float-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.table-float-enter-from,
.table-float-leave-to {
    opacity: 0;
    transform: translateY(4px);
}
</style>
