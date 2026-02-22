/**
 * ============================================================================
 * [useProjects] 프로젝트 관리 Composable
 * ============================================================================
 * IT 포털의 프로젝트 항목에 대한 CRUD API 호출을 담당하는 composable입니다.
 * Spring Boot 백엔드의 /api/projects 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchProjects     : 프로젝트 목록 조회 (요약 정보)
 *  - fetchProject      : 단일 프로젝트 상세 조회 (품목 포함)
 *  - fetchProjectsBulk : 복수 프로젝트 일괄 조회 (관리번호 배열)
 *  - createProject     : 새 프로젝트 생성
 *  - updateProject     : 기존 프로젝트 수정
 *  - deleteProject     : 프로젝트 삭제
 *
 * [API 패턴]
 *  - 조회(GET): useApiFetch 사용 (자동 인증 + 반응형 watch)
 *  - 변경(POST/PUT/DELETE): $apiFetch 사용 (plugins/auth.ts 제공)
 * ============================================================================
 */

/**
 * [Project] 프로젝트 목록 항목 인터페이스 (요약 정보)
 * 프로젝트 목록 화면(/pages/info/projects/index.vue)에서 사용됩니다.
 */
export interface Project {
    prjMngNo: string;  // 프로젝트관리번호 (PK, 서버에서 채번)
    prjNm: string;     // 프로젝트명
    prjTp: string;     // 프로젝트유형 (신규개발, 고도화, 유지보수 등)
    svnDpm: string;    // 주관부서 (프로젝트를 주도하는 현업 부서)
    itDpm: string;     // IT담당부서 (IT 측 담당 부서)
    prjBg: number;     // 프로젝트 예산 규모 (원 단위)
    sttDt: string;     // 시작일 (YYYY-MM-DD)
    endDt: string;     // 종료일 (YYYY-MM-DD)
    prjSts: string;    // 프로젝트 상태 (검토중, 진행중, 완료, 보류 등)
    bgYy: number;      // 예산년도 (YYYY)
    svnHdq: string;    // 주관부문 (상위 조직 단위)
    apfSts: string;    // 결재현황 (전자결재 신청 상태)
}

/**
 * [ProjectItem] 프로젝트 품목(예산 항목) 인터페이스
 * 프로젝트에 포함된 개별 예산 품목을 정의합니다.
 * ProjectDetail의 items 배열에 포함됩니다.
 */
export interface ProjectItem {
    gclMngNo?: string;   // 품목관리번호 (PK, 서버에서 채번, optional)
    gclSno?: number;     // 품목순번 (버전 관리용, optional)
    gclDtt: string;      // 품목구분 (개발비, 기계장치, 소프트웨어 등)
    gclNm: string;       // 품목명 (구체적인 항목 이름)
    gclQtt: number;      // 수량
    cur: string;         // 통화 (KRW, USD, EUR 등)
    xcr?: number;        // 환율 (외화 품목인 경우, optional)
    xcrBseDt?: string;   // 환율기준일 (환율 적용 기준 날짜, optional)
    bgFdtn: string;      // 예산산출근거 (단가 * 수량 등 산출 방법 설명)
    itdDt?: string;      // 도입시기 (YYYY-MM, optional)
    dfrCle?: string;     // 지급주기 (일시, 월별, 분기별 등, optional)
    infPrtYn: string;    // 정보보호여부 (Y: 정보보호 관련 / N: 일반)
    itrInfrYn: string;   // 통합인프라여부 (Y: 인프라 통합 항목 / N: 일반)
    lstYn?: string;      // 최종여부 (Y: 최신 / N: 이력, optional)
    upr?: number;        // 단가 (UI 연동용, optional)
    gclAmt?: number;     // 소계/금액 (UI 연동용, upr * gclQtt 계산값, optional)
}

/**
 * [ProjectDetail] 프로젝트 상세 정보 인터페이스
 * Project 기본 정보를 상속하며, 상세 화면에서만 필요한 추가 필드를 포함합니다.
 * 품목(items) 배열도 포함됩니다.
 */
export interface ProjectDetail extends Project {
    bzDtt: string;       // 업무구분 (업무 카테고리)
    dplYn: string;       // 중복여부 (타 프로젝트와의 중복 여부 Y/N)
    edrt: string;        // 전결권 (전결 가능한 결재 수준)
    hrfPln: string;      // 향후계획 (HTML 형식 가능)
    itDpmCgpr: string;   // IT 담당자 이름
    itDpmTlr: string;    // IT 담당팀장 이름
    lblFsgTlm: string;   // 의무완료기한 (법적/정책적 필수 완료 시점)
    mnUsr: string;       // 주요사용자 (시스템 주 사용 부서/대상)
    ncs: string;         // 필요성 (Needs, HTML 형식 가능)
    plm: string;         // 문제점 (현황의 문제점, HTML 형식 가능)
    prjDes: string;      // 사업내용 (Description, HTML 형식 가능)
    prjPulPtt: string;   // 추진가능성 (HTML 형식 가능)
    prjRng: string;      // 사업범위 (Scope, HTML 형식 가능)
    pulPsg: string;      // 추진경과 (HTML 형식 가능)
    pulRsn: string;      // 추진사유 (HTML 형식 가능)
    rprSts: string;      // 보고상태 (경영진 보고 여부)
    saf: string;         // 현황 (Situation As-Is, HTML 형식 가능)
    svnDpmCgpr: string;  // 주관부서 현업 담당자 이름
    svnDpmTlr: string;   // 주관부서 현업 담당팀장 이름
    tchnTp: string;      // 기술유형 (웹, 모바일, AI 등)
    xptEff: string;      // 기대효과 (Expected Effect, HTML 형식 가능)
    items?: ProjectItem[];// 품목 리스트 (예산 구성 항목, optional)
}

/**
 * 프로젝트 관리 Composable 함수
 *
 * @returns 프로젝트 관련 API 함수 객체
 */
export const useProjects = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (nuxt.config.ts 및 .env 참조)
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/projects`;

    // POST/PUT/DELETE 요청용 인증된 fetch 함수 (plugins/auth.ts에서 provide)
    const { $apiFetch } = useNuxtApp();

    /**
     * 프로젝트 목록 조회 (요약 정보)
     * useApiFetch를 사용하여 자동 인증 및 토큰 갱신이 적용됩니다.
     *
     * @returns useApiFetch 반환값 ({ data: Project[], pending, error, refresh })
     *
     * @example
     * const { data: projects, pending } = fetchProjects();
     */
    const fetchProjects = () => {
        return useApiFetch<Project[]>(API_BASE_URL);
    };

    /**
     * 단일 프로젝트 상세 정보 조회
     * 품목(items) 배열을 포함한 전체 상세 데이터를 반환합니다.
     *
     * @param id - 조회할 프로젝트관리번호 (prjMngNo) 또는 숫자 ID
     * @returns useApiFetch 반환값 ({ data: ProjectDetail, pending, error, refresh })
     *
     * @example
     * const { data: project } = fetchProject('PRJ-2026-001');
     */
    const fetchProject = (id: string | number) => {
        return useApiFetch<ProjectDetail>(`${API_BASE_URL}/${id}`);
    };

    /**
     * 복수 프로젝트 일괄 조회
     * 관리번호 배열을 POST 방식으로 전송하여 한 번에 여러 프로젝트를 조회합니다.
     * PDF 보고서 생성 등 여러 프로젝트의 상세 데이터가 필요한 경우 사용합니다.
     * (GET 쿼리스트링 길이 제한을 우회하기 위해 POST 사용)
     *
     * @param prjMngNos - 조회할 프로젝트관리번호 배열
     * @returns ProjectDetail 배열
     *
     * @example
     * const projects = await fetchProjectsBulk(['PRJ-001', 'PRJ-002', 'PRJ-003']);
     */
    const fetchProjectsBulk = async (prjMngNos: string[]) => {
        return await $apiFetch<ProjectDetail[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: {
                prjMngNos
            }
        });
    };

    /**
     * 새 프로젝트 생성
     * 품목(items) 배열을 포함한 전체 데이터를 한 번에 전송합니다.
     *
     * @param payload - 생성할 프로젝트 데이터 (ProjectDetail 포함 any 형식)
     * @returns 서버 처리 결과 (생성된 프로젝트 객체)
     *
     * @example
     * await createProject({ prjNm: '신규 ERP 시스템 구축', ... });
     */
    const createProject = async (payload: any) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    /**
     * 기존 프로젝트 정보 수정
     *
     * @param id      - 수정할 프로젝트관리번호 또는 숫자 ID
     * @param payload - 수정할 데이터 (변경된 필드만 포함 가능)
     * @returns 서버 처리 결과 (수정된 프로젝트 객체)
     *
     * @example
     * await updateProject('PRJ-2026-001', { prjSts: '진행중', endDt: '2026-12-31' });
     */
    const updateProject = async (id: string | number, payload: any) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    /**
     * 프로젝트 삭제
     * 서버에서는 실제 삭제 대신 소프트 삭제 처리될 수 있습니다.
     *
     * @param id - 삭제할 프로젝트관리번호 또는 숫자 ID
     * @returns 서버 처리 결과
     *
     * @example
     * await deleteProject('PRJ-2026-001');
     */
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
