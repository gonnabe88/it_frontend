<!--
================================================================================
[pages/info/council-request/result/[id].vue]
협의회 개최 페이지 (Step 3)
================================================================================
권한에 따라 다른 화면을 표출합니다:

  [평가위원]
    - 일정 입력 (SCHEDULED 상태에서만 활성)
    - 평가의견 작성 (EVALUATING 상태에서 활성)
    - 결과서 확인 버튼 (RESULT_REVIEW 상태에서 활성)

  [IT관리자 ITPAD001]
    - 평가의견 전체 현황 조회 (EVALUATING 이후)
    - 결과서 작성 (RESULT_WRITING 상태에서 편집 가능)
    - 결과보고 결재 요청 (FINAL_APPROVAL 후 COMPLETED로 전이)

[진입 조건]
  index.vue에서 EVALUATING 이상 상태 클릭 시 라우팅됩니다.

[Design Ref: §4.4 result/[id].vue — 협의회 개최 (Step 3)]
================================================================================
-->
<script setup lang="ts">
import type { CouncilStatus } from '~/types/council';
import { useToast } from 'primevue/usetoast';
import { useAuth } from '~/composables/useAuth';

// ── 라우트 파라미터 ──────────────────────────────────────────────────
const route = useRoute();
const asctId = route.params.id as string;

const { fetchCouncil, fetchFeasibility } = useCouncil();
const { isAdmin } = useAuth();
const toast = useToast();

// ── 협의회 상세 + 타당성검토표 조회 ─────────────────────────────────
const {
    data: councilDetail,
    pending: loadingCouncil,
    refresh: refreshCouncil,
} = fetchCouncil(asctId);

const {
    data: feasibilityData,
    pending: loadingFeasibility,
} = fetchFeasibility(asctId);

// ── 권한/상태 computed ───────────────────────────────────────────────
const councilStatus = computed<CouncilStatus | null>(
    () => (councilDetail.value?.asctSts as CouncilStatus) ?? null
);

/** IT관리자 여부 */
const isAdminUser = computed(() => isAdmin());

// ── 평가위원 화면 노출 조건 ──────────────────────────────────────────

/** 일정 입력 활성 여부 (SCHEDULED 상태에서 평가위원) */
const canInputSchedule = computed(() =>
    !isAdminUser.value && councilStatus.value === 'SCHEDULED'
);

/** 평가의견 입력 활성 여부 */
const canEvaluate = computed(() =>
    !isAdminUser.value && (
        councilStatus.value === 'IN_PROGRESS' ||
        councilStatus.value === 'EVALUATING'
    )
);

/** 결과서 확인 버튼 활성 여부 */
const canReviewResult = computed(() =>
    !isAdminUser.value && (
        councilStatus.value === 'RESULT_WRITING' ||
        councilStatus.value === 'RESULT_REVIEW'
    )
);

// ── IT관리자 화면 노출 조건 ──────────────────────────────────────────

/** 평가의견 현황 조회 가능 */
const canViewEvalSummary = computed(() =>
    isAdminUser.value && councilStatus.value !== null &&
    ['EVALUATING', 'RESULT_WRITING', 'RESULT_REVIEW', 'FINAL_APPROVAL', 'COMPLETED']
        .includes(councilStatus.value)
);

/** 결과서 편집 가능 */
const resultReadonly = computed(() =>
    !isAdminUser.value ||
    !['RESULT_WRITING', 'RESULT_REVIEW'].includes(councilStatus.value ?? '')
);

// ── 이벤트 핸들러 ───────────────────────────────────────────────────

const onScheduleSubmitted = async () => {
    await refreshCouncil();
};

const onEvaluationSubmitted = async () => {
    await refreshCouncil();
};

const onResultSaved = async () => {
    await refreshCouncil();
};

const onResultConfirmed = async () => {
    await refreshCouncil();
};

// ── 상태별 안내 ────────────────────────────────────────────────────
const statusGuide = computed(() => {
    if (!councilStatus.value) return '';
    if (isAdminUser.value) {
        const map: Partial<Record<CouncilStatus, string>> = {
            EVALUATING: '평가위원들이 평가의견을 작성 중입니다.',
            RESULT_WRITING: '평가의견 취합이 완료되었습니다. 결과서를 작성해 주세요.',
            RESULT_REVIEW: '결과서 작성이 완료되었습니다. 평가위원 전원 확인을 기다립니다.',
            FINAL_APPROVAL: '전원 확인 완료. 결재 요청을 진행해 주세요.',
            COMPLETED: '협의회가 완료되었습니다.',
        };
        return map[councilStatus.value] ?? '';
    } else {
        const map: Partial<Record<CouncilStatus, string>> = {
            SCHEDULED: '협의회 일정이 확정되었습니다. 가능 일정을 입력해 주세요.',
            IN_PROGRESS: '협의회가 진행 중입니다.',
            EVALUATING: '평가의견을 작성해 주세요.',
            RESULT_WRITING: '결과서가 작성 중입니다.',
            RESULT_REVIEW: '결과서를 확인하고 검토 확인 버튼을 클릭해 주세요.',
            COMPLETED: '협의회가 완료되었습니다.',
        };
        return map[councilStatus.value] ?? '';
    }
});

const loading = computed(() => loadingCouncil.value || loadingFeasibility.value);
</script>

<template>
    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">

        <!-- 상단 헤더 -->
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <NuxtLink to="/info/council-request"
                        class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        협의회 목록
                    </NuxtLink>
                    <span class="text-zinc-300 dark:text-zinc-600 text-xs">/</span>
                    <span class="text-xs text-zinc-500">협의회 개최</span>
                </div>
                <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">협의회 개최</h1>
                <p v-if="feasibilityData?.prjNm" class="text-sm text-zinc-500 mt-1">
                    {{ feasibilityData.prjNm }}
                </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <CouncilStatusBadge v-if="councilStatus" :status="councilStatus" />
            </div>
        </div>

        <!-- 안내 메시지 -->
        <Message v-if="statusGuide" severity="info" :closable="false">
            <span class="text-sm">{{ statusGuide }}</span>
        </Message>

        <!-- 로딩 -->
        <div v-if="loading" class="space-y-4">
            <Skeleton height="3rem" class="w-full" />
            <Skeleton height="14rem" class="w-full" />
        </div>

        <template v-else>

            <!-- ══════════════════════════════════════════════════════
                 평가위원 화면
            ══════════════════════════════════════════════════════ -->
            <template v-if="!isAdminUser">

                <!-- 1. 일정 입력 (SCHEDULED) -->
                <div v-if="canInputSchedule"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">가능 일정 입력</h2>
                    </div>
                    <div class="p-5">
                        <ScheduleInput :asctId="asctId" @submitted="onScheduleSubmitted" />
                    </div>
                </div>

                <!-- 2. 평가의견 작성 (EVALUATING) -->
                <div v-if="canEvaluate"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">평가의견 작성</h2>
                    </div>
                    <div class="p-5">
                        <EvaluationForm :asctId="asctId" @submitted="onEvaluationSubmitted" />
                    </div>
                </div>

                <!-- 3. 결과서 확인 (RESULT_REVIEW) -->
                <div v-if="canReviewResult"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">3</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">결과서 검토</h2>
                    </div>
                    <div class="p-5 space-y-4">
                        <!-- 결과서 내용 (읽기 전용) -->
                        <ResultForm
                            :asctId="asctId"
                            :councilDetail="councilDetail"
                            :feasibility="feasibilityData"
                            :readonly="true"
                        />
                        <!-- 확인 버튼 -->
                        <ResultReview :asctId="asctId" @confirmed="onResultConfirmed" />
                    </div>
                </div>

                <!-- 완료 안내 (COMPLETED) -->
                <div v-if="councilStatus === 'COMPLETED'"
                    class="text-center py-10 text-zinc-500 space-y-2">
                    <i class="pi pi-check-circle text-4xl text-emerald-500 block"></i>
                    <p class="font-medium">협의회가 완료되었습니다.</p>
                </div>

                <!-- 상태 대기 안내 -->
                <div v-if="!canInputSchedule && !canEvaluate && !canReviewResult && councilStatus !== 'COMPLETED'"
                    class="text-center py-10 text-zinc-400 text-sm">
                    현재 상태에서는 추가 작업이 없습니다.
                </div>

            </template>

            <!-- ══════════════════════════════════════════════════════
                 IT관리자 화면
            ══════════════════════════════════════════════════════ -->
            <template v-else>

                <!-- 평가의견 현황 (탭 형태) -->
                <div v-if="canViewEvalSummary"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">평가의견 현황</h2>
                    </div>
                    <div class="p-5">
                        <!-- 평가의견 현황 인라인 표출 -->
                        <EvalSummaryPanel :asctId="asctId" />
                    </div>
                </div>

                <!-- 결과서 작성 -->
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">결과서</h2>
                        <span v-if="resultReadonly" class="text-xs text-zinc-400">(읽기 전용)</span>
                    </div>
                    <div class="p-5">
                        <ResultForm
                            :asctId="asctId"
                            :councilDetail="councilDetail"
                            :feasibility="feasibilityData"
                            :readonly="resultReadonly"
                            @saved="onResultSaved"
                        />
                    </div>
                </div>

            </template>

            <!-- 타당성검토표 참고 (접힌 섹션) -->
            <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <span class="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400
                                 text-xs font-bold flex items-center justify-center">i</span>
                    <h2 class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">타당성검토표 (참고용)</h2>
                </div>
                <div class="p-5">
                    <FeasibilityForm
                        v-if="feasibilityData"
                        :modelValue="feasibilityData"
                        :readonly="true"
                    />
                    <Skeleton v-else height="8rem" class="w-full" />
                </div>
            </div>

        </template>
    </div>
</template>
