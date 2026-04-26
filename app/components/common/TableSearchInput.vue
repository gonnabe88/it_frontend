<!--
================================================================================
[components/common/TableSearchInput.vue] 통합조회 검색바 (V1 Header default)
================================================================================
Components.html의 Integrated Search V1 디자인을 Vue 컴포넌트로 구현.
테이블 상단 통합검색 인풋으로 사용합니다.

[Props]
  - modelValue (string): v-model 바인딩값
  - placeholder (string?): 입력 필드 안내 문구 (기본: '검색...')
  - width (string?): 너비 CSS 값 (기본: 'auto')

[Emits]
  - update:modelValue: 텍스트 변경 시 발행
================================================================================
-->
<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
    modelValue: string;
    placeholder?: string;
    width?: string;
    size?: 'sm' | 'md';
}>(), {
    placeholder: '검색...',
    width: 'auto',
    size: 'md',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

/** 포커스 상태 — is-focus 클래스 토글에 사용 */
const focused = ref(false);

/** 입력값 변경 이벤트 처리 */
const onInput = (e: Event) => {
    emit('update:modelValue', (e.target as HTMLInputElement).value);
};

/** 검색어 초기화 */
const clearValue = () => {
    emit('update:modelValue', '');
};
</script>

<template>
    <div
        class="gsearch"
        :class="{ 'is-focus': focused, 'gsearch-sm': size === 'sm' }"
        :style="width !== 'auto' ? { width } : {}"
    >
        <!-- 검색 아이콘 -->
        <i class="pi pi-search" />

        <!-- 텍스트 인풋 -->
        <input
            :value="props.modelValue"
            :placeholder="props.placeholder"
            class="gsearch-input"
            @input="onInput"
            @focus="focused = true"
            @blur="focused = false"
        />

        <!-- 초기화 버튼 (입력값 있을 때만 표시) -->
        <button
            v-if="props.modelValue"
            type="button"
            class="gs-clear"
            title="지우기"
            @click="clearValue"
        >
            <i class="pi pi-times" />
        </button>
    </div>
</template>
