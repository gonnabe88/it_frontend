<!--
================================================================================
[pages/info/cost/form.vue] 전산업무비 신청/수정 폼 페이지
================================================================================
전산업무비 항목을 신규 등록하거나 기존 항목을 수정하는 페이지입니다.
쿼리 파라미터에 따라 3가지 모드로 동작합니다.

[동작 모드]
  1. 신규 등록: ?id 없음        → 빈 행 1개로 시작, 인라인 DataTable
  2. 단건 수정: ?id=itMngcNo    → 해당 항목 1건 로드, 섹션별 폼 UI
  3. 복수 수정: ?ids=id1,id2    → 복수 항목 일괄 로드, 인라인 DataTable

[라우팅]
  - 접근: /info/cost/form
  - 단건 수정 접근: /info/cost/form?id=:id
  - 복수 수정 접근: /info/cost/form?ids=id1,id2,...
  - 저장 완료 후: /info/cost
  - 취소 시: router.back()

[UI 구성]
  - 단건 수정: 섹션별 폼 (계약 정보 / 예산 및 지급 / 기타 정보 / 담당 조직)
    + 금융정보단말기 유형(IT_MNGC_TP_002)일 때 단말기 상세목록 섹션 추가
  - 신규/복수 수정: 인라인 편집 DataTable (CostFormTableSection)

[저장 로직]
  - itMngcNo 존재 시: updateCost (PUT) 호출
  - itMngcNo 없을 시: createCost (POST) 호출
  - fstDfrDt(Date 객체)는 YYYY-MM-01 문자열로 변환 후 전송
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useEmployeeSearch, type UserSuggestion, type DialogEmployeeResult } from '~/composables/useEmployeeSearch';
import CostFormTableSection from '~/components/cost/CostFormTableSection.vue';
import TerminalTableSection from '~/components/cost/TerminalTableSection.vue';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { removeTab } = useTabs();
const { fetchCostOnce, createCost, updateCost, fetchCostsBulk } = useCost();
const { user } = useAuth();

/* ── 공통코드 옵션 로드 ──────────────────────────────────── */
interface CodeOption { cdId: string; cdNm: string; }

const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
const CCODEM_BASE = `${config.public.apiBase}/api/ccodem/type`;

/** 비목코드 옵션 (IOE_LEAFE · IOE_XPN · IOE_SEVS · IOE_IDR 병합) */
const ioeCOptions = ref<CodeOption[]>([]);
/** 구분 옵션 (PUL_DTT) */
const pulDttOptions = ref<CodeOption[]>([]);
/** 지급주기 옵션 (DFR_CLE) */
const dfrCleOptions = ref<CodeOption[]>([]);
/** 사업코드 옵션 (ABUS_C) */
const abusCOptions = ref<CodeOption[]>([]);
/** 단말기서비스 옵션 (TMN_SVC) — 금융정보단말기 섹션용 */
const tmnSvcOptions = ref<CodeOption[]>([]);
/** 전산업무비유형 옵션 (IT_MNGC_TP) */
const itMngcTpOptions = ref<CodeOption[]>([]);

const title = '전산업무비 신청/수정';
// key: fullPath 기준으로 KeepAlive 캐시 분리 → 쿼리 파라미터가 다른 탭마다 별개 인스턴스
definePageMeta({
    title,
    middleware: ['budget-period'],
    key: route => route.fullPath
});

/** 현재 편집 중인 전산업무비 항목 목록 */
const costs = ref<ItCost[]>([]);

/** 현재 로그인 사용자의 부서/팀 정보 (신규 행 자동입력용) */
const currentUserDetail = ref<{ bbrC: string; bbrNm: string; temC: string; temNm: string } | null>(null);

/* ── 모드 계산 ──────────────────────────────────────────── */
/** 단건 수정 모드 여부 (?id= 파라미터 존재) */
const isEditMode = computed(() => !!route.query.id);
/** 복수 수정 모드 여부 (?ids= 파라미터 존재) */
const isBulk = computed(() => !!route.query.ids);
/** 섹션 폼 UI를 표시할 조건: ?id= 있고 ?ids= 없을 때 */
const isEditSingle = computed(() => isEditMode.value && !isBulk.value);
/** 금융정보단말기 유형 여부 (IT_MNGC_TP_002, 단말기 섹션 표시 조건) */
const isTerminalType = computed(() => costs.value[0]?.itMngcTp === 'IT_MNGC_TP_002');

/* ── 환율/통화 옵션 ─────────────────────────────────────── */
const { exchangeRates } = useCurrencyRates();
/** 통화 선택 옵션 목록 (KRW 포함) */
const currencyOptions = computed(() => Object.keys(exchangeRates.value));

/* ── 담당자 검색 (단건 수정 폼용) ──────────────────────── */
const {
    employeeSuggestions: cgprSuggestions,
    employeeDialogVisible: showCgprDialog,
    searchEmployee: searchCgpr,
    openEmployeeSearch: openCgprDialog,
} = useEmployeeSearch();

/**
 * AutoComplete에서 직원을 선택했을 때 담당자 정보를 갱신합니다.
 */
const onCgprSelect = (suggestion: UserSuggestion) => {
    const cost = costs.value[0];
    if (!cost) return;
    cost.cgpr = suggestion.eno;
    cost.cgprNm = suggestion.usrNm;
    cost.biceDpm = suggestion.bbrC;
    cost.biceDpmNm = suggestion.bbrNm;
    cost.biceTem = suggestion.temC ?? '';
    cost.biceTemNm = suggestion.temNm ?? '';
};

/**
 * 직원조회 다이얼로그에서 직원을 선택했을 때 담당자 정보를 갱신합니다.
 */
const onCgprDialogSelect = (result: DialogEmployeeResult) => {
    const cost = costs.value[0];
    if (!cost) return;
    cost.cgpr = result.eno;
    cost.cgprNm = result.usrNm;
    cost.biceDpm = result.orgCode ?? '';
    cost.biceDpmNm = result.bbrNm;
    cost.biceTem = result.temC ?? '';
    cost.biceTemNm = result.temNm ?? '';
    showCgprDialog.value = false;
};

/**
 * 초기 데이터 로드
 * 쿼리 파라미터(id/ids)에 따라 적절한 API를 호출합니다.
 *
 * - id가 있으면 단건 조회 후 rows에 추가
 * - ids가 있으면 복수 조회(Bulk) 후 rows에 추가
 * - 둘 다 없으면 빈 행 1개 추가 (신규 등록)
 */
onActivated(async () => {
    /* 공통코드 + 현재 사용자 상세정보 병렬 로드 */
    try {
        const userEno = user.value?.eno ?? '';
        const userBase = `${config.public.apiBase}/api/users`;
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, pulDttList, dfrCleList, abusCList, tmnSvcList, itMngcTpList, userDetail] = await Promise.all([
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/PUL_DTT`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/TMN_SVC`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IT_MNGC_TP`),
            userEno ? $apiFetch<{ bbrC: string; bbrNm: string; temC: string; temNm: string }>(`${userBase}/${userEno}`) : Promise.resolve(null),
        ]);
        ioeCOptions.value     = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value   = pulDttList;
        dfrCleOptions.value   = dfrCleList;
        abusCOptions.value    = abusCList;
        tmnSvcOptions.value   = tmnSvcList;
        itMngcTpOptions.value = itMngcTpList;
        if (userDetail) currentUserDetail.value = userDetail;
    } catch (e) {
        console.error('초기 데이터 로드 실패', e);
    }

    /* 재활성화 시 이전 데이터 초기화 (KeepAlive로 이전 데이터 잔존 방지) */
    costs.value = [];

    const id = route.query.id as string;
    const ids = route.query.ids as string;

    if (id) {
        /* 단건 수정 모드: 지정된 관리번호 1건 로드 */
        try {
            const costData = await fetchCostOnce(id);
            if (costData) {
                /* 날짜 필드를 Date 객체로 변환 (DatePicker 바인딩용) */
                if (costData.fstDfrDt) {
                    costData.fstDfrDt = new Date(costData.fstDfrDt);
                }
                if (costData.xcrBseDt) {
                    costData.xcrBseDt = new Date(costData.xcrBseDt);
                }
                costs.value.push(costData);
            }
        } catch (e) {
            console.error('Failed to load cost', e);
        }
    } else if (ids) {
        /* 복수 수정 모드: 쉼표 구분된 관리번호 목록 일괄 로드 */
        try {
            const idList = ids.split(',');
            const data = await fetchCostsBulk(idList);
            if (data) {
                costs.value = data.map((item: ItCost) => {
                    const costData = { ...item };
                    /* 날짜 필드를 Date 객체로 변환 (DatePicker 바인딩용) */
                    if (costData.fstDfrDt) {
                        costData.fstDfrDt = new Date(costData.fstDfrDt);
                    }
                    if (costData.xcrBseDt) {
                        costData.xcrBseDt = new Date(costData.xcrBseDt);
                    }
                    return costData;
                });
            }
        } catch (e) {
            console.error('Failed to load costs bulk', e);
        }
    } else {
        /* 신규 등록 모드: 빈 행 1개로 시작 */
        addCostRow();
    }
});

/**
 * 새 행 추가
 * 기본값으로 초기화된 빈 전산업무비 항목을 목록에 추가합니다.
 * 담당자·담당부서·담당팀은 현재 로그인 사용자 정보로 자동입력됩니다.
 */
/** 기본 예산연도: 1~9월은 올해, 10~12월은 내년 */
const defaultBgYear = new Date().getMonth() < 9
    ? new Date().getFullYear()
    : new Date().getFullYear() + 1;

const addCostRow = () => {
    costs.value.push({
        ioeC: '',
        cttNm: '',
        cttOpp: '',
        itMngcBg: 0,
        dfrCle: '',
        fstDfrDt: '',
        cur: 'KRW',
        xcr: 0,
        xcrBseDt: '',
        infPrtYn: 'N',
        indRsn: '',
        /* 담당자: 현재 로그인 사용자로 자동입력 */
        cgpr: user.value?.eno ?? '',
        cgprNm: user.value?.empNm ?? '',
        biceDpm: currentUserDetail.value?.bbrC ?? user.value?.bbrC ?? '',
        biceDpmNm: currentUserDetail.value?.bbrNm ?? '',
        biceTem: currentUserDetail.value?.temC ?? user.value?.temC ?? '',
        biceTemNm: currentUserDetail.value?.temNm ?? '',
        abusC: '',
        itMngcTp: 'IT_MNGC_TP_001',
        pulDtt: '',
        assetBg: 0,
        apfSts: '예산 작성',
        lstYn: 'Y',
        delYn: 'N',
        bgYy: String(defaultBgYear),
    });
};

/**
 * 전체 저장 처리
 * 목록의 모든 항목에 대해 순차적으로 생성(createCost) 또는 수정(updateCost) API를 호출합니다.
 * 저장 성공 시 확인 다이얼로그 표시 후 목록 페이지로 이동합니다.
 */
const saveCosts = async () => {
    if (costs.value.length === 0) {
        alert('저장할 데이터가 없습니다.');
        return;
    }

    /* 간단한 필수 입력값 유효성 검사 */
    for (const cost of costs.value) {
        if (!cost.ioeC) {
            alert('비목코드를 입력해주세요.');
            return;
        }
    }

    try {
        /* 항목별 순차 처리 */
        for (const cost of costs.value) {
            /* fstDfrDt가 Date 객체인 경우 YYYY-MM-DD 형식의 문자열로 변환 */
            /* 복사본을 만들어 전송 (UI 상태 유지를 위해 원본 변경 방지) */
            const payload = { ...cost };
            if (payload.fstDfrDt && payload.fstDfrDt instanceof Date) {
                const year = payload.fstDfrDt.getFullYear();
                const month = String(payload.fstDfrDt.getMonth() + 1).padStart(2, '0');
                const day = '01'; // 월 단위 선택이므로 1일로 고정
                payload.fstDfrDt = `${year}-${month}-${day}`;
            }

            /* itMngcNo 존재 여부로 수정/신규 구분 */
            if (payload.itMngcNo) {
                await updateCost(payload.itMngcNo, payload);
            } else {
                await createCost(payload);
            }
        }

        /* 저장 완료 확인 다이얼로그 표시 */
        confirm.require({
            message: '저장되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            acceptLabel: '확인',
            accept: async () => {
                await router.push('/info/cost');
                removeTab(route.fullPath);
            }
        });
    } catch (e) {
        console.error('Save failed', e);
        alert('저장 중 오류가 발생했습니다.');
    }
};

/**
 * 취소 처리
 * 이전 페이지로 이동합니다.
 */
const cancel = () => {
    router.back();
};

</script>

<template>
    <div class="space-y-3">
        <!-- 단건 수정 모드: 상단 고정(Sticky) 헤더 -->
        <div
            v-if="isEditSingle"
            class="sticky -top-6 z-20 -mt-6 -mx-6 px-6 py-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
        >
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">전산업무비 수정</h1>
            <div class="flex items-center gap-2">
                <Button label="취소" severity="secondary" outlined class="!px-5 !rounded-lg" @click="cancel" />
                <Button
                    label="저장"
                    severity="primary"
                    class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20"
                    @click="saveCosts"
                />
            </div>
        </div>

        <!-- 신규/복수 수정 모드: 페이지 헤더 -->
        <PageHeader v-else :title="title">
            <template #actions>
                <Button label="행 추가" icon="pi pi-plus" severity="secondary" @click="addCostRow" />
                <Button label="취소" severity="secondary" outlined @click="cancel" />
                <Button label="저장" icon="pi pi-save" @click="saveCosts" />
            </template>
        </PageHeader>

        <!-- 단건 수정 모드: 단일 카드 + 섹션 구분선 레이아웃 -->
        <template v-if="isEditSingle && costs[0]">
            <div
                id="main-content"
                class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 max-w-[1440px] mx-auto w-full"
            >
                <!-- ─ 섹션 1: 계약 정보 ──────────────────────────────── -->
                <div class="space-y-3">
                    <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <i class="pi pi-file-edit text-indigo-500" />
                        계약 정보
                    </h3>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                        <!-- 비목코드 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">비목코드</label>
                            <Select
                                v-model="costs[0].ioeC"
                                :options="ioeCOptions"
                                option-label="cdNm"
                                option-value="cdId"
                                placeholder="비목코드 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 계약명 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">계약명</label>
                            <InputText v-model="costs[0].cttNm" placeholder="계약명 입력" class="w-full" />
                        </div>
                        <!-- 계약상대처 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">계약상대처</label>
                            <InputText v-model="costs[0].cttOpp" placeholder="벤더/공급사명 입력" class="w-full" />
                        </div>
                    </div>
                </div>

                <Divider />

                <!-- ─ 섹션 2: 예산 및 지급 정보 ─────────────────────── -->
                <div class="space-y-3">
                    <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <i class="pi pi-wallet text-indigo-500" />
                        예산 및 지급 정보
                    </h3>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                        <!-- 예산 금액 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">예산 금액</label>
                            <InputNumber v-model="costs[0].itMngcBg" :min="0" class="w-full" />
                        </div>
                        <!-- 통화 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">통화</label>
                            <Select
                                v-model="costs[0].cur"
                                :options="currencyOptions"
                                placeholder="통화 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 환율 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">환율</label>
                            <InputNumber v-model="costs[0].xcr" :min="0" :max-fraction-digits="4" class="w-full" />
                        </div>
                        <!-- 환율기준일자 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">환율기준일자</label>
                            <DatePicker
                                :model-value="costs[0].xcrBseDt as Date"
                                date-format="yy-mm-dd"
                                placeholder="YYYY-MM-DD"
                                class="w-full"
                                @date-select="costs[0].xcrBseDt = $event"
                            />
                        </div>
                        <!-- 지급주기 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">지급주기</label>
                            <Select
                                v-model="costs[0].dfrCle"
                                :options="dfrCleOptions"
                                option-label="cdNm"
                                option-value="cdId"
                                placeholder="지급주기 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 최초지급일 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">최초지급일(월)</label>
                            <DatePicker
                                v-model="costs[0].fstDfrDt as Date"
                                view="month"
                                date-format="yy-mm"
                                placeholder="YYYY-MM"
                                class="w-full"
                            />
                        </div>
                    </div>
                </div>

                <Divider />

                <!-- ─ 섹션 3: 기타 정보 ──────────────────────────────── -->
                <div class="space-y-3">
                    <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <i class="pi pi-info-circle text-indigo-500" />
                        기타 정보
                    </h3>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                        <!-- 전산업무비유형 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">전산업무비유형</label>
                            <Select
                                v-model="costs[0].itMngcTp"
                                :options="itMngcTpOptions"
                                option-label="cdNm"
                                option-value="cdId"
                                placeholder="유형 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 전산업무비구분 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">전산업무비구분</label>
                            <Select
                                v-model="costs[0].pulDtt"
                                :options="pulDttOptions"
                                option-label="cdNm"
                                option-value="cdId"
                                placeholder="구분 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 사업코드 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업코드</label>
                            <Select
                                v-model="costs[0].abusC"
                                :options="abusCOptions"
                                option-label="cdNm"
                                option-value="cdId"
                                placeholder="사업코드 선택"
                                class="w-full"
                            />
                        </div>
                        <!-- 정보보호여부 -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">정보보호여부</label>
                            <Select
                                v-model="costs[0].infPrtYn"
                                :options="[{ label: '대상', value: 'Y' }, { label: '비대상', value: 'N' }]"
                                option-label="label"
                                option-value="value"
                                class="w-full"
                            />
                        </div>
                        <!-- 증감사유 -->
                        <div class="col-span-2 flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">증감사유</label>
                            <Textarea v-model="costs[0].indRsn" rows="3" placeholder="증감사유 입력" class="w-full" />
                        </div>
                    </div>
                </div>

                <Divider />

                <!-- ─ 섹션 4: 담당 조직 ──────────────────────────────── -->
                <div class="space-y-3">
                    <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <i class="pi pi-users text-indigo-500" />
                        담당 조직
                    </h3>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                        <!-- 담당자 (AutoComplete + 다이얼로그) -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당자</label>
                            <div class="flex gap-2">
                                <AutoComplete
                                    v-model="costs[0].cgprNm"
                                    :suggestions="cgprSuggestions"
                                    option-label="displayLabel"
                                    placeholder="담당자 검색"
                                    class="flex-1"
                                    @complete="searchCgpr"
                                    @item-select="onCgprSelect($event.value)"
                                />
                                <Button
                                    icon="pi pi-search"
                                    severity="secondary"
                                    outlined
                                    @click="openCgprDialog(0)"
                                />
                            </div>
                        </div>
                        <!-- 담당자 사번 (읽기전용) -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사번</label>
                            <InputText :model-value="costs[0].cgpr" readonly class="w-full bg-zinc-50 dark:bg-zinc-800" />
                        </div>
                        <!-- 담당부서 (읽기전용, 담당자 선택 시 자동입력) -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당부서</label>
                            <InputText :model-value="costs[0].biceDpmNm" readonly class="w-full bg-zinc-50 dark:bg-zinc-800" />
                        </div>
                        <!-- 담당팀 (읽기전용, 담당자 선택 시 자동입력) -->
                        <div class="flex flex-col gap-1">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당팀</label>
                            <InputText :model-value="costs[0].biceTemNm" readonly class="w-full bg-zinc-50 dark:bg-zinc-800" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 금융정보단말기 상세목록 (메인 카드 외부 독립 카드 — 카드 스타일은 컴포넌트 자체 관리) -->
            <TerminalTableSection
                v-if="isTerminalType"
                default-mode="edit"
                :model-value="costs[0].terminals ?? []"
                :dfr-cle-options="dfrCleOptions"
                :tmn-svc-options="tmnSvcOptions"
                :currency-options="currencyOptions"
                @update:model-value="costs[0].terminals = $event"
            />

            <!-- 직원조회 다이얼로그 -->
            <EmployeeSearchDialog
                v-model:visible="showCgprDialog"
                @select="onCgprDialogSelect"
            />
        </template>

        <!-- 신규/복수 수정 모드: 인라인 편집 DataTable -->
        <template v-else>
            <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <CostFormTableSection
                    v-model="costs"
                    :ioe-c-options="ioeCOptions"
                    :pul-dtt-options="pulDttOptions"
                    :dfr-cle-options="dfrCleOptions"
                    :abus-c-options="abusCOptions"
                    :show-delete-column="true"
                />
            </div>
        </template>
    </div>
</template>
