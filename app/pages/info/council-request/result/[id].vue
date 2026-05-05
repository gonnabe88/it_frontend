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
import { useAuth } from '~/composables/useAuth';
import { useToast } from 'primevue/usetoast';
import type { OrgUser } from '~/composables/useOrganization';
import type { NotifyInfo } from '~/composables/useCouncil';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

definePageMeta({ title: '개최결과' });

/**
 * EmployeeSearchDialog emit 데이터 타입
 * OrgUser에 EmployeeSearchDialog에서 추가하는 부서코드(orgCode) 필드를 포함합니다.
 */
interface EmployeeSelectResult extends OrgUser {
    orgCode: string;
}

// ── 라우트 파라미터 ──────────────────────────────────────────────────
const route = useRoute();
const asctId = route.params.id as string;

const {
    fetchCouncil, fetchFeasibility, fetchCommittee,
    requestResultApproval, notifyCouncil, completeCouncil,
} = useCouncil();
const { isAdmin, user } = useAuth();
const toast = useToast();

// ── 협의회 상세 + 타당성검토표 + 위원 목록 조회 ──────────────────────
const {
    data: councilDetail,
    pending: loadingCouncil,
    refresh: refreshCouncil,
} = fetchCouncil(asctId);

const {
    data: feasibilityData,
    pending: loadingFeasibility,
} = fetchFeasibility(asctId);

const {
    data: committeeData,
    pending: loadingCommittee,
} = fetchCommittee(asctId);


// ── 권한/상태 computed ───────────────────────────────────────────────
const councilStatus = computed<CouncilStatus | null>(
    () => (councilDetail.value?.asctSts as CouncilStatus) ?? null
);

/** IT관리자 권한 여부 */
const isAdminUser = computed(() => isAdmin());

/**
 * 현재 사용자가 이 협의회의 평가위원으로 등록되어 있는지 여부
 * IT관리자라도 위원으로 등록되어 있으면 true — 일정 입력/평가 화면을 표출합니다.
 */
const isCommitteeMember = computed(() => {
    if (!user.value?.eno || !committeeData.value) return false;
    const all = [
        ...(committeeData.value.mandatory ?? []),
        ...(committeeData.value.call ?? []),
        ...(committeeData.value.secretary ?? []),
    ];
    return all.some(m => m.eno === user.value!.eno);
});

/**
 * IT관리자 전용 현황 화면 표출 여부
 * 관리자이면서 평가위원이 아닌 경우에만 현황 화면을 표출합니다.
 */
const isAdminOnly = computed(() => isAdminUser.value && !isCommitteeMember.value);

/**
 * 추진부서 담당자 여부
 * 관리자도 아니고 평가위원도 아닌 일반 사용자 = 추진부서 담당자
 */
const isDeptUser = computed(() => !isAdminUser.value && !isCommitteeMember.value);

// ── 평가위원 화면 노출 조건 ──────────────────────────────────────────

/**
 * 일정 입력 섹션 표출 여부
 * PREPARING: 입력/수정 가능
 * SCHEDULED: 제출한 일정 읽기 전용으로 표출 (일정 확정 후 잠금)
 */
const canInputSchedule = computed(() =>
    isCommitteeMember.value &&
    (councilStatus.value === 'PREPARING' || councilStatus.value === 'SCHEDULED')
);

/** 일정 입력 읽기 전용 여부 — 일정 확정(SCHEDULED) 이후 수정 불가 */
const scheduleInputReadonly = computed(() => councilStatus.value !== 'PREPARING');

/** 평가의견 입력 활성 여부 */
const canEvaluate = computed(() =>
    isCommitteeMember.value && (
        councilStatus.value === 'IN_PROGRESS' ||
        councilStatus.value === 'EVALUATING'
    )
);

/** 결과서 확인 버튼 활성 여부 (RESULT_REVIEW 상태에서만) */
const canReviewResult = computed(() =>
    isCommitteeMember.value &&
    councilStatus.value === 'RESULT_REVIEW'
);

// ── 사전질의응답 노출 조건 ──────────────────────────────────────────

/**
 * 평가위원의 사전질의 등록 가능 여부
 * SCHEDULED 상태에서만 질의 등록 허용
 */
const canAskQna = computed(() =>
    isCommitteeMember.value && councilStatus.value === 'SCHEDULED'
);

/**
 * 추진부서 담당자의 답변 가능 여부
 * SCHEDULED 상태에서만 답변 허용
 */
const canReplyQna = computed(() =>
    isDeptUser.value && councilStatus.value === 'SCHEDULED'
);

// ── IT관리자 전용 화면 노출 조건 ────────────────────────────────────

/** 평가의견 현황 조회 가능 (관리자 전용) */
const canViewEvalSummary = computed(() =>
    isAdminOnly.value && councilStatus.value !== null &&
    ['EVALUATING', 'RESULT_WRITING', 'RESULT_REVIEW', 'FINAL_APPROVAL', 'RESULT_APPROVAL_PENDING', 'COMPLETED']
        .includes(councilStatus.value)
);

/**
 * 결과서 편집 가능 여부
 * RESULT_WRITING 상태 + IT관리자인 경우에만 편집 가능
 */
const resultReadonly = computed(() =>
    !isAdminOnly.value || councilStatus.value !== 'RESULT_WRITING'
);

/** 결과서 확정 버튼 노출 여부 */
const canConfirmResult = computed(() =>
    isAdminOnly.value && councilStatus.value === 'RESULT_WRITING'
);

/** 결재 요청 버튼 노출 여부 */
const canRequestApproval = computed(() =>
    isAdminOnly.value && councilStatus.value === 'FINAL_APPROVAL'
);

/** 통보 버튼 노출 여부 */
const canNotify = computed(() =>
    isAdminOnly.value && councilStatus.value === 'COMPLETED'
);

/** 팀장 결재자 */
const teamLead = ref<{ eno: string; name: string; rank: string } | null>(null);
/** 부장 결재자 */
const deptHead = ref<{ eno: string; name: string; rank: string } | null>(null);
/** 신청의견 */
const approvalOpinion = ref('');
const requestingApproval = ref(false);

/** 직원 검색 다이얼로그 */
const showEmployeeSearch = ref(false);
/** 현재 검색 대상 ('teamLead' | 'deptHead') */
const currentSearchTarget = ref<'teamLead' | 'deptHead'>('teamLead');

/** 직원 검색 다이얼로그 열기 */
const openEmployeeSearch = (target: 'teamLead' | 'deptHead') => {
    currentSearchTarget.value = target;
    showEmployeeSearch.value = true;
};

/** 직원 검색 선택 완료 콜백 */
const onApproverSelect = (employee: EmployeeSelectResult) => {
    const approver = { eno: employee.eno, name: employee.usrNm, rank: employee.ptCNm ?? '' };
    if (currentSearchTarget.value === 'teamLead') {
        teamLead.value = approver;
    } else {
        deptHead.value = approver;
    }
    showEmployeeSearch.value = false;
};

/**
 * 개최결과서 결재 요청을 처리합니다.
 * 팀장 → 부장 순으로 결재선을 구성합니다.
 * FINAL_APPROVAL → RESULT_APPROVAL_PENDING 전이
 */
const handleRequestApproval = async () => {
    if (!teamLead.value || !deptHead.value) return;
    requestingApproval.value = true;
    try {
        await requestResultApproval(
            asctId,
            teamLead.value.eno,
            deptHead.value.eno,
            approvalOpinion.value || undefined
        );
        toast.add({ severity: 'success', summary: '결재 요청 완료', detail: '결재가 요청되었습니다.', life: 3000 });
        teamLead.value = null;
        deptHead.value = null;
        approvalOpinion.value = '';
        await refreshCouncil();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '결재 요청 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        requestingApproval.value = false;
    }
};

/** 결과서 작성 시작 버튼 노출 여부 — 전원 제출 완료 후 관리자가 RESULT_WRITING으로 전이 */
const canStartResultWriting = computed(() =>
    isAdminOnly.value && councilStatus.value === 'EVALUATING'
);

const startingResult = ref(false);

/**
 * 결과서 작성 시작 처리 (EVALUATING → RESULT_WRITING)
 * 전원 제출 완료 확인은 백엔드 completeCouncil에서 수행합니다.
 */
const handleStartResultWriting = async () => {
    startingResult.value = true;
    try {
        await completeCouncil(asctId);
        toast.add({ severity: 'success', summary: '결과서 작성 시작', detail: '결과서 작성 단계로 전환되었습니다.', life: 3000 });
        await refreshCouncil();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '전환 중 오류가 발생했습니다. 평가의견 미제출 위원이 있는지 확인해 주세요.', life: 4000 });
    } finally {
        startingResult.value = false;
    }
};

const notifying = ref(false);
/** 통보 완료 후 수신자 정보 (null이면 아직 통보 안 함) */
const notifyResult = ref<NotifyInfo | null>(null);

/**
 * 추진부서 통보를 처리합니다.
 * 백엔드에서 사업 상태를 '요건 상세화'로 변경하고 수신자 정보를 반환합니다.
 */
const handleNotify = async () => {
    notifying.value = true;
    try {
        const result = await notifyCouncil(asctId);
        notifyResult.value = result;
        await refreshCouncil();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '통보 처리 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        notifying.value = false;
    }
};

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
    if (isAdminOnly.value) {
        const map: Partial<Record<CouncilStatus, string>> = {
            PREPARING: '평가위원들이 가능 일정을 입력 중입니다.',
            EVALUATING: '평가위원들이 평가의견을 작성 중입니다.',
            RESULT_WRITING: '평가의견 취합이 완료되었습니다. 결과서를 작성해 주세요.',
            RESULT_REVIEW: '결과서 작성이 완료되었습니다. 평가위원 전원 확인을 기다립니다.',
            FINAL_APPROVAL: '전원 확인 완료. 결재 요청을 진행해 주세요.',
            RESULT_APPROVAL_PENDING: '개최결과서 결재가 진행 중입니다.',
            COMPLETED: '협의회가 완료되었습니다.',
        };
        return map[councilStatus.value] ?? '';
    } else if (isDeptUser.value) {
        const map: Partial<Record<CouncilStatus, string>> = {
            SCHEDULED: '평가위원의 사전 질의에 답변해 주세요.',
            COMPLETED: '협의회가 완료되었습니다.',
        };
        return map[councilStatus.value] ?? '';
    } else {
        const map: Partial<Record<CouncilStatus, string>> = {
            PREPARING: '가능한 일정을 입력해 주세요.',
            SCHEDULED: '협의회 일정이 확정되었습니다. 사전 질의를 등록할 수 있습니다.',
            IN_PROGRESS: '협의회가 진행 중입니다.',
            EVALUATING: '평가의견을 작성해 주세요.',
            RESULT_WRITING: '결과서가 작성 중입니다.',
            RESULT_REVIEW: '결과서를 확인하고 검토 확인 버튼을 클릭해 주세요.',
            COMPLETED: '협의회가 완료되었습니다.',
        };
        return map[councilStatus.value] ?? '';
    }
});

const loading = computed(() => loadingCouncil.value || loadingFeasibility.value || loadingCommittee.value);
</script>

<template>
    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">

        <!-- 상단 헤더 -->
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <NuxtLink
to="/info/council-request"
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
                 평가위원 화면 (이 협의회의 위원으로 등록된 사용자)
            ══════════════════════════════════════════════════════ -->
            <template v-if="isCommitteeMember">

                <!-- 1. 일정 입력 (SCHEDULED) -->
                <div
v-if="canInputSchedule"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">가능 일정 입력</h2>
                    </div>
                    <div class="p-5">
                        <CouncilScheduleInput :asct-id="asctId" :readonly="scheduleInputReadonly" @submitted="onScheduleSubmitted" />
                    </div>
                </div>

                <!-- 2. 평가의견 작성 (EVALUATING) -->
                <div
v-if="canEvaluate"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">평가의견 작성</h2>
                    </div>
                    <div class="p-5">
                        <CouncilEvaluationForm :asct-id="asctId" @submitted="onEvaluationSubmitted" />
                    </div>
                </div>

                <!-- 3. 결과서 확인 (RESULT_REVIEW) -->
                <div
v-if="canReviewResult"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">3</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">결과서 검토</h2>
                    </div>
                    <div class="p-5 space-y-4">
                        <!-- 결과서 내용 (읽기 전용) -->
                        <CouncilResultForm
                            :asct-id="asctId"
                            :council-detail="councilDetail ?? null"
                            :feasibility="feasibilityData ?? null"
                            :readonly="true"
                        />
                        <!-- 확인 버튼 -->
                        <CouncilResultReview :asct-id="asctId" @confirmed="onResultConfirmed" />
                    </div>
                </div>

                <!-- 사전질의 등록 (SCHEDULED 상태) -->
                <div
                    v-if="canAskQna"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">사전질의</h2>
                    </div>
                    <div class="p-5">
                        <CouncilQna :asct-id="asctId" :can-ask="true" :can-reply="false" />
                    </div>
                </div>

                <!-- 완료 안내 (COMPLETED) -->
                <div
v-if="councilStatus === 'COMPLETED'"
                    class="text-center py-10 text-zinc-500 space-y-2">
                    <i class="pi pi-check-circle text-4xl text-emerald-500 block"/>
                    <p class="font-medium">협의회가 완료되었습니다.</p>
                </div>

                <!-- 상태 대기 안내 -->
                <div
                    v-if="!canInputSchedule && !canEvaluate && !canReviewResult && !canAskQna && councilStatus !== 'COMPLETED'"
                    class="text-center py-10 text-zinc-400 text-sm"
                >
                    현재 상태에서는 추가 작업이 없습니다.
                </div>

            </template>

            <!-- ══════════════════════════════════════════════════════
                 추진부서 담당자 화면 (관리자/위원 아닌 일반 사용자)
            ══════════════════════════════════════════════════════ -->
            <template v-if="isDeptUser">

                <!-- 사전질의 답변 (SCHEDULED 상태) -->
                <div
                    v-if="canReplyQna"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">사전질의 답변</h2>
                    </div>
                    <div class="p-5">
                        <CouncilQna :asct-id="asctId" :can-ask="false" :can-reply="true" />
                    </div>
                </div>

                <!-- 상태 대기 안내 -->
                <div
                    v-if="!canReplyQna"
                    class="text-center py-10 text-zinc-400 text-sm"
                >
                    현재 상태에서는 추가 작업이 없습니다.
                </div>

            </template>

            <!-- ══════════════════════════════════════════════════════
                 IT관리자 전용 화면 (위원이 아닌 관리자)
            ══════════════════════════════════════════════════════ -->
            <template v-if="isAdminOnly">

                <!-- 일정 응답 현황 (PREPARING 상태) -->
                <div
                    v-if="councilStatus === 'PREPARING'"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">일정 응답 현황</h2>
                    </div>
                    <div class="p-5">
                        <CouncilScheduleStatus :asct-id="asctId" :readonly="true" :show-confirm="false" />
                    </div>
                </div>

                <!-- 평가의견 현황 (탭 형태) -->
                <div
v-if="canViewEvalSummary"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">1</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">평가의견 현황</h2>
                    </div>
                    <div class="p-5">
                        <!-- 평가의견 현황 인라인 표출 -->
                        <!-- committeeData: 이 페이지에서 이미 fetch한 데이터를 prop으로 내려 중복 fetch 방지 -->
                        <CouncilEvaluationEvalSummaryPanel
                            :asct-id="asctId"
                            :committee-data="committeeData ?? null"
                        />
                    </div>
                </div>

                <!-- 결과서 작성 시작 버튼 (전원 제출 완료 후 EVALUATING 상태에서 표출) -->
                <div
                    v-if="canStartResultWriting"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm"
                >
                    <div class="p-5 flex items-center justify-between gap-4">
                        <p class="text-sm text-zinc-600 dark:text-zinc-300">
                            평가의견 수집이 완료되었습니다. 결과서 작성을 시작해 주세요.
                        </p>
                        <Button
                            label="결과서 작성 시작"
                            icon="pi pi-file-edit"
                            :loading="startingResult"
                            @click="handleStartResultWriting"
                        />
                    </div>
                </div>

                <!-- 결과서 작성 -->
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="flex items-center gap-2 p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600
                                     dark:text-indigo-400 text-xs font-bold flex items-center justify-center">2</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">결과서</h2>
                        <span v-if="resultReadonly" class="text-xs text-zinc-400">(읽기 전용)</span>
                    </div>
                    <div class="p-5">
                        <CouncilResultForm
                            :asct-id="asctId"
                            :council-detail="councilDetail ?? null"
                            :feasibility="feasibilityData ?? null"
                            :readonly="resultReadonly"
                            :confirmable="canConfirmResult"
                            @saved="onResultSaved"
                            @confirmed="onResultConfirmed"
                        />
                    </div>
                </div>

                <!-- ── FINAL_APPROVAL: 결재 요청 섹션 ── -->
                <div
                    v-if="canRequestApproval"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm"
                >
                    <div class="flex items-center gap-2 p-4 border-b border-blue-100 dark:border-blue-900">
                        <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600
                                     dark:text-blue-400 text-xs font-bold flex items-center justify-center">3</span>
                        <h2 class="font-semibold text-zinc-800 dark:text-zinc-200">결재 요청</h2>
                    </div>
                    <div class="p-4 flex flex-wrap items-center gap-3">
                        <!-- 결재자 지정 인라인 툴바 -->
                        <div class="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5">
                            <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300 shrink-0">결재자 지정</span>
                            <Button
                                :label="teamLead ? `${teamLead.name} (팀장)` : '팀장 선택'"
                                size="small"
                                severity="secondary"
                                text
                                :class="!teamLead ? 'text-blue-600 dark:text-blue-400' : ''"
                                :disabled="requestingApproval"
                                @click="openEmployeeSearch('teamLead')"
                            />
                            <span class="text-zinc-300 dark:text-zinc-600 select-none">|</span>
                            <Button
                                :label="deptHead ? `${deptHead.name} (부서장)` : '부서장 선택'"
                                size="small"
                                severity="secondary"
                                text
                                :class="!deptHead ? 'text-blue-600 dark:text-blue-400' : ''"
                                :disabled="requestingApproval"
                                @click="openEmployeeSearch('deptHead')"
                            />
                        </div>
                        <!-- 상신 버튼 -->
                        <Button
                            label="상신"
                            icon="pi pi-send"
                            :loading="requestingApproval"
                            :disabled="!teamLead || !deptHead"
                            @click="handleRequestApproval"
                        />
                    </div>
                </div>

                <!-- ── RESULT_APPROVAL_PENDING: 결재 대기 안내 ── -->
                <div
                    v-if="councilStatus === 'RESULT_APPROVAL_PENDING'"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                    <div class="p-6 text-center space-y-2">
                        <i class="pi pi-clock text-3xl text-amber-400 block" />
                        <p class="font-semibold text-zinc-800 dark:text-zinc-200">결재 대기 중</p>
                        <p class="text-sm text-zinc-500">결재자의 승인을 기다리고 있습니다.</p>
                    </div>
                </div>

                <!-- ── COMPLETED: 통보 섹션 ── -->
                <div
                    v-if="councilStatus === 'COMPLETED'"
                    class="bg-white dark:bg-zinc-900 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm"
                >
                    <div class="p-6 text-center space-y-3">
                        <i class="pi pi-check-circle text-4xl text-emerald-500 block" />
                        <p class="font-semibold text-zinc-800 dark:text-zinc-200">협의회가 완료되었습니다.</p>

                        <!-- 통보 완료 후: 수신자 정보 표시 -->
                        <template v-if="notifyResult">
                            <div class="inline-flex flex-col items-center gap-1 mt-2 px-5 py-3
                                        bg-emerald-50 dark:bg-emerald-900/30
                                        border border-emerald-200 dark:border-emerald-700
                                        rounded-lg text-sm">
                                <span class="text-emerald-700 dark:text-emerald-300 font-semibold">
                                    추진부서 통보가 완료되었습니다.
                                </span>
                                <div class="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mt-1">
                                    <i class="pi pi-user text-xs" />
                                    <span>
                                        <span class="font-medium text-zinc-800 dark:text-zinc-200">
                                            {{ notifyResult.bbrNm ?? '-' }}
                                        </span>
                                        &nbsp;/&nbsp;
                                        <span class="font-medium text-zinc-800 dark:text-zinc-200">
                                            {{ notifyResult.temNm ?? '-' }}
                                        </span>
                                        &nbsp;
                                        <span class="font-semibold text-emerald-700 dark:text-emerald-300">
                                            {{ notifyResult.usrNm ?? '-' }}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </template>

                        <!-- 통보 전: 버튼 표시 -->
                        <template v-else-if="canNotify">
                            <p class="text-sm text-zinc-500">추진부서 담당자에게 결과를 통보해 주세요.</p>
                            <Button
                                label="추진부서 통보"
                                icon="pi pi-bell"
                                severity="success"
                                :loading="notifying"
                                @click="handleNotify"
                            />
                        </template>
                    </div>
                </div>

            </template>

            <!-- 타당성검토표 참고 (접힌 섹션) -->
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

        </template>

    </div>

    <!-- ── 결재권자 검색 다이얼로그 ─────────────────────────────────────── -->
    <EmployeeSearchDialog
        v-model:visible="showEmployeeSearch"
        header="결재권자 검색"
        @select="onApproverSelect"
    />
</template>
