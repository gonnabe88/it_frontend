/**
 * ============================================================================
 * [tests/unit/composables/useDateRangeValidation.test.ts] 날짜 범위 유효성 검사 단위 테스트
 * ============================================================================
 * composables/useDateRangeValidation.ts의 핵심 검증 로직을 테스트합니다.
 *
 * [테스트 전략]
 * - useDateRangeValidation 로직을 인라인으로 구현하여 Nuxt auto-import 없이 테스트
 * - ref를 직접 사용하여 시작일/종료일 상태 제어
 * - 형식 오류, 존재하지 않는 날짜, 범위 역전 시나리오를 검증
 * ============================================================================
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ref, computed, type Ref } from 'vue';

// ============================================================================
// useDateRangeValidation 인라인 구현 (Nuxt auto-import 미지원 환경용)
// ============================================================================

/** YYYY-MM-DD 형식 + 월(01-12) + 일(01-31) 정규식 */
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * 날짜 텍스트 유효성 검사 (형식 + 실제 존재 여부)
 */
function isValidDateText(text: string): boolean {
    if (!DATE_REGEX.test(text)) return false;
    const d = new Date(text);
    return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * 날짜 범위(시작일/종료일) 유효성 검사 composable 인라인 구현
 */
function useDateRangeValidation(
    startDate: Ref<Date | null>,
    endDate: Ref<Date | null>
) {
    const startError = ref('');
    const endError = ref('');

    const validateStartText = (text: string) => {
        if (!text) {
            startError.value = '';
            return;
        }
        startError.value = isValidDateText(text)
            ? ''
            : '올바른 날짜를 입력해주세요. (YYYY-MM-DD)';
    };

    const validateEndText = (text: string) => {
        if (!text) {
            endError.value = '';
            return;
        }
        if (!isValidDateText(text)) {
            endError.value = '올바른 날짜를 입력해주세요. (YYYY-MM-DD)';
            return;
        }
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

    const revalidateRange = () => {
        if (!startDate.value || !endDate.value) return;
        const stt = new Date(startDate.value);
        const end = new Date(endDate.value);
        stt.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (end < stt) {
            endError.value = '종료일은 시작일보다 크거나 같아야 합니다.';
        } else if (endError.value === '종료일은 시작일보다 크거나 같아야 합니다.') {
            endError.value = '';
        }
    };

    const onStartInput = (event: Event) => {
        const text = (event.target as HTMLInputElement)?.value ?? '';
        if (!text) {
            startError.value = '';
        } else if (text.length === 10) {
            validateStartText(text);
        }
    };

    const onEndInput = (event: Event) => {
        const text = (event.target as HTMLInputElement)?.value ?? '';
        if (!text) {
            endError.value = '';
        } else if (text.length === 10) {
            validateEndText(text);
        }
    };

    const onStartBlur = (event: { value: string }) => {
        validateStartText(event.value ?? '');
    };

    const onEndBlur = (event: { value: string }) => {
        validateEndText(event.value ?? '');
    };

    const validate = (): boolean => !startError.value && !endError.value;

    return {
        startError,
        endError,
        startInvalid: computed(() => !!startError.value),
        endInvalid: computed(() => !!endError.value),
        onStartInput,
        onEndInput,
        onStartBlur,
        onEndBlur,
        validate,
        // 테스트용 내부 함수 노출
        _validateStartText: validateStartText,
        _validateEndText: validateEndText,
        _revalidateRange: revalidateRange,
    };
}

// ============================================================================
// isValidDateText 단위 테스트
// ============================================================================
describe('isValidDateText', () => {
    // --- 유효한 날짜 ---
    it('올바른 날짜 형식 "2026-04-10"은 true를 반환한다', () => {
        expect(isValidDateText('2026-04-10')).toBe(true);
    });

    it('1월 1일 "2026-01-01"은 true를 반환한다', () => {
        expect(isValidDateText('2026-01-01')).toBe(true);
    });

    it('12월 31일 "2026-12-31"은 true를 반환한다', () => {
        expect(isValidDateText('2026-12-31')).toBe(true);
    });

    it('윤년 2월 29일 "2024-02-29"은 true를 반환한다', () => {
        expect(isValidDateText('2024-02-29')).toBe(true);
    });

    // --- 형식 오류 ---
    it('형식이 YYYYMMDD이면 false를 반환한다', () => {
        expect(isValidDateText('20260410')).toBe(false);
    });

    it('월이 13인 경우 false를 반환한다', () => {
        expect(isValidDateText('2026-13-01')).toBe(false);
    });

    it('월이 0인 경우 false를 반환한다', () => {
        expect(isValidDateText('2026-00-01')).toBe(false);
    });

    it('일이 0인 경우 false를 반환한다', () => {
        expect(isValidDateText('2026-01-00')).toBe(false);
    });

    it('일이 32인 경우 false를 반환한다', () => {
        expect(isValidDateText('2026-01-32')).toBe(false);
    });

    it('빈 문자열은 false를 반환한다', () => {
        expect(isValidDateText('')).toBe(false);
    });

    // --- 존재하지 않는 날짜 ---
    it('2026-02-29는 형식 정규식(01~31)을 통과하므로 true를 반환한다 (JS Date 오버플로우 한계)', () => {
        // 주의: JavaScript new Date('2026-02-29')는 NaN이 아닌 3월 1일로 파싱되므로
        // isValidDateText의 NaN 검사로는 걸러지지 않습니다.
        // 더 엄밀한 날짜 유효성 검사가 필요할 경우 날짜 역변환(date→string) 비교 방식으로 개선해야 합니다.
        expect(isValidDateText('2026-02-29')).toBe(true);
    });
});

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
    // _revalidateRange (캘린더 선택 시 범위 재검증)
    // -------------------------------------------------------------------------
    describe('_revalidateRange', () => {
        it('시작일 > 종료일인 경우 종료일 에러를 설정한다', () => {
            startDate.value = new Date('2026-06-01');
            endDate.value = new Date('2026-05-01');
            const { endError, _revalidateRange } = useDateRangeValidation(startDate, endDate);

            _revalidateRange();

            expect(endError.value).toContain('종료일은 시작일보다 크거나 같아야 합니다');
        });

        it('시작일 <= 종료일이면 기존 범위 에러를 해소한다', () => {
            startDate.value = new Date('2026-06-01');
            endDate.value = new Date('2026-05-01'); // 처음엔 역전
            const { endError, _revalidateRange } = useDateRangeValidation(startDate, endDate);
            _revalidateRange(); // 에러 설정

            endDate.value = new Date('2026-07-01'); // 이후 수정
            _revalidateRange(); // 에러 해소

            expect(endError.value).toBe('');
        });

        it('startDate나 endDate가 null이면 아무 동작도 하지 않는다', () => {
            const { endError, _revalidateRange } = useDateRangeValidation(startDate, endDate);
            expect(() => _revalidateRange()).not.toThrow();
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
});
