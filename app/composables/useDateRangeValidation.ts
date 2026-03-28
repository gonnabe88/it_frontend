/**
 * ============================================================================
 * [composables/useDateRangeValidation.ts] 날짜 범위 유효성 검사 composable
 * ============================================================================
 * PrimeVue DatePicker와 함께 사용하는 재사용 가능한 날짜 유효성 검사입니다.
 *
 * [검사 항목]
 *  1. 날짜 형식 (YYYY-MM-DD): 잘못된 형식이나 존재하지 않는 날짜 감지
 *  2. 날짜 범위: 종료일이 시작일보다 이전인 경우 감지
 *
 * [사용 방법]
 *  const {
 *    startError, endError,
 *    startInvalid, endInvalid,
 *    onStartInput, onEndInput,
 *    onStartBlur, onEndBlur,
 *    validate
 *  } = useDateRangeValidation(startDateRef, endDateRef);
 *
 *  // 템플릿에서:
 *  // <DatePicker :invalid="startInvalid" @input="onStartInput" @blur="onStartBlur" />
 *  // <small v-if="startError" class="text-red-500 text-xs">{{ startError }}</small>
 *
 * [재사용 예시]
 *  - info/projects/form.vue (사업 시작일/종료일)
 *  - info/cost/form.vue (전산업무비 기간)
 *  - 기타 시작일/종료일 입력이 있는 모든 폼
 * ============================================================================
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { DatePickerBlurEvent } from 'primevue/datepicker';

/** YYYY-MM-DD 형식 + 월(01-12) + 일(01-31) 정규식 */
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * 날짜 텍스트 유효성 검사 (형식 + 실제 존재 여부)
 * @param text - 'YYYY-MM-DD' 형식 문자열
 * @returns 유효하면 true
 */
function isValidDateText(text: string): boolean {
    if (!DATE_REGEX.test(text)) return false;
    // 2월 31일 같이 형식은 맞지만 존재하지 않는 날짜 방지
    const d = new Date(text);
    return d instanceof Date && !isNaN(d.getTime());
}

/**
 * 날짜 범위(시작일/종료일) 유효성 검사 composable
 *
 * @param startDate - 시작일 Ref (DatePicker v-model)
 * @param endDate   - 종료일 Ref (DatePicker v-model)
 * @returns 에러 상태, invalid 플래그, 이벤트 핸들러, 전체 검증 함수
 */
export function useDateRangeValidation(
    startDate: Ref<Date | null> | ComputedRef<Date | null>,
    endDate: Ref<Date | null> | ComputedRef<Date | null>
) {
    const startError = ref('');
    const endError = ref('');

    // ─────────────────────────────────────────────────────────────────
    // 내부 검증 함수
    // ─────────────────────────────────────────────────────────────────

    /** 시작일 텍스트 형식 검증 */
    const validateStartText = (text: string) => {
        if (!text) {
            startError.value = '';
            return;
        }
        startError.value = isValidDateText(text)
            ? ''
            : '올바른 날짜를 입력해주세요. (YYYY-MM-DD)';
    };

    /**
     * 종료일 텍스트 형식 + 범위 검증
     * 형식이 유효한 경우에만 범위 검사를 수행합니다.
     */
    const validateEndText = (text: string) => {
        if (!text) {
            endError.value = '';
            return;
        }
        if (!isValidDateText(text)) {
            endError.value = '올바른 날짜를 입력해주세요. (YYYY-MM-DD)';
            return;
        }
        // 형식이 유효하면 범위 검사
        // endDate.value는 @input 시점에 아직 갱신 전일 수 있으므로 text로 직접 Date 생성
        if (startDate.value) {
            const stt = new Date(startDate.value);
            const end = new Date(text);
            stt.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            endError.value = end < stt ? '종료일은 시작일보다 크거나 같아야 합니다.' : '';
        } else {
            endError.value = '';
        }
    };

    /** 캘린더 선택 시 종료일 범위만 재검증 (텍스트 없이) */
    const revalidateRange = () => {
        if (!startDate.value || !endDate.value) return;
        const stt = new Date(startDate.value);
        const end = new Date(endDate.value);
        stt.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (end < stt) {
            endError.value = '종료일은 시작일보다 크거나 같아야 합니다.';
        } else {
            // 기존에 범위 에러가 있었으면 해소
            if (endError.value === '종료일은 시작일보다 크거나 같아야 합니다.') {
                endError.value = '';
            }
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // 캘린더로 날짜 선택 시 자동 재검증 (watch)
    // ─────────────────────────────────────────────────────────────────

    watch(startDate, (val) => {
        if (val) {
            // 유효한 날짜가 선택되면 시작일 에러 해소
            startError.value = '';
            // 종료일이 있으면 범위 재검증
            revalidateRange();
        }
    });

    watch(endDate, (val) => {
        if (val) {
            // 유효한 날짜가 선택되면 즉시 범위 검사
            revalidateRange();
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // 이벤트 핸들러 (템플릿에서 @input, @blur에 바인딩)
    // ─────────────────────────────────────────────────────────────────

    /**
     * 시작일 @input 핸들러
     * 10자리(YYYY-MM-DD)가 완성된 경우에만 형식을 검사합니다.
     * 기존 autoFormatDateInput과 체이닝하여 사용합니다.
     */
    const onStartInput = (event: Event) => {
        const text = (event.target as HTMLInputElement)?.value ?? '';
        if (!text) {
            startError.value = '';
        } else if (text.length === 10) {
            validateStartText(text);
        }
    };

    /**
     * 종료일 @input 핸들러
     * 10자리(YYYY-MM-DD)가 완성된 경우에만 형식 + 범위를 검사합니다.
     */
    const onEndInput = (event: Event) => {
        const text = (event.target as HTMLInputElement)?.value ?? '';
        if (!text) {
            endError.value = '';
        } else if (text.length === 10) {
            validateEndText(text);
        }
    };

    /**
     * 시작일 @blur 핸들러 (PrimeVue DatePickerBlurEvent)
     * 포커스가 벗어날 때 불완전한 입력도 검사합니다.
     */
    const onStartBlur = (event: DatePickerBlurEvent) => {
        validateStartText(event.value ?? '');
    };

    /**
     * 종료일 @blur 핸들러 (PrimeVue DatePickerBlurEvent)
     * 포커스가 벗어날 때 불완전한 입력도 검사합니다.
     */
    const onEndBlur = (event: DatePickerBlurEvent) => {
        validateEndText(event.value ?? '');
    };

    // ─────────────────────────────────────────────────────────────────
    // 저장 전 전체 검증
    // ─────────────────────────────────────────────────────────────────

    /**
     * 전체 유효성 검사 (저장 버튼 클릭 시 호출)
     * 에러가 없으면 true, 있으면 false 반환
     */
    const validate = (): boolean => !startError.value && !endError.value;

    return {
        /** 시작일 에러 메시지 (빈 문자열이면 에러 없음) */
        startError,
        /** 종료일 에러 메시지 (빈 문자열이면 에러 없음) */
        endError,
        /** 시작일 invalid 플래그 (DatePicker :invalid 바인딩용) */
        startInvalid: computed(() => !!startError.value),
        /** 종료일 invalid 플래그 (DatePicker :invalid 바인딩용) */
        endInvalid: computed(() => !!endError.value),
        /** 시작일 @input 핸들러 */
        onStartInput,
        /** 종료일 @input 핸들러 */
        onEndInput,
        /** 시작일 @blur 핸들러 (PrimeVue DatePickerBlurEvent) */
        onStartBlur,
        /** 종료일 @blur 핸들러 (PrimeVue DatePickerBlurEvent) */
        onEndBlur,
        /** 저장 전 전체 검증. false이면 저장 중단 */
        validate,
    };
}
