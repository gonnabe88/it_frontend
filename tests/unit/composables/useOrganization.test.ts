/**
 * ============================================================================
 * [tests/unit/composables/useOrganization.test.ts] 조직도/사용자 조회 Composable 테스트
 * ============================================================================
 * composables/useOrganization.ts를 직접 import하여 커버리지를 측정합니다.
 * buildOrgTree 순수 함수 + API 호출 패턴을 검증합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useOrganization } from '~/composables/useOrganization';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: ref([]),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useOrganization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({
            data: ref([]),
            pending: ref(false),
            error: ref(null),
            refresh: vi.fn(),
        }));
    });

    describe('fetchOrganizations', () => {
        it('조직 목록 URL로 useApiFetch를 호출한다', () => {
            const { fetchOrganizations } = useOrganization();
            fetchOrganizations();
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/organizations'
            );
        });
    });

    describe('fetchUsers', () => {
        it('사용자 목록 URL + orgCode 쿼리로 useApiFetch를 호출한다', () => {
            const { fetchUsers } = useOrganization();
            fetchUsers('D001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/users',
                expect.objectContaining({ query: { orgCode: 'D001' } })
            );
        });

        it('Ref를 orgCode로 전달할 수 있다', () => {
            const { fetchUsers } = useOrganization();
            const orgCodeRef = ref('D001');
            fetchUsers(orgCodeRef);
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/users',
                expect.objectContaining({ query: { orgCode: orgCodeRef } })
            );
        });
    });

    describe('buildOrgTree', () => {
        it('빈 배열이면 빈 트리를 반환한다', () => {
            const { buildOrgTree } = useOrganization();
            expect(buildOrgTree([])).toEqual([]);
        });

        it('단일 최상위 부서(상위 없음)를 루트 노드로 반환한다', () => {
            const { buildOrgTree } = useOrganization();
            const orgs = [
                { bbrNm: '본사', prlmHrkOgzCCone: null, prlmOgzCCone: 'ROOT' }
            ];
            const tree = buildOrgTree(orgs);
            expect(tree).toHaveLength(1);
            expect(tree[0].key).toBe('ROOT');
            expect(tree[0].label).toBe('본사');
        });

        it('부모-자식 관계를 올바르게 구성한다', () => {
            const { buildOrgTree } = useOrganization();
            const orgs = [
                { bbrNm: '본사', prlmHrkOgzCCone: null, prlmOgzCCone: 'ROOT' },
                { bbrNm: 'IT팀', prlmHrkOgzCCone: 'ROOT', prlmOgzCCone: 'IT' },
                { bbrNm: '개발팀', prlmHrkOgzCCone: 'IT', prlmOgzCCone: 'DEV' },
            ];
            const tree = buildOrgTree(orgs);
            expect(tree).toHaveLength(1); // 루트 1개
            expect(tree[0].children).toHaveLength(1); // IT팀
            expect(tree[0].children[0].children).toHaveLength(1); // 개발팀
            expect(tree[0].children[0].children[0].label).toBe('개발팀');
        });

        it('상위부서코드가 Map에 없으면 루트로 처리한다', () => {
            const { buildOrgTree } = useOrganization();
            const orgs = [
                { bbrNm: '고아부서', prlmHrkOgzCCone: 'NONEXISTENT', prlmOgzCCone: 'ORPHAN' }
            ];
            const tree = buildOrgTree(orgs);
            expect(tree).toHaveLength(1);
            expect(tree[0].key).toBe('ORPHAN');
        });

        it('data 필드에 원본 Organization 객체가 포함된다', () => {
            const { buildOrgTree } = useOrganization();
            const org = { bbrNm: '인사팀', prlmHrkOgzCCone: null, prlmOgzCCone: 'HR' };
            const tree = buildOrgTree([org]);
            expect(tree[0].data).toEqual(org);
        });

        it('여러 최상위 부서를 모두 루트로 반환한다', () => {
            const { buildOrgTree } = useOrganization();
            const orgs = [
                { bbrNm: '본사A', prlmHrkOgzCCone: null, prlmOgzCCone: 'A' },
                { bbrNm: '본사B', prlmHrkOgzCCone: null, prlmOgzCCone: 'B' },
            ];
            const tree = buildOrgTree(orgs);
            expect(tree).toHaveLength(2);
        });
    });
});
