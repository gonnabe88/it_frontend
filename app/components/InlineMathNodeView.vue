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

/**
 * 에디터 편집 가능 여부
 * [수정] computed() 대신 ref + editor 'transaction' 이벤트 동기화 방식 사용.
 * editor.isEditable은 Vue 반응형이 아닌 일반 getter이므로, 에디터 초기화 완료 후
 * computed가 재평가되지 않아 초기값 false에 고정되는 문제를 방지합니다.
 */
const isEditable = ref(!!props.editor?.isEditable);

/** transaction 이벤트 핸들러 (onUnmounted 정리용으로 분리) */
const syncEditable = () => {
    isEditable.value = !!props.editor?.isEditable;
};

/**
 * mathlive 동적 임포트 및 이벤트 연결
 * onMounted에서 import → SSR에서 실행되지 않음
 */
onMounted(async () => {
    // 에디터 transaction 이벤트로 isEditable 동기화 (초기화 완료 시점 반영)
    props.editor?.on('transaction', syncEditable);

    // mathlive Web Component 등록 (import side-effect)
    await import(/* @vite-ignore */ 'mathlive');

    if (!mathFieldRef.value) return;

    // async import 완료 후 최신 편집 가능 상태 재확인 (에디터 초기화 완료 후)
    isEditable.value = !!props.editor?.isEditable;

    // 초기 LaTeX 값 설정
    mathFieldRef.value.value = props.node.attrs.latex ?? '';

    // [수정] 소문자 readonly setter 사용: read-only DOM 속성까지 함께 관리됨
    // camelCase readOnly setter는 내부 옵션만 변경하고 DOM 속성을 제거하지 않아
    // read-only 속성이 남아 수식 입력이 불가한 문제를 수정합니다.
    mathFieldRef.value.readonly = !isEditable.value;

    // [수정] input 이벤트 리스너를 isEditable 조건 밖에서 등록
    // onMounted 시점의 isEditable이 false여도 이후 편집 모드 시 정상 동작하도록 합니다.
    mathFieldRef.value.addEventListener('input', () => {
        if (!isEditable.value) return;
        props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
    });

    // change 이벤트: 포커스 이탈 시 최종 값 캡처 (저장 직전 마지막 입력 누락 방지)
    mathFieldRef.value.addEventListener('change', () => {
        if (!isEditable.value) return;
        props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
    });

    if (isEditable.value) {
        // 편집 모드: inline 레이아웃 강제
        mathFieldRef.value.style.display = 'inline-flex';

        // 새로 삽입된 빈 수식인 경우 자동 포커스
        if (!props.node.attrs.latex) {
            setTimeout(() => {
                mathFieldRef.value?.focus();
            }, 50);
        }
    }
});

onUnmounted(() => {
    props.editor?.off('transaction', syncEditable);
});

/**
 * props 변경 시 <math-field> 상태 동기화
 */
watch(() => props.node.attrs.latex, (newLatex) => {
    if (!mathFieldRef.value) return;
    if (document.activeElement !== mathFieldRef.value) {
        mathFieldRef.value.value = newLatex ?? '';
    }
});

watch(isEditable, (val) => {
    if (!mathFieldRef.value) return;
    // [수정] 소문자 readonly setter 사용 → read-only DOM 속성도 함께 제거/추가
    mathFieldRef.value.readonly = !val;
    if (val) {
        mathFieldRef.value.style.display = 'inline-flex';
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
        <math-field ref="mathFieldRef" :read-only="!isEditable" @mousedown.stop class="math-field-inline"
            :class="{ 'math-field-readonly': !isEditable }" />
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
    border-color: rgb(99, 102, 241);
    /* indigo-500 */
}

/* 조회 모드: 테두리 없음 */
.math-field-readonly {
    cursor: default;
    border-color: transparent !important;
    background: transparent;
}

/* 포커스(편집) 시 배경색 밝게 수정 */
.math-field-inline:focus-within {
    --fill-color-focus: rgba(253, 253, 253, 0.705);
    background-color: rgb(234, 235, 240);
}

/* Shadow DOM 전역 오버라이드: .ML__contains-highlight 직접 타겟팅 */
:global(.ML__contains-highlight),
:global(.ML__focused .ML__contains-highlight) {
    background-color: transparent !important;
}
</style>
