/**
 * ============================================================================
 * [tests/unit/composables/useEmployeeSearch.test.ts] 직원 검색 Composable 테스트
 * ============================================================================
 * composables/useEmployeeSearch.ts를 직접 import하여 커버리지를 측정합니다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useEmployeeSearch } from '~/composables/useEmployeeSearch';

const mockApiFetch = vi.fn();
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));

const mockUser = ref<{ bbrC: string } | null>({ bbrC: 'D001' });
vi.stubGlobal('useAuth', () => ({ user: mockUser }));

describe('useEmployeeSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUser.value = { bbrC: 'D001' };
    });

    describe('초기 상태', () => {
        it('employeeSuggestions 초기값은 빈 배열이다', () => {
            const { employeeSuggestions } = useEmployeeSearch();
            expect(employeeSuggestions.value).toEqual([]);
        });

        it('employeeDialogVisible 초기값은 false이다', () => {
            const { employeeDialogVisible } = useEmployeeSearch();
            expect(employeeDialogVisible.value).toBe(false);
        });

        it('selectedRowIndex 초기값은 -1이다', () => {
            const { selectedRowIndex } = useEmployeeSearch();
            expect(selectedRowIndex.value).toBe(-1);
        });
    });

    describe('openEmployeeSearch', () => {
        it('지정한 행 인덱스를 설정하고 다이얼로그를 연다', () => {
            const { selectedRowIndex, employeeDialogVisible, openEmployeeSearch } = useEmployeeSearch();
            openEmployeeSearch(3);
            expect(selectedRowIndex.value).toBe(3);
            expect(employeeDialogVisible.value).toBe(true);
        });

        it('인덱스 0을 설정할 수 있다', () => {
            const { selectedRowIndex, openEmployeeSearch } = useEmployeeSearch();
            openEmployeeSearch(0);
            expect(selectedRowIndex.value).toBe(0);
        });
    });

    describe('searchEmployee', () => {
        it('빈 키워드이면 employeeSuggestions를 비운다', async () => {
            const { employeeSuggestions, searchEmployee } = useEmployeeSearch();
            employeeSuggestions.value = [
                { eno: 'E001', usrNm: '홍길동', bbrNm: '인사팀', bbrC: 'D001', temC: null, temNm: null }
            ];
            searchEmployee({ query: '   ' });
            await new Promise(r => setTimeout(r, 300));
            expect(employeeSuggestions.value).toEqual([]);
        });

        it('API 성공 시 검색 결과를 employeeSuggestions에 설정한다', async () => {
            mockApiFetch.mockResolvedValueOnce([
                { eno: 'E001', usrNm: '홍길동', bbrNm: '인사팀', bbrC: 'D001', temC: 'T01', temNm: '과장', ptCNm: '인사' }
            ]);
            const { employeeSuggestions, searchEmployee } = useEmployeeSearch();
            searchEmployee({ query: '홍' });
            await new Promise(r => setTimeout(r, 300));
            expect(employeeSuggestions.value).toHaveLength(1);
            expect(employeeSuggestions.value[0]!.usrNm).toBe('홍길동');
            expect(employeeSuggestions.value[0]!.displayLabel).toContain('홍길동');
        });

        it('API 실패 시 employeeSuggestions를 빈 배열로 초기화한다', async () => {
            mockApiFetch.mockRejectedValueOnce(new Error('API Error'));
            const { employeeSuggestions, searchEmployee } = useEmployeeSearch();
            searchEmployee({ query: '홍' });
            await new Promise(r => setTimeout(r, 300));
            expect(employeeSuggestions.value).toEqual([]);
        });
    });
}, 5000);
