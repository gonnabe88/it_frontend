/**
 * ============================================================================
 * [useApprovals] 전자결재 관리 Composable
 * ============================================================================
 * 전자결재(신청서) 관련 API 호출을 담당하는 composable입니다.
 * Spring Boot 백엔드의 /api/applications 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchApprovals  : 전체 신청서 목록 조회
 *  - createApplication: 새 신청서 생성 (결재자 순서 포함)
 *  - bulkApprove     : 여러 신청서 일괄 승인/반려 처리
 *
 * [API 패턴]
 *  - 조회(GET): useApiFetch 사용 (자동 인증 + 반응형)
 *  - 변경(POST): $apiFetch 사용 (plugins/auth.ts 제공)
 * ============================================================================
 */

/**
 * [Approver] 결재자 정보 인터페이스
 * 단일 결재 라인(결재순번, 결재자, 결재상태 등)을 정의합니다.
 */
export interface Approver {
    dcdSqn: number;   // 결재순번 (결재 라인 내 처리 순서)
    dcdEno: string;   // 결재자 사원번호
    dcdTp: string;    // 결재유형 (승인/합의 등)
    dcdDt: string;    // 결재일자 (실제 결재가 이루어진 날짜)
    dcdOpnn: string;  // 결재의견 (결재자가 남긴 코멘트)
    dcdSts?: string;  // 결재상태 (승인 / 반려, optional)
}

/**
 * [Approval] 신청서 정보 인터페이스
 * 전자결재 신청서의 기본 정보 및 결재자 목록을 포함합니다.
 */
export interface Approval {
    apfNm: string;         // 신청서명 (예: "예산편성 신청")
    apfMngNo: string;      // 신청관리번호 (PK, 서버에서 채번)
    apfSts: string;        // 신청상태 (대기 / 진행중 / 완료 / 반려)
    rqsEno: string;        // 신청자 사원번호
    rqsDt: string;         // 신청일자
    rqsOpnn: string;       // 신청의견 (신청자가 작성한 사유)
    apfDtlCone?: string;   // 상세내용 (JSON 직렬화 문자열, optional)
    approvers: Approver[]; // 결재자 목록 (결재 순서대로 정렬)
}

/**
 * [BulkApprovalItem] 일괄 승인/반려 요청 항목 인터페이스
 * bulkApprove 요청 시 배열 요소로 사용됩니다.
 */
export interface BulkApprovalItem {
    apfMngNo: string; // 대상 신청관리번호
    dcdEno: string;   // 결재를 수행하는 사원번호
    dcdOpnn: string;  // 결재의견 (코멘트)
    dcdSts: string;   // 처리상태 (승인 / 반려)
}

/**
 * [CreateApplicationRequest] 신청서 생성 요청 인터페이스
 * 새 전자결재 신청서를 생성할 때 서버로 전송하는 데이터 구조입니다.
 */
export interface CreateApplicationRequest {
    apfNm: string;           // 신청서명
    apfDtlCone?: string;     // 상세내용 (JSON 문자열, optional)
    orcTbCd: string;         // 원본 테이블코드 (연관된 도메인 식별자)
    orcPkVl: string;         // 원본 테이블의 PK값
    orcSnoVl: string;        // 원본 테이블의 일련번호(sno) 값
    rqsEno: string;          // 신청자 사원번호
    rqsOpnn: string;         // 신청의견
    approverEnos: string[];  // 결재자 사원번호 목록 (배열 순서가 결재 순서)
}

/**
 * 전자결재 관리 Composable 함수
 *
 * @returns 전자결재 관련 API 함수 객체
 *   - fetchApprovals   : 신청서 목록 조회 (useApiFetch 반환값)
 *   - createApplication: 신청서 생성
 *   - bulkApprove      : 일괄 승인/반려
 */
export const useApprovals = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (nuxt.config.ts 및 .env 참조)
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/applications`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 전체 신청서 목록 조회
     *
     * @returns useApiFetch 반환값 ({ data: Approval[], pending, error, refresh })
     *
     * @example
     * const { data: approvals, pending } = fetchApprovals();
     */
    const fetchApprovals = () => {
        return useApiFetch<Approval[]>(API_BASE_URL);
    };

    /**
     * 새 전자결재 신청서 생성
     * 결재자 목록을 포함하여 신청서를 생성합니다.
     * 결재자 배열의 순서가 곧 결재 순서(결재라인)가 됩니다.
     *
     * @param request - 신청서 생성 요청 데이터 (CreateApplicationRequest)
     * @returns 생성된 Approval 객체
     *
     * @example
     * await createApplication({
     *   apfNm: '예산편성 신청',
     *   rqsEno: '10001',
     *   rqsOpnn: '2026년도 IT 예산 편성 신청드립니다.',
     *   approverEnos: ['20001', '30001'],
     *   orcTbCd: 'IT_PRJ', orcPkVl: 'PRJ-001', orcSnoVl: '1'
     * });
     */
    const createApplication = async (request: CreateApplicationRequest) => {
        return await $apiFetch<Approval>(API_BASE_URL, {
            method: 'POST',
            body: request
        });
    };

    /**
     * 여러 신청서 일괄 승인/반려 처리
     * 한 번의 요청으로 복수의 신청서를 처리합니다.
     *
     * @param approvals - 일괄 처리 항목 배열 (BulkApprovalItem[])
     * @returns 서버 처리 결과
     *
     * @example
     * await bulkApprove([
     *   { apfMngNo: 'APF-001', dcdEno: '20001', dcdOpnn: '승인합니다.', dcdSts: '승인' },
     *   { apfMngNo: 'APF-002', dcdEno: '20001', dcdOpnn: '반려합니다.', dcdSts: '반려' }
     * ]);
     */
    const bulkApprove = async (approvals: BulkApprovalItem[]) => {
        return await $apiFetch(`${API_BASE_URL}/bulk-approve`, {
            method: 'POST',
            body: {
                approvals
            }
        });
    };

    return {
        fetchApprovals,
        createApplication,
        bulkApprove
    };
};
