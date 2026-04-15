<!--
================================================================================
[components/common/InlineEditCell.vue] 클릭 기반 인라인 편집 셀 컴포넌트
================================================================================
테이블 셀에서 값을 클릭하면 편집 모드로 전환되고,
Enter 키로 저장, Esc 키로 취소되는 인라인 편집 컴포넌트입니다.

[Design Ref: §6 — REQ-5 인라인 편집 개선]

[동작 로직]
  [View Mode] ← 기본 상태
    - 값 표시 (span)
    - 클릭 시 → [Edit Mode] 전환

  [Edit Mode]
    - InputText/InputNumber/Select 표시
    - 자동 포커스
    - Enter 키 → emit('save'), [View Mode]로 복귀
    - Esc 키 → emit('cancel'), 원래 값 복원, [View Mode]로 복귀
    - blur → emit('save'), [View Mode]로 복귀
================================================================================
-->
<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue';

interface Props {
    modelValue: string | number | Date | null | undefined
    type?: 'text' | 'number' | 'select' | 'date' | 'autocomplete'
    options?: { label: string; value: any }[]
    suggestions?: any[]
    optionLabel?: string
    disabled?: boolean
    suffix?: string
    invalid?: boolean
    placeholder?: string
    dateFormat?: string
    view?: 'month' | 'year' | 'date'
    showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    type: 'text',
    disabled: false,
    invalid: false,
    optionLabel: 'label',
    dateFormat: 'yy-mm',
    view: 'month',
    showSearch: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: any]
    'save': [value: any]
    'cancel': []
    'complete': [event: any]
    'item-select': [event: any]
    'search-click': []
}>();

/** 편집 모드 여부 */
const editing = ref(false);

/** 편집 중인 로컬 값 (원본 복원용) */
const localValue = ref<any>(props.modelValue);

/** 편집 시작 전 원본 값 (Esc 복원용) */
const originalValue = ref<any>(props.modelValue);

/** 컨테이너 요소 ref (외부 클릭 감지용) */
const containerRef = ref<HTMLElement | null>(null);

/** input 요소 ref (자동 포커스용) */
const inputRef = ref<HTMLElement | null>(null);

/** blur 이벤트가 select option 클릭에 의한 것인지 판단용 플래그 */
const ignoreBlur = ref(false);

/** props.modelValue 변경 시 localValue 동기화 */
watch(() => props.modelValue, (val) => {
    if (!editing.value) {
        localValue.value = val;
    }
});

/** 외부 클릭 처리기: 컴포넌트 외부 또는 PrimeVue 오버레이 외부 클릭 시 저장 */
const handleClickOutside = (event: MouseEvent) => {
    if (!editing.value) return;

    const target = event.target as HTMLElement;
    if (!target) return;

    // 1. 컴포넌트 내부(containerRef) 클릭인지 확인
    if (containerRef.value?.contains(target)) return;

    // 2. PrimeVue 오버레이(portal)内部 클릭인지 확인
    // Select, AutoComplete, DatePicker 패널 및 Dialog 등을 예외 처리
    const isOverlay = target.closest('.p-select-overlay, .p-autocomplete-panel, .p-datepicker, .p-dialog');
    if (isOverlay) return;

    // 3. 확실한 외부 클릭이면 저장 및 닫기
    save();
};

/** 편집 모드 진입/해제 시 이벤트 리스너 등록/제거 */
watch(editing, (isEditing) => {
    if (isEditing) {
        document.addEventListener('mousedown', handleClickOutside);
    } else {
        document.removeEventListener('mousedown', handleClickOutside);
    }
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
});

/** 표시 값 (View 모드에서 사용) */
const displayValue = computed(() => {
    const val = props.modelValue;
    if (val === null || val === undefined || val === '') return '-';

    if (props.type === 'select' && props.options) {
        const opt = props.options.find(o => o.value === val);
        return opt?.label ?? val;
    }

    if (props.type === 'date') {
        if (val instanceof Date) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }
        return String(val);
    }

    if (props.type === 'number' && typeof val === 'number') {
        return val.toLocaleString() + (props.suffix ? ` ${props.suffix}` : '');
    }

    return String(val) + (props.suffix ? ` ${props.suffix}` : '');
});

/** 편집 모드 시작 */
const startEdit = () => {
    if (props.disabled) return;
    editing.value = true;
    originalValue.value = props.modelValue;
    localValue.value = props.modelValue;
    nextTick(() => {
        const el = inputRef.value;
        if (el) {
            /* PrimeVue 컴포넌트의 경우 $el에서 input 요소 탐색 */
            const input = (el as any).$el?.querySelector?.('input') ?? el;
            input?.focus?.();
            /* DatePicker나 AutoComplete는 select()가 안 될 수도 있음 */
            if (input?.select) input.select();
        }
    });
};

/** 저장 후 View 모드로 복귀 */
const save = () => {
    if (ignoreBlur.value) {
        ignoreBlur.value = false;
        return;
    }
    editing.value = false;
    emit('update:modelValue', localValue.value);
    emit('save', localValue.value);
};

/** 취소 후 원본 값 복원, View 모드로 복귀 */
const cancel = () => {
    editing.value = false;
    localValue.value = originalValue.value;
    emit('update:modelValue', originalValue.value);
    emit('cancel');
};

/** Select/AutoComplete 변경 시 즉시 저장 */
const onSelectChange = (event?: any) => {
    if (props.type === 'autocomplete') {
        emit('item-select', event);
    }
    editing.value = false;
    emit('update:modelValue', localValue.value);
    emit('save', localValue.value);
};

/** 돋보기 버튼 클릭 */
const onSearchClick = () => {
    emit('search-click');
};
</script>

<template>
    <div ref="containerRef" class="inline-edit-cell" @click.stop="startEdit">
        <!-- View Mode -->
        <span v-if="!editing"
            :class="[
                'inline-block w-full px-2 py-1 rounded cursor-pointer min-h-[2rem] leading-[2rem]',
                disabled ? 'text-zinc-400 cursor-not-allowed' : 'hover:bg-surface-100 dark:hover:bg-surface-800',
                invalid ? 'ring-1 ring-red-500' : ''
            ]">
            {{ displayValue }}
        </span>

        <div v-else class="flex items-center gap-1 w-full">
            <!-- Edit Mode: text -->
            <InputText v-if="type === 'text'"
                ref="inputRef"
                v-model="localValue"
                class="w-full cursor-text"
                :placeholder="placeholder"
                @keydown.enter="save"
                @keydown.esc="cancel"
                @blur="save" />

            <!-- Edit Mode: number -->
            <InputNumber v-else-if="type === 'number'"
                ref="inputRef"
                v-model="localValue"
                class="w-full cursor-text"
                :placeholder="placeholder"
                :suffix="suffix ? ` ${suffix}` : undefined"
                @keydown.enter="save"
                @keydown.esc="cancel"
                @blur="save" />

            <!-- Edit Mode: select -->
            <Select v-else-if="type === 'select'"
                ref="inputRef"
                v-model="localValue"
                :options="options"
                optionLabel="label"
                optionValue="value"
                class="w-full cursor-pointer"
                :placeholder="placeholder"
                @change="onSelectChange" />

            <!-- Edit Mode: date -->
            <DatePicker v-else-if="type === 'date'"
                ref="inputRef"
                v-model="localValue"
                :view="view"
                :dateFormat="dateFormat"
                showIcon
                fluid
                class="w-full cursor-pointer"
                @date-select="save" />

            <!-- Edit Mode: autocomplete -->
            <AutoComplete v-else-if="type === 'autocomplete'"
                ref="inputRef"
                v-model="localValue"
                :suggestions="suggestions"
                :optionLabel="optionLabel"
                class="w-full cursor-text"
                :placeholder="placeholder"
                @complete="emit('complete', $event)"
                @item-select="onSelectChange">
                <template #option="{ option }">
                    <slot name="option" :option="option">{{ optionLabel ? option[optionLabel] : option }}</slot>
                </template>
            </AutoComplete>

            <Button v-if="showSearch" icon="pi pi-search" text size="small" class="shrink-0" @click="onSearchClick" />
        </div>
    </div>
</template>
