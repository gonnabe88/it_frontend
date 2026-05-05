<!--
================================================================================
[components/common/PageHeader.vue] 페이지 표준 헤더
================================================================================
모든 페이지 최상단의 타이틀 + 액션 영역을 표준화합니다.

[Props]
  title?   : 페이지 제목 (h1, text-2xl font-bold text-zinc-900). #title 슬롯 사용 시 생략 가능.
  subtitle?: 부제목 설명 텍스트

[Slots]
  leading : 좌측 보조 영역 (뒤로가기 버튼, 브레드크럼, 메타 배지 등). 선택.
  title   : h1 자체를 직접 작성할 때 사용 (version Tag inline 등 복합 마크업). title prop보다 우선.
  actions : 우측 액션 버튼들. 선택.
================================================================================
-->
<script setup lang="ts">
defineProps<{
    title?: string;
    subtitle?: string;
}>();
</script>

<template>
    <div class="flex items-center justify-between gap-4 flex-wrap mb-6">
        <!-- 좌측: leading(선택) + title/subtitle -->
        <div class="flex items-center gap-3 min-w-0">
            <slot name="leading" />
            <div class="min-w-0">
                <!-- #title 슬롯이 제공되면 h1 자리를 슬롯 콘텐츠로 대체 -->
                <slot name="title">
                    <h1 v-if="title" class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
                </slot>
                <p v-if="subtitle" class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{{ subtitle }}</p>
            </div>
        </div>
        <!-- 우측: actions -->
        <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
            <slot name="actions" />
        </div>
    </div>
</template>
