<!--
================================================================================
[pages/info/council-request/[id].vue] 타당성검토표 작성/조회 (Step 1)
================================================================================
협의회 신청 후 소관부서 담당자가 타당성검토표를 작성하는 Step 1 페이지입니다.

[주요 기능]
  - 타당성검토표 3개 섹션 조합 표출
    · FeasibilityOverview  : 1. 사업 개요
    · FeasibilityChecklist : 2. 타당성 자체점검 (6항목 점수+내용)
    · FeasibilityPerformance: 3. 성과관리 자체계획 (동적 성과지표)
  - 임시저장 (kpnTp=TEMP): 유효성 검사 없이 저장
  - 작성완료 (kpnTp=COMPLETE): 전체 유효성 검사 후 상태 SUBMITTED 전이
  - 결재 요청 Dialog: 작성완료 후 팀장 사번 입력 → 결재 신청
  - 첨부파일 업로드: hwp/hwpx/pdf 단건 필수 (작성완료 시)
  - readonly 모드: 협의회 상태 SUBMITTED 이상이면 모든 입력 비활성화

[라우팅]
  - 진입: /info/council-request/{asctId}
  - 이전: /info/council (목록)

[Design Ref: §4.2 [id].vue — 타당성검토표 (Step 1)]
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FeasibilityData, CheckItemData, PerformanceItem } from '~/types/council';
import { useCouncil } from '~/composables/useCouncil';
import { useFiles } from '~/composables/useFiles';
import { getCouncilStatusLabel } from '~/utils/common';

const title = '타당성검토표 작성';
definePageMeta({ title });

/* ── 라우트 파라미터 ── */
const route = useRoute();
const asctId = route.params.id as string;

/* ── Composables ── */
const { fetchCouncil, fetchFeasibility, saveFeasibility, requestApproval } = useCouncil();
const { uploadFile, getDownloadUrl } = useFiles();
const toast = useToast();

// ============================================================================
// 데이터 로드
// ============================================================================

/**
 * 협의회 기본 정보 및 타당성검토표 데이터를 병렬로 조회합니다.
 * 두 API를 순차 호출하더라도 Nuxt SSR 컨텍스트에서 안전하게 처리됩니다.
 */
const { data: councilData, refresh: refreshCouncil } = await fetchCouncil(asctId);
const { data: feasibilityRaw } = await fetchFeasibility(asctId);

// ============================================================================
// 기본값 정의
// ============================================================================

/**
 * 타당성 자체점검 6개 항목 기본값
 * 서버에서 반환하지 않을 경우 프론트에서 초기화합니다.
 * Plan SC: MGMT_STR / FIN_EFC / RISK_IMP / REP_IMP / DUP_SYS / ETC 6개 고정
 */
const DEFAULT_CHECK_ITEMS: CheckItemData[] = [
    { ckgItmC: 'MGMT_STR', ckgItmNm: '경영전략/계획 부합',    ckgCone: '', ckgRcrd: null },
    { ckgItmC: 'FIN_EFC',  ckgItmNm: '재무 효과',            ckgCone: '', ckgRcrd: null },
    { ckgItmC: 'RISK_IMP', ckgItmNm: '리스크 개선 효과',      ckgCone: '', ckgRcrd: null },
    { ckgItmC: 'REP_IMP',  ckgItmNm: '평판/이미지 개선 효과', ckgCone: '', ckgRcrd: null },
    { ckgItmC: 'DUP_SYS',  ckgItmNm: '유사/중복 시스템 유무', ckgCone: '', ckgRcrd: null },
    { ckgItmC: 'ETC',      ckgItmNm: '기타',                 ckgCone: '', ckgRcrd: null },
];

/** 성과지표 기본값 */
const DEFAULT_PERFORMANCE: PerformanceItem = {
    dtpSno: 1, dtpNm: '', dtpCone: '', msmManr: '', clf: '',
    glNv: '', msmSttDt: null, msmEndDt: null, msmTpm: '', msmCle: '',
};

/** 타당성검토표 전체 폼 기본값 */
const DEFAULT_FORM: FeasibilityData = {
    prjNm: '', prjTrm: '', ncs: '', prjBg: null, edrt: '', prjDes: '',
    lglRglYn: 'N', lglRglNm: null, xptEff: '', kpnTp: 'TEMP',
    checkItems: DEFAULT_CHECK_ITEMS.map(item => ({ ...item })),
    performances: [{ ...DEFAULT_PERFORMANCE }],
    flMngNo: null,
};

// ============================================================================
// 폼 상태
// ============================================================================

/** 타당성검토표 폼 데이터 (v-model 바인딩 대상) */
const form = ref<FeasibilityData>({ ...DEFAULT_FORM });

/**
 * 저장 이력 여부 (최초 저장 이후 PUT 사용)
 * 서버에서 prjNm이 있으면 기존 저장 데이터로 판단합니다.
 */
const savedOnce = ref(false);

/**
 * 서버 응답으로 폼 초기화
 * checkItems가 없거나 비어있으면 기본값으로 대체합니다.
 */
const initForm = (data: FeasibilityData | null) => {
    if (!data) return;
    form.value = {
        ...DEFAULT_FORM,
        ...data,
        checkItems: (data.checkItems && data.checkItems.length > 0)
            ? data.checkItems
            : DEFAULT_CHECK_ITEMS.map(item => ({ ...item })),
        performances: (data.performances && data.performances.length > 0)
            ? data.performances
            : [{ ...DEFAULT_PERFORMANCE }],
    };
    /* prjNm이 있으면 이미 한 번 이상 저장된 데이터 → 이후 PUT 사용 */
    if (data.prjNm) savedOnce.value = true;
};

/* 최초 로드 시 폼 초기화 */
initForm(feasibilityRaw.value);

// ============================================================================
// Computed
// ============================================================================

/** 협의회 진행상태 */
const councilStatus = computed(() => councilData.value?.asctSts ?? 'DRAFT');

/**
 * 읽기 전용 여부
 * DRAFT 상태일 때만 편집 가능합니다.
 */
const readonly = computed(() => councilStatus.value !== 'DRAFT');

/**
 * SUBMITTED 상태: 결재 요청 버튼 표출 조건
 * 작성완료 이후 팀장 결재를 신청할 수 있습니다.
 */
const isSubmitted = computed(() => councilStatus.value === 'SUBMITTED');

// ============================================================================
// 파일 업로드
// ============================================================================

/** 파일 입력 엘리먼트 참조 */
const fileInput = ref<HTMLInputElement | null>(null);

/** 업로드된 파일 정보 (새로 업로드한 경우에만 설정) */
const uploadedFileName = ref<string | null>(null);

/** 파일 업로드 진행 중 여부 */
const fileUploadPending = ref(false);

/**
 * 파일 선택 시 즉시 업로드
 * hwp/hwpx/pdf 확장자만 허용합니다.
 *
 * @param event 파일 input 변경 이벤트
 */
const onFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    /* 확장자 검증: hwp / hwpx / pdf */
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['hwp', 'hwpx', 'pdf'].includes(ext)) {
        toast.add({
            severity: 'warn',
            summary: '파일 형식 오류',
            detail: 'hwp, hwpx, pdf 파일만 첨부 가능합니다.',
            life: 4000,
        });
        input.value = '';
        return;
    }

    fileUploadPending.value = true;
    try {
        /* /api/files 업로드 → flMngNo 획득 */
        const result = await uploadFile(file, '첨부파일', asctId, '타당성검토표');
        form.value.flMngNo = result.flMngNo;
        uploadedFileName.value = file.name;
        toast.add({ severity: 'success', summary: '파일 업로드 완료', life: 2000 });
    } catch {
        toast.add({
            severity: 'error',
            summary: '파일 업로드 실패',
            detail: '파일을 업로드하는 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        fileUploadPending.value = false;
        input.value = '';
    }
};

// ============================================================================
// 저장
// ============================================================================

/** 임시저장 / 작성완료 진행 중 여부 */
const savePending = ref(false);

/**
 * 작성완료 유효성 검사
 *
 * @returns 오류 메시지 배열 (빈 배열이면 통과)
 */
const validateForComplete = (): string[] => {
    const errors: string[] = [];

    /* 1. 사업명 필수 */
    if (!form.value.prjNm.trim()) {
        errors.push('사업명을 입력하세요.');
    }

    /* 2. 타당성 자체점검: 모든 항목에 내용 + 점수 필요 */
    const incompleteItems = form.value.checkItems.filter(
        item => !item.ckgCone.trim() || item.ckgRcrd === null
    );
    if (incompleteItems.length > 0) {
        errors.push(
            `타당성 자체점검 미입력 항목이 있습니다: ${incompleteItems.map(i => i.ckgItmNm).join(', ')}`
        );
    }

    /* 3. 성과지표: 지표명 있는 항목이 1개 이상 필요 */
    const hasValidPerformance = form.value.performances.some(p => p.dtpNm.trim());
    if (!hasValidPerformance) {
        errors.push('성과지표를 1개 이상 입력하세요 (지표명 필수).');
    }

    /* 4. 첨부파일 필수 */
    if (!form.value.flMngNo) {
        errors.push('첨부파일을 등록하세요 (hwp/hwpx/pdf).');
    }

    return errors;
};

/**
 * 임시저장
 * 유효성 검사 없이 현재 폼 상태를 TEMP로 저장합니다.
 */
const saveTemp = async () => {
    savePending.value = true;
    try {
        await saveFeasibility(asctId, { ...form.value, kpnTp: 'TEMP' }, savedOnce.value);
        savedOnce.value = true;
        toast.add({ severity: 'success', summary: '임시저장 완료', life: 2000 });
    } catch {
        toast.add({
            severity: 'error',
            summary: '저장 실패',
            detail: '임시저장 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        savePending.value = false;
    }
};

/**
 * 작성완료
 * 유효성 검사 통과 시 COMPLETE로 저장하고 결재 요청 Dialog를 표출합니다.
 */
const saveComplete = async () => {
    /* 유효성 검사 */
    const errors = validateForComplete();
    if (errors.length > 0) {
        toast.add({
            severity: 'warn',
            summary: '작성 완료 불가',
            detail: errors.join('\n'),
            life: 6000,
        });
        return;
    }

    savePending.value = true;
    try {
        await saveFeasibility(asctId, { ...form.value, kpnTp: 'COMPLETE' }, savedOnce.value);
        savedOnce.value = true;
        /* 협의회 상태 갱신 후 결재 요청 Dialog 오픈 */
        await refreshCouncil();
        showApprovalDialog.value = true;
    } catch {
        toast.add({
            severity: 'error',
            summary: '저장 실패',
            detail: '작성완료 처리 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        savePending.value = false;
    }
};

// ============================================================================
// 결재 요청 Dialog
// ============================================================================

/** 결재 요청 Dialog 표출 여부 */
const showApprovalDialog = ref(false);

/** 결재 요청 폼 */
const approvalForm = ref({
    approverEno: '',
    rqsOpnn: '',
});

/** 결재 요청 진행 중 여부 */
const approvalPending = ref(false);

/**
 * 결재 요청 Dialog 닫기 및 초기화
 */
const closeApprovalDialog = () => {
    showApprovalDialog.value = false;
    approvalForm.value = { approverEno: '', rqsOpnn: '' };
};

/**
 * 결재 요청 제출
 * 팀장 사번으로 결재를 신청합니다. 완료 후 협의회 상태가 APPROVAL_PENDING으로 전이됩니다.
 */
const submitApproval = async () => {
    if (!approvalForm.value.approverEno.trim()) return;

    approvalPending.value = true;
    try {
        await requestApproval(
            asctId,
            approvalForm.value.approverEno.trim(),
            approvalForm.value.rqsOpnn.trim() || undefined
        );
        closeApprovalDialog();
        toast.add({ severity: 'success', summary: '결재 요청 완료', life: 2000 });
        /* 상태 갱신 후 목록으로 이동 */
        await refreshCouncil();
        navigateTo('/info/council-request');
    } catch {
        toast.add({
            severity: 'error',
            summary: '결재 요청 실패',
            detail: '결재 요청 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        approvalPending.value = false;
    }
};
</script>

<template>
    <div class="space-y-6 max-w-4xl mx-auto">

        <!-- ── 페이지 헤더 ── -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <!-- 뒤로가기 -->
                <Button
                    icon="pi pi-arrow-left"
                    severity="secondary"
                    text
                    @click="navigateTo('/info/council-request')"
                    v-tooltip.top="'목록으로'"
                />
                <div>
                    <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{{ asctId }}</p>
                </div>
            </div>
            <!-- 진행상태 뱃지 -->
            <CouncilStatusBadge v-if="councilData" :status="councilData.asctSts" size="md" />
        </div>

        <!--
            ── 읽기 전용 안내 (SUBMITTED 이상) ──
            Plan SC: SUBMITTED 이후 편집 불가 (readonly=true)
        -->
        <Message v-if="readonly" severity="info" :closable="false">
            <template #default>
                {{ getCouncilStatusLabel(councilStatus) }} 상태입니다. 타당성검토표를 수정할 수 없습니다.
            </template>
        </Message>

        <!-- ── SUBMITTED 상태: 결재 요청 버튼 ── -->
        <div v-if="isSubmitted" class="flex justify-end">
            <Button
                label="결재 요청"
                icon="pi pi-send"
                @click="showApprovalDialog = true"
            />
        </div>

        <!--
            ── 타당성검토표 3개 섹션 ──
            Design Ref: §3.2 FeasibilityForm.vue — 래퍼 컴포넌트
            (사업개요 + 타당성 자체점검 + 성과관리 자체계획)
        -->
        <FeasibilityForm
            v-model="form"
            :readonly="readonly"
        />

        <!--
            ── 첨부파일 ──
            작성완료 시 hwp/hwpx/pdf 파일 필수 첨부
        -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
            <h2 class="font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                첨부파일
                <span v-if="!readonly" class="text-red-500 text-sm ml-1">* 작성완료 시 필수</span>
            </h2>

            <!-- 기존 첨부파일 표시 -->
            <div v-if="form.flMngNo && !uploadedFileName" class="flex items-center gap-3 mb-3">
                <i class="pi pi-file text-indigo-500" />
                <span class="text-sm text-zinc-700 dark:text-zinc-300">첨부파일이 등록되어 있습니다.</span>
                <a
                    :href="getDownloadUrl(form.flMngNo)"
                    target="_blank"
                    class="text-sm text-indigo-600 dark:text-indigo-400 underline"
                >
                    다운로드
                </a>
            </div>

            <!-- 새로 업로드된 파일 표시 -->
            <div v-if="uploadedFileName" class="flex items-center gap-3 mb-3">
                <i class="pi pi-check-circle text-green-500" />
                <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ uploadedFileName }}</span>
                <span class="text-xs text-green-600 dark:text-green-400">업로드 완료</span>
            </div>

            <!-- 파일 없음 안내 -->
            <div v-if="!form.flMngNo && !uploadedFileName" class="text-sm text-zinc-400 dark:text-zinc-500 mb-3">
                첨부파일이 없습니다.
            </div>

            <!-- 파일 선택 버튼 (편집 모드에서만 표출) -->
            <div v-if="!readonly">
                <input
                    ref="fileInput"
                    type="file"
                    accept=".hwp,.hwpx,.pdf"
                    class="hidden"
                    @change="onFileChange"
                />
                <Button
                    :label="form.flMngNo ? '파일 교체' : '파일 선택'"
                    icon="pi pi-upload"
                    severity="secondary"
                    outlined
                    size="small"
                    :loading="fileUploadPending"
                    @click="fileInput?.click()"
                />
                <span class="text-xs text-zinc-400 dark:text-zinc-500 ml-2">hwp, hwpx, pdf 가능</span>
            </div>
        </div>

        <!--
            ── 저장 버튼 영역 (편집 모드에서만 표출) ──
            Plan SC: 임시저장 = DRAFT 유지, 작성완료 = SUBMITTED 전이 + 결재 Dialog
        -->
        <div v-if="!readonly" class="flex justify-end gap-3 pb-6">
            <Button
                label="임시저장"
                icon="pi pi-save"
                severity="secondary"
                outlined
                :loading="savePending"
                @click="saveTemp"
            />
            <Button
                label="작성완료"
                icon="pi pi-check"
                :loading="savePending"
                @click="saveComplete"
            />
        </div>

    </div>

    <!--
        ── 결재 요청 Dialog ──
        작성완료 후 또는 SUBMITTED 상태에서 팀장 결재를 신청합니다.
        Design Ref: §4.2 [id].vue — 결재 요청 Dialog
    -->
    <Dialog
        v-model:visible="showApprovalDialog"
        header="결재 요청"
        :modal="true"
        :closable="true"
        class="w-full max-w-md"
        @hide="closeApprovalDialog"
    >
        <div class="flex flex-col gap-5 pt-2">
            <Message severity="info" :closable="false" class="text-sm">
                타당성검토표가 작성완료 되었습니다. 팀장에게 결재를 요청하세요.
            </Message>

            <!-- 결재자(팀장) 사번 -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold text-sm">
                    결재자 사번 (팀장)
                    <span class="text-red-500">*</span>
                </label>
                <InputText
                    v-model="approvalForm.approverEno"
                    placeholder="팀장 사번 입력"
                    fluid
                />
            </div>

            <!-- 신청의견 (선택) -->
            <div class="flex flex-col gap-2">
                <label class="font-semibold text-sm">신청의견 (선택)</label>
                <Textarea
                    v-model="approvalForm.rqsOpnn"
                    placeholder="신청의견을 입력하세요 (선택)"
                    rows="3"
                    fluid
                />
            </div>
        </div>

        <template #footer>
            <Button
                label="나중에"
                severity="secondary"
                outlined
                @click="closeApprovalDialog"
            />
            <Button
                label="결재 요청"
                icon="pi pi-send"
                :loading="approvalPending"
                :disabled="!approvalForm.approverEno.trim()"
                @click="submitApproval"
            />
        </template>
    </Dialog>
</template>
