/**
 * ============================================================================
 * [useEmployeeSearch] 직원 검색 (AutoComplete/다이얼로그) 공통 Composable
 * ============================================================================
 * 전산업무비 폼에서 담당자를 검색·선택하는 로직을 공통화합니다.
 * CostFormTableSection, TerminalTableSection 등에서 사용합니다.
 *
 * [제공 기능]
 *  - employeeSuggestions : AutoComplete용 검색 결과 목록
 *  - employeeDialogVisible : 직원조회 다이얼로그 표시 상태
 *  - selectedRowIndex : 다이얼로그에서 선택 시 대상 행 인덱스
 *  - searchEmployee : AutoComplete 검색 이벤트 핸들러
 *  - openEmployeeSearch : 직원조회 다이얼로그 열기
 * ============================================================================
 */
import { ref } from 'vue';

/** 직원 검색 결과 항목 인터페이스 */
export interface UserSuggestion {
    eno: string;
    usrNm: string;
    bbrNm: string;
    bbrC: string;
    temC: string | null;
    temNm: string | null;
    ptCNm?: string;
    displayLabel?: string;
}

/** 직원조회 다이얼로그 선택 결과 인터페이스 */
export interface DialogEmployeeResult {
    eno: string;
    usrNm: string;
    bbrNm: string;
    temC?: string;
    temNm?: string;
    orgCode?: string;
}

export const useEmployeeSearch = () => {
    const { $apiFetch } = useNuxtApp();
    const config = useRuntimeConfig();
    const { user } = useAuth();

    const employeeSuggestions = ref<UserSuggestion[]>([]);
    const employeeDialogVisible = ref(false);
    const selectedRowIndex = ref<number>(-1);

    /** AutoComplete 검색 이벤트 핸들러 (동일 부서 소속 직원 검색) */
    const searchEmployee = async (event: { query: string }) => {
        const keyword = event.query.trim();
        if (!keyword) { employeeSuggestions.value = []; return; }
        try {
            const userBase = `${config.public.apiBase}/api/users/search`;
            const orgCode = user.value?.bbrC ?? '';
            const results = await $apiFetch<UserSuggestion[]>(userBase, {
                query: { keyword, ...(orgCode ? { orgCode } : {}) }
            });
            employeeSuggestions.value = (results ?? []).map(u => ({
                ...u,
                displayLabel: `${u.usrNm}${u.ptCNm ? `(${u.ptCNm})` : ''}, ${u.temNm || u.bbrNm || ''}`
            }));
        } catch (e) {
            console.error('직원 검색 실패', e);
            employeeSuggestions.value = [];
        }
    };

    /** 직원조회 다이얼로그 열기 */
    const openEmployeeSearch = (index: number) => {
        selectedRowIndex.value = index;
        employeeDialogVisible.value = true;
    };

    return {
        employeeSuggestions,
        employeeDialogVisible,
        selectedRowIndex,
        searchEmployee,
        openEmployeeSearch,
    };
};
