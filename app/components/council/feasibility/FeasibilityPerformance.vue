<!--
================================================================================
[components/council/feasibility/FeasibilityPerformance.vue]
타당성검토표 — 3. 성과관리 자체계획 섹션
================================================================================
성과지표를 동적으로 추가/삭제할 수 있는 섹션입니다.
지표는 1개 이상이어야 하며, 추가/삭제 버튼으로 관리합니다.

[성과지표 입력 항목]
  - 지표명 (dtpNm)
  - 지표 정의 (dtpCone)
  - 측정방법 (msmManr)
  - 산식 (clf)
  - 목표치 (glNv)
  - 측정시작일 (msmSttDt)
  - 측정종료일 (msmEndDt)
  - 측정시점 (msmTpm)
  - 측정주기 (msmCle)

[Props]
  modelValue : PerformanceItem[] (v-model)
  readonly   : 읽기 전용 여부

[Design Ref: §4.2 [id].vue — 성과관리 자체계획 섹션]
================================================================================
-->
<script setup lang="ts">
import type { PerformanceItem } from '~/types/council';

interface Props {
    /** 성과지표 목록 (v-model) */
    modelValue: PerformanceItem[];
    /** 읽기 전용 여부 */
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: PerformanceItem[]): void;
}>();

/**
 * 성과지표 기본값 생성
 * 새 지표 추가 시 dtpSno는 현재 최대값 + 1
 */
const createDefaultPerformance = (): PerformanceItem => ({
    dtpSno: props.modelValue.length > 0
        ? Math.max(...props.modelValue.map(p => p.dtpSno)) + 1
        : 1,
    dtpNm: '',
    dtpCone: '',
    msmManr: '',
    clf: '',
    glNv: '',
    msmSttDt: null,
    msmEndDt: null,
    msmTpm: '',
    msmCle: '',
});

/**
 * 성과지표 추가
 * 새 기본 지표를 목록 끝에 추가합니다.
 */
const addPerformance = () => {
    emit('update:modelValue', [...props.modelValue, createDefaultPerformance()]);
};

/**
 * 성과지표 삭제
 * 최소 1개는 유지합니다.
 *
 * @param index 삭제할 지표 인덱스
 */
const removePerformance = (index: number) => {
    if (props.modelValue.length <= 1) return;
    emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
};

/**
 * 특정 지표의 단일 필드 업데이트
 *
 * @param index 지표 인덱스
 * @param field 업데이트할 필드명
 * @param value 새 값
 */
const updateField = (index: number, field: keyof PerformanceItem, value: unknown) => {
    const updated = props.modelValue.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
    );
    emit('update:modelValue', updated);
};
</script>

<template>
    <div class="space-y-4">

        <!--
            성과지표 카드 목록
            Plan SC: 성과지표 1개 이상 필수 (작성완료 시 검증은 [id].vue에서 수행)
        -->
        <div
            v-for="(item, index) in modelValue"
            :key="item.dtpSno"
            class="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700"
        >
            <!-- 카드 헤더: 성과지표 N + 삭제 버튼 -->
            <div class="flex items-center justify-between mb-4">
                <h4 class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
                    성과지표 {{ index + 1 }}
                </h4>
                <Button
                    v-if="!readonly && modelValue.length > 1"
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    size="small"
                    v-tooltip.top="'이 성과지표 삭제'"
                    @click="removePerformance(index)"
                />
            </div>

            <!-- 지표 필드 그리드 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                <!-- 지표명 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        지표명 <span class="text-red-500">*</span>
                    </label>
                    <InputText
                        :value="item.dtpNm"
                        :disabled="readonly"
                        placeholder="성과지표명"
                        fluid
                        @input="updateField(index, 'dtpNm', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <!-- 목표치 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">목표치</label>
                    <InputText
                        :value="item.glNv"
                        :disabled="readonly"
                        placeholder="예: 95% 이상"
                        fluid
                        @input="updateField(index, 'glNv', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <!-- 지표 정의 (wide) -->
                <div class="flex flex-col gap-1 md:col-span-2">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">지표 정의</label>
                    <Textarea
                        :value="item.dtpCone"
                        :disabled="readonly"
                        placeholder="성과지표 정의"
                        rows="2"
                        fluid
                        @input="updateField(index, 'dtpCone', ($event.target as HTMLTextAreaElement).value)"
                    />
                </div>

                <!-- 측정방법 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">측정방법</label>
                    <InputText
                        :value="item.msmManr"
                        :disabled="readonly"
                        placeholder="측정방법"
                        fluid
                        @input="updateField(index, 'msmManr', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <!-- 산식 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">산식</label>
                    <InputText
                        :value="item.clf"
                        :disabled="readonly"
                        placeholder="산식"
                        fluid
                        @input="updateField(index, 'clf', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <!-- 측정시작일 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">측정시작일</label>
                    <InputText
                        :value="item.msmSttDt ?? ''"
                        :disabled="readonly"
                        placeholder="YYYY-MM-DD"
                        fluid
                        @input="updateField(index, 'msmSttDt', ($event.target as HTMLInputElement).value || null)"
                    />
                </div>

                <!-- 측정종료일 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">측정종료일</label>
                    <InputText
                        :value="item.msmEndDt ?? ''"
                        :disabled="readonly"
                        placeholder="YYYY-MM-DD"
                        fluid
                        @input="updateField(index, 'msmEndDt', ($event.target as HTMLInputElement).value || null)"
                    />
                </div>

                <!-- 측정시점 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">측정시점</label>
                    <InputText
                        :value="item.msmTpm"
                        :disabled="readonly"
                        placeholder="예: 사업 완료 후 1년"
                        fluid
                        @input="updateField(index, 'msmTpm', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <!-- 측정주기 -->
                <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">측정주기</label>
                    <InputText
                        :value="item.msmCle"
                        :disabled="readonly"
                        placeholder="예: 연 1회"
                        fluid
                        @input="updateField(index, 'msmCle', ($event.target as HTMLInputElement).value)"
                    />
                </div>

            </div>
        </div>

        <!-- 성과지표 추가 버튼 -->
        <Button
            v-if="!readonly"
            label="성과지표 추가"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            size="small"
            @click="addPerformance"
        />

    </div>
</template>
