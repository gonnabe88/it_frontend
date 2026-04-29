/**
 * ============================================================================
 * [tests/unit/composables/useCouncilCodes.test.ts] 협의회 코드 Composable 단위 테스트
 * ============================================================================
 * composables/useCouncilCodes.ts를 직접 import하여 커버리지를 측정합니다.
 *
 * [Mock 전략]
 * - useRuntimeConfig: vi.stubGlobal으로 API base URL 제공
 * - useApiFetch: vi.stubGlobal으로 코드 데이터 제공
 * - computed: Vue에서 직접 import (Nuxt auto-import 대체)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useCouncilCodes } from '~/composables/useCouncilCodes';

// ============================================================================
// Nuxt 전역 API Mock 설정
// ============================================================================

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

vi.stubGlobal('computed', computed);

// 코드 목업 데이터
const mockStatusData = ref([
    { cdId: 'ASCT_STS', cdNm: '작성 중', cdva: 'DRAFT', cttTp: 'S' },
    { cdId: 'ASCT_STS', cdNm: '작성 완료', cdva: 'SUBMITTED', cttTp: 'S' },
    { cdId: 'ASCT_STS', cdNm: '완료', cdva: 'COMPLETED', cttTp: 'S' },
]);
const mockHearingData = ref([
    { cdId: 'DBR_TP', cdNm: '정보시스템 사업 타당성 검토', cdva: 'INFO_SYS', cttTp: 'D' },
    { cdId: 'DBR_TP', cdNm: '정보보호 심의', cdva: 'INFO_SEC', cttTp: 'D' },
]);
const mockMemberTypeData = ref([
    { cdId: 'VLR_TP', cdNm: '당연위원', cdva: 'MAND', cttTp: 'M' },
    { cdId: 'VLR_TP', cdNm: '소집위원', cdva: 'CALL', cttTp: 'M' },
]);

// useApiFetch Mock: URL에 따라 적절한 데이터 반환
const mockUseApiFetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('ASCT_STS')) return { data: mockStatusData };
    if (url.includes('DBR_TP'))   return { data: mockHearingData };
    if (url.includes('VLR_TP'))   return { data: mockMemberTypeData };
    return { data: ref([]) };
});
vi.stubGlobal('useApiFetch', mockUseApiFetch);

// ============================================================================
// 테스트
// ============================================================================
describe('useCouncilCodes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 각 테스트마다 Mock을 재등록 (clearAllMocks 이후)
        mockUseApiFetch.mockImplementation((url: string) => {
            if (url.includes('ASCT_STS')) return { data: mockStatusData };
            if (url.includes('DBR_TP'))   return { data: mockHearingData };
            if (url.includes('VLR_TP'))   return { data: mockMemberTypeData };
            return { data: ref([]) };
        });
    });

    describe('getStatusLabel', () => {
        it('DRAFT 코드를 한글명으로 변환한다', () => {
            const { getStatusLabel } = useCouncilCodes();
            expect(getStatusLabel('DRAFT')).toBe('작성 중');
        });

        it('COMPLETED 코드를 한글명으로 변환한다', () => {
            const { getStatusLabel } = useCouncilCodes();
            expect(getStatusLabel('COMPLETED')).toBe('완료');
        });

        it('null을 받으면 "-"를 반환한다', () => {
            const { getStatusLabel } = useCouncilCodes();
            expect(getStatusLabel(null)).toBe('-');
        });

        it('undefined를 받으면 "-"를 반환한다', () => {
            const { getStatusLabel } = useCouncilCodes();
            expect(getStatusLabel(undefined)).toBe('-');
        });

        it('알 수 없는 코드는 코드값을 그대로 반환한다', () => {
            const { getStatusLabel } = useCouncilCodes();
            expect(getStatusLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
        });
    });

    describe('getHearingTypeLabel', () => {
        it('INFO_SYS 코드를 한글명으로 변환한다', () => {
            const { getHearingTypeLabel } = useCouncilCodes();
            expect(getHearingTypeLabel('INFO_SYS')).toBe('정보시스템 사업 타당성 검토');
        });

        it('INFO_SEC 코드를 한글명으로 변환한다', () => {
            const { getHearingTypeLabel } = useCouncilCodes();
            expect(getHearingTypeLabel('INFO_SEC')).toBe('정보보호 심의');
        });

        it('null을 받으면 "-"를 반환한다', () => {
            const { getHearingTypeLabel } = useCouncilCodes();
            expect(getHearingTypeLabel(null)).toBe('-');
        });

        it('알 수 없는 코드는 코드값을 그대로 반환한다', () => {
            const { getHearingTypeLabel } = useCouncilCodes();
            expect(getHearingTypeLabel('UNKNOWN')).toBe('UNKNOWN');
        });
    });

    describe('getMemberTypeLabel', () => {
        it('MAND 코드를 한글명으로 변환한다', () => {
            const { getMemberTypeLabel } = useCouncilCodes();
            expect(getMemberTypeLabel('MAND')).toBe('당연위원');
        });

        it('CALL 코드를 한글명으로 변환한다', () => {
            const { getMemberTypeLabel } = useCouncilCodes();
            expect(getMemberTypeLabel('CALL')).toBe('소집위원');
        });

        it('null을 받으면 "-"를 반환한다', () => {
            const { getMemberTypeLabel } = useCouncilCodes();
            expect(getMemberTypeLabel(null)).toBe('-');
        });
    });

    describe('hearingTypeOptions', () => {
        it('심의유형 옵션 목록을 { label, value } 형태로 반환한다', () => {
            const { hearingTypeOptions } = useCouncilCodes();
            expect(hearingTypeOptions.value).toEqual([
                { label: '정보시스템 사업 타당성 검토', value: 'INFO_SYS' },
                { label: '정보보호 심의', value: 'INFO_SEC' },
            ]);
        });

        it('데이터가 없으면 빈 배열을 반환한다', () => {
            mockUseApiFetch.mockImplementation((url: string) => {
                if (url.includes('DBR_TP')) return { data: ref(null) };
                if (url.includes('ASCT_STS')) return { data: mockStatusData };
                if (url.includes('VLR_TP'))   return { data: mockMemberTypeData };
                return { data: ref([]) };
            });
            const { hearingTypeOptions } = useCouncilCodes();
            expect(hearingTypeOptions.value).toEqual([]);
        });
    });

    describe('statusOptions', () => {
        it('협의회상태 옵션 목록을 { label, value } 형태로 반환한다', () => {
            const { statusOptions } = useCouncilCodes();
            expect(statusOptions.value).toEqual([
                { label: '작성 중', value: 'DRAFT' },
                { label: '작성 완료', value: 'SUBMITTED' },
                { label: '완료', value: 'COMPLETED' },
            ]);
        });

        it('데이터가 없으면 빈 배열을 반환한다', () => {
            mockUseApiFetch.mockImplementation((url: string) => {
                if (url.includes('ASCT_STS')) return { data: ref(null) };
                if (url.includes('DBR_TP'))   return { data: mockHearingData };
                if (url.includes('VLR_TP'))   return { data: mockMemberTypeData };
                return { data: ref([]) };
            });
            const { statusOptions } = useCouncilCodes();
            expect(statusOptions.value).toEqual([]);
        });
    });
});
