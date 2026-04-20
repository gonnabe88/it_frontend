<!--
================================================================================
[components/budget/BudgetSummaryCards.vue] 예산 현황 요약 카드 컴포넌트
================================================================================
정보화사업 + 전산업무비 + 경상사업 예산 현황을 4개의 카드로 요약 표시합니다.

[카드 구성]
  ① 전체 예산 합계: 정보화사업 + 전산업무비 + 경상사업 합산 (인디고 그라디언트)
  ② 정보화사업:     자본예산 / 일반관리비 세부 표시 (인디고 테마)
  ③ 전산업무비:     비목별(전산임차료/전산용역비/전산여비/전산제비) 세부 표시 (에메랄드 테마)
  ④ 경상사업:       자본예산 / 일반관리비 세부 표시 (앰버 테마)

[사용처]
  - pages/budget/list.vue
  - pages/budget/approval.vue

[Props]
  - projects:     정보화사업 목록 (Project[])
  - costs:        전산업무비 목록 (ItCost[])
  - ordinary:     경상사업 목록 (Project[], optional)
  - selectedUnit: 현재 선택된 예산 단위 ('원' | '천원' | '백만원' | '억원')
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Project } from '~/composables/useProjects';
import type { ItCost } from '~/composables/useCost';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

const props = withDefaults(defineProps<{
    /** 정보화사업 목록 */
    projects: Project[];
    /** 전산업무비 목록 */
    costs: ItCost[];
    /** 경상사업 목록 (optional) */
    ordinary?: Project[];
    /** 현재 선택된 예산 단위 */
    selectedUnit: string;
}>(), {
    ordinary: () => []
});

/**
 * 예산 금액을 선택된 단위로 변환
 * @param amount - 원(KRW) 단위 금액
 */
const fmt = (amount: number) => formatBudgetUtil(amount, props.selectedUnit);

/* ── 정보화사업 합계 ── */
/** 정보화사업 예산 합계 (원 단위) */
const totalProjectBudget = computed(() =>
    props.projects.reduce((sum, p) => sum + (p.prjBg || 0), 0)
);
/** 정보화사업 자본예산 합계 (원 단위) */
const totalProjectAssetBg = computed(() =>
    props.projects.reduce((sum, p) => sum + (p.assetBg || 0), 0)
);
/** 정보화사업 일반관리비 합계 (원 단위) */
const totalProjectCostBg = computed(() =>
    props.projects.reduce((sum, p) => sum + (p.costBg || 0), 0)
);

/* ── 전산업무비 합계 ── */
/** 전산업무비 예산 합계 (원 단위) */
const totalCostBudget = computed(() =>
    props.costs.reduce((sum, c) => sum + (c.itMngcBg || 0), 0)
);

/**
 * 전산업무비 비목(ioeNm)별 합계
 * 예: { '전산임차료': 120000000, '전산용역비': 80000000, ... }
 */
const costByCategory = computed(() => {
    const map: Record<string, number> = {};
    props.costs.forEach(c => {
        const key = c.ioeC || '기타';
        map[key] = (map[key] || 0) + (c.itMngcBg || 0);
    });
    return map;
});

/** 전산업무비 비목별 표시 색상 매핑 */
const costCategoryColors: Record<string, { bar: string }> = {
    '전산임차료': { bar: 'bg-teal-500' },
    '전산용역비': { bar: 'bg-cyan-500' },
    '전산여비':   { bar: 'bg-sky-500' },
    '전산제비':   { bar: 'bg-violet-500' }
};

/** 비목 고정 표시 순서 */
const costCategoryOrder = ['전산임차료', '전산용역비', '전산여비', '전산제비'];

/**
 * 비목 색상 조회 헬퍼
 * 매핑에 없는 비목은 기본 회색으로 처리합니다.
 */
const getCostCatBar = (cat: string) =>
    costCategoryColors[cat]?.bar ?? 'bg-zinc-400';

/* ── 경상사업 합계 ── */
/** 경상사업 예산 합계 (원 단위) */
const totalOrdinaryBudget = computed(() =>
    props.ordinary.reduce((sum, p) => sum + (p.prjBg || 0), 0)
);
/** 경상사업 자본예산 합계 (원 단위) */
const totalOrdinaryAssetBg = computed(() =>
    props.ordinary.reduce((sum, p) => sum + (p.assetBg || 0), 0)
);
/** 경상사업 일반관리비 합계 (원 단위) */
const totalOrdinaryCostBg = computed(() =>
    props.ordinary.reduce((sum, p) => sum + (p.costBg || 0), 0)
);

/** 전체 예산 합계 (정보화사업 + 전산업무비 + 경상사업) */
const grandTotal = computed(() =>
    totalProjectBudget.value + totalCostBudget.value + totalOrdinaryBudget.value
);
/** 전체 건수 */
const grandCount = computed(() =>
    props.projects.length + props.costs.length + props.ordinary.length
);
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        <!-- ① 전체 예산 합계 카드 (인디고 그라디언트) -->
        <div
            class="p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-2xl border border-indigo-100 dark:border-zinc-700 shadow-sm relative overflow-hidden">
            <div class="absolute -right-6 -top-6 w-28 h-28 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl"/>
            <!-- 메인 합계 -->
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div
                        class="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <i class="pi pi-chart-bar text-indigo-600 dark:text-indigo-400 text-lg"/>
                    </div>
                    <span
                        class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">전체 예산 합계</span>
                    <span class="ml-auto text-xs text-zinc-400">{{ grandCount }}건</span>
                </div>
                <div class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {{ fmt(grandTotal) }}
                    <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                </div>
            </div>
            <!-- 내부 세부: 정보화사업 / 전산업무비 / 경상사업 -->
            <div
                class="relative z-10 mt-4 pt-4 border-t border-indigo-100 dark:border-zinc-700 grid grid-cols-3 gap-3">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-8 rounded-full bg-indigo-500 shrink-0"/>
                    <div class="min-w-0">
                        <div class="text-[10px] text-zinc-400 font-medium mb-0.5 truncate">정보화사업</div>
                        <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {{ fmt(totalProjectBudget) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-8 rounded-full bg-emerald-500 shrink-0"/>
                    <div class="min-w-0">
                        <div class="text-[10px] text-zinc-400 font-medium mb-0.5 truncate">전산업무비</div>
                        <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {{ fmt(totalCostBudget) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-8 rounded-full bg-amber-500 shrink-0"/>
                    <div class="min-w-0">
                        <div class="text-[10px] text-zinc-400 font-medium mb-0.5 truncate">경상사업</div>
                        <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {{ fmt(totalOrdinaryBudget) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ② 정보화사업 카드 (인디고 테마) -->
        <div
            class="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
            <div class="absolute -right-6 -top-6 w-28 h-28 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl"/>
            <!-- 메인 합계 -->
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div
                        class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                        <i class="pi pi-desktop text-indigo-600 dark:text-indigo-400 text-lg"/>
                    </div>
                    <span
                        class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">정보화사업</span>
                    <span class="ml-auto text-xs text-zinc-400">{{ projects.length }}건</span>
                </div>
                <div class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {{ fmt(totalProjectBudget) }}
                    <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                </div>
            </div>
            <!-- 내부 세부: 자본예산 / 일반관리비 -->
            <div
                class="relative z-10 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                <div class="flex items-center gap-2.5">
                    <div class="w-1.5 h-8 rounded-full bg-blue-500"/>
                    <div>
                        <div class="text-[11px] text-zinc-400 font-medium">자본예산</div>
                        <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {{ fmt(totalProjectAssetBg) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2.5">
                    <div class="w-1.5 h-8 rounded-full bg-sky-500"/>
                    <div>
                        <div class="text-[11px] text-zinc-400 font-medium">일반관리비</div>
                        <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {{ fmt(totalProjectCostBg) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ③ 전산업무비 카드 (에메랄드 테마) -->
        <div
            class="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
            <div
                class="absolute -right-6 -top-6 w-28 h-28 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-2xl"/>
            <!-- 메인 합계 -->
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div
                        class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <i class="pi pi-wallet text-emerald-600 dark:text-emerald-400 text-lg"/>
                    </div>
                    <span
                        class="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">전산업무비</span>
                    <span class="ml-auto text-xs text-zinc-400">{{ costs.length }}건</span>
                </div>
                <div class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {{ fmt(totalCostBudget) }}
                    <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                </div>
            </div>
            <!-- 내부 세부: 비목별 4칸 -->
            <div
                class="relative z-10 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-4 gap-4">
                <div v-for="cat in costCategoryOrder" :key="cat" class="flex items-center gap-2.5">
                    <div class="w-1.5 h-8 rounded-full" :class="getCostCatBar(cat)"/>
                    <div class="min-w-0">
                        <div class="text-[11px] text-zinc-400 font-medium truncate">{{ cat }}</div>
                        <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {{ fmt(costByCategory[cat] || 0) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ④ 경상사업 카드 (앰버 테마) -->
        <div
            class="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
            <div
                class="absolute -right-6 -top-6 w-28 h-28 bg-amber-100 dark:bg-amber-900/20 rounded-full blur-2xl"/>
            <!-- 메인 합계 -->
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div
                        class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                        <i class="pi pi-briefcase text-amber-600 dark:text-amber-400 text-lg"/>
                    </div>
                    <span
                        class="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">경상사업</span>
                    <span class="ml-auto text-xs text-zinc-400">{{ ordinary.length }}건</span>
                </div>
                <div class="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {{ fmt(totalOrdinaryBudget) }}
                    <span class="text-sm font-normal text-zinc-500">{{ selectedUnit }}</span>
                </div>
            </div>
            <!-- 내부 세부: 자본예산 / 일반관리비 -->
            <div
                class="relative z-10 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                <div class="flex items-center gap-2.5">
                    <div class="w-1.5 h-8 rounded-full bg-amber-500"/>
                    <div>
                        <div class="text-[11px] text-zinc-400 font-medium">자본예산</div>
                        <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {{ fmt(totalOrdinaryAssetBg) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2.5">
                    <div class="w-1.5 h-8 rounded-full bg-orange-400"/>
                    <div>
                        <div class="text-[11px] text-zinc-400 font-medium">일반관리비</div>
                        <div class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {{ fmt(totalOrdinaryCostBg) }}{{ selectedUnit }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>
