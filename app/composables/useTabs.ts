export interface Tab {
    title: string;
    path: string;
    fullPath: string;
}

export const useTabs = () => {
    const tabs = useState<Tab[]>('tabs', () => []);
    const router = useRouter();
    const route = useRoute();

    const addTab = (newRoute: any) => {
        const existingTab = tabs.value.find(t => t.path === newRoute.path);
        if (!existingTab) {
            // 제목 결정 로직: meta.title -> meta.header -> path
            let title = '새 탭';
            if (newRoute.meta && newRoute.meta.title) {
                title = newRoute.meta.title as string;
            } else if (newRoute.path === '/') {
                title = '홈';
            } else {
                // 경로의 마지막 부분을 제목으로 사용 (예: /info/projects -> projects)
                const parts = newRoute.path.split('/').filter(Boolean);
                title = parts.length > 0 ? parts[parts.length - 1] : '홈';
                // 한글 매핑이 필요하면 여기서 추가하거나, 페이지별 meta에 title을 정의하는 것이 좋음
            }

            // 최대 10개 제한
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

    const removeTab = (path: string) => {
        const index = tabs.value.findIndex(t => t.path === path);
        if (index !== -1) {
            tabs.value.splice(index, 1);

            // 현재 보고 있는 탭을 닫았을 때 이동 처리
            if (route.path === path) {
                if (tabs.value.length > 0) {
                    // 바로 이전 탭이나 다음 탭으로 이동
                    const nextTab = tabs.value[Math.max(0, index - 1)];
                    router.push(nextTab.fullPath);
                } else {
                    router.push('/');
                }
            }
        }
    };

    const closeAll = () => {
        const currentPath = route.path;
        tabs.value = tabs.value.filter(t => t.path === currentPath);
    };

    return {
        tabs,
        addTab,
        removeTab,
        closeAll
    };
};
