/**
 * ============================================================================
 * [tests/unit/composables/useGlobalSearch.test.ts]
 * 통합검색 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import { useGlobalSearch } from '~/composables/useGlobalSearch';

// ============================================================================
// Mock 설정
// ============================================================================
const mockApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('ref', ref);

const mockProjects = [
    { prjMngNo: 'PRJ-001', prjNm: '로그인 개선', itDpmNm: 'IT기획팀', svnDpmNm: '', prjBg: 10000000, prjSts: '진행중' },
    { prjMngNo: 'PRJ-002', prjNm: '결재 시스템 구축', itDpmNm: 'IT운영팀', svnDpmNm: '', prjBg: 5000000, prjSts: '완료' },
];

const mockCosts = [
    { itMngcNo: 'COST-001', cttNm: '서버 유지비', biceDpmNm: 'IT인프라팀', itMngcBg: 3000000, apfSts: '승인' },
    { itMngcNo: 'COST-002', cttNm: '로그인 인프라', biceDpmNm: 'IT기획팀', itMngcBg: 1000000, apfSts: '대기' },
];

describe('useGlobalSearch', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    it('빈 키워드이면 suggestions를 비운다', async () => {
        const { suggestions, searchByName } = useGlobalSearch();
        suggestions.value = [{ id: 'OLD', name: '이전 결과', type: '정보화사업', route: '/info/projects/OLD', deptNm: '', budget: 0, status: '' }];
        await searchByName({ query: '' });
        expect(suggestions.value).toHaveLength(0);
    });

    it('공백만 있는 키워드이면 suggestions를 비운다', async () => {
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: '   ' });
        expect(suggestions.value).toHaveLength(0);
    });

    it('최초 검색 시 projects와 costs를 모두 로드한다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { searchByName } = useGlobalSearch();
        await searchByName({ query: '로그인' });
        expect(mockApiFetch).toHaveBeenCalledTimes(2);
        expect(mockApiFetch).toHaveBeenCalledWith('http://localhost:8080/api/projects');
        expect(mockApiFetch).toHaveBeenCalledWith('http://localhost:8080/api/cost');
    });

    it('프로젝트 이름으로 필터링된 결과를 반환한다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: '로그인' });
        const projectResults = suggestions.value.filter(s => s.type === '정보화사업');
        expect(projectResults).toHaveLength(1);
        expect(projectResults[0]!.id).toBe('PRJ-001');
        expect(projectResults[0]!.name).toBe('로그인 개선');
        expect(projectResults[0]!.route).toBe('/info/projects/PRJ-001');
        expect(projectResults[0]!.type).toBe('정보화사업');
    });

    it('전산업무비 이름으로 필터링된 결과를 반환한다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: '서버' });
        const costResults = suggestions.value.filter(s => s.type === '전산업무비');
        expect(costResults).toHaveLength(1);
        expect(costResults[0]!.id).toBe('COST-001');
        expect(costResults[0]!.name).toBe('서버 유지비');
        expect(costResults[0]!.route).toBe('/info/cost/COST-001');
        expect(costResults[0]!.type).toBe('전산업무비');
    });

    it('키워드로 프로젝트와 비용을 동시에 검색한다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: '로그인' });
        expect(suggestions.value.some(s => s.type === '정보화사업')).toBe(true);
        expect(suggestions.value.some(s => s.type === '전산업무비')).toBe(true);
    });

    it('두 번째 검색부터는 캐시를 사용하여 API를 다시 호출하지 않는다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { searchByName } = useGlobalSearch();
        await searchByName({ query: '로그인' });
        await searchByName({ query: '결재' });
        // API는 최초 1회만 호출되어야 함 (projects + costs = 총 2번)
        expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    it('API 실패 시 suggestions를 빈 배열로 초기화한다', async () => {
        mockApiFetch.mockRejectedValue(new Error('Network error'));
        const { suggestions, searchByName } = useGlobalSearch();
        suggestions.value = [{ id: 'OLD', name: '이전 결과', type: '정보화사업', route: '/info/projects/OLD', deptNm: '', budget: 0, status: '' }];
        await searchByName({ query: '로그인' });
        expect(suggestions.value).toHaveLength(0);
    });

    it('clearCache() 호출 후 재검색 시 API를 다시 호출한다', async () => {
        mockApiFetch
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts)
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockCosts);
        const { searchByName, clearCache } = useGlobalSearch();
        await searchByName({ query: '로그인' });
        clearCache();
        await searchByName({ query: '결재' });
        expect(mockApiFetch).toHaveBeenCalledTimes(4);
    });

    it('대소문자 무관하게 검색한다', async () => {
        const projectsWithEnglish = [
            { prjMngNo: 'PRJ-003', prjNm: 'Login System', itDpmNm: 'IT팀', svnDpmNm: '', prjBg: 0, prjSts: '진행중' },
        ];
        mockApiFetch
            .mockResolvedValueOnce(projectsWithEnglish)
            .mockResolvedValueOnce([]);
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: 'LOGIN' });
        expect(suggestions.value).toHaveLength(1);
        expect(suggestions.value[0]!.name).toBe('Login System');
    });

    it('itDpmNm이 없으면 svnDpmNm을 deptNm으로 사용한다', async () => {
        const projectsWithSvnDpm = [
            { prjMngNo: 'PRJ-004', prjNm: '결재 테스트', itDpmNm: '', svnDpmNm: '사업부', prjBg: 0, prjSts: '' },
        ];
        mockApiFetch
            .mockResolvedValueOnce(projectsWithSvnDpm)
            .mockResolvedValueOnce([]);
        const { suggestions, searchByName } = useGlobalSearch();
        await searchByName({ query: '결재 테스트' });
        expect(suggestions.value[0]!.deptNm).toBe('사업부');
    });
});
