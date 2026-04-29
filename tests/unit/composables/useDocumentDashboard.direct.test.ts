/**
 * ============================================================================
 * [tests/unit/composables/useDocumentDashboard.direct.test.ts]
 * 요구사항 정의서 대시보드 Composable 직접 import 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================
const mockUseApiFetch = vi.fn();
const mockUser = ref<{ bbrC: string } | null>(null);

vi.stubGlobal('useApiFetch', mockUseApiFetch);
vi.stubGlobal('useAuth', () => ({ user: mockUser }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));
vi.stubGlobal('computed', computed);

import { useDocumentDashboard, useDocumentBadgeCount } from '~/composables/useDocumentDashboard';

describe('useDocumentDashboard (직접 import)', () => {
    beforeEach(() => {
        mockUseApiFetch.mockReset();
        mockUser.value = null;
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false), refresh: vi.fn() });
    });

    it('대시보드 URL로 useApiFetch를 호출한다', () => {
        useDocumentDashboard();
        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/documents/dashboard');
    });

    it('로그인 사용자의 bbrC를 query에 포함한다', () => {
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

    it('data, pending, refresh를 반환한다', () => {
        const result = useDocumentDashboard();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('refresh');
    });

    it('query에 eno가 포함되지 않는다', () => {
        mockUser.value = { bbrC: 'BBR001' };
        useDocumentDashboard();
        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).not.toHaveProperty('eno');
    });
});

describe('useDocumentBadgeCount (직접 import)', () => {
    beforeEach(() => {
        mockUseApiFetch.mockReset();
        mockUser.value = null;
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false), refresh: vi.fn() });
    });

    it('배지 전용 URL로 useApiFetch를 호출한다', () => {
        useDocumentBadgeCount();
        const [url] = mockUseApiFetch.mock.calls[0];
        expect(url).toBe('http://localhost:8080/api/documents/badge-count');
    });

    it('data가 null이면 reviewingCount는 0이다', () => {
        mockUseApiFetch.mockReturnValue({ data: ref(null), pending: ref(false) });
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(0);
    });

    it('data에 reviewingCount가 있으면 해당 값을 반환한다', () => {
        mockUseApiFetch.mockReturnValue({
            data: ref({ reviewingCount: 7 }),
            pending: ref(false),
        });
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(7);
    });

    it('reviewingCount가 0인 경우에도 정확히 0을 반환한다', () => {
        mockUseApiFetch.mockReturnValue({
            data: ref({ reviewingCount: 0 }),
            pending: ref(false),
        });
        const { reviewingCount } = useDocumentBadgeCount();
        expect(reviewingCount.value).toBe(0);
    });

    it('로그인 사용자의 bbrC가 query에 포함된다', () => {
        mockUser.value = { bbrC: 'BBR003' };
        useDocumentBadgeCount();
        const [, options] = mockUseApiFetch.mock.calls[0];
        expect(options.query.value).toEqual({ bbrC: 'BBR003' });
    });
});
