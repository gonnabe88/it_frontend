<script setup lang="ts">
/**
 * ============================================================================
 * [components/common/EmployeeSearchDialog.vue] 직원 조회 다이얼로그 컴포넌트
 * ----------------------------------------------------------------------------
 * V5 디자인: 조직도 트리 + 직원 DataTable 분할 레이아웃.
 *
 * [기능]
 *   - 좌측: 조직도 트리 (전체 펼치기/접기, 부서명 검색, 깊이별 아이콘)
 *   - 우측: 선택된 부서의 직원 목록 (브레드크럼 경로, 이름/사번 검색)
 *   - 행 단일 클릭 → 하이라이트, 더블클릭 또는 [선택] 버튼 → emit + 닫기
 *
 * [Props]
 *   - visible : 다이얼로그 표시 여부 (v-model)
 *   - header  : 다이얼로그 제목 (기본값: '직원 조회')
 *
 * [Events]
 *   - update:visible : 다이얼로그 닫힘 시 visible 상태 동기화
 *   - select         : 직원 선택 시 OrgUser 객체 전달
 *
 * [사용처]
 *   - pages/info/projects/form.vue : 프로젝트 담당자 선택
 *   - pages/info/cost/form.vue     : 전산업무비 담당자 선택
 *   - components/cost/*            : 담당자 검색 필드
 * ============================================================================
 */
import { ref, computed, watch } from 'vue';
import { useOrganization, type Organization, type OrgUser } from '~/composables/useOrganization';
import TableSearchInput from '~/components/common/TableSearchInput.vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    header:  { type: String,  default: '직원 조회' }
});
const emit = defineEmits(['update:visible', 'select']);

const isVisible = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
});

const { buildOrgTree } = useOrganization();
const config = useRuntimeConfig();
const { $apiFetch } = useNuxtApp();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes           = ref<any[]>([]);
const expandedSet     = ref<Set<string>>(new Set());
const selectedKey     = ref<string | null>(null);
const users           = ref<OrgUser[]>([]);
const loadingUsers    = ref(false);
const highlightedUser = ref<OrgUser | null>(null);
const treeFilter      = ref('');
const tableFilter     = ref('');
const selectedPath    = ref<string[]>([]);

/** 다이얼로그가 열릴 때 조직도 로드 (미로드 시에만) */
watch(() => props.visible, async (open) => {
    if (open && nodes.value.length === 0) {
        try {
            const data = await $apiFetch<Organization[]>(`${config.public.apiBase}/api/organizations`);
            if (data) {
                nodes.value = buildOrgTree(data);
                expandAll();
            }
        } catch (e) {
            console.error('조직도 로드 실패', e);
        }
    }
    if (open) {
        highlightedUser.value = null;
        tableFilter.value = '';
    }
});

/** 트리 노드 재귀 펼치기 키 수집 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const collectExpandable = (node: any, set: Set<string>) => {
    if (node.children?.length) {
        set.add(node.key);
        node.children.forEach((c: any) => collectExpandable(c, set));
    }
};
const expandAll = () => {
    const s = new Set<string>();
    nodes.value.forEach(n => collectExpandable(n, s));
    expandedSet.value = s;
};
const collapseAll = () => { expandedSet.value = new Set(); };

/** 트리 노드 레이블 필터링 — 검색어를 포함하는 경로는 유지 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterNodes = (list: any[], q: string): any[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    for (const n of list) {
        if (n.label?.toLowerCase().includes(q)) {
            result.push(n);
        } else if (n.children) {
            const kids = filterNodes(n.children, q);
            if (kids.length) result.push({ ...n, children: kids });
        }
    }
    return result;
};

/** 필터 적용된 트리 노드 */
const filteredNodes = computed(() => {
    const q = treeFilter.value.trim().toLowerCase();
    return q ? filterNodes(nodes.value, q) : nodes.value;
});

/** 검색어 입력 시 자동 펼치기 */
watch(treeFilter, (q) => { if (q) expandAll(); });

/** 노드 깊이에 따른 PrimeVue 아이콘 클래스 */
const nodeIcon = (depth: number): string => {
    if (depth === 0) return 'pi pi-building';
    if (depth === 1) return 'pi pi-sitemap';
    if (depth === 2) return 'pi pi-folder';
    return 'pi pi-users';
};

/** 토글 클릭 — 자식 있는 노드만 확장/접기, 선택 변경 없음 */
const onToggleClick = (e: Event, key: string, hasChildren: boolean) => {
    if (!hasChildren) return;
    e.stopPropagation();
    const s = new Set(expandedSet.value);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    expandedSet.value = s;
};

interface FlatNode { key: string; label: string; depth: number; hasChildren: boolean; }

/** 필터 적용된 트리를 평면(flat) 목록으로 변환 (확장 상태 반영) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flattenTree = (list: any[], depth = 0): FlatNode[] => {
    const result: FlatNode[] = [];
    for (const n of list) {
        const hasChildren = (n.children?.length ?? 0) > 0;
        result.push({ key: n.key, label: n.label, depth, hasChildren });
        if (hasChildren && expandedSet.value.has(n.key)) {
            result.push(...flattenTree(n.children, depth + 1));
        }
    }
    return result;
};
const flatTree = computed(() => flattenTree(filteredNodes.value));

/** 선택된 노드까지의 레이블 경로를 반환 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findPath = (list: any[], key: string, path: string[] = []): string[] | null => {
    for (const n of list) {
        const p = [...path, n.label];
        if (n.key === key) return p;
        if (n.children) {
            const found = findPath(n.children, key, p);
            if (found) return found;
        }
    }
    return null;
};

const onNodeSelect = async (node: FlatNode) => {
    if (!node.key) return;
    selectedKey.value = node.key;
    selectedPath.value = findPath(nodes.value, node.key) ?? [node.label];
    highlightedUser.value = null;
    tableFilter.value = '';
    loadingUsers.value = true;
    try {
        const data = await $apiFetch<OrgUser[]>(`${config.public.apiBase}/api/users`, {
            query: { orgCode: node.key }
        });
        users.value = data || [];
    } catch (e) {
        console.error('Failed to fetch users', e);
        users.value = [];
    } finally {
        loadingUsers.value = false;
    }
};

/** 이름/사번 필터 적용된 직원 목록 */
const filteredUsers = computed(() => {
    const q = tableFilter.value.trim().toLowerCase();
    if (!q) return users.value;
    return users.value.filter(u =>
        u.usrNm?.toLowerCase().includes(q) || u.eno?.toLowerCase().includes(q)
    );
});

/** 정렬 상태 */
type SortField = 'usrNm' | 'eno' | 'ptCNm' | 'temNm' | 'bbrNm';
const sortField = ref<SortField | null>(null);
const sortDir   = ref<'asc' | 'desc'>('asc');

const onSort = (field: SortField) => {
    if (sortField.value === field) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortField.value = field;
        sortDir.value = 'asc';
    }
};

const sortedUsers = computed(() => {
    if (!sortField.value) return filteredUsers.value;
    const f = sortField.value;
    const dir = sortDir.value === 'asc' ? 1 : -1;
    return [...filteredUsers.value].sort((a, b) => {
        const av = (a[f] ?? '').toLowerCase();
        const bv = (b[f] ?? '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
    });
});

/** 이름 첫 글자 추출 (아바타용) */
const nameInitial = (name: string): string => name?.[0] ?? '?';

/** 행 클릭 → 하이라이트만 (즉시 emit 하지 않음) */
const onRowClick = (user: OrgUser) => { highlightedUser.value = user; };

/** 더블클릭 → 즉시 선택 */
const onRowDblClick = (user: OrgUser) => {
    highlightedUser.value = user;
    onConfirm();
};

/**
 * [선택] 버튼 핸들러
 * 선택된 직원 정보(OrgUser)에 현재 선택된 부서 코드를 추가하여 emit합니다.
 */
const onConfirm = () => {
    if (!highlightedUser.value) return;
    const orgCode = selectedKey.value ?? '';
    emit('select', { ...highlightedUser.value, orgCode });
    isVisible.value = false;
};

/** [취소] 버튼 → 닫기 */
const onCancel = () => { isVisible.value = false; };
</script>

<template>
    <Dialog
        v-model:visible="isVisible"
        modal
        :show-header="false"
        :style="{ width: 'var(--dialog-xl)' }"
        :breakpoints="{ '960px': '90vw', '641px': '98vw' }"
        :pt="{
            root:    { style: 'border-radius: 12px; overflow: hidden;' },
            content: { style: 'padding: 0; overflow: hidden;' }
        }"
    >
        <div class="esd-wrap">

            <!-- ── 헤더 ── -->
            <div class="esd-head">
                <h4><i class="pi pi-users" />{{ header }}</h4>
                <button class="esd-close" @click="onCancel">
                    <i class="pi pi-times" style="font-size:11px;" />
                </button>
            </div>

            <!-- ── 바디: 좌측 트리 + 우측 테이블 ── -->
            <div class="esd-body">

                <!-- 좌측: 조직도 트리 -->
                <div class="esd-tree">
                    <div class="esd-tree-toolbar">
                        <button class="esd-tree-btn" @click="expandAll">
                            <i class="pi pi-angle-double-down" style="font-size:10px;" />모두 펼치기
                        </button>
                        <button class="esd-tree-btn" @click="collapseAll">
                            <i class="pi pi-angle-double-up" style="font-size:10px;" />모두 접기
                        </button>
                    </div>
                    <div class="px-2 pb-2">
                        <TableSearchInput v-model="treeFilter" size="sm" placeholder="부서 검색" width="100%" />
                    </div>
                    <div class="esd-tree-list">
                        <div
                            v-for="item in flatTree"
                            :key="item.key"
                            class="esd-node"
                            :class="[`lvl${Math.min(item.depth, 3)}`, { sel: selectedKey === item.key }]"
                            @click="onNodeSelect(item)"
                        >
                            <!-- 토글 영역: 자식 있는 노드만 클릭 이벤트 가로챔 -->
                            <span
                                class="tw"
                                @click="onToggleClick($event, item.key, item.hasChildren)"
                            >{{ item.hasChildren ? (expandedSet.has(item.key) ? '▾' : '▸') : '' }}</span>
                            <!-- 깊이별 아이콘 -->
                            <i class="ic" :class="nodeIcon(item.depth)" />
                            <span class="esd-node-label">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

                <!-- 우측: 직원 목록 -->
                <div class="esd-table">

                    <!-- 툴바: 브레드크럼 + 이름/사번 검색 -->
                    <div class="esd-table-toolbar">
                        <div class="esd-crumbs">
                            <template v-if="selectedPath.length">
                                <template v-for="(seg, idx) in selectedPath" :key="idx">
                                    <i v-if="idx > 0" class="pi pi-angle-right" />
                                    <span :class="{ here: idx === selectedPath.length - 1 }">{{ seg }}</span>
                                </template>
                                <span class="esd-count-badge">{{ filteredUsers.length }}명</span>
                            </template>
                            <span v-else class="esd-no-sel">부서를 선택하세요</span>
                        </div>
                        <TableSearchInput v-model="tableFilter" size="sm" placeholder="이름/사번 검색" />
                    </div>

                    <!-- 직원 목록 스크롤 영역 -->
                    <div class="esd-table-scroll">
                        <div v-if="loadingUsers" class="esd-loading">
                            <i class="pi pi-spin pi-spinner" />
                        </div>
                        <table v-else class="esd-tbl">
                            <thead>
                                <tr>
                                    <th class="sortable" @click="onSort('usrNm')">
                                        이름<i :class="sortField === 'usrNm' ? (sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down-alt') : 'pi pi-sort-alt'" />
                                    </th>
                                    <th class="sortable" @click="onSort('eno')">
                                        사번<i :class="sortField === 'eno' ? (sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down-alt') : 'pi pi-sort-alt'" />
                                    </th>
                                    <th class="sortable" @click="onSort('ptCNm')">
                                        직위<i :class="sortField === 'ptCNm' ? (sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down-alt') : 'pi pi-sort-alt'" />
                                    </th>
                                    <th class="sortable" @click="onSort('temNm')">
                                        팀<i :class="sortField === 'temNm' ? (sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down-alt') : 'pi pi-sort-alt'" />
                                    </th>
                                    <th class="sortable" @click="onSort('bbrNm')">
                                        부서<i :class="sortField === 'bbrNm' ? (sortDir === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down-alt') : 'pi pi-sort-alt'" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="!sortedUsers.length">
                                    <td colspan="5" class="esd-empty">
                                        <i class="pi pi-search" style="font-size:18px; display:block; margin-bottom:6px;" />
                                        {{ selectedPath.length ? '검색 결과가 없습니다.' : '부서를 선택하면 직원 목록이 표시됩니다.' }}
                                    </td>
                                </tr>
                                <tr
                                    v-for="user in sortedUsers"
                                    :key="user.eno"
                                    :class="{ sel: highlightedUser?.eno === user.eno }"
                                    @click="onRowClick(user)"
                                    @dblclick="onRowDblClick(user)"
                                >
                                    <td>
                                        <div class="name">
                                            <span class="ava">{{ nameInitial(user.usrNm) }}</span>
                                            {{ user.usrNm }}
                                        </div>
                                    </td>
                                    <td class="eno">{{ user.eno }}</td>
                                    <td class="pos">{{ user.ptCNm || '-' }}</td>
                                    <td class="pos">{{ user.temNm || '-' }}</td>
                                    <td class="pos">{{ user.bbrNm || '-' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 푸터: 건수 + 취소/선택 버튼 -->
                    <div class="esd-foot">
                        <div class="esd-pager">
                            <span>총 {{ filteredUsers.length }}건</span>
                        </div>
                        <div class="esd-actions">
                            <button class="esd-btn-ghost" @click="onCancel">취소</button>
                            <button
                                class="esd-btn-primary"
                                :disabled="!highlightedUser"
                                @click="onConfirm"
                            >
                                <i class="pi pi-check" style="font-size:10px;" />선택
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
/* ── 모달 래퍼 ── */
.esd-wrap { background: #fff; overflow: hidden; display: flex; flex-direction: column; }

/* ── 헤더 ── */
.esd-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
    flex-shrink: 0;
}
.esd-head h4 {
    margin: 0; font-size: 15px; font-weight: 600; color: #18181b;
    display: flex; align-items: center; gap: 8px;
}
.esd-head h4 .pi { color: #4f46e5; font-size: 14px; }
.esd-close {
    width: 28px; height: 28px; border: none; background: transparent; border-radius: 6px;
    color: #71717a; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 120ms;
}
.esd-close:hover { background: #f4f4f5; color: #18181b; }

/* ── 바디 ── */
.esd-body { display: flex; height: 560px; }

/* ── 좌: 조직도 트리 ── */
.esd-tree {
    width: 300px; flex-shrink: 0; border-right: 1px solid #e5e7eb;
    display: flex; flex-direction: column;
}
.esd-tree-toolbar { display: flex; gap: 6px; padding: 8px 8px 4px; flex-shrink: 0; }
.esd-tree-btn {
    flex: 1; padding: 6px 8px; border: none; background: transparent;
    font-size: 12px; color: #71717a; cursor: pointer; border-radius: 6px;
    display: flex; align-items: center; justify-content: center; gap: 4px;
    font-family: inherit; transition: background 120ms;
}
.esd-tree-btn:hover { background: #f4f4f5; color: #18181b; }


.esd-tree-list { flex: 1; overflow: auto; }

/* ── 커스텀 트리 노드 (V5 스펙) ── */
.esd-node {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; font-size: 13px; color: #18181b;
    cursor: pointer; border-left: 2px solid transparent;
    transition: background 80ms; user-select: none;
}
.esd-node:hover { background: #f4f4f5; }
.esd-node.sel {
    background: #eef2ff; border-left-color: #4f46e5;
    color: #4338ca; font-weight: 500;
}

/* 깊이별 들여쓰기 */
.esd-node.lvl1 { padding-left: 14px; }
.esd-node.lvl2 { padding-left: 28px; }
.esd-node.lvl3 { padding-left: 42px; }

/* 토글 화살표 */
.esd-node .tw {
    width: 14px; flex-shrink: 0;
    font-size: 13px; color: #52525b; text-align: center;
    line-height: 1;
}
.esd-node.sel .tw { color: #4f46e5; }

/* 깊이별 아이콘 */
.esd-node .ic { font-size: 11px; color: #71717a; flex-shrink: 0; }
.esd-node.sel .ic { color: #4f46e5; }

.esd-node-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── 우: 직원 테이블 ── */
.esd-table { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.esd-table-toolbar {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px;
    border-bottom: 1px solid #f4f4f5; flex-shrink: 0;
}
.esd-crumbs {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: #71717a; flex: 1; min-width: 0; overflow: hidden;
}
.esd-crumbs .here { color: #18181b; font-weight: 500; white-space: nowrap; }
.esd-crumbs .pi-angle-right { font-size: 9px; color: #a1a1aa; flex-shrink: 0; }
.esd-no-sel { color: #a1a1aa; font-style: italic; }
.esd-count-badge {
    margin-left: 6px; padding: 1px 7px; background: #f4f4f5; border-radius: 10px;
    font-size: 11px; color: #71717a; font-variant-numeric: tabular-nums;
    white-space: nowrap; flex-shrink: 0;
}


.esd-table-scroll { flex: 1; overflow: auto; }

.esd-loading {
    display: flex; align-items: center; justify-content: center;
    height: 200px; color: #a1a1aa; font-size: 22px;
}
.esd-empty { text-align: center; padding: 40px 12px; color: #a1a1aa; }

/* ── 직원 테이블 ── */
.esd-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.esd-tbl thead th {
    position: sticky; top: 0; z-index: 1;
    background-color: rgb(30 58 138);
    text-align: left; padding: 9px 14px; font-weight: 500; color: #fff;
    font-size: 12px; border-bottom: none; white-space: nowrap;
}
.esd-tbl thead th .pi { font-size: 9px; margin-left: 4px; color: rgba(255,255,255,0.5); }
.esd-tbl thead th.sortable { cursor: pointer; }
.esd-tbl thead th.sortable:hover { background-color: rgb(30 64 175); }
.esd-tbl thead th + th { border-left: 1px solid rgba(255,255,255,0.15); }
.esd-tbl tbody td {
    padding: 10px 14px; border-bottom: 1px solid #f4f4f5;
    color: #18181b; white-space: nowrap;
}
.esd-tbl tbody td + td { border-left: 1px solid #e5e7eb; }
.esd-tbl tbody tr { cursor: pointer; transition: background 80ms; }
.esd-tbl tbody tr:hover { background: #fafafa; }
.esd-tbl tbody tr.sel { background: #eef2ff; }
.esd-tbl tbody tr.sel td { color: #4338ca; }
.esd-tbl tbody tr:nth-child(even) { background: rgba(244, 244, 245, 0.4); }
.esd-tbl tbody tr:nth-child(even):hover { background: #f4f4f5; }
.esd-tbl tbody tr.sel:nth-child(even) { background: #eef2ff; }

.esd-tbl .name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.esd-tbl .ava {
    width: 26px; height: 26px; border-radius: 50%;
    background: #e0e7ff; color: #4338ca;
    font-size: 11px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.esd-tbl .eno { color: #71717a; font-size: 12px; }
.esd-tbl .pos { color: #52525b; }

/* ── 푸터 ── */
.esd-foot {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-top: 1px solid #e5e7eb;
    background: #fafafa; flex-shrink: 0;
}
.esd-pager { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #71717a; }
.esd-actions { display: flex; gap: 8px; }

.esd-btn-ghost {
    padding: 7px 16px; border: 1px solid #e5e7eb; background: #fff;
    border-radius: 7px; font-size: 13px; color: #52525b; cursor: pointer;
    font-family: inherit; transition: background 120ms;
}
.esd-btn-ghost:hover { background: #f4f4f5; }
.esd-btn-primary {
    padding: 7px 16px; border: none; background: #4f46e5;
    border-radius: 7px; font-size: 13px; color: #fff; cursor: pointer;
    display: flex; align-items: center; gap: 5px;
    font-family: inherit; transition: background 120ms;
}
.esd-btn-primary:hover:not(:disabled) { background: #4338ca; }
.esd-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
