/**
 * ============================================================================
 * [tests/setup.ts] Vitest 전역 셋업 파일
 * ============================================================================
 * 모든 테스트 파일보다 먼저 실행되어 Nuxt auto-import 전역 함수들을
 * vi.stubGlobal로 등록합니다.
 *
 * 이 파일에서 등록된 스텁은 소스 모듈이 평가(import)되기 전에 적용되므로,
 * 모듈 최상위 레벨에서 전역 함수를 호출하는 코드(reactive, defineNuxtRouteMiddleware 등)를
 * 올바르게 처리할 수 있습니다.
 *
 * 개별 테스트 파일에서는 필요에 따라 이 스텁을 vi.stubGlobal로 덮어쓸 수 있습니다.
 * ============================================================================
 */
import { vi } from 'vitest';
import { ref, computed, reactive, watch, watchEffect, nextTick } from 'vue';

type NuxtMiddlewareFactory = (...args: unknown[]) => unknown;

// ============================================================================
// Vue 반응성 API (Nuxt auto-import 대응)
// ============================================================================
vi.stubGlobal('ref', ref);
vi.stubGlobal('computed', computed);
vi.stubGlobal('reactive', reactive);
vi.stubGlobal('watch', watch);
vi.stubGlobal('watchEffect', watchEffect);
vi.stubGlobal('nextTick', nextTick);

// ============================================================================
// Nuxt 라우터/미들웨어 API
// ============================================================================
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: NuxtMiddlewareFactory) => fn);
vi.stubGlobal('navigateTo', vi.fn());

// ============================================================================
// Nuxt 런타임 API (기본 no-op 구현, 개별 테스트에서 덮어쓰기 가능)
// ============================================================================
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' },
}));

vi.stubGlobal('useNuxtApp', () => ({
    $apiFetch: vi.fn(),
}));

vi.stubGlobal('useCookie', (_key: string, opts?: { default?: () => unknown }) => {
    return ref(opts?.default ? opts.default() : null);
});

vi.stubGlobal('useRoute', () => ({ params: {}, query: {}, path: '/' }));
vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }));

// ============================================================================
// Nuxt 유틸리티
// ============================================================================
vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
vi.stubGlobal('useFetch', vi.fn().mockResolvedValue({
    data: ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
}));
