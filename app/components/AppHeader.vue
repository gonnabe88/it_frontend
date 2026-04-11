<!--
================================================================================
[components/AppHeader.vue] 상단 헤더 네비게이션 컴포넌트
================================================================================
애플리케이션 상단에 고정된 헤더 바를 렌더링합니다.
MegaMenu 기반의 주요 메뉴(사업·예산, IT자체감사, 전자결재 등)와
사용자 정보 드롭다운(프로필, 로그아웃)을 표시합니다.

[메뉴 구성]
  - 사업·예산   : 정보화사업, 예산관리, 협의회 운영, 계약 관리
  - IT자체감사  : IT 감사 관련 기능
  - 전자결재    : 결재 관련 기능
  - 가이드      : 시스템 사용 가이드
  - 관리자      : 시스템관리자(ITPAD001) 전용 메뉴

[표시 조건]
  - 관리자 메뉴는 isAdmin 권한이 있는 사용자에게만 노출됩니다.
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import logo from '@/assets/logo.png';
import { useAuth } from '~/composables/useAuth';
import { ROLE } from '~/types/auth';

const route = useRoute();
const router = useRouter();
const { user, logout } = useAuth();

const isActiveRoot = (label: string) => {
    if (label === '사업·예산') return route.path.startsWith('/info');
    if (label === 'IT자체감사') return route.path.startsWith('/audit');
    if (label === '전자결재') return route.path.startsWith('/approval');
    return false;
};

// 시스템관리자 여부 (ITPAD001 역할 보유 시 [관리자] 메뉴 표시)
const isAdmin = computed(() => user.value?.athIds?.includes(ROLE.ADMIN));

const menuItems = computed(() => [
    {
        label: '사업·예산',
        root: true,
        items: [
            [
                {
                    items: [
                        { image: logo, subtext: 'IT Portal System', label: '사업·예산', class: 'w-full' }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '정보화사업', icon: 'pi pi-briefcase', subtext: 'Information Projects', command: () => navigateTo('/info/projects') },
                        { label: '예산관리', icon: 'pi pi-wallet', subtext: 'Budget Management', command: () => navigateTo('/budget') }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '협의회 운영', icon: 'pi pi-users', subtext: 'Council Operation', command: () => navigateTo('/info/council/working') },
                        { label: '계약 관리', icon: 'pi pi-file-edit', subtext: 'Contract Management', command: () => navigateTo('/info/contract') }
                    ]
                }
            ],
        ]
    },
    {
        label: 'IT·AI CDP',
        root: true,
        items: [
            [
                {
                    items: [
                        { image: logo, subtext: 'IT Portal System', label: 'IT·AI CDP', class: 'w-full' }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '정보화사업', icon: 'pi pi-briefcase', subtext: 'Information Projects', command: () => navigateTo('/info/projects') },
                        { label: '예산관리', icon: 'pi pi-wallet', subtext: 'Budget Management', command: () => navigateTo('/budget') }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '협의회 운영', icon: 'pi pi-users', subtext: 'Council Operation', command: () => navigateTo('/info/council/working') },
                        { label: '계약 관리', icon: 'pi pi-file-edit', subtext: 'Contract Management', command: () => navigateTo('/info/contract') }
                    ]
                }
            ],
        ]
    },
    {
        label: 'IT자체감사',
        root: true,
        items: [
            [
                {
                    items: [
                        { image: logo, subtext: 'IT Audit System', label: 'IT자체감사', class: 'w-full' }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '일일감사', icon: 'pi pi-calendar', subtext: 'Daily Audit', command: () => navigateTo('/audit/') },
                        { label: '월별감사', icon: 'pi pi-calendar-plus', subtext: 'Monthly Audit', command: () => navigateTo('/audit/') }
                    ]
                }
            ],
            [
                {
                    items: [
                        { label: '감사 운영', icon: 'pi pi-cog', subtext: 'Audit Operation', command: () => navigateTo('/audit') },
                        { label: '감사 통계', icon: 'pi pi-chart-bar', subtext: 'Audit Statistics', command: () => navigateTo('/audit') }
                    ]
                }
            ],
        ]
    },
    {
        label: '전자결재',
        root: true,
        command: () => navigateTo('/approval')
    },
    // 시스템관리자 전용 메뉴 — ITPAD001 역할 보유 시에만 노출
    ...(isAdmin.value ? [{
        label: '관리자',
        root: true,
        adminIcon: true,
        command: () => navigateTo('/admin/codes')
    }] : [])
]);

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
};

/**
 * 다크모드 전환 핸들러 (View Transition API 활용)
 * View Transition API를 사용하여 부드러운 크로스페이드 전환을 수행합니다.
 * 미지원 브라우저에서는 applyTheme()을 즉시 실행합니다.
 */
const toggleTheme = () => {
    // View Transition API 지원 여부 확인 (Chrome 111+, Edge 111+)
    if (!document.startViewTransition) {
        applyTheme();
        return;
    }
    // 크로스페이드 트랜지션 실행
    document.startViewTransition(() => applyTheme());
};

const handleLogout = async () => {
    await logout();
    router.push('/login');
};

onMounted(() => {
    // 쿠키 미설정(최초 방문) 시 시스템 다크모드 설정을 초기값으로 사용
    const hasCookie = document.cookie.split(';').some(c => c.trim().startsWith('theme-dark='));
    if (!hasCookie) {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        isDark.value = systemDark;
    }
    // 인라인 스크립트가 이미 DOM에 적용했으나, 쿠키 값과 한 번 더 동기화
    document.documentElement.classList.toggle('dark', isDark.value);
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
        // 반투명 드래그 이미지를 위한 설정
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
    // 배열에서 드래그한 탭을 빼고 대상 위치에 삽입
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
    <div class="card">
        <MegaMenu :model="menuItems" class="p-4 bg-white dark:bg-zinc-900 border-none rounded-none"
            style="border-radius: 0">

            <template #item="{ item }">
                <a v-if="item.root"
                    class="flex items-center cursor-pointer px-14 py-2 overflow-hidden relative font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-indigo-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    :class="[isActiveRoot(typeof item.label === 'string' ? item.label : '') ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-200']"
                    style="border-radius: 0"
                    @click="item.command ? item.command({ originalEvent: $event, item }) : null">
                    <!-- 관리자 메뉴: 왕관 SVG 아이콘 + 노란색 강조 -->
                    <template v-if="item.adminIcon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            class="w-4 h-4 mr-1 text-yellow-500">
                            <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.4a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 5.919a.5.5 0 0 1 .798-.519l4.276 3.764a1 1 0 0 0 1.516-.294z" />
                            <path d="M5 21h14" />
                        </svg>
                        <span class="text-yellow-600 dark:text-yellow-400">{{ item.label }}</span>
                    </template>
                    <span v-else>{{ item.label }}</span>
                </a>
                <a v-else-if="!item.image" @click="item.command ? item.command({ originalEvent: $event, item }) : null"
                    class="flex items-center p-4 cursor-pointer mb-2 gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-800/50 rounded-lg transition-colors">
                    <span
                        class="inline-flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 w-15 h-15">
                        <i :class="[item.icon, 'text-lg']"></i>
                    </span>
                    <span class="inline-flex flex-col gap-1">
                        <span class="font-bold text-lg text-zinc-800 dark:text-zinc-100">{{ item.label }}</span>
                        <span class="whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-sm">{{ item.subtext
                        }}</span>
                    </span>
                </a>
                <div v-else class="flex flex-col items-center w-full">
                    <img alt="megamenu-demo" :src="logo" class="w-32 h-auto dark:invert animate-float" />
                    <span class="text-xl font-bold text-zinc-800 dark:text-zinc-100">{{ item.label }}</span>
                    <span class="text-sm text-zinc-500 dark:text-zinc-400">{{ item.subtext }}</span>
                </div>
            </template>
            <template #end>
                <div class="flex items-center gap-4">
                    <button @click="toggleTheme"
                        class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <i :class="['pi text-lg', isDark ? 'pi-sun' : 'pi-moon']"></i>
                    </button>
                    <button
                        class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative">
                        <i class="pi pi-bell text-lg"></i>
                        <span
                            class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-zinc-900"></span>
                    </button>
                    <div class="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-700">
                        <div class="text-right hidden md:block">
                            <div class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{{ user?.empNm || '사용자'
                            }}</div>
                            <div class="text-xs text-zinc-500">{{ user?.eno || '' }}</div>
                        </div>
                        <Avatar :label="user?.empNm?.charAt(0) || 'U'"
                            class="bg-primary-100 text-primary-600 font-bold border border-primary-200" shape="circle"
                            size="normal" style="width: 2.5rem; height: 2.5rem" />
                        <button @click="handleLogout"
                            class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                            title="로그아웃">
                            <i class="pi pi-sign-out text-lg"></i>
                        </button>
                    </div>
                </div>
            </template>
        </MegaMenu>

        <!-- Tab Bar -->
        <div class="flex items-end bg-white dark:bg-zinc-900/50 border-t border-b border-zinc-100 dark:border-zinc-800 h-[50px]">
            <!-- 좌측 스크롤 버튼 — 호버: 연속 스크롤 / 클릭: 맨 앞으로 -->
            <button
                @mouseenter="canScrollLeft && startHoverScroll('left')" @mouseleave="stopHoverScroll"
                @click="canScrollLeft && scrollToEdge('left')"
                class="flex-shrink-0 flex items-center justify-center w-7 h-full transition-colors"
                :class="canScrollLeft ? 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer' : 'text-transparent cursor-default'">
                <i class="pi pi-chevron-left text-xs"></i>
            </button>

            <!-- 탭 스크롤 영역 -->
            <div ref="tabContainer" @scroll="updateScrollState"
                class="flex items-end flex-1 overflow-x-auto scrollbar-hide h-full px-2 gap-1">
                <div v-for="(tab, index) in tabs" :key="tab.path"
                    draggable="true"
                    @dragstart="onDragStart($event, index)"
                    @dragover="onDragOver($event, index)"
                    @drop="onDrop($event, index)"
                    @dragend="onDragEnd"
                    class="flex items-center px-4 py-2 text-sm rounded-t-lg cursor-pointer transition-all whitespace-nowrap border-t border-x mb-[-1px] relative select-none"
                    :class="[
                        route.path === tab.path
                            ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border-zinc-200 dark:border-zinc-800 border-b-transparent font-bold shadow-[0_-2px_5px_rgba(0,0,0,0.02)]'
                            : 'bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-500 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800',
                        dragIndex === index ? 'opacity-40' : '',
                        dropTargetIndex === index && dragIndex !== index ? 'tab-drop-target' : ''
                    ]" @click="navigateToTab(tab.fullPath)">
                    <span class="mr-2">{{ tab.title }}</span>
                    <button v-if="tabs.length > 1" @click.stop="removeTab(tab.path)"
                        class="p-0.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <i class="pi pi-times text-[10px]"></i>
                    </button>
                </div>
            </div>

            <!-- 우측 스크롤 버튼 — 호버: 연속 스크롤 / 클릭: 맨 뒤로 -->
            <button
                @mouseenter="canScrollRight && startHoverScroll('right')" @mouseleave="stopHoverScroll"
                @click="canScrollRight && scrollToEdge('right')"
                class="flex-shrink-0 flex items-center justify-center w-7 h-full transition-colors"
                :class="canScrollRight ? 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer' : 'text-transparent cursor-default'">
                <i class="pi pi-chevron-right text-xs"></i>
            </button>

            <!-- 모두 닫기 버튼 -->
            <div v-if="tabs.length > 0" class="flex-shrink-0 flex items-center px-2 pb-2">
                <Button label="모두 닫기" @click="closeAll" size="small" severity="secondary" outlined
                    class="bg-stone-300 dark:bg-stone-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors !text-xs !py-1 !px-2 !h-7" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Limit the width of the MegaMenu dropdown panel */
:deep(.p-megamenu-root-list > .p-menuitem) {
    position: relative !important;
}

/* 드롭다운 시작 위치 조정 */
:deep(.p-megamenu-overlay) {
    margin-top: 1rem;
    z-index: 9999 !important;
    /* Animation using global keyframe */
    animation: menu-slide-fade-in 0.3s ease-out forwards !important;
    transform-origin: top !important;
}

/* 드롭다운 내부 내용 위치 조정 */
:deep(.p-megamenu-panel) {
    width: auto !important;
    max-width: none !important;
    min-width: auto !important;
    left: 0 !important;
    right: auto !important;
    top: 100% !important;
    /* Position right below the menu item */
    margin: 0 !important;

}


/* 드롭다운 내부 내용 위치 조정 */
:deep(.p-megamenu-grid) {
    display: flex !important;
    width: max-content !important;
    margin: 0 !important;
}

/* 드롭다운 내부 내용 위치 조정 */
:deep(.p-megamenu-col) {
    width: auto !important;
    flex: 0 0 auto !important;
}

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
</style>

<style>
@keyframes menu-slide-fade-in {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes float {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-5px);
    }
}

.animate-float {
    animation: float 3s ease-in-out infinite;
}
</style>
