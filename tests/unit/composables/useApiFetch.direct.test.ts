/**
 * ============================================================================
 * [tests/unit/composables/useApiFetch.direct.test.ts] useApiFetch 직접 import 테스트
 * ============================================================================
 * composables/useApiFetch.ts를 직접 import하여 소스 커버리지를 생성합니다.
 *
 * useApiFetch는 useFetch 래퍼로 다음을 테스트합니다:
 *  - credentials:'include' 옵션 전달
 *  - onRequestError 핸들러 (AbortError 억제, 네트워크 오류 Toast)
 *  - onResponseError 핸들러 (401→refresh, 403/404/5xx Toast)
 *  - tokenRefreshSignal을 watch에 포함
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import { useApiFetch } from '~/composables/useApiFetch';

// ============================================================================
// Mock 설정
// ============================================================================

const mockRefresh = vi.fn().mockResolvedValue(true);
const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockToastAdd = vi.fn();
const mockNavigateTo = vi.fn();

vi.stubGlobal('navigateTo', mockNavigateTo);
vi.stubGlobal('useAuth', () => ({
    refresh: mockRefresh,
    logout: mockLogout,
}));

// useFetch: 전달된 params를 캡처하여 반환
const mockUseFetch = vi.fn((url: unknown, params: unknown) => ({
    data: ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    _url: url,
    _params: params,
}));
vi.stubGlobal('useFetch', mockUseFetch);

// useApiFetch가 primevue/usetoast에서 직접 import함 — 모듈 수준 모킹
vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: mockToastAdd }),
}));

describe('useApiFetch (직접 import)', () => {
    beforeEach(() => {
        mockRefresh.mockReset().mockResolvedValue(true);
        mockLogout.mockReset().mockResolvedValue(undefined);
        mockToastAdd.mockReset();
        mockNavigateTo.mockReset();
        mockUseFetch.mockClear();
    });

    // -------------------------------------------------------------------------
    // 기본 옵션 전달
    // -------------------------------------------------------------------------
    describe('기본 옵션', () => {
        it('useFetch를 호출한다', () => {
            useApiFetch('/api/test');
            expect(mockUseFetch).toHaveBeenCalledTimes(1);
        });

        it('credentials: "include"를 설정한다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(params?.credentials).toBe('include');
        });

        it('server: false를 설정한다 (SSR 비활성화)', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(params?.server).toBe(false);
        });

        it('lazy: true를 설정한다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(params?.lazy).toBe(true);
        });

        it('watch 배열에 tokenRefreshSignal이 포함된다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(Array.isArray(params?.watch)).toBe(true);
            expect((params?.watch as unknown[]).length).toBeGreaterThan(0);
        });

        it('caller watch 옵션을 병합한다', () => {
            const extraWatch = ref(0);
            useApiFetch('/api/test', { watch: [extraWatch] });
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const watchArr = params?.watch as unknown[];
            expect(watchArr.length).toBeGreaterThan(1);
        });

        it('watch: false이면 tokenRefreshSignal만 포함한다', () => {
            useApiFetch('/api/test', { watch: false });
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const watchArr = params?.watch as unknown[];
            expect(watchArr.length).toBe(1);
        });

        it('suppressNotFound/suppressNetworkError는 useFetch에 전달하지 않는다', () => {
            useApiFetch('/api/test', { suppressNotFound: true, suppressNetworkError: true });
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            expect(params?.suppressNotFound).toBeUndefined();
            expect(params?.suppressNetworkError).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // onRequestError 핸들러
    // -------------------------------------------------------------------------
    describe('onRequestError 핸들러', () => {
        it('AbortError는 Toast를 표시하지 않는다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onRequestError as (ctx: unknown) => void;
            handler({ error: { name: 'AbortError' } });
            expect(mockToastAdd).not.toHaveBeenCalled();
        });

        it('"aborted" 메시지가 포함된 오류는 Toast를 표시하지 않는다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onRequestError as (ctx: unknown) => void;
            handler({ error: { name: 'FetchError', message: 'request aborted' } });
            expect(mockToastAdd).not.toHaveBeenCalled();
        });

        it('suppressNetworkError: true이면 Toast를 표시하지 않는다', () => {
            useApiFetch('/api/test', { suppressNetworkError: true });
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onRequestError as (ctx: unknown) => void;
            handler({ error: { name: 'NetworkError' } });
            expect(mockToastAdd).not.toHaveBeenCalled();
        });

        it('일반 네트워크 오류 시 Toast를 표시한다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onRequestError as (ctx: unknown) => void;
            // networkErrorLastShown 모듈 상태를 초기화하기 위해 충분한 시간이 지났다고 가정
            // Date.now()를 mock하여 항상 1초 이상 경과한 것처럼 설정
            const realNow = Date.now;
            vi.spyOn(Date, 'now').mockReturnValue(realNow() + 2000);
            handler({ error: { name: 'NetworkError', message: 'Connection refused' } });
            vi.restoreAllMocks();
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'error', summary: '네트워크 오류' })
            );
        });

        it('ctx가 undefined여도 에러가 발생하지 않는다', () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onRequestError as (ctx: unknown) => void;
            expect(() => handler(undefined)).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // onResponseError 핸들러
    // -------------------------------------------------------------------------
    describe('onResponseError 핸들러', () => {
        it('401 응답 시 refresh()를 호출한다', async () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 401 } as Response });
            expect(mockRefresh).toHaveBeenCalled();
        });

        it('401 refresh 성공 시 logout()을 호출하지 않는다', async () => {
            mockRefresh.mockResolvedValueOnce(true);
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 401 } as Response });
            expect(mockLogout).not.toHaveBeenCalled();
        });

        it('401 refresh 실패 시 logout()과 navigateTo("/login")을 호출한다', async () => {
            mockRefresh.mockResolvedValueOnce(false);
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 401 } as Response });
            expect(mockLogout).toHaveBeenCalled();
            expect(mockNavigateTo).toHaveBeenCalledWith('/login');
        });

        it('403 응답 시 권한 없음 Toast를 표시한다', async () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 403 } as Response });
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'warn', summary: '권한 없음' })
            );
        });

        it('404 응답 시 데이터 없음 Toast를 표시한다', async () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 404 } as Response });
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'warn', summary: '데이터 없음' })
            );
        });

        it('suppressNotFound: true이면 404 Toast를 표시하지 않는다', async () => {
            useApiFetch('/api/test', { suppressNotFound: true });
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 404 } as Response });
            expect(mockToastAdd).not.toHaveBeenCalled();
        });

        it('500 응답 시 서버 오류 Toast를 표시한다', async () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 500 } as Response });
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'error', summary: '서버 오류' })
            );
        });

        it('502 응답 시 서버 오류 Toast를 표시한다', async () => {
            useApiFetch('/api/test');
            const params = mockUseFetch.mock.calls[0]?.[1] as Record<string, unknown>;
            const handler = params?.onResponseError as (ctx: { response: Response }) => Promise<void>;
            await handler({ response: { status: 502 } as Response });
            expect(mockToastAdd).toHaveBeenCalledWith(
                expect.objectContaining({ severity: 'error', summary: '서버 오류' })
            );
        });
    });
});
