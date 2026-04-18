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

[구분 코드 연동]
  - 공통코드(CCODEM)에서 CTT_TP = IOE_LEAFE, IOE_XPN, IOE_SEVS, IOE_IDR, IOE_CPIT 조회
  - cdNm을 ' - ' 기준으로 분할하여 CascadeSelect 계층 구조 생성
  - 저장 시 cdId(예: IOE-351-1100-1)를 gclDtt에 저장
================================================================================
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

/**
 * 소요자원 항목 인터페이스 (UI 모델)
 * category에는 공통코드 cdId를 저장합니다.
 */
export interface ResourceItem {
    category: string;       // cdId (예: IOE-351-1100-1)
    subCategory: string;    // 미사용 (하위호환용, 빈 문자열)
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

/** 공통코드 응답 타입 */
interface CodeResponse {
    cdId: string;
    cdNm: string;
    cdva: string;
    cttTp: string;
    cttTpDes: string;
    cdSqn?: number | null;
}

/** CascadeSelect 옵션 노드 타입 */
interface CategoryOption {
    label: string;
    cdId: string;
    cttTp: string;
    items?: CategoryOption[];
}

defineProps<{
    /** 통화 선택지 (부모에서 useCurrencyRates로 계산 후 전달) */
    currencyOptions: string[];
    /** 유효성 오류 여부 */
    error?: boolean;
}>();

/** 소요자원 항목 배열 (v-model) */
const items = defineModel<ResourceItem[]>({ required: true });

const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

/* ── 공통코드에서 IOE 비목 코드 조회 ── */

const config = useRuntimeConfig();

/** 조회 대상 CTT_TP 목록 */
const IOE_CTT_TYPES = ['IOE_LEAFE', 'IOE_XPN', 'IOE_SEVS', 'IOE_IDR', 'IOE_CPIT'] as const;

/** 전체 IOE 코드 원본 데이터 */
const ioeCodes = ref<CodeResponse[]>([]);

/** cdId → CodeResponse 매핑 (부모에서 cttTp 조회용) */
const codeMap = computed(() => {
    const map = new Map<string, CodeResponse>();
    for (const code of ioeCodes.value) {
        map.set(code.cdId, code);
    }
    return map;
});

/**
 * cdId로 해당 코드의 cttTp 조회
 * 부모 컴포넌트에서 자본예산/일반관리비 분류에 사용합니다.
 */
const getCttTpByCdId = (cdId: string): string => {
    return codeMap.value.get(cdId)?.cttTp || '';
};

/** 부모에게 cttTp 조회 함수 노출 */
defineExpose({ getCttTpByCdId });

/**
 * 공통코드 데이터를 CascadeSelect 트리 구조로 변환
 *
 * cdNm을 ' - ' 기준으로 분할하여 계층 구조 생성:
 *   - 2단계: "전산임차료 - 국내전산임차료" → 전산임차료 > 국내전산임차료
 *   - 3단계: "전산용역비 - 외주용역 - 외주운영/관제 등" → 전산용역비 > 외주용역 > 외주운영/관제 등
 *   - 1단계(leaf 없음): "자본예산 - 기계장치" → 자본예산 > 기계장치 (직접 선택)
 */
const resourceCategorySelectOptions = computed<CategoryOption[]>(() => {
    if (ioeCodes.value.length === 0) return [];

    // 1단계: 첫 번째 segment별 그룹핑
    const level1Map = new Map<string, { codes: CodeResponse[]; hasSub: boolean }>();

    for (const code of ioeCodes.value) {
        const segments = code.cdNm.split(' - ').map(s => s.trim());
        const key = segments[0]!;
        if (!level1Map.has(key)) {
            level1Map.set(key, { codes: [], hasSub: false });
        }
        const group = level1Map.get(key)!;
        group.codes.push(code);
        if (segments.length >= 2) {
            group.hasSub = true;
        }
    }

    // 2단계: 트리 구조 생성
    const options: CategoryOption[] = [];

    for (const [label1, group] of level1Map) {
        if (group.codes.length === 1 && group.codes[0]!.cdNm.split(' - ').length <= 2) {
            // 하위 항목이 1개뿐이고 2단계 이하 → leaf 노드
            const code = group.codes[0]!;
            options.push({
                label: label1,
                cdId: code.cdId,
                cttTp: code.cttTp,
            });
        } else {
            // 2단계 그룹핑
            const level2Map = new Map<string, CodeResponse[]>();

            for (const code of group.codes) {
                const segments = code.cdNm.split(' - ').map(s => s.trim());
                if (segments.length === 2) {
                    // "전산임차료 - 국내전산임차료" → leaf
                    const key2 = segments[1]!;
                    level2Map.set(key2, [code]);
                } else if (segments.length >= 3) {
                    // "전산용역비 - 외주용역 - 외주운영/관제 등" → 2단계 그룹
                    const key2 = segments[1]!;
                    if (!level2Map.has(key2)) {
                        level2Map.set(key2, []);
                    }
                    level2Map.get(key2)!.push(code);
                }
            }

            const subItems: CategoryOption[] = [];
            for (const [label2, codes] of level2Map) {
                if (codes.length === 1 && codes[0]!.cdNm.split(' - ').length <= 2) {
                    // 2단계 leaf
                    subItems.push({
                        label: label2,
                        cdId: codes[0]!.cdId,
                        cttTp: codes[0]!.cttTp,
                    });
                } else if (codes.length === 1 && codes[0]!.cdNm.split(' - ').length >= 3) {
                    // 3단계이지만 하위 1개 → leaf
                    const seg = codes[0]!.cdNm.split(' - ').map(s => s.trim());
                    subItems.push({
                        label: `${label2} - ${seg.slice(2).join(' - ')}`,
                        cdId: codes[0]!.cdId,
                        cttTp: codes[0]!.cttTp,
                    });
                } else {
                    // 3단계 그룹 (여러 하위 항목)
                    const level3Items: CategoryOption[] = codes.map(code => {
                        const seg = code.cdNm.split(' - ').map(s => s.trim());
                        return {
                            label: seg.slice(2).join(' - '),
                            cdId: code.cdId,
                            cttTp: code.cttTp,
                        };
                    });
                    subItems.push({
                        label: label2,
                        cdId: '',
                        cttTp: codes[0]!.cttTp,
                        items: level3Items,
                    });
                }
            }

            options.push({
                label: label1,
                cdId: '',
                cttTp: group.codes[0]!.cttTp,
                items: subItems,
            });
        }
    }

    return options;
});

/**
 * cdId로 CascadeSelect 선택값 노드를 찾아 반환합니다.
 * 트리를 재귀 탐색하여 일치하는 leaf 노드를 반환합니다.
 */
const findCategoryOption = (cdId: string): CategoryOption | null => {
    if (!cdId) return null;
    const search = (opts: CategoryOption[]): CategoryOption | null => {
        for (const opt of opts) {
            if (opt.cdId === cdId) return opt;
            if (opt.items) {
                const found = search(opt.items);
                if (found) return found;
            }
        }
        return null;
    };
    return search(resourceCategorySelectOptions.value);
};

/**
 * cdId로 표시 라벨 생성 (CascadeSelect value 표시용)
 * 경로를 ' › ' 구분자로 연결합니다.
 */
const getCategoryDisplayLabel = (cdId: string): string => {
    const code = codeMap.value.get(cdId);
    if (!code) return cdId;
    // cdNm의 ' - '를 ' › '로 변환
    return code.cdNm.split(' - ').map(s => s.trim()).join(' › ');
};

/**
 * CascadeSelect 변경 이벤트 처리
 */
const onCategorySelect = (rowData: ResourceItem, value: CategoryOption) => {
    if (value && value.cdId) {
        rowData.category = value.cdId;
        rowData.subCategory = '';
    }
};

/** 소요자원 테이블 넓게 보기 토글 상태 */
const isExpanded = ref(false);
const toggleExpand = () => { isExpanded.value = !isExpanded.value; };

/**
 * 소요자원 행 추가
 */
const addRow = () => {
    items.value.push({
        category: '',
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

/**
 * IOE 비목 코드 일괄 조회
 * 5개 CTT_TP를 병렬로 조회하여 ioeCodes에 병합합니다.
 */
onMounted(async () => {
    try {
        const { $apiFetch } = useNuxtApp();
        const results = await Promise.all(
            IOE_CTT_TYPES.map(cttTp =>
                $apiFetch<CodeResponse[]>(`${config.public.apiBase}/api/ccodem/type/${cttTp}`)
            )
        );
        ioeCodes.value = results.flat().sort((a, b) => (a.cdSqn ?? Infinity) - (b.cdSqn ?? Infinity));
    } catch (e) {
        console.error('IOE 비목 코드 조회 실패', e);
    }
});
</script>

<template>
    <!-- 소요자원 상세내용 카드 (토글 폭 사용) -->
    <div
class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 transition-all duration-300"
        :class="isExpanded ? 'w-full' : 'max-w-[1440px] mx-auto w-full'">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">소요자원 상세내용<span
                        class="text-red-500">*</span></h3>
                <Button
v-tooltip.top="isExpanded ? '기본 폭으로' : '넓게 보기'" :icon="isExpanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
                    variant="text" severity="secondary" rounded
                    @click="toggleExpand" />
            </div>
            <Button icon="pi pi-plus" size="small" @click="addRow" />
        </div>
        <p v-if="error" class="text-red-500 text-xs">소요자원을 1개 이상 등록해주세요.</p>

        <div class="overflow-x-auto">
            <StyledDataTable
                :value="items" size="small"
                scrollable scroll-height="400px" class="resource-table">
                <template #empty>
                    <div class="flex flex-col items-center justify-center text-zinc-500" style="min-height: 350px;">
                        등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                    </div>
                </template>

                <!-- 구분: CascadeSelect (공통코드 기반 계층 구조) -->
                <Column
header="구분" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 160px;">
                    <template #body="{ data }">
                        <CascadeSelect
                            :model-value="findCategoryOption(data.category)"
                            :options="resourceCategorySelectOptions" option-label="label" option-group-label="label"
                            option-group-children="items" placeholder="선택" fluid
                            @change="onCategorySelect(data, $event.value)">
                            <template #value="{ value }">
                                <template v-if="value && value.cdId">
                                    {{ getCategoryDisplayLabel(value.cdId) }}
                                </template>
                                <template v-else-if="data.category">
                                    {{ getCategoryDisplayLabel(data.category) }}
                                </template>
                                <span v-else style="color: var(--p-cascadeselect-placeholder-color)">선택</span>
                            </template>
                        </CascadeSelect>
                    </template>
                </Column>

                <!-- 항목: 자동 줄바꿈 Textarea -->
                <Column
header="항목" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 200px">
                    <template #body="{ data }">
                        <Textarea v-model="data.item" rows="1" auto-resize class="w-full" />
                    </template>
                </Column>

                <!-- 수량 -->
                <Column
header="수량" header-class="text-center justify-center [&>div]:justify-center"
                    body-class="col-quantity" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                    </template>
                </Column>

                <!-- 통화: KRW/USD/EUR 등 -->
                <Column
header="통화" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 소계: 직접 입력 → 단가 자동 역산 -->
                <Column
header="소계" header-class="text-center justify-center [&>div]:justify-center"
                    body-class="col-subtotal" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber
v-model="data.gclAmt" mode="currency" :currency="data.currency || 'KRW'"
                            locale="ko-KR" class="w-full" />
                    </template>
                </Column>

                <!-- 산정근거 -->
                <Column
header="산정근거" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 150px">
                    <template #body="{ data }">
                        <Textarea v-model="data.basis" rows="1" auto-resize class="w-full" />
                    </template>
                </Column>

                <!-- 도입시기/지급주기: cttTp에 따라 다른 입력 컴포넌트 표시 -->
                <Column
header="도입시기/지급주기" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 200px">
                    <template #body="{ data }">
                        <!-- 자본예산(IOE_CPIT): 도입시기 DatePicker (월 단위) -->
                        <div v-if="getCttTpByCdId(data.category) === 'IOE_CPIT'">
                            <DatePicker
v-model="data.introDate" view="month" date-format="yy-mm" show-icon fluid
                                placeholder="도입시기" class="w-full" />
                        </div>
                        <!-- 임차료/제비/여비/용역비: 지급주기 드롭다운 -->
                        <div v-else-if="data.category && getCttTpByCdId(data.category)">
                            <Select
v-model="data.paymentCycle" :options="paymentCycleOptions" placeholder="지급주기"
                                class="w-full" />
                        </div>
                    </template>
                </Column>

                <!-- 정보보호 여부 (Y/N) -->
                <Column
header="정보보호" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.infoProtection" :options="ynOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 통합인프라 여부 (Y/N) -->
                <Column
header="통합인프라" header-class="text-center justify-center [&>div]:justify-center"
                    style="min-width: 80px">
                    <template #body="{ data }">
                        <Select v-model="data.integratedInfra" :options="ynOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 행 삭제 버튼 -->
                <Column header="" header-class="text-center justify-center [&>div]:justify-center" style="width: 50px">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" text severity="danger" @click="removeRow(index)" />
                    </template>
                </Column>
            </StyledDataTable>
        </div>
    </div>
</template>

<style>
/*
 * 비스코프 CSS — StyledDataTable 래퍼(kdb-it-table) 내부 PrimeVue 요소에
 * <style scoped> + :deep()이 도달하지 못하므로 .resource-table 클래스를 앵커로 사용
 */

/** 소요자원 테이블: 스크롤 영역 최소 높이 고정 */
.resource-table .p-datatable-table-container {
    min-height: 400px;
}

/** 수량/소계 컬럼 InputNumber: PrimeVue 기본 min-width 강제 제거 */
.resource-table .col-quantity .p-inputnumber,
.resource-table .col-quantity .p-inputnumber-input,
.resource-table .col-subtotal .p-inputnumber,
.resource-table .col-subtotal .p-inputnumber-input {
    min-width: 0 !important;
    width: 100% !important;
}
</style>
