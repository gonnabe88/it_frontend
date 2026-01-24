<script setup lang="ts">
import { ref } from 'vue';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';

const { fetchApprovals } = useApprovals();
const expandedRows = ref({});
const { data: approvals, error, refresh } = await fetchApprovals();
const showEmployeeSearch = ref(false);

const onEmployeeSelect = (user: any) => {
    console.log('Selected user:', user);
    // Future implementation: handle selection
};

definePageMeta({
    title: '전자결재 목록'
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">전자결재 목록</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    신청한 결재 내역을 조회합니다.
                </p>
            </div>
            <div class="flex gap-2">
                <Button label="직원 조회" icon="pi pi-search" outlined @click="showEmployeeSearch = true" />
                <Button icon="pi pi-refresh" outlined rounded @click="refresh()" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="approvals || []" v-model:expandedRows="expandedRows" dataKey="apfMngNo"
                stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" tableStyle="min-width: 50rem">
                <template #empty>
                    <div class="text-center py-8 text-zinc-500">
                        데이터가 없습니다.
                    </div>
                </template>

                <Column expander style="width: 5rem" />
                <Column field="apfMngNo" header="신청관리번호" sortable class="font-medium"></Column>
                <Column field="apfSts" header="상태" sortable>
                    <template #body="{ data }">
                        <Tag :value="data.apfSts" 
                            :severity="data.apfSts === '승인' ? 'success' : data.apfSts === '반려' ? 'danger' : 'info'" />
                    </template>
                </Column>
                <Column field="rqsEno" header="신청자" sortable></Column>
                <Column field="rqsDt" header="신청일자" sortable></Column>
                <Column field="rqsOpnn" header="신청의견" class="max-w-xs truncate"></Column>
                
                <template #expansion="slotProps">
                    <div class="p-4">
                        <h5 class="font-bold text-lg mb-3 text-zinc-700 dark:text-zinc-200">결재자 현황</h5>
                        <DataTable :value="slotProps.data.approvers" size="small" stripedRows>
                            <template #empty>
                                <div class="text-center text-zinc-500 py-4">결재자 정보가 없습니다.</div>
                            </template>
                            <Column field="dcdSqn" header="순번" sortable style="width: 4rem" class="text-center"></Column>
                            <Column field="dcdEno" header="결재자" sortable></Column>
                            <Column field="dcdTp" header="유형" sortable>
                                <template #body="{ data }">
                                    <Badge :value="data.dcdTp" severity="secondary" />
                                </template>
                            </Column>
                            <Column field="dcdDt" header="처리일자" sortable>
                                <template #body="{ data }">
                                    {{ data.dcdDt || '-' }}
                                </template>
                            </Column>
                            <Column field="dcdOpnn" header="의견">
                                <template #body="{ data }">
                                    {{ data.dcdOpnn || '-' }}
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </template>
            </DataTable>
        </div>

        <EmployeeSearchDialog v-model:visible="showEmployeeSearch" @select="onEmployeeSelect" />
    </div>
</template>
