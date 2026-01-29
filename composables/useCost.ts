// Type Definitions
export interface ItCost {
    itMngcNo?: string; // 전산업무비코드 (IT관리비관리번호)
    itMngcSno?: number; // 전산업무비일련번호 (IT관리비일련번호)
    lstYn?: string; // 최종여부
    ioeNm: string; // 비목명
    cttNm: string; // 계약명
    cttTp: string; // 계약구분
    cttOpp: string; // 계약상대처
    itMngcBg: number; // 전산업무비예산
    dfrCle: string; // 지급주기
    fstDfrDt: string | Date; // 지급예정월(최초지급일자)
    cur: string; // 통화
    xcr?: number; // 환율
    xcrBseDt?: string; // 환율기준일자
    infPrtYn: string; // 정보보호여부
    indRsn: string; // 증감사유
    pulCgpr: string; // 추진담당자
    delYn?: string; // 삭제여부
}

export const useCost = () => {
    const API_BASE_URL = 'http://localhost:8080/api/cost';
    const { $apiFetch } = useNuxtApp();

    // List - useApi 사용 (자동 인증 및 토큰 갱신)
    const fetchCosts = () => {
        return useApi<ItCost[]>(API_BASE_URL);
    };

    // Detail - useApi 사용
    const fetchCost = (id: string) => {
        return useApi<ItCost>(`${API_BASE_URL}/${id}`);
    };

    // Bulk Get - $apiFetch 사용
    const fetchCostsBulk = async (itMngcNos: string[]) => {
        return await $apiFetch<ItCost[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: {
                itMngcNos
            }
        });
    };

    // Create - $apiFetch 사용
    const createCost = async (payload: ItCost) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    // Update - $apiFetch 사용
    const updateCost = async (id: string, payload: ItCost) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    // Delete - $apiFetch 사용
    const deleteCost = async (id: string) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE'
        });
    };

    return {
        fetchCosts,
        fetchCost,
        fetchCostsBulk,
        createCost,
        updateCost,
        deleteCost
    };
};
