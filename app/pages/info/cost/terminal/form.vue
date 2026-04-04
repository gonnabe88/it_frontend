<!--
================================================================================
[pages/info/cost/terminal/form.vue] 금융정보단말기 등록/수정 폼 페이지
================================================================================
금융정보단말기 전산업무비 항목과 단말기 상세목록을 등록/수정하는 인라인 편집 테이블 폼입니다.
cost/form.vue 레이아웃을 기반으로 두 개의 DataTable로 구성됩니다.

[동작 모드]
  1. 신규 등록: ?id 없음  → 빈 데이터로 시작
  2. 수정:     ?id=값     → 해당 항목 로드

[UI 구성]
  - DataTable 1: 전산업무비 신청 (행 추가/삭제 불가, 단일 행)
    → 사업코드, 비목코드, 계약명, 계약구분, 계약상대처, 예산, 통화, 지급주기, 최초지급일, 담당자
  - DataTable 2: 단말기 상세목록 (행 추가/삭제 가능)
    → 단말기명, 이용방법, 용도, 금액, 통화, 지급주기, 비고

[저장 로직]
  - itMngcNo 존재 시: updateCost (PUT)
  - itMngcNo 없을 시: createCost (POST)
================================================================================
-->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useCost, type ItCost, type Terminal } from '~/composables/useCost';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useAuth } from '~/composables/useAuth';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { fetchCostOnce, createCost, updateCost } = useCost();
const { exchangeRates, convertToKRW } = useCurrencyRates();
const { user } = useAuth();

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
/** 단말기서비스 옵션 (TMN_SVC) */
const tmnSvcOptions = ref<CodeOption[]>([]);

const title = '금융정보단말기 등록';
definePageMeta({ title: '금융정보단말기 등록' });

/** 수정 모드 여부 */
const costId = route.query.id ? (route.query.id as string) : null;
const isEditMode = computed(() => !!costId);

/** 전산업무비 신청 데이터 (단일 행 배열로 DataTable 바인딩) */
const costs = ref<ItCost[]>([]);

/* ── 직원조회 다이얼로그 상태 ──────────────────────────────── */
const employeeDialogVisible = ref(false);
const selectedRowIndex = ref<number>(-1);
/** 단말기 담당자 직원조회 대상 행 인덱스 */
const terminalEmployeeDialogVisible = ref(false);
const selectedTerminalRowIndex = ref<number>(-1);

/** 현재 로그인 사용자의 부서/팀 정보 (신규 행 자동입력용) */
const currentUserDetail = ref<{ bbrC: string; bbrNm: string; temC: string; temNm: string } | null>(null);

/** 통화 선택지 옵션 (환율 API에서 동적으로 생성) */
const currencyOptions = computed(() => Object.keys(exchangeRates.value));

/** 총 예산 자동 계산 (단말기 금액을 원화 환산하여 합산) */
const totalBudget = computed(() => {
    const cost = costs.value[0];
    if (!cost?.terminals) return 0;
    return cost.terminals.reduce((sum, item) => {
        return sum + convertToKRW(item.tmlAmt || 0, item.cur || 'KRW');
    }, 0);
});

/** 단말기 금액 변경 시 전산업무비 예산 자동 갱신 */
watch(totalBudget, (val) => {
    if (costs.value[0]) {
        costs.value[0].itMngcBg = val;
    }
});

onMounted(async () => {
    /* 공통코드 + 현재 사용자 상세정보 병렬 로드 */
    try {
        const userEno = user.value?.eno ?? '';
        const userBase = `${config.public.apiBase}/api/users`;
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, cttTpList, dfrCleList, abusCList, tmnSvcList, userDetail] = await Promise.all([
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/CTT_TP`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/TMN_SVC`),
            userEno ? $apiFetch<{ bbrC: string; bbrNm: string; temC: string; temNm: string }>(`${userBase}/${userEno}`) : Promise.resolve(null),
        ]);
        ioeCOptions.value   = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value = cttTpList;
        dfrCleOptions.value = dfrCleList;
        abusCOptions.value  = abusCList;
        tmnSvcOptions.value = tmnSvcList;
        if (userDetail) currentUserDetail.value = userDetail;
    } catch (e) {
        console.error('초기 데이터 로드 실패', e);
    }

    if (isEditMode.value && costId) {
        /* 수정 모드: 기존 데이터 로드 */
        try {
            const costData = await fetchCostOnce(costId);
            if (costData) {
                if (costData.fstDfrDt) {
                    costData.fstDfrDt = new Date(costData.fstDfrDt);
                }
                costs.value = [costData];
            }
        } catch (e) {
            console.error('Failed to load cost data', e);
        }
    } else {
        /* 신규 등록 모드: 기본값으로 초기화된 단일 행 추가 */
        costs.value = [{
            ioeC: '금융정보단말기',
            cttNm: '',
            cttTp: '금융단말기',
            cttOpp: '',
            itMngcBg: 0,
            dfrCle: '',
            fstDfrDt: '',
            cur: 'KRW',
            xcr: 0,
            xcrBseDt: '',
            infPrtYn: 'N',
            indRsn: '',
            cgpr: user.value?.eno ?? '',
            cgprNm: user.value?.empNm ?? '',
            biceDpm: currentUserDetail.value?.bbrC ?? user.value?.bbrC ?? '',
            biceDpmNm: currentUserDetail.value?.bbrNm ?? '',
            biceTem: currentUserDetail.value?.temC ?? user.value?.temC ?? '',
            biceTemNm: currentUserDetail.value?.temNm ?? '',
            abusC: '',
            itMngcTp: 'IT_MNGC_TP_002',
            pulDtt: '',
            assetBg: 0,
            apfSts: '예산 작성',
            lstYn: 'Y',
            delYn: 'N',
            terminals: []
        }];
    }
});

/* ── 단말기 행 추가/삭제 ──────────────────────────────────── */

/** 단말기 상세 행 추가 */
const addTerminalRow = () => {
    const cost = costs.value[0];
    if (!cost) return;
    if (!cost.terminals) cost.terminals = [];
    cost.terminals.push({
        tmnNm: '',
        tmnTuzManr: '',
        tmnUsg: '',
        tmnSvc: '',
        tmlAmt: 0,
        cur: 'KRW',
        xcr: 1,
        xcrBseDt: new Date().toISOString().split('T')[0],
        dfrCle: '',
        indRsn: '',
        cgpr: '',
        biceTem: '',
        biceDpm: '',
        rmk: ''
    });
};

/** 단말기 상세 행 삭제 */
const removeTerminalRow = (index: number) => {
    const cost = costs.value[0];
    if (!cost?.terminals) return;
    cost.terminals.splice(index, 1);
};

/* ── 직원조회 ──────────────────────────────────────────── */

/** 직원조회 다이얼로그 열기 */
const openEmployeeSearch = (index: number) => {
    selectedRowIndex.value = index;
    employeeDialogVisible.value = true;
};

/** 직원조회 완료 처리 (전산업무비 신청 테이블의 담당자) */
const onEmployeeSelect = (selected: { eno: string; usrNm: string; bbrNm: string; temC: string | null; temNm: string | null; orgCode: string }) => {
    const row = costs.value[selectedRowIndex.value];
    if (!row) return;
    row.cgpr = selected.eno;
    row.cgprNm = selected.usrNm;
    row.biceDpm = selected.orgCode;
    row.biceDpmNm = selected.bbrNm;
    row.biceTem = selected.temC ?? '';
    row.biceTemNm = selected.temNm ?? '';
    employeeDialogVisible.value = false;
};

/** 단말기 담당자 직원조회 다이얼로그 열기 */
const openTerminalEmployeeSearch = (index: number) => {
    selectedTerminalRowIndex.value = index;
    terminalEmployeeDialogVisible.value = true;
};

/** 단말기 담당자 직원조회 완료 처리 */
const onTerminalEmployeeSelect = (selected: { eno: string; usrNm: string; bbrNm: string; temC: string | null; temNm: string | null; orgCode: string }) => {
    const terminals = costs.value[0]?.terminals;
    if (!terminals) return;
    const row = terminals[selectedTerminalRowIndex.value];
    if (!row) return;
    row.cgpr = selected.eno;
    row.cgprNm = selected.usrNm;
    row.biceDpm = selected.orgCode;
    row.biceTem = selected.temC ?? '';
    terminalEmployeeDialogVisible.value = false;
};

/* ── 저장 ──────────────────────────────────────────────── */

/** 날짜 포맷팅 (YYYY-MM-DD) */
const formatDate = (date: Date | null | string | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0]!;
};

/** 저장 실행 */
const executeSave = async () => {
    const cost = costs.value[0];
    if (!cost) {
        toast.add({ severity: 'warn', summary: '알림', detail: '저장할 데이터가 없습니다.', life: 3000 });
        return;
    }

    /* 저장용 Payload 구성 (날짜 포맷팅) */
    const payload: ItCost = {
        ...cost,
        fstDfrDt: cost.fstDfrDt instanceof Date
            ? `${cost.fstDfrDt.getFullYear()}-${String(cost.fstDfrDt.getMonth() + 1).padStart(2, '0')}-01`
            : (cost.fstDfrDt || ''),
        terminals: (cost.terminals || []).map(t => ({
            ...t,
            xcrBseDt: formatDate(t.xcrBseDt)
        }))
    };

    try {
        if (payload.itMngcNo) {
            await updateCost(payload.itMngcNo, payload);
        } else {
            await createCost(payload);
        }

        toast.add({ severity: 'success', summary: '저장 완료', detail: '저장되었습니다.', life: 2000 });
        setTimeout(() => router.push('/info/cost'), 500);
    } catch (e) {
        console.error('Save failed', e);
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    }
};

/** 저장 확인 다이얼로그 */
const handleSave = () => {
    confirm.require({
        message: isEditMode.value ? '수정하시겠습니까?' : '등록하시겠습니까?',
        header: '확인',
        icon: 'pi pi-question-circle',
        acceptLabel: '확인',
        rejectLabel: '취소',
        accept: executeSave
    });
};

/** 취소 처리 */
const cancel = () => {
    router.back();
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더: 제목 + 액션 버튼 그룹 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {{ isEditMode ? '금융정보단말기 수정' : '금융정보단말기 등록' }}
            </h1>
            <div class="flex gap-2">
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" icon="pi pi-save" @click="handleSave" />
            </div>
        </div>

        <!-- DataTable 1: 전산업무비 신청 (행 추가/삭제 불가) -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">전산업무비 신청</h3>
            <DataTable :value="costs" tableClass="editable-cells-table" :pt="{
                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
            }">
                <!-- 사업코드 -->
                <Column header="사업코드" style="min-width: 160px">
                    <template #body="{ data }">
                        <Select v-model="data.abusC" :options="abusCOptions" option-label="cdNm"
                            option-value="cdId" placeholder="사업코드 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 비목코드 -->
                <Column header="비목코드" style="min-width: 180px">
                    <template #body="{ data }">
                        <Select v-model="data.ioeC" :options="ioeCOptions" option-label="cdNm"
                            option-value="cdId" placeholder="비목코드 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 계약명 -->
                <Column header="계약명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttNm" class="w-full" />
                    </template>
                </Column>

                <!-- 계약구분 -->
                <Column header="계약구분" style="min-width: 140px">
                    <template #body="{ data }">
                        <Select v-model="data.cttTp" :options="pulDttOptions" option-label="cdNm"
                            option-value="cdId" placeholder="계약구분 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 계약상대처 -->
                <Column header="계약상대처" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttOpp" class="w-full" />
                    </template>
                </Column>

                <!-- 예산 (자동계산) -->
                <Column header="예산" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                            locale="ko-KR" class="w-full" disabled />
                    </template>
                </Column>

                <!-- 통화 (KRW 고정) -->
                <Column header="통화" style="width: 100px">
                    <template #body>
                        <InputText model-value="KRW" class="w-full" disabled />
                    </template>
                </Column>

                <!-- 지급주기 -->
                <Column header="지급주기" style="min-width: 140px">
                    <template #body="{ data }">
                        <Select v-model="data.dfrCle" :options="dfrCleOptions" option-label="cdNm"
                            option-value="cdId" placeholder="지급주기 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 최초지급일 -->
                <Column header="최초지급일" style="min-width: 140px">
                    <template #body="{ data }">
                        <DatePicker v-model="data.fstDfrDt" view="month" dateFormat="yy-mm" showIcon fluid
                            placeholder="최초지급일" class="w-full" />
                    </template>
                </Column>

                <!-- 담당자 -->
                <Column header="담당자" style="min-width: 160px">
                    <template #body="{ data, index }">
                        <div class="flex items-center gap-1">
                            <span class="flex-1 text-sm truncate" :title="data.cgprNm || data.cgpr">
                                {{ data.cgprNm ? `${data.cgprNm} (${data.cgpr})` : (data.cgpr || '미선택') }}
                            </span>
                            <Button icon="pi pi-search" text size="small" @click="openEmployeeSearch(index)"
                                v-tooltip.top="'직원조회'" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- DataTable 2: 단말기 상세목록 (행 추가/삭제 가능) -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">단말기 상세목록</h3>
                <Button label="행 추가" icon="pi pi-plus" severity="secondary" size="small" @click="addTerminalRow" />
            </div>
            <DataTable :value="costs[0]?.terminals || []" tableClass="editable-cells-table" :pt="{
                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
            }">
                <!-- No -->
                <Column header="No" style="width: 50px">
                    <template #body="{ index }">
                        {{ index + 1 }}
                    </template>
                </Column>

                <!-- 단말기명 -->
                <Column header="단말기명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.tmnNm" class="w-full" />
                    </template>
                </Column>

                <!-- 이용방법 -->
                <Column header="이용방법" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.tmnTuzManr" class="w-full" />
                    </template>
                </Column>

                <!-- 용도 -->
                <Column header="용도" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.tmnUsg" class="w-full" />
                    </template>
                </Column>

                <!-- 금액 -->
                <Column header="금액" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.tmlAmt" mode="currency" :currency="data.cur || 'KRW'"
                            locale="ko-KR" class="w-full" :min="0" />
                    </template>
                </Column>

                <!-- 통화 -->
                <Column header="통화" style="width: 100px">
                    <template #body="{ data }">
                        <Select v-model="data.cur" :options="currencyOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 지급주기 -->
                <Column header="지급주기" style="min-width: 140px">
                    <template #body="{ data }">
                        <Select v-model="data.dfrCle" :options="dfrCleOptions" option-label="cdNm"
                            option-value="cdId" placeholder="지급주기 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 단말기서비스 (공통코드 TMN_SVC) -->
                <Column header="단말기서비스" style="min-width: 160px">
                    <template #body="{ data }">
                        <Select v-model="data.tmnSvc" :options="tmnSvcOptions" option-label="cdNm"
                            option-value="cdId" placeholder="서비스 선택" class="w-full" />
                    </template>
                </Column>

                <!-- 증감사유 -->
                <Column header="증감사유" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.indRsn" class="w-full" />
                    </template>
                </Column>

                <!-- 담당자 -->
                <Column header="담당자" style="min-width: 160px">
                    <template #body="{ data, index }">
                        <div class="flex items-center gap-1">
                            <span class="flex-1 text-sm truncate" :title="data.cgprNm || data.cgpr">
                                {{ data.cgprNm ? `${data.cgprNm} (${data.cgpr})` : (data.cgpr || '미선택') }}
                            </span>
                            <Button icon="pi pi-search" text size="small" @click="openTerminalEmployeeSearch(index)"
                                v-tooltip.top="'직원조회'" />
                        </div>
                    </template>
                </Column>

                <!-- 비고 -->
                <Column header="비고" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.rmk" class="w-full" />
                    </template>
                </Column>

                <!-- 행 삭제 -->
                <Column header="삭제" style="width: 50px; text-align: center">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" text severity="danger" @click="removeTerminalRow(index)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- 직원조회 다이얼로그 (전산업무비 신청용) -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onEmployeeSelect" />
        <!-- 직원조회 다이얼로그 (단말기 담당자용) -->
        <EmployeeSearchDialog v-model:visible="terminalEmployeeDialogVisible" @select="onTerminalEmployeeSelect" />
    </div>
</template>
