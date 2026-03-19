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
import { useProjects } from '~/composables/useProjects'; // Assuming useProjects is in composables
import { PROJECT_STAGES, getApprovalAuthority } from '~/utils/common';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import type { OrgUser } from '~/composables/useOrganization';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchProject, createProject, updateProject } = useProjects();
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
}

/** 폼 데이터 상태 (신규/수정 공통) */
const form = ref({
    prjNm: '',
    prjTp: '신규',
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
    prjPulPtt: '', // 프로젝트추진가능성
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
 * 사업연도(prjYy) 선택지 옵션 생성 (현재 연도 기준: 작년, 올해, 내년)
 */
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

/* ── 드롭다운 선택지 옵션 ── */
const resourceCategoryOptions = ['개발비', '기계장치', '기타무형자산', '전산용역비', '전산임차료', '전산제비'];

/**
 * 2단계 선택이 필요한 구분별 소분류 옵션 맵
 * 해당 대분류가 선택되면 마우스 오버 시 오른쪽으로 소분류 flyout이 표시됩니다.
 */
const resourceSubCategoryMap: Record<string, string[]> = {
    '개발비': ['일반', '감리/컨설팅'],
    '기타무형자산': ['일반', 'SW라이선스'],
    '전산용역비': ['외주(운영,관제 등)', '자문/심사'],
};

/* ── 구분 cascading dropdown 상태 ── */

/** 현재 열려있는 드롭다운의 행 인덱스 (null이면 모두 닫힘) */
const activeCatDropdownIndex = ref<number | null>(null);

/** 1단계 드롭다운에서 현재 마우스가 올려진 대분류 */
const hoveredMainCategory = ref<string>('');

/** Teleport로 body에 렌더링할 드롭다운의 fixed 위치 및 개방 방향 */
const catDropdownPos = ref({ top: 0, bottom: 0, left: 0, width: 0, openUpward: false });

/**
 * 구분 드롭다운 열기
 * 트리거 버튼의 DOMRect를 기반으로 fixed 위치를 계산합니다.
 * 아래 공간이 부족하면 위로 열리도록 방향을 자동 결정합니다.
 */
const openCatDropdown = (index: number, event: MouseEvent) => {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    /* 항목 수 × 옵션 예상 높이(34px) + 패널 상하 패딩(8px) */
    const estimatedHeight = resourceCategoryOptions.length * 34 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight + 8;
    catDropdownPos.value = {
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: Math.max(rect.width, 140),
        openUpward,
    };
    activeCatDropdownIndex.value = activeCatDropdownIndex.value === index ? null : index;
    hoveredMainCategory.value = '';
};

/** 구분 드롭다운 닫기 */
const closeCatDropdown = () => {
    activeCatDropdownIndex.value = null;
    hoveredMainCategory.value = '';
};

/**
 * 대분류 항목 클릭 처리
 * 소분류가 있는 항목은 클릭으로 직접 선택 불가 (소분류에서만 선택 가능).
 * 소분류가 없는 항목만 즉시 선택 후 드롭다운을 닫습니다.
 */
const selectMainCat = (rowData: ResourceItem, cat: string) => {
    if (resourceSubCategoryMap[cat]) return; // 소분류 존재 시 클릭 무시
    rowData.category = cat;
    rowData.subCategory = '';
    closeCatDropdown();
};

/**
 * 소분류 항목 클릭 처리
 * 대분류와 소분류를 모두 세팅하고 드롭다운을 닫습니다.
 */
const selectSubCat = (rowData: ResourceItem, cat: string, sub: string) => {
    rowData.category = cat;
    rowData.subCategory = sub;
    closeCatDropdown();
};
const currencyOptions = computed(() => Object.keys(exchangeRates.value));
const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

const prjTypeOptions = ['신규', '계속'];
const statusOptions = PROJECT_STAGES;



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
                    xcr: item.xcr // 저장된 환율 복원
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

        /* API 필수 기본값 설정 */
        gclMngNo: null as string | null, // 신규 시 null
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
 * 사업명이 비어있으면 경고 다이얼로그를 표시하고 중단합니다.
 */
const saveProject = () => {
    if (!form.value.prjNm) {
        confirm.require({
            message: '사업명을 입력해주세요.',
            header: '입력 확인',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
        return;
    }
    executeSave();
};

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
    <div class="space-y-6">
        <!-- 상단 고정(Sticky) 헤더 영역 -->
        <div
            class="sticky -top-6 z-20 -mt-6 -mx-6 px-6 py-4 sm:-mx-8 sm:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                {{ isEditMode ? '정보화사업 정보 수정' : '신규 정보화사업 등록' }}
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

        <div
            class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <h3 class="text-xl font-semibold">사업명</h3>

            <!-- 사업명 섹션: 연도 + 유형 + 사업명 -->
            <div class="flex gap-6">
                <!-- 사업 연도 선택 (자동 연산된 YYYY-1, YYYY, YYYY+1) -->
                <div class="flex flex-col gap-2">
                    <Select v-model="form.prjYy" :options="yearOptions" placeholder="연도 선택" class="w-32"
                        :disabled="isEditMode" />
                </div>
                <!-- 사업 유형 선택 (신규/계속) -->
                <div class="flex flex-col gap-2">
                    <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" class="w-40" />
                </div>
                <!-- 사업명 텍스트 입력 -->
                <div class="flex flex-col gap-2 flex-1">
                    <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                </div>
            </div>

            <Divider />

            <!-- 사업 개요 섹션 -->
            <div class="space-y-6">
                <h3 class="text-xl font-semibold">사업 개요</h3>
                <!-- Rich Text 사업 상세 설명 -->
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjDes" editorStyle="height: 150px" placeholder="사업 상세 내용을 입력하세요." />
                </div>
                <!-- 현황 / 필요성 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">현황</label>
                        <Textarea v-model="form.saf" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">필요성</label>
                        <Textarea v-model="form.ncs" style="height: 150px;" />
                    </div>
                </div>
                <!-- 기대효과 / 미추진 시 문제점 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">기대효과</label>
                        <Textarea v-model="form.xptEff" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">미추진 시 문제점</label>
                        <Textarea v-model="form.plm" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 범위 섹션 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업범위</span>
                    <span class="text-sm text-zinc-500">전산 요구사항</span>
                </div>
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjRng" editorStyle="height: 150px" />
                </div>
            </div>

            <Divider />

            <!-- 진행 상황 섹션: 추진 경과 / 향후 계획 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">진행상황</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">추진 경과</label>
                        <Textarea v-model="form.pulPsg" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">향후 계획</label>
                        <Textarea v-model="form.hrfPln" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 구분 섹션: 업무구분/사업유형/기술유형/주요사용자 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업구분</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">업무 구분</label>
                        <InputText v-model="form.bzDtt" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">사업 유형</label>
                        <InputText v-model="form.prjTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">기술 유형</label>
                        <InputText v-model="form.tchnTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주요 사용자</label>
                        <InputText v-model="form.mnUsr" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 편성 기준 섹션: 중복여부/법규상완료시기 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">편성기준</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">중복 여부 (Y/N)</label>
                        <Select v-model="form.dplYn" :options="['Y', 'N']" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">법규상 완료시기</label>
                        <DatePicker v-model="form.lblFsgTlm" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 담당부서 섹션: 주관부문 → 주관부서(팀장/담당자) → IT부서(팀장/담당자) -->
            <!-- 각 필드는 직원검색 버튼을 클릭하여 EmployeeSearchDialog에서 선택합니다. -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">담당부서</span>
                </div>

                <!-- 주관부문 (담당팀장 선택 시 API 응답의 상위부서명 자동 세팅, 수동 편집 불가) -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주관부문</label>
                        <InputText v-model="form.svnHdq" placeholder="담당팀장 선택 시 자동 입력" fluid readonly
                            class="w-80 bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                </div>

                <!-- 주관부서 + 팀장/담당자 (직원 검색 다이얼로그 연동) -->
                <div class="flex gap-6">
                    <!-- 주관부서: 담당팀장 선택 시 자동 세팅 (readonly) -->
                    <div class="flex flex-col gap-2 w-60">
                        <label class="font-semibold">주관부서</label>
                        <InputText :modelValue="form.svnDpmNm || form.svnDpm" placeholder="담당팀장 선택 시 자동 입력" fluid
                            readonly class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <!-- 주관부서 담당팀장 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.svnDpmTlrNm ? `${form.svnDpmTlrNm} (${form.svnDpmTlr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                @click="openEmployeeDialog('svnDpmTlr')" />
                            <Button icon="pi pi-search" severity="secondary" @click="openEmployeeDialog('svnDpmTlr')" />
                        </div>
                    </div>
                    <!-- 주관부서 담당자 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <div class="flex gap-1">
                            <InputText
                                :modelValue="form.svnDpmCgprNm ? `${form.svnDpmCgprNm} (${form.svnDpmCgpr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                @click="openEmployeeDialog('svnDpmCgpr')" />
                            <Button icon="pi pi-search" severity="secondary"
                                @click="openEmployeeDialog('svnDpmCgpr')" />
                        </div>
                    </div>
                </div>

                <!-- IT부서 + 팀장/담당자 (직원 검색 다이얼로그 연동) -->
                <div class="flex gap-6">
                    <!-- IT부서: 담당팀장 선택 시 자동 세팅 (readonly) -->
                    <div class="flex flex-col gap-2 w-60">
                        <label class="font-semibold">IT부서</label>
                        <InputText :modelValue="form.itDpmNm || form.itDpm" placeholder="담당팀장 선택 시 자동 입력" fluid readonly
                            class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <!-- IT부서 담당팀장 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.itDpmTlrNm ? `${form.itDpmTlrNm} (${form.itDpmTlr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                @click="openEmployeeDialog('itDpmTlr')" />
                            <Button icon="pi pi-search" severity="secondary" @click="openEmployeeDialog('itDpmTlr')" />
                        </div>
                    </div>
                    <!-- IT부서 담당자 -->
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <div class="flex gap-1">
                            <InputText :modelValue="form.itDpmCgprNm ? `${form.itDpmCgprNm} (${form.itDpmCgpr})` : ''"
                                placeholder="직원 검색" fluid readonly class="cursor-pointer"
                                @click="openEmployeeDialog('itDpmCgpr')" />
                            <Button icon="pi pi-search" severity="secondary" @click="openEmployeeDialog('itDpmCgpr')" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 직원 검색 다이얼로그 (6개 필드에서 공유, activeDialogField로 구분) -->
            <EmployeeSearchDialog v-model:visible="showEmployeeDialog" :header="employeeDialogHeader"
                @select="onEmployeeSelected" />

            <Divider />

            <!-- 추진시기 및 소요예산 섹션 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">추진시기 및 소요예산</span>
                </div>

                <!-- 예산/전결권/보고상태 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">예산 (원)</label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            placeholder="자동 계산됨" fluid readonly inputClass="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">전결권</label>
                        <InputText v-model="form.edrt" readonly placeholder="자동 지정됨" fluid
                            class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">보고상태</label>
                        <InputText v-model="form.rprSts" fluid />
                    </div>
                </div>

                <!-- 시작일/종료일/추진가능성 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">시작일</label>
                        <DatePicker v-model="form.sttDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">종료일</label>
                        <DatePicker v-model="form.endDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">사업추진 가능성</label>
                        <InputText v-model="form.prjPulPtt" fluid />
                    </div>
                </div>

                <Divider />

                <!-- 소요자원 상세내용 DataTable -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-semibold">소요자원 상세내용</h3>
                        <Button label="품목 추가" icon="pi pi-plus" size="small" @click="addResourceRow" />
                    </div>

                    <div class="overflow-x-auto">
                        <DataTable :value="form.resourceItems" resizableColumns columnResizeMode="fit" showGridlines
                            size="small" class="resource-table">
                            <template #empty>
                                <div class="text-center text-zinc-500 py-4">
                                    등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                                </div>
                            </template>

                            <!-- 구분: 2단계 cascading flyout 드롭다운 -->
                            <Column header="구분" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 160px">
                                <template #body="{ data, index }">
                                    <!-- 외부 클릭 시 드롭다운 닫기용 transparent overlay -->
                                    <Teleport to="body">
                                        <div
                                            v-if="activeCatDropdownIndex === index"
                                            class="fixed inset-0 z-40"
                                            @click="closeCatDropdown"
                                        />
                                    </Teleport>

                                    <!-- 트리거 버튼: PrimeVue Select CSS 변수를 그대로 사용해 주변 폼과 동일한 높이/폰트 유지 -->
                                    <button
                                        type="button"
                                        class="w-full flex items-center justify-between gap-1 cursor-pointer"
                                        style="
                                            padding: var(--p-select-padding-y) var(--p-select-padding-x);
                                            font-size: inherit;
                                            font-family: inherit;
                                            line-height: 1.5;
                                            color: var(--p-select-color);
                                            background: var(--p-select-background);
                                            border: 1px solid var(--p-select-border-color);
                                            border-radius: var(--p-select-border-radius);
                                            box-shadow: var(--p-select-shadow);
                                            outline: none;
                                            transition: border-color var(--p-select-transition-duration, 0.15s);
                                        "
                                        @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--p-select-hover-border-color)'"
                                        @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = activeCatDropdownIndex === index ? 'var(--p-select-focus-border-color)' : 'var(--p-select-border-color)'"
                                        @focus="($event.currentTarget as HTMLElement).style.borderColor = 'var(--p-select-focus-border-color)'"
                                        @blur="($event.currentTarget as HTMLElement).style.borderColor = 'var(--p-select-border-color)'"
                                        @click.stop="openCatDropdown(index, $event)"
                                    >
                                        <span class="truncate text-left flex-1">
                                            <template v-if="data.category">
                                                {{ data.category }}
                                                <template v-if="data.subCategory">
                                                    <span style="color: var(--p-select-placeholder-color)" class="mx-0.5">›</span>
                                                    {{ data.subCategory }}
                                                </template>
                                            </template>
                                            <span v-else style="color: var(--p-select-placeholder-color)">선택</span>
                                        </span>
                                        <!-- PrimeVue Select dropdown 아이콘 색상 변수 사용 -->
                                        <i class="pi pi-chevron-down flex-shrink-0"
                                            style="font-size: 0.75rem; color: var(--p-select-dropdown-color, var(--p-form-field-icon-color))"
                                            :class="{ 'rotate-180': activeCatDropdownIndex === index }"
                                            :style="{ transition: 'transform var(--p-select-transition-duration, 0.15s)' }" />
                                    </button>

                                    <!-- 1단계 드롭다운 패널 (Teleport → body, fixed 위치) -->
                                    <Teleport to="body">
                                        <div
                                            v-if="activeCatDropdownIndex === index"
                                            class="cat-dropdown-panel fixed z-50"
                                            :style="{
                                                ...(catDropdownPos.openUpward
                                                    ? { bottom: catDropdownPos.bottom + 'px' }
                                                    : { top: catDropdownPos.top + 'px' }),
                                                left: catDropdownPos.left + 'px',
                                                minWidth: catDropdownPos.width + 'px'
                                            }"
                                            @click.stop
                                        >
                                            <div
                                                v-for="cat in resourceCategoryOptions"
                                                :key="cat"
                                                class="cat-dropdown-option"
                                                :class="{
                                                    /* 소분류 없는 항목: 직접 선택된 경우 */
                                                    'is-selected': !resourceSubCategoryMap[cat] && data.category === cat,
                                                    /* 소분류 있는 항목: 하위 항목이 현재 선택된 경우 (클릭 불가) */
                                                    'is-parent-active': !!resourceSubCategoryMap[cat] && data.category === cat,
                                                }"
                                                @mouseenter="hoveredMainCategory = cat"
                                                @click.stop="selectMainCat(data, cat)"
                                            >
                                                <span>{{ cat }}</span>
                                                <!-- 소분류가 있는 항목은 화살표 표시 -->
                                                <i
                                                    v-if="resourceSubCategoryMap[cat]"
                                                    class="pi pi-chevron-right ml-2 flex-shrink-0"
                                                    style="font-size: 0.65rem; color: var(--p-select-option-color); opacity: 0.5;"
                                                />

                                                <!-- 2단계 소분류 flyout (hover 시 오른쪽으로 나타남) -->
                                                <div
                                                    v-if="resourceSubCategoryMap[cat] && hoveredMainCategory === cat"
                                                    class="cat-dropdown-panel absolute left-full top-0 ml-1"
                                                    style="z-index: 51; min-width: 160px;"
                                                    @click.stop
                                                >
                                                    <div
                                                        v-for="sub in resourceSubCategoryMap[cat]"
                                                        :key="sub"
                                                        class="cat-dropdown-option"
                                                        :class="{ 'is-selected': data.category === cat && data.subCategory === sub }"
                                                        @click.stop="selectSubCat(data, cat, sub)"
                                                    >
                                                        {{ sub }}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Teleport>
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
                                style="width: 80px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                                </template>
                            </Column>



                            <!-- 통화: KRW/USD/EUR 등 -->
                            <Column header="통화" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 100px">
                                <template #body="{ data }">
                                    <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                                </template>
                            </Column>

                            <!-- 소계: 직접 입력 → 단가 자동 역산 -->
                            <Column header="소계" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 120px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.gclAmt" mode="currency"
                                        :currency="data.currency || 'KRW'" locale="ko-KR" class="w-full" />
                                </template>
                            </Column>

                            <!-- 산정근거 -->
                            <Column header="산정근거" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 200px">
                                <template #body="{ data }">
                                    <Textarea v-model="data.basis" rows="1" autoResize class="w-full" />
                                </template>
                            </Column>

                            <!-- 도입시기/지급주기: 구분에 따라 다른 입력 컴포넌트 표시 -->
                            <Column header="도입시기/지급주기" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 150px">
                                <template #body="{ data }">
                                    <!-- 자본예산: 도입시기 DatePicker (월 단위) -->
                                    <div v-if="['개발비', '기계장치', '기타무형자산'].includes(data.category)">
                                        <DatePicker v-model="data.introDate" view="month" dateFormat="yy-mm" showIcon
                                            fluid placeholder="도입시기" class="w-full" />
                                    </div>
                                    <!-- 임차료/제비: 지급주기 드롭다운 -->
                                    <div v-else-if="['전산임차료', '전산제비'].includes(data.category)">
                                        <Select v-model="data.paymentCycle" :options="paymentCycleOptions"
                                            placeholder="지급주기" class="w-full" />
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
                                    <Button icon="pi pi-trash" text severity="danger"
                                        @click="removeResourceRow(index)" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>

                <!-- 최종 액션 버튼 (플로팅 그룹) -->
            </div>
        </div>
    </div>
</template>

<style scoped>
/** 소요자원 테이블 헤더 배경색 (라이트/다크 모드) */
:deep(.resource-table .p-datatable-thead > tr > th) {
    background-color: #f4f4f5 !important;
    /* zinc-100 */
}

:deep(.dark .resource-table .p-datatable-thead > tr > th) {
    background-color: #27272a !important;
    /* zinc-800 */
}

/** 소요자원 테이블 헤더 콘텐츠 중앙 정렬 */
:deep(.resource-table .p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}
</style>

<style>
/**
 * 구분 cascading dropdown 패널 & 옵션 스타일
 * Teleport to="body"로 렌더링되어 scoped CSS가 미적용되므로 전역 스타일로 정의합니다.
 * PrimeVue Select overlay/option CSS 변수를 그대로 사용해 주변 Select와 동일한 외형을 유지합니다.
 */
.cat-dropdown-panel {
    background: var(--p-select-overlay-background);
    border: 1px solid var(--p-select-overlay-border-color);
    border-radius: var(--p-select-overlay-border-radius);
    box-shadow: var(--p-select-overlay-shadow);
    padding: var(--p-select-list-padding, 0.25rem 0.25rem);
}

.cat-dropdown-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--p-select-option-padding);
    border-radius: var(--p-select-option-border-radius);
    color: var(--p-select-option-color);
    font-size: inherit;
    cursor: pointer;
    user-select: none;
    position: relative;
    white-space: nowrap;
}

.cat-dropdown-option:hover {
    background: var(--p-select-option-focus-background);
    color: var(--p-select-option-focus-color);
}

/* 직접 선택된 항목 */
.cat-dropdown-option.is-selected {
    background: var(--p-select-option-selected-background);
    color: var(--p-select-option-selected-color);
}

.cat-dropdown-option.is-selected:hover {
    background: var(--p-select-option-selected-focus-background);
    color: var(--p-select-option-selected-focus-color);
}

/* 하위 항목이 선택된 부모 (클릭 불가 — hover 스타일은 일반 항목과 동일) */
.cat-dropdown-option.is-parent-active {
    color: var(--p-select-option-selected-color);
    font-weight: 500;
}

.cat-dropdown-option.is-parent-active:hover {
    background: var(--p-select-option-focus-background);
    color: var(--p-select-option-focus-color);
}
</style>
