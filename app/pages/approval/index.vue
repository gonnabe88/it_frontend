<script setup lang="ts">
/**
 * ============================================================================
 * [전자결재 Home 대시보드]
 * ----------------------------------------------------------------------------
 * 로그인 사용자의 부서(bbrC) + 사원번호(eno) 기준으로 전자결재 현황과
 * 본인 결재 대기 목록을 한눈에 보여주는 메인 대시보드 페이지입니다.
 *
 * [구성]
 *  1) KPI 카드 4종 (결재 대기 / 진행 중 / 당월 완료 / 반려)
 *  2) 월별 결재 완료 추이 (최근 6개월, 순수 CSS 막대 차트 — Chart.js 미사용)
 *  3) 내 결재 대기 목록 (최대 5건, 항목 클릭 시 결재 상세 페이지로 이동)
 *  4) 하단 [전체 목록 보기] 버튼
 *
 * [데이터 소스]
 *  - useApprovalDashboard() composable → /api/applications/dashboard
 * ============================================================================
 */
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';

definePageMeta({ layout: 'default' });

// 대시보드 집계 데이터 조회 (bbrC, eno는 composable 내부에서 자동 주입)
const { data, pending } = useApprovalDashboard();

// 월별 차트 최대 막대 높이(px) — CSS 막대 차트 렌더링 기준값
const maxBarHeight = 120;

/**
 * 월별 결재 완료 추이에서 최대 건수 계산
 * 모든 막대 높이 비율의 기준값입니다. 데이터가 없거나 모두 0일 경우 1을 반환하여
 * 0으로 나누는 오류를 방지합니다.
 */
const maxMonthlyCount = computed<number>(() => {
    const trend = data.value?.monthlyTrend ?? [];
    if (trend.length === 0) return 1;
    const max = Math.max(...trend.map((m) => m.count));
    return max > 0 ? max : 1;
});

/**
 * 특정 월 건수를 픽셀 높이로 변환
 * - 0건: 4px (최소 가시성 유지)
 * - 그 외: (count / max) * maxBarHeight
 */
const barHeight = (count: number): string => {
    if (count <= 0) return '4px';
    const ratio = count / maxMonthlyCount.value;
    const height = Math.max(4, Math.round(ratio * maxBarHeight));
    return `${height}px`;
};

/**
 * 본인 결재 대기 목록 상위 5건만 노출
 */
const topPending = computed(() => {
    const list = data.value?.pendingList ?? [];
    return list.slice(0, 5);
});

/**
 * 요청 일시를 YYYY-MM-DD 형식으로 변환
 * ISO 8601 문자열을 가볍게 슬라이싱 (시간대 변환 없이 표시용)
 */
const formatDate = (iso: string): string => {
    if (!iso) return '-';
    return iso.slice(0, 10);
};

/**
 * 긴급도 배지 스타일 매핑
 * urgent: 빨간색 / normal: 회색
 */
const urgencyBadgeClass = (urgency: 'urgent' | 'normal'): string => {
    if (urgency === 'urgent') {
        return 'bg-red-100 text-red-700 border border-red-200';
    }
    return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
};

const urgencyLabel = (urgency: 'urgent' | 'normal'): string => {
    return urgency === 'urgent' ? '긴급' : '일반';
};

/**
 * 결재 상세 페이지로 이동
 */
const goDetail = (apfMngNo: string): void => {
    navigateTo(`/approval/${apfMngNo}`);
};

/**
 * 전체 결재 목록 페이지로 이동
 */
const goList = (): void => {
    navigateTo('/approval/list');
};

/** V4 세그먼트 바: 결재 상태 합계 대비 각 비율 계산 */
const approvalTotal = computed(() =>
    (data.value?.pendingCount ?? 0) +
    (data.value?.inProgressCount ?? 0) +
    (data.value?.monthlyCompletedCount ?? 0) +
    (data.value?.rejectedCount ?? 0)
);
const toPct = (n: number): number => {
    const t = approvalTotal.value;
    return t > 0 ? Math.round(n / t * 100) : 0;
};
</script>

<template>
    <div class="space-y-6">
        <PageHeader title="전자결재 현황" subtitle="내 결재 대기 목록과 부서 결재 처리 현황을 확인합니다.">
            <template #actions>
                <Button icon="pi pi-list" label="전체 목록" severity="secondary" outlined @click="goList" />
            </template>
        </PageHeader>

        <!-- KPI 카드 4종 (V4: 아이콘 배지 + 내러티브 + 세그먼트 분해) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <!-- 결재 대기 -->
            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none bg-amber-100 text-amber-700">
                        <i class="pi pi-inbox" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">결재 대기</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <Skeleton v-if="pending" width="4rem" height="2.25rem" />
                    <span v-else class="text-[36px] font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums">{{ data?.pendingCount ?? 0 }}</span>
                    <span class="text-xs text-zinc-400">건 · 즉시 처리 필요</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                    <span class="h-full bg-amber-500" :style="{ width: `${toPct(data?.pendingCount ?? 0)}%` }" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm bg-amber-500" />전체 대비 {{ toPct(data?.pendingCount ?? 0) }}%</span>
                </div>
            </div>

            <!-- 결재 진행 중 -->
            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none bg-blue-100 text-blue-700">
                        <i class="pi pi-spinner" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">결재 진행 중</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <Skeleton v-if="pending" width="4rem" height="2.25rem" />
                    <span v-else class="text-[36px] font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums">{{ data?.inProgressCount ?? 0 }}</span>
                    <span class="text-xs text-zinc-400">건 · 결재 단계 처리</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                    <span class="h-full bg-blue-500" :style="{ width: `${toPct(data?.inProgressCount ?? 0)}%` }" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm bg-blue-500" />전체 대비 {{ toPct(data?.inProgressCount ?? 0) }}%</span>
                </div>
            </div>

            <!-- 당월 완료 -->
            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none bg-emerald-100 text-emerald-700">
                        <i class="pi pi-check-circle" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">당월 완료</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <Skeleton v-if="pending" width="4rem" height="2.25rem" />
                    <span v-else class="text-[36px] font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums">{{ data?.monthlyCompletedCount ?? 0 }}</span>
                    <span class="text-xs text-zinc-400">건 · 이번 달 누적</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                    <span class="h-full bg-emerald-500" :style="{ width: `${toPct(data?.monthlyCompletedCount ?? 0)}%` }" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm bg-emerald-500" />전체 대비 {{ toPct(data?.monthlyCompletedCount ?? 0) }}%</span>
                </div>
            </div>

            <!-- 반려 -->
            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none bg-red-100 text-red-700">
                        <i class="pi pi-times-circle" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">반려</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <Skeleton v-if="pending" width="4rem" height="2.25rem" />
                    <span v-else class="text-[36px] font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums">{{ data?.rejectedCount ?? 0 }}</span>
                    <span class="text-xs text-zinc-400">건 · 당월 누적</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
                    <span class="h-full bg-red-500" :style="{ width: `${toPct(data?.rejectedCount ?? 0)}%` }" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm bg-red-500" />전체 대비 {{ toPct(data?.rejectedCount ?? 0) }}%</span>
                </div>
            </div>
        </div>

        <!-- 월별 결재 완료 추이 + 내 결재 대기 목록 (같은 Row) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <!-- 월별 결재 완료 추이 (순수 CSS 막대 차트) -->
            <div class="bg-white rounded-xl border border-zinc-200 p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-zinc-900">월별 결재 완료 추이</h2>
                    <span class="text-xs text-zinc-400">최근 6개월</span>
                </div>

                <!-- 로딩 스켈레톤 -->
                <div v-if="pending" class="flex items-end justify-around gap-3 h-40">
                    <Skeleton v-for="n in 6" :key="n" width="2.5rem" :height="`${40 + n * 10}px`" />
                </div>

                <!-- 실제 차트 -->
                <div v-else-if="data && data.monthlyTrend.length > 0" class="flex items-end justify-around gap-3 pt-4">
                    <div
                        v-for="m in data.monthlyTrend"
                        :key="m.month"
                        class="flex flex-col items-center flex-1 min-w-0"
                    >
                        <!-- 막대 위 건수 표시 -->
                        <div class="text-xs font-medium text-zinc-700 mb-1">{{ m.count }}</div>
                        <!-- CSS 막대: 높이는 최대값 대비 비율로 계산 -->
                        <div
                            class="w-full max-w-[48px] rounded-t-md bg-gradient-to-b from-emerald-500 to-emerald-700 transition-all hover:from-emerald-600 hover:to-emerald-800"
                            :style="{ height: barHeight(m.count) }"
                            :title="`${m.month}: ${m.count}건`"
                        />
                        <!-- 월 레이블 -->
                        <div class="text-xs text-zinc-500 mt-2 whitespace-nowrap">{{ m.month }}</div>
                    </div>
                </div>

                <!-- 빈 상태 -->
                <div v-else class="h-40 flex items-center justify-center text-sm text-zinc-400">
                    <i class="pi pi-chart-bar mr-2" />
                    표시할 월별 데이터가 없습니다.
                </div>
            </div>

            <!-- 내 결재 대기 목록 (최대 5건) -->
            <div class="bg-white rounded-xl border border-zinc-200 p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-zinc-900">내 결재 대기 목록</h2>
                    <span class="text-xs text-zinc-400">최대 5건</span>
                </div>

                <!-- 로딩 스켈레톤 5행 -->
                <div v-if="pending" class="space-y-3">
                    <div
                        v-for="n in 5"
                        :key="n"
                        class="flex items-center gap-4 p-3 border border-zinc-100 rounded-lg"
                    >
                        <Skeleton shape="circle" size="2.5rem" />
                        <div class="flex-1 space-y-2">
                            <Skeleton width="60%" height="1rem" />
                            <Skeleton width="40%" height="0.75rem" />
                        </div>
                        <Skeleton width="4rem" height="1.5rem" />
                    </div>
                </div>

                <!-- 실제 목록 -->
                <ul v-else-if="topPending.length > 0" class="divide-y divide-zinc-100">
                    <li
                        v-for="item in topPending"
                        :key="item.apfMngNo"
                        class="py-3 flex items-center gap-4 cursor-pointer hover:bg-zinc-50 rounded-lg px-3 -mx-3 transition-colors"
                        @click="goDetail(item.apfMngNo)"
                    >
                        <!-- 결재 아이콘 -->
                        <div class="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                            <i class="pi pi-send" />
                        </div>

                        <!-- 본문 영역 -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-mono text-zinc-400">{{ item.apfMngNo }}</span>
                            </div>
                            <div class="text-sm font-medium text-zinc-900 truncate">{{ item.title }}</div>
                            <div class="text-xs text-zinc-500 mt-0.5">
                                <i class="pi pi-user text-[10px] mr-1" />{{ item.requesterName }}
                                <span class="mx-1.5 text-zinc-300">·</span>
                                <i class="pi pi-calendar text-[10px] mr-1" />{{ formatDate(item.requestedAt) }}
                            </div>
                        </div>

                        <!-- 긴급도 배지 -->
                        <span
                            class="px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                            :class="urgencyBadgeClass(item.urgency)"
                        >
                            {{ urgencyLabel(item.urgency) }}
                        </span>

                        <i class="pi pi-angle-right text-zinc-300 shrink-0" />
                    </li>
                </ul>

                <!-- 빈 상태 -->
                <div v-else class="py-10 flex flex-col items-center justify-center text-zinc-400">
                    <i class="pi pi-inbox text-3xl mb-2" />
                    <span class="text-sm">결재 대기 중인 항목이 없습니다</span>
                </div>
            </div>

        </div>

        <!-- 하단 전체 목록 보기 버튼 -->
        <div class="flex justify-center pt-2">
            <Button
                label="전체 목록 보기"
                icon="pi pi-arrow-right"
                icon-pos="right"
                @click="goList"
            />
        </div>
    </div>
</template>
