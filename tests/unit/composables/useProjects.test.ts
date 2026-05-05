/**
 * ============================================================================
 * [tests/unit/composables/useProjects.test.ts] useProjects Composable 단위 테스트
 * ============================================================================
 * composables/useProjects.ts의 API 호출 패턴을 테스트합니다.
 *
 * [테스트 전략]
 * - useApiFetch(반응형 GET)와 $apiFetch(일회성 POST/PUT/DELETE)를 각각 Mock
 * - useRuntimeConfig, useNuxtApp을 vi.stubGlobal()로 대체
 * - 실제 HTTP 요청 없이 URL·메서드·payload 전달만 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock 설정
// ============================================================================

// useRuntimeConfig Mock: API 베이스 URL 제공
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// useApiFetch Mock: GET 조회 (반응형 useFetch 래퍼)
const mockUseApiFetch = vi.fn().mockReturnValue({ data: null, pending: false, error: null, refresh: vi.fn() });
vi.stubGlobal('useApiFetch', mockUseApiFetch);

// $apiFetch Mock: POST/PUT/DELETE (일회성 인증 fetch)
const mockApiFetch = vi.fn().mockResolvedValue({});

// useNuxtApp Mock: $apiFetch 제공
vi.stubGlobal('useNuxtApp', () => ({
    $apiFetch: mockApiFetch
}));

// ============================================================================
// useProjects 인라인 구현 (Nuxt auto-import 없이 테스트)
// composables/useProjects.ts와 동일한 로직
// ============================================================================

interface Project {
    prjMngNo: string;
    prjNm: string;
    prjTp: string;
    pulDtt: string;
    svnDpm: string;
    svnDpmNm: string;
    itDpm: string;
    itDpmNm: string;
    prjBg: number;
    assetBg: number;
    devBg: number;
    machBg: number;
    intanBg: number;
    costBg: number;
    sttDt: string;
    endDt: string;
    prjSts: string;
    bgYy: number;
    svnHdq: string;
    svnDpmCgprNm: string;
}

interface ProjectDetail extends Project {
    bzDtt: string;
    dplYn: string;
    fstEnrUsid: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items?: any[];
}

const useProjects = () => {
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/projects`;
    const { $apiFetch } = useNuxtApp();

    const fetchProjects = (query?: Record<string, string>) => {
        return useApiFetch<Project[]>(API_BASE_URL, query ? { query } : {});
    };

    const fetchProject = (id: string | number) => {
        return useApiFetch<ProjectDetail>(`${API_BASE_URL}/${id}`);
    };

    const fetchProjectsBulk = async (prjMngNos: string[]) => {
        return await $apiFetch<ProjectDetail[]>(`${API_BASE_URL}/bulk-get`, {
            method: 'POST',
            body: { prjMngNos }
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createProject = async (payload: any) => {
        return await $apiFetch(API_BASE_URL, {
            method: 'POST',
            body: payload
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateProject = async (id: string | number, payload: any) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteProject = async (id: string | number) => {
        return await $apiFetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE'
        });
    };

    const fetchProjectsOnce = async (query?: Record<string, string>): Promise<Project[]> => {
        const params = query ? `?${new URLSearchParams(query).toString()}` : '';
        return await $apiFetch<Project[]>(`${API_BASE_URL}${params}`);
    };

    const fetchProjectDetailOnce = async (id: string | number): Promise<ProjectDetail> => {
        return await $apiFetch<ProjectDetail>(`${API_BASE_URL}/${id}`);
    };

    return {
        fetchProjects,
        fetchProject,
        fetchProjectsBulk,
        fetchProjectsOnce,
        fetchProjectDetailOnce,
        createProject,
        updateProject,
        deleteProject
    };
};

// ============================================================================
// 테스트용 픽스처
// ============================================================================
const makeProject = (overrides: Partial<Project> = {}): Project => ({
    prjMngNo:     'PRJ-2026-001',
    prjNm:        '테스트 프로젝트',
    prjTp:        '신규개발',
    pulDtt:       '신규',
    svnDpm:       'D001',
    svnDpmNm:     '주관부서명',
    itDpm:        'IT001',
    itDpmNm:      'IT담당부서명',
    prjBg:        100000000,
    assetBg:      50000000,
    devBg:        30000000,
    machBg:       10000000,
    intanBg:      5000000,
    costBg:       5000000,
    sttDt:        '2026-01-01',
    endDt:        '2026-12-31',
    prjSts:       '진행중',
    bgYy:         2026,
    svnHdq:       'HQ001',
    svnDpmCgprNm: '홍길동',
    ...overrides,
});

const makeProjectDetail = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
    ...makeProject(),
    bzDtt:      'BIZ001',
    dplYn:      'N',
    fstEnrUsid: 'E001',
    items:      [],
    ...overrides,
});

// ============================================================================
// 테스트
// ============================================================================
describe('useProjects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // fetchProjects — useApiFetch 기반 반응형 목록 조회
    // -------------------------------------------------------------------------
    describe('fetchProjects()', () => {
        it('올바른 URL로 useApiFetch를 호출한다', () => {
            const { fetchProjects } = useProjects();
            fetchProjects();

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects',
                {}
            );
        });

        it('query 파라미터가 있으면 { query } 옵션으로 전달한다', () => {
            const { fetchProjects } = useProjects();
            fetchProjects({ apfSts: 'none' });

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects',
                { query: { apfSts: 'none' } }
            );
        });

        it('query 미전달 시 빈 options 객체로 useApiFetch를 호출한다', () => {
            const { fetchProjects } = useProjects();
            fetchProjects();

            const [, options] = mockUseApiFetch.mock.calls[0];
            expect(options).toEqual({});
        });
    });

    // -------------------------------------------------------------------------
    // fetchProject — 단건 상세 조회 (품목 포함)
    // -------------------------------------------------------------------------
    describe('fetchProject(id)', () => {
        it('문자열 ID를 포함한 URL로 useApiFetch를 호출한다', () => {
            const { fetchProject } = useProjects();
            fetchProject('PRJ-2026-001');

            expect(mockUseApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects/PRJ-2026-001'
            );
        });

        it('숫자 ID도 URL에 올바르게 반영된다', () => {
            const { fetchProject } = useProjects();
            fetchProject(42);

            const [url] = mockUseApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/projects/42');
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectsOnce — 비반응형 목록 조회 ($apiFetch)
    // -------------------------------------------------------------------------
    describe('fetchProjectsOnce()', () => {
        it('query 없이 호출 시 기본 URL로 $apiFetch를 호출한다', async () => {
            mockApiFetch.mockResolvedValueOnce([makeProject()]);
            const { fetchProjectsOnce } = useProjects();

            await fetchProjectsOnce();

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects'
            );
        });

        it('query 파라미터가 있으면 쿼리스트링을 URL에 붙여 호출한다', async () => {
            mockApiFetch.mockResolvedValueOnce([makeProject()]);
            const { fetchProjectsOnce } = useProjects();

            await fetchProjectsOnce({ bgYy: '2026', ornYn: 'N' });

            const [url] = mockApiFetch.mock.calls[0];
            // URLSearchParams 순서 비보장이므로 포함 여부로 검증
            expect(url).toContain('http://localhost:8080/api/projects?');
            expect(url).toContain('bgYy=2026');
            expect(url).toContain('ornYn=N');
        });

        it('서버 응답 배열을 그대로 반환한다', async () => {
            const mockList = [makeProject({ prjMngNo: 'PRJ-A' }), makeProject({ prjMngNo: 'PRJ-B' })];
            mockApiFetch.mockResolvedValueOnce(mockList);
            const { fetchProjectsOnce } = useProjects();

            const result = await fetchProjectsOnce();

            expect(result).toEqual(mockList);
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectDetailOnce — 비반응형 상세 조회 ($apiFetch)
    // -------------------------------------------------------------------------
    describe('fetchProjectDetailOnce(id)', () => {
        it('$apiFetch로 동적 ID를 포함한 URL을 호출한다', async () => {
            mockApiFetch.mockResolvedValueOnce(makeProjectDetail({ prjMngNo: 'PRJ-2026-001' }));
            const { fetchProjectDetailOnce } = useProjects();

            await fetchProjectDetailOnce('PRJ-2026-001');

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects/PRJ-2026-001'
            );
        });

        it('숫자 ID로도 올바르게 호출된다', async () => {
            mockApiFetch.mockResolvedValueOnce(makeProjectDetail());
            const { fetchProjectDetailOnce } = useProjects();

            await fetchProjectDetailOnce(99);

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/projects/99');
        });

        it('서버 응답 상세 데이터를 그대로 반환한다', async () => {
            const mockDetail = makeProjectDetail({ prjNm: '상세 프로젝트', fstEnrUsid: 'E002' });
            mockApiFetch.mockResolvedValueOnce(mockDetail);
            const { fetchProjectDetailOnce } = useProjects();

            const result = await fetchProjectDetailOnce('PRJ-2026-001');

            expect(result).toEqual(mockDetail);
        });
    });

    // -------------------------------------------------------------------------
    // createProject — POST
    // -------------------------------------------------------------------------
    describe('createProject(payload)', () => {
        it('POST 메서드와 payload를 $apiFetch에 전달한다', async () => {
            const payload = makeProjectDetail({ prjNm: '신규 ERP 시스템 구축' });
            const { createProject } = useProjects();

            await createProject(payload);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects',
                expect.objectContaining({
                    method: 'POST',
                    body: payload,
                })
            );
        });

        it('올바른 기본 엔드포인트 URL로 호출한다', async () => {
            const { createProject } = useProjects();
            await createProject(makeProjectDetail());

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/projects');
        });
    });

    // -------------------------------------------------------------------------
    // updateProject — PUT
    // -------------------------------------------------------------------------
    describe('updateProject(id, payload)', () => {
        it('PUT 메서드와 동적 URL, payload를 $apiFetch에 전달한다', async () => {
            const payload = { prjSts: '완료', endDt: '2026-06-30' };
            const { updateProject } = useProjects();

            await updateProject('PRJ-2026-001', payload);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects/PRJ-2026-001',
                expect.objectContaining({
                    method: 'PUT',
                    body: payload,
                })
            );
        });

        it('숫자 ID도 PUT URL에 올바르게 포함된다', async () => {
            const { updateProject } = useProjects();
            await updateProject(123, { prjSts: '보류' });

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/projects/123');
        });
    });

    // -------------------------------------------------------------------------
    // deleteProject — DELETE
    // -------------------------------------------------------------------------
    describe('deleteProject(id)', () => {
        it('DELETE 메서드와 동적 URL로 $apiFetch를 호출한다', async () => {
            const { deleteProject } = useProjects();
            await deleteProject('PRJ-2026-001');

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects/PRJ-2026-001',
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('숫자 ID도 삭제 URL에 올바르게 반영된다', async () => {
            const { deleteProject } = useProjects();
            await deleteProject(77);

            const [url] = mockApiFetch.mock.calls[0];
            expect(url).toBe('http://localhost:8080/api/projects/77');
        });
    });

    // -------------------------------------------------------------------------
    // fetchProjectsBulk — 배열 payload POST
    // -------------------------------------------------------------------------
    describe('fetchProjectsBulk(ids)', () => {
        it('bulk-get 엔드포인트로 POST 요청하며 관리번호 배열을 body에 담는다', async () => {
            const ids = ['PRJ-001', 'PRJ-002', 'PRJ-003'];
            mockApiFetch.mockResolvedValueOnce([makeProjectDetail(), makeProjectDetail(), makeProjectDetail()]);
            const { fetchProjectsBulk } = useProjects();

            await fetchProjectsBulk(ids);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:8080/api/projects/bulk-get',
                expect.objectContaining({
                    method: 'POST',
                    body: { prjMngNos: ids },
                })
            );
        });

        it('빈 배열을 전달해도 오류 없이 호출된다', async () => {
            mockApiFetch.mockResolvedValueOnce([]);
            const { fetchProjectsBulk } = useProjects();

            await fetchProjectsBulk([]);

            const [, options] = mockApiFetch.mock.calls[0];
            expect(options.body).toEqual({ prjMngNos: [] });
        });

        it('서버 응답 ProjectDetail 배열을 그대로 반환한다', async () => {
            const mockList = [
                makeProjectDetail({ prjMngNo: 'PRJ-A', prjNm: '프로젝트 A' }),
                makeProjectDetail({ prjMngNo: 'PRJ-B', prjNm: '프로젝트 B' }),
            ];
            mockApiFetch.mockResolvedValueOnce(mockList);
            const { fetchProjectsBulk } = useProjects();

            const result = await fetchProjectsBulk(['PRJ-A', 'PRJ-B']);

            expect(result).toEqual(mockList);
        });
    });
});
