/**
 * ============================================================================
 * [usePlan] 정보기술부문 계획 관리 Composable
 * ============================================================================
 * IT 포털의 정보기술부문 계획에 대한 CRUD API 호출을 담당하는 composable입니다.
 * Spring Boot 백엔드의 /api/plans 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchPlans     : 계획 목록 조회 (요약 정보)
 *  - fetchPlan      : 단일 계획 상세 조회 (JSON 스냅샷 포함)
 *  - createPlan     : 새 계획 등록
 *  - deletePlan     : 계획 삭제 (논리 삭제)
 *
 * [API 패턴]
 *  - 조회(GET): useApiFetch 사용 (자동 인증 + 반응형 watch)
 *  - 변경(POST/DELETE): $apiFetch 사용 (plugins/auth.ts 제공)
 * ============================================================================
 */

/**
 * [Plan] 계획 목록 항목 인터페이스 (요약 정보)
 * 계획 조회 화면의 데이터테이블에서 사용됩니다.
 */
export interface Plan {
    plnMngNo: string;       // 계획관리번호 (PK, 예: PLN-2026-0001)
    plnTp: string;          // 계획구분 (신규, 조정)
    plnYy: string;          // 대상년도 (YYYY)
    ttlBg: number;          // 총예산
    cptBg: number;          // 자본예산
    mngc: number;           // 일반관리비
    fstEnrDtm: string;      // 최초생성시간 (ISO datetime)
    fstEnrUsid: string;     // 최초생성자 사번
}

/**
 * [PlanDetail] 계획 상세 인터페이스
 * 계획 상세 화면에서 JSON 스냅샷 및 프로젝트 목록을 포함합니다.
 */
export interface PlanDetail extends Plan {
    plnDtlCone: string;     // 계획세부내용 JSON 문자열 (스냅샷)
    prjMngNos: string[];    // 연결된 프로젝트관리번호 목록
}

/**
 * [PlanSnapshot] plnDtlCone JSON 파싱 결과 타입
 */
export interface PlanSnapshot {
    plnYy: string;
    plnTp: string;
    ttlBg: number;
    cptBg: number;
    mngc: number;
    projects: PlanProjectItem[];
    byDepartment: { svnHdq: string; projects: PlanProjectItem[] }[];
    byProjectType: { prjTp: string; projects: PlanProjectItem[] }[];
}

/**
 * [PlanProjectItem] 스냅샷 내 개별 프로젝트 정보
 */
export interface PlanProjectItem {
    prjMngNo: string;
    prjNm: string;
    prjTp: string;
    svnHdq: string;
    svnDpm: string;
    svnDpmNm: string;
    prjBg: number;
    assetBg: number;
    costBg: number;
    pulDtt?: string;    // 사업구분 (신규, 계속)
}

/**
 * [PlanCreateRequest] 계획 등록 요청 타입
 */
export interface PlanCreateRequest {
    plnYy: string;          // 대상년도 (YYYY)
    plnTp: string;          // 계획구분 (신규/조정)
    prjMngNos: string[];    // 대상 프로젝트관리번호 목록
    itMngcNos: string[];    // 대상 전산업무비관리번호 목록
}

/**
 * 정보기술부문 계획 관리 Composable 함수
 *
 * @returns 계획 관련 API 함수 객체
 */
export const usePlan = () => {
    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/plans`;

    // POST/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 계획 목록 조회 (요약 정보)
     * useApiFetch를 사용하여 자동 인증 및 토큰 갱신이 적용됩니다.
     *
     * @returns useApiFetch 반환값 ({ data: Plan[], pending, error, refresh })
     *
     * @example
     * const { data: plans } = fetchPlans();
     */
    const fetchPlans = () => {
        return useApiFetch<Plan[]>(API_BASE_URL);
    };

    /**
     * 단일 계획 상세 정보 조회
     * JSON 스냅샷(plnDtlCone)과 연결된 프로젝트 목록을 포함합니다.
     *
     * @param plnMngNo - 조회할 계획관리번호 (예: PLN-2026-0001)
     * @returns useApiFetch 반환값 ({ data: PlanDetail, pending, error, refresh })
     *
     * @example
     * const { data: plan } = fetchPlan('PLN-2026-0001');
     */
    const fetchPlan = (plnMngNo: string) => {
        return useApiFetch<PlanDetail>(`${API_BASE_URL}/${plnMngNo}`);
    };

    /**
     * 계획 등록
     * $apiFetch를 사용하는 일회성 POST 요청입니다.
     *
     * @param payload - 계획 등록 요청 데이터 (PlanCreateRequest)
     * @returns Promise (응답 없음, 성공 시 201 Created)
     *
     * @example
     * await createPlan({ plnYy: '2026', plnTp: '신규', prjMngNos: ['PRJ-2026-0001'] });
     */
    const createPlan = (payload: PlanCreateRequest) => {
        return $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload,
        });
    };

    /**
     * 계획 삭제 (논리 삭제)
     * $apiFetch를 사용하는 일회성 DELETE 요청입니다.
     *
     * @param plnMngNo - 삭제할 계획관리번호
     * @returns Promise (응답 없음, 성공 시 204 No Content)
     *
     * @example
     * await deletePlan('PLN-2026-0001');
     */
    const deletePlan = (plnMngNo: string) => {
        return $apiFetch(`${API_BASE_URL}/${plnMngNo}`, {
            method: 'DELETE',
        });
    };

    return {
        fetchPlans,
        fetchPlan,
        createPlan,
        deletePlan,
    };
};
