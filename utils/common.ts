// 예산 단위 변환 포맷팅 (원 → 천원/백만원/억원)
export const formatBudget = (amount: number, unit: string) => {
    let value = amount;
    let fractionDigits = 0;

    switch (unit) {
        case '천원':
            value = amount / 1000;
            break;
        case '백만원':
            value = amount / 1000000;
            fractionDigits = 1;
            break;
        case '억원':
            value = amount / 100000000;
            fractionDigits = 1;
            break;
    }

    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
};

// 결재 상태별 태그 스타일
export const getApprovalTagClass = (status: string) => {
    switch (status) {
        case '결재완료': return 'kdb-tag-green';
        case '반려': return 'kdb-tag-red';
        case '결재중': return 'kdb-tag-blue';
        case '임시저장': return 'kdb-tag-gray';
        default: return 'kdb-tag-gray';
    }
};

// 사업현황 상태별 태그 스타일
export const getProjectTagClass = (status: string) => {
    switch (status) {
        case '예산 신청': return 'kdb-tag-yellow';
        case '사전 협의': return 'kdb-tag-green';
        case '정실협 진행중': return 'kdb-tag-indigo';
        case '요건 상세화': return 'kdb-tag-purple';
        case '소요예산 산정': return 'kdb-tag-pink';
        case '과심위 진행중': return 'kdb-tag-orange';
        case '입찰/계약 진행중': return 'kdb-tag-cyan';
        case '사업 진행중': return 'kdb-tag-green';
        case '사업 완료': return 'kdb-tag-slate';
        case '대금지급 완료': return 'kdb-tag-teal';
        case '성과평가(대기)': return 'kdb-tag-rose';
        case '성과평가(완료)': return 'kdb-tag-gray';
        default: return 'kdb-tag-gray';
    }
};
