/**
 * ============================================================================
 * [types/budgetStatus.ts] 예산 현황 관련 타입 정의
 * ============================================================================
 * 예산 현황 화면의 3개 탭(정보화사업/전산업무비/경상사업) 응답 타입을 정의합니다.
 * 백엔드 BudgetStatusDto의 record 구조와 1:1 매핑됩니다.
 *
 * 사용 파일:
 *  - pages/budget/status.vue : 예산 현황 페이지
 *  - composables/useBudgetStatus.ts : API 호출 composable
 *
 * // Design Ref: §4.9 — types/budgetStatus.ts
 * ============================================================================
 */

/**
 * [ProjectStatusItem] 정보화사업 예산 현황 응답
 * GET /api/budget/status/projects 의 응답 아이템 타입
 */
export interface ProjectStatusItem {
    prjMngNo: string
    prjTp: string
    pulDtt: string
    prjNm: string
    prjDes: string
    svnHdq: string
    svnDpm: string
    svnDpmNm: string | null
    svnDpmTlr: string
    svnDpmTlrNm: string | null
    svnDpmCgpr: string
    svnDpmCgprNm: string | null
    itDpm: string
    itDpmNm: string | null
    itDpmTlr: string
    itDpmTlrNm: string | null
    itDpmCgpr: string
    itDpmCgprNm: string | null
    prjPulPtt: number | null
    sttDt: string
    endDt: string
    rprSts: string
    edrt: string
    // 편성요청 금액
    reqDevBg: number
    reqMachBg: number
    reqIntanBg: number
    reqAssetBg: number
    reqRentBg: number
    reqTravelBg: number
    reqServiceBg: number
    reqMiscBg: number
    reqCostBg: number
    reqTotalBg: number
    // 조정(편성) 금액
    adjDevBg: number | null
    adjMachBg: number | null
    adjIntanBg: number | null
    adjAssetBg: number | null
    adjRentBg: number | null
    adjTravelBg: number | null
    adjServiceBg: number | null
    adjMiscBg: number | null
    adjCostBg: number | null
    adjTotalBg: number | null
}

/**
 * [CostStatusItem] 전산업무비 예산 현황 응답
 * GET /api/budget/status/costs 의 응답 아이템 타입
 */
export interface CostStatusItem {
    itMngcNo: string
    pulDtt: string
    abusC: string
    ioeC: string
    biceDpm: string
    biceTem: string
    cttNm: string
    cttOpp: string
    infPrtYn: string
    itMngcTp: string
    // 편성요청 금액
    reqRentBg: number
    reqTravelBg: number
    reqServiceBg: number
    reqMiscBg: number
    reqTotalBg: number
    // 조정(편성) 금액
    adjRentBg: number | null
    adjTravelBg: number | null
    adjServiceBg: number | null
    adjMiscBg: number | null
    adjTotalBg: number | null
}

/**
 * [OrdinaryStatusItem] 경상사업 예산 현황 응답
 * GET /api/budget/status/ordinary 의 응답 아이템 타입
 */
export interface OrdinaryStatusItem {
    prjMngNo: string
    pulDtt: string
    prjNm: string
    prjDes: string
    // 기계장치
    machCur: string | null
    machQtt: number
    machUnitPrice: number
    machAmt: number
    machAmtKrw: number
    // 기타무형자산
    intanCur: string | null
    intanQtt: number
    intanUnitPrice: number
    intanAmt: number
    intanAmtKrw: number
}

/**
 * [ColumnDef] 컬럼 정의 인터페이스
 * 테이블 동적 컬럼 렌더링에 사용
 */
export interface ColumnDef {
    field: string
    header: string
    group?: string
    align?: 'left' | 'center' | 'right'
    width?: number
    isCurrency?: boolean
}
