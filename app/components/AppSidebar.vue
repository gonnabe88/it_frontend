<!--
================================================================================
[components/AppSidebar.vue] 좌측 사이드바 네비게이션 컴포넌트
================================================================================
애플리케이션 좌측에 고정된 사이드바 네비게이션을 렌더링합니다.
현재 URL 경로(context)에 따라 다른 메뉴 구조를 표시합니다.

[컨텍스트별 메뉴 구성]
  - info  (기본)  : 정보화사업, 전산업무비, 예산관리, 가이드 등
  - audit         : IT자체감사 관련 메뉴
  - admin         : 시스템관리자 전용 메뉴 (공통코드, 사용자, 조직 등)

[기능]
  - 축소/확장 토글: 아이콘만 표시 ↔ 아이콘+레이블 표시 전환
  - 결재 상신 배지: 미상신 항목 수 표시 (정보화사업 + 전산업무비)
  - 축소 상태 영구 저장: useCookie로 저장하여 새로고침 후에도 유지 (SSR 안전)
================================================================================
-->
<script setup lang="ts">
import { usePendingApprovalCount } from '~/composables/usePendingApprovalCount';
import { useDocumentBadgeCount } from '~/composables/useDocumentDashboard';
import { useApprovalBadgeCount } from '~/composables/useApprovalDashboard';
import IconCrown from '~/components/icons/IconCrown.vue';

/**
 * 사이드바 축소 상태
 * - useCookie를 사용하여 SSR/CSR 모두에서 동일한 초기값을 보장합니다.
 * - 쿠키는 서버에서도 읽을 수 있어 하이드레이션 불일치가 발생하지 않습니다.
 */
const collapsed = useCookie<boolean>('sidebar-collapsed', { default: () => false });

// RBAC 권한 헬퍼: 관리자 메뉴 표시 여부 판단에 사용
const { isAdmin: _isAdmin } = useAuth();

/* ── 결재 상신 배지: 결재 대기 중인 항목 수 ── */
// 사이드바는 건수만 필요하므로 건수 전용 API(/api/applications/pending-count)를 사용합니다.
// 이를 통해 /budget/approval 페이지의 목록 조회 API와 URL이 겹치지 않아
// 새로고침 시 중복 요청으로 인한 네트워크 오류 토스트가 발생하지 않습니다.
const { data: pendingCountData } = usePendingApprovalCount();

/* ── 사전협의 검토 진행 중 배지 ── */
const { reviewingCount: docReviewingCount } = useDocumentBadgeCount();

/* ── 전자결재 결재 대기 / 기안 진행 중 배지 ── */
const { pendingCount: approvalPendingCount, inProgressCount: approvalInProgressCount } = useApprovalBadgeCount();

/**
 * 결재 상신 가능한 항목 수 (정보화사업 + 전산업무비)
 * 사이드바의 [결재 상신] 메뉴 옆 배지에 표시됩니다.
 */
const approvalCount = computed(() => pendingCountData.value?.totalCount ?? 0);

const toggleSidebar = () => {
    // useCookie가 자동으로 쿠키에 저장합니다.
    collapsed.value = !collapsed.value;
};

const route = useRoute();
const context = computed(() => {
    if (route.path.startsWith('/info/documents')) return 'documents';
    if (route.path.startsWith('/approval')) return 'approval';
    if (route.path.startsWith('/audit')) return 'audit';
    if (route.path.startsWith('/admin')) return 'admin';
    return 'info';
});

const menuItems = computed(() => {
    // 사전협의 컨텍스트
    if (context.value === 'documents') {
        return [
            { label: 'Home', icon: 'pi pi-home', to: '/info/documents' },
            {
                label: '문서 관리', icon: 'pi pi-folder', items: [
                    { label: '문서 목록', to: '/info/documents/list' },
                    { label: '신규 작성', to: '/info/documents/form' }
                ]
            },
            {
                label: '협의 현황', icon: 'pi pi-chart-pie', items: [
                    { label: '검토 중', to: '/info/documents/list?status=reviewing', badge: 'docReviewing' },
                    { label: '협의 완료', to: '/info/documents/list?status=completed' },
                    { label: '지연', to: '/info/documents/list?status=overdue' }
                ]
            }
        ];
    }

    // 전자결재 컨텍스트
    if (context.value === 'approval') {
        return [
            { label: 'Home', icon: 'pi pi-home', to: '/approval' },
            {
                label: '결재함', icon: 'pi pi-inbox', items: [
                    { label: '결재 대기', to: '/approval/list?tab=pending', badge: 'approvalPending' },
                    { label: '결재 완료', to: '/approval/list?tab=done' }
                ]
            },
            {
                label: '기안함', icon: 'pi pi-send', items: [
                    { label: '결재 진행 중', to: '/approval/list?tab=in-progress', badge: 'approvalInProgress' },
                    { label: '완료 기안', to: '/approval/list?tab=draft-done' },
                    { label: '반려 기안', to: '/approval/list?tab=draft-rejected' }
                ]
            }
        ];
    }

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

    // 시스템 관리자 전용 컨텍스트
    if (context.value === 'admin') {
        return [
            { label: '대시보드', icon: 'pi pi-chart-line', to: '/admin/dashboard' },
            {
                label: '데이터 관리', icon: 'pi pi-database', items: [
                    { label: '공통코드', to: '/admin/codes' },
                    { label: '자격등급', to: '/admin/auth-grades' },
                    { label: '사용자', to: '/admin/users' },
                    { label: '역할', to: '/admin/roles' },
                    { label: '조직', to: '/admin/organizations' },
                ]
            },
            {
                label: '이력 · 보안', icon: 'pi pi-shield', items: [
                    { label: '로그인 이력', to: '/admin/login-history' },
                    { label: 'JWT 갱신토큰', to: '/admin/tokens' },
                    { label: '첨부파일', to: '/admin/files' },
                ]
            },
        ];
    }

    // Default: Info
    return [
        { label: 'Home', icon: 'pi pi-home', to: '/info' },
        { label: '사업 가이드', icon: 'pi pi-book', to: '/guide' },
        {
            label: '전산예산', icon: 'pi pi-wallet', items: [
                { label: '예산 작성', to: '/budget' },
                { label: '결재 상신', to: '/budget/approval' },
                { label: '예산 목록', to: '/budget/list' },
                { label: '예산 작업', to: '/budget/work', admin: true },
                { label: '예산 현황', to: '/budget/status', admin: true }
            ]
        },
        {
            label: '정보기술부문 계획', icon: 'pi pi-chart-bar', items: [
                { label: '계획 조회', to: '/info/plan' },
                { label: '계획 등록', to: '/info/plan/form' }
            ]
        },
        {
            label: '정보화사업', icon: 'pi pi-briefcase', items: [
                { label: '사업 목록', to: '/info/projects' },
                { label: '정보화실무협의회 신청', to: '/info/council-request' },
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
        },
    ];
});

const _isGroupExpanded = (_label: string) => {
    // Simple logic: expand all or track state. For now, expand all.
    // Or add state for expanded groups.
    return true;
}
// Better: collapsible groups.
const expandedGroups = ref<Record<string, boolean>>({});
const toggleGroup = (label: string) => {
    expandedGroups.value[label] = !expandedGroups.value[label];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    void element.offsetHeight; // trigger reflow
    element.style.height = element.scrollHeight + 'px';
};

const onAfterEnter = (el: Element) => {
    (el as HTMLElement).style.height = 'auto';
};

const onLeave = (el: Element) => {
    const element = el as HTMLElement;
    element.style.height = element.scrollHeight + 'px';
    void element.offsetHeight; // trigger reflow
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
        <div
id="sidebar-header"
            class="h-[76px] flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0 px-6 transition-all duration-300">
            <div class="flex items-center gap-3">
                <img src="~/assets/logo.png" alt="Logo" class="w-8 h-8 object-contain dark:invert" >
                <Transition name="fade">
                    <span
v-if="!collapsed"
                        class="font-bold text-xl tracking-wider text-primary-600 dark:text-primary-400">정보화
                        Portal</span>
                </Transition>
            </div>

            <button
v-if="!collapsed" class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                @click="toggleSidebar">
                <i class="pi pi-bars"/>
            </button>
            <button
v-else class="absolute right-[-12px] top-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 rounded-full shadow-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white z-50"
                @click="toggleSidebar">
                <i class="pi pi-angle-right text-xs"/>
            </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 scrollbar-hide overflow-x-hidden">
            <ul class="space-y-2 px-3">
                <template v-for="item in menuItems" :key="item.label">
                    <!-- Single Item -->
                    <li v-if="!item.items">
                        <NuxtLink
v-tooltip="{ value: item.label, disabled: !collapsed, placement: 'right' }"
                            :to="item.to"
                            class="flex items-center py-3 rounded-lg text-indigo-800 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors duration-300 group px-3"
                            active-class="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-medium">
                            <div class="flex items-center">
                                <i :class="[item.icon, 'text-xl w-8 text-center']"/>
                                <Transition name="fade">
                                    <span v-if="!collapsed" class="ml-3 font-medium">{{ item.label }}</span>
                                </Transition>
                            </div>
                        </NuxtLink>
                    </li>
                    <!-- Group -->
                    <li v-else class="relative group">
                        <div
v-tooltip="{ value: item.label, disabled: !collapsed, placement: 'right' }"
                            class="flex items-center justify-between py-3 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 cursor-pointer transition-colors duration-300 text-indigo-800 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-white px-3"
                            @click="handleGroupClick(item)">
                            <div class="flex items-center">
                                <i :class="[item.icon, 'text-xl w-8 text-center']"/>
                                <Transition name="fade">
                                    <span v-if="!collapsed" class="ml-3 font-medium">{{ item.label }}</span>
                                </Transition>
                            </div>
                            <Transition name="fade">
                                <i
v-if="!collapsed"
                                    :class="['pi text-sm transition-transform', expandedGroups[item.label] ? 'pi-chevron-down' : 'pi-chevron-right']"/>
                            </Transition>
                        </div>
                        <Transition name="expand" @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
                            <ul
                                v-if="!collapsed && expandedGroups[item.label]"
                                class="ml-6 mt-1 space-y-1 border-l border-zinc-200 dark:border-zinc-700 pl-2 overflow-hidden">
                                <li v-for="sub in item.items" :key="sub.label">
                                    <NuxtLink
                                        :to="sub.to"
                                        class="flex items-center justify-between py-2 px-3 rounded text-sm text-zinc-500 dark:text-zinc-400 hover:text-indigo-900 dark:hover:text-white hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                                        active-class="text-indigo-800 dark:text-indigo-400 font-medium bg-indigo-100 dark:bg-indigo-800/50">
                                        <span class="flex items-center whitespace-nowrap">
                                            {{ sub.label }}
                                            <!-- 관리자 전용 메뉴: 왕관 아이콘 -->
                                            <IconCrown v-if="(sub as any).admin" class="w-4 h-4 ml-1 shrink-0 text-yellow-500" />
                                        </span>
                                        <!-- 결재 상신 메뉴: 미상신 항목 수 배지 표시 -->
                                        <span
v-if="sub.to === '/budget/approval' && approvalCount > 0"
                                            class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-none">
                                            {{ approvalCount > 99 ? '99+' : approvalCount }}
                                        </span>
                                        <!-- 사전협의: 검토 중 배지 -->
                                        <span
                                            v-if="(sub as any).badge === 'docReviewing' && docReviewingCount > 0"
                                            class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold leading-none">
                                            {{ docReviewingCount > 99 ? '99+' : docReviewingCount }}
                                        </span>
                                        <!-- 전자결재: 결재 대기 배지 -->
                                        <span
                                            v-if="(sub as any).badge === 'approvalPending' && approvalPendingCount > 0"
                                            class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                                            {{ approvalPendingCount > 99 ? '99+' : approvalPendingCount }}
                                        </span>
                                        <!-- 전자결재: 기안 진행 중 배지 -->
                                        <span
                                            v-if="(sub as any).badge === 'approvalInProgress' && approvalInProgressCount > 0"
                                            class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold leading-none">
                                            {{ approvalInProgressCount > 99 ? '99+' : approvalInProgressCount }}
                                        </span>
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
