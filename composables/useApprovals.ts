export interface Approver {
    dcdSqn: number; // 결재순번
    dcdEno: string; // 결재자 사원번호
    dcdTp: string; // 결재유형
    dcdDt: string; // 결재일자
    dcdOpnn: string; // 결재의견
    dcdSts?: string; // 결재상태 (승인/반려)
}

export interface Approval {
    apfNm: string; // 신청서명
    apfMngNo: string; // 신청관리번호
    apfSts: string; // 신청상태
    rqsEno: string; // 신청자 사원번호
    rqsDt: string; // 신청일자
    rqsOpnn: string; // 신청의견
    apfDtlCone?: string; // 상세내용 (JSON)
    approvers: Approver[]; // 결재자 목록
}

export interface BulkApprovalItem {
    apfMngNo: string;
    dcdEno: string;
    dcdOpnn: string;
    dcdSts: string; // 승인/반려 상태 추가
}

export interface CreateApplicationRequest {
    apfNm: string; // 신청서명
    apfDtlCone?: string; // 상세내용 (JSON)
    orcTbCd: string; // 원본 테이블코드
    orcPkVl: string; // 원본 테이블의 PK값
    orcSnoVl: string; // 원본 테이블의 sno값
    rqsEno: string; // 신청 사원번호
    rqsOpnn: string; // 신청의견
    approverEnos: string[]; // 결재자 사원번호 목록 (순서대로)
}

export const useApprovals = () => {
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/applications`;
    const { $apiFetch } = useNuxtApp();

    const fetchApprovals = () => {
        return useApiFetch<Approval[]>(API_BASE_URL);
    };

    // Create Application - 신청서 생성 (액션 함수는 $apiFetch 사용)
    const createApplication = async (request: CreateApplicationRequest) => {
        return await $apiFetch<Approval>(API_BASE_URL, {
            method: 'POST',
            body: request
        });
    };

    // Bulk Approve - 여러 신청서 일괄 승인 (액션 함수는 $apiFetch 사용)
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
