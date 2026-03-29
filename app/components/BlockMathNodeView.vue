<!--
================================================================================
[components/BlockMathNodeView.vue] 블록 LaTeX 수식 NodeView (FR-07)
================================================================================
Tiptap blockMath 커스텀 노드의 Vue 렌더러입니다.
mathlive의 <math-field> Web Component를 사용하여 블록 수식을 렌더링/편집합니다.

[동작]
  - 편집 모드: <math-field> 전체 폭으로 활성화, 입력 시 latex 속성 업데이트
  - 조회 모드: <math-field readonly> 중앙 정렬 렌더링

Design Ref: §FR-07 — BlockMathExtension NodeView
================================================================================
-->
<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';

const props = defineProps(nodeViewProps);

/** mathlive <math-field> DOM 참조 */
const mathFieldRef = ref<any>(null);

/** 에디터 편집 가능 여부 */
const isEditable = computed(() => !!props.editor?.isEditable);

/**
 * mathlive 동적 임포트 및 이벤트 연결
 * onMounted에서 import → SSR에서 실행되지 않음
 */
onMounted(async () => {
    // @vite-ignore: mathlive는 customElements.define()을 최상위에서 호출하므로
    // Vite SSR 정적 분석에서 제외합니다. onMounted는 브라우저에서만 실행됩니다.
    await import(/* @vite-ignore */ 'mathlive');

    if (!mathFieldRef.value) return;

    // 초기 LaTeX 값 설정
    mathFieldRef.value.value = props.node.attrs.latex ?? '';

    if (isEditable.value) {
        // 수식 변경 시 Tiptap 노드 속성 업데이트
        mathFieldRef.value.addEventListener('input', () => {
            props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
        });
    }
});

/** latex prop 변경 시 <math-field> 값 동기화 */
watch(() => props.node.attrs.latex, (newLatex) => {
    if (!mathFieldRef.value) return;
    if (document.activeElement !== mathFieldRef.value) {
        mathFieldRef.value.value = newLatex ?? '';
    }
});
</script>

<template>
    <!--
        Design Ref: §FR-07-3 — 블록 수식 노드
        as="div": 블록 배치
        data-drag-handle: draggable 노드의 드래그 핸들
    -->
    <NodeViewWrapper as="div" class="math-block-wrapper" contenteditable="false">
        <!-- 드래그 핸들 (편집 모드에서만 표시) -->
        <div v-if="isEditable" class="math-block-drag-handle" data-drag-handle title="드래그하여 이동">
            <i class="pi pi-bars" style="font-size: 12px;" />
        </div>

        <!--
            math-field: mathlive Web Component (블록 수식)
            - display=block 으로 전체 폭 사용
            - 조회 모드: 중앙 정렬 readonly 렌더링
        -->
        <math-field
            ref="mathFieldRef"
            :read-only="!isEditable"
            class="math-field-block"
            :class="{ 'math-field-readonly': !isEditable }"
        />
    </NodeViewWrapper>
</template>

<style scoped>
.math-block-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 8px 0;
    padding: 8px;
    border-radius: 6px;
    background-color: rgb(248, 250, 252); /* slate-50 */
    border: 1px solid rgb(226, 232, 240); /* slate-200 */
}

:global(.dark) .math-block-wrapper {
    background-color: rgb(30, 41, 59); /* slate-800 */
    border-color: rgb(51, 65, 85); /* slate-700 */
}

/* 드래그 핸들 */
.math-block-drag-handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 4px 2px;
    color: rgb(148, 163, 184); /* slate-400 */
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
}

.math-block-wrapper:hover .math-block-drag-handle {
    opacity: 1;
}

/* mathlive 블록 수식 */
.math-field-block {
    display: block;
    width: 100%;
    min-height: 2.5em;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 1.1em;
    transition: border-color 0.15s;
}

/* 편집 모드 */
.math-field-block:not(.math-field-readonly):hover {
    border-color: rgb(99, 102, 241);
}

/* 조회 모드: 중앙 정렬 */
.math-field-readonly {
    cursor: default;
    border-color: transparent !important;
    background: transparent;
    --math-field-text-align: center;
}
</style>
