<!--
================================================================================
[pages/info/council-request/prepare/[id].vue]
협의회 개최준비 페이지 (Step 2 — IT관리자)
================================================================================
IT관리자(ITPAD001)가 협의회 개최준비 단계에서 사용하는 페이지입니다.
4개 탭으로 구성됩니다:

  탭1: 평가위원 선정 — CommitteeSelector
  탭2: 일정 취합   — ScheduleStatus
  탭3: 일정공지    — CouncilNotice (SCHEDULED 이후 활성화)
  탭4: 사전질의응답 — CouncilQna

[진입 조건]
  index.vue에서 PREPARING / SCHEDULED 이후 상태인 협의회 클릭 시 라우팅됩니다.

[상태별 탭 활성화 규칙]
  PREPARING : 탭1만 편집 가능 (탭3,5 비활성)
  SCHEDULED : 탭1 readonly, 탭2~5 전체 활성 (결과서 작성 가능)

[Design Ref: §4.3 prepare/[id].vue — 협의회 개최준비 (Step 2, IT관리자)]
================================================================================
-->
<script setup lang="ts">
import type { CouncilStatus } from '~/types/council';
import { useToast } from 'primevue/usetoast';

// ── 라우트 파라미터 ──────────────────────────────────────────────────
const route = useRoute();
const asctId = route.params.id as string;

const { fetchCouncil, fetchFeasibility, skipCouncil, startCouncil, completeCouncil, confirmResult } = useCouncil();
const toast = useToast();

definePageMeta({
    title: '개최준비',
    middleware: 'admin',  // IT관리자(ITPAD001) 전용 페이지
});

// ── 협의회 상세 조회 ─────────────────────────────────────────────────
const {
    data: councilDetail,
    refresh: refreshCouncil,
} = fetchCouncil(asctId);

// ── 타당성검토표 조회 (일정공지 탭 표출용) ───────────────────────────
const {
    data: feasibilityData,
} = fetchFeasibility(asctId);


/** 협의회 현재 상태 */
const councilStatus = computed<CouncilStatus | null>(
    () => (councilDetail.value?.asctSts as CouncilStatus) ?? null
);

/** 심의유형 */
const dbrTp = computed(() => councilDetail.value?.dbrTp ?? null);

/**
 * 읽기 전용 여부 (평가위원 선정 탭)
 * APPROVED: 위원 선정 가능 (확정 시 PREPARING으로 전이)
 * PREPARING: 위원 선정 가능 (확정 전까지 수정 가능)
 * 그 이후 상태: 읽기 전용
 */
const committeeReadonly = computed(
    () => councilStatus.value !== 'APPROVED' && councilStatus.value !== 'PREPARING'
);

/**
 * 일정공지 탭 활성화 여부
 * SCHEDULED 이후에만 표출합니다.
 */
const noticeTabEnabled = computed(() => {
    const status = councilStatus.value;
    return status === 'SCHEDULED' || status === 'IN_PROGRESS' || status === 'RESULT_WRITING'
        || status === 'RESULT_REVIEW' || status === 'FINAL_APPROVAL'
        || status === 'COMPLETED';
});

/**
 * 결과서 탭 활성화 여부
 * IN_PROGRESS(평가 모니터링용)부터 결과서 탭을 표출합니다.
 * 단, 결과서 편집은 RESULT_WRITING 상태에서만 허용합니다(resultReadonly 참고).
 */
const resultTabEnabled = computed(() => {
    const status = councilStatus.value;
    return status === 'IN_PROGRESS' || status === 'RESULT_WRITING'
        || status === 'RESULT_REVIEW' || status === 'FINAL_APPROVAL'
        || status === 'COMPLETED';
});

/**
 * 결과서 편집 가능 여부
 * '협의회 완료' 버튼으로 RESULT_WRITING 전이 후에만 편집 허용합니다.
 */
const resultReadonly = computed(() =>
    councilStatus.value !== 'RESULT_WRITING'
);

/**
 * IT관리자 사전질의 등록 가능 여부
 * SCHEDULED(협의회 개최 전)과 IN_PROGRESS(진행 중) 상태에서 허용합니다.
 * 답변(canReply)은 추진부서 담당자 전용이므로 이 페이지에서는 false 고정입니다.
 */
const canAskQna = computed(() =>
    ['SCHEDULED', 'IN_PROGRESS'].includes(councilStatus.value ?? '')
);

// ── 결과서 확정 처리 ─────────────────────────────────────────────────

/** 결과서 확정 진행 중 여부 */
const confirmPending = ref(false);

/**
 * 결과서 확정 (RESULT_WRITING → RESULT_REVIEW)
 * 결과서 작성 완료 후 평가위원 검토 단계로 전이합니다.
 */
const handleConfirmResult = async () => {
    confirmPending.value = true;
    try {
        await confirmResult(asctId);
        toast.add({
            severity: 'success',
            summary: '결과서 확정',
            detail: '결과서가 확정되었습니다. 평가위원 검토 단계로 전환됩니다.',
            life: 4000,
        });
        await refreshCouncil();
    } catch {
        toast.add({
            severity: 'error',
            summary: '처리 실패',
            detail: '결과서 확정 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        confirmPending.value = false;
    }
};

// ── 협의회 생략 처리 ─────────────────────────────────────────────────

/** 생략 처리 진행 중 여부 */
const skipPending = ref(false);

/**
 * 협의회 생략 처리 (APPROVED 상태에서만 가능)
 * SKIPPED 전이 후 사업 PRJ_STS를 '요건 상세화'로 변경합니다.
 */
const handleSkip = async () => {
    skipPending.value = true;
    try {
        await skipCouncil(asctId);
        toast.add({
            severity: 'success',
            summary: '협의회 생략 처리 완료',
            detail: '사업 진행상태가 요건 상세화로 변경되었습니다.',
            life: 4000,
        });
        navigateTo('/info/council-request');
    } catch {
        toast.add({
            severity: 'error',
            summary: '생략 처리 실패',
            detail: '생략 처리 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        skipPending.value = false;
    }
};

// ── 탭 상태 ─────────────────────────────────────────────────────────
// PrimeVue v4 Tabs는 문자열 value를 권장합니다 (숫자 0은 falsy라 일부 버전에서 활성탭 불인식)
const activeTabIndex = ref('0');

// ── 이벤트 핸들러 ───────────────────────────────────────────────────

/**
 * 평가위원 확정 완료 후 처리
 * 협의회 상태가 PREPARING → 다음 단계로 전이되므로 상세 정보를 새로고침합니다.
 */
const onCommitteeSaved = async () => {
    await refreshCouncil();
};

/**
 * 일정 확정 완료 후 처리
 * 상태가 SCHEDULED로 전이되므로 일정공지 탭(탭3)으로 이동합니다.
 */
const onScheduleConfirmed = async () => {
    await refreshCouncil();
    /* 일정공지 탭으로 자동 이동 */
    activeTabIndex.value = '2';
};

// ── 협의회 개최 처리 ─────────────────────────────────────────────────

/** 협의회 개최 진행 중 여부 */
const startPending = ref(false);

/**
 * 협의회 개최 (SCHEDULED → IN_PROGRESS)
 * IT관리자가 오프라인 협의회 개최를 확인합니다.
 * 개최 후 평가위원들은 본인 화면에서 평가점수와 의견을 입력합니다.
 */
const handleStart = async () => {
    startPending.value = true;
    try {
        await startCouncil(asctId);
        toast.add({
            severity: 'success',
            summary: '협의회 개최',
            detail: '협의회가 개최되었습니다. 평가위원들의 평가를 대기합니다.',
            life: 4000,
        });
        await refreshCouncil();
    } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        toast.add({
            severity: 'error',
            summary: '처리 실패',
            detail: err?.data?.message ?? err?.message ?? '알 수 없는 오류가 발생했습니다.',
            life: 5000,
        });
    } finally {
        startPending.value = false;
    }
};

// ── 협의회 완료 처리 ─────────────────────────────────────────────────

/** 협의회 완료 진행 중 여부 */
const completePending = ref(false);

/**
 * 협의회 완료 (IN_PROGRESS → RESULT_WRITING)
 * 모든 평가위원의 평가 제출이 확인된 후 IT관리자가 클릭합니다.
 * 완료 후 개최결과서 작성 단계로 전이합니다.
 */
const handleComplete = async () => {
    completePending.value = true;
    try {
        await completeCouncil(asctId);
        toast.add({
            severity: 'success',
            summary: '협의회 완료',
            detail: '협의회가 완료되었습니다. 개최결과서를 작성해 주세요.',
            life: 4000,
        });
        await refreshCouncil();
        /* 결과서 탭으로 자동 이동 */
        activeTabIndex.value = '4';
    } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        toast.add({
            severity: 'error',
            summary: '처리 실패',
            detail: err?.data?.message ?? err?.message ?? '알 수 없는 오류가 발생했습니다.',
            life: 5000,
        });
    } finally {
        completePending.value = false;
    }
};

// ── 페이지 상태별 안내 텍스트 ────────────────────────────────────────
const statusGuide = computed(() => {
    switch (councilStatus.value) {
        case 'APPROVED':
            return '타당성검토표 결재가 완료되었습니다. 심의유형에 맞는 평가위원을 선정하고 확정해 주세요.';
        case 'PREPARING':
            return '평가위원을 선정하고 확정하면 위원들에게 일정 입력 요청이 발송됩니다.';
        case 'SCHEDULED':
            return '일정이 확정되었습니다. 협의회 개최 당일 \'협의회 개최\' 버튼을 눌러 주세요.';
        case 'IN_PROGRESS':
            return '협의회가 진행 중입니다. 결과서 탭에서 평가 현황을 확인하고, 모든 평가위원의 평가가 완료되면 \'협의회 완료\' 버튼을 눌러 주세요.';
        default:
            return '';
    }
});

</script>

<template>
    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">

        <!-- 상단 헤더 -->
        <PageHeader title="협의회 개최준비" :subtitle="feasibilityData?.prjNm">
            <template #leading>
                <div class="flex items-center gap-1">
                    <NuxtLink
to="/info/council-request"
                        class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        협의회 목록
                    </NuxtLink>
                    <span class="text-zinc-300 dark:text-zinc-600 text-xs">/</span>
                    <span class="text-xs text-zinc-500">개최준비</span>
                </div>
            </template>
            <template #actions>
                <CouncilStatusBadge v-if="councilStatus" :status="councilStatus" />
            </template>
        </PageHeader>

        <!-- 안내 메시지 -->
        <Message v-if="statusGuide" severity="info" :closable="false">
            <span class="text-sm">{{ statusGuide }}</span>
        </Message>

        <!--
            APPROVED 상태: 평가위원 선정 전 생략 버튼
            협의회 개최가 불필요한 사업의 경우 생략 처리합니다.
        -->
        <div v-if="councilStatus === 'APPROVED'" class="flex justify-end">
            <Button
                label="협의회 생략"
                icon="pi pi-ban"
                severity="secondary"
                outlined
                :loading="skipPending"
                @click="handleSkip"
            />
        </div>

        <!--
            SCHEDULED 상태: 협의회 개최 버튼
            IT관리자가 오프라인 협의회 개최 당일 클릭하면 IN_PROGRESS로 전이됩니다.
        -->
        <div v-if="councilStatus === 'SCHEDULED'" class="flex justify-end">
            <Button
                label="협의회 개최"
                icon="pi pi-play"
                severity="success"
                :loading="startPending"
                @click="handleStart"
            />
        </div>

        <!--
            IN_PROGRESS 상태: 협의회 완료 버튼
            모든 평가위원의 평가 제출 확인 후 IT관리자가 클릭하면 RESULT_WRITING으로 전이됩니다.
        -->
        <div v-if="councilStatus === 'IN_PROGRESS'" class="flex justify-end">
            <Button
                label="협의회 완료"
                icon="pi pi-check"
                severity="warning"
                :loading="completePending"
                @click="handleComplete"
            />
        </div>

        <!--
            탭 구조: ClientOnly로 SSR hydration 불일치 방지
            ※ loading 상태로 탭 전체를 v-if/v-else 처리하면 CommitteeSelector가
              unmount → remount 반복되어 내부 상태가 초기화됩니다.
              fallback 슬롯으로 SSR 플레이스홀더를 제공하고,
              탭은 항상 DOM에 유지합니다.
        -->
        <ClientOnly>
            <!-- SSR / 하이드레이션 전 플레이스홀더 -->
            <template #fallback>
                <div class="space-y-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
                    <Skeleton height="3rem" class="w-full" />
                    <Skeleton height="12rem" class="w-full" />
                </div>
            </template>

            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

                <Tabs v-model:value="activeTabIndex">
                    <TabList class="border-b border-zinc-100 dark:border-zinc-800 px-4 pt-2">
                        <!-- 탭1: 평가위원 선정 -->
                        <Tab value="0">
                            <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                                <i class="pi pi-users text-xs"/>
                                평가위원 선정
                            </div>
                        </Tab>

                        <!-- 탭2: 일정 취합 -->
                        <Tab value="1">
                            <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                                <i class="pi pi-calendar text-xs"/>
                                일정 취합
                            </div>
                        </Tab>

                        <!-- 탭3: 일정공지 (SCHEDULED 이후 활성) -->
                        <Tab value="2" :disabled="!noticeTabEnabled">
                            <div
                                class="flex items-center gap-1.5 py-1 px-1 text-sm"
                                :class="!noticeTabEnabled ? 'opacity-40' : ''"
                            >
                                <i class="pi pi-bell text-xs"/>
                                일정공지
                            </div>
                        </Tab>

                        <!-- 탭4: 사전질의응답 -->
                        <Tab value="3">
                            <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                                <i class="pi pi-comments text-xs"/>
                                사전질의응답
                            </div>
                        </Tab>

                        <!-- 탭5: 결과서 (EVALUATING 이후 활성) -->
                        <Tab value="4" :disabled="!resultTabEnabled">
                            <div
                                class="flex items-center gap-1.5 py-1 px-1 text-sm"
                                :class="!resultTabEnabled ? 'opacity-40' : ''"
                            >
                                <i class="pi pi-file-edit text-xs"/>
                                결과서
                            </div>
                        </Tab>
                    </TabList>

                    <TabPanels>

                        <!-- ── 탭1: 평가위원 선정 ── -->
                        <TabPanel value="0">
                            <div class="p-5">
                                <CouncilCommitteeSelector
                                    :asct-id="asctId"
                                    :dbr-tp="dbrTp"
                                    :readonly="committeeReadonly"
                                    @saved="onCommitteeSaved"
                                />
                            </div>
                        </TabPanel>

                        <!-- ── 탭2: 일정 취합 ── -->
                        <TabPanel value="1">
                            <div class="p-5">
                                <CouncilScheduleStatus
                                    :asct-id="asctId"
                                    :readonly="committeeReadonly === false ? false : councilStatus === 'SCHEDULED'"
                                    @confirmed="onScheduleConfirmed"
                                />
                            </div>
                        </TabPanel>

                        <!-- ── 탭3: 일정공지 ── -->
                        <TabPanel value="2">
                            <div class="p-5">
                                <CouncilNotice
                                    v-if="noticeTabEnabled"
                                    :asct-id="asctId"
                                    :council-detail="councilDetail ?? null"
                                    :feasibility="feasibilityData ?? null"
                                />
                                <div v-else class="text-sm text-zinc-400 py-8 text-center">
                                    일정 확정 후 표출됩니다.
                                </div>
                            </div>
                        </TabPanel>

                        <!-- ── 탭4: 사전질의응답 ── -->
                        <TabPanel value="3">
                            <div class="p-5">
                                <CouncilQna
                                    :asct-id="asctId"
                                    :can-ask="canAskQna"
                                    :can-reply="false"
                                />
                            </div>
                        </TabPanel>

                        <!-- ── 탭5: 결과서 ── -->
                        <TabPanel value="4">
                            <div class="p-5">
                                <template v-if="resultTabEnabled">
                                    <!-- 평가의견 현황 (참고용) -->
                                    <div class="mb-6">
                                        <h3 class="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-3">
                                            평가의견 현황 (참고)
                                        </h3>
                                        <CouncilEvaluationEvalSummaryPanel :asct-id="asctId" />
                                    </div>
                                    <Divider />
                                    <!-- 결과서 작성 -->
                                    <CouncilResultForm
                                        :asct-id="asctId"
                                        :council-detail="councilDetail ?? null"
                                        :feasibility="feasibilityData ?? null"
                                        :readonly="resultReadonly"
                                        @saved="refreshCouncil"
                                    />
                                    <!-- 결과서 확정 버튼 (RESULT_WRITING 상태에서만) -->
                                    <div
                                        v-if="councilStatus === 'RESULT_WRITING'"
                                        class="flex justify-end mt-4"
                                    >
                                        <Button
                                            label="결과서 확정"
                                            icon="pi pi-check-circle"
                                            severity="success"
                                            :loading="confirmPending"
                                            @click="handleConfirmResult"
                                        />
                                    </div>
                                </template>
                                <div v-else class="text-sm text-zinc-400 py-8 text-center">
                                    일정 확정 후 표출됩니다.
                                </div>
                            </div>
                        </TabPanel>

                    </TabPanels>
                </Tabs>

            </div>
        </ClientOnly>

        <!-- 타당성검토표 확인 (접힌 상태로 표출) -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                <span
class="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400
                             text-xs font-bold flex items-center justify-center">i</span>
                <h2 class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">타당성검토표 (참고용)</h2>
            </div>
            <div class="p-5">
                <CouncilFeasibilityForm
                    v-if="feasibilityData"
                    :model-value="feasibilityData"
                    :readonly="true"
                />
                <Skeleton v-else height="8rem" class="w-full" />
            </div>
        </div>

    </div>
</template>
