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
import { ref, reactive, computed, watch, onMounted, onActivated, onUnmounted } from 'vue';

import { useCost, type ItCost } from '~/composables/useCost';
import { getApprovalTagClass } from '~/utils/common';
import { useAuth } from '~/composables/useAuth';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import InlineEditCell from '~/components/common/InlineEditCell.vue';


const title = '전산업무비 목록';
definePageMeta({ title: '전산업무비 목록' });

const { fetchCosts, fetchCostOnce, createCost, updateCost, deleteCost } = useCost();
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
const { data: costsRaw, error, refresh: refreshCostsRaw } = await fetchCosts();

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

/** 저장 중인 행의 itMngcNo Set (중복 저장 방지) */
const savingRows = ref(new Set<string>());

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
    /* 원본 스냅샷 갱신 + 서버 데이터의 미입력 필드 표시 */
    snapshots.clear();
    costs.value.forEach(c => {
        if (c.itMngcNo) {
            snapshots.set(c.itMngcNo, toSnapshot(c));
            markInvalidFields(c);
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

/* ── 예산 단위 변환 ──────────────────────────────────────── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원');

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

/** KeepAlive 재활성화 시 목록 새로고침 (단말기 폼 저장 후 돌아왔을 때 예산 현행화) */
onActivated(() => {
    refreshCostsRaw();
});

/** 컴포넌트 언마운트 시 체크박스 편집 모드 이벤트 리스너 정리 */
onUnmounted(() => {
    document.removeEventListener('mousedown', handleTerminalOutsideClick);
    document.removeEventListener('mousedown', handleIoeOutsideClick);
});

/** 전산업무비유형이 IT_MNGC_TP_002(금융정보단말기)이면 예산·통화 수정 불가 */
const isTerminal = (data: ItCost) => data.itMngcTp === 'IT_MNGC_TP_002';

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
    saveRow(data);
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
    saveRow(data);
};

/* ── 행 단위 자동 저장 (포커스 아웃 / 값 변경 시) ──────────── */

/** fstDfrDt Date 객체 → 'YYYY-MM-01' 문자열 변환 */
const toDateString = (dt: string | Date | undefined): string => {
    if (!dt || !(dt instanceof Date)) return typeof dt === 'string' ? dt : '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
};

/**
 * 단일 행 저장 (검증 통과 시에만 서버 반영)
 * - 로컬 신규 행(_localId): 검증 통과 → createCost → 서버 저장 후 목록 갱신
 * - 기존 행(itMngcNo): 검증 통과 + 변경 시 → updateCost
 */
const saveRow = async (data: ItCost) => {
    const key = rowKey(data);
    if (!key) return;

    /* ── 로컬 신규 행 → 필수 필드 모두 입력 시에만 서버에 신규 생성 ── */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((data as any)._localId) {
        /* 필수 필드가 비어있으면 아직 저장하지 않고 검증 표시만 갱신 */
        const missing = validateRow(data);
        if (missing.length > 0) {
            markInvalidFields(data);
            return;
        }
        if (savingRows.value.has(key)) return;
        savingRows.value.add(key);
        try {
            const payload = { ...data, fstDfrDt: toDateString(data.fstDfrDt) };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (payload as any)._localId;
            /* createCost는 생성된 itMngcNo(문자열)를 반환 */
            const newItMngcNo = await createCost(payload) as unknown as string;
            invalidFieldsMap.delete(key);
            /* 로컬 행을 서버 행으로 전환 (itMngcNo 부여, _localId 제거) */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (data as any)._localId;
            data.itMngcNo = newItMngcNo;
            snapshots.set(newItMngcNo, toSnapshot(data));
            markInvalidFields(data);
            toast.add({ severity: 'success', summary: '저장', detail: `${data.cttNm || '신규 행'} 저장 완료`, life: 1500 });
        } catch (e) {
            console.error('Create failed', e);
            toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
        } finally {
            savingRows.value.delete(key);
        }
        return;
    }

    /* ── 기존 행 → 변경 감지 후 업데이트 ── */
    if (!data.itMngcNo) return;
    if (savingRows.value.has(data.itMngcNo)) return;

    const current = toSnapshot(data);
    if (snapshots.get(data.itMngcNo) === current) return;

    savingRows.value.add(data.itMngcNo);
    try {
        const payload = { ...data, fstDfrDt: toDateString(data.fstDfrDt) };
        await updateCost(data.itMngcNo, payload);
        snapshots.set(data.itMngcNo, current);
        toast.add({ severity: 'success', summary: '저장', detail: `${data.cttNm || data.itMngcNo} 저장 완료`, life: 1500 });
        /* 저장 성공 후 미입력 필드 체크 (빨간 테두리만 표시, 토스트 없음) */
        markInvalidFields(data);
    } catch (e) {
        console.error('Save failed', e);
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        savingRows.value.delete(data.itMngcNo!);
    }
};

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
    const newRow: ItCost & { _localId: string } = {
        _localId: localId,
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
    toast.add({ severity: 'info', summary: '행추가', detail: '필수 항목을 입력하면 자동 저장됩니다.', life: 2000 });
};

/* ── 행삭제 (체크박스 선택) ──────────────────────────────── */

/** 체크박스로 선택된 행 목록 */
const selectedRows = ref<ItCost[]>([]);

/** 선택된 행 삭제 (로컬 행은 즉시 제거, 서버 행은 deleteCost 호출) */
const deleteSelectedRows = () => {
    if (!selectedRows.value.length) {
        toast.add({ severity: 'warn', summary: '삭제', detail: '삭제할 행을 선택해주세요.', life: 2000 });
        return;
    }
    confirm.require({
        message: `선택한 ${selectedRows.value.length}건을 삭제하시겠습니까?`,
        header: '행 삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            let successCount = 0;
            let failCount = 0;
            for (const row of selectedRows.value) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const localId = (row as any)._localId;
                if (localId) {
                    /* 로컬 미저장 행: 목록에서 제거 */
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    costs.value = costs.value.filter(c => (c as any)._localId !== localId);
                    invalidFieldsMap.delete(localId);
                    successCount++;
                } else if (row.itMngcNo) {
                    /* 서버 저장 행: API 삭제 */
                    try {
                        await deleteCost(row.itMngcNo);
                        successCount++;
                    } catch {
                        failCount++;
                    }
                }
            }
            if (successCount > 0) await refreshCostsRaw();
            selectedRows.value = [];
            const detail = failCount > 0
                ? `${successCount}건 삭제, ${failCount}건 실패`
                : `${successCount}건 삭제 완료`;
            toast.add({ severity: failCount > 0 ? 'warn' : 'success', summary: '삭제', detail, life: 2000 });
        },
    });
};

/* ── 일괄다운로드 (Excel) ──────────────────────────────── */

/** 코드 ID → 코드명 변환 헬퍼 */
const codeName = (options: CodeOption[], cdId: string | undefined) =>
    options.find(o => o.cdId === cdId)?.cdNm ?? cdId ?? '';

/** 현재 필터링된 목록을 Excel 파일로 다운로드 (서버 미저장 로컬 행 제외) */
const downloadExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
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
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('전산업무비');
    if (rows.length > 0) {
        ws.columns = Object.keys(rows[0]!).map(k => ({ header: k, key: k }));
        rows.forEach(row => ws.addRow(row));
    }
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `전산업무비_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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

/** cdId로 트리 노드 탐색 (CascadeSelect :model-value용) */
const findIoeCategoryOption = (cdId: string): IoeCategoryOption | null => {
    if (!cdId) return null;
    const search = (opts: IoeCategoryOption[]): IoeCategoryOption | null => {
        for (const opt of opts) {
            if (opt.cdId === cdId) return opt;
            if (opt.items) {
                const found = search(opt.items);
                if (found) return found;
            }
        }
        return null;
    };
    return search(ioeCascadeOptions.value);
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

/** 비목코드 셀 편집 모드 진입 */
const startIoeEdit = (data: ItCost) => {
    ioeEditingKey.value = rowKey(data) || null;
    document.addEventListener('mousedown', handleIoeOutsideClick);
};

/** 비목코드 셀 편집 모드 종료 */
const exitIoeEdit = () => {
    ioeEditingKey.value = null;
    document.removeEventListener('mousedown', handleIoeOutsideClick);
};

/** CascadeSelect 선택 시 cdId 반영 후 저장, 행 전체 편집 모드가 아니면 셀 편집 모드 종료 */
const onIoeCSelect = (data: ItCost, selected: IoeCategoryOption) => {
    if (selected?.cdId) {
        data.ioeC = selected.cdId;
        if (!isRowEditing(data)) exitIoeEdit();
        saveRow(data);
    }
};

/**
 * 금융정보단말기 체크박스 클릭 시 네비게이션
 * - 미체크 → 체크: terminal/form?costId={itMngcNo} 로 연결 신규 작성
 * - 체크 → 클릭: terminal/form?id={itMngcNo} 로 수정 이동
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

/** 체크박스 편집 모드 진입 */
const startTerminalEdit = (data: ItCost) => {
    if (!data.itMngcNo) {
        toast.add({ severity: 'warn', summary: '알림', detail: '행을 먼저 저장해주세요.', life: 2000 });
        return;
    }
    terminalEditingKey.value = data.itMngcNo;
    document.addEventListener('mousedown', handleTerminalOutsideClick);
};

/** 체크박스 편집 모드 종료 (취소, 외부 클릭 시) */
const exitTerminalEdit = () => {
    terminalEditingKey.value = null;
    document.removeEventListener('mousedown', handleTerminalOutsideClick);
};

/** 체크박스 값 변경 시 실제 동작 수행 후 조회 모드로 복귀 */
const onTerminalCheckChange = (data: ItCost) => {
    exitTerminalEdit();
    onTerminalCheckClick(data);
};

/* ── 행 전체 편집 모드 (수정 버튼) ──────────────────────────── */

/** 현재 행 전체 편집 모드인 행의 키 */
const editingRowKey = ref<string | null>(null);

/** 행이 전체 편집 모드인지 확인 */
const isRowEditing = (data: ItCost) => editingRowKey.value === rowKey(data);

/** 행 전체 편집 모드 시작 */
const startRowEdit = (data: ItCost) => {
    // 다른 행이 편집 중이면 먼저 저장 후 전환
    if (editingRowKey.value) {
        const prevRow = costs.value.find(c => rowKey(c) === editingRowKey.value);
        if (prevRow) saveRow(prevRow);
    }
    editingRowKey.value = rowKey(data) || null;
};

/** 행 전체 편집 모드 종료 및 저장 */
const finishRowEdit = async (data: ItCost) => {
    editingRowKey.value = null;
    exitIoeEdit();
    await saveRow(data);
};

/** 단일 행 삭제 (확인 다이얼로그 후 처리) */
const deleteRow = (data: ItCost) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localId = (data as any)._localId;
    confirm.require({
        message: `"${data.cttNm || '미저장 행'}"을 삭제하시겠습니까?`,
        header: '행 삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            if (localId) {
                /* 로컬 미저장 행: 목록에서 즉시 제거 */
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                costs.value = costs.value.filter(c => (c as any)._localId !== localId);
                if (editingRowKey.value === localId) editingRowKey.value = null;
            } else if (data.itMngcNo) {
                try {
                    await deleteCost(data.itMngcNo);
                    await refreshCostsRaw();
                    if (editingRowKey.value === data.itMngcNo) editingRowKey.value = null;
                    toast.add({ severity: 'success', summary: '삭제', detail: `${data.cttNm || data.itMngcNo} 삭제 완료`, life: 1500 });
                } catch {
                    toast.add({ severity: 'error', summary: '오류', detail: '삭제 중 오류가 발생했습니다.', life: 3000 });
                }
            }
        }
    });
};

const onTerminalCheckClick = (data: ItCost) => {
    if (!data.itMngcNo) {
        toast.add({ severity: 'warn', summary: '알림', detail: '행을 먼저 저장해주세요.', life: 2000 });
        return;
    }
    if (isTerminal(data)) {
        /* 이미 금융정보단말기 → 상세 수정 화면 이동 */
        navigateTo(`/info/cost/terminal/form?id=${data.itMngcNo}`);
    } else {
        /* 일반 → 금융정보단말기 전환: 연결 신규 작성 화면 이동 (선택된 예산연도 전달) */
        const bgYy = selectedYear.value ?? defaultBgYear;
        navigateTo(`/info/cost/terminal/form?costId=${data.itMngcNo}&bgYy=${bgYy}`);
    }
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
        ? fullSource.terminals.map(({ tmnMngNo, tmnSno, ...rest }) => ({ ...rest }))
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

    saveRow(target);
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더 -->
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>

        <!-- 예산연도 필터 -->
        <div class="flex items-center gap-2">
            <Select v-model="selectedYear" :options="yearOptions" option-label="label" option-value="value"
                class="w-36" />
        </div>

        <!-- 데이터 테이블 영역 -->
        <div
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-4">

            <!-- 상단 바: 페이지크기 + 검색(좌) + 액션 버튼(우) -->
            <div class="flex items-center justify-between mb-3 gap-3">
                <div class="flex items-center gap-2">
                    <Select v-model="pageSize" :options="pageSizeOptions" option-label="label" option-value="value"
                        class="shrink-0" />
                    <IconField>
                        <InputIcon class="pi pi-search" />
                        <InputText v-model="searchKeyword" placeholder="통합 검색" class="w-64" />
                    </IconField>
                </div>
                <div class="flex items-center gap-2">
                    <Button label="행추가" icon="pi pi-plus" severity="secondary" outlined size="small" @click="addRow" />
                    <Button label="행삭제" icon="pi pi-trash" severity="danger" outlined size="small"
                        :disabled="!selectedRows.length" @click="deleteSelectedRows" />
                    <Button label="일괄업로드" icon="pi pi-upload" severity="secondary" outlined size="small"
                        @click="triggerUpload" />
                    <input ref="uploadInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="handleUpload">
                    <Button label="일괄다운로드" icon="pi pi-download" severity="secondary" outlined size="small"
                        @click="downloadExcel" />
                </div>
            </div>

            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>

            <StyledDataTable v-else v-model:selection="selectedRows" :value="filteredCosts" paginator :rows="pageSize"
                :sort-field="currentSortField" :sort-order="currentSortOrder" removable-sort
                :data-key="(row: ItCost & { _localId?: string }) => row.itMngcNo || row._localId">
                <!-- 체크박스 선택 컬럼 -->
                <Column selection-mode="multiple" header-style="width: 3rem" />

                <!-- 신규/계속 (PUL_DTT) — 클릭 편집 (REQ-5) -->
                <Column field="pulDtt" header="신규/계속" sortable style="width: 100px; min-width: 100px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.pulDtt" type="select" :options="pulDttSelectOptions"
                            :invalid="isFieldInvalid(data, 'pulDtt')" :force-edit="isRowEditing(data)" placeholder="선택"
                            class="text-center"
                            @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 계약명: 신규/계속이 '계속'이면 전년도 계약 자동완성, 아니면 일반 입력 (REQ-5) -->
                <Column field="cttNm" header="계약명" sortable style="min-width: 200px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.cttNm" :type="isKesok(data) ? 'autocomplete' : 'text'"
                            :suggestions="continuationSuggestions" option-label="cttNm" placeholder="계약명 입력"
                            :invalid="isFieldInvalid(data, 'cttNm')" :force-edit="isRowEditing(data)"
                            @complete="searchContinuation($event, data)"
                            @item-select="onContinuationSelect(data, $event.value)" @save="saveRow(data)">
                            <template #option="{ option }">
                                <div class="py-1 pl-2 border-l-2 border-indigo-400">
                                    <div class="text-sm font-semibold">{{ option.cttNm }}</div>
                                    <div class="text-xs text-zinc-400">{{ option.cttOpp }} · {{ option.bgYy }}년</div>
                                </div>
                            </template>
                        </InlineEditCell>
                    </template>
                </Column>

                <!-- 금융정보단말기 체크박스 (REQ-4) — 클릭 시 편집 모드, 값 변경/외부 클릭 시 조회 모드로 복귀 -->
                <Column field="itMngcTp" header="단말기" sortable style="width: 70px; text-align: center">
                    <template #body="{ data }">
                        <div class="terminal-checkbox-cell flex justify-center items-center">
                            <!-- 편집 모드: 체크박스 변경 가능, 변경 시 실제 동작 후 조회 모드 복귀 -->
                            <Checkbox v-if="terminalEditingKey === data.itMngcNo"
                                :model-value="data.itMngcTp === 'IT_MNGC_TP_002'" binary
                                @update:model-value="onTerminalCheckChange(data)" />
                            <!-- 조회 모드: 클릭 시 편집 모드 진입 -->
                            <div v-else
                                class="cursor-pointer p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                                @click.stop="startTerminalEdit(data)">
                                <Checkbox :model-value="data.itMngcTp === 'IT_MNGC_TP_002'" binary :disabled="true" />
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- 계약상대처 — 클릭 편집 (REQ-5) -->
                <Column field="cttOpp" header="계약상대처" sortable style="min-width: 120px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.cttOpp" type="text" :invalid="isFieldInvalid(data, 'cttOpp')"
                            :force-edit="isRowEditing(data)" @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 사업코드 — 클릭 편집 (REQ-5) -->
                <Column field="abusC" header="사업코드" sortable style="min-width: 160px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.abusC" type="select" :options="abusCSelectOptions"
                            :invalid="isFieldInvalid(data, 'abusC')" :force-edit="isRowEditing(data)" placeholder="선택"
                            @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 비목코드 — 읽기모드(span)/편집모드(CascadeSelect) 전환 -->
                <Column field="ioeC" header="비목코드" sortable style="min-width: 130px">
                    <template #body="{ data }">
                        <!-- 읽기 모드: 클릭하면 편집 모드로 전환 -->
                        <span v-if="!isRowEditing(data) && ioeEditingKey !== rowKey(data)" :class="[
                            'inline-block w-full px-2 py-1 rounded cursor-pointer min-h-[2rem] leading-[2rem]',
                            'hover:bg-surface-100 dark:hover:bg-surface-800',
                            isFieldInvalid(data, 'ioeC') ? 'ring-1 ring-red-500' : ''
                        ]" @click.stop="startIoeEdit(data)">
                            {{ data.ioeC ? getIoeDisplayLabel(data.ioeC) : '-' }}
                        </span>
                        <!-- 편집 모드: CascadeSelect (ioe-cascade-cell로 외부 클릭 감지 대상 식별) -->
                        <div v-else class="ioe-cascade-cell">
                            <CascadeSelect :model-value="findIoeCategoryOption(data.ioeC)" :options="ioeCascadeOptions"
                                option-label="label" option-group-label="label" option-group-children="items"
                                placeholder="비목코드 선택" fluid :invalid="isFieldInvalid(data, 'ioeC')"
                                @change="onIoeCSelect(data, $event.value)">
                                <!-- 선택된 값: 마지막 세그먼트만 표시 (예: 국내전산임차료) -->
                                <template #value="{ value }">
                                    <template v-if="value?.cdId">{{ getIoeDisplayLabel(value.cdId) }}</template>
                                    <template v-else-if="data.ioeC">{{ getIoeDisplayLabel(data.ioeC) }}</template>
                                    <span v-else class="text-zinc-400">비목코드 선택</span>
                                </template>
                                <!-- 옵션 항목: 이름 + 코드설명(cdva) -->
                                <template #option="{ option }">
                                    <div class="py-0.5">
                                        <div class="font-medium text-sm">{{ option.label }}</div>
                                        <div v-if="option.cdva" class="text-xs text-zinc-400 mt-0.5">{{ option.cdva }}
                                        </div>
                                    </div>
                                </template>
                            </CascadeSelect>
                        </div>
                    </template>
                </Column>

                <!-- 예산: 금융정보단말기는 disabled — 클릭 편집 (REQ-5) -->
                <Column field="itMngcBg" header="예산" sortable style="min-width: 120px">
                    <template #body="{ data }">
                        <span v-if="isTerminal(data)" v-tooltip.top="TERMINAL_TOOLTIP"
                            class="inline-block w-full px-2 py-1 text-right text-zinc-400 cursor-not-allowed min-h-[2rem] leading-[2rem]">
                            {{ (data.itMngcBg ?? 0).toLocaleString() }} {{ data.cur || 'KRW' }}
                        </span>
                        <InlineEditCell v-else v-model="data.itMngcBg" type="number" :suffix="data.cur || 'KRW'"
                            :force-edit="isRowEditing(data)" class="text-right"
                            @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 통화: 금융정보단말기는 disabled — 클릭 편집 (REQ-5) -->
                <Column field="cur" header="통화" sortable style="width: 90px">
                    <template #body="{ data }">
                        <span v-if="isTerminal(data)" v-tooltip.top="TERMINAL_TOOLTIP"
                            class="inline-block w-full px-2 py-1 text-zinc-400 cursor-not-allowed min-h-[2rem] leading-[2rem]">
                            KRW
                        </span>
                        <InlineEditCell v-else v-model="data.cur" type="select" :options="curSelectOptions"
                            :force-edit="isRowEditing(data)" @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 지급주기 — 클릭 편집 (REQ-5) -->
                <Column field="dfrCle" header="지급주기" sortable style="width: 100px; min-width: 100px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.dfrCle" type="select" :options="dfrCleSelectOptions"
                            :invalid="isFieldInvalid(data, 'dfrCle')" :force-edit="isRowEditing(data)" placeholder="선택"
                            class="text-center"
                            @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 최초지급일 — 클릭 편집 (REQ-5) -->
                <Column field="fstDfrDt" header="최초지급일" sortable style="min-width: 80px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.fstDfrDt" type="date" view="month" date-format="yy-mm"
                            placeholder="최초지급일" :invalid="isFieldInvalid(data, 'fstDfrDt')"
                            :force-edit="isRowEditing(data)" @save="saveRow(data)" />
                    </template>
                </Column>

                <!-- 담당자 (AutoComplete + 직원조회 버튼) — 클릭 편집 (REQ-5) -->
                <Column field="cgprNm" header="담당자" sortable style="min-width: 80px; width: 140px">
                    <template #body="{ data }">
                        <InlineEditCell v-model="data.cgprNm" type="autocomplete" :suggestions="employeeSuggestions"
                            option-label="usrNm" :placeholder="data.cgprNm || '이름 검색'" :show-search="true"
                            :invalid="isFieldInvalid(data, 'cgpr')" :force-edit="isRowEditing(data)"
                            @complete="searchEmployee" @item-select="onEmployeeSelect(data, $event.value)"
                            @search-click="openEmployeeSearch(data)" @save="saveRow(data)">
                            <template #option="{ option }">
                                <div class="py-1.5 pl-2.5 border-l-[3px] border-blue-900">
                                    <div class="leading-tight">
                                        <div class="flex items-baseline gap-1.5">
                                            <span class="font-semibold text-sm">{{ option.usrNm }}</span>
                                            <span class="text-[11px] text-surface-400">{{ option.eno }}</span>
                                            <span v-if="option.ptCNm" class="text-xs text-primary/70">{{
                                                option.ptCNm }}</span>
                                        </div>
                                        <div class="flex items-center gap-1 text-xs text-surface-400 mt-0.5">
                                            <i class="pi pi-building text-[10px]" />
                                            <span>{{ option.bbrNm }}</span>
                                            <template v-if="option.temNm">
                                                <span class="text-surface-300">·</span>
                                                <span>{{ option.temNm }}</span>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </InlineEditCell>
                    </template>
                </Column>

                <!-- 결재현황 -->
                <Column field="apfSts" header="결재현황" sortable style="width: 100px; text-align: center">
                    <template #body="{ data }">
                        <Tag :value="data.apfSts || '예산 작성'" :class="getApprovalTagClass(data.apfSts || '예산 작성')"
                            rounded />
                    </template>
                </Column>

                <!-- 상세: 금융정보단말기만 상세 화면 이동 버튼 표시 -->
                <Column header="상세" style="width: 60px; text-align: center">
                    <template #body="{ data }">
                        <Button v-if="isTerminal(data)" v-tooltip.top="'단말기 상세 수정'" icon="pi pi-external-link" text
                            rounded size="small" @click="navigateTo(`/info/cost/terminal/form?id=${data.itMngcNo}`)" />

                    </template>
                </Column>

                <!-- 수정/삭제 액션 컬럼 -->
                <Column header="" style="width: 76px; text-align: center">
                    <template #body="{ data }">
                        <div class="flex justify-center gap-0.5">
                            <!-- 수정 모드 토글: 편집 중이면 저장(체크), 아니면 수정(연필) -->
                            <Button v-if="isRowEditing(data)" v-tooltip.top="'저장'" icon="pi pi-check" text rounded
                                size="small" severity="success" @click="finishRowEdit(data)" />
                            <Button v-else v-tooltip.top="'수정'" icon="pi pi-pencil" text rounded size="small"
                                severity="secondary" @click="startRowEdit(data)" />
                            <!-- 삭제 버튼 -->
                            <Button v-tooltip.top="'삭제'" icon="pi pi-trash" text rounded size="small" severity="danger"
                                @click="deleteRow(data)" />
                        </div>
                    </template>
                </Column>
            </StyledDataTable>
        </div>

        <!-- 계속 계약 전년도 데이터 불러오기 확인 다이얼로그 -->
        <Dialog v-model:visible="continuationDialogVisible" modal header="전년도 계약 불러오기" :style="{ width: '440px' }"
            :closable="false">
            <div class="space-y-4 py-2">
                <p class="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                    전년도 계약 데이터를 현재 행에 불러옵니다.<br>
                    최초지급일은 전년도 기준 <strong>+1년</strong>으로 자동 설정되며,
                    나머지 항목은 전년도와 동일하게 채워집니다.
                </p>
                <div v-if="continuationPending"
                    class="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2 text-sm">
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">계약명</span>
                        <span class="font-semibold text-right">{{ continuationPending.source.cttNm }}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">계약상대처</span>
                        <span class="text-right">{{ continuationPending.source.cttOpp }}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-zinc-500 shrink-0">전년도 예산연도</span>
                        <span>{{ continuationPending.source.bgYy }}년</span>
                    </div>
                    <div v-if="continuationPending.source.itMngcTp === 'IT_MNGC_TP_002'"
                        class="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400">
                        <i class="pi pi-info-circle text-sm" />
                        <span>단말기 상세목록도 함께 불러옵니다.</span>
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="취소" severity="secondary" outlined
                    @click="continuationDialogVisible = false; continuationPending = null" />
                <Button label="불러오기" icon="pi pi-download" @click="applyContinuation" />
            </template>
        </Dialog>

        <!-- 직원조회 다이얼로그 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" @select="onDialogEmployeeSelect" />
    </div>
</template>

<style scoped>
/* 테이블 헤더 텍스트 가운데 정렬 */
:deep(.p-datatable-header-cell) {
    text-align: center;
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

/* 담당자 셀: grid로 AutoComplete(1fr)와 버튼(auto) 분배 */
.cgpr-cell {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 4px;
    overflow: hidden;
}

.cgpr-cell :deep(.p-autocomplete) {
    width: 100% !important;
    min-width: 0 !important;
}

.cgpr-cell :deep(.p-autocomplete input) {
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
}

/* 단말기 비활성 필드 툴팁 한 줄 표시 (teleport 대상이라 :global 필수) */
:global(.p-tooltip) {
    max-width: 450px !important;
}

:global(.p-tooltip .p-tooltip-text) {
    max-width: 450px !important;
    white-space: nowrap;
}
</style>
