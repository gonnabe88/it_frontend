<!--
================================================================================
[components/cost/TerminalFormDialog.vue] 단말기 상세목록 다이얼로그
================================================================================
금융정보단말기의 단말기 상세목록을 편집하는 모달 다이얼로그입니다.
기존 terminal/form.vue의 전산업무비 신청 테이블은 제거하고,
단말기 상세목록(TerminalTableSection)만 포함합니다.

[동작 모드]
  - edit 모드:   itMngcNo prop → 기존 금융정보단말기 수정
  - linked 모드: parentCostId prop → 부모 전산업무비 기반 신규 생성
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useCost, type ItCost, type Terminal } from '~/composables/useCost';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useAuth } from '~/composables/useAuth';
import TerminalTableSection from '~/components/cost/TerminalTableSection.vue';

interface CodeOption { cdId: string; cdNm: string; }

const props = defineProps<{
    /** 다이얼로그 표시 여부 */
    visible: boolean;
    /** 수정 모드: 기존 전산업무비 관리번호 */
    itMngcNo?: string;
    /** 연결 신규 모드: 부모 전산업무비 관리번호 */
    parentCostId?: string;
    /** 연결 신규 모드: 예산연도 */
    bgYy?: string;
    /**
     * 로컬 모드: 미저장 신규 행의 ItCost 데이터
     * - 이 prop이 제공되면 API 호출 없이 로컬에서만 터미널 목록을 편집
     * - 저장 시 API를 호출하지 않고 update:local-terminals 이벤트로 부모에 반환
     * - 부모의 일괄 저장([저장] 버튼) 시 서버에 함께 저장됨
     */
    localCost?: ItCost;
}>();

const emit = defineEmits<{
    'update:visible': [value: boolean];
    /** 저장 완료 후 부모 컴포넌트가 목록을 새로고침하도록 알림 */
    'saved': [];
    /** 로컬 모드에서 편집 완료 후 갱신된 터미널 목록을 부모에 반환 */
    'update:local-terminals': [terminals: Terminal[]];
}>();

const confirm = useConfirm();
const toast = useToast();
const { fetchCostOnce, createCost, updateCost } = useCost();
const { exchangeRates, convertToKRW } = useCurrencyRates();
const { user } = useAuth();
const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();

/* ── 공통코드 옵션 ──────────────────────────────────────── */
const dfrCleOptions = ref<CodeOption[]>([]);
const tmnSvcOptions = ref<CodeOption[]>([]);

/** 통화 선택지 (환율 API 기반 동적 생성) */
const currencyOptions = computed(() => Object.keys(exchangeRates.value));

/* ── 데이터 상태 ────────────────────────────────────────── */
const cost = ref<ItCost | null>(null);
const loading = ref(false);
const loadError = ref(false);

/** 단말기 목록 (cost.terminals의 양방향 바인딩용) */
const terminals = computed({
    get: () => cost.value?.terminals ?? [],
    set: (val: Terminal[]) => {
        if (cost.value) cost.value.terminals = val;
    }
});

/** 단말기 금액 원화 환산 합계 (전산업무비 예산 자동 계산)
 *  xcr > 1: 사용자 직접 입력 환율 사용 / 그 외: 공통환율 API 사용 */
const totalBudget = computed(() =>
    terminals.value.reduce((sum, item) => {
        const cur = item.cur || 'KRW';
        const rate = (cur !== 'KRW' && item.xcr && item.xcr > 1)
            ? item.xcr
            : (exchangeRates.value[cur] || 1);
        return sum + Math.round((item.tmlAmt || 0) * rate);
    }, 0)
);

/* ── 공통코드 로드 ──────────────────────────────────────── */
const loadOptions = async () => {
    const base = `${config.public.apiBase}/api/ccodem/type`;
    const [dfrCleList, tmnSvcList] = await Promise.all([
        $apiFetch<CodeOption[]>(`${base}/DFR_CLE`),
        $apiFetch<CodeOption[]>(`${base}/TMN_SVC`),
    ]);
    dfrCleOptions.value = dfrCleList;
    tmnSvcOptions.value = tmnSvcList;
};

/* ── 데이터 로드 (다이얼로그 열릴 때) ─────────────────────── */

/** 수정 모드: 기존 전산업무비 + 단말기 목록 로드 */
const loadForEdit = async () => {
    if (!props.itMngcNo) return;
    const costData = await fetchCostOnce(props.itMngcNo);
    if (costData.fstDfrDt) costData.fstDfrDt = new Date(costData.fstDfrDt as string);
    costData.cur = 'KRW';
    cost.value = costData;
};

/** 연결 신규 모드: 부모 전산업무비 필드값 복사, 빈 단말기 목록으로 초기화 */
const loadForLinked = async () => {
    if (!props.parentCostId) return;
    const parentData = await fetchCostOnce(props.parentCostId);
    cost.value = {
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
        bgYy: props.bgYy ?? parentData.bgYy ?? '',
    };
};

/** 옵션 + 본문 데이터 로드 (watch와 수동 reload에서 공통 사용) */
const loadAll = async () => {
    cost.value = null;
    loadError.value = false;
    loading.value = true;
    try {
        await loadOptions();
        if (props.localCost !== undefined) {
            /* 로컬 모드: API 호출 없이 전달받은 데이터로 초기화 (terminals 배열 shallow copy) */
            cost.value = { ...props.localCost, terminals: [...(props.localCost.terminals ?? [])] };
        } else if (props.itMngcNo) {
            await loadForEdit();
        } else if (props.parentCostId) {
            await loadForLinked();
        }
    } catch (e) {
        console.error('단말기 다이얼로그 데이터 로드 실패', e);
        loadError.value = true;
        toast.add({ severity: 'error', summary: '오류', detail: '데이터를 불러오는 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

/** 다이얼로그 열릴 때 옵션 + 데이터 로드 */
watch(() => props.visible, (visible) => {
    if (!visible) return;
    loadAll();
});

/* ── 저장 ──────────────────────────────────────────────── */

/** xcrBseDt Date → YYYY-MM-DD 문자열 변환 */
const formatDate = (date: Date | null | string | undefined): string => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0]!;
};

const executeSave = async () => {
    if (!cost.value) {
        toast.add({ severity: 'warn', summary: '알림', detail: '저장할 데이터가 없습니다.', life: 3000 });
        return;
    }

    /* 로컬 모드: API 저장 없이 터미널 목록만 부모로 반환 (부모의 [저장] 버튼 클릭 시 일괄 저장) */
    if (props.localCost !== undefined) {
        emit('update:local-terminals', terminals.value.map(t => ({ ...t, xcrBseDt: formatDate(t.xcrBseDt) })));
        emit('update:visible', false);
        return;
    }

    /* 저장 payload: 예산 자동 계산 + 날짜 포맷 정규화 */
    const payload: ItCost = {
        ...cost.value,
        itMngcTp: 'IT_MNGC_TP_002',
        itMngcBg: totalBudget.value,
        fstDfrDt: cost.value.fstDfrDt instanceof Date
            ? `${cost.value.fstDfrDt.getFullYear()}-${String(cost.value.fstDfrDt.getMonth() + 1).padStart(2, '0')}-01`
            : (cost.value.fstDfrDt || ''),
        terminals: terminals.value.map(t => ({
            ...t,
            xcrBseDt: formatDate(t.xcrBseDt)
        }))
    };

    if (props.itMngcNo && payload.itMngcNo) {
        /* 수정 모드 */
        await updateCost(payload.itMngcNo, payload);
    } else {
        /* 연결 신규 모드 */
        await createCost(payload);
        if (props.parentCostId) {
            await updateCost(props.parentCostId, { itMngcTp: 'IT_MNGC_TP_002' } as ItCost);
        }
    }

    toast.add({ severity: 'success', summary: '저장 완료', detail: '저장되었습니다.', life: 2000 });
    emit('saved');
    emit('update:visible', false);
};

const handleSave = () => {
    const isLocal = props.localCost !== undefined;
    confirm.require({
        message: isLocal ? '단말기 목록을 적용하시겠습니까?' : (props.itMngcNo ? '수정하시겠습니까?' : '등록하시겠습니까?'),
        header: '확인',
        icon: 'pi pi-question-circle',
        acceptLabel: '확인',
        rejectLabel: '취소',
        accept: executeSave
    });
};

const handleClose = () => emit('update:visible', false);
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        header="금융정보단말기"
        :style="{ width: '95vw', height: '85vh' }"
        :content-style="{ height: 'calc(85vh - 8rem)', overflowY: 'auto' }"
        @update:visible="emit('update:visible', $event)">

        <!-- 로딩 상태 -->
        <div v-if="loading" class="flex justify-center items-center py-16">
            <ProgressSpinner />
        </div>

        <!-- 로드 실패: 수동 Reload 버튼 -->
        <div v-else-if="loadError" class="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
            <i class="pi pi-exclamation-circle text-3xl text-red-400" />
            <p>데이터를 불러오지 못했습니다.</p>
            <Button label="다시 불러오기" icon="pi pi-refresh" severity="secondary" @click="loadAll" />
        </div>

        <!-- 단말기 상세목록 테이블 -->
        <div v-else-if="cost" class="pt-2">
            <TerminalTableSection
                :flat="true"
                :show-save="true"
                :model-value="terminals"
                :dfr-cle-options="dfrCleOptions"
                :tmn-svc-options="tmnSvcOptions"
                :currency-options="currencyOptions"
                @update:model-value="val => { if (cost) cost.terminals = val }"
                @save="handleSave"
            />
        </div>

        <template #footer>
            <AppDialogFooter>
                <Button label="닫기" severity="secondary" outlined @click="handleClose" />
            </AppDialogFooter>
        </template>
    </Dialog>
</template>
