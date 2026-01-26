<script setup lang="ts">
const title = '정보화사업 홈';
definePageMeta({
    title
});
</script>
<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">정보화 대시보드</h1>
            <div class="flex gap-2">
                <Button label="사업 등록" icon="pi pi-plus" size="small" />
                <Button label="보고서 다운로드" icon="pi pi-download" severity="secondary" size="small" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-zinc-500 font-medium">진행중인 사업</span>
                    <i class="pi pi-briefcase text-primary-500 bg-primary-50 p-2 rounded-lg"></i>
                </div>
                <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">12</div>
                <div class="mt-2 text-sm text-green-600 flex items-center">
                    <i class="pi pi-arrow-up text-xs mr-1"></i>
                    <span>전월 대비 2건 증가</span>
                </div>
            </div>
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-zinc-500 font-medium">금년 집행 예산</span>
                    <i class="pi pi-wallet text-indigo-500 bg-indigo-50 p-2 rounded-lg"></i>
                </div>
                <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">8.4억</div>
                <div class="mt-2 text-sm text-zinc-500">
                    <span>전체 예산의 42%</span>
                </div>
            </div>
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-zinc-500 font-medium">접수된 요청</span>
                    <i class="pi pi-inbox text-orange-500 bg-orange-50 p-2 rounded-lg"></i>
                </div>
                <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">5</div>
                <div class="mt-2 text-sm text-orange-600 flex items-center">
                    <i class="pi pi-exclamation-circle text-xs mr-1"></i>
                    <span>3건 처리지연</span>
                </div>
            </div>
            <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-zinc-500 font-medium">시스템 가동률</span>
                    <i class="pi pi-server text-green-500 bg-green-50 p-2 rounded-lg"></i>
                </div>
                <div class="text-3xl font-bold text-zinc-900 dark:text-zinc-100">99.9%</div>
                <div class="mt-2 text-sm text-green-600">
                    <span>정상 운영 중</span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
                class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96">
                <h3 class="font-bold text-lg mb-4">공지사항</h3>
                <div class="space-y-3">
                    <div v-for="i in 5" :key="i"
                        class="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors">
                        <div class="flex items-center gap-3">
                            <span class="w-2 h-2 rounded-full bg-primary-500"></span>
                            <span class="text-zinc-700 dark:text-zinc-300">2026년 정보화 사업 계획 수립 안내</span>
                        </div>
                        <span class="text-xs text-zinc-400">2026.01.15</span>
                    </div>
                </div>
            </div>
            <div
                class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96">
                <h3 class="font-bold text-lg mb-4">주요 일정</h3>
                <!-- Calendar placeholder or list -->
                <div class="space-y-4">
                    <div class="flex gap-4">
                        <div
                            class="w-16 h-16 bg-primary-50 dark:bg-zinc-800 rounded-lg flex flex-col items-center justify-center text-primary-600 font-bold">
                            <span class="text-xs uppercase">JAN</span>
                            <span class="text-xl">20</span>
                        </div>
                        <div>
                            <div class="font-bold text-zinc-900 dark:text-zinc-100">정보화실무협의회</div>
                            <div class="text-sm text-zinc-500 mt-1">14:00 - 16:00 | 대회의실</div>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div
                            class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-600 font-bold">
                            <span class="text-xs uppercase">JAN</span>
                            <span class="text-xl">25</span>
                        </div>
                        <div>
                            <div class="font-bold text-zinc-900 dark:text-zinc-100">차세대 시스템 오픈식</div>
                            <div class="text-sm text-zinc-500 mt-1">10:00 - 11:30 | 본관 로비</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
