<!--
================================================================================
[components/common/TableCard.vue] 테이블 표준 카드 래퍼
================================================================================
StyledDataTable을 감싸는 표준 카드 컨테이너.
페이지 배경과 테이블 영역을 시각적으로 구분합니다.

[Props]
  title?    : 카드 상단 타이틀 (없으면 헤더 영역 미표시)
  subtitle? : 부제목 설명 텍스트
  icon?     : PrimeVue 아이콘 클래스 (e.g. 'pi-briefcase') — 인디고 배경 아이콘 박스로 렌더링
  count?    : 건수 배지 (undefined 시 미표시)
  fill?     : 화면 채움 모드 — flex-1 min-h-0 flex flex-col 적용 (scroll-height="flex"와 함께 사용)

[Slots]
  default  : StyledDataTable 등 테이블 컴포넌트
  actions  : 카드 헤더 우측 액션 버튼 영역 (헤더가 표시될 때만 렌더링)
  toolbar  : 헤더 아래 컨트롤 툴바 — border-b 구분선 자동 래핑
================================================================================
-->
<script setup lang="ts">
defineProps<{
    title?: string;
    subtitle?: string;
    /** PrimeVue 아이콘 클래스 (pi 접두사 포함, e.g. 'pi-briefcase') */
    icon?: string;
    /** 건수 배지 숫자 (undefined 시 미표시) */
    count?: number;
    /** 화면 채움 모드: flex-1 min-h-0 flex flex-col 적용 (scroll-height="flex"와 함께 사용) */
    fill?: boolean;
}>();
</script>

<template>
    <div :class="['bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden', fill && 'flex-1 min-h-0 flex flex-col']">

        <!-- 카드 헤더: 아이콘 + 타이틀 + 건수 배지 (좌) / 액션 버튼 (우) -->
        <div v-if="title || icon || $slots.actions" class="flex items-center justify-between px-6 py-4 shrink-0">
            <div class="flex items-center gap-3">
                <!-- 아이콘 박스 -->
                <div v-if="icon" class="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <i :class="`pi ${icon} text-indigo-600 dark:text-indigo-400 text-base`"/>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h2 v-if="title" class="text-base font-semibold text-zinc-800 dark:text-zinc-200">{{ title }}</h2>
                        <span v-if="count !== undefined" class="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{{ count }}건</span>
                    </div>
                    <p v-if="subtitle" class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{{ subtitle }}</p>
                </div>
            </div>
            <div v-if="$slots.actions" class="flex items-center gap-2">
                <slot name="actions" />
            </div>
        </div>

        <!-- 컨트롤 툴바 슬롯 (border-b 자동 래핑) -->
        <div v-if="$slots.toolbar" class="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <slot name="toolbar" />
        </div>

        <slot />
    </div>
</template>
