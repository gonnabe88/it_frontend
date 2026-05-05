/**
 * ============================================================================
 * [utils/common.ts] 공통 유틸리티 함수 모음
 * ============================================================================
 * 여러 페이지/컴포넌트에서 반복적으로 사용되는 순수 함수들을 모아놓은 파일입니다.
 * 이 파일의 함수들은 Vue/Nuxt에 의존하지 않는 순수 TypeScript 함수이므로
 * 컴포넌트, composable, 스토어 등 어디서든 import하여 사용할 수 있습니다.
 *
 * [포함 함수]
 *  - formatBudget       : 예산 금액을 단위(천원/백만원/억원)에 따라 변환 및 포맷
 *  - formatKoreanDate   : 날짜를 한국어 형식(YYYY년 MM월 DD일)으로 변환
 *  - getApprovalTagClass: 결재 상태별 PrimeVue Tag CSS 클래스 반환
 *  - getProjectTagClass : 사업현황 상태별 PrimeVue Tag CSS 클래스 반환
 *
 * [배경]
 *  - 기존에 각 페이지(projects, budget 등)에 동일한 함수가 3중으로 중복 존재하였습니다.
 *  - 유지보수성 향상을 위해 이 파일로 통합하였습니다.
 * ============================================================================
 */

/**
 * 예산 금액을 지정된 단위로 변환하여 포맷팅된 문자열로 반환
 *
 * 입력된 원(KRW) 단위의 금액을 사용자가 선택한 단위로 나누고,
 * 소수점 자릿수를 단위별로 적절하게 조정하여 표시합니다.
 *
 * [단위별 소수점 처리]
 *  - 원    : 소수점 없음 (정수 표시)
 *  - 천원  : 소수점 없음 (예: 1,500)
 *  - 백만원: 소수점 1자리 (예: 1.5)
 *  - 억원  : 소수점 1자리 (예: 1.5)
 *
 * @param amount - 변환할 원(KRW) 단위의 숫자 금액
 * @param unit   - 표시 단위 ('원' | '천원' | '백만원' | '억원')
 * @returns 로케일 기반으로 포맷팅된 금액 문자열 (단위 기호 미포함)
 *
 * @example
 * formatBudget(1500000, '천원')   // → '1,500'
 * formatBudget(1500000, '백만원') // → '1.5'
 * formatBudget(150000000, '억원') // → '1.5'
 * formatBudget(1500, '원')        // → '1,500'
 */
export const formatBudget = (amount: number, unit: string) => {
    let value = amount;
    let fractionDigits = 0;

    switch (unit) {
        case '천원':
            // 1,000원 = 1천원
            value = amount / 1000;
            break;
        case '백만원':
            // 1,000,000원 = 1백만원, 소수점 1자리까지 표시
            value = amount / 1000000;
            fractionDigits = 1;
            break;
        case '억원':
            // 100,000,000원 = 1억원, 소수점 1자리까지 표시
            value = amount / 100000000;
            fractionDigits = 1;
            break;
        // '원' 또는 기타 단위는 변환 없이 그대로 사용
    }

    // 브라우저 로케일에 맞는 천 단위 구분자 적용 (maximumFractionDigits로 소수점 제한)
    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
};


/**
 * 자본예산·일반관리비를 기준 등급(0~4)으로 변환하는 내부 헬퍼
 * 0: 부장 / 1: 지역본부장 / 2: 부문장 / 3: 전무이사 / 4: 회장
 *
 * [자본예산 기준]  20억↑:4 / 10억↑:3 / 5억↑:2 / 2억↑:1 / 그 외:0
 * [일반관리비 기준] 5억↑:4 / 3억↑:3 / 1억↑:2 / 3천만↑:1 / 그 외:0
 */
const calcCapLevel = (capitalBudget: number): number => {
    if (capitalBudget >= 2000000000) return 4;
    if (capitalBudget >= 1000000000) return 3;
    if (capitalBudget >= 500000000)  return 2;
    if (capitalBudget >= 200000000)  return 1;
    return 0;
};

const calcOpLevel = (operatingExpense: number): number => {
    if (operatingExpense >= 500000000) return 4;
    if (operatingExpense >= 300000000) return 3;
    if (operatingExpense >= 100000000) return 2;
    if (operatingExpense >= 30000000)  return 1;
    return 0;
};

/**
 * 자본예산과 일반관리비 합계에 따라 전결권(결재권자)을 반환
 *
 * [자본예산 합계 (개발비, 기계장치, 기타무형자산)]
 *  - 20억 이상 : 회장 / 10억 이상 : 전무이사 / 5억 이상 : 부문장
 *  - 2억 이상 : 지역본부장 / 2억 미만 : 부장
 *
 * [일반관리비 합계 (전산임차료, 전산제비)]
 *  - 5억 이상 : 회장 / 3억 이상 : 전무이사 / 1억 이상 : 부문장
 *  - 3천만 이상 : 지역본부장 / 3천만 미만 : 부장
 *
 * 두 기준 중 더 상위 결재권자를 최종 전결권으로 적용합니다.
 * (직급 순: 회장 > 전무이사 > 부문장 > 지역본부장 > 부장)
 *
 * @param capitalBudget 자본예산 합계(원)
 * @param operatingExpense 일반관리비 합계(원)
 * @returns 최종 전결권자 직급
 */
export const getApprovalAuthority = (capitalBudget: number, operatingExpense: number): string => {
    const roles = ['부장', '지역본부장', '부문장', '전무이사', '회장'];
    return roles[Math.max(calcCapLevel(capitalBudget), calcOpLevel(operatingExpense))] || '부장';
};

/**
 * 전결권 결정에 실제로 적용된 기준(자본예산 또는 일반관리비)과 해당 금액을 반환
 *
 * 호출부에서 금액을 원하는 형식으로 포맷팅할 수 있도록
 * 레이블과 금액을 분리한 객체로 반환합니다.
 *
 * @param capitalBudget 자본예산 합계(원)
 * @param operatingExpense 일반관리비 합계(원)
 * @returns { label: '자본예산' | '일반관리비', amount: number }
 *
 * @example
 * const { label, amount } = getApprovalAuthorityBasis(500000000, 20000000);
 * // → { label: '자본예산', amount: 500000000 }
 *
 * const { label, amount } = getApprovalAuthorityBasis(0, 150000000);
 * // → { label: '일반관리비', amount: 150000000 }
 */
export const getApprovalAuthorityBasis = (
    capitalBudget: number,
    operatingExpense: number
): { label: '자본예산' | '일반관리비'; amount: number } => {
    // 일반관리비 레벨이 더 높을 때만 일반관리비 기준, 동일하면 자본예산 우선
    if (calcOpLevel(operatingExpense) > calcCapLevel(capitalBudget)) {
        return { label: '일반관리비', amount: operatingExpense };
    }
    return { label: '자본예산', amount: capitalBudget };
};

/**
 * 결재 상태(apfSts)에 따른 PrimeVue Tag 커스텀 CSS 클래스를 반환
 *
 * 반환된 클래스는 tailwind.config.js 또는 전역 CSS에 정의된
 * 'kdb-tag-*' 커스텀 색상 유틸리티 클래스입니다.
 *
 * [상태 → 색상 매핑]
 *  - 결재완료 → kdb-tag-green  (녹색: 정상 완료)
 *  - 반려     → kdb-tag-red    (빨강: 반려/오류)
 *  - 결재중   → kdb-tag-blue   (파랑: 진행 중)
 *  - 임시저장 → kdb-tag-gray   (회색: 미처리)
 *  - 기타     → kdb-tag-gray   (회색: 미정의 상태)
 *
 * @param status - 결재 상태 문자열 (Approval.apfSts)
 * @returns PrimeVue Tag의 severity 또는 커스텀 CSS 클래스명
 *
 * @example
 * // 템플릿에서 사용
 * <Tag :class="getApprovalTagClass(approval.apfSts)" :value="approval.apfSts" />
 */
export const getApprovalTagClass = (status: string) => {
    switch (status) {
        case '결재완료': return 'kdb-tag-green';  // 모든 결재자의 승인 완료
        case '반려':     return 'kdb-tag-red';    // 결재자 중 한 명 이상이 반려
        case '결재중':   return 'kdb-tag-blue';   // 결재 진행 중 (일부 결재자 미처리)
        case '임시저장': return 'kdb-tag-gray';   // 신청서 작성 후 미제출 상태
        default:         return 'kdb-tag-gray';   // 정의되지 않은 상태는 기본 회색
    }
};

/** 프로젝트 진행 상태 단계 목록 */
export const PROJECT_STAGES = [
    '예산 작성', '사전 협의', '정실협', '요건 상세화', '소요예산 산정',
    '과심위', '입찰/계약', '사업 추진', '예산배정', '대금지급', '성과평가', '완료'
];

/** 진행 상태 → kdb-tag-* CSS 클래스 매핑 (정보화사업/전산업무비 공통) */
const STATUS_TAG_CLASS_MAP: Record<string, string> = {
    '예산 작성': 'kdb-tag-yellow',
    '사전 협의': 'kdb-tag-green',
    '정실협':    'kdb-tag-indigo',
    '요건 상세화': 'kdb-tag-purple',
    '소요예산 산정': 'kdb-tag-pink',
    '과심위':    'kdb-tag-orange',
    '입찰/계약': 'kdb-tag-cyan',
    '사업 추진': 'kdb-tag-green',
    '예산배정':  'kdb-tag-teal',
    '대금지급':  'kdb-tag-teal',
    '성과평가':  'kdb-tag-rose',
    '완료':      'kdb-tag-slate',
};

/**
 * 사업현황 상태(prjSts)에 따른 PrimeVue Tag 커스텀 CSS 클래스를 반환
 * @param status - 사업현황 상태 문자열 (Project.prjSts)
 */
export const getProjectTagClass = (status: string) => STATUS_TAG_CLASS_MAP[status] ?? 'kdb-tag-gray';

/** 전산업무비 진행 상태 단계 목록 */
export const COST_STAGES = [
    '예산 작성', '과심위', '입찰/계약', '사업 추진', '예산배정', '대금지급', '완료'
];

/**
 * 전산업무비 상태(costSts)에 따른 PrimeVue Tag 커스텀 CSS 클래스를 반환
 * @param status - 전산업무비 상태 문자열 (Cost.costSts)
 */
export const getCostTagClass = (status: string) => STATUS_TAG_CLASS_MAP[status] ?? 'kdb-tag-gray';

/**
 * 날짜/시간 문자열을 한국어 로케일 표시 형식으로 변환
 *
 * @param dtm - ISO 날짜/시간 문자열. null/undefined/빈 문자열은 빈 문자열 반환.
 * @returns '2026. 4. 1. 오전 9:00:00' 형태의 문자열
 *
 * @example
 * formatDateTime('2026-04-01T09:00:00') // → '2026. 4. 1. 오전 9:00:00'
 * formatDateTime(null)                   // → ''
 */
export const formatDateTime = (dtm: string | null | undefined): string => {
    if (!dtm) return '';
    return new Date(dtm).toLocaleString('ko-KR');
};

/**
 * 파일 크기를 사람이 읽기 쉬운 단위로 변환
 * @param bytes - 파일 크기 (바이트). null/undefined는 빈 문자열 반환.
 * @returns '1.2 KB', '3.5 MB' 형태의 문자열 (0 bytes → '0 B')
 *
 * @example
 * formatFileSize(0)        // → '0 B'
 * formatFileSize(1536)     // → '1.5 KB'
 * formatFileSize(1572864)  // → '1.5 MB'
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes == null) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ============================================================================
// 협의회 상태 유틸리티
// ============================================================================

/** 협의회 진행상태 코드 → kdb-tag-* CSS 클래스 매핑 (UI 전용, CCODEM 미사용) */
const COUNCIL_STATUS_TAG_MAP: Record<string, string> = {
    DRAFT:           'kdb-tag-gray',
    SUBMITTED:       'kdb-tag-yellow',
    APPROVAL_PENDING:'kdb-tag-blue',
    APPROVED:        'kdb-tag-teal',
    PREPARING:       'kdb-tag-indigo',
    SCHEDULED:       'kdb-tag-purple',
    IN_PROGRESS:     'kdb-tag-orange',
    EVALUATING:      'kdb-tag-pink',
    RESULT_WRITING:  'kdb-tag-cyan',
    RESULT_REVIEW:   'kdb-tag-rose',
    FINAL_APPROVAL:          'kdb-tag-blue',
    RESULT_APPROVAL_PENDING: 'kdb-tag-yellow',
    COMPLETED:               'kdb-tag-green',
};

/**
 * 협의회 진행상태 코드에 따른 PrimeVue Tag 커스텀 CSS 클래스를 반환
 * (레이블 변환은 useCouncilCodes().getStatusLabel() 사용)
 *
 * @param status - 협의회 상태 코드 (CouncilStatus)
 * @returns kdb-tag-* 커스텀 CSS 클래스명
 */
export const getCouncilTagClass = (status: string): string =>
    COUNCIL_STATUS_TAG_MAP[status] ?? 'kdb-tag-gray';

/**
 * 협의회 심의유형 코드를 화면 표출용 한글 레이블로 변환
 *
 * @param dbrTp - 심의유형 코드 (INFO_SYS / INFO_SEC / ETC)
 * @returns 한글 심의유형 레이블
 */
export const getHearingTypeLabel = (dbrTp: string | null | undefined): string => {
    switch (dbrTp) {
        case 'INFO_SYS': return '정보시스템';
        case 'INFO_SEC': return '정보보호';
        case 'ETC':      return '기타';
        default:         return '-';
    }
};

/**
 * 날짜를 한국어 형식(YYYY년 MM월 DD일)으로 반환
 *
 * @param date - 변환할 Date 객체 (기본값: 현재 날짜)
 * @returns 한국어 날짜 문자열 (예: '2026년 04월 10일')
 *
 * @example
 * formatKoreanDate()                        // → '2026년 04월 10일'
 * formatKoreanDate(new Date('2026-01-15'))   // → '2026년 01월 15일'
 */
export const formatKoreanDate = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}년 ${m}월 ${d}일`;
};

