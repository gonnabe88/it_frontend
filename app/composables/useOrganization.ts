export interface Organization {
    bbrNm: string; // 부서명
    prlmHrkOgzCCone: string | null; // 상위부서코드
    prlmOgzCCone: string; // 부서코드
}

export interface OrgUser {
    bbrNm: string; // 부서명
    eno: string; // 사원번호
    ptCNm: string | null; // 직위/직급
    temNm: string | null; // 팀명
    usrNm: string; // 이름
}

export const useOrganization = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;

    // API Call to fetch organizations
    const fetchOrganizations = () => {
        return useApiFetch<Organization[]>(`${API_BASE}/api/organizations`);
    };

    // API Call to fetch users by organization code
    const fetchUsers = (orgCode: string | Ref<string>) => {
        return useApiFetch<OrgUser[]>(`${API_BASE}/api/users`, {
            query: { orgCode }
        });
    };

    // Transform flat organization list to Tree structure
    const buildOrgTree = (orgs: Organization[]) => {
        const map = new Map();
        const roots: any[] = [];

        // Initialize map
        orgs.forEach(org => {
            map.set(org.prlmOgzCCone, {
                key: org.prlmOgzCCone,
                label: org.bbrNm,
                data: org,
                children: []
            });
        });

        // Build tree
        orgs.forEach(org => {
            const node = map.get(org.prlmOgzCCone);
            if (org.prlmHrkOgzCCone && map.has(org.prlmHrkOgzCCone)) {
                const parent = map.get(org.prlmHrkOgzCCone);
                parent.children.push(node);
            } else {
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
