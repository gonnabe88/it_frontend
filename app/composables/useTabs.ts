/**
 * ============================================================================
 * [useTabs] 탭 네비게이션 관리 Composable
 * ============================================================================
 * IT 포털의 멀티탭 UI를 관리하는 composable입니다.
 * 사용자가 방문한 페이지를 탭으로 관리하여 브라우저 탭처럼 동작합니다.
 *
 * [제공 기능]
 *  - tabs     : 현재 열려있는 탭 목록 (Nuxt useState로 전역 공유)
 *  - addTab   : 새 탭 추가 (중복 방지, 최대 10개 제한)
 *  - removeTab: 탭 닫기 (현재 탭 닫기 시 인접 탭으로 자동 이동)
 *  - closeAll : 현재 탭을 제외한 모든 탭 닫기
 *
 * [상태 공유]
 *  - useState('tabs')를 사용하여 SSR/CSR 전환 시에도 상태가 유지됩니다.
 *  - 레이아웃과 여러 컴포넌트에서 동일한 탭 상태를 공유합니다.
 *
 * [사용처]
 *  - layouts/default.vue (탭 바 렌더링)
 *  - middleware/tabs.ts 또는 router afterEach (탭 자동 추가)
 * ============================================================================
 */

/**
 * [Tab] 탭 항목 인터페이스
 * 탭 바에 표시되는 단일 탭의 데이터 구조입니다.
 */
export interface Tab {
    title: string;    // 탭 표시 이름 (route.meta.title 또는 경로 기반 자동 결정)
    path: string;     // 라우트 경로 (중복 탭 판별 기준, 쿼리 파라미터 제외)
    fullPath: string; // 전체 경로 (쿼리/해시 포함, 탭 클릭 시 이동 대상)
}

/**
 * 멀티탭 네비게이션 관리 Composable 함수
 *
 * @returns 탭 상태 및 관리 함수 객체
 *   - tabs     : 열려있는 탭 배열 (Ref<Tab[]>)
 *   - addTab   : 탭 추가 함수
 *   - removeTab: 탭 제거 함수
 *   - closeAll : 현재 탭 제외 전체 닫기 함수
 */
export const useTabs = () => {
    /**
     * 탭 목록 전역 상태
     * useState를 사용하여 컴포넌트 간 동일한 상태 참조를 공유합니다.
     * 초기값은 빈 배열로 시작합니다.
     */
    const tabs = useState<Tab[]>('tabs', () => []);
    const router = useRouter();
    const route = useRoute();

    /**
     * 새 탭 추가
     * 이미 열려있는 탭(같은 path)은 중복 추가하지 않습니다.
     * 탭 제목은 다음 우선순위로 결정됩니다:
     *  1. route.meta.title (각 페이지에서 definePageMeta로 지정)
     *  2. 경로가 '/'인 경우 '홈'
     *  3. 경로의 마지막 세그먼트 (예: /info/projects → 'projects')
     *
     * 탭 개수가 10개를 초과하면 가장 오래된 탭(첫 번째)을 자동으로 제거합니다.
     *
     * @param newRoute - 추가할 라우트 정보 (path, fullPath, meta 포함)
     *
     * @example
     * // router.afterEach 훅에서 호출
     * router.afterEach((to) => {
     *   const { addTab } = useTabs();
     *   addTab(to);
     * });
     */
    const addTab = (newRoute: any) => {
        // path 기준으로 중복 탭 여부 확인 (쿼리가 달라도 같은 path면 중복)
        const existingTab = tabs.value.find(t => t.path === newRoute.path);
        if (!existingTab) {
            // 탭 제목 결정 로직 (우선순위: meta.title > 홈('/') > 경로 마지막 세그먼트)
            let title = '새 탭';
            if (newRoute.meta && newRoute.meta.title) {
                // 페이지에서 definePageMeta({ title: '...' })로 지정한 제목 사용
                title = newRoute.meta.title as string;
            } else if (newRoute.path === '/') {
                title = '홈';
            } else {
                // 경로의 마지막 부분을 제목으로 사용 (예: /info/projects → 'projects')
                // 한글 매핑이 필요하면 페이지별 meta.title을 지정하는 것이 권장됨
                const parts = newRoute.path.split('/').filter(Boolean);
                title = parts.length > 0 ? parts[parts.length - 1] : '홈';
            }

            // 탭 최대 10개 제한: 초과 시 가장 오래된 탭(배열 첫 번째)을 제거
            if (tabs.value.length > 10) {
                tabs.value.shift();
            }

            tabs.value.push({
                title,
                path: newRoute.path,
                fullPath: newRoute.fullPath
            });
        }
    };

    /**
     * 탭 제거 (닫기)
     * 지정된 path의 탭을 제거합니다.
     * 현재 보고 있는 탭을 닫은 경우 다음 탭으로 자동 이동합니다:
     *  - 이전 탭이 있으면 이전 탭으로 이동 (index - 1)
     *  - 이전 탭이 없으면 남은 탭 중 첫 번째로 이동
     *  - 탭이 모두 없으면 홈('/')으로 이동
     *
     * @param path - 닫을 탭의 라우트 경로 (Tab.path)
     *
     * @example
     * // 특정 탭의 닫기 버튼 클릭 시
     * removeTab('/info/projects');
     */
    const removeTab = (path: string) => {
        const index = tabs.value.findIndex(t => t.path === path);
        if (index !== -1) {
            tabs.value.splice(index, 1);

            // 현재 활성화된 탭을 닫은 경우 자동으로 다른 탭으로 이동
            if (route.path === path) {
                if (tabs.value.length > 0) {
                    // 삭제된 탭의 이전 위치 또는 첫 번째 탭으로 이동
                    const nextTab = tabs.value[Math.max(0, index - 1)];
                    router.push(nextTab.fullPath);
                } else {
                    // 탭이 모두 닫힌 경우 홈으로 이동
                    router.push('/');
                }
            }
        }
    };

    /**
     * 현재 탭을 제외한 모든 탭 닫기
     * 탭이 너무 많아질 때 정리하는 용도로 사용합니다.
     * 현재 보고 있는 페이지의 탭만 남기고 나머지는 모두 제거합니다.
     *
     * @example
     * // "다른 탭 모두 닫기" 컨텍스트 메뉴에서 호출
     * closeAll();
     */
    const closeAll = () => {
        const currentPath = route.path;
        // 현재 경로와 일치하는 탭만 남기고 나머지 필터링
        tabs.value = tabs.value.filter(t => t.path === currentPath);
    };

    return {
        tabs,
        addTab,
        removeTab,
        closeAll
    };
};
