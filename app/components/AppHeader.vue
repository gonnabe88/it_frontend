<!--
================================================================================
[components/AppHeader.vue] 상단 헤더 네비게이션 컴포넌트
================================================================================
애플리케이션 상단에 고정된 헤더 바를 렌더링합니다.
각 메뉴 클릭 시 해당 경로로 이동하며 드롭다운 없이 동작합니다.

[메뉴 구성]
  - 사업·예산   : /info
  - IT·AI CDP   : /cdp
  - IT자체감사  : /audit
  - 전자결재    : /approval
  - 관리자      : 시스템관리자(ITPAD001) 전용 메뉴

[표시 조건]
  - 관리자 메뉴는 isAdmin 권한이 있는 사용자에게만 노출됩니다.
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import IconCrown from '~/components/icons/IconCrown.vue';
import GlobalSearchBar from '~/components/GlobalSearchBar.vue';
import { useAuth } from '~/composables/useAuth';
import { ROLE } from '~/types/auth';

const route = useRoute();
const router = useRouter();
const { user, logout } = useAuth();

// 시스템관리자 여부 (ITPAD001 역할 보유 시 [관리자] 메뉴 표시)
const isAdmin = computed(() => user.value?.athIds?.includes(ROLE.ADMIN));

interface NavItem {
    label: string;
    route: string;
    activePrefix: string;
    excludePrefix?: string;
    adminIcon?: boolean;
}

/** 단순 네비게이션 메뉴 목록 */
const navItems = computed<NavItem[]>(() => [
    { label: '사전협의', route: '/info/documents', activePrefix: '/info/documents' },
    { label: '사업·예산', route: '/info', activePrefix: '/info', excludePrefix: '/info/documents' },
    { label: 'IT·AI CDP', route: '/cdp', activePrefix: '/cdp' },
    { label: 'IT자체감사', route: '/audit', activePrefix: '/audit' },
    { label: '전자결재', route: '/approval', activePrefix: '/approval' },
    ...(isAdmin.value ? [{ label: '관리자', route: '/admin/codes', activePrefix: '/admin', adminIcon: true }] : [])
]);

/** 현재 경로가 메뉴 항목의 활성 경로에 해당하는지 확인 (excludePrefix가 있으면 해당 경로 제외) */
const isActive = (item: NavItem) =>
    route.path.startsWith(item.activePrefix) &&
    !(item.excludePrefix && route.path.startsWith(item.excludePrefix));

/**
 * 다크모드 상태
 * - useCookie를 사용하여 SSR/CSR 양쪽에서 동일한 초기값을 보장합니다.
 * - 쿠키값은 nuxt.config.ts 인라인 스크립트와 동기화됩니다.
 */
const isDark = useCookie<boolean>('theme-dark', { default: () => false });

/**
 * 실제 테마 적용 로직 (다크/라이트 전환)
 * toggleTheme()에서 View Transition 콜백으로 호출되거나, 미지원 시 직접 호출됩니다.
 */
const applyTheme = () => {
    isDark.value = !isDark.value;
    document.documentElement.classList.toggle('dark', isDark.value);
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';
};

/**
 * 다크모드 전환 핸들러 (View Transition API 활용)
 * View Transition API를 사용하여 부드러운 크로스페이드 전환을 수행합니다.
 * 미지원 브라우저에서는 applyTheme()을 즉시 실행합니다.
 */
const toggleTheme = () => {
    if (!document.startViewTransition) {
        applyTheme();
        return;
    }
    document.startViewTransition(() => applyTheme());
};

const handleLogout = async () => {
    await logout();
    router.push('/login');
};

onMounted(() => {
    document.documentElement.classList.toggle('dark', isDark.value);
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';
});

const { tabs, addTab, removeTab, closeAll } = useTabs();

// 탭 스크롤 컨테이너 참조
const tabContainer = ref<HTMLElement | null>(null);
// 좌우 스크롤 가능 여부
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

/** 탭 컨테이너의 스크롤 가능 여부를 갱신합니다 */
const updateScrollState = () => {
    const el = tabContainer.value;
    if (!el) return;
    canScrollLeft.value = el.scrollLeft > 0;
    canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
};

// --- 호버 시 연속 스크롤 ---
let scrollInterval: ReturnType<typeof setInterval> | null = null;

/** 마우스 호버 진입 시 해당 방향으로 연속 스크롤을 시작합니다 */
const startHoverScroll = (direction: 'left' | 'right') => {
    stopHoverScroll();
    const el = tabContainer.value;
    if (!el) return;
    const step = direction === 'left' ? -4 : 4;
    scrollInterval = setInterval(() => {
        el.scrollLeft += step;
        updateScrollState();
    }, 16);
};

/** 마우스 호버 이탈 시 연속 스크롤을 중지합니다 */
const stopHoverScroll = () => {
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
};

/** 클릭 시 호버 스크롤을 중지하고 맨 앞/맨 뒤로 이동합니다 */
const scrollToEdge = (direction: 'left' | 'right') => {
    stopHoverScroll();
    const el = tabContainer.value;
    if (!el) return;
    el.scrollTo({ left: direction === 'left' ? 0 : el.scrollWidth, behavior: 'smooth' });
};

// --- 탭 드래그 앤 드롭 ---
const dragIndex = ref<number | null>(null);
const dropTargetIndex = ref<number | null>(null);

/** 드래그 시작: 드래그 중인 탭의 인덱스를 저장합니다 */
const onDragStart = (e: DragEvent, index: number) => {
    dragIndex.value = index;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    }
};

/** 드래그 오버: 드롭 대상 위치를 표시합니다 */
const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dropTargetIndex.value = index;
};

/** 드롭: 탭 배열에서 위치를 교환합니다 */
const onDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex.value === null || dragIndex.value === targetIndex) {
        dragIndex.value = null;
        dropTargetIndex.value = null;
        return;
    }
    const [moved] = tabs.value.splice(dragIndex.value, 1);
    tabs.value.splice(targetIndex, 0, moved!);
    dragIndex.value = null;
    dropTargetIndex.value = null;
};

/** 드래그 종료: 상태 초기화 */
const onDragEnd = () => {
    dragIndex.value = null;
    dropTargetIndex.value = null;
};

// 라우트 변경 시 탭 추가
watch(() => route.path, () => {
    addTab(route);
    nextTick(() => updateScrollState());
}, { immediate: true });

// 탭 목록 변경 시 스크롤 상태 갱신
watch(tabs, () => nextTick(() => updateScrollState()), { deep: true });

// 마운트 후 리사이즈 감지
onMounted(() => {
    nextTick(() => updateScrollState());
    window.addEventListener('resize', updateScrollState);
});
onUnmounted(() => {
    stopHoverScroll();
    window.removeEventListener('resize', updateScrollState);
});

/**
 * 탭 클릭 시 네비게이션 + 데이터 새로고침
 * - 같은 경로: 현재 페이지 데이터만 새로고침
 * - 다른 경로: 이동 완료 후 대상 페이지 데이터 새로고침
 */
const navigateToTab = async (path: string) => {
    if (route.fullPath === path) {
        await refreshNuxtData();
    } else {
        await navigateTo(path);
        await refreshNuxtData();
    }
};
</script>

<template>
    <!-- data-allow-mismatch: SSR 초기 user 상태와 클라이언트 쿠키 복원 후 user 상태 간
         isAdmin 값 차이로 헤더 표시가 달라질 수 있습니다.
         기능적 문제 없으므로 헤더 전체에서 mismatch 경고를 억제합니다. -->
    <div class="card" data-allow-mismatch>
        <!-- 네비게이션 바 -->
        <div class="flex items-center bg-white dark:bg-zinc-900 px-4 py-2 border-none">
            <!-- 메뉴 항목 -->
            <nav class="flex items-center flex-1 gap-6">
                <button
                    v-for="item in navItems"
                    :key="item.label"
                    class="flex items-center px-4 py-2 font-semibold text-base whitespace-nowrap transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-800/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                    :class="isActive(item)
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-700 dark:text-zinc-200'"
                    @click="navigateTo(item.route)">
                    <span>{{ item.label }}</span>
                    <IconCrown v-if="item.adminIcon" class="w-4 h-4 ml-1.5 text-yellow-500" />
                </button>
            </nav>

            <!-- 우측 영역: 검색·테마·알림·사용자 -->
            <div class="flex items-center gap-2 flex-shrink-0">
                <!-- 통합검색 (V1 기본 상태 + V2 포커스 드롭다운) -->
                <GlobalSearchBar />

                <button
                    class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    @click="toggleTheme">
                    <i :class="['pi text-lg', isDark ? 'pi-sun' : 'pi-moon']"/>
                </button>
                <button
                    class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative">
                    <i class="pi pi-bell text-lg"/>
                    <span
                        class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900"/>
                </button>

                <!-- SSR과 클라이언트 간 user 상태 차이로 발생하는 hydration mismatch를 허용합니다. -->
                <div
                    class="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-700"
                    data-allow-mismatch>
                    <div class="text-right hidden md:block">
                        <div class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{{ user?.empNm || '사용자' }}</div>
                        <div class="text-xs text-zinc-500">{{ user?.eno || '' }}</div>
                    </div>
                    <Avatar
                        :label="user?.empNm?.charAt(0) || 'U'"
                        class="bg-primary-100 text-primary-600 font-bold border border-primary-200" shape="circle"
                        size="normal" style="width: 2.5rem; height: 2.5rem" />
                    <button
                        class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                        title="로그아웃"
                        @click="handleLogout">
                        <i class="pi pi-sign-out text-lg"/>
                    </button>
                </div>
            </div>
        </div>

        <!-- Tab Bar -->
        <div
            class="flex items-end bg-white dark:bg-zinc-900/50 border-t border-b border-zinc-100 dark:border-zinc-800 h-[50px]">
            <!-- 좌측 스크롤 버튼 — 호버: 연속 스크롤 / 클릭: 맨 앞으로 -->
            <button
                class="flex-shrink-0 flex items-center justify-center w-7 h-full transition-colors"
                :class="canScrollLeft ? 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer' : 'text-transparent cursor-default'"
                @mouseenter="canScrollLeft && startHoverScroll('left')"
                @mouseleave="stopHoverScroll"
                @click="canScrollLeft && scrollToEdge('left')">
                <i class="pi pi-chevron-left text-xs"/>
            </button>

            <!-- 탭 스크롤 영역 -->
            <div
                ref="tabContainer"
                class="flex items-end flex-1 overflow-x-auto scrollbar-hide h-full px-2 gap-1"
                @scroll="updateScrollState">
                <div
                    v-for="(tab, index) in tabs" :key="tab.path" draggable="true"
                    class="flex items-center px-4 py-2 text-sm rounded-t-lg cursor-pointer transition-all whitespace-nowrap border-t border-x mb-[-1px] relative select-none"
                    :class="[
                        route.path === tab.path
                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border-zinc-200 dark:border-zinc-800 border-b-transparent font-bold shadow-[0_-2px_5px_rgba(0,0,0,0.02)]'
                            : 'bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-500 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800',
                        dragIndex === index ? 'opacity-40' : '',
                        dropTargetIndex === index && dragIndex !== index ? 'tab-drop-target' : ''
                    ]"
                    @dragstart="onDragStart($event, index)"
                    @dragover="onDragOver($event, index)"
                    @drop="onDrop($event, index)"
                    @dragend="onDragEnd"
                    @click="navigateToTab(tab.fullPath)">
                    <span class="mr-2">{{ tab.title }}</span>
                    <button
                        v-if="tabs.length > 1"
                        class="p-0.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                        @click.stop="removeTab(tab.path)">
                        <i class="pi pi-times text-[10px]"/>
                    </button>
                </div>
            </div>

            <!-- 우측 스크롤 버튼 — 호버: 연속 스크롤 / 클릭: 맨 뒤로 -->
            <button
                class="flex-shrink-0 flex items-center justify-center w-7 h-full transition-colors"
                :class="canScrollRight ? 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer' : 'text-transparent cursor-default'"
                @mouseenter="canScrollRight && startHoverScroll('right')"
                @mouseleave="stopHoverScroll"
                @click="canScrollRight && scrollToEdge('right')">
                <i class="pi pi-chevron-right text-xs"/>
            </button>

            <!-- 모두 닫기 버튼 -->
            <div v-if="tabs.length > 0" class="flex-shrink-0 flex items-center px-2 pb-2">
                <Button
                    label="모두 닫기" size="small" severity="secondary" outlined
                    class="bg-stone-300 dark:bg-stone-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors !text-xs !py-1 !px-2 !h-7"
                    @click="closeAll" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Custom Scrollbar Hide */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* 드래그 드롭 대상 위치 표시 — 좌측에 인디고 라인 */
.tab-drop-target {
    box-shadow: -2px 0 0 0 rgb(99 102 241) !important;
}

/* 통합검색 AutoComplete 드롭다운 너비 확장 */
.global-search :deep(.p-autocomplete-overlay) {
    min-width: 360px !important;
}
</style>
