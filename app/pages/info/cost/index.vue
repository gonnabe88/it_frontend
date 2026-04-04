<!--
================================================================================
[pages/info/cost/index.vue] 전산업무비 목록 페이지
================================================================================
IT 관리비(전산업무비) 항목의 전체 목록을 인라인 편집 가능한 DataTable로 표시합니다.
컬럼 구성은 cost/form.vue와 동일하며, 목록에서 직접 수정 후 저장할 수 있습니다.

[주요 기능]
  - 전산업무비 목록 조회 및 인라인 편집
  - 금융정보단말기(itMngcTp=IT_MNGC_TP_002) 행은 예산·통화 수정 불가 (상세 화면에서 수정)
  - 예산 단위 전환 (원 / 천원 / 백만원 / 억원)
  - 관리번호 클릭 → 상세 페이지 이동
  - 포커스 아웃 / 값 변경 시 해당 행 자동 저장
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useCost, type ItCost } from '~/composables/useCost';
import { useToast } from "primevue/usetoast";
import { formatBudget as formatBudgetUtil } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

const title = '전산업무비 목록';
definePageMeta({ title: '전산업무비 목록' });

const { fetchCosts, updateCost } = useCost();
const toast = useToast();

/* ── 공통코드 옵션 로드 ──────────────────────────────────── */
interface CodeOption { cdId: string; cdNm: string; }

const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
const CCODEM_BASE = `${config.public.apiBase}/api/ccodem/type`;

/** 비목코드 옵션 (IOE_LEAFE · IOE_XPN · IOE_SEVS · IOE_IDR 병합) */
const ioeCOptions = ref<CodeOption[]>([]);
/** 계약구분 옵션 (CTT_TP) */
const pulDttOptions = ref<CodeOption[]>([]);
/** 지급주기 옵션 (DFR_CLE) */
const dfrCleOptions = ref<CodeOption[]>([]);
/** 사업코드 옵션 (ABUS_C) */
const abusCOptions = ref<CodeOption[]>([]);

/* ── 전산업무비 목록 데이터 ──────────────────────────────── */
const { data: costsRaw, error, refresh: refreshCostsRaw } = await fetchCosts();

/** 로컬 deep reactive 배열 (useFetch의 shallowRef는 내부 속성 변경을 감지하지 못함) */
const costs = ref<ItCost[]>([]);

/** 원본 스냅샷 (변경 감지용, itMngcNo → JSON 문자열) */
const snapshots = new Map<string, string>();

/** 비교 대상 필드 (서버에 저장되는 편집 가능 컬럼만) */
const COMPARE_KEYS: (keyof ItCost)[] = [
    'abusC', 'ioeC', 'cttNm', 'cttTp', 'cttOpp',
    'itMngcBg', 'cur', 'dfrCle', 'fstDfrDt',
    'cgpr', 'cgprNm', 'biceDpm', 'biceDpmNm', 'biceTem', 'biceTemNm',
];

/** 행의 비교용 스냅샷 문자열 생성 */
const toSnapshot = (row: ItCost): string => {
    const obj: Record<string, unknown> = {};
    for (const k of COMPARE_KEYS) {
        let v = row[k];
        /* Date → 문자열 정규화 (월까지만 비교) */
        if (v instanceof Date) v = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`;
        obj[k] = v ?? '';
    }
    return JSON.stringify(obj);
};

/** costsRaw(shallowRef) → costs(deep ref)로 동기화 + fstDfrDt 변환 + 스냅샷 저장 */
watch(costsRaw, (list) => {
    if (!list) return;
    list.forEach(cost => {
        if (cost.fstDfrDt && typeof cost.fstDfrDt === 'string') {
            cost.fstDfrDt = new Date(cost.fstDfrDt);
        }
    });
    costs.value = [...list];
    /* 원본 스냅샷 갱신 */
    snapshots.clear();
    costs.value.forEach(c => {
        if (c.itMngcNo) snapshots.set(c.itMngcNo, toSnapshot(c));
    });
}, { immediate: true });

/** 서버에서 다시 불러온 뒤 costs도 갱신 */
const refreshCosts = async () => { await refreshCostsRaw(); };

/** 저장 중인 행의 itMngcNo Set (중복 저장 방지) */
const savingRows = ref(new Set<string>());

/* ── 직원조회 다이얼로그 상태 ──────────────────────────────── */
const employeeDialogVisible = ref(false);
const selectedRowIndex = ref(-1);

/* ── 통화 선택지 ──────────────────────────────────────────── */
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];

/* ── 예산 단위 변환 ──────────────────────────────────────── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

/* ── 검색 필터 ──────────────────────────────────────────── */
const searchKeyword = ref('');
const filteredCosts = computed(() => {
    const kw = searchKeyword.value.trim().toLowerCase();
    if (!kw) return costs.value;
    return costs.value.filter(cost =>
        cost.ioeC?.toLowerCase().includes(kw) ||
        cost.cttNm?.toLowerCase().includes(kw) ||
        cost.cttOpp?.toLowerCase().includes(kw) ||
        cost.biceDpmNm?.toLowerCase().includes(kw) ||
        cost.cgprNm?.toLowerCase().includes(kw)
    );
});

/* ── 공통코드 초기 로드 ──────────────────────────────────── */
onMounted(async () => {
    try {
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, cttTpList, dfrCleList, abusCList] = await Promise.all([
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/CTT_TP`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
        ]);
        ioeCOptions.value = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value = cttTpList;
        dfrCleOptions.value = dfrCleList;
        abusCOptions.value = abusCList;
    } catch (e) {
        console.error('공통코드 로드 실패', e);
    }

});

/**
 * 금융정보단말기 여부 판별
 * itMngcTp가 IT_MNGC_TP_002이면 금융정보단말기로 예산·통화 수정 불가
 */
/** 전산업무비유형이 IT_MNGC_TP_002(금융정보단말기)이면 예산·통화 수정 불가 */
const isTerminal = (data: ItCost) => data.itMngcTp === 'IT_MNGC_TP_002';

/* ── 직원조회 ──────────────────────────────────────────── */
const openEmployeeSearch = (data: ItCost) => {
    selectedRowIndex.value = costs.value.findIndex(c => c.itMngcNo === data.itMngcNo);
    employeeDialogVisible.value = true;
};

const onEmployeeSelect = (selected: { eno: string; usrNm: string; bbrNm: string; temC: string | null; temNm: string | null; orgCode: string }) => {
    const idx = selectedRowIndex.value;
    const row = costs.value[idx];
    if (!row) return;
    row.cgpr = selected.eno;
    row.cgprNm = selected.usrNm;
    row.biceDpm = selected.orgCode;
    row.biceDpmNm = selected.bbrNm;
    row.biceTem = selected.temC ?? '';
    row.biceTemNm = selected.temNm ?? '';
    employeeDialogVisible.value = false;
    saveRow(row);
};

/* ── 행 단위 자동 저장 (포커스 아웃 / 값 변경 시) ──────────── */

/** 단일 행 저장 (원본과 비교하여 변경된 경우에만 실행) */
const saveRow = async (data: ItCost) => {
    if (!data.itMngcNo) return;
    if (savingRows.value.has(data.itMngcNo)) return;

    /* 변경 여부 확인 */
    const current = toSnapshot(data);
    if (snapshots.get(data.itMngcNo) === current) return;

    savingRows.value.add(data.itMngcNo);
    try {
        const payload = { ...data };
        /* fstDfrDt Date 객체 → 문자열 변환 */
        if (payload.fstDfrDt && payload.fstDfrDt instanceof Date) {
            const year = payload.fstDfrDt.getFullYear();
            const month = String(payload.fstDfrDt.getMonth() + 1).padStart(2, '0');
            payload.fstDfrDt = `${year}-${month}-01`;
        }
        await updateCost(data.itMngcNo, payload);
        /* 저장 성공 시 스냅샷 갱신 */
        snapshots.set(data.itMngcNo, current);
        toast.add({ severity: 'success', summary: '저장', detail: `${data.cttNm || data.itMngcNo} 저장 완료`, life: 1500 });
    } catch (e) {
        console.error('Save failed', e);
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        savingRows.value.delete(data.itMngcNo!);
    }
};

/**
 * 결재 상태에 따른 PrimeVue Tag 색상 클래스 반환
 */
const getApprovalTagClass = (status: string) => {
    switch (status) {
        case '완료': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        case '반려': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        case '진행중': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        default: return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 text-zinc-400';
    }
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더: 제목 + 검색 + 예산 단위 선택 + 액션 버튼 -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-3 flex-wrap">
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchKeyword" placeholder="통합 검색" class="w-64" />
                </IconField>
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="basic" />
                <Button label="전산업무비 등록" icon="pi pi-plus" @click="navigateTo('/info/cost/form')" />
            </div>
        </div>

        <!-- 데이터 테이블 영역 -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>

            <DataTable v-else :value="filteredCosts" showGridlines resizableColumns columnResizeMode="fit" paginator
                :rows="10" :rowsPerPageOptions="[10, 20, 50]" sortField="itMngcNo" :sortOrder="-1" removableSort
                dataKey="itMngcNo" tableStyle="min-width: 50rem" :pt="{
                    headerRow: { class: 'bg-blue-900 text-white dark:bg-blue-950' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' },
                    bodyCell: {},
                }">
                <!-- 사업코드 -->
                <Column field="abusC" header="사업코드" sortable style="min-width: 160px">
                    <template #body="{ data }">
                        <Select v-model="data.abusC" :options="abusCOptions" option-label="cdNm" option-value="cdId"
                            placeholder="사업코드 선택" class="w-full" @change="saveRow(data)" />
                    </template>
                </Column>

                <!-- 비목코드 -->
                <Column field="ioeC" header="비목코드" sortable style="min-width: 180px">
                    <template #body="{ data }">
                        <Select v-model="data.ioeC" :options="ioeCOptions" option-label="cdNm" option-value="cdId"
                            placeholder="비목코드 선택" class="w-full" @change="saveRow(data)" />
                    </template>
                </Column>

                <!-- 계약명 -->
                <Column field="cttNm" header="계약명" sortable style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttNm" class="w-full" @blur="saveRow(data)" />
                    </template>
                </Column>

                <!-- 계약구분 -->
                <Column field="cttTp" header="계약구분" sortable style="min-width: 140px">
                    <template #body="{ data }">
                        <Select v-model="data.cttTp" :options="pulDttOptions" option-label="cdNm" option-value="cdId"
                            placeholder="계약구분 선택" class="w-full" @change="saveRow(data)" />
                    </template>
                </Column>

                <!-- 계약상대처 -->
                <Column field="cttOpp" header="계약상대처" sortable style="min-width: 120px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttOpp" class="w-full" @blur="saveRow(data)" />
                    </template>
                </Column>

                <!-- 예산: 금융정보단말기는 disabled -->
                <Column field="itMngcBg" header="예산" sortable style="min-width: 120px">
                    <template #body="{ data }">
                        <span v-if="isTerminal(data)" v-tooltip.top="'단말기 상세 내용 작성 시 원화 환산 후 자동 계산됩니다.'">
                            <InputNumber v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                                locale="ko-KR" fluid disabled />
                        </span>
                        <InputNumber v-else v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                            locale="ko-KR" fluid @blur="saveRow(data)" />
                    </template>
                </Column>

                <!-- 통화: 금융정보단말기는 disabled -->
                <Column field="cur" header="통화" sortable style="width: 100px">
                    <template #body="{ data }">
                        <span v-if="isTerminal(data)" v-tooltip.top="'단말기 상세 내용 작성 시 원화 환산 후 자동 계산됩니다.'">
                            <Select v-model="data.cur" :options="currencyOptions" class="w-full" disabled />
                        </span>
                        <Select v-else v-model="data.cur" :options="currencyOptions" class="w-full"
                            @change="saveRow(data)" />
                    </template>
                </Column>

                <!-- 지급주기 -->
                <Column field="dfrCle" header="지급주기" sortable style="min-width: 140px">
                    <template #body="{ data }">
                        <Select v-model="data.dfrCle" :options="dfrCleOptions" option-label="cdNm" option-value="cdId"
                            placeholder="지급주기 선택" class="w-full" @change="saveRow(data)" />
                    </template>
                </Column>

                <!-- 최초지급일 -->
                <Column field="fstDfrDt" header="최초지급일" sortable style="min-width: 140px">
                    <template #body="{ data }">
                        <DatePicker v-model="data.fstDfrDt" view="month" dateFormat="yy-mm" showIcon fluid
                            placeholder="최초지급일" class="w-full" @date-select="saveRow(data)" />
                    </template>
                </Column>

                <!-- 담당자 -->
                <Column field="cgprNm" header="담당자" sortable style="min-width: 160px">
                    <template #body="{ data }">
                        <div class="flex items-center gap-1">
                            <span class="flex-1 text-sm truncate" :title="data.cgprNm || data.cgpr">
                                {{ data.cgprNm ? `${data.cgprNm} (${data.cgpr})` : (data.cgpr || '미선택') }}
                            </span>
                            <Button icon="pi pi-search" text size="small" @click="openEmployeeSearch(data)"
                                v-tooltip.top="'직원조회'" />
                        </div>
                    </template>
                </Column>

                <!-- 결재현황 태그 -->
                <Column field="apfSts" header="결재현황" sortable style="min-width: 100px">
                    <template #body="{ data }">
                        <Tag :value="data.apfSts || '예산 작성'" :class="getApprovalTagClass(data.apfSts)" class="border-0"
                            rounded />
                    </template>
                </Column>

                <!-- 상세: 금융정보단말기만 상세 화면 이동 버튼 표시 -->
                <Column header="상세" style="width: 60px; text-align: center">
                    <template #body="{ data }">
                        <Button v-if="isTerminal(data)" icon="pi pi-external-link" text rounded size="small"
                            v-tooltip.top="'단말기 상세 수정'"
                            @click="navigateTo(`/info/cost/terminal/form?id=${data.itMngcNo}`)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- 직원조회 다이얼로그 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onEmployeeSelect" />
    </div>
</template>

<style scoped>
/* 테이블 헤더 텍스트 가운데 정렬 */
:deep(.p-datatable-header-cell) {
    text-align: center;
    background: inherit !important;
    color: white !important;
    border-color: rgba(255, 255, 255, 0.2);
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}

:deep(.p-datatable-column-header-content) {
    justify-content: center;
}

:deep(.p-datatable-header-cell .p-datatable-sort-icon) {
    color: rgba(255, 255, 255, 0.7);
}

:deep(.p-datatable-header-cell[data-p-sorted="true"] .p-datatable-sort-icon) {
    color: white;
}

/* 셀 내부 input이 컬럼 너비에 맞게 축소되도록 처리 */
:deep(.p-datatable-body-cell) {
    overflow: hidden;
}

:deep(.p-datatable-body-cell .p-inputnumber),
:deep(.p-datatable-body-cell .p-inputnumber input) {
    width: 100%;
    min-width: 0;
}

/* 툴팁 max-width 확장 */
:global(.p-tooltip) {
    max-width: 450px !important;
}
:global(.p-tooltip-text) {
    max-width: 450px !important;
    white-space: nowrap;
}
</style>
