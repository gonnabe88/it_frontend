/**
 * ============================================================================
 * [utils/common.ts] 공통 유틸리티 함수 모음
 * ============================================================================
 * 여러 페이지/컴포넌트에서 반복적으로 사용되는 순수 함수들을 모아놓은 파일입니다.
 * 이 파일의 함수들은 Vue/Nuxt에 의존하지 않는 순수 TypeScript 함수이므로
 * 컴포넌트, composable, 스토어 등 어디서든 import하여 사용할 수 있습니다.
 *
 * [포함 함수]
 *  - formatBudget      : 예산 금액을 단위(천원/백만원/억원)에 따라 변환 및 포맷
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

/**
 * 사업현황 상태(prjSts)에 따른 PrimeVue Tag 커스텀 CSS 클래스를 반환
 *
 * IT 프로젝트의 진행 단계를 시각적으로 구분하기 위한 색상 매핑입니다.
 * 단계가 많으므로 색상을 다양하게 배정하여 혼동을 최소화합니다.
 *
 * [IT 프로젝트 진행 단계 및 색상 매핑]
 *  - 예산 신청       → kdb-tag-yellow (노랑: 초기 신청 단계)
 *  - 사전 협의       → kdb-tag-green  (녹색: 협의 진행)
 *  - 정실협 진행중   → kdb-tag-indigo (인디고: 정보화실행협의회 단계)
 *  - 요건 상세화     → kdb-tag-purple (보라: 요건 정의 단계)
 *  - 소요예산 산정   → kdb-tag-pink   (분홍: 예산 산정 단계)
 *  - 과심위 진행중   → kdb-tag-orange (주황: 과제심의위원회 단계)
 *  - 입찰/계약 진행중→ kdb-tag-cyan   (청록: 구매/계약 단계)
 *  - 사업 진행중     → kdb-tag-green  (녹색: 실제 사업 수행 중)
 *  - 사업 완료       → kdb-tag-slate  (슬레이트: 사업 종료)
 *  - 대금지급 완료   → kdb-tag-teal   (틸: 정산 완료)
 *  - 성과평가(대기)  → kdb-tag-rose   (로즈: 평가 대기)
 *  - 성과평가(완료)  → kdb-tag-gray   (회색: 모든 절차 완료)
 *  - 기타            → kdb-tag-gray   (회색: 미정의 상태)
 *
 * @param status - 사업현황 상태 문자열 (Project.prjSts)
 * @returns 커스텀 CSS 클래스명 ('kdb-tag-*')
 *
 * @example
 * // 템플릿에서 사용
 * <Tag :class="getProjectTagClass(project.prjSts)" :value="project.prjSts" />
 */
export const getProjectTagClass = (status: string) => {
    switch (status) {
        case '예산 신청':        return 'kdb-tag-yellow'; // 예산 신청 단계
        case '사전 협의':        return 'kdb-tag-green';  // 현업-IT 사전 협의
        case '정실협 진행중':    return 'kdb-tag-indigo'; // 정보화실행협의회 심의 중
        case '요건 상세화':      return 'kdb-tag-purple'; // 상세 요건 정의 단계
        case '소요예산 산정':    return 'kdb-tag-pink';   // 예산 세부 산정 단계
        case '과심위 진행중':    return 'kdb-tag-orange'; // 과제심의위원회 심의 중
        case '입찰/계약 진행중': return 'kdb-tag-cyan';   // 조달/입찰/계약 처리 중
        case '사업 진행중':      return 'kdb-tag-green';  // 사업 수행 중
        case '사업 완료':        return 'kdb-tag-slate';  // 사업 종료
        case '대금지급 완료':    return 'kdb-tag-teal';   // 대금 정산 완료
        case '성과평가(대기)':   return 'kdb-tag-rose';   // 성과평가 대기 중
        case '성과평가(완료)':   return 'kdb-tag-gray';   // 성과평가까지 모두 완료
        default:                 return 'kdb-tag-gray';   // 미정의 상태 기본값
    }
};
