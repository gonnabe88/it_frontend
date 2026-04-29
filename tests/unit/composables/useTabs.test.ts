/**
 * ============================================================================
 * [tests/unit/composables/useTabs.test.ts] 탭 네비게이션 Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ============================================================================
// Mock 설정 — useTabs는 useState/useRouter/useRoute를 Nuxt auto-import로 사용
// ============================================================================
const mockPush = vi.fn();

// useState: 탭 배열을 ref로 시뮬레이션 (전역 공유 상태)
let tabsState = ref<Array<{ title: string; path: string; fullPath: string }>>([]);
vi.stubGlobal('useState', (_key: string, init?: () => unknown) => {
    if (tabsState.value.length === 0 && typeof init === 'function') {
        tabsState.value = init() as never;
    }
    return tabsState;
});

vi.stubGlobal('useRouter', () => ({ push: mockPush }));

// useRoute는 각 테스트에서 경로를 바꿀 수 있도록 getter 방식으로 관리
let currentPath = '/';
vi.stubGlobal('useRoute', () => ({ path: currentPath }));

import { useTabs } from '~/composables/useTabs';

describe('useTabs', () => {
    beforeEach(() => {
        mockPush.mockReset();
        tabsState.value = [];
        currentPath = '/';
    });

    // -------------------------------------------------------------------------
    // addTab
    // -------------------------------------------------------------------------
    describe('addTab', () => {
        it('새 탭을 추가한다', () => {
            const { addTab, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: { title: '프로젝트 목록' } });
            expect(tabs.value).toHaveLength(1);
            expect(tabs.value[0].title).toBe('프로젝트 목록');
            expect(tabs.value[0].path).toBe('/info/projects');
        });

        it('같은 path의 탭은 중복 추가하지 않는다', () => {
            const { addTab, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: {} });
            addTab({ path: '/info/projects', fullPath: '/info/projects?year=2026', meta: {} });
            expect(tabs.value).toHaveLength(1);
        });

        it('meta.title이 없고 path가 "/"이면 title은 "홈"이다', () => {
            const { addTab, tabs } = useTabs();
            addTab({ path: '/', fullPath: '/', meta: {} });
            expect(tabs.value[0].title).toBe('홈');
        });

        it('meta.title이 없으면 경로 마지막 세그먼트를 title로 사용한다', () => {
            const { addTab, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: {} });
            expect(tabs.value[0].title).toBe('projects');
        });

        it('meta가 없으면 경로 마지막 세그먼트를 title로 사용한다', () => {
            const { addTab, tabs } = useTabs();
            addTab({ path: '/admin/users', fullPath: '/admin/users' });
            expect(tabs.value[0].title).toBe('users');
        });

        it('true를 반환한다', () => {
            const { addTab } = useTabs();
            const result = addTab({ path: '/test', fullPath: '/test', meta: {} });
            expect(result).toBe(true);
        });

        it('중복 탭에서도 true를 반환한다', () => {
            const { addTab } = useTabs();
            addTab({ path: '/test', fullPath: '/test', meta: {} });
            const result = addTab({ path: '/test', fullPath: '/test', meta: {} });
            expect(result).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // removeTab
    // -------------------------------------------------------------------------
    describe('removeTab', () => {
        it('지정한 path의 탭을 제거한다', () => {
            const { addTab, removeTab, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: { title: '프로젝트' } });
            addTab({ path: '/info/cost', fullPath: '/info/cost', meta: { title: '전산업무비' } });
            removeTab('/info/projects');
            expect(tabs.value).toHaveLength(1);
            expect(tabs.value[0].path).toBe('/info/cost');
        });

        it('현재 보고 있는 탭을 닫으면 이전 탭으로 이동한다', () => {
            currentPath = '/info/projects';
            vi.stubGlobal('useRoute', () => ({ path: currentPath }));

            const { addTab, removeTab } = useTabs();
            addTab({ path: '/info/cost', fullPath: '/info/cost', meta: { title: '전산업무비' } });
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: { title: '프로젝트' } });
            removeTab('/info/projects');
            expect(mockPush).toHaveBeenCalledWith('/info/cost');
        });

        it('현재 탭을 닫고 탭이 없으면 홈으로 이동한다', () => {
            currentPath = '/info/projects';
            vi.stubGlobal('useRoute', () => ({ path: currentPath }));

            const { addTab, removeTab } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: { title: '프로젝트' } });
            removeTab('/info/projects');
            expect(mockPush).toHaveBeenCalledWith('/');
        });

        it('다른 탭을 닫으면 router.push를 호출하지 않는다', () => {
            currentPath = '/info/cost';
            vi.stubGlobal('useRoute', () => ({ path: currentPath }));

            const { addTab, removeTab } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: {} });
            addTab({ path: '/info/cost', fullPath: '/info/cost', meta: {} });
            removeTab('/info/projects');
            expect(mockPush).not.toHaveBeenCalled();
        });

        it('존재하지 않는 path는 아무것도 하지 않는다', () => {
            const { addTab, removeTab, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: {} });
            removeTab('/not-exist');
            expect(tabs.value).toHaveLength(1);
            expect(mockPush).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // closeAll
    // -------------------------------------------------------------------------
    describe('closeAll', () => {
        it('현재 탭만 남기고 나머지를 모두 닫는다', () => {
            currentPath = '/info/projects';
            vi.stubGlobal('useRoute', () => ({ path: currentPath }));

            const { addTab, closeAll, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: { title: '프로젝트' } });
            addTab({ path: '/info/cost', fullPath: '/info/cost', meta: { title: '전산업무비' } });
            addTab({ path: '/admin/users', fullPath: '/admin/users', meta: { title: '사용자 관리' } });
            closeAll();
            expect(tabs.value).toHaveLength(1);
            expect(tabs.value[0].path).toBe('/info/projects');
        });

        it('탭이 하나뿐이면 그대로 유지한다', () => {
            currentPath = '/info/projects';
            vi.stubGlobal('useRoute', () => ({ path: currentPath }));

            const { addTab, closeAll, tabs } = useTabs();
            addTab({ path: '/info/projects', fullPath: '/info/projects', meta: {} });
            closeAll();
            expect(tabs.value).toHaveLength(1);
        });
    });
});
