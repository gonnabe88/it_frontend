
// Type Definitions
export interface Project {
    prjMngNo: string; // 프로젝트관리번호
    prjNm: string; // 프로젝트명
    prjTp: string; // 프로젝트유형
    svnDpm: string; // 주관부서
    itDpm: string; // 담당부서
    prjBg: number; // 프로젝트규모
    sttDt: string; // 시작일
    endDt: string; // 종료일
    prjSts: string; // 프로젝트상태
    bgYy: number; // 예산년도
    svnHdq: string; // 주관부문 및 부서
    apfSts: string; // 결재현황
}

// 품목(Item) 인터페이스 정의
export interface ProjectItem {
    gclMngNo?: string; // 품목관리번호 (PK)
    gclSno?: number; // 품목순번
    gclDtt: string; // 품목구분 (Category: 개발비, 기계장치 등)
    gclNm: string; // 품목명 (Item Name)
    gclQtt: number; // 수량 (Quantity)
    cur: string; // 통화 (Currency: KRW, USD ...)
    xcr?: number; // 환율 (Exchange Rate)
    xcrBseDt?: string; // 환율기준일
    bgFdtn: string; // 예산산출근거 (Basis)
    itdDt?: string; // 도입시기 (Intro Date)
    dfrCle?: string; // 지급주기 (Payment Cycle)
    infPrtYn: string; // 정보보호여부 (Y/N)
    itrInfrYn: string; // 통합인프라여부 (Y/N)
    lstYn?: string; // 최종여부
    upr?: number; // 단가 (Unit Price) - UI 연동용 추가
    gclAmt?: number; // 소계/금액 (Amount) - UI 연동용 추가
}

export interface ProjectDetail extends Project {
    bzDtt: string; // 업무구분
    dplYn: string; // 중복여부
    edrt: string; // 전결권
    hrfPln: string; // 향후계획
    itDpmCgpr: string; // IT담당자
    itDpmTlr: string; // IT담당팀장
    lblFsgTlm: string; // 의무완료기한
    mnUsr: string; // 주요사용자
    ncs: string; // 필요성
    plm: string; // 문제
    prjDes: string; // 사업설명
    prjPulPtt: string; // 프로젝트추진가능성
    prjRng: string; // 사업범위
    pulPsg: string; // 추진경과
    pulRsn: string; // 추진사유
    rprSts: string; // 보고상태
    saf: string; // 현황
    svnDpmCgpr: string; // 주관부문 및 부서 담당자
    svnDpmTlr: string; // 주관부문 및 부서 담당팀장
    tchnTp: string; // 기술유형
    xptEff: string; // 기대효과
    items?: ProjectItem[]; // 품목 정보 리스트
}

export const useProjects = () => {
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/projects`;
    const { $apiFetch } = useNuxtApp();

    // List - useApiFetch 사용 (자동 인증 및 토큰 갱신)
    const fetchProjects = () => {
        return useApiFetch<Project[]>(API_BASE_URL);
    };

    // Detail - useApiFetch 사용
    const fetchProject = (id: string | number) => {
        return useApiFetch<ProjectDetail>(`${API_BASE_URL}/${id}`);
    };

    // Bulk Get - $apiFetch 사용 (플러그인에서 제공하는 인증된 fetch)
    const fetchProjectsBulk = async (prjMngNos: string[]) => {
        return await $apiFetch<ProjectDetail[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: {
                prjMngNos
            }
        });
    };

    // Create - $apiFetch 사용
    const createProject = async (payload: any) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    // Update - $apiFetch 사용
    const updateProject = async (id: string | number, payload: any) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    // Delete - $apiFetch 사용
    const deleteProject = async (id: string | number) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE'
        });
    };

    return {
        fetchProjects,
        fetchProject,
        fetchProjectsBulk,
        createProject,
        updateProject,
        deleteProject
    };
};
