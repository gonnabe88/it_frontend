/**
 * ============================================================================
 * [useDocumentDashboard] 요구사항 정의서 대시보드 Composable
 * ============================================================================
 * 로그인 사용자의 부서코드(bbrC) 기준 집계 데이터를 조회합니다.
 *
 * [백엔드 엔드포인트]
 *  GET /api/documents/dashboard?bbrC={bbrC}
 *   → DocumentDashboard (총 건수, 검토 중, 완료, 지연 + 월별 추이 + 최근 검토 목록)
 *
 *  GET /api/documents/badge-count?bbrC={bbrC}
 *   → DocumentBadgeCount (검토 진행 중 건수만 반환, 사이드바 배지 전용)
 *
 * [특징]
 *  - useApiFetch 사용 → 토큰 자동 주입 + 401 재인증 처리 + 반응형 데이터
 *  - 사이드바 배지는 전용 엔드포인트를 사용하여 대시보드 페이지와 useFetch 키 충돌 방지
 *  - bbrC는 computed로 감싸 로그인 상태 변경 시 자동 갱신
 * ============================================================================
 */

/**
 * [DocMonthlyCount] 월별 문서 등록 건수
 */
export interface DocMonthlyCount {
    /** 연월 (YYYY-MM) */
    month: string;
    /** 해당 월 등록 건수 */
    count: number;
}

/**
 * [DocReviewingItem] 검토 진행 중 문서 목록 항목
 */
export interface DocReviewingItem {
    /** 문서 관리 번호 */
    docMngNo: string;
    /** 문서 제목 */
    title: string;
    /** 작성자 이름 */
    authorName: string;
    /** 등록 일시 (ISO 8601) */
    createdAt: string;
    /** 검토 상태 (검토중 | 지연) */
    status: 'reviewing' | 'delayed';
}

/**
 * [DocumentDashboard] 요구사항 정의서 대시보드 집계 응답
 * 백엔드 DocumentDashboardResponse와 구조가 일치합니다.
 */
export interface DocumentDashboard {
    /** 전체 문서 건수 */
    totalCount: number;
    /** 검토 진행 중 건수 */
    reviewingCount: number;
    /** 검토 완료 건수 */
    completedCount: number;
    /** 지연(기한 초과) 건수 */
    overdueCount: number;
    /** 최근 6개월 월별 등록 추이 */
    monthlyTrend: DocMonthlyCount[];
    /** 최근 검토 진행 중 문서 목록 */
    recentReviewing: DocReviewingItem[];
}

/**
 * [DocumentBadgeCount] 사이드바 배지용 검토 진행 중 건수 응답
 * 전체 대시보드 대신 건수만 반환하여 데이터 전송량을 최소화합니다.
 */
export interface DocumentBadgeCount {
    /** 검토 진행 중 문서 건수 */
    reviewingCount: number;
}

/**
 * 요구사항 정의서 대시보드 데이터 조회 Composable
 *
 * 로그인 사용자의 bbrC 기준 집계 데이터를 가져옵니다.
 * 페이지 진입 시 자동으로 데이터를 불러오며, refresh()로 수동 갱신도 가능합니다.
 *
 * @returns { data, pending, refresh }
 *   - data   : DocumentDashboard 집계 데이터 (ref)
 *   - pending: 요청 진행 중 여부 (ref<boolean>)
 *   - refresh: 수동 재조회 함수
 *
 * @example
 * const { data, pending, refresh } = useDocumentDashboard();
 * const total = computed(() => data.value?.totalCount ?? 0);
 */
export const useDocumentDashboard = () => {
    // 로그인 사용자 정보에서 부서코드(bbrC) 추출
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/documents/dashboard`;

    // useApiFetch 사용 → 토큰 자동 주입 + 반응형 갱신
    // query를 computed로 감싸 user 변경 시 자동으로 파라미터 업데이트
    const { data, pending, refresh } = useApiFetch<DocumentDashboard>(
        url,
        { query: computed(() => ({ bbrC: user.value?.bbrC })) }
    );

    return { data, pending, refresh };
};

/**
 * 사이드바 배지용 검토 진행 중 문서 수 조회 Composable
 *
 * 별도 엔드포인트(/api/documents/badge-count)를 사용하여
 * 대시보드 페이지(/api/documents/dashboard)와 useFetch 키 충돌을 방지합니다.
 *
 * @returns { reviewingCount }
 *   - reviewingCount: 검토 진행 중 건수 (computed<number>, 미조회 시 0)
 *
 * @example
 * const { reviewingCount } = useDocumentBadgeCount();
 * // 사이드바 배지: <Badge :value="reviewingCount" />
 */
export const useDocumentBadgeCount = () => {
    // 로그인 사용자 정보에서 부서코드(bbrC) 추출
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/documents/badge-count`;

    // 전용 집계 API 호출 → 건수만 반환하여 데이터 전송량 최소화
    const { data } = useApiFetch<DocumentBadgeCount>(
        url,
        { query: computed(() => ({ bbrC: user.value?.bbrC })) }
    );

    // null 안전 처리: 데이터 미수신 시 0 반환
    const reviewingCount = computed(() => data.value?.reviewingCount ?? 0);

    return { reviewingCount };
};
