# [Design] 프론트엔드 테스트 구성 (Vitest + Playwright)

> Plan 참조: `docs/01-plan/features/frontend-test-setup.plan.md`

---

## 1. 전체 아키텍처

```
it_frontend/
├── vitest.config.ts              # Vitest 설정 (단위/통합 테스트)
├── playwright.config.ts          # Playwright 설정 (E2E 테스트)
├── tests/
│   ├── unit/                     # Vitest 단위 테스트
│   │   ├── utils/
│   │   │   └── common.test.ts    # formatBudget, getApprovalTagClass, getProjectTagClass
│   │   ├── stores/
│   │   │   └── auth.test.ts      # useAuthStore (login, logout, restoreSession, refresh)
│   │   └── composables/
│   │       └── useApiFetch.test.ts  # 옵션 병합, credentials, watch 설정
│   └── e2e/                      # Playwright E2E 테스트
│       ├── auth.spec.ts          # 로그인/로그아웃 플로우
│       ├── projects.spec.ts      # 정보화사업 목록 조회
│       ├── cost.spec.ts          # 전산업무비 목록 조회
│       └── approval.spec.ts      # 전자결재 목록 조회
└── package.json                  # test 스크립트 추가
```

---

## 2. 설정 파일 상세 설계

### 2.1 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue()],
    test: {
        // 브라우저 환경 시뮬레이션 (DOM API, localStorage 등 지원)
        environment: 'happy-dom',
        // 각 테스트 파일마다 DOM/전역 상태를 초기화
        clearMocks: true,
        // 전역 API 자동 주입 (describe, it, expect 등 import 불필요)
        globals: true,
    },
    resolve: {
        alias: {
            // Nuxt의 ~ / @ alias를 동일하게 적용
            '~': resolve(__dirname, 'app'),
            '@': resolve(__dirname, 'app'),
        }
    }
});
```

**Nuxt auto-import 처리 전략:**
- `defineStore`, `ref`, `computed` 등 Nuxt auto-import 함수는 테스트 파일에서 명시적으로 import
- `useRuntimeConfig`, `useToast`, `navigateTo` 등 Nuxt 전용 composable은 `vi.mock()`으로 처리

### 2.2 `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // 각 테스트는 3번까지 재시도 (CI 환경 안정성)
    retries: process.env.CI ? 2 : 0,
    // 브라우저 1개만 사용 (로컬 환경 속도 최적화)
    workers: 1,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        // 실패 시 스크린샷 자동 저장
        screenshot: 'only-on-failure',
        // API 요청에 쿠키 자동 포함 (httpOnly 쿠키 시뮬레이션)
        extraHTTPHeaders: { 'Accept': 'application/json' }
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ],
    // 테스트 전 dev 서버 자동 실행
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000
    }
});
```

### 2.3 `package.json` 스크립트 추가

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 3. 단위 테스트 상세 설계

### 3.1 `tests/unit/utils/common.test.ts`

**대상**: `app/utils/common.ts`의 순수 함수 4개

#### `formatBudget` 테스트 케이스

```typescript
import { describe, it, expect } from 'vitest';
import { formatBudget } from '~/utils/common';

describe('formatBudget', () => {
    // --- 단위 변환 정확성 ---
    it('천원 단위로 변환한다', () => {
        expect(formatBudget(1500000, '천원')).toBe('1,500');
    });

    it('백만원 단위로 변환하고 소수점 1자리를 표시한다', () => {
        expect(formatBudget(1500000, '백만원')).toBe('1.5');
    });

    it('억원 단위로 변환하고 소수점 1자리를 표시한다', () => {
        expect(formatBudget(150000000, '억원')).toBe('1.5');
    });

    it('원 단위는 변환 없이 천 단위 구분자만 적용한다', () => {
        expect(formatBudget(1500, '원')).toBe('1,500');
    });

    // --- 엣지 케이스 ---
    it('0원은 0으로 반환한다', () => {
        expect(formatBudget(0, '천원')).toBe('0');
    });

    it('알 수 없는 단위는 원 단위처럼 처리한다', () => {
        expect(formatBudget(1500, '달러')).toBe('1,500');
    });
});
```

#### `getApprovalTagClass` 테스트 케이스

```typescript
import { getApprovalTagClass } from '~/utils/common';

describe('getApprovalTagClass', () => {
    it.each([
        ['결재완료', 'kdb-tag-green'],
        ['반려',     'kdb-tag-red'],
        ['결재중',   'kdb-tag-blue'],
        ['임시저장', 'kdb-tag-gray'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getApprovalTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getApprovalTagClass('미정의상태')).toBe('kdb-tag-gray');
    });
});
```

#### `getProjectTagClass` 테스트 케이스

```typescript
import { getProjectTagClass } from '~/utils/common';

describe('getProjectTagClass', () => {
    it.each([
        ['예산 작성',   'kdb-tag-yellow'],
        ['사전 협의',   'kdb-tag-green'],
        ['정실협',      'kdb-tag-indigo'],
        ['요건 상세화', 'kdb-tag-purple'],
        ['소요예산 산정','kdb-tag-pink'],
        ['과심위',      'kdb-tag-orange'],
        ['입찰/계약',   'kdb-tag-cyan'],
        ['사업 추진',   'kdb-tag-green'],
        ['예산배정',    'kdb-tag-teal'],
        ['대금지급',    'kdb-tag-teal'],
        ['성과평가',    'kdb-tag-rose'],
        ['완료',        'kdb-tag-slate'],
    ])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
        expect(getProjectTagClass(status)).toBe(expected);
    });

    it('알 수 없는 상태는 기본 gray 클래스를 반환한다', () => {
        expect(getProjectTagClass('없는상태')).toBe('kdb-tag-gray');
    });
});
```

#### `getApprovalAuthority` 테스트 케이스

```typescript
import { getApprovalAuthority } from '~/utils/common';

describe('getApprovalAuthority', () => {
    it('자본예산 20억 이상은 회장이다', () => {
        expect(getApprovalAuthority(2000000000, 0)).toBe('회장');
    });

    it('자본예산 10억 이상은 전무이사이다', () => {
        expect(getApprovalAuthority(1000000000, 0)).toBe('전무이사');
    });

    it('일반관리비가 더 높은 등급이면 일반관리비 기준을 적용한다', () => {
        // 자본예산 0 (부장), 일반관리비 5억 이상 (회장) → 회장
        expect(getApprovalAuthority(0, 500000000)).toBe('회장');
    });

    it('두 기준 중 더 높은 등급을 반환한다', () => {
        // 자본예산 20억(회장) vs 일반관리비 5억(회장) → 회장
        expect(getApprovalAuthority(2000000000, 500000000)).toBe('회장');
    });

    it('자본예산 2억 미만, 일반관리비 3천만 미만은 부장이다', () => {
        expect(getApprovalAuthority(100000000, 10000000)).toBe('부장');
    });
});
```

---

### 3.2 `tests/unit/stores/auth.test.ts`

**대상**: `app/stores/auth.ts`의 `useAuthStore`

**Mock 전략**: Nuxt 전용 API를 `vi.mock()`으로 처리

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';

// Nuxt 전용 API Mock
vi.mock('#app', () => ({
    useRuntimeConfig: () => ({ public: { apiBase: 'http://localhost:8080' } }),
    navigateTo: vi.fn(),
}));

// $fetch Mock (stores/auth.ts에서 직접 사용)
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// localStorage Mock (happy-dom 기본 제공이나 명시적 초기화)
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
vi.stubGlobal('localStorage', localStorageMock);
```

#### `restoreSession` 테스트 케이스 (P0)

```typescript
describe('restoreSession', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorageMock.clear();
    });

    it('localStorage에 user가 있으면 상태를 복원한다', () => {
        const store = useAuthStore();
        localStorageMock.setItem('user', JSON.stringify({ eno: 'E001', empNm: '홍길동' }));

        store.restoreSession();

        expect(store.user).toEqual({ eno: 'E001', empNm: '홍길동' });
        expect(store.isAuthenticated).toBe(true);
    });

    it('localStorage가 비어있으면 user는 null 상태를 유지한다', () => {
        const store = useAuthStore();
        store.restoreSession();
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
    });

    it('localStorage의 JSON이 손상되면 clearAuth()를 호출하고 user를 null로 초기화한다', () => {
        const store = useAuthStore();
        localStorageMock.setItem('user', '{ invalid json }');
        // 손상된 데이터가 있어도 에러 없이 처리
        store.restoreSession();
        expect(store.user).toBeNull();
        expect(localStorageMock.getItem('user')).toBeNull();
    });
});
```

#### `login` 테스트 케이스 (P1)

```typescript
describe('login', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    it('로그인 성공 시 user 상태를 설정하고 localStorage에 저장한다', async () => {
        const store = useAuthStore();
        mockFetch.mockResolvedValueOnce({ eno: 'E001', empNm: '홍길동' });

        await store.login({ eno: 'E001', password: 'pass123' });

        expect(store.user).toEqual({ eno: 'E001', empNm: '홍길동' });
        expect(store.isAuthenticated).toBe(true);
        const stored = JSON.parse(localStorageMock.getItem('user') ?? '{}');
        expect(stored).toEqual({ eno: 'E001', empNm: '홍길동' });
    });

    it('로그인 실패 시 에러를 throw하고 user는 null을 유지한다', async () => {
        const store = useAuthStore();
        mockFetch.mockRejectedValueOnce(new Error('401 Unauthorized'));

        await expect(store.login({ eno: 'E001', password: 'wrong' })).rejects.toThrow();
        expect(store.user).toBeNull();
    });
});
```

#### `logout` 테스트 케이스 (P1)

```typescript
describe('logout', () => {
    it('logout 호출 시 user를 null로 초기화하고 localStorage를 비운다', async () => {
        const store = useAuthStore();
        // 로그인 상태 설정
        store.user = { eno: 'E001', empNm: '홍길동' };
        localStorageMock.setItem('user', JSON.stringify({ eno: 'E001', empNm: '홍길동' }));

        mockFetch.mockResolvedValueOnce(undefined);
        await store.logout();

        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(localStorageMock.getItem('user')).toBeNull();
    });

    it('logout API 실패 시에도 클라이언트 상태를 초기화한다', async () => {
        const store = useAuthStore();
        store.user = { eno: 'E001', empNm: '홍길동' };
        mockFetch.mockRejectedValueOnce(new Error('Network Error'));

        await store.logout(); // 에러 throw 없이 처리
        expect(store.user).toBeNull();
    });
});
```

#### `refresh` 테스트 케이스 (P1)

```typescript
describe('refresh', () => {
    it('user가 없으면 false를 반환한다', async () => {
        const store = useAuthStore();
        const result = await store.refresh();
        expect(result).toBe(false);
    });

    it('토큰 갱신 성공 시 true를 반환한다', async () => {
        const store = useAuthStore();
        store.user = { eno: 'E001', empNm: '홍길동' };
        mockFetch.mockResolvedValueOnce(undefined);

        const result = await store.refresh();
        expect(result).toBe(true);
    });

    it('토큰 갱신 실패 시 false를 반환하고 logout을 호출한다', async () => {
        const store = useAuthStore();
        store.user = { eno: 'E001', empNm: '홍길동' };
        mockFetch.mockRejectedValueOnce(new Error('refresh failed'));
        // logout의 $fetch도 Mock
        mockFetch.mockResolvedValueOnce(undefined);

        const result = await store.refresh();
        expect(result).toBe(false);
        expect(store.user).toBeNull();
    });
});
```

---

### 3.3 `tests/unit/composables/useApiFetch.test.ts`

**대상**: `app/composables/useApiFetch.ts`의 옵션 병합 로직

**Mock 전략**: `useFetch`, `useAuth`, `useToast`를 모두 Mock 처리

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// useFetch Mock - 전달된 params를 캡처하여 검증
const mockUseFetch = vi.fn();
vi.mock('#app', () => ({ useFetch: mockUseFetch }));
vi.mock('~/composables/useAuth', () => ({
    useAuth: () => ({ refresh: vi.fn(), logout: vi.fn() })
}));
vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: vi.fn() })
}));

describe('useApiFetch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('credentials: "include"를 항상 포함한다', () => {
        useApiFetch('/api/projects');
        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.credentials).toBe('include');
    });

    it('server: false를 항상 설정한다 (클라이언트 전용)', () => {
        useApiFetch('/api/projects');
        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.server).toBe(false);
    });

    it('tokenRefreshSignal이 watch 배열에 포함된다', () => {
        useApiFetch('/api/projects');
        const [, params] = mockUseFetch.mock.calls[0];
        expect(Array.isArray(params.watch)).toBe(true);
        expect(params.watch.length).toBeGreaterThanOrEqual(1);
    });

    it('호출자의 watch 옵션과 tokenRefreshSignal을 병합한다', () => {
        const customWatch = ref('test');
        useApiFetch('/api/projects', { watch: [customWatch] });
        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.watch).toContain(customWatch);
        expect(params.watch.length).toBeGreaterThanOrEqual(2);
    });

    it('watch: false인 경우 tokenRefreshSignal만 포함한다', () => {
        useApiFetch('/api/projects', { watch: false });
        const [, params] = mockUseFetch.mock.calls[0];
        // watch: false여도 tokenRefreshSignal은 포함
        expect(Array.isArray(params.watch)).toBe(true);
        expect(params.watch.length).toBe(1);
    });

    it('호출자 옵션(query 등)이 그대로 전달된다', () => {
        useApiFetch('/api/projects', { query: { year: 2025 } });
        const [, params] = mockUseFetch.mock.calls[0];
        expect(params.query).toEqual({ year: 2025 });
    });
});
```

---

## 4. E2E 테스트 상세 설계

### 4.1 공통 Mock 헬퍼 (`tests/e2e/helpers/mockApi.ts`)

```typescript
import type { Page } from '@playwright/test';

/**
 * 로그인 API Mock 설정
 * POST /api/auth/login → 200 응답 + 쿠키 세팅 시뮬레이션
 */
export async function mockLoginApi(page: Page, user = { eno: 'E001', empNm: '홍길동' }) {
    await page.route('**/api/auth/login', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(user)
        });
    });
}

/**
 * 특정 API Mock 설정
 */
export async function mockApi<T>(page: Page, urlPattern: string, body: T, status = 200) {
    await page.route(`**${urlPattern}`, route => {
        route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });
    });
}

/**
 * 로그인 상태 세팅 헬퍼 (테스트 시작 시 공통 사용)
 * localStorage에 user 정보를 직접 세팅하여 로그인 플로우 생략
 */
export async function setLoggedIn(page: Page, user = { eno: 'E001', empNm: '홍길동' }) {
    await page.addInitScript((u) => {
        localStorage.setItem('user', JSON.stringify(u));
    }, user);
}
```

### 4.2 `tests/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { mockLoginApi, mockApi } from './helpers/mockApi';

test.describe('인증 플로우', () => {
    test('로그인 성공 시 대시보드로 이동한다', async ({ page }) => {
        await mockLoginApi(page);
        await mockApi(page, '/api/auth/logout', {});

        await page.goto('/login');
        await page.getByLabel('사원번호').fill('E001');
        await page.getByLabel('비밀번호').fill('password123');
        await page.getByRole('button', { name: '로그인' }).click();

        // 로그인 후 대시보드 또는 홈으로 리다이렉트
        await expect(page).toHaveURL(/\/(info|budget|approval)?/);
    });

    test('로그인 실패 시 에러 메시지를 표시한다', async ({ page }) => {
        await page.route('**/api/auth/login', route => {
            route.fulfill({ status: 401, body: JSON.stringify({ message: '인증 실패' }) });
        });

        await page.goto('/login');
        await page.getByLabel('사원번호').fill('E001');
        await page.getByLabel('비밀번호').fill('wrong');
        await page.getByRole('button', { name: '로그인' }).click();

        // 에러 Toast 또는 에러 메시지 표시 확인
        await expect(page.getByText(/로그인|인증|오류/)).toBeVisible({ timeout: 5000 });
    });
});
```

### 4.3 `tests/e2e/projects.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

const mockProjects = [
    { prjId: 1, prjNm: '테스트 프로젝트 A', prjSts: '사업 추진', year: 2025 },
    { prjId: 2, prjNm: '테스트 프로젝트 B', prjSts: '완료', year: 2025 }
];

test.describe('정보화사업 프로젝트 목록', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockApi(page, '/api/projects', mockProjects);
    });

    test('프로젝트 목록을 표시한다', async ({ page }) => {
        await page.goto('/info/projects');
        await expect(page.getByText('테스트 프로젝트 A')).toBeVisible();
        await expect(page.getByText('테스트 프로젝트 B')).toBeVisible();
    });

    test('프로젝트 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/info/projects');
        await expect(page.getByText('사업 추진')).toBeVisible();
        await expect(page.getByText('완료')).toBeVisible();
    });
});
```

### 4.4 `tests/e2e/cost.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

const mockCosts = [
    { costId: 1, costNm: '전산임차료 A', costSts: '예산 작성', year: 2025 },
];

test.describe('전산업무비 목록', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockApi(page, '/api/costs', mockCosts);
    });

    test('전산업무비 목록을 표시한다', async ({ page }) => {
        await page.goto('/info/cost');
        await expect(page.getByText('전산임차료 A')).toBeVisible();
    });
});
```

### 4.5 `tests/e2e/approval.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setLoggedIn, mockApi } from './helpers/mockApi';

const mockApprovals = [
    { apfId: 1, apfTitle: '결재문서 A', apfSts: '결재중' }
];

test.describe('전자결재 목록', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockApi(page, '/api/approvals', mockApprovals);
    });

    test('전자결재 목록을 표시한다', async ({ page }) => {
        await page.goto('/approval');
        await expect(page.getByText('결재문서 A')).toBeVisible();
    });

    test('결재 상태 태그가 표시된다', async ({ page }) => {
        await page.goto('/approval');
        await expect(page.getByText('결재중')).toBeVisible();
    });
});
```

---

## 5. 패키지 의존성

### 5.1 설치 명령

```bash
# Vitest 단위 테스트
npm install -D vitest @vitejs/plugin-vue @vue/test-utils @pinia/testing happy-dom @vitest/coverage-v8

# Playwright E2E 테스트
npm install -D @playwright/test
npx playwright install chromium
```

### 5.2 최종 devDependencies 추가 목록

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `vitest` | ^2.x | 단위 테스트 러너 |
| `@vitejs/plugin-vue` | ^5.x | Vue SFC 파일 처리 |
| `@vue/test-utils` | ^2.x | Vue 컴포넌트 마운트 |
| `@pinia/testing` | ^0.x | Pinia store 테스트 헬퍼 |
| `happy-dom` | ^14.x | 경량 브라우저 환경 |
| `@vitest/coverage-v8` | ^2.x | 코드 커버리지 리포트 |
| `@playwright/test` | ^1.x | E2E 테스트 러너 |

---

## 6. 구현 순서 (Do Phase 참고용)

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | 패키지 설치 | `package-lock.json` 업데이트 |
| 2 | `vitest.config.ts` 작성 | 설정 파일 |
| 3 | `tests/unit/utils/common.test.ts` 작성 | P0 단위 테스트 |
| 4 | `npm run test` 실행 확인 | ✅ 통과 |
| 5 | `tests/unit/stores/auth.test.ts` 작성 | P0/P1 단위 테스트 |
| 6 | `tests/unit/composables/useApiFetch.test.ts` 작성 | P1 단위 테스트 |
| 7 | `playwright.config.ts` 작성 | E2E 설정 파일 |
| 8 | `tests/e2e/helpers/mockApi.ts` 작성 | 공통 헬퍼 |
| 9 | `tests/e2e/auth.spec.ts` 작성 | P1 E2E 테스트 |
| 10 | `tests/e2e/projects.spec.ts` 작성 | P2 E2E 테스트 |
| 11 | `tests/e2e/cost.spec.ts` 작성 | P2 E2E 테스트 |
| 12 | `tests/e2e/approval.spec.ts` 작성 | P2 E2E 테스트 |
| 13 | `npm run test:e2e` 실행 확인 | ✅ 통과 |

---

## 7. 검증 기준 (Plan → Design 추적)

| Plan 성공 기준 | Design 구현 | 검증 방법 |
|---------------|-------------|----------|
| Vitest 테스트 케이스 최소 15개 | common.test.ts 14개 + auth.test.ts 8개 + useApiFetch.test.ts 6개 = **28개** | `npm run test` |
| `utils/common.ts` 100% 커버리지 | 모든 함수/분기 커버 | `npm run test:coverage` |
| Playwright E2E 시나리오 최소 4개 | auth(2) + projects(2) + cost(1) + approval(2) = **7개** | `npm run test:e2e` |
| `npm run test` 성공 | vitest.config.ts + 전체 테스트 파일 | 실행 확인 |
| `npm run test:e2e` 성공 | playwright.config.ts + Mock 설정 | 실행 확인 |
