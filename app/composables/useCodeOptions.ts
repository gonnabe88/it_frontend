/**
 * ============================================================================
 * [useCodeOptions] 공통코드 옵션 조회 및 코드명 변환 Composable
 * ============================================================================
 * 공통코드(CCODEM) API에서 코드 옵션을 조회하고,
 * 코드ID → 코드명 변환 함수를 제공합니다.
 *
 * [사용 방법]
 *  const { options, getCodeName } = useCodeOptions('PRJ_TP');
 *  // options: Ref<CodeOption[]> — Select 바인딩용
 *  // getCodeName('PRJ_TP_001') → '신규개발'
 * ============================================================================
 */
export interface CodeOption {
    cdId: string;
    cdNm: string;
    cdSqn?: number | null;
}

/**
 * 공통코드 옵션 조회 + 코드명 변환
 * @param typeCode - 코드값구분 (예: 'PRJ_TP', 'BZ_DTT')
 */
export const useCodeOptions = (typeCode: string) => {
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/ccodem/type/${typeCode}`;
    const { data } = useApiFetch<CodeOption[]>(url);

    /** 코드 옵션 목록 (cdSqn 오름차순 정렬) */
    const options = computed(() =>
        [...(data.value || [])].sort((a, b) => (a.cdSqn ?? Infinity) - (b.cdSqn ?? Infinity))
    );

    /**
     * 코드ID → 코드명 변환
     * 매칭되는 코드가 없으면 원본 값을 그대로 반환합니다.
     */
    const getCodeName = (cdId: string | null | undefined): string => {
        if (!cdId) return '-';
        const found = options.value.find(o => o.cdId === cdId);
        return found ? found.cdNm : cdId;
    };

    return { options, getCodeName };
};
