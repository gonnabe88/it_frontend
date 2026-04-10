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

/**
 * 에디터 편집 가능 여부
 * [수정] computed() 대신 ref + editor 'transaction' 이벤트 동기화 방식 사용.
 * editor.isEditable은 Vue 반응형 getter가 아니므로 초기화 타이밍에 따라
 * computed가 false에 고정되는 문제를 방지합니다.
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
    // 에디터 transaction 이벤트로 isEditable 동기화
    props.editor?.on('transaction', syncEditable);

    // mathlive Web Component 등록
    await import(/* @vite-ignore */ 'mathlive');

    if (!mathFieldRef.value) return;

    // async import 완료 후 최신 편집 가능 상태 재확인
    isEditable.value = !!props.editor?.isEditable;

    // 초기 LaTeX 값 설정
    mathFieldRef.value.value = props.node.attrs.latex ?? '';

    // [수정] 소문자 readonly setter 사용 → read-only DOM 속성까지 함께 관리
    mathFieldRef.value.readonly = !isEditable.value;

    // [수정] input 이벤트 리스너를 isEditable 조건 밖에서 등록
    mathFieldRef.value.addEventListener('input', () => {
        if (!isEditable.value) return;
        props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
    });

    // change 이벤트: 포커스 이탈 시 최종 값 캡처 보장
    mathFieldRef.value.addEventListener('change', () => {
        if (!isEditable.value) return;
        props.updateAttributes?.({ latex: mathFieldRef.value?.value ?? '' });
    });

    if (isEditable.value) {
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

/** latex prop 변경 시 <math-field> 값 동기화 */
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
        <math-field ref="mathFieldRef" :read-only="!isEditable" @mousedown.stop class="math-field-block"
            :class="{ 'math-field-readonly': !isEditable }" />
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
    background-color: rgb(248, 250, 252);
    /* slate-50 */
    border: 1px solid rgb(226, 232, 240);
    /* slate-200 */
}

:global(.dark) .math-block-wrapper {
    background-color: rgb(30, 41, 59);
    /* slate-800 */
    border-color: rgb(51, 65, 85);
    /* slate-700 */
}

/* 드래그 핸들 */
.math-block-drag-handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 4px 2px;
    color: rgb(148, 163, 184);
    /* slate-400 */
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

/* 포커스(편집) 시 배경색 밝게 수정 */
.math-field-block:focus-within {
    --fill-color-focus: rgba(99, 102, 241, 0.1);
    background-color: rgba(99, 102, 241, 0.05);
}

/* Shadow DOM 전역 오버라이드: .ML__contains-highlight 직접 타겟팅 */
:global(.ML__contains-highlight),
:global(.ML__focused .ML__contains-highlight) {
    background-color: transparent !important;
}
</style>
