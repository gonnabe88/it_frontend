/**
 * ============================================================================
 * [useCouncilCodes] 정보화실무협의회 공통코드 Composable
 * ============================================================================
 * TAAABB_CCODEM에서 협의회 관련 코드 그룹을 조회하고,
 * 코드값 → 한글명 변환 함수와 드롭다운 옵션을 제공합니다.
 *
 * [제공 함수]
 *   getStatusLabel(code)      : 협의회상태(ASCT_STS) 코드 → 한글명
 *   getHearingTypeLabel(code) : 심의유형(DBR_TP) 코드 → 한글명
 *   getMemberTypeLabel(code)  : 평가자유형(VLR_TP) 코드 → 한글명
 *
 * [제공 옵션 목록]
 *   hearingTypeOptions        : 심의유형 Select 옵션 (CCODEM 기반)
 *   statusOptions             : 협의회상태 Select 옵션 (CCODEM 기반)
 *
 * [캐싱 전략]
 *   - key를 명시하여 같은 페이지에서 중복 API 호출 방지 (Nuxt useFetch 기본 동작)
 *   - 상태가 pending 중에는 빈 배열로 초기화하여 오류 없이 렌더링
 * ============================================================================
 */

/** CCODEM API 응답 단건 타입 */
interface CodeItem {
    cdId: string;
    cdNm: string;
    cdva: string;
    cttTp: string;
}

export const useCouncilCodes = () => {
    const config = useRuntimeConfig();
    const BASE = `${config.public.apiBase}/api/ccodem/type`;

    // ── 코드 그룹별 조회 ───────────────────────────────────────────────

    /** 협의회상태 (ASCT_STS) */
    const { data: statusData } = useApiFetch<CodeItem[]>(`${BASE}/ASCT_STS`, {
        key: 'ccodem_ASCT_STS_v3',
        suppressNotFound: true,
        suppressNetworkError: true,
    });

    /** 심의유형 (DBR_TP) */
    const { data: hearingData } = useApiFetch<CodeItem[]>(`${BASE}/DBR_TP`, {
        key: 'ccodem_DBR_TP_v2',
        suppressNotFound: true,
        suppressNetworkError: true,
    });

    /** 평가자유형 (VLR_TP) */
    const { data: memberTypeData } = useApiFetch<CodeItem[]>(`${BASE}/VLR_TP`, {
        key: 'ccodem_VLR_TP_v2',
        suppressNotFound: true,
        suppressNetworkError: true,
    });

    // ── 코드값 → 한글명 맵 ────────────────────────────────────────────

    /** ASCT_STS: { DRAFT: '작성 중', SUBMITTED: '작성 완료', ... } */
    const statusMap = computed<Record<string, string>>(() =>
        Object.fromEntries((statusData.value ?? []).map(c => [c.cdva, c.cdNm]))
    );

    /** DBR_TP: { INFO_SYS: '정보시스템 사업 타당성 검토', ... } */
    const hearingMap = computed<Record<string, string>>(() =>
        Object.fromEntries((hearingData.value ?? []).map(c => [c.cdva, c.cdNm]))
    );

    /** VLR_TP: { MAND: '당연위원', CALL: '소집위원', SECR: '간사' } */
    const memberTypeMap = computed<Record<string, string>>(() =>
        Object.fromEntries((memberTypeData.value ?? []).map(c => [c.cdva, c.cdNm]))
    );

    // ── 변환 함수 ──────────────────────────────────────────────────────

    /**
     * 협의회상태 코드 → 한글명
     * @param code ASCT_STS 코드값 (예: 'DRAFT')
     */
    const getStatusLabel = (code: string | null | undefined): string =>
        code ? (statusMap.value[code] ?? code) : '-';

    /**
     * 심의유형 코드 → 한글명
     * @param code DBR_TP 코드값 (예: 'INFO_SYS')
     */
    const getHearingTypeLabel = (code: string | null | undefined): string =>
        code ? (hearingMap.value[code] ?? code) : '-';

    /**
     * 평가자유형 코드 → 한글명
     * @param code VLR_TP 코드값 (예: 'MAND')
     */
    const getMemberTypeLabel = (code: string | null | undefined): string =>
        code ? (memberTypeMap.value[code] ?? code) : '-';

    // ── 드롭다운 옵션 ──────────────────────────────────────────────────

    /** 심의유형 Select 옵션 목록 */
    const hearingTypeOptions = computed(() =>
        (hearingData.value ?? []).map(c => ({ label: c.cdNm, value: c.cdva }))
    );

    /** 협의회상태 Select 옵션 목록 */
    const statusOptions = computed(() =>
        (statusData.value ?? []).map(c => ({ label: c.cdNm, value: c.cdva }))
    );

    return {
        getStatusLabel,
        getHearingTypeLabel,
        getMemberTypeLabel,
        hearingTypeOptions,
        statusOptions,
    };
};
