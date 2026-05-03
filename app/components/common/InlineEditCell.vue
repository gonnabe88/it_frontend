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
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue';

interface Props {
    modelValue: string | number | Date | null | undefined
    type?: 'text' | 'number' | 'select' | 'date' | 'autocomplete'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: { label: string; value: any }[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suggestions?: any[]
    optionLabel?: string
    disabled?: boolean
    /** 읽기 전용: 클릭해도 편집 모드로 진입하지 않음 (hover 효과 없음) */
    readonly?: boolean
    suffix?: string
    invalid?: boolean
    placeholder?: string
    dateFormat?: string
    view?: 'month' | 'year' | 'date'
    showSearch?: boolean
    /** 행 전체 편집 모드: true이면 조회 스팬 없이 입력 폼을 바로 표시 */
    forceEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    type: 'text',
    disabled: false,
    readonly: false,
    invalid: false,
    optionLabel: 'label',
    dateFormat: 'yy-mm',
    view: 'month',
    showSearch: false,
    options: undefined,
    suggestions: undefined,
    suffix: undefined,
    placeholder: undefined,
});

const emit = defineEmits<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'update:modelValue': [value: any]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'save': [value: any]
    'cancel': []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'complete': [event: any]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'item-select': [event: any]
    'search-click': []
}>();

/**
 * 편집 모드 여부
 * - forceEdit=true로 마운트되면 처음부터 편집 폼이 렌더링되도록 초기값을 동기화
 *   (watch는 값 변경 시에만 발화하므로, 초기 상태는 여기서 직접 지정)
 */
const editing = ref(props.forceEdit === true);

/** 편집 중인 로컬 값 (원본 복원용) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localValue = ref<any>(props.modelValue);

/** 편집 시작 전 원본 값 (Esc 복원용) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalValue = ref<any>(props.modelValue);

/** 컨테이너 요소 ref (외부 클릭 감지용) */
const containerRef = ref<HTMLElement | null>(null);

/** input 요소 ref (자동 포커스용) */
const inputRef = ref<HTMLElement | null>(null);

/** blur 이벤트가 select option 클릭에 의한 것인지 판단용 플래그 */
const ignoreBlur = ref(false);

/** props.modelValue 변경 시 localValue 동기화
 *  - 일반 모드: 편집 중이 아닐 때만 동기화 (편집 중에는 사용자 입력 보존)
 *  - forceEdit 모드: 항상 동기화. 편집 중이더라도 부모에서 modelValue를 강제로 초기화한 경우
 *    (예: 담당자 미선택 시 cgprNm을 ''로 초기화) 입력 UI에 즉시 반영되어야 함. */
watch(() => props.modelValue, (val) => {
    if (!editing.value || props.forceEdit) {
        localValue.value = val;
    }
});

/** 외부 클릭 처리기: 컴포넌트 외부 또는 PrimeVue 오버레이 외부 클릭 시 저장 */
const handleClickOutside = (event: MouseEvent) => {
    if (!editing.value) return;

    // DatePicker 패널은 PrimeVue v4에서 <Teleport>로 body에 렌더링되어
    // DOM 계층 기반의 closest() 검사가 신뢰할 수 없으므로 @hide 이벤트로 처리
    if (props.type === 'date') return;

    // InputNumber는 v-model을 blur 시점에만 커밋하므로 mousedown에서 읽으면 이전 값이 남아있음.
    // @blur의 nextTick(save)에서 정확한 값으로 저장하도록 여기서는 건너뜀.
    if (props.type === 'number') return;

    const target = event.target as HTMLElement;
    if (!target) return;

    // 1. 컴포넌트 내부(containerRef) 클릭인지 확인
    if (containerRef.value?.contains(target)) return;

    // 2. forceEdit 모드: 행 전체 편집 중이므로 값만 emit하고 편집 상태 유지
    //    (셀 간 이동 시 현재 값 보존, 편집 종료는 저장 버튼으로 제어)
    //    단, 값이 실제로 변경되지 않은 경우에는 save 이벤트를 emit하지 않는다 —
    //    forceEdit 모드에서는 모든 행의 모든 InlineEditCell이 document click을 수신하므로
    //    무조건 save를 emit하면 한 셀 클릭만으로 전체 행이 modified로 잘못 마킹된다.
    if (props.forceEdit) {
        if (localValue.value !== originalValue.value) {
            emit('update:modelValue', localValue.value);
            emit('save', localValue.value);
        }
        return;
    }

    // 3. PrimeVue 오버레이(portal)内部 클릭인지 확인
    // Select, AutoComplete 패널 및 Dialog 등을 예외 처리
    // PrimeVue v4: AutoComplete 패널 클래스는 .p-autocomplete-overlay (v3: .p-autocomplete-panel)
    const isOverlay = target.closest(
        '.p-select-overlay, .p-autocomplete-overlay, .p-autocomplete-panel, .p-dialog'
    );
    if (isOverlay) return;

    // 4. 확실한 외부 클릭이면 저장 및 닫기
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

/**
 * 마운트 시점에 이미 편집 모드라면 클릭-외부 감지 리스너도 함께 등록
 * (forceEdit=true로 초기 렌더되는 케이스. watch(editing)은 값 변경 시에만 발화하므로 초기 상태는 여기서 처리)
 */
onMounted(() => {
    if (editing.value) {
        document.addEventListener('mousedown', handleClickOutside);
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
    if (props.disabled || props.readonly) return;
    editing.value = true;
    originalValue.value = props.modelValue;
    localValue.value = props.modelValue;
    nextTick(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = inputRef.value as any;
        if (!el) return;

        // 1. PrimeVue 컴포넌트가 defineExpose로 노출한 focus() 우선 사용
        //    (InputText, InputNumber, Select, AutoComplete, DatePicker 모두 지원)
        if (typeof el.focus === 'function') {
            el.focus();
        } else {
            // 2. Fallback: $el 자체가 <input>이거나, 내부에서 input 탐색
            const elDom = el.$el;
            if (!elDom) return;
            const input = elDom.tagName?.toLowerCase() === 'input'
                ? elDom
                : elDom.querySelector('input');
            input?.focus?.();
        }

        // 3. text/number 타입은 포커스 후 전체 텍스트 선택 (편집 편의성)
        if (props.type === 'text' || props.type === 'number') {
            nextTick(() => {
                const elDom = el.$el;
                const input = elDom?.tagName?.toLowerCase() === 'input'
                    ? elDom
                    : elDom?.querySelector?.('input');
                input?.select?.();
            });
        }
    });
};

/** 저장 후 View 모드로 복귀 (forceEdit 모드에서는 편집 상태 유지)
 *  forceEdit 모드에서는 값이 실제로 변경된 경우에만 save emit (모든 행이 dirty로 마킹되는 문제 방지).
 *  일반 모드에서는 기존 동작 유지 — 편집 종료 후 항상 save emit. */
const save = () => {
    if (ignoreBlur.value) {
        ignoreBlur.value = false;
        return;
    }
    if (props.forceEdit) {
        // 편집 상태를 유지하고, 값이 바뀐 경우에만 emit
        if (localValue.value !== originalValue.value) {
            emit('update:modelValue', localValue.value);
            emit('save', localValue.value);
        }
        return;
    }
    editing.value = false;
    emit('update:modelValue', localValue.value);
    emit('save', localValue.value);
};

/** 취소 후 원본 값 복원, View 모드로 복귀 */
const cancel = () => {
    if (!props.forceEdit) {
        editing.value = false;
    }
    localValue.value = originalValue.value;
    emit('update:modelValue', originalValue.value);
    emit('cancel');
};

/** Select/AutoComplete 변경 시 즉시 저장 (forceEdit 모드에서는 편집 상태 유지) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onSelectChange = (event?: any) => {
    if (props.type === 'autocomplete') {
        // 1. 부모의 @item-select 핸들러 호출
        //    (onEmployeeSelect 등이 data.cgprNm을 문자열로 직접 설정하고 saveRow 호출)
        emit('item-select', event);

        // 2. props.modelValue는 Vue의 비동기 렌더링 사이클 후에 갱신되므로
        //    nextTick 이후 props.modelValue(올바른 문자열)를 localValue에 반영하고
        //    편집 모드 종료 — 이 시점에는 '박종훈'이 담겨있어 올바르게 표시됨
        nextTick(() => {
            localValue.value = props.modelValue;
            if (!props.forceEdit) {
                editing.value = false;
            }
        });

        // emit('update:modelValue'), emit('save') 생략:
        //   @item-select 핸들러(onEmployeeSelect 등)가 이미 올바른 값 설정 및 저장 처리함
        return;
    }

    if (!props.forceEdit) {
        editing.value = false;
    }
    emit('update:modelValue', localValue.value);
    emit('save', localValue.value);
};

/** forceEdit 변경 감지: true → 편집 모드 진입(포커스 없음), false → 값 저장 후 종료 */
watch(() => props.forceEdit, (force) => {
    if (force && !editing.value) {
        editing.value = true;
        originalValue.value = props.modelValue;
        localValue.value = props.modelValue;
    } else if (!force && editing.value) {
        editing.value = false;
        emit('update:modelValue', localValue.value);
        emit('save', localValue.value);
    }
});

/** 돋보기 버튼 클릭 */
const onSearchClick = () => {
    emit('search-click');
};
</script>

<template>
    <div
        ref="containerRef"
        :class="['inline-edit-cell w-full overflow-hidden', invalid && editing ? 'is-invalid' : '']"
        @click.stop="startEdit">

        <!-- View Mode -->
        <span
v-if="!editing" :class="[
            'inline-block w-full px-2 py-1 rounded min-h-[2rem] leading-[2rem]',
            readonly ? 'cursor-default' : (disabled ? 'text-zinc-400 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800'),
            invalid ? 'text-red-500' : ''
        ]">
            {{ displayValue }}
        </span>

        <!-- Edit Mode: invalid 표시는 PrimeVue 입력 컴포넌트의 :invalid prop으로 처리합니다.
             외곽 div에 ring을 걸면 셀의 overflow:hidden에 의해 좌/우/상/하 변이 잘리고 모서리만
             남는 시각 이상 현상이 발생하므로, 입력 요소 자체에만 invalid 스타일을 적용합니다. -->
        <div v-else class="flex items-center gap-1 w-full">
            <!-- Edit Mode: text -->
            <InputText
v-if="type === 'text'" ref="inputRef" v-model="localValue" :invalid="invalid"
                class="w-full cursor-text" :placeholder="placeholder" @keydown.enter="save" @keydown.esc="cancel"
                @blur="save" />

            <!-- Edit Mode: number
                 @blur: PrimeVue InputNumber는 blur 이벤트 emit 후 updateModel을 동기 호출하므로
                 nextTick 이후에 save()를 실행해야 localValue가 최신 값으로 반영됨. -->
            <InputNumber
v-else-if="type === 'number'" ref="inputRef" v-model="localValue" :invalid="invalid"
                class="w-full cursor-text" :placeholder="placeholder" :suffix="suffix ? ` ${suffix}` : undefined"
                @keydown.enter="save" @keydown.esc="cancel" @blur="() => nextTick(save)" />

            <!-- Edit Mode: select -->
            <Select
v-else-if="type === 'select'" ref="inputRef" v-model="localValue" :invalid="invalid"
                :options="options" option-label="label" option-value="value" class="w-full cursor-pointer"
                :placeholder="placeholder" @change="onSelectChange" />

            <!-- Edit Mode: date
                 input+아이콘 버튼(form)은 fluid+w-full로 컬럼 너비 안에 제한됨.
                 달력 드롭다운 패널은 PrimeVue가 자동으로 teleport하여 컬럼 밖에 full-size로 표시됨.
                 @hide: 패널이 닫힐 때(날짜 선택 or 외부 클릭) 저장 처리 -->
            <DatePicker
v-else-if="type === 'date'" ref="inputRef" v-model="localValue" :invalid="invalid" :view="view"
                :date-format="dateFormat" show-icon fluid class="w-full cursor-pointer" @hide="save" />

            <!-- Edit Mode: autocomplete -->
            <AutoComplete
v-else-if="type === 'autocomplete'" ref="inputRef" v-model="localValue" :invalid="invalid"
                :suggestions="suggestions" :option-label="optionLabel" class="w-full min-w-0 cursor-text"
                :placeholder="placeholder" @complete="emit('complete', $event)" @item-select="onSelectChange">
                <template #option="{ option }">
                    <slot name="option" :option="option">{{ optionLabel ? option[optionLabel] : option }}</slot>
                </template>
            </AutoComplete>

            <Button v-if="showSearch" icon="pi pi-search" text size="small" class="shrink-0" @click="onSearchClick" />
        </div>
    </div>
</template>

<style scoped>
/*
 * DatePicker (showIcon) form 너비 제한
 *
 * 구조: [outer flex div] > [.p-datepicker(flex item)] > [input + button]
 *
 * 문제: flex item의 min-width 기본값이 'auto'이므로
 *       content 크기(input 기본 너비)보다 작게 줄어들지 않아 컬럼을 밀어냄.
 *
 * 해결:
 *  1. .p-datepicker → min-width:0 (flex item 수축 허용) + display:flex 명시
 *  2. .p-datepicker-input → flex:1 1 0%; min-width:0 (남는 공간만 차지)
 *  3. .p-datepicker-button → flex-shrink:0 (아이콘 버튼 크기 유지)
 *
 * 달력 드롭다운 패널은 PrimeVue가 body로 teleport하므로 영향 없음.
 */
:deep(.p-datepicker) {
    display: flex !important;
    min-width: 0 !important;
    overflow: hidden;
}

:deep(.p-datepicker-input) {
    flex: 1 1 0% !important;
    min-width: 0 !important;
    width: 0 !important;
}

:deep(.p-datepicker-button) {
    flex-shrink: 0 !important;
}

/*
 * 달력 드롭다운 패널 너비: PrimeVue가 body로 teleport하므로 :global 사용
 * - input form과 완전히 독립적으로 크기 지정 가능
 * - scoped :deep()로는 접근 불가 (DOM 트리 밖)
 */
:global(.p-datepicker-panel) {
    min-width: 280px !important;
}

/* AutoComplete form 너비 제한 */
:deep(.p-autocomplete) {
    min-width: 0;
    overflow: hidden;
}

:deep(.p-autocomplete-input) {
    min-width: 0 !important;
    width: 100% !important;
}

/* invalid 상태 강조: 테두리 대신 내부 텍스트만 붉은색으로 표시.
   - 편집 모드(.is-invalid) 하위의 모든 입력 컴포넌트 내부 텍스트 색상을 red-500으로 변경
   - PrimeVue 내부 구조를 건드리지 않기 위해 color만 상속/강제 지정 */
.inline-edit-cell.is-invalid,
.inline-edit-cell.is-invalid input,
.inline-edit-cell.is-invalid textarea,
.inline-edit-cell.is-invalid .p-inputtext,
.inline-edit-cell.is-invalid .p-select-label,
.inline-edit-cell.is-invalid .p-autocomplete-input {
    color: rgb(239 68 68) !important; /* red-500 */
}
</style>
