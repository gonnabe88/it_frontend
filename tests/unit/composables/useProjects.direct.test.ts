/**
 * ============================================================================
 * [tests/unit/composables/useProjects.direct.test.ts] 프로젝트 Composable 직접 import 테스트
 * ============================================================================
 * composables/useProjects.ts를 직접 import하여 커버리지를 측정합니다.
 * (useProjects.test.ts는 인라인 재구현이므로 소스 커버리지에 기여하지 않음)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock 설정
// ============================================================================
const mockApiFetch = vi.fn();
const mockUseApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

import { useProjects } from '~/composables/useProjects';

const BASE = 'http://localhost:8080/api/projects';

describe('useProjects (직접 import)', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
    });

    // -------------------------------------------------------------------------
    // fetchProjects
    // -------------------------------------------------------------------------
    describe('fetchProjects', () => {
        it('쿼리 없이 목록을 조회한다', () => {
            const { fetchProjects } = useProjects();
            fetchProjects();
            expect(mockUseApiFetch).toHaveBeenCalledWith(BASE, {});
        });

        it('쿼리 파라미터와 함께 목록을 조회한다', () => {
            const { fetchProjects } = useProjects();
            fetchProjects({ apfSts: 'none' });
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                BASE,
                { query: { apfSts: 'none' } }
            );
        });
    });

    // -------------------------------------------------------------------------
    // fetchProject
    // -------------------------------------------------------------------------
    describe('fetchProject', () => {
        it('문자열 ID로 단일 프로젝트를 조회한다', () => {
            const { fetchProject } = useProjects();
            fetchProject('PRJ-2026-001');
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/PRJ-2026-001`);
        });

        it('숫자 ID로 단일 프로젝트를 조회한다', () => {
            const { fetchProject } = useProjects();
            fetchProject(42);
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/42`);
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectsBulk
    // -------------------------------------------------------------------------
    describe('fetchProjectsBulk', () => {
        it('관리번호 배열을 POST로 일괄 조회한다', async () => {
            const mockData = [{ prjMngNo: 'PRJ-001' }, { prjMngNo: 'PRJ-002' }];
            mockApiFetch.mockResolvedValue(mockData);
            const { fetchProjectsBulk } = useProjects();
            const result = await fetchProjectsBulk(['PRJ-001', 'PRJ-002']);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/bulk-get`,
                { method: 'POST', body: { prjMngNos: ['PRJ-001', 'PRJ-002'] } }
            );
            expect(result).toEqual(mockData);
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectsOnce
    // -------------------------------------------------------------------------
    describe('fetchProjectsOnce', () => {
        it('쿼리 없이 프로젝트 목록을 일회성 조회한다', async () => {
            mockApiFetch.mockResolvedValue([]);
            const { fetchProjectsOnce } = useProjects();
            await fetchProjectsOnce();
            expect(mockApiFetch).toHaveBeenCalledWith(BASE);
        });

        it('쿼리 파라미터와 함께 일회성 조회한다', async () => {
            mockApiFetch.mockResolvedValue([]);
            const { fetchProjectsOnce } = useProjects();
            await fetchProjectsOnce({ bgYy: '2026', ornYn: 'N' });
            const callArg = mockApiFetch.mock.calls[0][0] as string;
            expect(callArg).toContain('bgYy=2026');
            expect(callArg).toContain('ornYn=N');
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectDetailOnce
    // -------------------------------------------------------------------------
    describe('fetchProjectDetailOnce', () => {
        it('문자열 ID로 상세 정보를 일회성 조회한다', async () => {
            const mockDetail = { prjMngNo: 'PRJ-001', prjNm: '테스트프로젝트' };
            mockApiFetch.mockResolvedValue(mockDetail);
            const { fetchProjectDetailOnce } = useProjects();
            const result = await fetchProjectDetailOnce('PRJ-001');
            expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/PRJ-001`);
            expect(result).toEqual(mockDetail);
        });
    });

    // -------------------------------------------------------------------------
    // createProject
    // -------------------------------------------------------------------------
    describe('createProject', () => {
        it('프로젝트를 POST로 생성한다', async () => {
            const created = { prjMngNo: 'PRJ-2026-001' };
            mockApiFetch.mockResolvedValue(created);
            const { createProject } = useProjects();
            const payload = { prjNm: '신규 ERP 시스템 구축', prjTp: '신규개발' };
            const result = await createProject(payload);
            expect(mockApiFetch).toHaveBeenCalledWith(
                BASE,
                { method: 'POST', body: payload }
            );
            expect(result).toEqual(created);
        });
    });

    // -------------------------------------------------------------------------
    // updateProject
    // -------------------------------------------------------------------------
    describe('updateProject', () => {
        it('프로젝트를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue({ prjMngNo: 'PRJ-001' });
            const { updateProject } = useProjects();
            const payload = { prjSts: '진행중', endDt: '2026-12-31' };
            await updateProject('PRJ-001', payload);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/PRJ-001`,
                { method: 'PUT', body: payload }
            );
        });
    });

    // -------------------------------------------------------------------------
    // deleteProject
    // -------------------------------------------------------------------------
    describe('deleteProject', () => {
        it('프로젝트를 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteProject } = useProjects();
            await deleteProject('PRJ-001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/PRJ-001`,
                { method: 'DELETE' }
            );
        });

        it('숫자 ID로도 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteProject } = useProjects();
            await deleteProject(99);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/99`,
                { method: 'DELETE' }
            );
        });
    });
});
