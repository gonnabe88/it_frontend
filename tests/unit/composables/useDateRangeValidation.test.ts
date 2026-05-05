/**
 * ============================================================================
 * [tests/unit/composables/useDateRangeValidation.test.ts] 날짜 범위 유효성 검사 단위 테스트
 * ============================================================================
 * composables/useDateRangeValidation.ts를 직접 import하여 커버리지를 측정합니다.
 *
 * [테스트 전략]
 * - useDateRangeValidation은 vue 함수만 사용하므로 Nuxt mock 없이 직접 import 가능
 * - primevue/datepicker의 DatePickerBlurEvent는 type-only import로 런타임 영향 없음
 * ============================================================================
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ref, nextTick, type Ref } from 'vue';
import { useDateRangeValidation } from '~/composables/useDateRangeValidation';


// ============================================================================
// useDateRangeValidation 통합 테스트
// ============================================================================
describe('useDateRangeValidation', () => {
    let startDate: Ref<Date | null>;
    let endDate: Ref<Date | null>;

    beforeEach(() => {
        startDate = ref(null);
        endDate = ref(null);
    });

    // -------------------------------------------------------------------------
    // 초기 상태
    // -------------------------------------------------------------------------
    describe('초기 상태', () => {
        it('초기 에러 메시지는 빈 문자열이다', () => {
            const { startError, endError } = useDateRangeValidation(startDate, endDate);
            expect(startError.value).toBe('');
            expect(endError.value).toBe('');
        });

        it('초기 invalid 플래그는 false이다', () => {
            const { startInvalid, endInvalid } = useDateRangeValidation(startDate, endDate);
            expect(startInvalid.value).toBe(false);
            expect(endInvalid.value).toBe(false);
        });

        it('에러가 없으면 validate()는 true를 반환한다', () => {
            const { validate } = useDateRangeValidation(startDate, endDate);
            expect(validate()).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // onStartBlur (시작일 포커스 아웃)
    // -------------------------------------------------------------------------
    describe('onStartBlur', () => {
        it('올바른 날짜 입력 시 에러가 없다', () => {
            const { startError, onStartBlur } = useDateRangeValidation(startDate, endDate);
            onStartBlur({ value: '2026-04-10' });
            expect(startError.value).toBe('');
        });

        it('잘못된 날짜 입력 시 에러 메시지를 설정한다', () => {
            const { startError, onStartBlur } = useDateRangeValidation(startDate, endDate);
            onStartBlur({ value: '2026-13-01' });
            expect(startError.value).toContain('올바른 날짜를 입력해주세요');
        });

        it('빈 값 입력 시 에러를 초기화한다', () => {
            const { startError, onStartBlur } = useDateRangeValidation(startDate, endDate);
            onStartBlur({ value: '잘못된값' });
            onStartBlur({ value: '' });
            expect(startError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // onEndBlur (종료일 포커스 아웃)
    // -------------------------------------------------------------------------
    describe('onEndBlur', () => {
        it('올바른 날짜 입력 시 에러가 없다', () => {
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);
            onEndBlur({ value: '2026-12-31' });
            expect(endError.value).toBe('');
        });

        it('잘못된 날짜 형식 입력 시 에러 메시지를 설정한다', () => {
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);
            // 2026-13-01: 월이 13 → DATE_REGEX 불통과 → 에러 메시지 설정
            onEndBlur({ value: '2026-13-01' });
            expect(endError.value).toContain('올바른 날짜를 입력해주세요');
        });

        it('종료일이 시작일보다 이전이면 범위 오류 메시지를 설정한다', () => {
            startDate.value = new Date('2026-06-01');
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);

            onEndBlur({ value: '2026-05-31' }); // 시작일(6/1)보다 이전

            expect(endError.value).toContain('종료일은 시작일보다 크거나 같아야 합니다');
        });

        it('종료일이 시작일과 같으면 에러가 없다 (경계값)', () => {
            startDate.value = new Date('2026-06-01');
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);

            onEndBlur({ value: '2026-06-01' }); // 시작일과 동일

            expect(endError.value).toBe('');
        });

        it('종료일이 시작일 이후면 에러가 없다', () => {
            startDate.value = new Date('2026-01-01');
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);

            onEndBlur({ value: '2026-12-31' });

            expect(endError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // onEndBlur 추가 케이스 (빈값 초기화, startDate 없을 때)
    // -------------------------------------------------------------------------
    describe('onEndBlur 추가 케이스', () => {
        it('빈 값 입력 시 에러를 초기화한다', () => {
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);
            onEndBlur({ value: '2026-13-01' });
            onEndBlur({ value: '' });
            expect(endError.value).toBe('');
        });

        it('startDate가 없으면 범위 검사를 건너뛴다', () => {
            const { endError, onEndBlur } = useDateRangeValidation(startDate, endDate);
            onEndBlur({ value: '2026-06-01' });
            expect(endError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // onStartInput (10자리 완성 시 검증)
    // -------------------------------------------------------------------------
    describe('onStartInput', () => {
        it('10자리 미만 입력 시 검증을 수행하지 않는다', () => {
            const { startError, onStartInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-04' } } as any;

            onStartInput(event);

            expect(startError.value).toBe('');
        });

        it('10자리 완성 시 형식 검사를 수행한다', () => {
            const { startError, onStartInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-13-01' } } as any; // 잘못된 날짜

            onStartInput(event);

            expect(startError.value).toContain('올바른 날짜를 입력해주세요');
        });

        it('빈 값 입력 시 에러를 초기화한다', () => {
            const { startError, onStartInput } = useDateRangeValidation(startDate, endDate);
            startError.value = '기존 에러';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '' } } as any;

            onStartInput(event);

            expect(startError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // onEndInput (10자리 완성 시 검증)
    // -------------------------------------------------------------------------
    describe('onEndInput', () => {
        it('10자리 미만 입력 시 검증을 수행하지 않는다', () => {
            const { endError, onEndInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-04' } } as any;
            onEndInput(event);
            expect(endError.value).toBe('');
        });

        it('10자리 완성 + 형식 오류이면 에러를 설정한다', () => {
            const { endError, onEndInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-13-01' } } as any;
            onEndInput(event);
            expect(endError.value).toContain('올바른 날짜를 입력해주세요');
        });

        it('종료일 10자리 완성 + 시작일보다 이전이면 범위 에러를 설정한다', () => {
            startDate.value = new Date('2026-06-01');
            const { endError, onEndInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-05-31' } } as any;
            onEndInput(event);
            expect(endError.value).toContain('종료일은 시작일보다 크거나 같아야 합니다');
        });

        it('빈 값 입력 시 에러를 초기화한다', () => {
            const { endError, onEndInput } = useDateRangeValidation(startDate, endDate);
            endError.value = '기존 에러';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '' } } as any;
            onEndInput(event);
            expect(endError.value).toBe('');
        });

        it('10자리 완성 + 유효한 날짜 + startDate 없으면 에러가 없다', () => {
            const { endError, onEndInput } = useDateRangeValidation(startDate, endDate);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = { target: { value: '2026-06-01' } } as any;
            onEndInput(event);
            expect(endError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // validate (저장 전 전체 검증)
    // -------------------------------------------------------------------------
    describe('validate', () => {
        it('에러가 있으면 false를 반환한다', () => {
            const { startError, validate } = useDateRangeValidation(startDate, endDate);
            startError.value = '에러 있음';

            expect(validate()).toBe(false);
        });

        it('에러가 없으면 true를 반환한다', () => {
            const { validate } = useDateRangeValidation(startDate, endDate);
            expect(validate()).toBe(true);
        });

        it('startError와 endError 둘 다 없어야 true를 반환한다', () => {
            const { startError, endError, validate } = useDateRangeValidation(startDate, endDate);
            startError.value = '';
            endError.value = '종료일 에러';

            expect(validate()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // startInvalid / endInvalid computed
    // -------------------------------------------------------------------------
    describe('startInvalid / endInvalid', () => {
        it('에러가 있으면 invalid는 true이다', () => {
            const { startError, startInvalid } = useDateRangeValidation(startDate, endDate);
            startError.value = '에러';
            expect(startInvalid.value).toBe(true);
        });

        it('에러가 없으면 invalid는 false이다', () => {
            const { startError, startInvalid } = useDateRangeValidation(startDate, endDate);
            startError.value = '';
            expect(startInvalid.value).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // watch: startDate 변경 시 재검증 (lines 122-129)
    // -------------------------------------------------------------------------
    describe('watch(startDate) 반응형 재검증', () => {
        it('startDate 변경 시 startError가 초기화된다', async () => {
            const { startError, onStartBlur } = useDateRangeValidation(startDate, endDate);
            onStartBlur({ value: '2026-13-01' }); // 오류 유발
            expect(startError.value).not.toBe('');
            startDate.value = new Date('2026-04-01');
            await nextTick();
            expect(startError.value).toBe('');
        });

        it('startDate 변경 후 endDate가 이전이면 범위 오류가 설정된다', async () => {
            endDate.value = new Date('2026-03-01');
            const { endError } = useDateRangeValidation(startDate, endDate);
            startDate.value = new Date('2026-04-01');
            await nextTick();
            expect(endError.value).toContain('종료일은 시작일보다 크거나 같아야 합니다');
        });

        it('startDate 변경 후 endDate가 이후이면 기존 범위 오류가 해소된다', async () => {
            startDate.value = new Date('2026-01-01');
            endDate.value = new Date('2026-03-01');
            const { endError } = useDateRangeValidation(startDate, endDate);
            endError.value = '종료일은 시작일보다 크거나 같아야 합니다.';
            startDate.value = new Date('2026-02-01');
            await nextTick();
            expect(endError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // watch: endDate 변경 시 재검증 (lines 131-136)
    // -------------------------------------------------------------------------
    describe('watch(endDate) 반응형 재검증', () => {
        it('endDate 변경 시 범위 재검증이 수행된다', async () => {
            startDate.value = new Date('2026-06-01');
            const { endError } = useDateRangeValidation(startDate, endDate);
            endDate.value = new Date('2026-05-01');
            await nextTick();
            expect(endError.value).toContain('종료일은 시작일보다 크거나 같아야 합니다');
        });

        it('endDate가 startDate 이후로 변경되면 에러가 없다', async () => {
            startDate.value = new Date('2026-01-01');
            const { endError } = useDateRangeValidation(startDate, endDate);
            endDate.value = new Date('2026-12-31');
            await nextTick();
            expect(endError.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // revalidateRange: 에러 해소 케이스 (line 112-114)
    // -------------------------------------------------------------------------
    describe('revalidateRange 범위 오류 해소', () => {
        it('범위 오류가 있을 때 startDate가 endDate 이전으로 변경되면 해소된다', async () => {
            startDate.value = new Date('2026-06-01');
            endDate.value = new Date('2026-12-31');
            const { endError } = useDateRangeValidation(startDate, endDate);
            // 수동으로 범위 오류 설정 (동일 에러 메시지)
            endError.value = '종료일은 시작일보다 크거나 같아야 합니다.';
            // startDate를 endDate 이전으로 변경 → 범위 오류 해소되어야 함
            startDate.value = new Date('2026-01-01');
            await nextTick();
            expect(endError.value).toBe('');
        });
    });
});
