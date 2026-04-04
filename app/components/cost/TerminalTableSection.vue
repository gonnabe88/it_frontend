<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    modelValue: any[];
    currencyOptions: string[];
}>();

const emit = defineEmits(['update:modelValue']);

/** 신규 행 추가 */
const addRow = () => {
    const newRow = {
        tmnNm: '',
        tmnTuzManr: '',
        tmnUsg: '',
        tmnSvc: '',
        tmlAmt: 0,
        cur: 'KRW',
        xcr: 1,
        xcrBseDt: new Date().toISOString().split('T')[0],
        dfrCle: '매월',
        indRsn: '',
        cgpr: '',
        biceTem: '',
        biceDpm: '',
        rmk: ''
    };
    emit('update:modelValue', [...props.modelValue, newRow]);
};

/** 행 삭제 */
const removeRow = (index: number) => {
    const newRows = [...props.modelValue];
    newRows.splice(index, 1);
    emit('update:modelValue', newRows);
};

</script>

<template>
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 w-full">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <i class="pi pi-list text-indigo-500"></i>
                단말기 상세 목록
            </h3>
            <Button label="행 추가" icon="pi pi-plus" size="small" severity="secondary" @click="addRow" />
        </div>

        <DataTable :value="modelValue" responsive-layout="scroll" class="p-datatable-sm border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden" :scrollable="true" scroll-height="400px">
            <Column header="No" :style="{ width: '50px' }">
                <template #body="slotProps">
                    {{ slotProps.index + 1 }}
                </template>
            </Column>
            <Column field="tmnNm" header="단말기명" :style="{ width: '150px' }">
                <template #body="slotProps">
                    <InputText v-model="slotProps.data.tmnNm" class="w-full !text-xs" />
                </template>
            </Column>
            <Column field="tmnTuzManr" header="이용방법" :style="{ width: '150px' }">
                <template #body="slotProps">
                    <InputText v-model="slotProps.data.tmnTuzManr" class="w-full !text-xs" />
                </template>
            </Column>
            <Column field="tmnUsg" header="용도" :style="{ width: '150px' }">
                <template #body="slotProps">
                    <InputText v-model="slotProps.data.tmnUsg" class="w-full !text-xs" />
                </template>
            </Column>
            <Column field="tmlAmt" header="금액" :style="{ width: '120px' }">
                <template #body="slotProps">
                    <InputNumber v-model="slotProps.data.tmlAmt" class="w-full !text-xs" :min="0" />
                </template>
            </Column>
            <Column field="cur" header="통화" :style="{ width: '100px' }">
                <template #body="slotProps">
                    <Select v-model="slotProps.data.cur" :options="currencyOptions" class="w-full !text-xs" />
                </template>
            </Column>
            <Column field="dfrCle" header="지급주기" :style="{ width: '100px' }">
                <template #body="slotProps">
                    <InputText v-model="slotProps.data.dfrCle" class="w-full !text-xs" />
                </template>
            </Column>
            <Column header="관리" :style="{ width: '50px' }">
                <template #body="slotProps">
                    <Button icon="pi pi-trash" severity="danger" text rounded @click="removeRow(slotProps.index)" />
                </template>
            </Column>
        </DataTable>
    </div>
</template>
