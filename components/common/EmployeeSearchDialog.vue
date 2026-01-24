<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useOrganization, type Organization, type User } from '~/composables/useOrganization';

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

const { fetchOrganizations, fetchUsers, buildOrgTree } = useOrganization();
const nodes = ref<any[]>([]);
const expandedKeys = ref({});
const selectedNode = ref();
const users = ref<User[]>([]);
const loadingUsers = ref(false);
const selectedUser = ref();

// Load organization tree
onMounted(async () => {
    const { data } = await fetchOrganizations();
    if (data.value) {
        nodes.value = buildOrgTree(data.value);
        expandAll();
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
const onNodeSelect = async (node: any) => {
    if (!node.key) return;
    
    loadingUsers.value = true;
    try {
        const { data } = await fetchUsers(node.key);
        if (data.value) {
            users.value = data.value;
        } else {
            users.value = [];
        }
    } catch (e) {
        console.error('Failed to users', e);
        users.value = [];
    } finally {
        loadingUsers.value = false;
    }
};

const onUserSelect = (event: any) => {
    emit('select', event.data);
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
                        v-model:expandedKeys="expandedKeys"
                        @node-select="onNodeSelect" class="w-full border-none p-0" :filter="true" filterMode="lenient"
                        filterPlaceholder="부서 검색">
                    </Tree>
                </SplitterPanel>
                <SplitterPanel :size="70" :minSize="50" class="h-full flex flex-col p-2 relative">
                    <DataTable :value="users" :loading="loadingUsers" size="small" stripedRows selectionMode="single"
                        v-model:selection="selectedUser" @row-select="onUserSelect" dataKey="eno"
                        :paginator="true" :rows="10" scrollable scrollHeight="flex">
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
    border: 1px solid #e5e7eb; /* tailwind gray-200 */
}
:deep(.dark .p-splitter) {
    border: 1px solid #27272a; /* tailwind zinc-800 */
}
</style>
