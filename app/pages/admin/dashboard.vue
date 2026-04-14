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
</script>

<template>
    <div class="flex flex-col gap-6">
        <!-- 요약 통계 카드 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card class="shadow-sm">
                <template #content>
                    <div class="flex items-center gap-3">
                        <div class="rounded-full bg-blue-100 dark:bg-blue-900 p-3">
                            <i class="pi pi-users text-blue-600 dark:text-blue-300 text-xl" />
                        </div>
                        <div>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400">전체 사용자</p>
                            <p class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{{ totalUsers.toLocaleString() }}</p>
                        </div>
                    </div>
                </template>
            </Card>

            <Card class="shadow-sm">
                <template #content>
                    <div class="flex items-center gap-3">
                        <div class="rounded-full bg-green-100 dark:bg-green-900 p-3">
                            <i class="pi pi-sign-in text-green-600 dark:text-green-300 text-xl" />
                        </div>
                        <div>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400">오늘 로그인</p>
                            <p class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{{ todayCount.toLocaleString() }}</p>
                        </div>
                    </div>
                </template>
            </Card>

            <Card class="shadow-sm col-span-2">
                <template #content>
                    <div class="flex items-center gap-3">
                        <div class="rounded-full bg-amber-100 dark:bg-amber-900 p-3">
                            <i class="pi pi-chart-line text-amber-600 dark:text-amber-300 text-xl" />
                        </div>
                        <div>
                            <p class="text-sm text-zinc-500 dark:text-zinc-400">최근 30일 로그인 추이</p>
                            <p class="text-sm text-zinc-600 dark:text-zinc-300">아래 차트 참조</p>
                        </div>
                    </div>
                </template>
            </Card>
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
