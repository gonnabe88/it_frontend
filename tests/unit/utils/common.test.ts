/**
 * ============================================================================
 * [tests/unit/utils/common.test.ts] 공통 유틸 함수 단위 테스트
 * ============================================================================
 * utils/common.ts의 순수 함수들을 테스트합니다.
 * Vue/Nuxt 의존성이 없는 순수 TypeScript 함수이므로 Mock 없이 직접 테스트합니다.
 */
import { describe, it, expect } from 'vitest';
import {
    formatBudget,
    getApprovalTagClass,
    getProjectTagClass,
    getCostTagClass,
    getApprovalAuthority,
    getApprovalAuthorityBasis,
    formatDateTime,
    formatFileSize,
    getCouncilTagClass,
    getHearingTypeLabel,
    formatApiError,
    formatKoreanDate,
    PROJECT_STAGES,
    COST_STAGES,
} from '~/utils/common';

// ============================================================================
// formatBudget - 예산 금액 단위 변환 함수
// ============================================================================
describe('formatBudget', () => {
    // --- 단위 변환 정확성 ---
    it('천원 단위로 변환한다 (소수점 없음)', () => {
        expect(formatBudget(1500000, '천원')).toBe('1,500');
    });

    it('백만원 단위로 변환하고 소수점 1자리를 표시한다', () => {
        expect(formatBudget(1500000, '백만원')).toBe('1.5');
    });

    it('억원 단위로 변환하고 소수점 1자리를 표시한다', () => {
        expect(formatBudget(150000000, '억원')).toBe('1.5');
    });

    it('원 단위는 변환 없이 천 단위 구분자만 적용한다', () => {
        expect(formatBudget(1500, '원')).toBe('1,500');
    });

    // --- 엣지 케이스 ---
    it('0원은 0으로 반환한다', () => {
        expect(formatBudget(0, '천원')).toBe('0');
    });

    it('알 수 없는 단위는 원 단위처럼 처리한다 (변환 없음)', () => {
        // switch 기본값 없음 → amount 그대로, fractionDigits=0
        expect(formatBudget(1500, '달러')).toBe('1,500');
    });

    it('정확히 1억원은 억원 단위로 "1"을 반환한다', () => {
        expect(formatBudget(100000000, '억원')).toBe('1');
    });
});

// ============================================================================
// getApprovalTagClass - 결재 상태별 CSS 클래스 반환 함수
// ============================================================================
describe('getApprovalTagClass', () => {
    it.each([
        ['결재완료', 'kdb-tag-green'],
        ['반려',     'kdb-tag-red'],
        ['결재중',   'kdb-tag-blue'],
        ['임시저장', 'kdb-tag-gray'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getApprovalTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getApprovalTagClass('미정의상태')).toBe('kdb-tag-gray');
    });

    it('빈 문자열은 기본 gray 클래스를 반환한다', () => {
        expect(getApprovalTagClass('')).toBe('kdb-tag-gray');
    });
});

// ============================================================================
// getProjectTagClass - 정보화사업 상태별 CSS 클래스 반환 함수
// ============================================================================
describe('getProjectTagClass', () => {
    it.each([
        ['예산 작성',    'kdb-tag-yellow'],
        ['사전 협의',    'kdb-tag-green'],
        ['정실협',       'kdb-tag-indigo'],
        ['요건 상세화',  'kdb-tag-purple'],
        ['소요예산 산정','kdb-tag-pink'],
        ['과심위',       'kdb-tag-orange'],
        ['입찰/계약',    'kdb-tag-cyan'],
        ['사업 추진',    'kdb-tag-green'],
        ['예산배정',     'kdb-tag-teal'],
        ['대금지급',     'kdb-tag-teal'],
        ['성과평가',     'kdb-tag-rose'],
        ['완료',         'kdb-tag-slate'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getProjectTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getProjectTagClass('없는상태')).toBe('kdb-tag-gray');
    });
});

// ============================================================================
// getCostTagClass - 전산업무비 상태별 CSS 클래스 반환 함수
// ============================================================================
describe('getCostTagClass', () => {
    it.each([
        ['예산 작성', 'kdb-tag-yellow'],
        ['과심위',    'kdb-tag-orange'],
        ['입찰/계약', 'kdb-tag-cyan'],
        ['사업 추진', 'kdb-tag-green'],
        ['예산배정',  'kdb-tag-teal'],
        ['대금지급',  'kdb-tag-teal'],
        ['완료',      'kdb-tag-slate'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getCostTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getCostTagClass('없는상태')).toBe('kdb-tag-gray');
    });
});

// ============================================================================
// getApprovalAuthority - 전결권자 계산 함수
// ============================================================================
describe('getApprovalAuthority', () => {
    // --- 자본예산 기준 ---
    it('자본예산 20억 이상은 회장이다', () => {
        expect(getApprovalAuthority(2000000000, 0)).toBe('회장');
    });

    it('자본예산 10억 이상은 전무이사이다', () => {
        expect(getApprovalAuthority(1000000000, 0)).toBe('전무이사');
    });

    it('자본예산 5억 이상은 부문장이다', () => {
        expect(getApprovalAuthority(500000000, 0)).toBe('부문장');
    });

    it('자본예산 2억 이상은 지역본부장이다', () => {
        expect(getApprovalAuthority(200000000, 0)).toBe('지역본부장');
    });

    it('자본예산 2억 미만은 부장이다', () => {
        expect(getApprovalAuthority(100000000, 0)).toBe('부장');
    });

    // --- 일반관리비 기준 ---
    it('일반관리비 5억 이상은 회장이다', () => {
        expect(getApprovalAuthority(0, 500000000)).toBe('회장');
    });

    it('일반관리비 3억 이상은 전무이사이다', () => {
        expect(getApprovalAuthority(0, 300000000)).toBe('전무이사');
    });

    // --- 두 기준 중 높은 등급 적용 ---
    it('자본예산(부장)보다 일반관리비(회장)가 높으면 회장을 반환한다', () => {
        expect(getApprovalAuthority(0, 500000000)).toBe('회장');
    });

    it('두 기준이 같은 등급이면 해당 등급을 반환한다', () => {
        // 자본예산 20억(회장), 일반관리비 5억(회장)
        expect(getApprovalAuthority(2000000000, 500000000)).toBe('회장');
    });

    it('두 금액 모두 0이면 부장이다', () => {
        expect(getApprovalAuthority(0, 0)).toBe('부장');
    });
});

// ============================================================================
// getApprovalAuthorityBasis - 전결 기준 레이블·금액 반환 함수
// ============================================================================
describe('getApprovalAuthorityBasis', () => {
    it('자본예산 레벨이 더 높으면 자본예산 기준을 반환한다', () => {
        // 자본예산 5억(부문장=2) > 일반관리비 3천만(지역본부장=1)
        const result = getApprovalAuthorityBasis(500000000, 30000000);
        expect(result.label).toBe('자본예산');
        expect(result.amount).toBe(500000000);
    });

    it('일반관리비 레벨이 더 높으면 일반관리비 기준을 반환한다', () => {
        // 일반관리비 5억(회장=4) > 자본예산 2억(지역본부장=1)
        const result = getApprovalAuthorityBasis(200000000, 500000000);
        expect(result.label).toBe('일반관리비');
        expect(result.amount).toBe(500000000);
    });

    it('두 레벨이 같으면 자본예산 기준을 반환한다 (동순위 자본예산 우선)', () => {
        // 자본예산 20억(회장=4) = 일반관리비 5억(회장=4) → 자본예산 우선
        const result = getApprovalAuthorityBasis(2000000000, 500000000);
        expect(result.label).toBe('자본예산');
        expect(result.amount).toBe(2000000000);
    });

    it('두 금액이 0이면 자본예산 기준을 반환한다', () => {
        const result = getApprovalAuthorityBasis(0, 0);
        expect(result.label).toBe('자본예산');
        expect(result.amount).toBe(0);
    });
});

// ============================================================================
// formatDateTime - 날짜/시간 한국어 포맷 함수
// ============================================================================
describe('formatDateTime', () => {
    it('null을 받으면 빈 문자열을 반환한다', () => {
        expect(formatDateTime(null)).toBe('');
    });

    it('undefined를 받으면 빈 문자열을 반환한다', () => {
        expect(formatDateTime(undefined)).toBe('');
    });

    it('빈 문자열을 받으면 빈 문자열을 반환한다', () => {
        expect(formatDateTime('')).toBe('');
    });

    it('유효한 ISO 날짜 문자열은 비어있지 않은 문자열을 반환한다', () => {
        const result = formatDateTime('2026-04-01T09:00:00');
        expect(result).not.toBe('');
        expect(typeof result).toBe('string');
    });
});

// ============================================================================
// formatFileSize - 파일 크기 포맷 함수
// ============================================================================
describe('formatFileSize', () => {
    it('null을 받으면 빈 문자열을 반환한다', () => {
        expect(formatFileSize(null)).toBe('');
    });

    it('undefined를 받으면 빈 문자열을 반환한다', () => {
        expect(formatFileSize(undefined)).toBe('');
    });

    it('0 bytes는 "0 B"를 반환한다', () => {
        expect(formatFileSize(0)).toBe('0 B');
    });

    it('1024 bytes는 "1 KB"를 반환한다', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('1536 bytes(1.5KB)는 "1.5 KB"를 반환한다', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('1048576 bytes는 "1 MB"를 반환한다', () => {
        expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('1572864 bytes(1.5MB)는 "1.5 MB"를 반환한다', () => {
        expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('1073741824 bytes는 "1 GB"를 반환한다', () => {
        expect(formatFileSize(1073741824)).toBe('1 GB');
    });
});

// ============================================================================
// getCouncilTagClass - 협의회 상태 CSS 클래스 반환 함수
// ============================================================================
describe('getCouncilTagClass', () => {
    it.each([
        ['DRAFT',           'kdb-tag-gray'],
        ['SUBMITTED',       'kdb-tag-yellow'],
        ['APPROVAL_PENDING','kdb-tag-blue'],
        ['APPROVED',        'kdb-tag-teal'],
        ['PREPARING',       'kdb-tag-indigo'],
        ['SCHEDULED',       'kdb-tag-purple'],
        ['IN_PROGRESS',     'kdb-tag-orange'],
        ['EVALUATING',      'kdb-tag-pink'],
        ['RESULT_WRITING',  'kdb-tag-cyan'],
        ['RESULT_REVIEW',   'kdb-tag-rose'],
        ['FINAL_APPROVAL',  'kdb-tag-blue'],
        ['COMPLETED',       'kdb-tag-green'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getCouncilTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getCouncilTagClass('UNKNOWN_STATUS')).toBe('kdb-tag-gray');
    });

    it('빈 문자열은 기본 gray 클래스를 반환한다', () => {
        expect(getCouncilTagClass('')).toBe('kdb-tag-gray');
    });
});

// ============================================================================
// getHearingTypeLabel - 심의유형 코드 → 한글 레이블 변환 함수
// ============================================================================
describe('getHearingTypeLabel', () => {
    it('INFO_SYS는 "정보시스템"을 반환한다', () => {
        expect(getHearingTypeLabel('INFO_SYS')).toBe('정보시스템');
    });

    it('INFO_SEC는 "정보보호"를 반환한다', () => {
        expect(getHearingTypeLabel('INFO_SEC')).toBe('정보보호');
    });

    it('ETC는 "기타"를 반환한다', () => {
        expect(getHearingTypeLabel('ETC')).toBe('기타');
    });

    it('null을 받으면 "-"를 반환한다', () => {
        expect(getHearingTypeLabel(null)).toBe('-');
    });

    it('undefined를 받으면 "-"를 반환한다', () => {
        expect(getHearingTypeLabel(undefined)).toBe('-');
    });

    it('알 수 없는 코드는 "-"를 반환한다', () => {
        expect(getHearingTypeLabel('UNKNOWN')).toBe('-');
    });
});

// ============================================================================
// formatApiError - API 에러 메시지 정제 함수
// ============================================================================
describe('formatApiError', () => {
    it('Oracle 에러 코드(ORA-XXXXX)가 포함된 경우 ORA 코드와 설명만 추출한다', () => {
        const raw = "could not execute statement [ORA-00001: 무결성 제약 조건(TEST.PK_TEST)에 위배됩니다] [insert into test values ...]";
        const result = formatApiError(raw);
        expect(result).toContain('ORA-00001');
        expect(result).not.toContain('[insert into');
    });

    it('200자 이하 일반 메시지는 그대로 반환한다', () => {
        const msg = '서버 오류가 발생했습니다.';
        expect(formatApiError(msg)).toBe(msg);
    });

    it('200자 초과 일반 메시지는 200자로 자르고 "..."를 붙인다', () => {
        const msg = 'a'.repeat(201);
        const result = formatApiError(msg);
        expect(result.length).toBe(203); // 200 + '...'
        expect(result.endsWith('...')).toBe(true);
    });

    it('정확히 200자 메시지는 그대로 반환한다 (경계값)', () => {
        const msg = 'b'.repeat(200);
        expect(formatApiError(msg)).toBe(msg);
    });

    it('여러 ORA 패턴 중 첫 번째만 추출한다', () => {
        const raw = '[ORA-12345: 첫 번째 에러] [ORA-67890: 두 번째 에러]';
        const result = formatApiError(raw);
        expect(result).toContain('ORA-12345');
    });
});

// ============================================================================
// formatKoreanDate - 날짜 한국어 형식 변환 함수
// ============================================================================
describe('formatKoreanDate', () => {
    it('특정 날짜를 "YYYY년 MM월 DD일" 형식으로 반환한다', () => {
        const result = formatKoreanDate(new Date('2026-01-15'));
        expect(result).toBe('2026년 01월 15일');
    });

    it('12월 31일을 올바르게 포맷한다', () => {
        const result = formatKoreanDate(new Date('2025-12-31'));
        expect(result).toBe('2025년 12월 31일');
    });

    it('월과 일이 한 자리인 경우 두 자리 패딩을 적용한다', () => {
        const result = formatKoreanDate(new Date('2026-04-05'));
        expect(result).toBe('2026년 04월 05일');
    });

    it('인수 없이 호출하면 오늘 날짜를 반환한다', () => {
        const result = formatKoreanDate();
        expect(result).toMatch(/^\d{4}년 \d{2}월 \d{2}일$/);
    });
});

// ============================================================================
// PROJECT_STAGES / COST_STAGES - 상수 배열
// ============================================================================
describe('PROJECT_STAGES', () => {
    it('12개 단계를 포함한다', () => {
        expect(PROJECT_STAGES).toHaveLength(12);
    });

    it('"예산 작성"이 첫 번째 단계이다', () => {
        expect(PROJECT_STAGES[0]).toBe('예산 작성');
    });

    it('"완료"가 마지막 단계이다', () => {
        expect(PROJECT_STAGES[PROJECT_STAGES.length - 1]).toBe('완료');
    });
});

describe('COST_STAGES', () => {
    it('7개 단계를 포함한다', () => {
        expect(COST_STAGES).toHaveLength(7);
    });

    it('"예산 작성"이 첫 번째 단계이다', () => {
        expect(COST_STAGES[0]).toBe('예산 작성');
    });

    it('"완료"가 마지막 단계이다', () => {
        expect(COST_STAGES[COST_STAGES.length - 1]).toBe('완료');
    });
});
