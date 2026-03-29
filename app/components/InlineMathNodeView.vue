<!--
================================================================================
[components/InlineMathNodeView.vue] 인라인 LaTeX 수식 NodeView (FR-07)
================================================================================
Tiptap inlineMath 커스텀 노드의 Vue 렌더러입니다.
mathlive의 <math-field> Web Component를 사용하여 수식을 렌더링/편집합니다.

[동작]
  - 편집 모드: <math-field> 활성화 (인라인 편집), 입력 시 latex 속성 업데이트
  - 조회 모드: <math-field readonly> (렌더링 전용, 클릭 불가)

[mathlive SSR 방지]
  onMounted에서 동적 import — TiptapEditor 자체가 <ClientOnly> 내에서
  렌더링되므로 실제로는 항상 client-side에서만 실행됩니다.

Design Ref: §FR-07 — InlineMathExtension NodeView
================================================================================
-->
<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';

// nodeViewProps: Tiptap NodeView 표준 prop 인터페이스 (node, editor, updateAttributes 등)
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
    // mathlive Web Component 등록 (import side-effect)
    // @vite-ignore: mathlive는 customElements.define()을 최상위에서 호출하므로
    // Vite SSR 정적 분석에서 제외합니다. onMounted는 브라우저에서만 실행됩니다.
    await import(/* @vite-ignore */ 'mathlive');

    if (!mathFieldRef.value) return;

    // 초기 LaTeX 값 설정
    // <math-field>는 :value 바인딩이 아닌 직접 속성 접근으로 설정해야 합니다
    mathFieldRef.value.value = props.node.attrs.latex ?? '';

    if (isEditable.value) {
        // 수식 변경 시 Tiptap 노드 속성 업데이트
        mathFieldRef.value.addEventListener('input', () => {
            props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
        });

        // 편집 모드: inline 레이아웃 강제
        mathFieldRef.value.style.display = 'inline-flex';
    }
});

/**
 * latex prop 변경 시 <math-field> 값 동기화
 * (다른 세션에서 동기화될 때를 대비)
 */
watch(() => props.node.attrs.latex, (newLatex) => {
    if (!mathFieldRef.value) return;
    // 현재 포커스 중이면 업데이트 생략 (사용자 입력 중 덮어쓰기 방지)
    if (document.activeElement !== mathFieldRef.value) {
        mathFieldRef.value.value = newLatex ?? '';
    }
});
</script>

<template>
    <!--
        Design Ref: §FR-07-2 — 인라인 수식 노드
        as="span": 인라인 배치를 위해 span으로 렌더링
    -->
    <NodeViewWrapper as="span" class="math-inline-wrapper" contenteditable="false">
        <!--
            math-field: mathlive Web Component
            - isEditable=true : 클릭하면 수식 편집 활성화
            - isEditable=false: read-only 렌더링 (조회 모드)
            - nuxt.config.ts의 isCustomElement 설정으로 Vue 경고 없이 사용 가능
        -->
        <math-field
            ref="mathFieldRef"
            :read-only="!isEditable"
            class="math-field-inline"
            :class="{ 'math-field-readonly': !isEditable }"
        />
    </NodeViewWrapper>
</template>

<style scoped>
.math-inline-wrapper {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    margin: 0 2px;
}

/* mathlive 인라인 수식 기본 스타일 */
.math-field-inline {
    display: inline-flex;
    min-width: 2em;
    padding: 1px 4px;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: border-color 0.15s;
    font-size: inherit;
}

/* 편집 모드: 호버 시 테두리 표시 */
.math-field-inline:not(.math-field-readonly):hover {
    border-color: rgb(99, 102, 241); /* indigo-500 */
}

/* 조회 모드: 테두리 없음 */
.math-field-readonly {
    cursor: default;
    border-color: transparent !important;
    background: transparent;
}
</style>
