/**
 * ============================================================================
 * [tests/unit/composables/useCodeOptions.test.ts] 공통코드 옵션 Composable 테스트
 * ============================================================================
 * composables/useCodeOptions.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useCodeOptions } from '~/composables/useCodeOptions';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));
vi.stubGlobal('computed', computed);

const mockCodeData = ref<{ cdId: string; cdNm: string; cdSqn?: number | null }[] | null>(null);
const mockUseApiFetch = vi.fn().mockImplementation(() => ({ data: mockCodeData }));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useCodeOptions', () => {
    beforeEach(() => {
        mockCodeData.value = null;
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({ data: mockCodeData }));
    });

    describe('options', () => {
        it('데이터가 없으면(null) 빈 배열을 반환한다', () => {
            mockCodeData.value = null;
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value).toEqual([]);
        });

        it('빈 배열 데이터는 빈 배열을 반환한다', () => {
            mockCodeData.value = [];
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value).toEqual([]);
        });

        it('cdSqn 오름차순으로 정렬하여 반환한다', () => {
            mockCodeData.value = [
                { cdId: 'PRJ_TP_003', cdNm: '기타', cdSqn: 3 },
                { cdId: 'PRJ_TP_001', cdNm: '신규개발', cdSqn: 1 },
                { cdId: 'PRJ_TP_002', cdNm: '유지보수', cdSqn: 2 },
            ];
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value[0]!.cdNm).toBe('신규개발');
            expect(options.value[1]!.cdNm).toBe('유지보수');
            expect(options.value[2]!.cdNm).toBe('기타');
        });

        it('cdSqn이 null인 항목은 마지막으로 정렬된다 (Infinity 처리)', () => {
            mockCodeData.value = [
                { cdId: 'PRJ_TP_NULL', cdNm: '순서없음', cdSqn: null },
                { cdId: 'PRJ_TP_001', cdNm: '신규개발', cdSqn: 1 },
            ];
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value[0]!.cdNm).toBe('신규개발');
            expect(options.value[1]!.cdNm).toBe('순서없음');
        });
    });

    describe('getCodeName', () => {
        beforeEach(() => {
            mockCodeData.value = [
                { cdId: 'PRJ_TP_001', cdNm: '신규개발', cdSqn: 1 },
                { cdId: 'PRJ_TP_002', cdNm: '유지보수', cdSqn: 2 },
            ];
        });

        it('매칭되는 코드ID가 있으면 코드명을 반환한다', () => {
            const { getCodeName } = useCodeOptions('PRJ_TP');
            expect(getCodeName('PRJ_TP_001')).toBe('신규개발');
        });

        it('매칭되는 코드ID가 없으면 원본 값을 그대로 반환한다', () => {
            const { getCodeName } = useCodeOptions('PRJ_TP');
            expect(getCodeName('UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
        });

        it('null을 받으면 "-"를 반환한다', () => {
            const { getCodeName } = useCodeOptions('PRJ_TP');
            expect(getCodeName(null)).toBe('-');
        });

        it('undefined를 받으면 "-"를 반환한다', () => {
            const { getCodeName } = useCodeOptions('PRJ_TP');
            expect(getCodeName(undefined)).toBe('-');
        });

        it('빈 문자열을 받으면 "-"를 반환한다', () => {
            const { getCodeName } = useCodeOptions('PRJ_TP');
            expect(getCodeName('')).toBe('-');
        });
    });

    it('올바른 URL로 useApiFetch를 호출한다', () => {
        useCodeOptions('PRJ_TP');
        expect(mockUseApiFetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/ccodem/type/PRJ_TP'
        );
    });
});
