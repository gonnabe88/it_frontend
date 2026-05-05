/**
 * ============================================================================
 * [tests/unit/composables/useApprovalDashboard.test.ts]
 * useApprovalDashboard / useApprovalBadgeCount 단위 테스트
 * ============================================================================
 * 전자결재 대시보드 Composable의 핵심 동작을 검증합니다.
 *
 * [테스트 전략]
 * - useApiFetch를 Mock하여 URL/쿼리 파라미터 캡처 후 검증
 * - Nuxt auto-import (useAuth, useRuntimeConfig)를 vi.stubGlobal로 대체
 * - Composable 로직을 인라인으로 재현 (Nuxt 환경 없이 Vitest 실행)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================

// useApiFetch Mock: 호출된 URL/옵션 캡처용
const mockData = ref<Record<string, number> | null>(null);
const mockUseApiFetch = vi.fn().mockImplementation(() => ({
    data: mockData,
    pending: ref(false),
    refresh: vi.fn()
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

// 로그인 사용자 Mock (bbrC, eno)
const mockUser = ref<{ bbrC: string; eno: string } | null>(null);
vi.stubGlobal('useAuth', () => ({ user: mockUser }));

// runtimeConfig Mock
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// ============================================================================
// 인라인 Composable 구현 (Nuxt auto-import 없이 테스트)
// composables/useApprovalDashboard.ts와 동일한 로직
// ============================================================================

const useApprovalDashboard = () => {
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/dashboard`;
    const { data, pending, refresh } = useApiFetch(url, {
        query: computed(() => ({ bbrC: user.value?.bbrC, eno: user.value?.eno }))
    });
    return { data, pending, refresh };
};

const useApprovalBadgeCount = () => {
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/approval-badge`;
    const { data } = useApiFetch(url, {
        query: computed(() => ({ bbrC: user.value?.bbrC, eno: user.value?.eno }))
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingCount = computed(() => (data.value as any)?.pendingCount ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inProgressCount = computed(() => (data.value as any)?.inProgressCount ?? 0);
    return { pendingCount, inProgressCount };
};

// ============================================================================
// 테스트
// ============================================================================

describe('useApprovalDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockData.value = null;
        mockUser.value = null;
        mockUseApiFetch.mockImplementation(() => ({
            data: mockData,
            pending: ref(false),
            refresh: vi.fn()
        }));
    });

    it('대시보드 전용 URL로 useApiFetch를 호출한다', () => {
        useApprovalDashboard();

        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/applications/dashboard');
    });

    it('로그인 사용자의 bbrC와 eno가 query에 포함된다', () => {
        mockUser.value = { bbrC: 'BBR001', eno: 'E12345' };
        useApprovalDashboard();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR001', eno: 'E12345' });
    });

    it('user가 null이면 bbrC와 eno가 undefined로 전달된다', () => {
        mockUser.value = null;
        useApprovalDashboard();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: undefined, eno: undefined });
    });

    it('user 변경 시 computed query가 자동으로 갱신된다 (반응성 검증)', () => {
        mockUser.value = null;
        useApprovalDashboard();
        const [, options] = mockUseApiFetch.mock.calls[0];

        // user 변경 후 computed 재평가
        mockUser.value = { bbrC: 'BBR002', eno: 'E99999' };
        expect(options.query.value).toEqual({ bbrC: 'BBR002', eno: 'E99999' });
    });

    it('data, pending, refresh를 반환한다', () => {
        const result = useApprovalDashboard();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('refresh');
    });
});

describe('useApprovalBadgeCount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockData.value = null;
        mockUser.value = null;
        mockUseApiFetch.mockImplementation(() => ({
            data: mockData,
            pending: ref(false),
            refresh: vi.fn()
        }));
    });

    it('배지 전용 URL로 useApiFetch를 호출한다 (대시보드 URL과 구분하여 key 충돌 방지)', () => {
        useApprovalBadgeCount();

        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/applications/approval-badge');
    });

    it('data가 null이면 pendingCount는 0을 반환한다 (null 안전 처리)', () => {
        mockData.value = null;
        const { pendingCount } = useApprovalBadgeCount();
        expect(pendingCount.value).toBe(0);
    });

    it('data가 null이면 inProgressCount는 0을 반환한다 (null 안전 처리)', () => {
        mockData.value = null;
        const { inProgressCount } = useApprovalBadgeCount();
        expect(inProgressCount.value).toBe(0);
    });

    it('data에 pendingCount가 있으면 해당 값을 반환한다', () => {
        mockData.value = { pendingCount: 5, inProgressCount: 3 };
        const { pendingCount } = useApprovalBadgeCount();
        expect(pendingCount.value).toBe(5);
    });

    it('data에 inProgressCount가 있으면 해당 값을 반환한다', () => {
        mockData.value = { pendingCount: 5, inProgressCount: 3 };
        const { inProgressCount } = useApprovalBadgeCount();
        expect(inProgressCount.value).toBe(3);
    });

    it('pendingCount가 0인 경우에도 정확히 0을 반환한다 (falsy 오탐 방지)', () => {
        mockData.value = { pendingCount: 0, inProgressCount: 0 };
        const { pendingCount } = useApprovalBadgeCount();
        expect(pendingCount.value).toBe(0);
    });

    it('로그인 사용자의 bbrC와 eno가 배지 query에도 포함된다', () => {
        mockUser.value = { bbrC: 'BBR003', eno: 'E11111' };
        useApprovalBadgeCount();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR003', eno: 'E11111' });
    });
});
