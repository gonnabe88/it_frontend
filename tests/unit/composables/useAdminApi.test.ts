/**
 * ============================================================================
 * [tests/unit/composables/useAdminApi.test.ts] 관리자 API Composable 단위 테스트
 * ============================================================================
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

import { useAdminApi } from '~/composables/useAdminApi';

const BASE = 'http://localhost:8080/api/admin';

describe('useAdminApi', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null });
    });

    // -------------------------------------------------------------------------
    // 공통코드
    // -------------------------------------------------------------------------
    describe('공통코드', () => {
        it('fetchCodes: 공통코드 목록을 조회한다', () => {
            const { fetchCodes } = useAdminApi();
            fetchCodes();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/codes`);
        });

        it('createCode: 공통코드를 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createCode } = useAdminApi();
            const body = { cdId: 'PRJ_TP001', cdNm: '신규개발', cttTp: 'PRJ_TP' };
            await createCode(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/codes`,
                { method: 'POST', body }
            );
        });

        it('updateCode: 공통코드를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateCode } = useAdminApi();
            const body = { cdId: 'PRJ_TP001', cdNm: '수정됨', sttDt: '2026-01-01' };
            await updateCode('PRJ_TP001', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/codes/PRJ_TP001?sttDt=2026-01-01`,
                { method: 'PUT', body }
            );
        });

        it('deleteCode: 공통코드를 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteCode } = useAdminApi();
            await deleteCode('PRJ_TP001', '2026-01-01');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/codes/PRJ_TP001?sttDt=2026-01-01`,
                { method: 'DELETE' }
            );
        });

        it('bulkUpsertCodes: 공통코드 배열을 일괄 생성/수정한다', async () => {
            mockApiFetch.mockResolvedValue({ created: 2, updated: 1 });
            const { bulkUpsertCodes } = useAdminApi();
            const codes = [
                { cdId: 'CODE001', cdNm: '코드1' },
                { cdId: 'CODE002', cdNm: '코드2' },
            ];
            const result = await bulkUpsertCodes(codes);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/codes/bulk`,
                { method: 'POST', body: { codes } }
            );
            expect(result).toEqual({ created: 2, updated: 1 });
        });
    });

    // -------------------------------------------------------------------------
    // 자격등급
    // -------------------------------------------------------------------------
    describe('자격등급', () => {
        it('fetchAuthGrades: 자격등급 목록을 조회한다', () => {
            const { fetchAuthGrades } = useAdminApi();
            fetchAuthGrades();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/auth-grades`);
        });

        it('createAuthGrade: 자격등급을 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createAuthGrade } = useAdminApi();
            const body = { athId: 'ITPAD001', qlfGrNm: '시스템관리자', useYn: 'Y' };
            await createAuthGrade(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/auth-grades`,
                { method: 'POST', body }
            );
        });

        it('updateAuthGrade: 자격등급을 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateAuthGrade } = useAdminApi();
            const body = { athId: 'ITPAD001', qlfGrNm: '수정된관리자', useYn: 'Y' };
            await updateAuthGrade('ITPAD001', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/auth-grades/ITPAD001`,
                { method: 'PUT', body }
            );
        });

        it('deleteAuthGrade: 자격등급을 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteAuthGrade } = useAdminApi();
            await deleteAuthGrade('ITPAD001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/auth-grades/ITPAD001`,
                { method: 'DELETE' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 역할
    // -------------------------------------------------------------------------
    describe('역할', () => {
        it('fetchRoles: 역할 목록을 조회한다', () => {
            const { fetchRoles } = useAdminApi();
            fetchRoles();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/roles`);
        });

        it('createRole: 역할을 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createRole } = useAdminApi();
            const body = { athId: 'ITPAD001', eno: 'E001', useYn: 'Y' };
            await createRole(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/roles`,
                { method: 'POST', body }
            );
        });

        it('updateRole: 역할을 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateRole } = useAdminApi();
            const body = { athId: 'ITPAD001', eno: 'E001', useYn: 'N' };
            await updateRole('ITPAD001', 'E001', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/roles/ITPAD001/E001`,
                { method: 'PUT', body }
            );
        });

        it('deleteRole: 역할을 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteRole } = useAdminApi();
            await deleteRole('ITPAD001', 'E001');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/roles/ITPAD001/E001`,
                { method: 'DELETE' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 사용자
    // -------------------------------------------------------------------------
    describe('사용자', () => {
        it('fetchUsers: 사용자 목록을 조회한다', () => {
            const { fetchUsers } = useAdminApi();
            fetchUsers();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/users`);
        });

        it('createUser: 사용자를 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createUser } = useAdminApi();
            const body = { eno: 'E002', usrNm: '홍길동', bbrC: 'DEPT001' };
            await createUser(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/users`,
                { method: 'POST', body }
            );
        });

        it('updateUser: 사용자를 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateUser } = useAdminApi();
            const body = { eno: 'E002', usrNm: '수정된이름' };
            await updateUser('E002', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/users/E002`,
                { method: 'PUT', body }
            );
        });

        it('deleteUser: 사용자를 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteUser } = useAdminApi();
            await deleteUser('E002');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/users/E002`,
                { method: 'DELETE' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 조직
    // -------------------------------------------------------------------------
    describe('조직', () => {
        it('fetchOrganizations: 조직 목록을 조회한다', () => {
            const { fetchOrganizations } = useAdminApi();
            fetchOrganizations();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/organizations`);
        });

        it('createOrganization: 조직을 POST로 생성한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { createOrganization } = useAdminApi();
            const body = { prlmOgzCCone: 'DEPT002', bbrNm: '신규부서' };
            await createOrganization(body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/organizations`,
                { method: 'POST', body }
            );
        });

        it('updateOrganization: 조직을 PUT으로 수정한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { updateOrganization } = useAdminApi();
            const body = { prlmOgzCCone: 'DEPT002', bbrNm: '수정된부서' };
            await updateOrganization('DEPT002', body);
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/organizations/DEPT002`,
                { method: 'PUT', body }
            );
        });

        it('deleteOrganization: 조직을 DELETE로 삭제한다', async () => {
            mockApiFetch.mockResolvedValue(undefined);
            const { deleteOrganization } = useAdminApi();
            await deleteOrganization('DEPT002');
            expect(mockApiFetch).toHaveBeenCalledWith(
                `${BASE}/organizations/DEPT002`,
                { method: 'DELETE' }
            );
        });
    });

    // -------------------------------------------------------------------------
    // 로그인이력 / JWT토큰 / 첨부파일 / 대시보드
    // -------------------------------------------------------------------------
    describe('로그인이력 / 토큰 / 파일 / 대시보드', () => {
        it('fetchLoginHistory: 기본 파라미터로 로그인이력을 조회한다', () => {
            const { fetchLoginHistory } = useAdminApi();
            fetchLoginHistory();
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/login-history`,
                { query: { page: 0, size: 50 } }
            );
        });

        it('fetchLoginHistory: 커스텀 파라미터로 로그인이력을 조회한다', () => {
            const { fetchLoginHistory } = useAdminApi();
            fetchLoginHistory(2, 20);
            expect(mockUseApiFetch).toHaveBeenCalledWith(
                `${BASE}/login-history`,
                { query: { page: 2, size: 20 } }
            );
        });

        it('fetchTokens: JWT 토큰 목록을 조회한다', () => {
            const { fetchTokens } = useAdminApi();
            fetchTokens();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/tokens`);
        });

        it('fetchFiles: 첨부파일 목록을 조회한다', () => {
            const { fetchFiles } = useAdminApi();
            fetchFiles();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/files`);
        });

        it('fetchLoginStats: 로그인 통계를 조회한다', () => {
            const { fetchLoginStats } = useAdminApi();
            fetchLoginStats();
            expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/dashboard/login-stats`);
        });
    });
});
