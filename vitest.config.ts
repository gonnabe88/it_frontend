import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

/**
 * Nuxt의 import.meta.client / import.meta.server를 테스트 환경에서 교체하는 플러그인.
 * Vite의 define 옵션과 달리, 이 플러그인은 소스 코드의 문자열 치환을 직접 수행합니다.
 */
function nuxtMetaPlugin() {
    return {
        name: 'nuxt-meta-transform',
        transform(code: string, id: string) {
            // node_modules는 제외, app/ 및 tests/ 소스 파일만 변환
            if (id.includes('node_modules')) return null;
            if (!code.includes('import.meta.client') && !code.includes('import.meta.server')) return null;
            const transformed = code
                .replace(/import\.meta\.client/g, 'true')
                .replace(/import\.meta\.server/g, 'false');
            return { code: transformed, map: null };
        },
    };
}

export default defineConfig({
    plugins: [vue(), nuxtMetaPlugin()],
    server: {
        deps: {
            // quill은 모듈 로드 시 document에 접근하므로 Node.js native ESM이 아닌
            // Vite 파이프라인을 통해 처리해야 happy-dom 환경이 적용됨
            inline: ['quill'],
        }
    },
    test: {
        // 브라우저 환경 시뮬레이션 (DOM API, localStorage 등 지원)
        environment: 'happy-dom',
        // 각 테스트 실행 후 Mock 상태 초기화
        clearMocks: true,
        // 전역 API 자동 주입 (describe, it, expect 등 import 불필요)
        globals: true,
        // Nuxt auto-import 전역 스텁을 모든 테스트 실행 전에 등록
        setupFiles: ['tests/setup.ts'],
        // Playwright E2E 테스트 파일은 Vitest에서 제외 (playwright.config.ts에서 별도 실행)
        exclude: ['node_modules', 'tests/e2e/**'],
        // 리포트: 콘솔 + HTML (test-results/index.html)
        reporters: ['default', 'html'],
        outputFile: { html: 'test-results/index.html' },
        // 커버리지 설정: 단위 테스트 대상(utils, stores, composables) 파일만 측정
        // pages/layouts/components는 E2E 테스트(Playwright)로 커버되므로 단위 커버리지에서 제외
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: [
                'app/utils/**/*.ts',
                'app/stores/**/*.ts',
                'app/composables/**/*.ts',
                'app/middleware/**/*.ts',
            ],
            exclude: [
                'app/**/*.d.ts',
                'node_modules/**',
                'tests/**',
            ],
            thresholds: { lines: 60 },
        },
    },
    resolve: {
        alias: {
            // Nuxt의 ~ / @ alias를 동일하게 적용
            '~': resolve(__dirname, 'app'),
            '@': resolve(__dirname, 'app'),
            // Nuxt 내부 #imports alias → Vue로 대체 (Vitest 환경에서 Nuxt 빌드 파이프라인 없음)
            '#imports': 'vue',
        }
    }
});
