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
import { ref, onMounted, onActivated, computed, watchEffect, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useCost, type ItCost, type Terminal } from '~/composables/useCost';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useAuth } from '~/composables/useAuth';
import CostFormTableSection from '~/components/cost/CostFormTableSection.vue';
import TerminalTableSection from '~/components/cost/TerminalTableSection.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const { removeTab } = useTabs();
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
/** 계약구분 옵션 (PUL_DTT) */
const pulDttOptions = ref<CodeOption[]>([]);
/** 지급주기 옵션 (DFR_CLE) */
const dfrCleOptions = ref<CodeOption[]>([]);
/** 사업코드 옵션 (ABUS_C) */
const abusCOptions = ref<CodeOption[]>([]);
/** 단말기서비스 옵션 (TMN_SVC) */
const tmnSvcOptions = ref<CodeOption[]>([]);

/** 기본 예산연도: 1~9월은 올해, 10~12월은 내년 */
const defaultBgYear = new Date().getMonth() < 9
    ? new Date().getFullYear()
    : new Date().getFullYear() + 1;

const title = '금융정보단말기 등록';
definePageMeta({ title: '금융정보단말기 등록', middleware: ['budget-period'] });

/**
 * 3가지 진입 모드 지원 (REQ-4)
 * - edit: ?id={itMngcNo} — 기존 금융정보단말기 수정
 * - linked: ?costId={parentItMngcNo} — 부모 전산업무비에서 연결 신규 작성
 * - new: 파라미터 없음 — 독립 신규 작성
 */
const editId = computed(() => route.query.id as string | undefined);
const parentCostId = computed(() => route.query.costId as string | undefined);
/** index.vue에서 전달된 예산연도 (없으면 defaultBgYear 사용) */
const queryBgYy = computed(() =>
    route.query.bgYy ? String(route.query.bgYy) : String(defaultBgYear)
);
const mode = computed(() => {
    if (editId.value) return 'edit';
    if (parentCostId.value) return 'linked';
    return 'new';
});
const isEditMode = computed(() => mode.value === 'edit');

/** 전산업무비 신청 데이터 (단일 행 배열로 DataTable 바인딩) */
const costs = ref<ItCost[]>([]);


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

/** 단말기 금액 변경 시 전산업무비 예산 자동 갱신 (watchEffect로 즉시 동기화) */
watchEffect(() => {
    if (costs.value[0]) {
        costs.value[0].itMngcBg = totalBudget.value;
    }
});

/** 수정 모드에서 최신 비용 데이터를 서버에서 재조회 */
const loadCostData = async () => {
    if (!isEditMode.value || !editId.value) return;
    try {
        const costData = await fetchCostOnce(editId.value);
        if (costData) {
            if (costData.fstDfrDt) {
                costData.fstDfrDt = new Date(costData.fstDfrDt as string);
            }
            /* 금융정보단말기는 원화 환산 합산이므로 통화를 KRW로 고정 */
            costData.cur = 'KRW';
            costs.value = [costData];
        }
    } catch (e) {
        console.error('Failed to load cost data', e);
    }
};

/**
 * 연결 신규 모드: 부모 전산업무비에서 초기값 복사
 * 사업코드, 비목코드, 담당부서/팀/담당자 등 공통 필드를 가져옴
 */
const loadParentCostData = async () => {
    if (!parentCostId.value) return;
    try {
        const parentData = await fetchCostOnce(parentCostId.value);
        if (parentData) {
            costs.value = [{
                ioeC: parentData.ioeC ?? '',
                cttNm: parentData.cttNm ?? '',
                pulDtt: parentData.pulDtt ?? '',
                cttOpp: parentData.cttOpp ?? '',
                itMngcBg: 0,
                dfrCle: parentData.dfrCle ?? '',
                fstDfrDt: parentData.fstDfrDt ? new Date(parentData.fstDfrDt as string) : '',
                cur: 'KRW',
                xcr: 0,
                xcrBseDt: '',
                infPrtYn: 'N',
                indRsn: '',
                cgpr: parentData.cgpr ?? user.value?.eno ?? '',
                cgprNm: parentData.cgprNm ?? user.value?.empNm ?? '',
                biceDpm: parentData.biceDpm ?? '',
                biceDpmNm: parentData.biceDpmNm ?? '',
                biceTem: parentData.biceTem ?? '',
                biceTemNm: parentData.biceTemNm ?? '',
                abusC: parentData.abusC ?? '',
                itMngcTp: 'IT_MNGC_TP_002',
                assetBg: 0,
                apfSts: '예산 작성',
                lstYn: 'Y',
                delYn: 'N',
                terminals: [],
                bgYy: queryBgYy.value,
            }];
        }
    } catch (e) {
        console.error('Failed to load parent cost data', e);
    }
};

onMounted(async () => {
    /* 공통코드 + 현재 사용자 상세정보 병렬 로드 */
    try {
        const userEno = user.value?.eno ?? '';
        const userBase = `${config.public.apiBase}/api/users`;
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, pulDttList, dfrCleList, abusCList, tmnSvcList, userDetail] = await Promise.all([
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/PUL_DTT`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/TMN_SVC`),
            userEno ? $apiFetch<{ bbrC: string; bbrNm: string; temC: string; temNm: string }>(`${userBase}/${userEno}`) : Promise.resolve(null),
        ]);
        ioeCOptions.value   = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value = pulDttList;
        dfrCleOptions.value = dfrCleList;
        abusCOptions.value  = abusCList;
        tmnSvcOptions.value = tmnSvcList;
        if (userDetail) currentUserDetail.value = userDetail;
    } catch (e) {
        console.error('초기 데이터 로드 실패', e);
    }

    if (mode.value === 'edit') {
        /* 수정 모드: 기존 데이터 로드 */
        await loadCostData();
    } else if (mode.value === 'linked') {
        /* 연결 신규 모드: 부모 전산업무비에서 초기값 복사 */
        await loadParentCostData();
    } else {
        /* 독립 신규 모드: 빈 폼으로 시작 */
        costs.value = [{
            ioeC: '금융정보단말기',
            cttNm: '',
            pulDtt: '',
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
            assetBg: 0,
            apfSts: '예산 작성',
            lstYn: 'Y',
            delYn: 'N',
            terminals: [],
            bgYy: queryBgYy.value,
        }];
    }
});

/**
 * KeepAlive 재활성화 시 현재 모드에 맞게 데이터 재로드
 * - edit: 최신 수정 데이터 재조회
 * - linked: 부모 전산업무비 초기값 복사 (이전 edit 데이터 잔존 방지)
 * - new: 빈 폼으로 초기화
 */
onActivated(async () => {
    costs.value = [];
    if (mode.value === 'edit') {
        await loadCostData();
    } else if (mode.value === 'linked') {
        await loadParentCostData();
    } else {
        costs.value = [{
            ioeC: '금융정보단말기',
            cttNm: '',
            pulDtt: '',
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
            assetBg: 0,
            apfSts: '예산 작성',
            lstYn: 'Y',
            delYn: 'N',
            terminals: [],
            bgYy: queryBgYy.value,
        }];
    }
});

/** 같은 페이지에서 query 파라미터 변경 시 데이터 재로드 */
watch([editId, parentCostId], async ([newEditId, newCostId]) => {
    costs.value = [];
    if (newEditId) {
        await loadCostData();
    } else if (newCostId) {
        await loadParentCostData();
    }
});


/* ── 저장 ──────────────────────────────────────────────── */

/** 날짜 포맷팅 (YYYY-MM-DD) */
const formatDate = (date: Date | null | string | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
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

    /* 저장용 Payload 구성 (유형·예산 강제 세팅 + 날짜 포맷팅) */
    const payload: ItCost = {
        ...cost,
        itMngcTp: 'IT_MNGC_TP_002',
        itMngcBg: totalBudget.value,
        fstDfrDt: cost.fstDfrDt instanceof Date
            ? `${cost.fstDfrDt.getFullYear()}-${String(cost.fstDfrDt.getMonth() + 1).padStart(2, '0')}-01`
            : (cost.fstDfrDt || ''),
        terminals: (cost.terminals || []).map(t => ({
            ...t,
            xcrBseDt: formatDate(t.xcrBseDt)
        }))
    };

    try {
        if (mode.value === 'edit' && payload.itMngcNo) {
            /* 수정 모드: PUT */
            await updateCost(payload.itMngcNo, payload);
        } else {
            /* 신규 (linked + new): POST */
            await createCost(payload);

            /* linked 모드: 부모 전산업무비의 itMngcTp를 IT_MNGC_TP_002로 업데이트 */
            if (mode.value === 'linked' && parentCostId.value) {
                await updateCost(parentCostId.value, { itMngcTp: 'IT_MNGC_TP_002' } as ItCost);
            }
        }

        toast.add({ severity: 'success', summary: '저장 완료', detail: '저장되었습니다.', life: 2000 });
        /* 저장 완료 후 현재 탭 닫고 목록으로 복귀 */
        await router.push('/info/cost');
        removeTab('/info/cost/terminal/form');
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
                {{ mode === 'edit' ? '금융정보단말기 수정' : '금융정보단말기 등록' }}
            </h1>
            <div class="flex gap-2">
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" icon="pi pi-save" @click="handleSave" />
            </div>
        </div>

        <!-- DataTable 1: 전산업무비 신청 (행 추가/삭제 불가, 단일 행) -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">전산업무비 신청</h3>
            <CostFormTableSection
                v-model="costs"
                :ioe-c-options="ioeCOptions"
                :pul-dtt-options="pulDttOptions"
                :dfr-cle-options="dfrCleOptions"
                :abus-c-options="abusCOptions"
                :budget-disabled="true"
                currency-fixed="KRW"
            />
        </div>

        <!-- DataTable 2: 단말기 상세목록 -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <TerminalTableSection
                :model-value="costs[0]?.terminals ?? []"
                :dfr-cle-options="dfrCleOptions"
                :tmn-svc-options="tmnSvcOptions"
                :currency-options="currencyOptions"
                @update:model-value="val => { if (costs[0]) costs[0].terminals = val }"
            />
        </div>
    </div>
</template>

