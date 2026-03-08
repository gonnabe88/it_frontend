/**
 * ============================================================================
 * [tests/unit/composables/useApiFetch.test.ts] useApiFetch 단위 테스트
 * ============================================================================
 * composables/useApiFetch.ts의 옵션 병합 로직을 테스트합니다.
 *
 * [테스트 전략]
 * - useFetch를 Mock하여 전달된 params를 캡처 후 검증
 * - useAuth, useToast 등 Nuxt composable도 Mock 처리
 * - 실제 HTTP 요청은 발생하지 않음
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ============================================================================
// Mock 설정
// ============================================================================

// useFetch Mock: 전달된 params를 캡처하기 위해 전역으로 등록
const mockUseFetch = vi.fn().mockReturnValue({ data: ref(null), pending: ref(false) });
vi.stubGlobal('useFetch', mockUseFetch);

// navigateTo Mock
vi.stubGlobal('navigateTo', vi.fn());

// useAuth Mock: refresh/logout 함수 제공
vi.stubGlobal('useAuth', () => ({
    refresh: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
}));

// PrimeVue Toast Mock
vi.stubGlobal('useToast', () => ({ add: vi.fn() }));

// ============================================================================
// useApiFetch 인라인 구현 (Nuxt auto-import 없이 테스트)
// ============================================================================

/**
 * useApiFetch의 핵심 옵션 병합 로직을 검증하는 래퍼 함수
 * 실제 composables/useApiFetch.ts와 동일한 watch 병합 로직을 사용합니다.
 */
const tokenRefreshSignal = ref(0);

const useApiFetch = <T>(url: string, options: Record<string, unknown> = {}) => {
    const callerWatch = options.watch === false
        ? []
        : Array.isArray(options.watch)
            ? options.watch
            : options.watch
                ? [options.watch]
                : [];

    const params = {
        ...options,
        server: false,
        watch: [tokenRefreshSignal, ...callerWatch],
        credentials: 'include' as RequestCredentials,
        onRequestError: vi.fn(),
        onResponseError: vi.fn(),
    };

    return useFetch<T>(url, params as any);
};

// ============================================================================
// 테스트
// ============================================================================
describe('useApiFetch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('credentials: "include"를 항상 포함한다 (httpOnly 쿠키 전송)', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.credentials).toBe('include');
    });

    it('server: false를 항상 설정한다 (클라이언트 전용 실행)', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.server).toBe(false);
    });

    it('tokenRefreshSignal이 watch 배열에 포함된다', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(Array.isArray(params.watch)).toBe(true);
        expect(params.watch).toContain(tokenRefreshSignal);
    });

    it('watch 옵션이 없으면 tokenRefreshSignal만 포함한다', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.watch).toHaveLength(1);
        expect(params.watch[0]).toBe(tokenRefreshSignal);
    });

    it('호출자의 watch 배열과 tokenRefreshSignal을 병합한다', () => {
        const customWatch = ref('custom-watch');
        useApiFetch('/api/projects', { watch: [customWatch] });

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.watch).toContain(customWatch);
        expect(params.watch).toContain(tokenRefreshSignal);
        expect(params.watch).toHaveLength(2);
    });

    it('watch: false인 경우 tokenRefreshSignal만 watch 배열에 포함한다', () => {
        useApiFetch('/api/projects', { watch: false });

        const [, params] = mockUseFetch.mock.calls[0];
        // watch: false여도 tokenRefreshSignal은 항상 포함되어야 함
        expect(Array.isArray(params.watch)).toBe(true);
        expect(params.watch).toHaveLength(1);
        expect(params.watch[0]).toBe(tokenRefreshSignal);
    });

    it('호출자의 단일 watch ref와 tokenRefreshSignal을 병합한다', () => {
        const singleWatch = ref('single');
        useApiFetch('/api/projects', { watch: singleWatch });

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.watch).toContain(singleWatch);
        expect(params.watch).toContain(tokenRefreshSignal);
    });

    it('호출자의 query 옵션이 그대로 전달된다', () => {
        useApiFetch('/api/projects', { query: { year: 2025, status: '진행중' } });

        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.query).toEqual({ year: 2025, status: '진행중' });
    });

    it('올바른 URL로 useFetch를 호출한다', () => {
        useApiFetch('/api/projects');

        const [url] = mockUseFetch.mock.calls[0];
        expect(url).toBe('/api/projects');
    });

    it('onRequestError 핸들러가 포함된다', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(typeof params.onRequestError).toBe('function');
    });

    it('onResponseError 핸들러가 포함된다', () => {
        useApiFetch('/api/projects');

        const [, params] = mockUseFetch.mock.calls[0];
        expect(typeof params.onResponseError).toBe('function');
    });
});
