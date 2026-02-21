<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const navigateTo = (path: string) => {
    router.push(path);
};

definePageMeta({
    title: '예산 신청'
});
</script>

<template>
    <div class="flex flex-col items-center justify-center h-full overflow-hidden">
        <div id="budget" class="flex flex-col items-center justify-center">

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl px-4">
                <!-- 정보화사업 Card -->
                <div @click="navigateTo('/info/projects/form')"
                    class="group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-100">

                    <!-- Fixed Height Header -->
                    <div class="flex flex-col items-center h-[260px] w-full pt-6">
                        <div
                            class="p-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                            <i class="pi pi-desktop text-5xl"></i>
                        </div>
                        <h2
                            class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            정보화사업</h2>
                        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">자본예산 / 전산임차료(AI)</p>
                    </div>

                    <div class="w-full px-4 pb-6">
                        <div class="flex flex-col gap-2 items-start">
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0">자본예산</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">기계장치(HW), 기타무형자산(SW), 개발비</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0">전산임차료</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">AI 서비스 이용료</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 전산업무비 Card -->
                <div @click="navigateTo('/info/cost/form')"
                    class="group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-100">

                    <!-- Fixed Height Header -->
                    <div class="flex flex-col items-center h-[260px] w-full pt-6">
                        <div
                            class="p-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                            <i class="pi pi-wallet text-5xl"></i>
                        </div>
                        <h2
                            class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            전산업무비</h2>
                        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">전산 일반관리비</p>
                    </div>

                    <div class="w-full px-4 pb-6">
                        <div class="flex flex-col gap-2 items-start">
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산임차료</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">SW 라이선스 이용료</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산용역비</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">외주인력(ITO) 운영비 등</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산여비</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">IT 업무추진 관련 여비</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산제비</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">회선사용료, 유지보수 등</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 경상사업 Card -->
                <div @click="navigateTo('/info/recurring/form')"
                    class="group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-red-500 dark:hover:border-red-500 transition-all duration-300 cursor-pointer flex flex-col items-center text-center h-100">

                    <!-- Fixed Height Header -->
                    <div class="flex flex-col items-center h-[260px] w-full pt-6">
                        <div
                            class="p-6 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-300">
                            <i class="pi pi-briefcase text-5xl"></i>
                        </div>
                        <h2
                            class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            경상사업</h2>
                        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">정보기기, 업무용 SW 구매 등</p>
                    </div>

                    <div class="w-full px-4 pb-6">
                        <div class="flex flex-col gap-2 items-start">
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 shrink-0">국내</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">도면 설계(CADian), Adobe CCT 등</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span
                                    class="px-2 py-1 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 shrink-0">해외</span>
                                <span class="text-sm text-zinc-600 dark:text-zinc-400">신규 채용에 따른 PC 구입, 노후 PC 교체
                                    등</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
