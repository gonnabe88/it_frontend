<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost, type ItCost } from '~/composables/useCost';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchCost, createCost, updateCost, fetchCostsBulk } = useCost();

const title = '전산업무비 신청/수정';
definePageMeta({
    title
});

const costs = ref<ItCost[]>([]);

// 초기 데이터 로드
onMounted(async () => {
    const id = route.query.id as string;
    const ids = route.query.ids as string;

    if (id) {
        try {
            const { data } = await fetchCost(id);
            if (data.value) {
                const costData = { ...data.value };
                if (costData.fstDfrDt) {
                    costData.fstDfrDt = new Date(costData.fstDfrDt);
                }
                costs.value.push(costData);
            }
        } catch (e) {
            console.error('Failed to load cost', e);
        }
    } else if (ids) {
        try {
            const idList = ids.split(',');
            const data = await fetchCostsBulk(idList);
            if (data) {
                costs.value = data.map((item: ItCost) => {
                    const costData = { ...item };
                    if (costData.fstDfrDt) {
                        costData.fstDfrDt = new Date(costData.fstDfrDt);
                    }
                    return costData;
                });
            }
        } catch (e) {
            console.error('Failed to load costs bulk', e);
        }
    } else {
        // 신규 등록 시 빈 행 하나 추가
        addCostRow();
    }
});

// 행 추가
const addCostRow = () => {
    costs.value.push({
        ioeNm: '',
        cttNm: '',
        cttTp: '',
        cttOpp: '',
        itMngcBg: 0,
        dfrCle: '',
        fstDfrDt: '',
        cur: 'KRW',
        xcr: 0,
        xcrBseDt: '',
        infPrtYn: 'N',
        indRsn: '',
        pulCgpr: '',
        lstYn: 'Y',
        delYn: 'N'
    });
};

// 행 삭제
const removeCostRow = (index: number) => {
    const item = costs.value[index];
    if (item.itMngcNo) {
        // 기존 데이터 삭제 시 (여기서는 UI에서만 제거하고 저장은 안함, 혹은 별도 처리)
        // 요구사항이 "행추가/삭제하는 형식"이므로 UI에서 제거.
        // 실제 삭제 API 호출은 저장 시점에는 하지 않고, UI 목록에서만 뺌.
        // 만약 삭제 API도 호출해야 한다면 로직 추가 필요.
        // 여기서는 "신청/수정" 화면이므로, 수정 모드일 때 행을 지우면 삭제로 간주할지 여부가 모호함.
        // 보통 이런 그리드 폼에서는 저장 시점에 삭제된 항목을 처리하거나,
        // 단순히 입력 폼에서만 제거하는 방식임.
        // 안전하게 UI 제거만 하고, 실제 데이터 삭제는 상세 화면에서 하도록 유도하거나,
        // 명시적으로 삭제 API를 호출하지 않음 (사용자가 실수로 지울 수 있으므로).
    }
    costs.value.splice(index, 1);
};

// 저장
const saveCosts = async () => {
    if (costs.value.length === 0) {
        alert('저장할 데이터가 없습니다.');
        return;
    }

    // 유효성 검사 (간단하게)
    for (const cost of costs.value) {
        if (!cost.ioeNm) {
            alert('비목명을 입력해주세요.');
            return;
        }
    }

    try {
        // 순차적으로 처리
        for (const cost of costs.value) {
            // fstDfrDt가 Date 객체인 경우 YYYY-MM-DD 형식의 문자열로 변환
            // 복사본을 만들어 전송 (UI 상태 유지를 위해)
            const payload = { ...cost };
            if (payload.fstDfrDt && payload.fstDfrDt instanceof Date) {
                const year = payload.fstDfrDt.getFullYear();
                const month = String(payload.fstDfrDt.getMonth() + 1).padStart(2, '0');
                const day = '01'; // 월 단위 선택이므로 1일로 고정
                payload.fstDfrDt = `${year}-${month}-${day}`;
            }

            if (payload.itMngcNo) {
                await updateCost(payload.itMngcNo, payload);
            } else {
                await createCost(payload);
            }
        }

        confirm.require({
            message: '저장되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/cost');
            }
        });
    } catch (e) {
        console.error('Save failed', e);
        alert('저장 중 오류가 발생했습니다.');
    }
};

const cancel = () => {
    router.back();
};

// 옵션들
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
const ynOptions = ['Y', 'N'];

</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex gap-2">
                <Button label="행 추가" icon="pi pi-plus" severity="secondary" @click="addCostRow" />
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" icon="pi pi-save" @click="saveCosts" />
            </div>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="costs" editMode="cell" tableClass="editable-cells-table" :pt="{
                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
            }">
                <Column header="비목명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.ioeNm" class="w-full" />
                    </template>
                </Column>
                <Column header="계약명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttNm" class="w-full" />
                    </template>
                </Column>
                <Column header="계약구분" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttTp" class="w-full" />
                    </template>
                </Column>
                <Column header="계약상대처" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttOpp" class="w-full" />
                    </template>
                </Column>
                <Column header="예산" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                            locale="ko-KR" class="w-full" />
                    </template>
                </Column>
                <Column header="통화" style="width: 100px">
                    <template #body="{ data }">
                        <Select v-model="data.cur" :options="currencyOptions" class="w-full" />
                    </template>
                </Column>
                <Column header="지급주기" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.dfrCle" class="w-full" />
                    </template>
                </Column>
                <Column header="최초지급일" style="min-width: 140px">
                    <template #body="{ data }">
                        <DatePicker v-model="data.fstDfrDt" view="month" dateFormat="yy-mm" showIcon fluid
                            placeholder="최초지급일" class="w-full" />
                    </template>
                </Column>
                <Column header="담당자" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.pulCgpr" class="w-full" />
                    </template>
                </Column>
                <Column header="삭제" style="width: 50px; text-align: center">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" text severity="danger" @click="removeCostRow(index)" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
