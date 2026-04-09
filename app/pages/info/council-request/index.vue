<!--
================================================================================
[pages/info/council-request/index.vue] 정보화실무협의회 사업목록
================================================================================
소관부서 담당자/IT관리자/평가위원별로 맞춤 협의회 목록을 표출하는 진입점 페이지입니다.

[주요 기능]
  - 권한별 협의회 목록 표출 (서버 측 필터링)
    · 일반사용자(ITPZZ001): 소속 부서 사업의 협의회
    · IT관리자(ITPAD001) : 전체 협의회
    · 평가위원            : 배정된 협의회만
  - 사업명/심의유형/진행상태 기준 클라이언트 필터링
  - CouncilStatusBadge 컴포넌트로 12단계 진행상태 색상 표출
  - 협의회 신청 Dialog (일반사용자 전용, 프로젝트 관리번호/순번/심의유형 입력)
  - 행 클릭 → 진행상태에 따라 단계별 페이지로 자동 라우팅

[라우팅 규칙 (협의회 상태 기준)]
  - DRAFT/SUBMITTED/APPROVAL_PENDING/APPROVED:
      → /info/council-request/{asctId}  (타당성검토표 Step 1)
  - PREPARING/SCHEDULED/IN_PROGRESS:
      → /info/council-request/prepare/{asctId}  (개최준비 Step 2)
  - EVALUATING/RESULT_WRITING/RESULT_REVIEW/FINAL_APPROVAL/COMPLETED:
      → /info/council-request/result/{asctId}  (개최 Step 3)

[Design Ref: §4.1 index.vue — 사업목록 + 진행상태]
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCouncil } from '~/composables/useCouncil';
import { getCouncilStatusLabel, getHearingTypeLabel } from '~/utils/common';

const title = '정보화실무협의회';
definePageMeta({ title });

/* ── 데이터 로드 ── */
const { fetchCouncilList, createCouncil } = useCouncil();
const { data: councilsData, pending, error, refresh } = await fetchCouncilList();

/** 협의회 목록 (null 안전 처리) */
const councils = computed(() => councilsData.value ?? []);

// ============================================================================
// 클라이언트 필터링
// ============================================================================

/** 사업명 검색어 */
const searchName = ref('');

/** 선택된 진행상태 필터 */
const selectedStatus = ref<string | null>(null);

/** 심의유형 필터 */
const selectedHearingType = ref<string | null>(null);

/** 목록에서 추출한 유니크 상태 옵션 (신청 전 null 제외) */
const statusOptions = computed(() => {
    const statuses = [...new Set(councils.value.map(c => c.asctSts))].filter((s): s is NonNullable<typeof s> => s !== null);
    return statuses.map(s => ({ label: getCouncilStatusLabel(s), value: s }));
});

/** 심의유형 옵션 */
const hearingTypeOptions = [
    { label: '정보시스템', value: 'INFO_SYS' },
    { label: '정보보호',   value: 'INFO_SEC' },
    { label: '기타',       value: 'ETC' },
];

/**
 * 사업명 + 진행상태 + 심의유형 필터링된 협의회 목록
 */
const filteredCouncils = computed(() => {
    return councils.value.filter(c => {
        /* 사업명 필터 */
        if (searchName.value && !c.prjNm?.includes(searchName.value)) return false;
        /* 진행상태 필터 */
        if (selectedStatus.value && c.asctSts !== selectedStatus.value) return false;
        /* 심의유형 필터 */
        if (selectedHearingType.value && c.dbrTp !== selectedHearingType.value) return false;
        return true;
    });
});

/**
 * 필터 초기화
 */
const resetFilters = () => {
    searchName.value = '';
    selectedStatus.value = null;
    selectedHearingType.value = null;
};

// ============================================================================
// 라우팅
// ============================================================================

/**
 * 카드 클릭 → 정보화사업 상세 페이지로 이동
 *
 * @param item 협의회 목록 항목
 */
const navigateToProject = (item: typeof filteredCouncils.value[0]) => {
    navigateTo(`/info/projects/${item.prjMngNo}`);
};

/**
 * 협의회 상태 뱃지 클릭 → 진행상태에 따라 협의회 단계별 페이지로 이동
 *
 * - Step 1 (타당성검토표): DRAFT, SUBMITTED, APPROVAL_PENDING, APPROVED
 * - Step 2 (개최준비):     PREPARING, SCHEDULED, IN_PROGRESS
 * - Step 3 (개최):         EVALUATING, RESULT_WRITING, RESULT_REVIEW, FINAL_APPROVAL, COMPLETED
 *
 * @param item 협의회 목록 항목
 */
const navigateToCouncil = (item: typeof filteredCouncils.value[0]) => {
    if (!item.asctId || !item.asctSts) return;

    const step1Statuses: string[] = ['DRAFT', 'SUBMITTED', 'APPROVAL_PENDING', 'APPROVED'];
    const step2Statuses: string[] = ['PREPARING', 'SCHEDULED', 'IN_PROGRESS'];

    if (step1Statuses.includes(item.asctSts)) {
        navigateTo(`/info/council-request/${item.asctId}`);
    } else if (step2Statuses.includes(item.asctSts)) {
        navigateTo(`/info/council-request/prepare/${item.asctId}`);
    } else {
        navigateTo(`/info/council-request/result/${item.asctId}`);
    }
};

/**
 * '협의회 신청' 뱃지 클릭 → 협의회 신청 Dialog 오픈
 *
 * 카드 클릭 이벤트가 전파되지 않도록 stopPropagation과 함께 사용합니다.
 *
 * @param item 협의회 목록 항목
 */
const openApplyDialog = (item: typeof filteredCouncils.value[0]) => {
    createForm.value = {
        prjMngNo: item.prjMngNo,
        prjSno: item.prjSno,
        dbrTp: '',
    };
    showCreateDialog.value = true;
};

// ============================================================================
// 협의회 신청 Dialog (일반사용자용)
// ============================================================================

/** 신청 Dialog 표시 여부 */
const showCreateDialog = ref(false);

/** 협의회 신청 폼 데이터 */
const createForm = ref({
    prjMngNo: '',
    prjSno: 1,
    dbrTp: '' as string,
});

/** 신청 처리 중 여부 */
const createPending = ref(false);

/**
 * 협의회 신청
 *
 * 신청 완료 후 목록을 새로 고침하고 생성된 협의회 페이지로 이동합니다.
 */
const submitCreate = async () => {
    if (!createForm.value.prjMngNo || !createForm.value.dbrTp) return;

    createPending.value = true;
    try {
        const asctId = await createCouncil({
            prjMngNo: createForm.value.prjMngNo,
            prjSno: createForm.value.prjSno,
            dbrTp: createForm.value.dbrTp,
        });
        showCreateDialog.value = false;
        /* 목록 갱신 후 신규 협의회(타당성검토표 Step 1)로 이동 */
        await refresh();
        navigateTo(`/info/council-request/${asctId}`);
    } catch (e: any) {
        alert(`협의회 신청 중 오류가 발생했습니다.\n${e?.data?.message ?? e?.message ?? '알 수 없는 오류'}`);
    } finally {
        createPending.value = false;
    }
};

/** 신청 Dialog 닫기 및 폼 초기화 */
const closeCreateDialog = () => {
    showCreateDialog.value = false;
    createForm.value = { prjMngNo: '', prjSno: 1, dbrTp: '' };
};

// ============================================================================
// 포맷 헬퍼
// ============================================================================

/**
 * 회의일자 포맷 (YYYY-MM-DD 형식으로 표출)
 *
 * @param cnrcDt 회의일자 문자열 (null 가능)
 * @returns 포맷된 날짜 또는 '-'
 */
const formatCnrcDt = (cnrcDt: string | null) => cnrcDt ? cnrcDt.slice(0, 10) : '-';

/**
 * 날짜 문자열 포맷 (YYYY-MM-DD → YYYY.MM.DD)
 *
 * @param dt 날짜 문자열 (null 가능)
 * @returns 포맷된 날짜 또는 null
 */
const formatDate = (dt: string | null) => dt ? dt.slice(0, 10).replace(/-/g, '.') : null;

/**
 * 사업예산 포맷 (억 단위 표출)
 *
 * @param prjBg 사업예산 (null 가능)
 * @returns 포맷된 금액 문자열 또는 null
 */
const formatBudget = (prjBg: number | null) => {
    if (prjBg == null) return null;
    if (prjBg >= 100_000_000) return `${(prjBg / 100_000_000).toFixed(1)}억`;
    if (prjBg >= 10_000) return `${(prjBg / 10_000).toFixed(0)}만`;
    return `${prjBg.toLocaleString()}원`;
};

/**
 * 사업유형 코드 → 라벨 변환
 *
 * @param prjTp 사업유형 코드 (null 가능)
 * @returns 라벨 문자열 또는 null
 */
const getPrjTpLabel = (prjTp: string | null) => {
    if (!prjTp) return null;
    const map: Record<string, string> = {
        'NEW': '신규', 'CNT': '계속', 'MNT': '유지보수', 'ETC': '기타',
    };
    return map[prjTp] ?? prjTp;
};
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <!-- 새로고침 -->
            <Button
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                :loading="pending"
                @click="() => refresh()"
                v-tooltip.top="'새로고침'"
            />
        </div>

        <!-- 필터 영역 -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div class="flex flex-wrap items-end gap-3">
                <!-- 사업명 검색 -->
                <div class="flex flex-col gap-1 min-w-[200px]">
                    <label class="text-sm font-medium text-zinc-600 dark:text-zinc-400">사업명</label>
                    <InputText
                        v-model="searchName"
                        placeholder="사업명 검색"
                        class="w-full"
                        @keyup.enter="() => {}"
                    />
                </div>

                <!-- 심의유형 필터 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-600 dark:text-zinc-400">심의유형</label>
                    <Select
                        v-model="selectedHearingType"
                        :options="hearingTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="전체"
                        showClear
                        class="min-w-[130px]"
                    />
                </div>

                <!-- 진행상태 필터 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-600 dark:text-zinc-400">진행상태</label>
                    <Select
                        v-model="selectedStatus"
                        :options="statusOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="전체"
                        showClear
                        class="min-w-[160px]"
                    />
                </div>

                <!-- 필터 초기화 -->
                <Button
                    label="초기화"
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    @click="resetFilters"
                />
            </div>
        </div>

        <!-- 에러 표시 -->
        <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
            데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
        </div>

        <!-- 로딩 스켈레톤 -->
        <div v-else-if="pending" class="space-y-3">
            <Skeleton v-for="i in 4" :key="i" height="72px" borderRadius="0.75rem" />
        </div>

        <!-- 협의회 목록 (카드 리스트) -->
        <div v-else-if="filteredCouncils.length > 0" class="space-y-3">
            <!--
                협의회 카드 — 클릭 시 진행상태에 따라 Step 1/2/3 페이지로 라우팅
                Plan SC: 권한별 맞춤 표출은 서버에서 처리하므로 프론트는 필터 없이 전체 렌더
            -->
            <div
                v-for="council in filteredCouncils"
                :key="council.applied ? council.asctId! : `${council.prjMngNo}-${council.prjSno}`"
                class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all"
                :class="!council.applied ? 'border-dashed' : ''"
                @click="navigateToProject(council)"
            >
                <!-- 상단: 사업명 + 상태 뱃지 -->
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <!-- 사업명 -->
                        <p class="font-bold text-zinc-900 dark:text-zinc-100 truncate text-base">
                            {{ council.prjNm ?? '—' }}
                        </p>
                        <!-- 협의회ID / 신청전 표시 + 사업관리번호 + 심의유형 + 회의일자 -->
                        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span v-if="council.applied">{{ council.asctId }}</span>
                            <span v-else class="text-amber-500 text-xs font-medium">신청 전</span>
                            <span class="ml-1 text-zinc-400 text-xs">{{ council.prjMngNo }}</span>
                            <span v-if="council.dbrTp" class="ml-2">
                                · {{ getHearingTypeLabel(council.dbrTp) }}
                            </span>
                            <span v-if="council.cnrcDt" class="ml-2">
                                · 회의일자 {{ formatCnrcDt(council.cnrcDt) }}
                            </span>
                        </p>
                    </div>

                    <!-- 우측: 진행상태 뱃지 + 아이콘 -->
                    <div class="flex items-center gap-3 flex-shrink-0">
                        <!-- 신청된 건: 뱃지 클릭 → 협의회 단계 페이지로 이동 -->
                        <CouncilStatusBadge
                            v-if="council.applied && council.asctSts"
                            :status="council.asctSts"
                            class="cursor-pointer hover:opacity-80 transition-opacity"
                            @click.stop="navigateToCouncil(council)"
                        />
                        <!-- 미신청 건: 뱃지 클릭 → 협의회 신청 Dialog 오픈 -->
                        <span v-else
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-700 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                            @click.stop="openApplyDialog(council)">
                            <i class="pi pi-plus-circle text-xs" />
                            협의회 신청
                        </span>
                        <i class="pi pi-chevron-right text-zinc-400 dark:text-zinc-600" />
                    </div>
                </div>

                <!-- 하단: 사업 상세 정보 칩 목록 -->
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <!-- 사업연도 -->
                    <span v-if="council.prjYy" class="flex items-center gap-1">
                        <i class="pi pi-calendar text-[10px]" />{{ council.prjYy }}년도
                    </span>
                    <!-- 사업유형 -->
                    <span v-if="getPrjTpLabel(council.prjTp)" class="flex items-center gap-1">
                        <i class="pi pi-tag text-[10px]" />{{ getPrjTpLabel(council.prjTp) }}
                    </span>
                    <!-- 주관부서 -->
                    <span v-if="council.svnDpm" class="flex items-center gap-1">
                        <i class="pi pi-building text-[10px]" />{{ council.svnDpm }}
                    </span>
                    <!-- 사업예산 -->
                    <span v-if="formatBudget(council.prjBg)" class="flex items-center gap-1">
                        <i class="pi pi-wallet text-[10px]" />{{ formatBudget(council.prjBg) }}
                    </span>
                    <!-- 사업기간 -->
                    <span v-if="formatDate(council.sttDt) || formatDate(council.endDt)" class="flex items-center gap-1">
                        <i class="pi pi-clock text-[10px]" />
                        {{ formatDate(council.sttDt) ?? '?' }} ~ {{ formatDate(council.endDt) ?? '?' }}
                    </span>
                    <!-- IT담당부서 -->
                    <span v-if="council.itDpm" class="flex items-center gap-1">
                        <i class="pi pi-desktop text-[10px]" />IT: {{ council.itDpm }}
                    </span>
                    <!-- 사업설명 (최대 60자) -->
                    <span v-if="council.prjDes" class="flex items-center gap-1 w-full truncate">
                        <i class="pi pi-align-left text-[10px]" />
                        <span class="truncate">{{ council.prjDes.length > 60 ? council.prjDes.slice(0, 60) + '…' : council.prjDes }}</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- 빈 상태 -->
        <div
            v-else
            class="bg-white dark:bg-zinc-900 p-12 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center"
        >
            <i class="pi pi-inbox text-4xl text-zinc-300 dark:text-zinc-600 mb-4 block" />
            <p class="text-zinc-500 dark:text-zinc-400">
                {{ searchName || selectedStatus || selectedHearingType ? '검색 조건에 맞는 협의회가 없습니다.' : '신청된 협의회가 없습니다.' }}
            </p>
            <Button
                v-if="searchName || selectedStatus || selectedHearingType"
                label="필터 초기화"
                severity="secondary"
                text
                class="mt-3"
                @click="resetFilters"
            />
        </div>

        <!-- 협의회 신청 Dialog -->
        <Dialog
            v-model:visible="showCreateDialog"
            header="협의회 신청"
            :modal="true"
            :closable="true"
            class="w-full max-w-sm"
            @hide="closeCreateDialog"
        >
            <div class="flex flex-col gap-5 pt-2">
                <!-- 심의유형 -->
                <div class="flex flex-col gap-2">
                    <label class="font-semibold text-sm">
                        심의유형
                        <span class="text-red-500">*</span>
                    </label>
                    <Select
                        v-model="createForm.dbrTp"
                        :options="hearingTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="심의유형 선택"
                        fluid
                    />
                </div>

                <!-- 안내 문구 -->
                <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <i class="pi pi-info-circle mt-0.5 flex-shrink-0" />
                    <span>타당성검토표를 작성하시겠습니까?</span>
                </div>
            </div>

            <!-- Dialog 버튼 -->
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    outlined
                    @click="closeCreateDialog"
                />
                <Button
                    label="확인"
                    icon="pi pi-check"
                    :loading="createPending"
                    :disabled="!createForm.dbrTp"
                    @click="submitCreate"
                />
            </template>
        </Dialog>

    </div>
</template>
