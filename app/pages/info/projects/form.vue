<!--
================================================================================
[pages/info/projects/form.vue] 정보화사업 등록/수정 폼 페이지
================================================================================
신규 정보화사업을 등록하거나 기존 사업을 수정하는 입력 폼입니다.
쿼리 파라미터 ?id가 있으면 수정 모드, 없으면 신규 등록 모드로 동작합니다.

[동작 모드]
  - 신규 등록: ?id 없음 → 빈 폼으로 시작
  - 수정 모드: ?id=prjMngNo → 해당 사업 정보 API 로드 후 폼에 바인딩

[폼 섹션 구성]
  1. 사업명: 유형(신규/계속) + 상태(수정 모드만 표시) + 사업명 텍스트
  2. 사업 개요: RichEditor 설명 + 현황/필요성/기대효과/미추진시문제점 Textarea (4개)
  3. 사업 범위: RichEditor (전산 요구사항)
  4. 진행 상황: 추진 경과 / 향후 계획 Textarea (2개)
  5. 사업 구분: 업무구분/사업유형/기술유형/주요사용자
  6. 편성 기준: 중복여부(Y/N) / 법규상 완료시기 DatePicker
  7. 담당부서: 주관부문 → 주관부서(팀장/담당자) → IT부서(팀장/담당자)
  8. 추진시기 및 소요예산: 예산/전결권/보고상태 + 시작일/종료일/추진가능성
  9. 소요자원 상세내용: DataTable 인라인 편집 (행 추가/삭제)

[소요자원 데이터 변환]
  - 로드 시: API 응답 items → UI resourceItems 변환
    (gclDtt → category, gclNm → item, gclQtt → quantity 등)
  - 저장 시: UI resourceItems → API items 역변환
    (category → gclDtt, item → gclNm 등)
  - fstDfrDt, sttDt, endDt, lblFsgTlm: Date 객체 → YYYY-MM-DD 문자열 변환

[단가 자동 계산]
  - watch(resourceItems): gclAmt(소계) ÷ quantity(수량)으로 unitPrice 자동 계산
  - gclAmt나 quantity가 0이면 unitPrice = 0

[라우팅]
  - 접근(신규): /info/projects/form
  - 접근(수정): /info/projects/form?id=:prjMngNo
  - 저장 완료 후: /info/projects
  - 취소 시: router.back()
================================================================================
-->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useProjects } from '~/composables/useProjects';
import type { Project } from '~/composables/useProjects';
import { PROJECT_STAGES, getApprovalAuthority } from '~/utils/common';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useDateRangeValidation } from '~/composables/useDateRangeValidation';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import type { OrgUser } from '~/composables/useOrganization';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchProject, fetchProjectsOnce, fetchProjectDetailOnce, createProject, updateProject } = useProjects();
// useCurrencyRates() 내부에서 useApiFetch가 자동으로 초기 fetch를 실행하므로
// fetchRates() (= refresh) 중복 호출 불필요 → 2회 호출 및 40X 오류 방지
const { exchangeRates, convertToKRW } = useCurrencyRates();

const title = '정보화사업 예산 작성';
definePageMeta({
    title
});

/** 수정 모드의 사업 관리번호 (신규 등록 시 null) */
const projectId = route.query.id ? (route.query.id as string) : null;
/** 수정 모드 여부 (projectId 존재 시 true) */
const isEditMode = computed(() => !!projectId);

/**
 * 소요자원 항목 인터페이스 (UI 모델)
 * API 응답의 item 필드를 UI에서 사용하기 위해 변환한 구조입니다.
 * 저장 시 executeSave()에서 API 스펙(gclDtt, gclNm 등)으로 역변환됩니다.
 *
 * [API 필드 매핑]
 *  category       ↔ gclDtt  (품목구분)
 *  item           ↔ gclNm   (품목명)
 *  quantity       ↔ gclQtt  (수량)
 *  currency       ↔ cur     (통화)
 *  basis          ↔ bgFdtn  (예산산출근거)
 *  introDate      ↔ itdDt   (도입시기)
 *  paymentCycle   ↔ dfrCle  (지급주기)
 *  infoProtection ↔ infPrtYn (정보보호여부)
 *  integratedInfra↔ itrInfrYn (통합인프라여부)
 *  gclAmt         ↔ gclAmt  (소계)
 */
interface ResourceItem {
    category: string;        // 품목구분 대분류 (API: gclDtt 앞부분)
    subCategory: string;     // 품목구분 소분류 (API: gclDtt 뒷부분, 해당 대분류만 존재)
    item: string;            // 품목명 (API: gclNm)
    quantity: number;        // 수량 (API: gclQtt)
    currency: string;        // 통화 (API: cur)
    basis: string;           // 예산산출근거 (API: bgFdtn)
    introDate: Date | null;  // 도입시기 (API: itdDt)
    paymentCycle: string;    // 지급주기 (API: dfrCle)
    infoProtection: string;  // 정보보호여부 (API: infPrtYn)
    integratedInfra: string; // 통합인프라여부 (API: itrInfrYn)
    gclAmt: number;          // 소계 (API: gclAmt)
    unitPrice?: number;      // 단가 (UI 계산 필드: gclAmt ÷ quantity)
    xcr?: number;            // 환율 (API: xcr, 수정 모드에서 복원)
    gclMngNo?: string | null; // 품목 관리번호 (API: gclMngNo, 수정 모드에서 복원)
}

/** 폼 데이터 상태 (신규/수정 공통) */
const form = ref({
    prjNm: '',
    prjDtt: '신규',
    prjTp: '',
    svnDpm: '',        // 주관부서코드
    svnDpmNm: '',      // 주관부서명 (직원 검색에서 자동 세팅)
    itDpm: '',         // IT부서코드
    itDpmNm: '',       // IT부서명 (직원 검색에서 자동 세팅)
    prjBg: 0,
    prjSts: '예산 작성',
    sttDt: null as Date | null,
    endDt: null as Date | null,
    prjDes: '',
    pulRsn: '', // 추진사유
    xptEff: '', // 기대효과
    svnHdq: '', // 주관부문

    // 추가 상세 필드
    bzDtt: '', // 업무구분
    dplYn: 'N', // 중복여부
    edrt: '', // 전결권
    hrfPln: '', // 향후계획
    itDpmCgpr: '',     // IT부서 담당자 사원번호
    itDpmCgprNm: '',   // IT부서 담당자명 (직원 검색에서 자동 세팅)
    itDpmTlr: '',      // IT부서 팀장 사원번호
    itDpmTlrNm: '',    // IT부서 팀장명 (직원 검색에서 자동 세팅)
    lblFsgTlm: null as Date | null, // 의무완료기한
    mnUsr: '', // 주요사용자
    ncs: '', // 필요성
    plm: '', // 미추진 시 문제점
    ornYn: 'N', // 경상여부 (신규 등록 기본값 'N')
    prjPulPtt: null as number | null, // 프로젝트추진가능성 (0~100 정수)
    prjRng: '', // 사업범위
    pulPsg: '', // 추진경과
    rprSts: '', // 보고상태
    saf: '', // 현황
    svnDpmCgpr: '',    // 주관부서 담당자 사원번호
    svnDpmCgprNm: '',  // 주관부서 담당자명 (직원 검색에서 자동 세팅)
    svnDpmTlr: '',     // 주관부서 팀장 사원번호
    svnDpmTlrNm: '',   // 주관부서 팀장명 (직원 검색에서 자동 세팅)
    tchnTp: '', // 기술유형
    prjYy: new Date().getMonth() + 1 >= 10 ? new Date().getFullYear() + 1 : new Date().getFullYear(), // 사업연도 (10월 이상이면 내년, 아니면 올해)
    resourceItems: [] as ResourceItem[] // UI용 소요자원 상세내용 (저장 시 items로 변환)
});

/**
 * 날짜 범위 유효성 검사 (시작일/종료일)
 * - 날짜 형식 오류 시 해당 input을 붉게 표시하고 에러 메시지 출력
 * - 종료일이 시작일보다 이전이면 종료일 input에 에러 표시
 */
const {
    startError: sttDtError,
    endError: endDtError,
    startInvalid: sttDtInvalid,
    endInvalid: endDtInvalid,
    onStartInput: onSttDtValidate,
    onEndInput: onEndDtValidate,
    onStartBlur: onSttDtBlur,
    onEndBlur: onEndDtBlur,
    validate: validateDates,
} = useDateRangeValidation(
    computed(() => form.value.sttDt),
    computed(() => form.value.endDt)
);

/**
 * 시작일 @input 핸들러: 자동 포맷 + 유효성 검사
 */
const handleSttDtInput = (event: Event) => {
    autoFormatDateInput(event);
    onSttDtValidate(event);
};

/**
 * 종료일 @input 핸들러: 자동 포맷 + 유효성 검사
 */
const handleEndDtInput = (event: Event) => {
    autoFormatDateInput(event);
    onEndDtValidate(event);
};

/**
 * 사업연도(prjYy) 선택지 옵션 생성 (현재 연도 기준: 올해, 내년)
 */
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear, currentYear + 1];

/* ── 구분 CascadeSelect 옵션 ── */

/** CascadeSelect 옵션 노드 타입 */
interface CategoryOption {
    label: string;
    category: string;
    subCategory: string;
    items?: CategoryOption[];
}

/**
 * 구분 CascadeSelect 트리 옵션
 * 소분류가 있는 대분류는 items 배열을 가지며, 없는 항목은 leaf 노드로 직접 선택됩니다.
 */
const resourceCategorySelectOptions: CategoryOption[] = [
    {
        label: '개발비', category: '개발비', subCategory: '',
        items: [
            { label: '일반', category: '개발비', subCategory: '일반' },
            { label: '감리/컨설팅', category: '개발비', subCategory: '감리/컨설팅' },
        ],
    },
    { label: '기계장치', category: '기계장치', subCategory: '' },
    {
        label: '기타무형자산', category: '기타무형자산', subCategory: '',
        items: [
            { label: '일반', category: '기타무형자산', subCategory: '일반' },
            { label: 'SW라이선스', category: '기타무형자산', subCategory: 'SW라이선스' },
        ],
    },
    {
        label: '전산용역비', category: '전산용역비', subCategory: '',
        items: [
            { label: '외주(운영,관제 등)', category: '전산용역비', subCategory: '외주(운영,관제 등)' },
            { label: '자문/심사', category: '전산용역비', subCategory: '자문/심사' },
        ],
    },
    { label: '전산임차료', category: '전산임차료', subCategory: '' },
    { label: '전산제비', category: '전산제비', subCategory: '' },
];

/**
 * category + subCategory 값으로 CascadeSelect 선택값 노드를 찾아 반환합니다.
 * 소분류 있는 대분류는 leaf 노드(소분류)에서, 없는 대분류는 루트 노드에서 탐색합니다.
 * 일치하는 노드가 없으면 null 반환 (CascadeSelect placeholder 표시).
 */
const findCategoryOption = (category: string, subCategory: string): CategoryOption | null => {
    for (const opt of resourceCategorySelectOptions) {
        if (opt.items) {
            if (subCategory) {
                const sub = opt.items.find(s => s.category === category && s.subCategory === subCategory);
                if (sub) return sub;
            }
        } else {
            if (opt.category === category) return opt;
        }
    }
    return null;
};

/**
 * CascadeSelect 변경 이벤트 처리
 * 선택된 노드의 category / subCategory를 행 데이터에 반영합니다.
 */
const onCategorySelect = (rowData: ResourceItem, value: CategoryOption) => {
    rowData.category = value.category;
    rowData.subCategory = value.subCategory;
};
const currencyOptions = computed(() => Object.keys(exchangeRates.value));
const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

const prjTypeOptions = ['신규', '계속'];
const statusOptions = PROJECT_STAGES;

/** 법규상 완료시기 해당사항 없음 체크 (true이면 DatePicker 비활성화 & 값 초기화) */
const lblFsgTlmNA = ref(false);

watch(lblFsgTlmNA, (checked) => {
    if (checked) form.value.lblFsgTlm = null;
});



/**
 * ── 직원 검색 다이얼로그 상태 관리 ──
 * 6개 필드(주관부서, 주관부서 팀장, 주관부서 담당자, IT부서, IT부서 팀장, IT부서 담당자)에
 * 각각 EmployeeSearchDialog를 연결합니다.
 * activeDialogField: 현재 열려있는 다이얼로그가 어떤 필드용인지 식별하는 키
 */
const showEmployeeDialog = ref(false);
/** 다이얼로그에서 직원 선택 후 어떤 폼 필드에 세팅할지 결정하는 키 */
const activeDialogField = ref<
    'svnDpm' | 'svnDpmTlr' | 'svnDpmCgpr' | 'itDpm' | 'itDpmTlr' | 'itDpmCgpr'
>('svnDpm');

/** 필드별 다이얼로그 헤더 — activeDialogField에서 파생되므로 별도 ref 불필요 */
const FIELD_HEADERS = {
    svnDpm: '주관부서 직원 검색',
    svnDpmTlr: '주관부서 담당팀장 검색',
    svnDpmCgpr: '주관부서 담당자 검색',
    itDpm: 'IT부서 직원 검색',
    itDpmTlr: 'IT부서 담당팀장 검색',
    itDpmCgpr: 'IT부서 담당자 검색',
} as const;
const employeeDialogHeader = computed(() => FIELD_HEADERS[activeDialogField.value]);

/**
 * 필드별 직원 데이터 매핑 설정
 * 부서필드(svnDpm, itDpm): orgCode(부서코드) + bbrNm(부서명)
 * 담당자필드(Tlr, Cgpr): eno(사원번호) + usrNm(이름)
 */
const FIELD_CONFIG = {
    svnDpm: { valueKey: 'orgCode', labelKey: 'bbrNm' },
    svnDpmTlr: { valueKey: 'eno', labelKey: 'usrNm' },
    svnDpmCgpr: { valueKey: 'eno', labelKey: 'usrNm' },
    itDpm: { valueKey: 'orgCode', labelKey: 'bbrNm' },
    itDpmTlr: { valueKey: 'eno', labelKey: 'usrNm' },
    itDpmCgpr: { valueKey: 'eno', labelKey: 'usrNm' },
} as const;

/**
 * 직원 검색 다이얼로그 열기
 * activeDialogField를 세팅하면 employeeDialogHeader가 자동으로 파생됩니다.
 *
 * @param field - 세팅할 폼 필드 키
 */
const openEmployeeDialog = (field: typeof activeDialogField.value) => {
    activeDialogField.value = field;
    showEmployeeDialog.value = true;
};

/**
 * EmployeeSearchDialog emit 데이터 타입
 * OrgUser(조직도 사용자)에 EmployeeSearchDialog에서 추가하는 부서코드(orgCode) 필드를 포함합니다.
 * EmployeeSearchDialog의 onUserSelect()에서 { ...OrgUser, orgCode } 형태로 emit됩니다.
 */
interface EmployeeSelectResult extends OrgUser {
    orgCode: string; // 부서코드 (선택된 Tree 노드의 key)
}

/**
 * 담당팀장 선택 시 해당 팀장의 부서 정보를 조회하여 폼에 자동 세팅
 * /api/users/{eno} API를 호출하여 응답의 부서코드(bbrC), 부서명(bbrNm),
 * 상위부서명(prlmHrkOgzCNm)을 관련 폼 필드에 반영합니다.
 *
 * [필드별 세팅 범위]
 *  - svn(주관부서 담당팀장): svnDpm(부서코드) + svnDpmNm(부서명) + svnHdq(주관부문)
 *  - it(IT부서 담당팀장):    itDpm(부서코드) + itDpmNm(부서명)
 *
 * @param eno - 사원번호
 * @param field - 'svn'(주관부서) 또는 'it'(IT부서)
 */
const fetchTlrDeptInfo = async (eno: string, field: 'svn' | 'it') => {
    if (!eno) return;
    try {
        const config = useRuntimeConfig();
        const { $apiFetch } = useNuxtApp();
        const userData = await $apiFetch<any>(`${config.public.apiBase}/api/users/${eno}`);
        if (!userData) return;

        if (field === 'svn') {
            // 주관부서 담당팀장 → 주관부서(코드/명) + 주관부문(상위부서명) 자동 세팅
            if (userData.bbrC) form.value.svnDpm = userData.bbrC;
            if (userData.bbrNm) form.value.svnDpmNm = userData.bbrNm;
            if (userData.prlmHrkOgzCNm) form.value.svnHdq = userData.prlmHrkOgzCNm;
        } else {
            // IT부서 담당팀장 → IT부서(코드/명) 자동 세팅
            if (userData.bbrC) form.value.itDpm = userData.bbrC;
            if (userData.bbrNm) form.value.itDpmNm = userData.bbrNm;
        }
    } catch (e) {
        console.error('담당팀장 부서정보 조회 실패', e);
    }
};

/**
 * 직원 선택 완료 핸들러
 * EmployeeSearchDialog의 @select 이벤트로 전달받은 직원 정보를
 * FIELD_CONFIG 매핑에 따라 해당 폼 필드에 세팅합니다.
 *
 * [타입 안전성]
 * (form.value as any) 타입 단언 대신, 필드별 명시적 setter 맵을 사용하여
 * TypeScript가 폼 필드 존재 여부를 검증할 수 있도록 합니다.
 *
 * [담당팀장 선택 시 부서 자동 세팅]
 * svnDpmTlr(주관부서 담당팀장) → fetchTlrDeptInfo('svn')으로 주관부서 + 주관부문 자동 세팅
 * itDpmTlr(IT부서 담당팀장)    → fetchTlrDeptInfo('it')으로 IT부서 자동 세팅
 *
 * @param user - EmployeeSearchDialog에서 emit된 직원 정보
 */
const onEmployeeSelected = (user: EmployeeSelectResult) => {
    const { valueKey, labelKey } = FIELD_CONFIG[activeDialogField.value];
    // FIELD_CONFIG의 valueKey/labelKey로 실제 값과 표시명을 추출
    const value = user[valueKey] || '';
    const label = user[labelKey] || '';

    // 필드별 타입 안전한 setter 맵 (TypeScript가 form.value 필드 존재를 검증)
    const setters: Record<typeof activeDialogField.value, () => void> = {
        svnDpm: () => { form.value.svnDpm = value; form.value.svnDpmNm = label; },
        svnDpmTlr: () => { form.value.svnDpmTlr = value; form.value.svnDpmTlrNm = label; fetchTlrDeptInfo(value, 'svn'); },
        svnDpmCgpr: () => { form.value.svnDpmCgpr = value; form.value.svnDpmCgprNm = label; },
        itDpm: () => { form.value.itDpm = value; form.value.itDpmNm = label; },
        itDpmTlr: () => { form.value.itDpmTlr = value; form.value.itDpmTlrNm = label; fetchTlrDeptInfo(value, 'it'); },
        itDpmCgpr: () => { form.value.itDpmCgpr = value; form.value.itDpmCgprNm = label; },
    };
    setters[activeDialogField.value]();
};

/**
 * 수정 모드 초기 데이터 로드
 * isEditMode가 true이면 fetchProject API를 호출하여 폼 데이터를 채웁니다.
 * API 응답의 items를 UI 모델인 resourceItems로 변환합니다.
 */
onMounted(async () => {
    if (isEditMode.value && projectId) {
        try {
            const { data, error } = await fetchProject(projectId);
            if (data.value) {
                const project = data.value;

                /* API 응답의 items를 UI resourceItems 모델로 변환 */
                const mappedItems = (project.items || []).map((item: any) => {
                    /* gclDtt가 "개발비 > 일반" 형식이면 대분류/소분류로 분리 */
                    const parts = (item.gclDtt || '').split(' > ');
                    const mainCat = parts[0] || '';
                    const subCat = parts[1] || '';
                    return {
                        category: mainCat, // 품목구분 대분류
                        subCategory: subCat, // 품목구분 소분류
                        item: item.gclNm, // 품목명
                        quantity: item.gclQtt, // 수량
                        currency: item.cur, // 통화
                        basis: item.bgFdtn, // 예산산출근거
                        introDate: item.itdDt ? new Date(item.itdDt) : null, // 도입시기 (Date 변환)
                        paymentCycle: item.dfrCle, // 지급주기
                        infoProtection: item.infPrtYn, // 정보보호여부
                        integratedInfra: item.itrInfrYn, // 통합인프라여부

                        /* UI 계산 필드 복원 */
                        gclAmt: item.gclAmt || 0, // 소계
                        xcr: item.xcr, // 저장된 환율 복원
                        gclMngNo: item.gclMngNo ?? null // 품목 관리번호 복원 (수정 시 식별용)
                    };
                });

                /* API 응답을 폼에 병합 (날짜 필드는 Date 객체로 변환) */
                form.value = {
                    ...form.value,
                    ...project,
                    sttDt: project.sttDt ? new Date(project.sttDt) : null,
                    endDt: project.endDt ? new Date(project.endDt) : null,
                    lblFsgTlm: project.lblFsgTlm ? new Date(project.lblFsgTlm) : null,
                    resourceItems: mappedItems
                };
            } else if (error.value) {
                console.error('Failed to load project', error.value);
                confirm.require({
                    message: '사업 정보를 불러오는데 실패했습니다.',
                    header: '오류',
                    icon: 'pi pi-exclamation-circle',
                    acceptLabel: '확인',
                    accept: () => { router.push('/info/projects'); }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
});

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 * 타임존 오프셋을 보정하여 로컬 날짜 기준으로 변환합니다.
 *
 * @param date - 변환할 Date 객체 (null이면 빈 문자열 반환)
 * @returns 'YYYY-MM-DD' 형식의 문자열
 */
const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0]!;
};

/**
 * 날짜 입력 필드용 자동 포맷터 (YYYY-MM-DD)
 * 사용자가 숫자를 입력할 때 자동으로 하이픈을 추가합니다.
 */
const autoFormatDateInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    // 이전 커서 위치 저장
    const cursorPosition = input.selectionStart || 0;
    const oldLength = input.value.length;

    const rawVal = input.value.replace(/\D/g, ''); // 숫자만 추출
    let val = rawVal;

    if (val.length > 8) val = val.substring(0, 8); // 8자리 제한

    let formatted = val;
    if (val.length >= 7) {
        formatted = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
    } else if (val.length >= 5) {
        formatted = `${val.substring(0, 4)}-${val.substring(4, 6)}`;
    }

    // 값이 변경된 경우에만 업데이트
    if (input.value !== formatted) {
        input.value = formatted;

        // 추가된 하이픈만큼 커서 위치 보정
        const newLength = formatted.length;
        let newCursorPos = cursorPosition + (newLength - oldLength);

        // 강제로 커서 위치 이동
        input.setSelectionRange(newCursorPos, newCursorPos);

        // PrimeVue 내부 상태 동기화용 이벤트 트리거
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
};

/**
 * 실제 저장 로직 (신규/수정 공통)
 *
 * [처리 순서]
 * 1. UI resourceItems → API 스펙 items 변환 (필드명 역매핑)
 * 2. 날짜 필드를 문자열로 변환하여 payload 구성
 * 3. isEditMode에 따라 updateProject 또는 createProject 호출
 * 4. 성공/실패 시 confirm 다이얼로그 표시
 */
const executeSave = async () => {
    /* 1. UI의 resourceItems를 API 스펙인 items로 역변환 */
    const items = form.value.resourceItems.map(item => ({
        /* 소분류가 있으면 "대분류 > 소분류" 형식으로 결합 */
        gclDtt: item.subCategory ? `${item.category} > ${item.subCategory}` : item.category, // 품목구분
        gclNm: item.item, // 품목명
        gclQtt: item.quantity, // 수량
        cur: item.currency, // 통화
        bgFdtn: item.basis, // 예산산출근거
        itdDt: formatDate(item.introDate), // 도입시기 (날짜 문자열 변환)
        dfrCle: item.paymentCycle, // 지급주기
        infPrtYn: item.infoProtection, // 정보보호여부 (Y/N)
        itrInfrYn: item.integratedInfra, // 통합인프라여부 (Y/N)

        /* UI 계산 필드 */
        upr: item.quantity > 0 && item.gclAmt > 0 ? Math.round(item.gclAmt / item.quantity) : 0, // 단가 (자동 계산 전송)
        gclAmt: item.gclAmt, // 소계

        /* 기존 품목이면 gclMngNo 유지, 신규 추가 품목은 null */
        gclMngNo: item.gclMngNo ?? null,
        gclSno: 0,
        xcr: exchangeRates.value[item.currency] || 1, // 적용된 환율 전송
        xcrBseDt: formatDate(new Date()), // 현재 날짜 기준
        lstYn: 'Y' // 최종여부 기본값
    }));

    /* 2. 전체 Payload 구성 */
    const payload = {
        ...form.value,
        prjMngNo: projectId,
        sttDt: formatDate(form.value.sttDt),
        endDt: formatDate(form.value.endDt),
        lblFsgTlm: formatDate(form.value.lblFsgTlm),
        items: items // 역변환된 소요자원 목록
    };

    /* 불필요한 UI용 resourceItems 필드는 백엔드에서 무시됨 */

    try {
        let response;
        if (isEditMode.value && projectId) {
            response = await updateProject(projectId, payload);
        } else {
            response = await createProject(payload);
        }

        /* 저장 완료 확인 다이얼로그 */
        confirm.require({
            message: isEditMode.value ? '수정되었습니다.' : '등록되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/projects');
            }
        });
    } catch (error: any) {
        console.error('Save failed', error);
        /* API 응답에서 오류 메시지 추출 (data.message → message → 기본 메시지 순으로 폴백) */
        const apiMessage = error?.data?.message || error?.message || '저장 중 오류가 발생했습니다.';
        confirm.require({
            message: apiMessage,
            header: '오류',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
    }
};


/**
 * 저장 진입점: 필수 유효성 검사 후 executeSave 호출
 * 미입력 항목이 있으면 경고 다이얼로그를 표시하고 각 입력폼을 invalid 처리합니다.
 */

/**
 * 필수 입력 항목별 invalid 상태
 * validate 호출 시 세팅되고, 각 필드 값 변경 시 자동 해소됩니다.
 */
const formErrors = reactive({
    prjNm: false,
    svnDpmTlr: false,
    svnDpmCgpr: false,
    itDpmTlr: false,
    itDpmCgpr: false,
    sttDt: false,
    endDt: false,
    prjDes: false,
    prjRng: false,       // 사업범위
    bzDtt: false,        // 업무구분
    tchnTp: false,       // 기술유형
    mnUsr: false,        // 주요사용자
    resourceItems: false, // 소요자원 (최소 1개)
});

/** 필수 항목 레이블 (팝업 메시지용) */
const REQUIRED_LABELS: Record<keyof typeof formErrors, string> = {
    prjNm: '사업명',
    svnDpmTlr: '주관부서 담당팀장',
    svnDpmCgpr: '주관부서 담당자',
    itDpmTlr: 'IT부서 담당팀장',
    itDpmCgpr: 'IT부서 담당자',
    prjDes: '사업상세내용',
    sttDt: '시작일',
    endDt: '종료일',
    prjRng: '사업범위',
    bzDtt: '업무구분',
    tchnTp: '기술유형',
    mnUsr: '주요사용자',
    resourceItems: '소요자원 (최소 1개)',
};

/**
 * 필수 항목 전체 유효성 검사
 * @returns 모든 필수 항목이 채워진 경우 true
 */
const validateRequiredFields = (): boolean => {
    formErrors.prjNm = !form.value.prjNm;
    formErrors.svnDpmTlr = !form.value.svnDpmTlr;
    formErrors.svnDpmCgpr = !form.value.svnDpmCgpr;
    // isItSameAsSvn 체크 시 주관부서 값을 그대로 복사하므로 무조건 검사
    formErrors.itDpmTlr = !form.value.itDpmTlr;
    formErrors.itDpmCgpr = !form.value.itDpmCgpr;
    formErrors.prjDes = !form.value.prjDes;
    formErrors.sttDt = !form.value.sttDt;
    formErrors.endDt = !form.value.endDt;
    formErrors.prjRng = !form.value.prjRng;
    formErrors.bzDtt = !form.value.bzDtt;
    formErrors.tchnTp = !form.value.tchnTp;
    formErrors.mnUsr = !form.value.mnUsr;
    formErrors.resourceItems = form.value.resourceItems.length === 0;
    return !Object.values(formErrors).some(Boolean);
};

/* 각 필드 값이 채워지면 해당 에러 자동 해소 */
watch(() => form.value.prjNm, (v) => { if (v) formErrors.prjNm = false; });
watch(() => form.value.svnDpmTlr, (v) => { if (v) formErrors.svnDpmTlr = false; });
watch(() => form.value.svnDpmCgpr, (v) => { if (v) formErrors.svnDpmCgpr = false; });
watch(() => form.value.itDpmTlr, (v) => { if (v) formErrors.itDpmTlr = false; });
watch(() => form.value.itDpmCgpr, (v) => { if (v) formErrors.itDpmCgpr = false; });
watch(() => form.value.sttDt, (v) => { if (v) formErrors.sttDt = false; });
watch(() => form.value.endDt, (v) => { if (v) formErrors.endDt = false; });
watch(() => form.value.prjDes, (v) => { if (v) formErrors.prjDes = false; });
watch(() => form.value.prjRng, (v) => { if (v) formErrors.prjRng = false; });
watch(() => form.value.bzDtt, (v) => { if (v) formErrors.bzDtt = false; });
watch(() => form.value.tchnTp, (v) => { if (v) formErrors.tchnTp = false; });
watch(() => form.value.mnUsr, (v) => { if (v) formErrors.mnUsr = false; });
watch(() => form.value.resourceItems, (v) => { if (v.length > 0) formErrors.resourceItems = false; });

const saveProject = () => {
    const requiredOk = validateRequiredFields();

    // 날짜 형식/범위 유효성 검사 (인라인 에러 메시지로 표시됨)
    const datesOk = validateDates();

    if (!requiredOk) {
        const missing = (Object.keys(formErrors) as (keyof typeof formErrors)[])
            .filter(k => formErrors[k])
            .map(k => REQUIRED_LABELS[k])
            .join(', ');
        confirm.require({
            message: `다음 필수 항목을 입력해주세요:\n${missing}`,
            header: '입력 확인',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
        return;
    }

    if (!datesOk) return;

    executeSave();
};

// ─────────────────────────────────────────────────────────────────────────────
// 계속 사업 AutoComplete
// ─────────────────────────────────────────────────────────────────────────────

/** AutoComplete v-model: 타이핑 중엔 string, 선택 후엔 Project 객체 */
const continueProjectAC = ref<string | Project>('');

/** AutoComplete 제안 목록 */
const continueSuggestions = ref<Project[]>([]);

/**
 * 계속 사업 AutoComplete 검색
 * 전년도(prjYy - 1) 사업 목록을 조회 후 사업명으로 클라이언트 필터링합니다.
 */
const searchContinueProjects = async (event: { query: string }) => {
    try {
        const prevYear = form.value.prjYy - 1;
        const all = await fetchProjectsOnce({ prjYy: String(prevYear), ornYn: 'N' });
        const q = event.query.trim().toLowerCase();
        continueSuggestions.value = q
            ? all.filter(p => p.prjNm.toLowerCase().includes(q))
            : all;
    } catch {
        continueSuggestions.value = [];
    }
};

/**
 * 전년도 사업 선택 시 폼 자동 채우기
 * prjYy(사업연도), prjDtt(신규/계속)을 제외한 모든 필드와 소요자원을 복사합니다.
 * gclMngNo(품목관리번호)는 신규 등록이므로 null로 초기화합니다.
 */
const onContinueProjectSelect = async (event: { value: Project }) => {
    try {
        const detail = await fetchProjectDetailOnce(event.value.prjMngNo);

        /* items → resourceItems 변환 */
        const mappedItems = (detail.items || []).map((item: any) => {
            const parts = (item.gclDtt || '').split(' > ');
            return {
                category: parts[0] || '',
                subCategory: parts[1] || '',
                item: item.gclNm,
                quantity: item.gclQtt,
                currency: item.cur,
                basis: item.bgFdtn,
                introDate: item.itdDt ? new Date(item.itdDt) : null,
                paymentCycle: item.dfrCle,
                infoProtection: item.infPrtYn,
                integratedInfra: item.itrInfrYn,
                gclAmt: item.gclAmt || 0,
                xcr: item.xcr,
                gclMngNo: null, // 신규 등록 — 전년도 품목번호 미사용
            };
        });

        /* prjYy·prjDtt 유지, 나머지 복사 */
        const { prjYy, prjDtt } = form.value;
        form.value = {
            ...form.value,
            ...detail,
            prjYy,
            prjDtt,
            prjSts: '예산 작성',
            sttDt: detail.sttDt ? new Date(detail.sttDt) : null,
            endDt: detail.endDt ? new Date(detail.endDt) : null,
            lblFsgTlm: detail.lblFsgTlm ? new Date(detail.lblFsgTlm) : null,
            resourceItems: mappedItems,
        };

        /* AutoComplete 표시값을 선택된 사업명으로 확정 */
        continueProjectAC.value = detail.prjNm;
    } catch (e) {
        console.error('전년도 사업 로드 실패', e);
    }
};

/** AutoComplete 텍스트 직접 입력 시 form.prjNm 동기화 */
watch(continueProjectAC, (val) => {
    if (typeof val === 'string') form.value.prjNm = val;
});

/** 사업구분이 '계속'으로 변경될 때 현재 사업명으로 AutoComplete 초기화 */
watch(() => form.value.prjDtt, (val) => {
    if (val === '계속') continueProjectAC.value = form.value.prjNm;
});

/**
 * 소요자원 행 추가
 * 기본값으로 초기화된 빈 소요자원 항목을 resourceItems에 추가합니다.
 */
const addResourceRow = () => {
    form.value.resourceItems.push({
        category: '개발비',
        subCategory: '', // 소분류 초기값 (2단계 선택 시 설정)
        item: '',
        quantity: 0,
        currency: 'KRW',
        gclAmt: 0,
        basis: '',
        introDate: null,
        paymentCycle: '',
        infoProtection: 'N',
        integratedInfra: 'N'
    });
};

/**
 * 소요자원 행 삭제
 * 지정된 인덱스의 항목을 resourceItems에서 제거합니다.
 *
 * @param index - 삭제할 행의 인덱스
 */
const removeResourceRow = (index: number) => {
    form.value.resourceItems.splice(index, 1);
};

/** 소요자원 테이블 넓게 보기 토글 상태 */
const isResourceTableExpanded = ref(false);
const toggleResourceTableSize = () => {
    isResourceTableExpanded.value = !isResourceTableExpanded.value;
};

/** 주관/IT 부서 동일 여부 제어 */
const isItSameAsSvn = ref(false);
watch([isItSameAsSvn, () => form.value.svnDpm, () => form.value.svnDpmTlr, () => form.value.svnDpmCgpr], ([checked]) => {
    if (checked) {
        form.value.itDpm = form.value.svnDpm;
        form.value.itDpmNm = form.value.svnDpmNm;
        form.value.itDpmTlr = form.value.svnDpmTlr;
        form.value.itDpmTlrNm = form.value.svnDpmTlrNm;
        form.value.itDpmCgpr = form.value.svnDpmCgpr;
        form.value.itDpmCgprNm = form.value.svnDpmCgprNm;
    }
});

/**
 * 소요자원 단가 및 총 예산, 전결권 자동 계산 감시자
 * gclAmt(소계) 또는 quantity(수량)가 변경되면 unitPrice(단가) = gclAmt ÷ quantity를 자동 계산합니다.
 * 동시에 모든 항목의 gclAmt(소계) 합계를 form.prjBg(총 예산)에 반영하고 전결권을 자동 판정합니다.
 * deep 감시로 중첩 필드 변경도 감지합니다.
 */
watch(() => form.value.resourceItems, (items) => {
    if (!items) return;
    let totalAmt = 0;
    let capitalBudget = 0;
    let operatingExpense = 0;

    items.forEach(item => {
        // 소계 합산 (원화 환산)
        const krwAmt = convertToKRW(item.gclAmt || 0, item.currency || 'KRW');
        totalAmt += krwAmt;

        // 예산 성격에 따라 분리 (자본예산: 개발비/기계장치/기타무형자산, 일반관리비: 전산임차료/전산제비)
        if (['개발비', '기계장치', '기타무형자산'].includes(item.category)) {
            capitalBudget += krwAmt;
        } else if (['전산임차료', '전산제비'].includes(item.category)) {
            operatingExpense += krwAmt;
        }
    });

    // 총 예산에 반영 (자동 동기화)
    form.value.prjBg = totalAmt;

    // 전결권 자동 계산 및 반영
    form.value.edrt = getApprovalAuthority(capitalBudget, operatingExpense);
}, { deep: true });

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
        <!-- 상단 고정(Sticky) 헤더 영역 -->
        <div
            class="sticky -top-6 z-20 -mt-6 -mx-6 px-6 py-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {{ isEditMode ? '정보화사업 예산 수정' : '정보화사업 예산 작성' }}
                <!-- 수정 모드에서만 상태 변경 드롭다운을 헤더 영역에 노출 -->
                <div v-if="isEditMode" class="flex items-center gap-2 text-base font-normal">
                    <span class="text-zinc-500 text-sm">| 진행 상태 :</span>
                    <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 변경" class="w-48 !text-sm"
                        size="small" />
                </div>
            </h1>

            <!-- 우측 상단 액션 버튼 그룹 -->
            <div class="flex items-center gap-2">
                <Button label="취소" severity="secondary" @click="cancel" class="!px-5 !rounded-lg" />
                <Button label="저장" severity="primary" @click="saveProject"
                    class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 max-w-[1440px] mx-auto w-full"
            id="main-content">

            <!-- 사업 개요 섹션 -->
            <div class="space-y-3">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    사업 개요<span class="text-red-500">*</span></h3>
                <!-- 사업명 섹션: 연도 + 유형 + 사업명 -->
                <div class="flex gap-3">
                    <!-- 사업 연도 선택 (자동 연산된 YYYY, YYYY+1) -->
                    <div class="flex flex-col gap-2">
                        <Select v-model="form.prjYy" :options="yearOptions" placeholder="연도 선택" class="w-32"
                            :disabled="isEditMode" />
                    </div>
                    <!-- 사업 구분 선택 (신규/계속) -->
                    <div class="flex flex-col gap-2">
                        <Select v-model="form.prjDtt" :options="prjTypeOptions" placeholder="구분 선택" class="w-32" />
                    </div>
                    <!-- 사업명: 계속이면 전년도 사업 AutoComplete, 신규이면 일반 입력 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <AutoComplete v-if="form.prjDtt === '계속'" v-model="continueProjectAC" dropdown
                            :suggestions="continueSuggestions" optionLabel="prjNm" placeholder="전년도 사업명으로 검색 후 선택..."
                            fluid :delay="300" :invalid="formErrors.prjNm" @complete="searchContinueProjects"
                            @item-select="onContinueProjectSelect" />
                        <InputText v-else v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid
                            :invalid="formErrors.prjNm" />
                    </div>
                </div>
                <!-- Rich Text 사업 상세 설명 -->
                <div class="flex flex-col gap-2"
                    :class="formErrors.prjDes ? 'ring-1 ring-red-500 rounded-lg overflow-hidden' : ''">
                    <RichEditor v-model="form.prjDes" editorStyle="height: 150px" placeholder="사업 상세 내용을 입력하세요." />
                </div>
                <!-- 현황 / 필요성 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">현황</label>
                        <Textarea v-model="form.saf" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">필요성</label>
                        <Textarea v-model="form.ncs" style="height: 150px;" />
                    </div>
                </div>
                <!-- 기대효과 / 미추진 시 문제점 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">기대효과</label>
                        <Textarea v-model="form.xptEff" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">미추진 시 문제점</label>
                        <Textarea v-model="form.plm" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 범위 섹션 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">사업범위<span
                            class="text-red-500">*</span></span>
                    <span class="text-sm text-zinc-500">전산 요구사항</span>
                </div>
                <div class="flex flex-col gap-2"
                    :class="formErrors.prjRng ? 'ring-1 ring-red-500 rounded-lg overflow-hidden' : ''">
                    <RichEditor v-model="form.prjRng" editorStyle="height: 150px" />
                </div>
            </div>

            <Divider />

            <!-- 진행 상황 섹션: 추진 경과 / 향후 계획 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">진행상황</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">추진 경과</label>
                        <Textarea v-model="form.pulPsg" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">향후 계획</label>
                        <Textarea v-model="form.hrfPln" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 구분 섹션: 업무구분/사업유형/기술유형/주요사용자 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">사업구분</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">업무 구분<span
                                class="text-red-500">*</span></label>
                        <InputText v-model="form.bzDtt" fluid :invalid="formErrors.bzDtt" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업 유형<span
                                class="text-red-500">*</span></label>
                        <InputText v-model="form.prjTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">기술 유형<span
                                class="text-red-500">*</span></label>
                        <InputText v-model="form.tchnTp" fluid :invalid="formErrors.tchnTp" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">주요 사용자<span
                                class="text-red-500">*</span></label>
                        <InputText v-model="form.mnUsr" fluid :invalid="formErrors.mnUsr" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 편성 기준 섹션: 중복여부/법규상완료시기 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">편성기준</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">중복 여부 (Y/N)<span
                                class="text-red-500">*</span></label>
                        <Select v-model="form.dplYn" :options="['Y', 'N']" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-3">
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">법규상 완료시기</label>
                            <div class="flex items-center gap-1.5">
                                <Checkbox v-model="lblFsgTlmNA" :binary="true" inputId="lblFsgTlmNA" />
                                <label for="lblFsgTlmNA"
                                    class="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">해당사항
                                    없음</label>
                            </div>
                        </div>
                        <DatePicker v-model="form.lblFsgTlm" showIcon fluid dateFormat="yy-mm-dd"
                            :disabled="lblFsgTlmNA" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 담당부서 섹션: 주관부문 → 주관부서(팀장/담당자) → IT부서(팀장/담당자) -->
            <!-- 각 필드는 직원검색 버튼을 클릭하여 EmployeeSearchDialog에서 선택합니다. -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">담당부서<span
                            class="text-red-500">*</span></span>
                </div>

                <!-- 주관부문 (담당팀장 선택 시 API 응답의 상위부서명 자동 세팅, 수동 편집 불가) -->
                <div class="flex gap-6 items-end">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">주관부문</label>
                        <InputText v-model="form.svnHdq" placeholder="주관부서 담당팀장 선택 시 자동 입력" fluid readonly
                            class="w-80 bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex items-center gap-2 pb-2">
                        <Checkbox v-model="isItSameAsSvn" inputId="isItSameAsSvn" :binary="true" />
                        <label for="isItSameAsSvn"
                            class="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">주관·IT
                            부서 동일</label>
                    </div>
                </div>

                <!-- 주관부서 + 팀장/담당자 (직원 검색 다이얼로그 연동) -->
                <div class="flex gap-6">
                    <!-- 주관부서: 담당팀장 선택 시 자동 세팅 (readonly) -->
                    <div class="flex flex-col gap-2 w-80">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">주관부서</label>
                        <InputText :modelValue="form.svnDpmNm || form.svnDpm" placeholder="담당팀장 선택 시 자동 입력" fluid
                            readonly class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <!-- 주관부서 담당팀장 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당팀장</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.svnDpmTlrNm ? `${form.svnDpmTlrNm} (${form.svnDpmTlr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                :invalid="formErrors.svnDpmTlr" @click="openEmployeeDialog('svnDpmTlr')" />
                            <Button icon="pi pi-search" severity="secondary" @click="openEmployeeDialog('svnDpmTlr')" />
                        </div>
                    </div>
                    <!-- 주관부서 담당자 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당자</label>
                        <div class="flex gap-1">
                            <InputText
                                :modelValue="form.svnDpmCgprNm ? `${form.svnDpmCgprNm} (${form.svnDpmCgpr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                :invalid="formErrors.svnDpmCgpr" @click="openEmployeeDialog('svnDpmCgpr')" />
                            <Button icon="pi pi-search" severity="secondary"
                                @click="openEmployeeDialog('svnDpmCgpr')" />
                        </div>
                    </div>
                </div>

                <!-- IT부서 + 팀장/담당자 (직원 검색 다이얼로그 연동) -->
                <div class="flex gap-6">
                    <!-- IT부서: 담당팀장 선택 시 자동 세팅 (readonly) -->
                    <div class="flex flex-col gap-2 w-80">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">IT부서</label>
                        <InputText :modelValue="form.itDpmNm || form.itDpm" placeholder="담당팀장 선택 시 자동 입력" fluid readonly
                            class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <!-- IT부서 담당팀장 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당팀장</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.itDpmTlrNm ? `${form.itDpmTlrNm} (${form.itDpmTlr})` : ''"
                                placeholder="직원 검색" fluid readonly
                                :class="[isItSameAsSvn ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'cursor-pointer']"
                                :invalid="formErrors.itDpmTlr && !isItSameAsSvn"
                                @click="!isItSameAsSvn && openEmployeeDialog('itDpmTlr')" />
                            <Button icon="pi pi-search" severity="secondary" :disabled="isItSameAsSvn"
                                @click="openEmployeeDialog('itDpmTlr')" />
                        </div>
                    </div>
                    <!-- IT부서 담당자 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당자</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.itDpmCgprNm ? `${form.itDpmCgprNm} (${form.itDpmCgpr})` : ''"
                                placeholder="직원 검색" fluid readonly
                                :class="[isItSameAsSvn ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'cursor-pointer']"
                                :invalid="formErrors.itDpmCgpr && !isItSameAsSvn"
                                @click="!isItSameAsSvn && openEmployeeDialog('itDpmCgpr')" />
                            <Button icon="pi pi-search" severity="secondary" :disabled="isItSameAsSvn"
                                @click="openEmployeeDialog('itDpmCgpr')" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 직원 검색 다이얼로그 (6개 필드에서 공유, activeDialogField로 구분) -->
            <EmployeeSearchDialog v-model:visible="showEmployeeDialog" :header="employeeDialogHeader"
                @select="onEmployeeSelected" />

            <Divider />

            <!-- 추진시기 및 소요예산 섹션 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">추진시기 및 소요예산<span
                            class="text-red-500">*</span></span>
                </div>

                <!-- 예산/전결권/보고상태 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">예산 (원)</label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            placeholder="자동 계산됨" fluid readonly inputClass="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">전결권</label>
                        <InputText v-model="form.edrt" readonly placeholder="자동 지정됨" fluid
                            class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">보고상태</label>
                        <InputText v-model="form.rprSts" fluid />
                    </div>
                </div>

                <!-- 시작일/종료일/추진가능성 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">시작일</label>
                        <div class="relative">
                            <DatePicker v-model="form.sttDt" showIcon fluid dateFormat="yy-mm-dd"
                                :invalid="sttDtInvalid || formErrors.sttDt"
                                :pt="(sttDtInvalid || formErrors.sttDt) ? { pcInputText: { root: { class: 'text-transparent caret-red-500' } } } : undefined"
                                @input="handleSttDtInput" @blur="onSttDtBlur" />
                            <span v-if="sttDtError || formErrors.sttDt"
                                class="absolute inset-y-0 left-3 right-10 flex items-center text-red-500 text-xs pointer-events-none truncate">
                                {{ sttDtError || '시작일을 입력해주세요.' }}
                            </span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">종료일</label>
                        <div class="relative">
                            <DatePicker v-model="form.endDt" :minDate="form.sttDt || undefined" showIcon fluid
                                dateFormat="yy-mm-dd" :invalid="endDtInvalid || formErrors.endDt"
                                :pt="(endDtInvalid || formErrors.endDt) ? { pcInputText: { root: { class: 'text-transparent caret-red-500' } } } : undefined"
                                @input="handleEndDtInput" @blur="onEndDtBlur" />
                            <span v-if="endDtError || formErrors.endDt"
                                class="absolute inset-y-0 left-3 right-10 flex items-center text-red-500 text-xs pointer-events-none truncate">
                                {{ endDtError || '종료일을 입력해주세요.' }}
                            </span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업추진 가능성 (%, 0~100)</label>
                        <InputNumber v-model="form.prjPulPtt" :min="0" :max="100" :useGrouping="false" fluid />
                    </div>
                </div>
            </div>
        </div>

        <!-- 소요자원 상세내용 카드 (토글 폭 사용) -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 transition-all duration-300"
            :class="isResourceTableExpanded ? 'w-full' : 'max-w-[1440px] mx-auto w-full'">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">소요자원 상세내용<span
                            class="text-red-500">*</span></h3>
                    <Button :icon="isResourceTableExpanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
                        variant="text" severity="secondary" rounded @click="toggleResourceTableSize"
                        v-tooltip.top="isResourceTableExpanded ? '기본 폭으로' : '넓게 보기'" />
                </div>
                <Button label="품목 추가" icon="pi pi-plus" size="small" @click="addResourceRow" />
            </div>
            <p v-if="formErrors.resourceItems" class="text-red-500 text-xs">소요자원을 1개 이상 등록해주세요.</p>

            <div class="overflow-x-auto">
                <DataTable :value="form.resourceItems" resizableColumns columnResizeMode="fit" showGridlines
                    size="small" class="resource-table">
                    <template #empty>
                        <div class="flex flex-col items-center justify-center text-zinc-500" style="min-height: 350px;">
                            등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                        </div>
                    </template>

                    <!-- 구분: CascadeSelect (대분류 → 소분류 2단계) -->
                    <Column header="구분" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 160px;">
                        <template #body="{ data }">
                            <CascadeSelect :model-value="findCategoryOption(data.category, data.subCategory)"
                                :options="resourceCategorySelectOptions" optionLabel="label" optionGroupLabel="label"
                                optionGroupChildren="items" placeholder="선택" fluid
                                @change="onCategorySelect(data, $event.value)">
                                <!-- 선택된 값: 대분류 > 소분류 형식으로 표시 -->
                                <template #value="{ value }">
                                    <template v-if="value">
                                        {{ value.category }}
                                        <template v-if="value.subCategory">
                                            <span class="opacity-40 mx-0.5">›</span>{{ value.subCategory }}
                                        </template>
                                    </template>
                                    <span v-else style="color: var(--p-cascadeselect-placeholder-color)">선택</span>
                                </template>
                            </CascadeSelect>
                        </template>
                    </Column>

                    <!-- 항목: 자동 줄바꿈 Textarea -->
                    <Column header="항목" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 200px">
                        <template #body="{ data }">
                            <Textarea v-model="data.item" rows="1" autoResize class="w-full" />
                        </template>
                    </Column>

                    <!-- 수량 -->
                    <Column header="수량" headerClass="text-center justify-center [&>div]:justify-center"
                        bodyClass="col-quantity" style="min-width: 120px">
                        <template #body="{ data }">
                            <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                        </template>
                    </Column>

                    <!-- 통화: KRW/USD/EUR 등 -->
                    <Column header="통화" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 80px">
                        <template #body="{ data }">
                            <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                        </template>
                    </Column>

                    <!-- 소계: 직접 입력 → 단가 자동 역산 -->
                    <Column header="소계" headerClass="text-center justify-center [&>div]:justify-center"
                        bodyClass="col-subtotal" style="min-width: 120px">
                        <template #body="{ data }">
                            <InputNumber v-model="data.gclAmt" mode="currency" :currency="data.currency || 'KRW'"
                                locale="ko-KR" class="w-full" />
                        </template>
                    </Column>

                    <!-- 산정근거 -->
                    <Column header="산정근거" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 150px">
                        <template #body="{ data }">
                            <Textarea v-model="data.basis" rows="1" autoResize class="w-full" />
                        </template>
                    </Column>

                    <!-- 도입시기/지급주기: 구분에 따라 다른 입력 컴포넌트 표시 -->
                    <Column header="도입시기/지급주기" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 200px">
                        <template #body="{ data }">
                            <!-- 자본예산: 도입시기 DatePicker (월 단위) -->
                            <div v-if="['개발비', '기계장치', '기타무형자산'].includes(data.category)">
                                <DatePicker v-model="data.introDate" view="month" dateFormat="yy-mm" showIcon fluid
                                    placeholder="도입시기" class="w-full" />
                            </div>
                            <!-- 임차료/제비: 지급주기 드롭다운 -->
                            <div v-else-if="['전산임차료', '전산제비'].includes(data.category)">
                                <Select v-model="data.paymentCycle" :options="paymentCycleOptions" placeholder="지급주기"
                                    class="w-full" />
                            </div>
                        </template>
                    </Column>

                    <!-- 정보보호 여부 (Y/N) -->
                    <Column header="정보보호" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 80px">
                        <template #body="{ data }">
                            <Select v-model="data.infoProtection" :options="ynOptions" class="w-full" />
                        </template>
                    </Column>

                    <!-- 통합인프라 여부 (Y/N) -->
                    <Column header="통합인프라" headerClass="text-center justify-center [&>div]:justify-center"
                        style="min-width: 80px">
                        <template #body="{ data }">
                            <Select v-model="data.integratedInfra" :options="ynOptions" class="w-full" />
                        </template>
                    </Column>

                    <!-- 행 삭제 버튼 -->
                    <Column header="" headerClass="text-center justify-center [&>div]:justify-center"
                        style="width: 50px">
                        <template #body="{ index }">
                            <Button icon="pi pi-trash" text severity="danger" @click="removeResourceRow(index)" />
                        </template>
                    </Column>
                </DataTable>
            </div>

            <!-- 최종 액션 버튼 (플로팅 그룹) -->
        </div>
    </div>
</template>

<style scoped>
/** 소요자원 테이블 헤더 배경색 및 텍스트 색상 (라이트/다크 모드) */
.resource-table :deep(.p-datatable-thead > tr > th) {
    background-color: #f4f4f5 !important;
    /* zinc-100 */
    color: #27272a !important;
    /* zinc-800 */
}

/** 소요자원 테이블 헤더 콘텐츠 중앙 정렬 */
:deep(.resource-table .p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}

/** 소요자원 테이블 최소 높이 (tbody는 table-row-group이라 min-height 미적용 → table-container에 적용) */
:deep(.resource-table .p-datatable-table-container) {
    min-height: 400px;
}

/** 수량/소계 컬럼 InputNumber: PrimeVue 기본 min-width 강제 제거 */
:deep(.resource-table .col-quantity .p-inputnumber),
:deep(.resource-table .col-quantity .p-inputnumber-input),
:deep(.resource-table .col-subtotal .p-inputnumber),
:deep(.resource-table .col-subtotal .p-inputnumber-input) {
    min-width: 0 !important;
    width: 100% !important;
}
</style>

<style>
/** 다크모드 전역 스타일 강제 적용 (Vue scoped CSS 무시 버그 우회) */
html.dark .resource-table .p-datatable-thead>tr>th {
    background-color: #27272a !important;
    /* zinc-800 */
    color: #e4e4e7 !important;
    /* zinc-200 */
}
</style>
