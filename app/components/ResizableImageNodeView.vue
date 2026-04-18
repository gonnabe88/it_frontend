<!--
================================================================================
[components/ResizableImageNodeView.vue] 크기 조정 가능한 이미지 노드 뷰
================================================================================
Tiptap 에디터 내에서 이미지를 선택하면 아래 기능이 활성화됩니다:
  - 우측 핸들 드래그: 이미지 너비 조정 (최소 80px)
  - 상단 툴팁: 왼쪽/가운데/오른쪽 정렬 변경
  - 크기 조정 중: 현재 너비(px) 표시

[props]
  node            - ProseMirror 노드 (attrs: src, alt, title, width, align)
  updateAttributes - 노드 속성 업데이트 함수 (Tiptap NodeView 인터페이스)
  selected        - 에디터에서 현재 선택된 노드 여부
================================================================================
-->
<script setup lang="ts">
import { NodeViewWrapper } from '@tiptap/vue-3';

interface NodeAttrs {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
    align?: 'left' | 'center' | 'right';
}

interface Props {
    node: { attrs: NodeAttrs };
    updateAttributes: (attrs: Partial<NodeAttrs>) => void;
    selected: boolean;
}

const props = defineProps<Props>();

// ── 리사이즈 상태 ──
/** 드래그 중 여부 */
const isResizing = ref(false);

/**
 * 현재 렌더링에 사용할 너비 (드래그 중 실시간 반영용 로컬 상태)
 * mouseup 시점에만 ProseMirror에 커밋하여 불필요한 히스토리 오염 방지
 */
const liveWidth = ref<number | null>(props.node.attrs.width ?? null);

/** 이미지 래퍼 DOM 참조 */
const wrapperRef = ref<HTMLDivElement | null>(null);

// node.attrs.width가 외부에서 변경될 때 로컬 상태 동기화
watch(() => props.node.attrs.width, (w) => {
    if (!isResizing.value) {
        liveWidth.value = w ?? null;
    }
});

// ── 이미지 너비 스타일 ──
const imageStyle = computed(() => {
    const w = liveWidth.value;
    return w ? { width: `${w}px`, maxWidth: '100%' } : { maxWidth: '100%' };
});

// ── 정렬 스타일 (NodeViewWrapper 레벨에 적용) ──
const wrapperJustify = computed(() => {
    const align = props.node.attrs.align ?? 'left';
    return align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
});

// ── 리사이즈 핸들 mousedown ──
/**
 * 오른쪽 핸들을 드래그하면 이미지 너비를 조정합니다.
 * 드래그 중에는 로컬 liveWidth만 업데이트하고,
 * mouseup 시 updateAttributes()로 ProseMirror 상태에 최종 커밋합니다.
 */
const startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing.value = true;

    // 드래그 시작 시점의 마우스 X 좌표 및 이미지 실제 너비
    const startX = e.clientX;
    const startWidth =
        wrapperRef.value?.getBoundingClientRect().width ??
        props.node.attrs.width ??
        300;

    // 드래그 중 텍스트 선택 방지
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        liveWidth.value = Math.max(80, Math.round(startWidth + dx));
    };

    const onMouseUp = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const finalWidth = Math.max(80, Math.round(startWidth + dx));
        // ProseMirror 문서에 최종 너비 커밋 (Undo 히스토리 1회 기록)
        props.updateAttributes({ width: finalWidth });
        isResizing.value = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// ── 정렬 변경 ──
const setAlign = (align: 'left' | 'center' | 'right') => {
    props.updateAttributes({ align });
};
</script>

<template>
    <!--
        NodeViewWrapper: Tiptap이 ProseMirror 노드와 DOM을 연결하는 필수 루트 요소.
        display: flex + justifyContent로 이미지 좌/중/우 정렬을 제어합니다.
    -->
    <NodeViewWrapper as="div" :style="{ display: 'flex', justifyContent: wrapperJustify, margin: '0.5rem 0' }">

        <!-- 이미지 + 핸들을 감싸는 컨테이너 (상대 위치 기준) -->
        <div
ref="wrapperRef" class="relative inline-block group/img" :style="imageStyle" :class="{
            'outline outline-2 outline-offset-1 outline-indigo-500 rounded-lg': selected || isResizing
        }">

            <!-- 이미지 본체 -->
            <img
                :src="node.attrs.src" :alt="node.attrs.alt ?? ''" :title="node.attrs.title ?? ''"
                class="block w-full rounded-lg shadow-sm" draggable="false" >

            <!-- ─ 선택 시: 상단 정렬 툴팁 ─ -->
            <div
v-if="selected && !isResizing"
                class="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg px-1 py-0.5 z-20 whitespace-nowrap">

                <!-- 왼쪽 정렬 -->
                <button
class="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    :class="{ 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30': (node.attrs.align ?? 'left') === 'left' }"
                    title="왼쪽 정렬" @mousedown.prevent="setAlign('left')">
                    <i class="pi pi-align-left text-xs"/>
                </button>

                <!-- 가운데 정렬 -->
                <button
class="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    :class="{ 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30': node.attrs.align === 'center' }"
                    title="가운데 정렬" @mousedown.prevent="setAlign('center')">
                    <i class="pi pi-align-center text-xs"/>
                </button>

                <!-- 오른쪽 정렬 -->
                <button
class="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    :class="{ 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30': node.attrs.align === 'right' }"
                    title="오른쪽 정렬" @mousedown.prevent="setAlign('right')">
                    <i class="pi pi-align-right text-xs"/>
                </button>

                <!-- 구분선 -->
                <div class="w-px h-4 bg-zinc-200 dark:bg-zinc-600 mx-0.5"/>

                <!-- 너비 초기화 -->
                <button
class="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-xs"
                    title="크기 초기화" @mousedown.prevent="() => { liveWidth = null; updateAttributes({ width: null }); }">
                    <i class="pi pi-refresh text-xs"/>
                </button>
            </div>

            <!-- ─ 선택/리사이즈 중: 우측 리사이즈 핸들 ─ -->
            <div
v-if="selected || isResizing"
                class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-10 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-500 rounded-full cursor-ew-resize shadow-md z-20 flex flex-col items-center justify-center gap-0.5"
                title="드래그하여 이미지 크기 조정" @mousedown="startResize">
                <!-- 리사이즈 핸들 내부 그립 라인 -->
                <div class="w-px h-3 bg-zinc-400 dark:bg-zinc-400 rounded-full"/>
                <div class="w-px h-3 bg-zinc-400 dark:bg-zinc-400 rounded-full"/>
            </div>

            <!-- ─ 리사이즈 중: 현재 너비 뱃지 ─ -->
            <div
v-if="isResizing"
                class="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded-md px-1.5 py-0.5 pointer-events-none z-20 font-mono">
                {{ liveWidth }}px
            </div>
        </div>
    </NodeViewWrapper>
</template>
