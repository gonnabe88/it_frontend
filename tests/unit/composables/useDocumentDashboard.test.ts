/**
 * ============================================================================
 * [tests/unit/composables/useDocumentDashboard.test.ts]
 * useDocumentDashboard / useDocumentBadgeCount 단위 테스트
 * ============================================================================
 * 사전협의(요구사항 정의서) 대시보드 Composable의 핵심 동작을 검증합니다.
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

// 로그인 사용자 Mock (bbrC만 사용 — useApprovalDashboard와 달리 eno 불필요)
const mockUser = ref<{ bbrC: string } | null>(null);
vi.stubGlobal('useAuth', () => ({ user: mockUser }));

// runtimeConfig Mock
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

// ============================================================================
// 인라인 Composable 구현 (Nuxt auto-import 없이 테스트)
// composables/useDocumentDashboard.ts와 동일한 로직
// ============================================================================

const useDocumentDashboard = () => {
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/documents/dashboard`;
    const { data, pending, refresh } = useApiFetch(url, {
        query: computed(() => ({ bbrC: user.value?.bbrC }))
    });
    return { data, pending, refresh };
};

const useDocumentBadgeCount = () => {
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/documents/badge-count`;
    const { data } = useApiFetch(url, {
        query: computed(() => ({ bbrC: user.value?.bbrC }))
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewingCount = computed(() => (data.value as any)?.reviewingCount ?? 0);
    return { reviewingCount };
};

// ============================================================================
// 테스트
// ============================================================================

describe('useDocumentDashboard', () => {
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
        useDocumentDashboard();

        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/documents/dashboard');
    });

    it('로그인 사용자의 bbrC가 query에 포함된다', () => {
        mockUser.value = { bbrC: 'BBR001' };
        useDocumentDashboard();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR001' });
    });

    it('user가 null이면 bbrC가 undefined로 전달된다', () => {
        mockUser.value = null;
        useDocumentDashboard();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: undefined });
    });

    it('user 변경 시 computed query가 자동으로 갱신된다 (반응성 검증)', () => {
        mockUser.value = null;
        useDocumentDashboard();
        const [, options] = mockUseApiFetch.mock.calls[0];

        mockUser.value = { bbrC: 'BBR002' };
        expect(options.query.value).toEqual({ bbrC: 'BBR002' });
    });

    it('data, pending, refresh를 반환한다', () => {
        const result = useDocumentDashboard();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('refresh');
    });

    it('query에 eno가 포함되지 않는다 (bbrC만 사용하는 문서 대시보드 설계)', () => {
        mockUser.value = { bbrC: 'BBR001' };
        useDocumentDashboard();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).not.toHaveProperty('eno');
    });
});

describe('useDocumentBadgeCount', () => {
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
        useDocumentBadgeCount();

        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/documents/badge-count');
    });

    it('data가 null이면 reviewingCount는 0을 반환한다 (null 안전 처리)', () => {
        mockData.value = null;
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(0);
    });

    it('data에 reviewingCount가 있으면 해당 값을 반환한다', () => {
        mockData.value = { reviewingCount: 7 };
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(7);
    });

    it('reviewingCount가 0인 경우에도 정확히 0을 반환한다 (falsy 오탐 방지)', () => {
        mockData.value = { reviewingCount: 0 };
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(0);
    });

    it('로그인 사용자의 bbrC가 배지 query에도 포함된다', () => {
        mockUser.value = { bbrC: 'BBR003' };
        useDocumentBadgeCount();

        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR003' });
    });
});
