export interface Approver {
    dcdSqn: number; // 결재순번
    dcdEno: string; // 결재자 사원번호
    dcdTp: string; // 결재유형
    dcdDt: string; // 결재일자
    dcdOpnn: string; // 결재의견
}

export interface Approval {
    apfMngNo: string; // 신청관리번호
    apfSts: string; // 신청상태
    rqsEno: string; // 신청자 사원번호
    rqsDt: string; // 신청일자
    rqsOpnn: string; // 신청의견
    approvers: Approver[]; // 결재자 목록
}

export const useApprovals = () => {
    const API_BASE_URL = 'http://localhost:8080/api/applications';

    const fetchApprovals = () => {
        return useFetch<Approval[]>(API_BASE_URL);
    };

    return {
        fetchApprovals
    };
};
