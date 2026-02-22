/**
 * ============================================================================
 * [useOrganization] 조직도 및 사용자 조회 Composable
 * ============================================================================
 * 부서(조직) 정보와 부서별 사용자 목록을 조회하고,
 * 평면(flat) 조직 목록을 트리 구조로 변환하는 기능을 제공합니다.
 * Spring Boot 백엔드의 /api/organizations, /api/users 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchOrganizations : 전체 부서(조직) 목록 조회
 *  - fetchUsers         : 특정 부서코드의 사용자 목록 조회
 *  - buildOrgTree       : 평면 조직 배열 → PrimeVue Tree 형식 변환
 *
 * [타입 명명 주의]
 *  - 이 파일의 OrgUser는 조직도 전용 사용자 타입입니다.
 *  - types/auth.ts의 User(eno, empNm) 타입과 이름 충돌을 피하기 위해 의도적으로
 *    OrgUser로 명명하였습니다.
 * ============================================================================
 */

/**
 * [Organization] 부서(조직) 정보 인터페이스
 * 서버에서 반환하는 조직 단위 데이터 구조입니다.
 */
export interface Organization {
    bbrNm: string;                   // 부서명 (조직의 표시 이름)
    prlmHrkOgzCCone: string | null;  // 상위부서코드 (최상위 부서의 경우 null)
    prlmOgzCCone: string;            // 부서코드 (고유 식별자)
}

/**
 * [OrgUser] 조직도용 사용자 정보 인터페이스
 * 부서에 소속된 사용자의 기본 정보를 정의합니다.
 *
 * ⚠️ types/auth.ts의 User 타입과 구별됩니다:
 *  - types/auth.ts의 User: { eno, empNm } (로그인/인증 전용)
 *  - 이 OrgUser: 조직도 조회용으로 더 많은 필드 포함
 */
export interface OrgUser {
    bbrNm: string;       // 부서명
    eno: string;         // 사원번호 (고유 식별자)
    ptCNm: string | null;// 직위/직급명 (예: 대리, 과장, null 가능)
    temNm: string | null;// 팀명 (팀 구조가 없는 경우 null)
    usrNm: string;       // 사용자 이름
}

/**
 * 조직도 및 사용자 조회 Composable 함수
 *
 * @returns 조직 관련 API 함수 및 유틸리티 객체
 *   - fetchOrganizations : 전체 부서 목록 조회 (useApiFetch 반환값)
 *   - fetchUsers         : 부서별 사용자 목록 조회 (useApiFetch 반환값)
 *   - buildOrgTree       : 평면 배열을 트리 구조로 변환하는 순수 함수
 */
export const useOrganization = () => {
    // runtimeConfig에서 API 베이스 URL 조회 (nuxt.config.ts 및 .env 참조)
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;

    /**
     * 전체 부서(조직) 목록 조회
     * 자동 인증 헤더가 적용된 useApiFetch를 사용합니다.
     *
     * @returns useApiFetch 반환값 ({ data: Organization[], pending, error, refresh })
     *
     * @example
     * const { data: orgs } = fetchOrganizations();
     */
    const fetchOrganizations = () => {
        return useApiFetch<Organization[]>(`${API_BASE}/api/organizations`);
    };

    /**
     * 특정 부서코드에 속한 사용자 목록 조회
     * orgCode를 Ref로 전달하면 값 변경 시 자동 재요청됩니다.
     *
     * @param orgCode - 조회할 부서코드 (문자열 또는 Ref<string>)
     * @returns useApiFetch 반환값 ({ data: OrgUser[], pending, error, refresh })
     *
     * @example
     * // 정적 부서코드
     * const { data: users } = fetchUsers('1001');
     *
     * @example
     * // 반응형 부서코드 (선택된 부서가 변경되면 자동 재조회)
     * const selectedOrgCode = ref('1001');
     * const { data: users } = fetchUsers(selectedOrgCode);
     */
    const fetchUsers = (orgCode: string | Ref<string>) => {
        return useApiFetch<OrgUser[]>(`${API_BASE}/api/users`, {
            query: { orgCode }
        });
    };

    /**
     * 평면(flat) 조직 목록을 PrimeVue Tree 형식의 트리 구조로 변환
     *
     * 변환 알고리즘:
     *  1. Map을 이용해 부서코드 → 트리 노드 매핑 테이블 생성
     *  2. 각 노드의 prlmHrkOgzCCone(상위부서코드)를 참조하여 부모 노드의 children에 추가
     *  3. 상위부서가 없거나 Map에 존재하지 않는 노드는 루트 배열에 추가
     *
     * @param orgs - 서버에서 받은 평면 조직 배열 (Organization[])
     * @returns PrimeVue TreeNode 형식의 중첩 배열
     *   - key   : 부서코드 (prlmOgzCCone)
     *   - label : 부서명 (bbrNm)
     *   - data  : 원본 Organization 객체
     *   - children: 하위 부서 노드 배열
     *
     * @example
     * const { data: orgs } = fetchOrganizations();
     * const treeNodes = buildOrgTree(orgs.value ?? []);
     * // <Tree :value="treeNodes" /> 에 바인딩
     */
    const buildOrgTree = (orgs: Organization[]) => {
        // 부서코드를 키로 사용하는 Map으로 빠른 부모 조회 지원
        const map = new Map();
        const roots: any[] = [];

        // 1단계: 모든 부서를 Map에 등록 (트리 노드 초기화)
        orgs.forEach(org => {
            map.set(org.prlmOgzCCone, {
                key: org.prlmOgzCCone,     // PrimeVue Tree의 key 필드
                label: org.bbrNm,           // PrimeVue Tree의 표시 이름
                data: org,                  // 원본 데이터 참조 보존
                children: []                // 하위 노드 배열 (2단계에서 채워짐)
            });
        });

        // 2단계: 상위부서코드를 기준으로 부모-자식 관계 구성
        orgs.forEach(org => {
            const node = map.get(org.prlmOgzCCone);
            if (org.prlmHrkOgzCCone && map.has(org.prlmHrkOgzCCone)) {
                // 상위부서가 Map에 존재하면 해당 부모의 children에 추가
                const parent = map.get(org.prlmHrkOgzCCone);
                parent.children.push(node);
            } else {
                // 상위부서가 없거나 Map에 없으면 최상위(root) 노드로 처리
                roots.push(node);
            }
        });

        return roots;
    };

    return {
        fetchOrganizations,
        fetchUsers,
        buildOrgTree
    };
};
