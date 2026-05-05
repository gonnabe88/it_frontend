<!--
================================================================================
[pages/budget/index.vue] 예산 작성 유형 선택 페이지
================================================================================
예산을 신청하기 전, 신청 유형을 선택하는 카드 선택 UI 페이지입니다.
세 가지 예산 작성 유형 카드를 클릭하면 해당 등록 폼으로 이동합니다.

[예산 작성 유형]
  1. 정보화사업 → /info/projects/form
     - 자본예산 (기계장치HW, 기타무형자산SW, 개발비)
     - 전산임차료 (AI 서비스 이용료)

  2. 전산업무비 → /info/cost/form
     - 전산임차료 (SW 라이선스 이용료)
     - 전산용역비 (외주인력ITO 운영비)
     - 전산여비 (IT 업무추진 여비)
     - 전산제비 (회선사용료, 유지보수 등)

  3. 경상사업 → /info/projects/form?ordinary=true
     - 국내: 도면 설계(CADian), Adobe CCT 등
     - 해외: 신규 채용에 따른 PC 구입, 노후 PC 교체 등

[UX]
  - 카드 호버 시 색상 강조 + 아이콘 스케일 업 애니메이션
  - 전산업무비 선택 시 하위 메뉴 전환 애니메이션 (Staggered Effect)
================================================================================
-->
<script setup lang="ts">
/* 페이지 탭 제목 설정 */
definePageMeta({
    title: '예산 작성'
});

/* ── REQ-6: 예산 신청 기간 검증 ── */
const { isWithinPeriod, periodInfo } = useBudgetPeriod();

/** 기간 외 안내 다이얼로그 표시 여부 */
const showPeriodDialog = ref(false);

/** 기간 외일 때 안내 팝업 표시 */
onMounted(() => {
    /* periodData 로딩 완료 후 기간 외 여부 확인 */
    watch(isWithinPeriod, (inPeriod) => {
        if (!inPeriod) {
            showPeriodDialog.value = true;
        }
    }, { immediate: true });
});

/** 카드 클릭 핸들러: 기간 내일 때만 이동 */
const navigateIfAllowed = (path: string) => {
    if (!isWithinPeriod.value) {
        showPeriodDialog.value = true;
        return;
    }
    navigateTo(path);
};

</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4 py-12 overflow-hidden">

        <!-- 고정 높이 컨테이너로 레이아웃 점프 방지 -->
        <div class="relative w-full max-w-7xl flex flex-col items-center justify-center min-h-[600px]">

            <TransitionGroup name="premium-transition" mode="out-in">

                <!-- 메인 예산 작성 유형 카드 3개 -->
                <div key="main" class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4">

                    <!-- 1. 정보화사업 카드 (인디고 테마) -->
                    <div
:class="[
                            'stagger-1 group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all duration-500 flex flex-col items-center text-center h-[460px]',
                            isWithinPeriod ? 'hover:shadow-xl hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                        ]"
                        @click="navigateIfAllowed('/info/projects/form')">
                        <!-- 아이콘/제목 영역 (고정 높이로 하단 뱃지 라인 정렬) -->
                        <div class="flex flex-col items-center h-[240px] w-full pt-4">
                            <div class="p-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-500">
                                <i class="pi pi-desktop text-5xl" />
                            </div>
                            <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">정보화사업</h2>
                            <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">자본예산 / 전산임차료(AI)</p>
                        </div>
                        <!-- 예산 세부 항목 뱃지 목록 -->
                        <div class="w-full px-4 pb-6 flex-1">
                            <div class="flex flex-col gap-2 items-start">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0">자본예산</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">기계장치(HW), 기타무형자산(SW), 개발비</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0">전산임차료</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">AI 서비스 이용료</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. 전산업무비 카드 (에메랄드 테마) -->
                    <!-- 목록 페이지(/info/cost)는 기간 무관 항상 접근 가능, 신규 등록 폼은 budget-period 미들웨어가 자체 보호 -->
                    <div
:class="[
                            'stagger-2 group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all duration-500 flex flex-col items-center text-center h-[460px]',
                            'hover:shadow-xl hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer'
                        ]"
                        @click="navigateTo('/info/cost')">
                        <!-- 아이콘/제목 영역 (고정 높이로 하단 뱃지 라인 정렬) -->
                        <div class="flex flex-col items-center h-[240px] w-full pt-4">
                            <div class="p-6 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                <i class="pi pi-wallet text-5xl" />
                            </div>
                            <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">전산업무비</h2>
                            <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">전산 일반관리비</p>
                        </div>
                        <!-- 예산 세부 항목 뱃지 목록 -->
                        <div class="w-full px-4 pb-6 flex-1">
                            <div class="flex flex-col gap-2 items-start">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산임차료</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">SW 라이선스 이용료</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산용역비</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">외주인력(ITO) 운영비 등</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산여비</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">IT 업무추진 관련 여비</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800 shrink-0">전산제비</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">회선사용료, 유지보수 등</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. 경상사업 카드 (레드 테마) -->
                    <div
:class="[
                            'stagger-3 group relative bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all duration-500 flex flex-col items-center text-center h-[460px]',
                            isWithinPeriod ? 'hover:shadow-xl hover:border-red-500 dark:hover:border-red-500 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                        ]"
                        @click="navigateIfAllowed('/info/projects/form?ordinary=true')">
                        <!-- 아이콘/제목 영역 (고정 높이로 하단 뱃지 라인 정렬) -->
                        <div class="flex flex-col items-center h-[240px] w-full pt-4">
                            <div class="p-6 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-500">
                                <i class="pi pi-briefcase text-5xl" />
                            </div>
                            <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">경상사업</h2>
                            <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">정보기기, 업무용 SW 구매 등</p>
                        </div>
                        <!-- 예산 세부 항목 뱃지 목록 -->
                        <div class="w-full px-4 pb-6 flex-1">
                            <div class="flex flex-col gap-2 items-start">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 shrink-0">국내</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">도면 설계(CADian), Adobe CCT 등</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800 shrink-0">해외</span>
                                    <span class="text-sm text-zinc-600 dark:text-zinc-400 text-left">신규 채용에 따른 PC 구입, 노후 PC 교체 등</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </TransitionGroup>
        </div>

        <!-- REQ-6: 예산 신청 기간 외 안내 다이얼로그 -->
        <Dialog
v-model:visible="showPeriodDialog" modal header="예산 신청 기간 안내"
            :style="{ width: 'var(--dialog-sm)' }" :closable="true" :draggable="false">
            <div class="flex flex-col items-center gap-4 py-2">
                <i class="pi pi-calendar-times text-4xl text-orange-500"/>
                <p class="text-center text-zinc-700 dark:text-zinc-300">
                    현재 예산 신청 기간이 아닙니다.
                </p>
                <p v-if="periodInfo" class="text-center text-sm text-zinc-500 dark:text-zinc-400">
                    예산 신청 기간: <strong>{{ periodInfo.startDate }}</strong> ~ <strong>{{ periodInfo.endDate }}</strong>
                </p>
            </div>
            <template #footer>
                <AppDialogFooter>
                    <Button label="확인" autofocus @click="showPeriodDialog = false" />
                </AppDialogFooter>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* 메인 트랜지션 효과: 입체적인 Scale + Fade */
.premium-transition-enter-active,
.premium-transition-leave-active {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: absolute;
    width: 100%;
}

.premium-transition-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(30px);
}

.premium-transition-leave-to {
    opacity: 0;
    transform: scale(1.02) translateY(-30px);
}

/* Staggered Animation (순차적 등장 효과) */
.stagger-1 {
    transition-delay: 0.1s;
}

.stagger-2 {
    transition-delay: 0.2s;
}

.stagger-3 {
    transition-delay: 0.3s;
}

.group {
    will-change: transform, box-shadow, border-color;
}
</style>
