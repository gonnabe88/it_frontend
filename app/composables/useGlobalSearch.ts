/**
 * ============================================================================
 * [useGlobalSearch] 통합검색 Composable
 * ============================================================================
 * AppHeader에서 사업명 기준으로 정보화사업·전산업무비를 통합 검색합니다.
 * 최초 검색 시 양쪽 목록을 캐시하고, 이후 키워드로 클라이언트 필터링합니다.
 *
 * [제공 기능]
 *  - suggestions : AutoComplete용 검색 결과 목록
 *  - searchByName : AutoComplete 검색 이벤트 핸들러
 * ============================================================================
 */
import { ref } from 'vue';
import type { Project } from '~/composables/useProjects';
import type { ItCost } from '~/composables/useCost';

/** 통합검색 결과 항목 */
export interface SearchResult {
    /** 관리번호 (PK) */
    id: string;
    /** 사업명 또는 계약명 */
    name: string;
    /** 구분 라벨 (정보화사업 / 전산업무비) */
    type: '정보화사업' | '전산업무비';
    /** 상세 페이지 경로 */
    route: string;
    /** 부서명 (IT담당부서 또는 담당부서) */
    deptNm: string;
    /** 예산 금액 */
    budget: number;
    /** 상태 (프로젝트상태 또는 결재상태) */
    status: string;
}

export const useGlobalSearch = () => {
    const { $apiFetch } = useNuxtApp();
    const config = useRuntimeConfig();

    const suggestions = ref<SearchResult[]>([]);

    /** 캐시된 전체 목록 (최초 검색 시 1회 로딩) */
    let cachedProjects: Project[] | null = null;
    let cachedCosts: ItCost[] | null = null;

    /** 양쪽 API에서 목록을 가져와 캐시합니다 */
    const loadAll = async () => {
        const [projects, costs] = await Promise.all([
            cachedProjects
                ? cachedProjects
                : $apiFetch<Project[]>(`${config.public.apiBase}/api/projects`),
            cachedCosts
                ? cachedCosts
                : $apiFetch<ItCost[]>(`${config.public.apiBase}/api/cost`),
        ]);
        cachedProjects = projects ?? [];
        cachedCosts = costs ?? [];
    };

    /** AutoComplete 검색 이벤트 핸들러 */
    const searchByName = async (event: { query: string }) => {
        const keyword = event.query.trim().toLowerCase();
        if (!keyword) { suggestions.value = []; return; }

        // 최초 검색 시 데이터 로딩
        if (!cachedProjects || !cachedCosts) {
            try {
                await loadAll();
            } catch (e) {
                console.error('통합검색 데이터 로딩 실패', e);
                suggestions.value = [];
                return;
            }
        }

        // 정보화사업 필터링
        const projectResults: SearchResult[] = (cachedProjects ?? [])
            .filter(p => p.prjNm?.toLowerCase().includes(keyword))
            .slice(0, 10)
            .map(p => ({
                id: p.prjMngNo,
                name: p.prjNm,
                type: '정보화사업',
                route: `/info/projects/${p.prjMngNo}`,
                deptNm: p.itDpmNm || p.svnDpmNm || '',
                budget: p.prjBg || 0,
                status: p.prjSts || '',
            }));

        // 전산업무비 필터링
        const costResults: SearchResult[] = (cachedCosts ?? [])
            .filter(c => c.cttNm?.toLowerCase().includes(keyword))
            .slice(0, 10)
            .map(c => ({
                id: c.itMngcNo!,
                name: c.cttNm,
                type: '전산업무비',
                route: `/info/cost/${c.itMngcNo}`,
                deptNm: c.biceDpmNm || '',
                budget: c.itMngcBg || 0,
                status: c.apfSts || '',
            }));

        suggestions.value = [...projectResults, ...costResults];
    };

    /** 캐시 초기화 (연도 변경 등 필요 시 호출) */
    const clearCache = () => {
        cachedProjects = null;
        cachedCosts = null;
    };

    return {
        suggestions,
        searchByName,
        clearCache,
    };
};
