<!--
================================================================================
[components/ExcalidrawNodeView.vue] Excalidraw Tiptap 노드 뷰
================================================================================
Tiptap 에디터 내에서 Excalidraw 다이어그램 노드를 시각적으로 렌더링합니다.

[기능]
  - 저장된 SVG 내용을 에디터 안에서 인라인 미리보기
  - hover 시 편집/삭제 버튼 오버레이 표시
  - 편집 버튼 → useExcalidrawDialog를 통해 편집 다이얼로그 열기
  - 삭제 버튼 → Tiptap 트랜잭션으로 노드 제거
================================================================================
-->
<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
import DOMPurify from 'isomorphic-dompurify';

/** Tiptap이 주입하는 노드 뷰 props (node, updateAttributes, deleteNode 등) */
const props = defineProps(nodeViewProps);

/** Excalidraw 다이얼로그 상태 및 제어 */
const { open: openExcalidrawDialog } = useExcalidrawDialog();

/**
 * SVG 콘텐츠 새니타이징
 * v-html 바인딩 시 XSS 방지를 위해 SVG 프로파일로 정제합니다.
 *
 * @param svg - Excalidraw에서 생성된 SVG 문자열
 * @returns 새니타이징된 안전한 SVG 문자열
 */
const sanitizeSvg = (svg: string): string =>
    DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });

/**
 * 편집 버튼 클릭 핸들러
 * 현재 노드의 장면 데이터를 초기값으로 다이얼로그를 열고,
 * 저장 시 updateAttributes로 노드 속성을 갱신합니다.
 */
const onEdit = () => {
    // 디버그: 편집 버튼 클릭 시 sceneData 전달값 확인 (문제 해결 후 제거)
    console.log('[ExcalidrawNodeView onEdit] sceneData:', props.node.attrs.sceneData?.substring(0, 100) ?? 'NULL');
    openExcalidrawDialog(
        props.node.attrs.sceneData || null,
        (data) => {
            // Tiptap 노드 속성 업데이트 (SVG + 장면 데이터 교체)
            props.updateAttributes({
                svgContent: data.svgContent,
                sceneData: data.sceneData
            });
        }
    );
};

/**
 * 삭제 버튼 클릭 핸들러
 * Tiptap 트랜잭션으로 현재 노드를 에디터에서 제거합니다.
 */
const onDelete = () => {
    props.deleteNode();
};
</script>

<template>
    <!-- NodeViewWrapper: Tiptap 노드 뷰 루트 (드래그 핸들 지원) -->
    <NodeViewWrapper class="excalidraw-node-wrapper my-4" data-drag-handle>
        <!-- 다이어그램 컨테이너 (hover 시 오버레이 표시) -->
        <div
            class="relative group border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 cursor-default select-none">

            <!-- SVG 미리보기 영역 (isomorphic-dompurify로 XSS 방지 새니타이징) -->
            <div v-if="props.node.attrs.svgContent" class="excalidraw-preview p-3 overflow-auto"
                v-html="sanitizeSvg(props.node.attrs.svgContent)" />

            <!-- SVG 없을 때 placeholder -->
            <div v-else class="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-600">
                <div class="text-center">
                    <i class="pi pi-image text-5xl mb-3 block"></i>
                    <span class="text-sm">다이어그램 미리보기 없음</span>
                </div>
            </div>

            <!-- hover 오버레이: 편집 / 삭제 버튼 (에디터가 편집 가능 상태일 때만 표시) -->
            <div v-if="props.editor.isEditable"
                class="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-colors duration-200 flex items-start justify-end p-3 opacity-0 group-hover:opacity-100">
                <div class="flex gap-2 shadow-lg">
                    <!-- 편집 버튼 -->
                    <button @click.stop="onEdit"
                        class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center gap-1.5">
                        <i class="pi pi-pencil text-xs"></i>
                        편집
                    </button>
                    <!-- 삭제 버튼 -->
                    <button @click.stop="onDelete"
                        class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors flex items-center gap-1.5">
                        <i class="pi pi-trash text-xs"></i>
                        삭제
                    </button>
                </div>
            </div>

            <!-- 왼쪽 하단 레이블 -->
            <div
                class="absolute bottom-2 left-3 text-xs text-zinc-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Excalidraw 다이어그램
            </div>
        </div>
    </NodeViewWrapper>
</template>

<style scoped>
/* SVG 미리보기: 최대 너비 100% 보장 */
.excalidraw-preview :deep(svg) {
    max-width: 100%;
    height: auto;
    display: block;
}
</style>
