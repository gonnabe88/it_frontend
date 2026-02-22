<script setup lang="ts">
const collapsed = useState('sidebar-collapsed', () => false);
const toggleSidebar = () => collapsed.value = !collapsed.value;

const route = useRoute();
const context = computed(() => route.path.startsWith('/audit') ? 'audit' : 'info');

const menuItems = computed(() => {
    if (context.value === 'audit') {
        return [
            { label: '홈', icon: 'pi pi-home', to: '/audit' },
            {
                label: 'IT자체감사', icon: 'pi pi-check-square', items: [
                    { label: '일일감사', to: '/audit/daily' },
                    { label: '월별감사', to: '/audit/monthly' },
                    { label: '분기감사', to: '/audit/quarterly' },
                    { label: '반기감사', to: '/audit/biannual' },
                    { label: '연간감사', to: '/audit/annual' }
                ]
            },
            {
                label: 'IT자체감사 운영', icon: 'pi pi-cog', items: [
                    { label: '일일감사 운영', to: '/audit/manage/daily' },
                    { label: '월별감사 운영', to: '/audit/manage/monthly' },
                    { label: '분기감사 운영', to: '/audit/manage/quarterly' },
                    { label: '반기감사 운영', to: '/audit/manage/biannual' },
                    { label: '연간감사 운영', to: '/audit/manage/annual' }
                ]
            }
        ];
    }
    // Default: Info
    return [
        { label: '홈', icon: 'pi pi-home', to: '/info' },
        { label: '사전진단', icon: 'pi pi-check-square', to: '/diagnosis' },
        {
            label: '전산예산', icon: 'pi pi-wallet', items: [
                { label: '예산 신청', to: '/budget' },
                { label: '예산 목록', to: '/budget/list' }
            ]
        },
        {
            label: '정보화사업', icon: 'pi pi-briefcase', items: [
                { label: '사업 목록', to: '/info/projects' },
                { label: '사전 협의', to: '/info/consultation' },
                { label: '정보화실무협의회 신청', to: '/info/council-request' },
                { label: '세부 요구사항 작성', to: '/info/requirements' },
                { label: '소요예산 산정 신청', to: '/info/estimation' },
                { label: '과업심의위원회 신청', to: '/info/deliberation' },
                { label: '입찰/계약 의뢰', to: '/info/contract' },
                { label: '대금지급 의뢰', to: '/info/payment' },
                { label: '성과평가', to: '/info/evaluation' }
            ]
        },
        {
            label: '정보화협의체 운영', icon: 'pi pi-users', items: [
                { label: '정보화실무협의회 운영', to: '/info/council/working' },
                { label: '정보화추진협의회 운영', to: '/info/council/promotion' },
                { label: '정보화추진위원회 운영', to: '/info/council/committee' }
            ]
        }
    ];
});

const isGroupExpanded = (label: string) => {
    // Simple logic: expand all or track state. For now, expand all.
    // Or add state for expanded groups.
    return true;
}
// Better: collapsible groups.
const expandedGroups = ref<Record<string, boolean>>({});
const toggleGroup = (label: string) => {
    expandedGroups.value[label] = !expandedGroups.value[label];
};

const handleGroupClick = (item: any) => {
    if (collapsed.value) {
        // 접힌 상태에서는 첫 번째 하위 메뉴로 이동
        if (item.items && item.items.length > 0) {
            navigateTo(item.items[0].to);
        }
    } else {
        // 펼쳐진 상태에서는 그룹 토글
        toggleGroup(item.label);
    }
};
// Expand transition hooks
const onEnter = (el: Element) => {
    const element = el as HTMLElement;
    element.style.height = '0';
    element.offsetHeight; // trigger reflow
    element.style.height = element.scrollHeight + 'px';
};

const onAfterEnter = (el: Element) => {
    (el as HTMLElement).style.height = 'auto';
};

const onLeave = (el: Element) => {
    const element = el as HTMLElement;
    element.style.height = element.scrollHeight + 'px';
    element.offsetHeight; // trigger reflow
    element.style.height = '0';
};

// Initialize expanded
watch(menuItems, (items) => {
    items.forEach(item => {
        if (item.items && expandedGroups.value[item.label] === undefined) {
            expandedGroups.value[item.label] = true;
        }
    });
}, { immediate: true });
</script>

<template>
    <aside
        :class="['relative bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 flex flex-col shadow-xl z-20 whitespace-nowrap', collapsed ? 'w-20' : 'w-72']">
        <div id="sidebar-header"
            class="h-[76px] flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0 px-6 transition-all duration-300">
            <div class="flex items-center gap-3">
                <img src="~/assets/logo.png" alt="Logo" class="w-8 h-8 object-contain dark:invert" />
                <Transition name="fade">
                    <span v-if="!collapsed"
                        class="font-bold text-xl tracking-wider text-primary-600 dark:text-primary-400">IT PORTAL</span>
                </Transition>
            </div>

            <button v-if="!collapsed" @click="toggleSidebar"
                class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                <i class="pi pi-bars"></i>
            </button>
            <button v-else @click="toggleSidebar"
                class="absolute right-[-12px] top-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 rounded-full shadow-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white z-50">
                <i class="pi pi-angle-right text-xs"></i>
            </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 scrollbar-hide overflow-x-hidden">
            <ul class="space-y-2 px-3">
                <template v-for="item in menuItems" :key="item.label">
                    <!-- Single Item -->
                    <li v-if="!item.items">
                        <NuxtLink :to="item.to"
                            class="flex items-center py-3 rounded-lg text-indigo-800 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors duration-300 group px-3"
                            active-class="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-medium"
                            v-tooltip="{ value: item.label, disabled: !collapsed, placement: 'right' }">
                            <div class="flex items-center">
                                <i :class="[item.icon, 'text-xl w-8 text-center']"></i>
                                <Transition name="fade">
                                    <span v-if="!collapsed" class="ml-3 font-medium">{{ item.label }}</span>
                                </Transition>
                            </div>
                        </NuxtLink>
                    </li>
                    <!-- Group -->
                    <li v-else class="relative group">
                        <div @click="handleGroupClick(item)"
                            class="flex items-center justify-between py-3 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 cursor-pointer transition-colors duration-300 text-indigo-800 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-white px-3"
                            v-tooltip="{ value: item.label, disabled: !collapsed, placement: 'right' }">
                            <div class="flex items-center">
                                <i :class="[item.icon, 'text-xl w-8 text-center']"></i>
                                <Transition name="fade">
                                    <span v-if="!collapsed" class="ml-3 font-medium">{{ item.label }}</span>
                                </Transition>
                            </div>
                            <Transition name="fade">
                                <i v-if="!collapsed"
                                    :class="['pi text-sm transition-transform', expandedGroups[item.label] ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
                            </Transition>
                        </div>
                        <Transition name="expand" @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
                            <ul v-if="!collapsed && expandedGroups[item.label]"
                                class="ml-6 mt-1 space-y-1 border-l border-zinc-200 dark:border-zinc-700 pl-2 overflow-hidden">
                                <li v-for="sub in item.items" :key="sub.label">
                                    <NuxtLink :to="sub.to"
                                        class="block py-2 px-3 rounded text-sm text-zinc-500 dark:text-zinc-400 hover:text-indigo-900 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                                        active-class="text-indigo-800 dark:text-indigo-400 font-medium bg-indigo-100 dark:bg-indigo-800/50">
                                        {{ sub.label }}
                                    </NuxtLink>
                                </li>
                            </ul>
                        </Transition>
                    </li>
                </template>
            </ul>
        </div>

    </aside>
</template>

<style scoped>
/* Custom Scrollbar for Sidebar */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* Sidebar Text Fade Transition */
.fade-enter-active {
    transition: opacity 0.2s ease-in-out 0.15s;
    /* Delay slightly to match width expansion */
}

.fade-leave-active {
    transition: opacity 0.1s ease-in-out;
    /* Hide quickly */
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Sidebar Expand Transition */
.expand-enter-active,
.expand-leave-active {
    transition: height 0.3s ease-in-out;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    height: 0;
}
</style>
