<!--
================================================================================
[components/common/TableCard.vue] 테이블 표준 카드 래퍼
================================================================================
StyledDataTable을 감싸는 표준 카드 컨테이너.
페이지 배경과 테이블 영역을 시각적으로 구분합니다.

[Props]
  title?    : 카드 상단 타이틀 (없으면 헤더 영역 미표시)
  subtitle? : 부제목 설명 텍스트

[Slots]
  default : StyledDataTable 등 테이블 컴포넌트
  actions : 카드 상단 우측 액션 버튼 영역 (title 또는 actions 슬롯 있을 때만 헤더 표시)
================================================================================
-->
<script setup lang="ts">
defineProps<{
    title?: string;
    subtitle?: string;
    /** 화면 채움 모드: flex-1 min-h-0 flex flex-col 적용 (scroll-height="flex"와 함께 사용) */
    fill?: boolean;
}>();
</script>

<template>
    <div :class="['bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden', fill && 'flex-1 min-h-0 flex flex-col']">
        <div v-if="title || $slots.actions" class="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div>
                <h2 v-if="title" class="text-base font-semibold text-zinc-800 dark:text-zinc-200">{{ title }}</h2>
                <p v-if="subtitle" class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{{ subtitle }}</p>
            </div>
            <div v-if="$slots.actions" class="flex items-center gap-2">
                <slot name="actions" />
            </div>
        </div>
        <slot />
    </div>
</template>
