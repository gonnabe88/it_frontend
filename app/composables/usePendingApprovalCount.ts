/**
 * ============================================================================
 * [usePendingApprovalCount] 미상신(결재 대기) 건수 조회 Composable
 * ============================================================================
 * 사이드바 [결재 상신] 메뉴 배지에 표시할 미상신 건수를 조회합니다.
 *
 * [배경]
 *  기존에는 사이드바와 /budget/approval 페이지가 동일한 URL
 *  (GET /api/projects?apfSts=none, GET /api/cost?apfSts=none)을 호출하여
 *  새로고침 시 중복 요청으로 인한 네트워크 오류 토스트가 발생했습니다.
 *  사이드바는 건수만 필요하므로 전용 집계 API로 분리하여 URL 충돌을 제거합니다.
 *
 * [백엔드 엔드포인트]
 *  GET /api/applications/pending-count
 *   → { projectCount: number, costCount: number, totalCount: number }
 *
 * [특징]
 *  - 전체 목록 대신 건수(count)만 반환 → 데이터 전송량 최소화
 *  - useApiFetch 사용 → 자동 인증 + 반응형 데이터
 *  - 사이드바 전용 URL이므로 다른 화면과 중복 없음
 * ============================================================================
 */

/**
 * [PendingApprovalCount] 미상신 건수 응답 인터페이스
 * 백엔드 ApplicationDto.PendingCountResponse와 구조가 일치합니다.
 */
export interface PendingApprovalCount {
    /** 미상신 정보화사업 건수 */
    projectCount: number;
    /** 미상신 전산업무비 건수 */
    costCount: number;
    /** 전체 미상신 건수 (projectCount + costCount) */
    totalCount: number;
}

/**
 * 미상신 건수 조회 Composable
 *
 * @returns useApiFetch 반환값 ({ data: PendingApprovalCount, pending, error, refresh })
 *
 * @example
 * const { data } = usePendingApprovalCount();
 * const badge = computed(() => data.value?.totalCount ?? 0);
 */
export const usePendingApprovalCount = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (nuxt.config.ts 및 .env 참조)
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/pending-count`;

    // useApiFetch 사용 → 토큰 자동 주입 + 401 재인증 처리
    return useApiFetch<PendingApprovalCount>(url);
};
