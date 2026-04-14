/**
 * ============================================================================
 * [types/budget-work.ts] 예산 작업 관련 타입 정의
 * ============================================================================
 * 예산 편성률 적용(TAAABB_BBUGTM) 기능의 TypeScript 인터페이스를 정의합니다.
 * 백엔드 BudgetWorkDto의 record 구조와 1:1 매핑됩니다.
 *
 * 사용 파일:
 *  - pages/budget/work.vue : 예산 작업 페이지
 *
 * // Design Ref: §5.4 — 타입 정의
 * ============================================================================
 */

/**
 * [IoeCategoryResponse] 편성비목 목록 조회 응답
 * GET /api/budget/work/ioe-categories 의 응답 아이템 타입
 */
export interface IoeCategoryResponse {
    /** 편성비목 코드ID (예: DUP-IOE-237) */
    cdId: string
    /** 편성비목명 (예: 전산임차료(SW)) */
    cdNm: string
    /** 코드값 */
    cdva: string
    /** 비목 접두어 (IOE_C/GCL_DTT 매칭용, 예: 237) */
    prefix: string
    /** 기존 편성률 (0~100, 미적용 시 null) */
    dupRt: number | null
    /** 결재완료 요청금액 합계 */
    requestAmount: number
}

/**
 * [SummaryItem] 편성 결과 비목별 요약 항목
 * SummaryResponse.data 배열의 아이템 타입
 */
export interface SummaryItem {
    /** 비목명 */
    ioeCategory: string
    /** 비목 접두어 */
    ioePrefix: string
    /** 결재완료 요청금액 합계 */
    requestAmount: number
    /** 편성금액 합계 */
    dupAmount: number
    /** 편성률 (0~100) */
    dupRt: number
}

/**
 * [SummaryResponse] 편성 결과 요약 응답
 * GET /api/budget/work/summary 의 응답 타입
 */
export interface SummaryResponse {
    /** 비목별 요약 항목 목록 */
    data: SummaryItem[]
    /** 합계 */
    totals: {
        requestAmount: number
        dupAmount: number
    }
}

/**
 * [ApplyResponse] 편성률 적용 결과 응답
 * POST /api/budget/work/apply 의 응답 타입
 */
export interface ApplyResponse {
    /** 처리 결과 메시지 */
    message: string
    /** 처리된 총 레코드 수 */
    totalRecords: number
    /** 편성 결과 요약 */
    summary: SummaryResponse
}
