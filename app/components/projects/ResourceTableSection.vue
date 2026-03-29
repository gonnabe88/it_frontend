<!--
================================================================================
[components/projects/ResourceTableSection.vue] 소요자원 상세내용 섹션 컴포넌트
================================================================================
정보화사업/경상사업 폼에서 공통으로 사용하는 소요자원 DataTable 섹션입니다.
카드 컨테이너, 넓게 보기 토글, 품목 추가/삭제, CascadeSelect 구분 입력을 포함합니다.

[Props]
  - currencyOptions : 통화 선택지 (부모에서 useCurrencyRates로 계산 후 전달)
  - error           : 유효성 오류 여부 (오류 메시지 표시)

[v-model]
  - ResourceItem[]  : 소요자원 항목 배열 (부모 form.resourceItems와 양방향 바인딩)
================================================================================
-->
<script setup lang="ts">
import { ref } from 'vue';

/**
 * 소요자원 항목 인터페이스 (UI 모델)
 */
export interface ResourceItem {
    category: string;
    subCategory: string;
    item: string;
    quantity: number;
    currency: string;
    basis: string;
    introDate: Date | null;
    paymentCycle: string;
    infoProtection: string;
    integratedInfra: string;
    gclAmt: number;
    unitPrice?: number;
    xcr?: number;
    gclMngNo?: string | null;
}

/** CascadeSelect 옵션 노드 타입 */
interface CategoryOption {
    label: string;
    category: string;
    subCategory: string;
    items?: CategoryOption[];
}

const props = defineProps<{
    /** 통화 선택지 (부모에서 useCurrencyRates로 계산 후 전달) */
    currencyOptions: string[];
    /** 유효성 오류 여부 */
    error?: boolean;
}>();

/** 소요자원 항목 배열 (v-model) */
const items = defineModel<ResourceItem[]>({ required: true });

const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

/**
 * 구분 CascadeSelect 트리 옵션
 * 소분류가 있는 대분류는 items 배열을 가지며, 없는 항목은 leaf 노드로 직접 선택됩니다.
 */
const resourceCategorySelectOptions: CategoryOption[] = [
    {
        label: '개발비', category: '개발비', subCategory: '',
        items: [
            { label: '일반', category: '개발비', subCategory: '일반' },
            { label: '감리/컨설팅', category: '개발비', subCategory: '감리/컨설팅' },
        ],
    },
    { label: '기계장치', category: '기계장치', subCategory: '' },
    {
        label: '기타무형자산', category: '기타무형자산', subCategory: '',
        items: [
            { label: '일반', category: '기타무형자산', subCategory: '일반' },
            { label: 'SW라이선스', category: '기타무형자산', subCategory: 'SW라이선스' },
        ],
    },
    {
        label: '전산용역비', category: '전산용역비', subCategory: '',
        items: [
            { label: '외주(운영,관제 등)', category: '전산용역비', subCategory: '외주(운영,관제 등)' },
            { label: '자문/심사', category: '전산용역비', subCategory: '자문/심사' },
        ],
    },
    { label: '전산임차료', category: '전산임차료', subCategory: '' },
    { label: '전산제비', category: '전산제비', subCategory: '' },
];

/**
 * category + subCategory 값으로 CascadeSelect 선택값 노드를 찾아 반환합니다.
 */
const findCategoryOption = (category: string, subCategory: string): CategoryOption | null => {
    for (const opt of resourceCategorySelectOptions) {
        if (opt.items) {
            if (subCategory) {
                const sub = opt.items.find(s => s.category === category && s.subCategory === subCategory);
                if (sub) return sub;
            }
        } else {
            if (opt.category === category) return opt;
        }
    }
    return null;
};

/**
 * CascadeSelect 변경 이벤트 처리
 */
const onCategorySelect = (rowData: ResourceItem, value: CategoryOption) => {
    rowData.category = value.category;
    rowData.subCategory = value.subCategory;
};

/** 소요자원 테이블 넓게 보기 토글 상태 */
const isExpanded = ref(false);
const toggleExpand = () => { isExpanded.value = !isExpanded.value; };

/**
 * 소요자원 행 추가
 */
const addRow = () => {
    items.value.push({
        category: '개발비',
        subCategory: '',
        item: '',
        quantity: 0,
        currency: 'KRW',
        gclAmt: 0,
        basis: '',
        introDate: null,
        paymentCycle: '',
        infoProtection: 'N',
        integratedInfra: 'N',
    });
};

/**
 * 소요자원 행 삭제
 * @param index - 삭제할 행 인덱스
 */
const removeRow = (index: number) => {
    items.value.splice(index, 1);
};
</script>

<template>
    <!-- 소요자원 상세내용 카드 (토글 폭 사용) -->
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 transition-all duration-300"
        :class="isExpanded ? 'w-full' : 'max-w-[1440px] mx-auto w-full'">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">소요자원 상세내용<span
                        class="text-red-500">*</span></h3>
                <Button :icon="isExpanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" variant="text"
                    severity="secondary" rounded @click="toggleExpand"
                    v-tooltip.top="isExpanded ? '기본 폭으로' : '넓게 보기'" />
            </div>
            <Button icon="pi pi-plus" size="small" @click="addRow" />
        </div>
        <p v-if="error" class="text-red-500 text-xs">소요자원을 1개 이상 등록해주세요.</p>

        <div class="overflow-x-auto">
            <DataTable :value="items" resizableColumns columnResizeMode="fit" showGridlines size="small"
                class="resource-table">
                <template #empty>
                    <div class="flex flex-col items-center justify-center text-zinc-500" style="min-height: 350px;">
                        등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                    </div>
                </template>

                <!-- 구분: CascadeSelect (대분류 → 소분류 2단계) -->
                <Column header="구분" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 160px;">
                    <template #body="{ data }">
                        <CascadeSelect :model-value="findCategoryOption(data.category, data.subCategory)"
                            :options="resourceCategorySelectOptions" optionLabel="label" optionGroupLabel="label"
                            optionGroupChildren="items" placeholder="선택" fluid
                            @change="onCategorySelect(data, $event.value)">
                            <template #value="{ value }">
                                <template v-if="value">
                                    {{ value.category }}
                                    <template v-if="value.subCategory">
                                        <span class="opacity-40 mx-0.5">›</span>{{ value.subCategory }}
                                    </template>
                                </template>
                                <span v-else style="color: var(--p-cascadeselect-placeholder-color)">선택</span>
                            </template>
                        </CascadeSelect>
                    </template>
                </Column>

                <!-- 항목: 자동 줄바꿈 Textarea -->
                <Column header="항목" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 200px">
                    <template #body="{ data }">
                        <Textarea v-model="data.item" rows="1" autoResize class="w-full" />
                    </template>
                </Column>

                <!-- 수량 -->
                <Column header="수량" headerClass="text-center justify-center [&>div]:justify-center"
                    bodyClass="col-quantity" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                    </template>
                </Column>

                <!-- 통화: KRW/USD/EUR 등 -->
                <Column header="통화" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 소계: 직접 입력 → 단가 자동 역산 -->
                <Column header="소계" headerClass="text-center justify-center [&>div]:justify-center"
                    bodyClass="col-subtotal" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.gclAmt" mode="currency" :currency="data.currency || 'KRW'"
                            locale="ko-KR" class="w-full" />
                    </template>
                </Column>

                <!-- 산정근거 -->
                <Column header="산정근거" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 150px">
                    <template #body="{ data }">
                        <Textarea v-model="data.basis" rows="1" autoResize class="w-full" />
                    </template>
                </Column>

                <!-- 도입시기/지급주기: 구분에 따라 다른 입력 컴포넌트 표시 -->
                <Column header="도입시기/지급주기" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 200px">
                    <template #body="{ data }">
                        <!-- 자본예산: 도입시기 DatePicker (월 단위) -->
                        <div v-if="['개발비', '기계장치', '기타무형자산'].includes(data.category)">
                            <DatePicker v-model="data.introDate" view="month" dateFormat="yy-mm" showIcon fluid
                                placeholder="도입시기" class="w-full" />
                        </div>
                        <!-- 임차료/제비: 지급주기 드롭다운 -->
                        <div v-else-if="['전산임차료', '전산제비'].includes(data.category)">
                            <Select v-model="data.paymentCycle" :options="paymentCycleOptions" placeholder="지급주기"
                                class="w-full" />
                        </div>
                    </template>
                </Column>

                <!-- 정보보호 여부 (Y/N) -->
                <Column header="정보보호" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.infoProtection" :options="ynOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 통합인프라 여부 (Y/N) -->
                <Column header="통합인프라" headerClass="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.integratedInfra" :options="ynOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 행 삭제 버튼 -->
                <Column header="" headerClass="text-center justify-center [&>div]:justify-center" style="width: 50px">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" text severity="danger" @click="removeRow(index)" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/** 소요자원 테이블 헤더 배경색 및 텍스트 색상 */
.resource-table :deep(.p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}

.resource-table :deep(.p-datatable-thead > tr > th) {
    background-color: #f4f4f5 !important;
    color: #27272a !important;
}

/** 소요자원 테이블 최소 높이 */
.resource-table :deep(.p-datatable-table-container) {
    min-height: 400px;
}

/** 수량/소계 컬럼 InputNumber: PrimeVue 기본 min-width 강제 제거 */
.resource-table :deep(.col-quantity .p-inputnumber),
.resource-table :deep(.col-quantity .p-inputnumber-input),
.resource-table :deep(.col-subtotal .p-inputnumber),
.resource-table :deep(.col-subtotal .p-inputnumber-input) {
    min-width: 0 !important;
    width: 100% !important;
}

/** 다크모드: html.dark는 컴포넌트 외부 조상 요소이므로 :global()로 선언 */
:global(html.dark) .resource-table :deep(.p-datatable-thead > tr > th) {
    background-color: #27272a !important;
    color: #e4e4e7 !important;
}
</style>
