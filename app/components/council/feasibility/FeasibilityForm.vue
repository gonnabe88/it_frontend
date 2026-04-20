<!--
================================================================================
[components/council/feasibility/FeasibilityForm.vue]
타당성검토표 전체 폼 래퍼 컴포넌트
================================================================================
FeasibilityOverview + FeasibilityChecklist + FeasibilityPerformance 세 섹션을
하나의 래퍼로 조합합니다.

[사용처]
  - pages/info/council/[id].vue          : 편집 모드 (readonly=false)
  - pages/info/council/prepare/[id].vue  : 조회 전용 (readonly=true)
  - pages/info/council/result/[id].vue   : 조회 전용 (readonly=true)

[Props]
  modelValue : FeasibilityData (v-model)
  readonly   : 읽기 전용 여부

[Design Ref: §3.2 FeasibilityForm.vue — 타당성검토표 래퍼 컴포넌트]
================================================================================
-->
<script setup lang="ts">
import type { FeasibilityData } from '~/types/council';

interface Props {
    /** 타당성검토표 전체 데이터 (v-model) */
    modelValue: FeasibilityData;
    /** 읽기 전용 여부 */
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: FeasibilityData): void;
}>();
</script>

<template>
    <div class="space-y-6">

        <!--
            ── 섹션 1: 사업 개요 ──
            Design Ref: §4.2 [id].vue — 사업 개요 섹션
        -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">사업 개요</h2>
            </div>
            <div class="p-5">
                <CouncilFeasibilityOverview
                    :model-value="modelValue"
                    :readonly="readonly"
                    @update:model-value="emit('update:modelValue', $event)"
                />
            </div>
        </div>

        <!--
            ── 섹션 2: 타당성 자체점검 ──
            Design Ref: §4.2 [id].vue — 타당성 자체점검 섹션
        -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">타당성 자체점검</h2>
                <span class="text-xs text-zinc-400 dark:text-zinc-500">(6개 항목 · 1~5점)</span>
            </div>
            <div class="p-5">
                <CouncilFeasibilityChecklist
                    :model-value="modelValue.checkItems"
                    :readonly="readonly"
                    @update:model-value="emit('update:modelValue', { ...modelValue, checkItems: $event })"
                />
            </div>
        </div>

        <!--
            ── 섹션 3: 성과관리 자체계획 ──
            Design Ref: §4.2 [id].vue — 성과관리 자체계획 섹션
        -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">3</span>
                <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">성과관리 자체계획</h2>
                <span class="text-xs text-zinc-400 dark:text-zinc-500">(1개 이상)</span>
            </div>
            <div class="p-5">
                <CouncilFeasibilityPerformance
                    :model-value="modelValue.performances"
                    :readonly="readonly"
                    @update:model-value="emit('update:modelValue', { ...modelValue, performances: $event })"
                />
            </div>
        </div>

    </div>
</template>
