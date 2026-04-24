/**
 * ============================================================================
 * [useApprovalDashboard] 전자결재 대시보드 데이터 Composable
 * ============================================================================
 * 전자결재 대시보드 화면에서 필요한 통계 및 결재 대기 목록을 조회합니다.
 *
 * [백엔드 엔드포인트]
 *  GET /api/applications/dashboard
 *   → ApprovalDashboard (부서 통계 + 본인 결재 대기 목록)
 *
 *  GET /api/applications/approval-badge
 *   → ApprovalBadgeCount (사이드바 배지용 경량 건수)
 *
 * [쿼리 파라미터]
 *  - bbrC : 소속 부서코드 (부서 단위 통계 집계용)
 *  - eno  : 사원번호 (본인 결재 대기 목록 필터링용)
 *
 * [특징]
 *  - useApiFetch 사용 → 토큰 자동 주입 + 401 재인증 처리
 *  - computed query → user 변경 시 자동 재요청
 *  - 대시보드와 배지용 엔드포인트를 분리하여 useFetch 키 충돌 방지
 * ============================================================================
 */

/**
 * [ApprovalMonthlyCount] 월별 완료 건수 인터페이스
 * 대시보드 월별 트렌드 차트에 사용됩니다.
 */
export interface ApprovalMonthlyCount {
    /** 연월 (YYYY-MM 형식) */
    month: string;
    /** 해당 월의 결재 완료 건수 */
    count: number;
}

/**
 * [ApprovalPendingItem] 결재 대기 항목 인터페이스
 * 대시보드 결재 대기 목록 테이블에 사용됩니다.
 */
export interface ApprovalPendingItem {
    /** 결재 관리 번호 */
    apfMngNo: string;
    /** 결재 안건 제목 */
    title: string;
    /** 요청자 이름 */
    requesterName: string;
    /** 요청 일시 (ISO 8601 형식) */
    requestedAt: string;
    /** 긴급 여부 ('urgent': 긴급, 'normal': 일반) */
    urgency: 'urgent' | 'normal';
}

/**
 * [ApprovalDashboard] 전자결재 대시보드 응답 인터페이스
 * 백엔드 ApprovalDashboardResponse와 구조가 일치합니다.
 */
export interface ApprovalDashboard {
    /** 결재 대기 건수 */
    pendingCount: number;
    /** 결재 진행 중 건수 */
    inProgressCount: number;
    /** 당월 결재 완료 건수 */
    monthlyCompletedCount: number;
    /** 반려 건수 */
    rejectedCount: number;
    /** 월별 완료 트렌드 (최근 N개월) */
    monthlyTrend: ApprovalMonthlyCount[];
    /** 본인 결재 대기 목록 */
    pendingList: ApprovalPendingItem[];
}

/**
 * [ApprovalBadgeCount] 사이드바 배지용 결재 현황 건수 인터페이스
 * 백엔드 ApprovalBadgeResponse와 구조가 일치합니다.
 */
export interface ApprovalBadgeCount {
    /** 결재 대기 건수 */
    pendingCount: number;
    /** 결재 진행 중 건수 */
    inProgressCount: number;
}

/**
 * 전자결재 대시보드 데이터 조회 Composable
 *
 * bbrC 기준 부서 통계와 eno 기준 본인 결재 대기 목록을 함께 반환합니다.
 * user 상태가 변경되면 computed query를 통해 자동으로 재요청됩니다.
 *
 * @returns useApiFetch 반환값 ({ data: ApprovalDashboard, pending, error, refresh })
 *
 * @example
 * const { data, pending, refresh } = useApprovalDashboard();
 * const pendingCount = computed(() => data.value?.pendingCount ?? 0);
 */
export const useApprovalDashboard = () => {
    // 인증된 사용자 정보 획득 (bbrC: 부서코드, eno: 사원번호)
    const { user } = useAuth();

    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/dashboard`;

    const { data, pending, refresh } = useApiFetch<ApprovalDashboard>(url, {
        // computed query: user 변경 시 자동으로 쿼리 파라미터 갱신 및 재요청
        query: computed(() => ({
            bbrC: user.value?.bbrC,
            eno: user.value?.eno
        }))
    });

    return { data, pending, refresh };
};

/**
 * 사이드바 배지용 결재 현황 건수 조회 Composable
 *
 * 대시보드 전체 데이터 대신 건수만 조회하여 데이터 전송량을 최소화합니다.
 * 별도 엔드포인트를 사용하여 useApprovalDashboard와 useFetch 키 충돌을 방지합니다.
 *
 * @returns 결재 대기/진행 건수 computed ref
 *   - pendingCount    : 결재 대기 건수
 *   - inProgressCount : 결재 진행 중 건수
 *
 * @example
 * const { pendingCount, inProgressCount } = useApprovalBadgeCount();
 * // 사이드바 배지에 표시
 * // <Badge :value="pendingCount" />
 */
export const useApprovalBadgeCount = () => {
    // 인증된 사용자 정보 획득 (bbrC: 부서코드, eno: 사원번호)
    const { user } = useAuth();

    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/approval-badge`;

    const { data } = useApiFetch<ApprovalBadgeCount>(url, {
        // computed query: user 변경 시 자동으로 쿼리 파라미터 갱신 및 재요청
        query: computed(() => ({
            bbrC: user.value?.bbrC,
            eno: user.value?.eno
        }))
    });

    /** 결재 대기 건수 (데이터 미수신 시 0 반환) */
    const pendingCount = computed(() => data.value?.pendingCount ?? 0);
    /** 결재 진행 중 건수 (데이터 미수신 시 0 반환) */
    const inProgressCount = computed(() => data.value?.inProgressCount ?? 0);

    return { pendingCount, inProgressCount };
};
