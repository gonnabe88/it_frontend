/**
 * ============================================================================
 * [useCostListPage] 전산업무비 목록 페이지 상태/동작 Composable
 * ============================================================================
 * pages/info/cost/index.vue의 조회, 편집, 일괄 업로드, 단말기 다이얼로그,
 * 계속 계약 불러오기 흐름을 담당합니다. 페이지 컴포넌트는 라우트 선언과
 * 템플릿 렌더링에 집중하도록 이 파일에서 화면 로직을 관리합니다.
 * ============================================================================
 */
import { ref, reactive, computed, watch, onMounted, onActivated, onUnmounted, nextTick } from 'vue';

import { useCost, type ItCost, type Terminal } from '~/composables/useCost';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useAuth } from '~/composables/useAuth';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { exportRowsToExcel } from '~/utils/excel';

export const useCostListPage = () => {
const { fetchCosts, fetchCostOnce, createCost, updateCost, deleteCost } = useCost();
const { exchangeRates } = useCurrencyRates();
const { user } = useAuth();
const toast = useToast();
const confirm = useConfirm();

/* ── 예산연도 필터 ──────────────────────────────────────── */
const currentYear = new Date().getFullYear();
const yearOptions = [
    { label: `${currentYear - 1}년`, value: currentYear - 1 },
    { label: `${currentYear}년`, value: currentYear },
    { label: `${currentYear + 1}년`, value: currentYear + 1 },
];
/** 기본 예산연도: 1~9월은 올해, 10~12월은 내년 */
const defaultBgYear = new Date().getMonth() < 9 ? currentYear : currentYear + 1;
const selectedYear = ref<number | null>(defaultBgYear);

/* ── 공통코드 옵션 로드 ──────────────────────────────────── */
interface CodeOption { cdId: string; cdNm: string; }

/** 비목코드 전용 코드 응답 타입 (코드설명 cdva 포함) */
interface IoeCodeOption {
    cdId: string;
    cdNm: string;
    cdva: string;   // 코드설명
    cttTp: string;  // 코드유형 (IOE_LEAFE 등)
}

/** 비목코드 CascadeSelect 트리 노드 타입 */
interface IoeCategoryOption {
    label: string;
    cdId: string;
    cdva?: string;
    items?: IoeCategoryOption[];
}

const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
const CCODEM_BASE = `${config.public.apiBase}/api/ccodem/type`;

/** 비목코드 옵션 (IOE_LEAFE · IOE_XPN · IOE_SEVS · IOE_IDR 병합) */
const ioeCOptions = ref<IoeCodeOption[]>([]);
/** 계약구분 옵션 (PUL_DTT) */
const pulDttOptions = ref<CodeOption[]>([]);
/** 지급주기 옵션 (DFR_CLE) */
const dfrCleOptions = ref<CodeOption[]>([]);
/** 사업코드 옵션 (ABUS_C) */
const abusCOptions = ref<CodeOption[]>([]);
/** 전산업무비유형 옵션 (IT_MNGC_TP) */
const itMngcTpOptions = ref<CodeOption[]>([]);

/** 현재 로그인 사용자의 부서/팀 정보 (신규 행 자동입력용) */
const currentUserDetail = ref<{ bbrC: string; bbrNm: string; temC: string; temNm: string } | null>(null);

/* ── 전산업무비 목록 데이터 ──────────────────────────────── */
const { data: costsRaw, error, refresh: refreshCostsRaw } = fetchCosts();

/** 로컬 deep reactive 배열 (useFetch의 shallowRef는 내부 속성 변경을 감지하지 못함) */
const costs = ref<ItCost[]>([]);

/** 원본 스냅샷 (변경 감지용, itMngcNo → JSON 문자열) */
const snapshots = new Map<string, string>();

/** 비교 대상 필드 (서버에 저장되는 편집 가능 컬럼만) */
const COMPARE_KEYS: (keyof ItCost)[] = [
    'abusC', 'ioeC', 'cttNm', 'pulDtt', 'cttOpp',
    'itMngcBg', 'cur', 'dfrCle', 'fstDfrDt',
    'cgpr', 'cgprNm', 'biceDpm', 'biceDpmNm', 'biceTem', 'biceTemNm',
    'itMngcTp',
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

/* ── 필수 입력 필드 검증 ──────────────────────────────────── */

/** 필수 입력 필드 정의 (필드명 → 표시 라벨) */
const REQUIRED_FIELDS: { key: keyof ItCost; label: string }[] = [
    { key: 'abusC', label: '사업코드' },
    { key: 'ioeC', label: '비목코드' },
    { key: 'cttNm', label: '계약명' },
    { key: 'pulDtt', label: '계약구분' },
    { key: 'cttOpp', label: '계약상대처' },
    { key: 'dfrCle', label: '지급주기' },
    { key: 'fstDfrDt', label: '최초지급일' },
    { key: 'cgpr', label: '담당자' },
];

/** 행별 미입력 필드 Set (행 식별키 → 미입력 필드 Set) */
const invalidFieldsMap = reactive(new Map<string, Set<string>>());

/** 행의 고유 키 반환 (서버 저장 전 로컬 행은 _localId 사용) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowKey = (data: ItCost) => data.itMngcNo || (data as any)._localId || '';

/* ── 수정 모드 dirty tracking ───────────────────────────────
   수정 모드에서의 변경은 즉시 서버에 반영하지 않고, 각 행에 _status를 부여해
   로컬에만 표시한다. [저장] 버튼 클릭 시 _status 별로 create/update/delete API를
   일괄 호출한다. _status 값:
   - undefined : 변경 없음
   - 'new'     : 로컬에서 신규 추가된 행 → createCost
   - 'modified': 기존 서버 행 중 값이 변경된 행 → updateCost
   - 'deleted' : 삭제 표시된 행 (화면에는 회색 처리로 남아있음) → deleteCost
*/
type RowStatus = 'new' | 'modified' | 'deleted';
type ItCostEx = ItCost & { _localId?: string; _status?: RowStatus };

/** 특정 행을 수정됨(modified)으로 표시. 이미 new/deleted이면 상태 유지.
 *  값 변경마다 invalidFieldsMap을 재검증하여 stale 상태로 인한 false toast 방지. */
const markDirty = (data: ItCost) => {
    if (viewMode.value !== 'edit') return;
    const d = data as ItCostEx;
    if (d._status === 'deleted') return;
    if (d._status !== 'new') d._status = 'modified';
    markInvalidFields(data);
};

/** 행의 현재 상태(_status) 반환 — 템플릿 Tag 분기용 */
const rowStatus = (data: ItCost): RowStatus | undefined => (data as ItCostEx)._status;

/** DataTable row-class: 삭제 표시된 행은 시각적으로 비활성(회색 + 취소선 + 클릭 차단) 처리 */
const rowClass = (data: ItCost): string | undefined => {
    return (data as ItCostEx)._status === 'deleted' ? 'row-deleted' : undefined;
};

/** 특정 행의 특정 필드가 미입력 상태인지 확인 */
const isFieldInvalid = (data: ItCost, field: string) => {
    const fields = invalidFieldsMap.get(rowKey(data));
    return fields ? fields.has(field) : false;
};

/**
 * 행의 필수 필드 검증
 * @returns 미입력 필드 라벨 배열 (비어있으면 유효)
 */
const validateRow = (data: ItCost): string[] => {
    const missing: string[] = [];
    for (const { key, label } of REQUIRED_FIELDS) {
        const val = data[key];
        if (val === undefined || val === null || val === '' || (val instanceof Date && Number.isNaN(val.getTime()))) {
            missing.push(label);
        }
    }
    return missing;
};

/**
 * 행 검증 결과를 invalidFieldsMap에 반영 (토스트 없이 빨간 테두리만 표시/해제)
 * 저장 완료 후 호출하여 미입력 필드를 시각적으로 안내합니다.
 */
const markInvalidFields = (data: ItCost): void => {
    const missing = validateRow(data);
    const key = rowKey(data);
    if (missing.length > 0) {
        const fieldKeys = new Set(
            REQUIRED_FIELDS.filter(f => missing.includes(f.label)).map(f => f.key as string)
        );
        invalidFieldsMap.set(key, fieldKeys);
    } else {
        invalidFieldsMap.delete(key);
    }
};

/**
 * 행별 "검증된 담당자명" 스냅샷 맵
 * 마지막으로 유효하게 선택된(= data.cgpr 사번과 짝을 이루는) cgprNm을 저장합니다.
 * 사용자가 자동완성 리스트에서 선택하지 않고 텍스트만 타이핑한 뒤 blur 하면
 * data.cgprNm은 바뀌지만 data.cgpr(사번)은 이전 값을 유지하여 짝이 어긋나게 되는데,
 * 이 맵에 저장된 값과 비교하여 불일치를 감지합니다.
 */
const validatedCgprNmMap = reactive(new Map<string, string>());

/** costsRaw(shallowRef) → costs(deep ref)로 동기화 + fstDfrDt 변환 + 스냅샷 저장 */
watch(costsRaw, (list) => {
    if (!list) return;
    list.forEach(cost => {
        if (cost.fstDfrDt && typeof cost.fstDfrDt === 'string') {
            cost.fstDfrDt = new Date(cost.fstDfrDt);
        }
    });
    /* 로컬 신규 행(_localId)은 유지하면서 서버 데이터 갱신 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localRows = costs.value.filter(c => (c as any)._localId);
    costs.value = [...localRows, ...list];
    /* 원본 스냅샷 갱신 + 서버 데이터의 미입력 필드 표시 + 담당자 검증 스냅샷 시드 */
    snapshots.clear();
    validatedCgprNmMap.clear();
    costs.value.forEach(c => {
        if (c.itMngcNo) {
            snapshots.set(c.itMngcNo, toSnapshot(c));
            markInvalidFields(c);
        }
        /* 서버/로컬 행 모두: cgpr(사번)과 cgprNm이 함께 있으면 해당 쌍을 유효로 간주 */
        if (c.cgpr && c.cgprNm) {
            validatedCgprNmMap.set(rowKey(c), c.cgprNm);
        }
    });
}, { immediate: true });

/* ── 직원조회 다이얼로그 상태 ──────────────────────────────── */
const employeeDialogVisible = ref(false);
const selectedRowIndex = ref(-1);

/* ── 담당자 자동완성 ──────────────────────────────────────── */
interface UserSuggestion {
    eno: string;
    usrNm: string;
    ptCNm: string | null;
    temNm: string | null;
    bbrC: string;
    bbrNm: string;
    temC: string | null;
    /** AutoComplete 표시용 라벨 */
    displayLabel: string;
}
const employeeSuggestions = ref<UserSuggestion[]>([]);

/* ── 통화 선택지 ──────────────────────────────────────────── */
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];

/* ── 정렬 상태 ──────────────────────────────────────────── */
const currentSortField = ref<string | undefined>('itMngcNo');
const currentSortOrder = ref<number>(-1);

/* ── 페이지 크기 ──────────────────────────────────────────── */
const pageSizeOptions = [
    { label: '10건', value: 10 },
    { label: '20건', value: 20 },
    { label: '50건', value: 50 },
];
const pageSize = ref(10);

/* ── 검색 필터 ──────────────────────────────────────────── */
const searchKeyword = ref('');
const filteredCosts = computed(() => {
    let list = costs.value;
    /* 예산연도 필터 */
    if (selectedYear.value) {
        list = list.filter(cost => String(cost.bgYy) === String(selectedYear.value));
    }
    /* 텍스트 검색 */
    const kw = searchKeyword.value.trim().toLowerCase();
    if (!kw) return list;
    /** 공통코드 ID → 코드명 변환 헬퍼 */
    const cdNm = (opts: CodeOption[], id?: string) =>
        opts.find(o => o.cdId === id)?.cdNm?.toLowerCase() ?? '';
    return list.filter(cost =>
        cost.itMngcNo?.toLowerCase().includes(kw) ||
        cdNm(itMngcTpOptions.value, cost.itMngcTp).includes(kw) ||
        cdNm(abusCOptions.value, cost.abusC).includes(kw) ||
        cdNm(ioeCOptions.value, cost.ioeC).includes(kw) ||
        cost.cttNm?.toLowerCase().includes(kw) ||
        cdNm(pulDttOptions.value, cost.pulDtt).includes(kw) ||
        cost.cttOpp?.toLowerCase().includes(kw) ||
        cdNm(dfrCleOptions.value, cost.dfrCle).includes(kw) ||
        cost.biceDpmNm?.toLowerCase().includes(kw) ||
        cost.biceTemNm?.toLowerCase().includes(kw) ||
        cost.cgprNm?.toLowerCase().includes(kw) ||
        cost.bgYy?.toLowerCase().includes(kw)
    );
});

/* ── 공통코드 초기 로드 ──────────────────────────────────── */
onMounted(async () => {
    try {
        const userEno = user.value?.eno ?? '';
        const userBase = `${config.public.apiBase}/api/users`;
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, pulDttList, dfrCleList, abusCList, itMngcTpList, userDetail] = await Promise.all([
            $apiFetch<IoeCodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<IoeCodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<IoeCodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<IoeCodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/PUL_DTT`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IT_MNGC_TP`),
            userEno ? $apiFetch<{ bbrC: string; bbrNm: string; temC: string; temNm: string }>(`${userBase}/${userEno}`) : Promise.resolve(null),
        ]);
        ioeCOptions.value = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value = pulDttList;
        dfrCleOptions.value = dfrCleList;
        abusCOptions.value = abusCList;
        itMngcTpOptions.value = itMngcTpList;
        if (userDetail) currentUserDetail.value = userDetail;
    } catch (e) {
        console.error('공통코드 로드 실패', e);
    }

});

/**
 * KeepAlive 재활성화 시 목록 새로고침 (단말기 폼 저장 후 돌아왔을 때 예산 현행화)
 *
 * [첫 활성화는 스킵]
 *  keepalive 특성상 최초 마운트 시 onActivated가 함께 호출됩니다.
 *  이때 초기 fetch가 진행 중이면 refresh()가 abort 시켜 데이터 로딩 실패로 이어질 수 있습니다.
 *  따라서 첫 활성화는 건너뛰고 다른 페이지에서 돌아온 경우에만 갱신합니다.
 */
let isFirstActivation = true;
onActivated(() => {
    if (isFirstActivation) {
        isFirstActivation = false;
        return;
    }
    refreshCostsRaw();
});

/** 컴포넌트 언마운트 시 체크박스 편집 모드 이벤트 리스너 정리 */
onUnmounted(() => {
    document.removeEventListener('mousedown', handleTerminalOutsideClick);
    document.removeEventListener('mousedown', handleIoeOutsideClick);
});

/** 전산업무비유형이 IT_MNGC_TP_002(금융정보단말기)이면 예산·통화 수정 불가 */
const isTerminal = (data: ItCost) => data.itMngcTp === 'IT_MNGC_TP_002';

/**
 * 단말기 상세 목록에 item이 하나라도 존재하는지 여부
 * - 단말기 체크박스의 표시 상태는 오직 이 값으로만 결정됩니다.
 * - 클릭은 다이얼로그만 열 뿐 체크 상태를 즉시 토글하지 않습니다.
 *   다이얼로그에서 저장 후 refreshCostsRaw가 호출되면 terminals가 갱신되며,
 *   그 결과에 따라 체크/해제 상태가 자연스럽게 반영됩니다.
 */
const hasTerminalItems = (data: ItCost): boolean => (data.terminals?.length ?? 0) > 0;

/* ── 담당자 자동완성 검색 ──────────────────────────────────── */

/** AutoComplete 검색 이벤트 핸들러 (동일 부서 소속 직원 검색) */
const searchEmployee = async (event: { query: string }) => {
    const keyword = event.query.trim();
    if (!keyword) { employeeSuggestions.value = []; return; }
    try {
        const userBase = `${config.public.apiBase}/api/users/search`;
        const orgCode = user.value?.bbrC ?? '';
        const results = await $apiFetch<UserSuggestion[]>(userBase, {
            query: { keyword, ...(orgCode ? { orgCode } : {}) }
        });
        employeeSuggestions.value = (results ?? []).map(u => ({
            ...u,
            displayLabel: `${u.usrNm}${u.ptCNm ? `(${u.ptCNm})` : ''}, ${u.temNm || u.bbrNm || ''}`
        }));
    } catch (e) {
        console.error('직원 검색 실패', e);
        employeeSuggestions.value = [];
    }
};

/** AutoComplete 선택 완료 시 행 데이터에 담당자 정보 반영 */
const onEmployeeSelect = (data: ItCost, selected: UserSuggestion) => {
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.bbrC;
    data.biceDpmNm = selected.bbrNm;
    data.biceTem = selected.temC ?? '';
    data.biceTemNm = selected.temNm ?? '';
    /* 유효 선택 → 검증 스냅샷 갱신 및 invalid 해제 */
    validatedCgprNmMap.set(rowKey(data), selected.usrNm);
    const fields = invalidFieldsMap.get(rowKey(data));
    if (fields) {
        fields.delete('cgpr');
        if (fields.size === 0) invalidFieldsMap.delete(rowKey(data));
    }
    markDirty(data);
};

/** 직원조회 다이얼로그 열기 */
const openEmployeeSearch = (data: ItCost) => {
    selectedRowIndex.value = costs.value.indexOf(data);
    employeeDialogVisible.value = true;
};

/** 직원조회 다이얼로그에서 선택 완료 시 행 데이터에 담당자 정보 반영 */
const onDialogEmployeeSelect = (selected: { eno: string; usrNm: string; bbrNm: string; temC?: string; temNm?: string; orgCode?: string }) => {
    if (selectedRowIndex.value < 0) return;
    const data = costs.value[selectedRowIndex.value];
    if (!data) return;
    data.cgpr = selected.eno;
    data.cgprNm = selected.usrNm;
    data.biceDpm = selected.orgCode ?? '';
    data.biceDpmNm = selected.bbrNm ?? '';
    data.biceTem = selected.temC ?? '';
    data.biceTemNm = selected.temNm ?? '';
    /* 유효 선택 → 검증 스냅샷 갱신 및 invalid 해제 */
    validatedCgprNmMap.set(rowKey(data), selected.usrNm);
    const fields = invalidFieldsMap.get(rowKey(data));
    if (fields) {
        fields.delete('cgpr');
        if (fields.size === 0) invalidFieldsMap.delete(rowKey(data));
    }
    markDirty(data);
};

/**
 * 담당자 AutoComplete blur 핸들러.
 * 마지막으로 선택(또는 서버로부터 로드)된 담당자명과 현재 입력값이 다르면
 * 짝이 맞지 않는 상태이므로 담당자 관련 필드를 모두 초기화하고 invalid 표시.
 */
const onCgprBlur = (data: ItCost) => {
    const key = rowKey(data);
    /* 검증된 값이 없으면(서버에서 cgprNm이 로드되지 않은 신규 행 등) 현재 값을 유효로 간주 */
    const validated = validatedCgprNmMap.get(key);
    if (validated == null) {
        if (data.cgprNm) validatedCgprNmMap.set(key, data.cgprNm);
        markDirty(data);
        return;
    }
    if (data.cgprNm === validated) {
        markDirty(data);
        return;
    }
    /* 유효 선택이 아닌 타이핑 값 → 초기화 + invalid */
    data.cgpr = '';
    data.cgprNm = '';
    data.biceDpm = '';
    data.biceDpmNm = '';
    data.biceTem = '';
    data.biceTemNm = '';
    validatedCgprNmMap.delete(key);
    const fields = invalidFieldsMap.get(key) ?? new Set<string>();
    fields.add('cgpr');
    invalidFieldsMap.set(key, fields);
    markDirty(data);
};

/* ── 행 단위 자동 저장 (포커스 아웃 / 값 변경 시) ──────────── */

/** fstDfrDt Date 객체 → 'YYYY-MM-01' 문자열 변환 */
const toDateString = (dt: string | Date | undefined): string => {
    if (!dt || !(dt instanceof Date)) return typeof dt === 'string' ? dt : '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};

/* 레거시 saveRow 제거: 즉시 저장 대신 markDirty + [저장] 버튼 일괄 처리 방식으로 교체됨 */

/* ── 행추가 ────────────────────────────────────────────── */

/** 빈 행을 추가하고 서버에 신규 생성 후 목록 갱신 */
/** 로컬 임시 ID 생성 카운터 */
let localIdSeq = 0;

/**
 * 빈 행을 로컬 목록에 추가 (서버에는 저장하지 않음)
 * 필수 필드를 모두 입력한 뒤 포커스 아웃 시 자동으로 서버에 저장됩니다.
 * 미입력 상태에서 새로고침/페이지 이동 시 해당 행은 사라집니다.
 */
const addRow = () => {
    const localId = `_new_${++localIdSeq}_${Date.now()}`;
    const newRow: ItCostEx & { _localId: string } = {
        _localId: localId,
        _status: 'new',
        ioeC: '', cttNm: '', pulDtt: '', cttOpp: '',
        itMngcBg: 0, dfrCle: '', fstDfrDt: '', cur: 'KRW',
        infPrtYn: 'N', indRsn: '',
        cgpr: user.value?.eno ?? '', cgprNm: user.value?.empNm ?? '',
        biceDpm: currentUserDetail.value?.bbrC ?? user.value?.bbrC ?? '',
        biceDpmNm: currentUserDetail.value?.bbrNm ?? '',
        biceTem: currentUserDetail.value?.temC ?? user.value?.temC ?? '',
        biceTemNm: currentUserDetail.value?.temNm ?? '',
        abusC: '', itMngcTp: 'IT_MNGC_TP_001',
        bgYy: selectedYear.value ? String(selectedYear.value) : String(defaultBgYear),
    };
    costs.value.unshift(newRow);
    /* 정렬 초기화하여 신규 행이 맨 위에 표시되도록 처리 */
    currentSortField.value = undefined;
    currentSortOrder.value = 0;
    /* 담당자는 현재 사용자로 자동 설정되므로 cgpr 제외하고 미입력 표시 */
    const emptyFields = REQUIRED_FIELDS
        .filter(f => !newRow[f.key])
        .map(f => f.key as string);
    invalidFieldsMap.set(localId, new Set(emptyFields));
    /* 현재 사용자 기준으로 담당자 검증 스냅샷 시드 */
    if (newRow.cgpr && newRow.cgprNm) {
        validatedCgprNmMap.set(localId, newRow.cgprNm);
    }
    /* 신규 행은 즉시 편집 모드로 진입 */
    editingRowKey.value = localId;
    toast.add({ severity: 'info', summary: '행추가', detail: '필수 항목을 입력하면 자동 저장됩니다.', life: 2000 });
};

/* ── 화면 모드 (조회 / 수정) ──────────────────────────────── */

/** 전체 화면 모드: 조회(기본) ↔ 수정. 조회 모드에서는 편집 UI(행추가/행삭제/일괄업로드/행수정) 모두 비활성. */
const viewMode = ref<'view' | 'edit'>('view');

/** [수정] 버튼: 조회 → 수정 전환 */
const enterEditMode = () => {
    viewMode.value = 'edit';
};

/** [저장] 버튼: _status 별로 create/update/delete API를 일괄 호출 후 조회 모드로 전환
 *  진행 순서:
 *   1) 현재 포커스 input을 blur — InlineEditCell의 @save 이벤트를 통해 markDirty가 마지막으로 호출되도록 함
 *   2) costs에서 _status='deleted' 행은 deleteCost, 'modified'는 updateCost, 'new'는 createCost 호출
 *   3) 성공/실패 카운트 집계 후 서버로부터 목록 재조회 (refreshCostsRaw) — 모든 _status 초기화
 *   4) 조회 모드로 전환 */
const saveAndExitEdit = async () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
    /* blur로 인한 markDirty 반영까지 한 tick 대기 */
    await nextTick();

    const targets = costs.value as ItCostEx[];
    const newRows = targets.filter(r => r._status === 'new');
    const modifiedRows = targets.filter(r => r._status === 'modified');
    const deletedRows = targets.filter(r => r._status === 'deleted');

    if (!newRows.length && !modifiedRows.length && !deletedRows.length) {
        viewMode.value = 'view';
        toast.add({ severity: 'info', summary: '저장', detail: '변경사항이 없습니다.', life: 1500 });
        return;
    }

    /* 신규 행 검증 — 필수 필드 누락 시 저장 중단 */
    for (const row of newRows) {
        const missing = validateRow(row);
        if (missing.length > 0) {
            markInvalidFields(row);
            toast.add({ severity: 'warn', summary: '저장 불가', detail: `신규 행 "${row.cttNm || '이름 없음'}"의 필수 항목이 누락되었습니다.`, life: 3000 });
            return;
        }
    }

    /* 수정 행 검증 — 담당자 미선택 등 invalidFieldsMap 에 기록된 항목이 있거나
       필수 필드가 비어있으면 저장 중단 (삭제 행은 페이로드 검증 불필요) */
    for (const row of [...newRows, ...modifiedRows]) {
        const key = rowKey(row);
        const invalidSet = invalidFieldsMap.get(key);
        if (invalidSet && invalidSet.size > 0) {
            toast.add({
                severity: 'warn',
                summary: '저장 불가',
                detail: `"${row.cttNm || '이름 없음'}" 행에 올바르지 않은 값이 있습니다.`,
                life: 3000,
            });
            return;
        }
        const missing = validateRow(row);
        if (missing.length > 0) {
            markInvalidFields(row);
            toast.add({
                severity: 'warn',
                summary: '저장 불가',
                detail: `"${row.cttNm || '이름 없음'}" 행의 필수 항목이 누락되었습니다: ${missing.join(', ')}`,
                life: 3000,
            });
            return;
        }
    }

    let successCount = 0;
    let failCount = 0;

    /* 삭제 먼저 처리 (순서상 deleted → modified → new가 안전) */
    for (const row of deletedRows) {
        if (!row.itMngcNo) continue;
        try {
            await deleteCost(row.itMngcNo);
            successCount++;
        } catch (e) {
            console.error('Delete failed', e);
            failCount++;
        }
    }
    for (const row of modifiedRows) {
        if (!row.itMngcNo) continue;
        try {
            const payload = { ...row, fstDfrDt: toDateString(row.fstDfrDt) } as ItCost;
            delete (payload as ItCostEx)._status;
            delete (payload as ItCostEx)._localId;
            await updateCost(row.itMngcNo, payload);
            successCount++;
        } catch (e) {
            console.error('Update failed', e);
            failCount++;
        }
    }
    for (const row of newRows) {
        try {
            const payload = { ...row, fstDfrDt: toDateString(row.fstDfrDt) } as ItCost;
            delete (payload as ItCostEx)._status;
            delete (payload as ItCostEx)._localId;
            await createCost(payload);
            successCount++;
        } catch (e) {
            console.error('Create failed', e);
            failCount++;
        }
    }

    /* refreshCostsRaw 전에 로컬 신규 행 제거 — watcher가 _localId 행을 보존하여
       서버 데이터와 합산되면 중복 레코드가 표시되는 문제 방지 */
    const localIds: string[] = [];
    costs.value.forEach(c => {
        const id = (c as ItCostEx)._localId;
        if (id) localIds.push(id);
    });
    localIds.forEach(id => invalidFieldsMap.delete(id));
    costs.value = costs.value.filter(c => !(c as ItCostEx)._localId);

    await refreshCostsRaw();
    viewMode.value = 'view';

    if (failCount > 0) {
        toast.add({ severity: 'warn', summary: '저장', detail: `${successCount}건 성공, ${failCount}건 실패`, life: 3000 });
    } else {
        toast.add({ severity: 'success', summary: '저장', detail: `${successCount}건 저장 완료`, life: 2000 });
    }
};

/** 로컬 변경사항(신규 행 + 수정/삭제 마크)을 모두 폐기하고 서버 데이터로 복원
 *  주의: costsRaw watcher는 기본적으로 _localId 행을 보존하므로, 여기서 먼저 제거해야
 *  서버 재조회 후에도 빈 행이 남아있는 문제를 방지할 수 있다. */
const discardLocalChangesAndRefresh = async () => {
    /* 1) 로컬 신규행(_localId)을 목록에서 제거 — 미입력 필드 표시도 함께 정리 */
    const localIds: string[] = [];
    costs.value.forEach(c => {
        const id = (c as ItCostEx)._localId;
        if (id) localIds.push(id);
    });
    localIds.forEach(id => invalidFieldsMap.delete(id));
    costs.value = costs.value.filter(c => !(c as ItCostEx)._localId);

    /* 2) 서버 행의 _status 마크 정리 (watcher가 서버 데이터로 덮어쓰기 전 선제 정리) */
    costs.value.forEach(c => {
        const r = c as ItCostEx;
        if (r._status) delete r._status;
    });

    /* 3) 서버로부터 최신 데이터 재조회 — modified 값들은 서버 원본으로 덮어써짐 */
    await refreshCostsRaw();
};

/** [취소] 버튼: 로컬 변경사항 모두 버리고 서버에서 다시 조회 → 조회 모드 */
const cancelEdit = async () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
    /* _status가 있는 행이 하나라도 있으면 확인 받고 재조회 */
    const hasPending = (costs.value as ItCostEx[]).some(r => r._status);
    if (hasPending) {
        confirm.require({
            message: '변경사항을 모두 버리고 조회 모드로 전환하시겠습니까?',
            header: '취소 확인',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '확인',
            rejectLabel: '계속 편집',
            accept: async () => {
                await discardLocalChangesAndRefresh();
                viewMode.value = 'view';
            }
        });
        return;
    }
    /* 변경사항 없으면 모드만 전환. 단, _status 없는 _localId 행이 있을 수 있으므로 로컬 행만 제거 */
    const hasLocalOnly = costs.value.some(c => (c as ItCostEx)._localId);
    if (hasLocalOnly) {
        costs.value = costs.value.filter(c => !(c as ItCostEx)._localId);
    }
    viewMode.value = 'view';
};

/* ── 행삭제 (체크박스 선택) ──────────────────────────────── */

/** 체크박스로 선택된 행 목록 */
const selectedRows = ref<ItCost[]>([]);

/** 선택된 행에 삭제 마크 부여 (실제 삭제는 [저장] 버튼 클릭 시 일괄 처리)
 *  - 로컬 신규행(_status='new')은 즉시 목록에서 제거 (서버에 존재하지 않으므로 API 호출 불필요)
 *  - 기존 서버행은 _status='deleted'로 마크 — 화면에는 회색 처리로 남아있음 */
const deleteSelectedRows = () => {
    if (!selectedRows.value.length) {
        toast.add({ severity: 'warn', summary: '삭제', detail: '삭제할 행을 선택해주세요.', life: 2000 });
        return;
    }
    /* 확인 다이얼로그 없이 즉시 삭제 표시 (실제 서버 삭제는 [저장] 시 처리) */
    const toRemoveLocalIds: string[] = [];
    for (const row of selectedRows.value) {
        const r = row as ItCostEx;
        if (r._status === 'new' && r._localId) {
            toRemoveLocalIds.push(r._localId);
            invalidFieldsMap.delete(r._localId);
        } else if (r.itMngcNo) {
            r._status = 'deleted';
        }
    }
    if (toRemoveLocalIds.length > 0) {
        costs.value = costs.value.filter(c => {
            const localId = (c as ItCostEx)._localId;
            return !localId || !toRemoveLocalIds.includes(localId);
        });
    }
    selectedRows.value = [];
    toast.add({ severity: 'info', summary: '삭제 표시', detail: '[저장] 버튼을 누르면 최종 반영됩니다.', life: 2000 });
};

/* ── 일괄다운로드 (Excel) ──────────────────────────────── */

/** 코드 ID → 코드명 변환 헬퍼 */
const codeName = (options: CodeOption[], cdId: string | undefined) =>
    options.find(o => o.cdId === cdId)?.cdNm ?? cdId ?? '';

/** 현재 필터링된 목록을 Excel 파일로 다운로드 (서버 미저장 로컬 행 제외, 공통 유틸 사용) */
const downloadExcel = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = filteredCosts.value.filter(c => !(c as any)._localId).map(c => ({
        '관리번호': c.itMngcNo ?? '',
        '사업코드': codeName(abusCOptions.value, c.abusC),
        '비목코드': codeName(ioeCOptions.value, c.ioeC),
        '계약명': c.cttNm ?? '',
        '계약구분': codeName(pulDttOptions.value, c.pulDtt),
        '계약상대처': c.cttOpp ?? '',
        '예산': c.itMngcBg ?? 0,
        '통화': c.cur ?? 'KRW',
        '지급주기': codeName(dfrCleOptions.value, c.dfrCle),
        '최초지급일': c.fstDfrDt instanceof Date
            ? `${c.fstDfrDt.getFullYear()}-${String(c.fstDfrDt.getMonth() + 1).padStart(2, '0')}`
            : (c.fstDfrDt ?? ''),
        '담당자사번': c.cgpr ?? '',
        '담당자명': c.cgprNm ?? '',
        '담당부서': c.biceDpmNm ?? '',
        '담당팀': c.biceTemNm ?? '',
        '결재현황': c.apfSts ?? '예산 작성',
    }));
    await exportRowsToExcel(
        rows,
        '전산업무비',
        `전산업무비_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
};

/* ── 일괄업로드 (Excel) ──────────────────────────────── */
const uploadInputRef = ref<HTMLInputElement | null>(null);

/** 코드명 → 코드 ID 역변환 헬퍼 (매칭 실패 시 원본 반환) */
const codeId = (options: CodeOption[], cdNm: string | undefined) =>
    options.find(o => o.cdNm === cdNm)?.cdId ?? cdNm ?? '';

/** 파일 선택 트리거 */
const triggerUpload = () => uploadInputRef.value?.click();

/** Excel 파일을 읽어 각 행을 서버에 신규 생성 */
const handleUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const { default: ExcelJS } = await import('exceljs');
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.worksheets[0];
        if (!ws) {
            toast.add({ severity: 'error', summary: '업로드', detail: '시트가 없는 파일입니다.', life: 2000 });
            return;
        }
        const headers: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: Record<string, any>[] = [];
        ws.eachRow((row, rowIndex) => {
            if (rowIndex === 1) {
                row.eachCell(cell => headers.push(String(cell.value ?? '')));
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const obj: Record<string, any> = {};
                row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
                    obj[headers[colIndex - 1] ?? ''] = cell.value ?? '';
                });
                rows.push(obj);
            }
        });

        if (!rows.length) {
            toast.add({ severity: 'warn', summary: '업로드', detail: '데이터가 없습니다.', life: 2000 });
            return;
        }

        let successCount = 0;
        let failCount = 0;
        for (const row of rows) {
            try {
                const payload: ItCost = {
                    abusC: codeId(abusCOptions.value, row['사업코드']),
                    ioeC: codeId(ioeCOptions.value, row['비목코드']),
                    cttNm: row['계약명'] ?? '',
                    pulDtt: codeId(pulDttOptions.value, row['계약구분']),
                    cttOpp: row['계약상대처'] ?? '',
                    itMngcBg: Number(row['예산']) || 0,
                    cur: row['통화'] || 'KRW',
                    dfrCle: codeId(dfrCleOptions.value, row['지급주기']),
                    fstDfrDt: row['최초지급일'] ? `${row['최초지급일']}-01` : '',
                    infPrtYn: 'N',
                    indRsn: '',
                    cgpr: row['담당자사번'] ?? user.value?.eno ?? '',
                    cgprNm: row['담당자명'] ?? '',
                    biceDpm: '', biceDpmNm: row['담당부서'] ?? '',
                    biceTem: '', biceTemNm: row['담당팀'] ?? '',
                    itMngcTp: 'IT_MNGC_TP_001',
                    bgYy: selectedYear.value ? String(selectedYear.value) : String(defaultBgYear),
                };
                await createCost(payload);
                successCount++;
            } catch {
                failCount++;
            }
        }
        await refreshCostsRaw();
        const detail = failCount > 0
            ? `${successCount}건 성공, ${failCount}건 실패`
            : `${successCount}건 업로드 완료`;
        toast.add({ severity: failCount > 0 ? 'warn' : 'success', summary: '일괄업로드', detail, life: 3000 });
    } catch (e) {
        console.error('업로드 실패', e);
        toast.add({ severity: 'error', summary: '오류', detail: '파일 처리 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        /* 같은 파일 재선택 가능하도록 초기화 */
        if (uploadInputRef.value) uploadInputRef.value.value = '';
    }
};

/** 금융정보단말기 비활성 필드 안내 문구 */
const TERMINAL_TOOLTIP = '단말기 상세 내용 작성 시 원화 환산 후 자동 계산됩니다.';

/* ── InlineEditCell용 옵션 변환 (CodeOption → { label, value }) ── */
const pulDttSelectOptions = computed(() => pulDttOptions.value.map(o => ({ label: o.cdNm, value: o.cdId })));
const abusCSelectOptions = computed(() => abusCOptions.value.map(o => ({ label: o.cdNm, value: o.cdId })));
const dfrCleSelectOptions = computed(() => dfrCleOptions.value.map(o => ({ label: o.cdNm, value: o.cdId })));
const curSelectOptions = computed(() => currencyOptions.map(c => ({ label: c, value: c })));

/* ── 비목코드 CascadeSelect 트리 구조 ────────────────────────── */

/**
 * IOE 코드 목록을 CascadeSelect 트리 구조로 변환
 * cdNm을 ' - ' 기준으로 분할하여 최대 3단계 계층 생성
 *   예) "전산임차료 - 국내전산임차료" → 전산임차료 > 국내전산임차료
 *       "전산용역비 - 외주용역 - 외주운영/관제 등" → 전산용역비 > 외주용역 > 외주운영/관제 등
 */
const ioeCascadeOptions = computed<IoeCategoryOption[]>(() => {
    if (ioeCOptions.value.length === 0) return [];

    const level1Map = new Map<string, { codes: IoeCodeOption[]; hasSub: boolean }>();
    for (const code of ioeCOptions.value) {
        const segments = code.cdNm.split(' - ').map(s => s.trim());
        const key = segments[0]!;
        if (!level1Map.has(key)) level1Map.set(key, { codes: [], hasSub: false });
        const group = level1Map.get(key)!;
        group.codes.push(code);
        if (segments.length >= 2) group.hasSub = true;
    }

    const options: IoeCategoryOption[] = [];
    for (const [label1, group] of level1Map) {
        if (group.codes.length === 1 && group.codes[0]!.cdNm.split(' - ').length <= 2) {
            const code = group.codes[0]!;
            options.push({ label: label1, cdId: code.cdId, cdva: code.cdva });
            continue;
        }

        const level2Map = new Map<string, IoeCodeOption[]>();
        for (const code of group.codes) {
            const segments = code.cdNm.split(' - ').map(s => s.trim());
            if (segments.length === 2) {
                level2Map.set(segments[1]!, [code]);
            } else if (segments.length >= 3) {
                const key2 = segments[1]!;
                if (!level2Map.has(key2)) level2Map.set(key2, []);
                level2Map.get(key2)!.push(code);
            }
        }

        const subItems: IoeCategoryOption[] = [];
        for (const [label2, codes] of level2Map) {
            if (codes.length === 1 && codes[0]!.cdNm.split(' - ').length <= 2) {
                subItems.push({ label: label2, cdId: codes[0]!.cdId, cdva: codes[0]!.cdva });
            } else if (codes.length === 1 && codes[0]!.cdNm.split(' - ').length >= 3) {
                const seg = codes[0]!.cdNm.split(' - ').map(s => s.trim());
                subItems.push({ label: `${label2} - ${seg.slice(2).join(' - ')}`, cdId: codes[0]!.cdId, cdva: codes[0]!.cdva });
            } else {
                const level3Items: IoeCategoryOption[] = codes.map(code => {
                    const seg = code.cdNm.split(' - ').map(s => s.trim());
                    return { label: seg.slice(2).join(' - '), cdId: code.cdId, cdva: code.cdva };
                });
                subItems.push({ label: label2, cdId: '', items: level3Items });
            }
        }

        options.push({ label: label1, cdId: '', items: subItems });
    }
    return options;
});

/** cdId → 선택값 표시 라벨 (cdNm의 마지막 세그먼트만, 예: "국내전산임차료") */
const getIoeDisplayLabel = (cdId: string): string => {
    const code = ioeCOptions.value.find(c => c.cdId === cdId);
    if (!code) return cdId;
    const segments = code.cdNm.split(' - ').map(s => s.trim());
    return segments[segments.length - 1]!;
};


/** 비목코드 셀 편집 중인 행의 키 */
const ioeEditingKey = ref<string | null>(null);

/** 외부 클릭 감지 핸들러: 셀/CascadeSelect 패널 외부 클릭 시 읽기 모드 복귀 */
const handleIoeOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    if (target.closest('.ioe-cascade-cell')) return;           // 셀 내부 클릭
    if (target.closest('.p-cascadeselect-overlay, .p-cascadeselect-panel')) return; // 패널 클릭
    exitIoeEdit();
};

/** 비목코드 셀 편집 모드 종료 */
const exitIoeEdit = () => {
    ioeEditingKey.value = null;
    document.removeEventListener('mousedown', handleIoeOutsideClick);
};

/** CascadeSelect 선택 시 cdId 반영, 변경 마크(수정 모드) — 저장은 [저장] 버튼에서 일괄 처리 */
const onIoeCSelect = (data: ItCost, selected: IoeCategoryOption) => {
    if (selected?.cdId) {
        data.ioeC = selected.cdId;
        if (!isRowEditing(data)) exitIoeEdit();
        markDirty(data);
    }
};

/**
 * 금융정보단말기 체크박스 클릭 시 네비게이션
 * - 미체크 → 체크: 단말기 상세목록 다이얼로그 (연결 신규 작성)
 * - 체크 → 클릭: 단말기 상세목록 다이얼로그 (수정)
 * - 미저장 행(itMngcNo 없음)은 무시
 */
/** 단말기 체크박스 편집 중인 행의 키 (itMngcNo) */
const terminalEditingKey = ref<string | null>(null);

/** 체크박스 편집 모드 외부 클릭 감지 핸들러 */
const handleTerminalOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target?.closest('.terminal-checkbox-cell')) {
        exitTerminalEdit();
    }
};

/** 체크박스 편집 모드 종료 (취소, 외부 클릭 시) */
const exitTerminalEdit = () => {
    terminalEditingKey.value = null;
    document.removeEventListener('mousedown', handleTerminalOutsideClick);
};

/* ── 행 전체 편집 모드 (수정 버튼) ──────────────────────────── */

/** 현재 행 전체 편집 모드인 행의 키 */
const editingRowKey = ref<string | null>(null);

/**
 * 행이 전체 편집 모드인지 확인
 * - 수정 모드(viewMode === 'edit')에서는 모든 행이 일괄 편집 가능
 * - 조회 모드에서는 editingRowKey와 일치하는 행만 편집 가능 (신규 행 편집 진입용)
 */
const isRowEditing = (data: ItCost) => viewMode.value === 'edit' || editingRowKey.value === rowKey(data);

/** 행 전체 편집 모드 시작 (레거시 per-row edit; 수정 모드에서는 전체 행이 이미 편집 상태) */
const startRowEdit = (data: ItCost) => {
    if (editingRowKey.value) {
        const prevRow = costs.value.find(c => rowKey(c) === editingRowKey.value);
        if (prevRow) markDirty(prevRow);
    }
    editingRowKey.value = rowKey(data) || null;
};

/** 행 전체 편집 모드 종료 (레거시) — 실제 저장은 [저장] 버튼에서 일괄 처리 */
const finishRowEdit = (data: ItCost) => {
    editingRowKey.value = null;
    exitIoeEdit();
    markDirty(data);
};

/**
 * 화면 모드 전환 시 부수 처리
 * - 수정 → 조회: 편집 보조 상태(editingRowKey/ioe/terminal)와 체크박스 선택 초기화
 *                 (실제 저장은 [저장] 버튼에서 일괄 처리하므로 여기서는 API 호출 없음)
 * - 조회 → 수정: 별도 처리 없음
 */
watch(viewMode, (newMode) => {
    if (newMode !== 'view') return;
    editingRowKey.value = null;
    exitIoeEdit();
    exitTerminalEdit();
    selectedRows.value = [];
});

/** 단일 행 삭제 (확인 다이얼로그 없이 즉시 처리)
 *  - 이미 삭제 표시된 행: 삭제 마크 해제 (토글 방식 복원)
 *  - 로컬 신규행(_status='new'): 목록에서 즉시 제거 (서버 미존재)
 *  - 기존 서버행: _status='deleted'로 마크 — [저장] 시 일괄 반영 */
const deleteRow = (data: ItCost) => {
    const d = data as ItCostEx;
    const localId = d._localId;

    if (d._status === 'deleted') {
        d._status = 'modified';
        return;
    }

    if (d._status === 'new' && localId) {
        costs.value = costs.value.filter(c => (c as ItCostEx)._localId !== localId);
        invalidFieldsMap.delete(localId);
        if (editingRowKey.value === localId) editingRowKey.value = null;
    } else if (data.itMngcNo) {
        d._status = 'deleted';
    }
};

/* ── 단말기 상세목록 다이얼로그 상태 ──────────────────────── */
const terminalDialogVisible = ref(false);
const terminalDialogItMngcNo = ref<string | undefined>(undefined);
const terminalDialogParentCostId = ref<string | undefined>(undefined);
const terminalDialogBgYy = ref<string | undefined>(undefined);
/** 로컬 모드: 미저장 신규 행의 ItCost 데이터 (API 저장 없이 터미널 목록 편집용) */
const terminalDialogLocalCost = ref<ItCost | null>(null);
/** 로컬 모드: 터미널 목록을 되돌려 쓸 원본 행 참조 */
const terminalDialogLocalRow = ref<ItCostEx | null>(null);

/* ── 단말기 작성 여부 확인 다이얼로그 ──────────────────────── */
const terminalWriteConfirmVisible = ref(false);
const terminalWriteConfirmData = ref<ItCost | null>(null);

/**
 * 단말기 1건의 실효 환율 반환
 *  - cur가 KRW이면 항상 1
 *  - xcr가 1을 초과하는 유효값이면 그 값 사용 (사용자가 직접 입력한 환율)
 *  - xcr가 0이거나 1이면 기본값(미입력)으로 간주하고 공통환율 API 값 사용
 *  - API에도 없으면 1 (보호값)
 */
const terminalItemRate = (t: { cur: string; xcr?: number }): number => {
    if (!t.cur || t.cur === 'KRW') return 1;
    return (t.xcr && t.xcr > 1) ? t.xcr : (exchangeRates.value[t.cur] || 1);
};

/** 단말기 상세목록 원화 환산 합계 */
const terminalKrwTotal = (data: ItCost): number => {
    if (!data.terminals?.length) return 0;
    return data.terminals.reduce((sum, t) =>
        sum + Math.round((t.tmlAmt || 0) * terminalItemRate(t)), 0);
};

/**
 * 예산 열 원화 환산 표시값 반환
 *  - 단말기 행: terminals 합계(이미 원화)
 *  - 일반 행 KRW: itMngcBg 그대로
 *  - 일반 행 외화: itMngcBg × xcr(직접 입력) 또는 공통환율
 */
const budgetKrwDisplay = (data: ItCost): number => {
    if (isTerminal(data)) return terminalKrwTotal(data);
    const amount = data.itMngcBg ?? 0;
    if (!data.cur || data.cur === 'KRW') return amount;
    /* xcr > 1: 사용자 직접 입력 환율 / 그 외(0·1·미입력): 공통환율 API 사용 */
    const rate = (data.xcr && data.xcr > 1) ? data.xcr : (exchangeRates.value[data.cur] || 1);
    return Math.round(amount * rate);
};

/** 예산 열 툴팁: 외화인 경우 원본 금액 + 통화코드 표시 */
const budgetTooltip = (data: ItCost): string => {
    if (isTerminal(data)) return TERMINAL_TOOLTIP;
    if (data.cur && data.cur !== 'KRW' && data.itMngcBg) {
        return `원본: ${(data.itMngcBg).toLocaleString()} ${data.cur} → 원화 환산값`;
    }
    return '예산은 직접 입력할 수 없습니다.';
};

/** 단말기 상세목록 다이얼로그 열기 (저장된 행 — API 모드) */
const openTerminalDialog = (itMngcNo?: string, parentCostId?: string, bgYy?: string) => {
    terminalDialogItMngcNo.value = itMngcNo;
    terminalDialogParentCostId.value = parentCostId;
    terminalDialogBgYy.value = bgYy;
    terminalDialogLocalCost.value = null;
    terminalDialogLocalRow.value = null;
    terminalDialogVisible.value = true;
};

/** 단말기 상세목록 다이얼로그 열기 (미저장 신규 행 — 로컬 모드)
 *  API를 호출하지 않고 메모리에서만 편집. 부모의 [저장] 시 함께 서버에 저장됨. */
const openLocalTerminalDialog = (data: ItCost) => {
    if (!data.terminals) data.terminals = [];
    terminalDialogItMngcNo.value = undefined;
    terminalDialogParentCostId.value = undefined;
    terminalDialogBgYy.value = undefined;
    terminalDialogLocalCost.value = data;
    terminalDialogLocalRow.value = data as ItCostEx;
    terminalDialogVisible.value = true;
};

/** 로컬 모드 다이얼로그에서 터미널 목록 업데이트 시 행에 반영 */
const onLocalTerminalsUpdate = (updatedTerminals: Terminal[]) => {
    if (terminalDialogLocalRow.value) {
        terminalDialogLocalRow.value.terminals = updatedTerminals;
        markDirty(terminalDialogLocalRow.value);
    }
    terminalDialogLocalCost.value = null;
    terminalDialogLocalRow.value = null;
};

/**
 * 단말기 상세목록 다이얼로그에서 저장 완료 시 호출되는 핸들러.
 * 목록을 재조회한 뒤, 편집 모드라면 해당 부모 행(전산업무비)을 'modified'로 마킹하여
 * [저장] 버튼을 눌렀을 때 부모 행도 updateCost 대상으로 포함되도록 한다.
 * (부모 본인의 입력 필드 변경 여부와 무관하게 자식 변경을 부모 변경으로 반영)
 */
const onTerminalSaved = async () => {
    const savedId = terminalDialogItMngcNo.value;
    await refreshCostsRaw();
    if (!savedId || viewMode.value !== 'edit') return;
    await nextTick();
    const row = costs.value.find(c => c.itMngcNo === savedId);
    if (row) markDirty(row);
};

/** [나중에 작성]: 유형만 단말기로 전환하고 상세목록 작성은 나중에 */
const onTerminalWriteLater = () => {
    const data = terminalWriteConfirmData.value;
    if (data) {
        data.itMngcTp = 'IT_MNGC_TP_002';
        markDirty(data);
    }
    terminalWriteConfirmVisible.value = false;
    terminalWriteConfirmData.value = null;
};

/** [지금 작성]: 유형 전환 후 상세목록 다이얼로그 열기
 *  - 저장된 행(itMngcNo 있음): API 연결 모드로 즉시 서버 저장
 *  - 미저장 신규 행: 로컬 모드로 열어 메모리에만 저장, 부모 [저장] 시 함께 전송 */
const onTerminalWriteNow = () => {
    const data = terminalWriteConfirmData.value;
    terminalWriteConfirmVisible.value = false;
    terminalWriteConfirmData.value = null;
    if (!data) return;
    data.itMngcTp = 'IT_MNGC_TP_002';
    markDirty(data);
    if (data.itMngcNo) {
        const bgYy = String(selectedYear.value ?? defaultBgYear);
        openTerminalDialog(undefined, data.itMngcNo, bgYy);
    } else {
        openLocalTerminalDialog(data);
    }
};

const onTerminalCheckClick = (data: ItCost) => {
    if (isTerminal(data)) {
        /* 이미 단말기 타입: 저장된 행이면 API 모드로 편집, 미저장이면 로컬 모드로 편집 */
        if (data.itMngcNo) {
            openTerminalDialog(data.itMngcNo);
        } else {
            openLocalTerminalDialog(data);
        }
        return;
    }
    /* 일반 → 단말기 전환: 지금/나중에 작성 여부 선택 */
    terminalWriteConfirmData.value = data;
    terminalWriteConfirmVisible.value = true;
};

/* ── 계속 계약 자동완성 및 전년도 데이터 불러오기 ──────────── */

/** 계약구분이 '계속'인지 확인 */
const isKesok = (data: ItCost) => {
    const opt = pulDttOptions.value.find(o => o.cdId === data.pulDtt);
    return opt?.cdNm === '계속';
};

/** 전년도 계약 자동완성 검색 결과 */
const continuationSuggestions = ref<ItCost[]>([]);

/** 불러오기 확인 다이얼로그 표시 여부 */
const continuationDialogVisible = ref(false);

/** 선택된 전년도 계약 후보 (확인 후 반영) */
const continuationPending = ref<{ target: ItCost; source: ItCost } | null>(null);

/**
 * 계약명 입력 시 전년도 동일 유형 계약 검색
 * bgYy 기준 -1년, 동일 itMngcTp 조건으로 조회 후 키워드 필터링
 */
const searchContinuation = async (event: { query: string }, data: ItCost) => {
    const prevYear = data.bgYy
        ? String(Number(data.bgYy) - 1)
        : String((selectedYear.value ?? currentYear) - 1);
    try {
        const results = await $apiFetch<ItCost[]>(`${config.public.apiBase}/api/cost`, {
            query: { bgYy: prevYear, itMngcTp: data.itMngcTp }
        });
        const kw = event.query.trim().toLowerCase();
        continuationSuggestions.value = (results ?? []).filter(c =>
            !kw || c.cttNm?.toLowerCase().includes(kw)
        );
    } catch {
        continuationSuggestions.value = [];
    }
};

/** 자동완성에서 전년도 계약 선택 시 확인 다이얼로그 표시 */
const onContinuationSelect = (target: ItCost, source: ItCost) => {
    continuationPending.value = { target, source };
    continuationDialogVisible.value = true;
};

/**
 * 확인 후 전년도 데이터를 현재 행에 반영
 * - 최초지급일: 전년도 + 1년
 * - 금융정보단말기: 단말기 상세목록까지 복사 (식별키 제외)
 * - 현재 행의 관리번호·예산연도·결재현황은 유지
 */
const applyContinuation = async () => {
    if (!continuationPending.value) return;
    const { target, source } = continuationPending.value;

    /* 금융정보단말기는 단말기 목록 포함 상세 조회 */
    let fullSource: ItCost = source;
    if (source.itMngcTp === 'IT_MNGC_TP_002' && source.itMngcNo) {
        try {
            fullSource = await fetchCostOnce(source.itMngcNo);
        } catch {
            fullSource = source;
        }
    }

    /* 최초지급일 +1년 */
    let newFstDfrDt: Date | string = '';
    if (fullSource.fstDfrDt) {
        const d = fullSource.fstDfrDt instanceof Date
            ? new Date(fullSource.fstDfrDt)
            : new Date(fullSource.fstDfrDt as string);
        if (!Number.isNaN(d.getTime())) {
            d.setFullYear(d.getFullYear() + 1);
            newFstDfrDt = d;
        }
    }

    /* 단말기 목록 복사 (서버 식별키 제거) */
    const terminals = fullSource.terminals
        ? fullSource.terminals.map(({ tmnMngNo: _tmnMngNo, tmnSno: _tmnSno, ...rest }) => ({ ...rest }))
        : undefined;

    /* 현재 행에 전년도 데이터 반영 (식별자·연도·결재현황은 유지) */
    Object.assign(target, {
        abusC: fullSource.abusC,
        ioeC: fullSource.ioeC,
        cttNm: fullSource.cttNm,
        pulDtt: target.pulDtt,     // '계속' 유지
        cttOpp: fullSource.cttOpp,
        itMngcBg: fullSource.itMngcBg,
        cur: fullSource.cur,
        xcr: fullSource.xcr,
        xcrBseDt: fullSource.xcrBseDt,
        dfrCle: fullSource.dfrCle,
        fstDfrDt: newFstDfrDt,
        infPrtYn: fullSource.infPrtYn,
        indRsn: fullSource.indRsn,
        cgpr: fullSource.cgpr,
        cgprNm: fullSource.cgprNm,
        biceDpm: fullSource.biceDpm,
        biceDpmNm: fullSource.biceDpmNm,
        biceTem: fullSource.biceTem,
        biceTemNm: fullSource.biceTemNm,
        itMngcTp: fullSource.itMngcTp,
        ...(terminals !== undefined ? { terminals } : {}),
    });

    continuationDialogVisible.value = false;
    continuationPending.value = null;

    markDirty(target);
};
    return {
        yearOptions,
        selectedYear,
        error,
        costs,
        rowKey,
        markDirty,
        rowStatus,
        rowClass,
        isFieldInvalid,
        employeeDialogVisible,
        employeeSuggestions,
        currentSortField,
        currentSortOrder,
        pageSizeOptions,
        pageSize,
        searchKeyword,
        filteredCosts,
        isTerminal,
        hasTerminalItems,
        searchEmployee,
        onEmployeeSelect,
        onCgprBlur,
        openEmployeeSearch,
        onDialogEmployeeSelect,
        addRow,
        viewMode,
        enterEditMode,
        saveAndExitEdit,
        cancelEdit,
        selectedRows,
        deleteSelectedRows,
        downloadExcel,
        uploadInputRef,
        triggerUpload,
        handleUpload,
        TERMINAL_TOOLTIP,
        pulDttSelectOptions,
        abusCSelectOptions,
        dfrCleSelectOptions,
        curSelectOptions,
        ioeCascadeOptions,
        getIoeDisplayLabel,
        ioeEditingKey,
        onIoeCSelect,
        isRowEditing,
        startRowEdit,
        finishRowEdit,
        deleteRow,
        terminalDialogVisible,
        terminalDialogItMngcNo,
        terminalDialogParentCostId,
        terminalDialogBgYy,
        terminalDialogLocalCost,
        terminalWriteConfirmVisible,
        terminalKrwTotal,
        budgetKrwDisplay,
        budgetTooltip,
        openTerminalDialog,
        openLocalTerminalDialog,
        onLocalTerminalsUpdate,
        onTerminalSaved,
        onTerminalWriteLater,
        onTerminalWriteNow,
        onTerminalCheckClick,
        isKesok,
        continuationSuggestions,
        continuationDialogVisible,
        continuationPending,
        searchContinuation,
        onContinuationSelect,
        applyContinuation,
    };
};
