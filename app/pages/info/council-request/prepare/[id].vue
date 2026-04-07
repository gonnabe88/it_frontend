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
  index.vue에서 PREPARING / SCHEDULED / IN_PROGRESS 상태인 협의회 클릭 시 라우팅됩니다.

[상태별 탭 활성화 규칙]
  PREPARING                : 탭1만 편집 가능 (탭3 비활성)
  SCHEDULED / IN_PROGRESS  : 탭1 readonly, 탭2~4 활성

[Design Ref: §4.3 prepare/[id].vue — 협의회 개최준비 (Step 2, IT관리자)]
================================================================================
-->
<script setup lang="ts">
import type { CouncilDetail, CouncilStatus, FeasibilityData } from '~/types/council';
import { useToast } from 'primevue/usetoast';
import { useAuth } from '~/composables/useAuth';

// ── 라우트 파라미터 ──────────────────────────────────────────────────
const route = useRoute();
const asctId = route.params.id as string;

const { fetchCouncil, fetchFeasibility } = useCouncil();
const { user } = useAuth();
const toast = useToast();

// ── 협의회 상세 조회 ─────────────────────────────────────────────────
const {
    data: councilDetail,
    pending: loadingCouncil,
    refresh: refreshCouncil,
} = fetchCouncil(asctId);

// ── 타당성검토표 조회 (일정공지 탭 표출용) ───────────────────────────
const {
    data: feasibilityData,
    pending: loadingFeasibility,
} = fetchFeasibility(asctId);

/** 협의회 현재 상태 */
const councilStatus = computed<CouncilStatus | null>(
    () => (councilDetail.value?.asctSts as CouncilStatus) ?? null
);

/** 심의유형 */
const dbrTp = computed(() => councilDetail.value?.dbrTp ?? null);

/**
 * 읽기 전용 여부 (평가위원 선정 탭)
 * PREPARING 상태에서만 편집 가능합니다.
 */
const committeeReadonly = computed(
    () => councilStatus.value !== 'PREPARING'
);

/**
 * 일정공지 탭 활성화 여부
 * SCHEDULED 이후에만 표출합니다.
 */
const noticeTabEnabled = computed(() => {
    const status = councilStatus.value;
    return status === 'SCHEDULED' || status === 'IN_PROGRESS'
        || status === 'EVALUATING' || status === 'RESULT_WRITING'
        || status === 'RESULT_REVIEW' || status === 'FINAL_APPROVAL'
        || status === 'COMPLETED';
});

/**
 * 추진부서 담당자 여부 (사전질의응답 답변 권한)
 * 실제 권한 체계에서는 소관부서 담당자(ITPZZ001)가 답변합니다.
 * IT관리자 화면이지만 QnA 답변은 ITPZZ001이 수행하므로
 * 여기서는 관리자(ITPAD001)도 답변 가능하도록 허용합니다.
 */
const canReplyQna = computed(() => true);

// ── 탭 상태 ─────────────────────────────────────────────────────────
const activeTabIndex = ref(0);

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
 * 상태가 SCHEDULED로 전이되므로 상세 정보를 새로고침하고 탭3으로 이동합니다.
 */
const onScheduleConfirmed = async () => {
    await refreshCouncil();
    /* 일정공지 탭으로 자동 이동 */
    activeTabIndex.value = 2;
};

// ── 페이지 상태별 안내 텍스트 ────────────────────────────────────────
const statusGuide = computed(() => {
    switch (councilStatus.value) {
        case 'PREPARING':
            return '평가위원을 선정하고 확정하면 위원들에게 일정 입력 요청이 발송됩니다.';
        case 'SCHEDULED':
            return '일정이 확정되었습니다. 평가위원들의 사전 질의에 답변해 주세요.';
        case 'IN_PROGRESS':
            return '협의회가 진행 중입니다.';
        default:
            return '';
    }
});

// ── 전체 로딩 ────────────────────────────────────────────────────────
const loading = computed(() => loadingCouncil.value || loadingFeasibility.value);
</script>

<template>
    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">

        <!-- 상단 헤더 -->
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <NuxtLink
                        to="/info/council-request"
                        class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        협의회 목록
                    </NuxtLink>
                    <span class="text-zinc-300 dark:text-zinc-600 text-xs">/</span>
                    <span class="text-xs text-zinc-500">개최준비</span>
                </div>
                <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">협의회 개최준비</h1>
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

        <!-- 로딩 스켈레톤 -->
        <div v-if="loading" class="space-y-4">
            <Skeleton height="3rem" class="w-full" />
            <Skeleton height="12rem" class="w-full" />
        </div>

        <!-- 탭 구조 -->
        <div v-else class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

            <Tabs v-model:value="activeTabIndex">
                <TabList class="border-b border-zinc-100 dark:border-zinc-800 px-4 pt-2">
                    <!-- 탭1: 평가위원 선정 -->
                    <Tab :value="0">
                        <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                            <i class="pi pi-users text-xs"></i>
                            평가위원 선정
                        </div>
                    </Tab>

                    <!-- 탭2: 일정 취합 -->
                    <Tab :value="1">
                        <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                            <i class="pi pi-calendar text-xs"></i>
                            일정 취합
                        </div>
                    </Tab>

                    <!-- 탭3: 일정공지 (SCHEDULED 이후 활성) -->
                    <Tab :value="2" :disabled="!noticeTabEnabled">
                        <div
                            class="flex items-center gap-1.5 py-1 px-1 text-sm"
                            :class="!noticeTabEnabled ? 'opacity-40' : ''"
                        >
                            <i class="pi pi-bell text-xs"></i>
                            일정공지
                        </div>
                    </Tab>

                    <!-- 탭4: 사전질의응답 -->
                    <Tab :value="3">
                        <div class="flex items-center gap-1.5 py-1 px-1 text-sm">
                            <i class="pi pi-comments text-xs"></i>
                            사전질의응답
                        </div>
                    </Tab>
                </TabList>

                <TabPanels>

                    <!-- ── 탭1: 평가위원 선정 ── -->
                    <TabPanel :value="0">
                        <div class="p-5">
                            <CommitteeSelector
                                :asctId="asctId"
                                :dbrTp="dbrTp"
                                :readonly="committeeReadonly"
                                @saved="onCommitteeSaved"
                            />
                        </div>
                    </TabPanel>

                    <!-- ── 탭2: 일정 취합 ── -->
                    <TabPanel :value="1">
                        <div class="p-5">
                            <ScheduleStatus
                                :asctId="asctId"
                                :readonly="committeeReadonly === false ? false : councilStatus === 'SCHEDULED'"
                                @confirmed="onScheduleConfirmed"
                            />
                        </div>
                    </TabPanel>

                    <!-- ── 탭3: 일정공지 ── -->
                    <TabPanel :value="2">
                        <div class="p-5">
                            <CouncilNotice
                                v-if="noticeTabEnabled"
                                :asctId="asctId"
                                :councilDetail="councilDetail"
                                :feasibility="feasibilityData"
                            />
                            <div v-else class="text-sm text-zinc-400 py-8 text-center">
                                일정 확정 후 표출됩니다.
                            </div>
                        </div>
                    </TabPanel>

                    <!-- ── 탭4: 사전질의응답 ── -->
                    <TabPanel :value="3">
                        <div class="p-5">
                            <CouncilQna
                                :asctId="asctId"
                                :canReply="canReplyQna"
                            />
                        </div>
                    </TabPanel>

                </TabPanels>
            </Tabs>

        </div>

        <!-- 타당성검토표 확인 (접힌 상태로 표출) -->
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

    </div>
</template>
