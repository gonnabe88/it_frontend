
// Type Definitions
export interface Project {
    prjNm: string;
    prjTp: string;
    svnDpm: string;
    itDpm: string;
    prjBg: number;
    sttDt: string;
    endDt: string;
    prjSts: string;
    prjMngNo: string;
}

export interface ProjectDetail extends Project {
    bzDtt: string; // 업무구분
    dplYn: string; // 중복여부
    edrt: string; // 전결권
    hrfPln: string; // 향후계획
    itDpmCgpr: string;
    itDpmTlr: string;
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
    svnDpmCgpr: string;
    svnDpmTlr: string;
    tchnTp: string; // 기술유형
    xptEff: string; // 기대효과
}

export const useProjects = () => {
    const API_BASE_URL = 'http://localhost:8080/api/projects';

    // List
    const fetchProjects = () => {
        return useFetch<Project[]>(API_BASE_URL);
    };

    // Detail
    const fetchProject = (id: string | number) => {
        return useFetch<ProjectDetail>(`${API_BASE_URL}/${id}`);
    };

    // Create
    const createProject = async (payload: any) => {
        return await $fetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    // Update
    const updateProject = async (id: string | number, payload: any) => {
        return await $fetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    return {
        fetchProjects,
        fetchProject,
        createProject,
        updateProject
    };
};
