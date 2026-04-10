<!--
================================================================================
[components/common/EmployeeSearchDialog.vue] 직원 조회 다이얼로그 컴포넌트
================================================================================
조직도 트리에서 부서를 선택하고, 해당 부서의 직원 목록에서
담당자를 검색·선택하는 공용 다이얼로그입니다.

[기능]
  - 좌측: 조직도 트리 (PrimeVue Tree, 전체 펼치기/접기)
  - 우측: 선택된 부서의 직원 목록 (DataTable)
  - 직원 행 클릭 시 select 이벤트를 emit하여 부모에 선택 결과 전달

[Props]
  - visible : 다이얼로그 표시 여부 (v-model)
  - header  : 다이얼로그 제목 (기본값: '직원 조회')

[Events]
  - update:visible : 다이얼로그 닫힘 시 visible 상태 동기화
  - select         : 직원 선택 시 OrgUser 객체 전달

[사용처]
  - pages/info/projects/form.vue : 프로젝트 담당자 선택
  - pages/info/cost/form.vue     : 전산업무비 담당자 선택
  - components/cost/*            : 담당자 검색 필드
================================================================================
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useOrganization, type Organization, type OrgUser } from '~/composables/useOrganization';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    header: {
        type: String,
        default: '직원 조회'
    }
});

const emit = defineEmits(['update:visible', 'select']);

const isVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

const { buildOrgTree } = useOrganization();
const config = useRuntimeConfig();
const { $apiFetch } = useNuxtApp();
const nodes = ref<any[]>([]);
const expandedKeys = ref({});
const selectedNode = ref();
const users = ref<OrgUser[]>([]);
const loadingUsers = ref(false);
const selectedUser = ref();

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
});

const expandNode = (node: any, keys: any) => {
    if (node.children && node.children.length) {
        keys[node.key] = true;
        for (const child of node.children) {
            expandNode(child, keys);
        }
    }
};

const expandAll = () => {
    const keys: any = { ...expandedKeys.value };
    for (const node of nodes.value) {
        expandNode(node, keys);
    }
    expandedKeys.value = keys;
};

const collapseAll = () => {
    expandedKeys.value = {};
};

// Handle tree node selection
// useFetch 기반의 fetchUsers는 이벤트 핸들러 내부에서 HTTP 응답을 await하지 않으므로
// 실제 Promise를 반환하는 $apiFetch로 직접 호출합니다.
const onNodeSelect = async (node: any) => {
    if (!node.key) return;

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

/**
 * 직원 행 선택 핸들러
 * 선택된 직원 정보(OrgUser)에 현재 선택된 부서 node의 key(부서코드)를 추가하여 emit합니다.
 * 부모 컴포넌트에서 부서코드(orgCode)와 부서명(bbrNm)을 함께 활용할 수 있습니다.
 */
const onUserSelect = (event: any) => {
    // 현재 선택된 tree node에서 부서코드 추출 (selectedNode는 { [key]: true } 형태)
    const orgCode = selectedNode.value ? Object.keys(selectedNode.value)[0] : '';
    emit('select', { ...event.data, orgCode });
    isVisible.value = false;
};
</script>

<template>
    <Dialog v-model:visible="isVisible" :header="header" modal :style="{ width: '70vw', height: '70vh' }"
        :breakpoints="{ '960px': '75vw', '641px': '90vw' }" contentClass="h-full flex flex-col">
        <div class="h-full flex flex-col">
            <Splitter class="h-full border-none" style="min-height: 400px">
                <SplitterPanel :size="30" :minSize="20" class="h-full flex flex-col overflow-auto p-2">
                    <div class="flex gap-2 mb-2">
                        <Button label="모두 펼치기" icon="pi pi-angle-double-down" size="small" text @click="expandAll" />
                        <Button label="모두 접기" icon="pi pi-angle-double-up" size="small" text @click="collapseAll" />
                    </div>
                    <Tree :value="nodes" selectionMode="single" v-model:selectionKeys="selectedNode"
                        v-model:expandedKeys="expandedKeys" @node-select="onNodeSelect" class="w-full border-none p-0"
                        :filter="true" filterMode="lenient" filterPlaceholder="부서 검색">
                    </Tree>
                </SplitterPanel>
                <SplitterPanel :size="70" :minSize="50" class="h-full flex flex-col p-2 relative">
                    <DataTable :value="users" :loading="loadingUsers" size="small" stripedRows selectionMode="single"
                        v-model:selection="selectedUser" @row-select="onUserSelect" dataKey="eno" :paginator="true"
                        :rows="10" scrollable scrollHeight="flex">
                        <template #empty>
                            <div class="text-center text-zinc-500 py-8">
                                <i class="pi pi-search text-2xl mb-2 block"></i>
                                부서를 선택하면 직원 목록이 표시됩니다.
                            </div>
                        </template>
                        <Column field="bbrNm" header="부서" sortable style="width: 20%"></Column>
                        <Column field="temNm" header="팀" sortable style="width: 20%"></Column>
                        <Column field="usrNm" header="이름" sortable style="width: 20%"></Column>
                        <Column field="eno" header="사번" sortable style="width: 20%"></Column>
                        <Column field="ptCNm" header="직위" sortable style="width: 20%">
                            <template #body="{ data }">
                                {{ data.ptCNm || '-' }}
                            </template>
                        </Column>
                    </DataTable>
                </SplitterPanel>
            </Splitter>
        </div>
    </Dialog>
</template>

<style scoped>
:deep(.p-splitter) {
    border: 1px solid #e5e7eb;
    /* tailwind gray-200 */
}

:deep(.dark .p-splitter) {
    border: 1px solid #27272a;
    /* tailwind zinc-800 */
}
</style>
