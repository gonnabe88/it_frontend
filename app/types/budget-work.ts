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
    /** 세부 비목명 (예: 국외전산임차료) */
    ioeCategory: string
    /** 실제 IOE 코드 (예: IOE-237-0100) */
    ioeC: string
    /** 편성비목 접두어 (예: IOE-237) */
    ioePrefix: string
    /** 편성비목 그룹명 (예: 전산임차료) */
    groupName: string
    /** 자본예산 여부 (true: 자본예산, false: 일반관리비) */
    capital: boolean
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

/**
 * [ProjectSummaryCategory] 편성비목 컬럼 헤더 정보
 * 동적 컬럼 생성용 (비목명 + 편성률)
 */
export interface ProjectSummaryCategory {
    /** 비목 접두어 */
    ioePrefix: string
    /** 비목명 */
    cdNm: string
    /** 편성률 (0~100) */
    dupRt: number
}

/**
 * [CategoryAmount] 비목별 금액
 */
export interface CategoryAmount {
    /** 요청금액 */
    requestAmount: number
    /** 편성금액 */
    dupAmount: number
}

/**
 * [ProjectSummaryItem] 사업별 편성 결과 요약 항목
 * ProjectSummaryResponse.data 배열의 아이템 타입
 */
export interface ProjectSummaryItem {
    /** 원본PK값 (프로젝트관리번호 또는 전산업무비관리번호) */
    orcPkVl: string
    /** 원본테이블 (BPROJM/BCOSTM) */
    orcTb: string
    /** 사업명/계약명 */
    name: string
    /** 요청금액 합계 */
    requestAmount: number
    /** 편성금액 합계 */
    dupAmount: number
    /** 비목별 금액 맵 (key: ioePrefix) */
    categoryAmounts: Record<string, CategoryAmount>
}

/**
 * [ProjectSummaryResponse] 사업별 편성 결과 요약 응답
 * GET /api/budget/work/project-summary 의 응답 타입
 */
export interface ProjectSummaryResponse {
    /** 편성비목 목록 (동적 컬럼 헤더용) */
    categories: ProjectSummaryCategory[]
    /** 사업별 요약 항목 목록 */
    data: ProjectSummaryItem[]
    /** 합계 */
    totals: {
        requestAmount: number
        dupAmount: number
    }
}
