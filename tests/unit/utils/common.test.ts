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
