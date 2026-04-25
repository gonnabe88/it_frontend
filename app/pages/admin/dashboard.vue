<!--
================================================================================
[pages/admin/dashboard.vue] 관리자 대시보드 페이지
================================================================================
시스템관리자의 진입점 화면입니다.

[주요 기능]
  - 접속자 수 추이 차트: 최근 30일 일별 로그인 성공 건수 (라인 차트)
  - 서버 자원 사용량: 차기 반영 예정 플레이스홀더
  - 요약 통계 카드: 총 사용자 수, 오늘 로그인 건수

[Design Ref: §3.7 — 대시보드 화면, PrimeVue Chart 컴포넌트]
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useAdminApi } from '~/composables/useAdminApi';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchLoginStats, fetchUsers } = useAdminApi();

// 일별 로그인 통계 + 전체 사용자 수
const [{ data: stats }, { data: users }] = await Promise.all([
    fetchLoginStats(),
    fetchUsers(),
]);

/**
 * PrimeVue Chart 라인 차트 데이터 변환
 * Design Ref: §3.7 — chart.js 데이터 형식
 */
const chartData = computed(() => ({
    labels: stats.value?.map(s => s.date) ?? [],
    datasets: [
        {
            label: '로그인 성공 건수',
            data: stats.value?.map(s => s.count) ?? [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
        },
    ],
}));

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 10 },
        },
        y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
        },
    },
};

/** 오늘 로그인 건수 (stats 마지막 항목) */
const todayCount = computed(() => {
    if (!stats.value?.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return stats.value.find(s => s.date === today)?.count ?? 0;
});

/** 전체 사용자 수 */
const totalUsers = computed(() => users.value?.length ?? 0);

/** 오늘 로그인 비율: 전체 사용자 대비 */
const todayLoginPct = computed(() => {
    if (!totalUsers.value) return 0;
    return Math.min(Math.round(todayCount.value / totalUsers.value * 100), 100);
});
</script>

<template>
    <div class="flex flex-col gap-6">
        <!-- 요약 통계 카드 (V4: 아이콘 배지 + 내러티브 + 세그먼트 분해) -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <!-- 전체 사용자 -->
            <div class="bg-white rounded-[14px] border border-zinc-200 p-5 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none" style="background:#dbeafe; color:#1d4ed8">
                        <i class="pi pi-users" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">전체 사용자</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-[36px] font-bold text-zinc-900 leading-none tracking-[-0.03em] tabular-nums">{{ totalUsers.toLocaleString() }}</span>
                    <span class="text-xs text-zinc-400">명 · 등록 사용자</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 flex">
                    <span class="h-full" style="width:100%; background:#3b82f6" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm" style="background:#3b82f6" />전체 현황</span>
                </div>
            </div>

            <!-- 오늘 로그인 -->
            <div class="bg-white rounded-[14px] border border-zinc-200 p-5 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none" style="background:#d1fae5; color:#047857">
                        <i class="pi pi-sign-in" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">오늘 로그인</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-[36px] font-bold text-zinc-900 leading-none tracking-[-0.03em] tabular-nums">{{ todayCount.toLocaleString() }}</span>
                    <span class="text-xs text-zinc-400">건 · 금일 누적</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 flex">
                    <span class="h-full" :style="`width:${todayLoginPct}%; background:#10b981`" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm" style="background:#10b981" />전체 사용자 대비 {{ todayLoginPct }}%</span>
                </div>
            </div>

            <!-- 최근 30일 로그인 추이 -->
            <div class="bg-white rounded-[14px] border border-zinc-200 p-5 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-300 hover:shadow-md col-span-2">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none" style="background:#fef3c7; color:#b45309">
                        <i class="pi pi-chart-line" />
                    </span>
                    <span class="text-[13px] font-medium text-zinc-600">최근 30일 로그인 추이</span>
                </div>
                <div class="flex items-baseline gap-2">
                    <span class="text-[36px] font-bold text-zinc-900 leading-none tracking-[-0.03em] tabular-nums">{{ stats?.length ?? 0 }}</span>
                    <span class="text-xs text-zinc-400">일 · 아래 차트 참조</span>
                </div>
                <div class="h-[6px] rounded-full overflow-hidden bg-zinc-100 flex">
                    <span class="h-full" style="width:100%; background:#f59e0b" />
                </div>
                <div class="flex gap-3.5 text-[11px] text-zinc-400 tabular-nums">
                    <span class="inline-flex items-center gap-1.5"><i class="inline-block w-2 h-2 rounded-sm" style="background:#f59e0b" />로그인 성공 기준</span>
                </div>
            </div>
        </div>

        <!-- 접속자 수 추이 차트 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card class="shadow-sm lg:col-span-2">
                <template #title>
                    <span class="text-base font-semibold text-zinc-700 dark:text-zinc-200">
                        접속자 수 추이 (최근 30일)
                    </span>
                </template>
                <template #content>
                    <div v-if="stats && stats.length > 0" class="h-64">
                        <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
                    </div>
                    <div v-else class="h-64 flex items-center justify-center text-zinc-400 text-sm">
                        로그인 이력 데이터가 없습니다.
                    </div>
                </template>
            </Card>

            <!-- 서버 자원 사용량 — 차기 반영 예정 -->
            <Card class="shadow-sm">
                <template #title>
                    <span class="text-base font-semibold text-zinc-700 dark:text-zinc-200">서버 자원 사용량</span>
                </template>
                <template #content>
                    <div class="h-40 flex items-center justify-center">
                        <p class="text-zinc-400 text-sm">준비 중 (차기 반영 예정)</p>
                    </div>
                </template>
            </Card>

            <!-- 시스템 공지 — 차기 반영 예정 -->
            <Card class="shadow-sm">
                <template #title>
                    <span class="text-base font-semibold text-zinc-700 dark:text-zinc-200">시스템 공지</span>
                </template>
                <template #content>
                    <div class="h-40 flex items-center justify-center">
                        <p class="text-zinc-400 text-sm">준비 중 (차기 반영 예정)</p>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
