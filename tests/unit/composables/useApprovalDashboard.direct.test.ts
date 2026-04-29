/**
 * ============================================================================
 * [tests/unit/composables/useApprovalDashboard.direct.test.ts]
 * 전자결재 대시보드 Composable 직접 import 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================
const mockUseApiFetch = vi.fn();
const mockUser = ref<{ bbrC: string; eno: string } | null>(null);

vi.stubGlobal('useApiFetch', mockUseApiFetch);
vi.stubGlobal('useAuth', () => ({ user: mockUser }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('computed', computed);

import { useApprovalDashboard, useApprovalBadgeCount } from '~/composables/useApprovalDashboard';

describe('useApprovalDashboard (직접 import)', () => {
    beforeEach(() => {
        mockUseApiFetch.mockReset();
        mockUser.value = null;
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false), refresh: vi.fn() });
    });

    it('대시보드 URL로 useApiFetch를 호출한다', () => {
        useApprovalDashboard();
        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/applications/dashboard');
    });

    it('로그인 사용자의 bbrC와 eno를 query에 포함한다', () => {
        mockUser.value = { bbrC: 'BBR001', eno: 'E001' };
        useApprovalDashboard();
        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR001', eno: 'E001' });
    });

    it('user가 null이면 bbrC와 eno가 undefined로 전달된다', () => {
        mockUser.value = null;
        useApprovalDashboard();
        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: undefined, eno: undefined });
    });

    it('data, pending, refresh를 반환한다', () => {
        const result = useApprovalDashboard();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('refresh');
    });
});

describe('useApprovalBadgeCount (직접 import)', () => {
    beforeEach(() => {
        mockUseApiFetch.mockReset();
        mockUser.value = null;
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false), refresh: vi.fn() });
    });

    it('배지 전용 URL로 useApiFetch를 호출한다', () => {
        useApprovalBadgeCount();
        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/applications/approval-badge');
    });

    it('data가 null이면 pendingCount는 0이다', () => {
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false) });
        const { pendingCount } = useApprovalBadgeCount();
        expect(pendingCount.value).toBe(0);
    });

    it('data가 null이면 inProgressCount는 0이다', () => {
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false) });
        const { inProgressCount } = useApprovalBadgeCount();
        expect(inProgressCount.value).toBe(0);
    });

    it('data에 값이 있으면 pendingCount를 반환한다', () => {
        mockUseApiFetch.mockReturnValue({
            data: ref({ pendingCount: 5, inProgressCount: 2 }),
            pending: ref(false),
        });
        const { pendingCount } = useApprovalBadgeCount();
        expect(pendingCount.value).toBe(5);
    });

    it('data에 값이 있으면 inProgressCount를 반환한다', () => {
        mockUseApiFetch.mockReturnValue({
            data: ref({ pendingCount: 5, inProgressCount: 2 }),
            pending: ref(false),
        });
        const { inProgressCount } = useApprovalBadgeCount();
        expect(inProgressCount.value).toBe(2);
    });

    it('로그인 사용자의 bbrC와 eno가 배지 query에도 포함된다', () => {
        mockUser.value = { bbrC: 'BBR002', eno: 'E002' };
        useApprovalBadgeCount();
        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR002', eno: 'E002' });
    });
});
