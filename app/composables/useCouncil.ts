/**
 * ============================================================================
 * [useCouncil] 정보화실무협의회 Composable
 * ============================================================================
 * 협의회 도메인의 API 호출을 담당하는 composable입니다.
 * Spring Boot 백엔드의 /api/council 엔드포인트와 통신합니다.
 *
 * [제공 기능]
 *  - fetchCouncilList  : 내 협의회 목록 조회 (권한별 필터링)
 *  - fetchCouncil      : 협의회 단건 상세 조회
 *  - createCouncil     : 협의회 신청 (신규 생성)
 *
 * [API 패턴]
 *  - 조회(GET): useApiFetch 사용 (자동 인증 + 반응형)
 *  - 변경(POST/PUT/DELETE): $apiFetch 사용 (plugins/auth.ts 제공)
 *
 * [권한별 목록 필터링 (서버 측 처리)]
 *  - 일반사용자(ITPZZ001): 소속 부서 사업의 협의회만 반환
 *  - IT관리자(ITPAD001): 전체 협의회 반환
 *  - 평가위원: 배정된 협의회만 반환
 * ============================================================================
 */

import type {
    CouncilListItem,
    CouncilDetail,
    CommitteeList,
    ScheduleStatusResponse,
    EvaluationSummary,
    ResultData,
    ScheduleSlot,
} from '~/types/council';

/**
 * 협의회 신청 요청 DTO
 */
export interface CreateCouncilRequest {
  /** 프로젝트관리번호 */
  prjMngNo: string;
  /** 프로젝트순번 */
  prjSno: number;
  /** 심의유형 (INFO_SYS / INFO_SEC / ETC) */
  dbrTp: string;
}

/**
 * 협의회 Composable
 *
 * 협의회 목록 조회, 단건 조회, 신청 기능을 제공합니다.
 * 각 페이지에서 import하여 사용합니다.
 */
export const useCouncil = () => {
    const { $apiFetch } = useNuxtApp();
    /** 백엔드 API 베이스 URL (예: http://localhost:8080) */
    const config = useRuntimeConfig();
    const BASE = `${config.public.apiBase}/api/council`;

    /**
     * 내 협의회 목록 조회
     *
     * 로그인한 사용자의 권한에 따라 서버 측에서 필터링된 목록을 반환합니다.
     * - 일반사용자: 소속 부서 사업의 협의회
     * - IT관리자: 전체 협의회
     * - 평가위원: 배정된 협의회
     *
     * @returns useFetch 반환값 (data, pending, error, refresh)
     */
    const fetchCouncilList = () => {
        return useApiFetch<CouncilListItem[]>(`${BASE}`);
    };

    /**
     * 협의회 단건 상세 조회
     *
     * @param asctId 협의회ID (ASCT-{연도}-{4자리})
     * @returns useFetch 반환값 (data, pending, error, refresh)
     */
    const fetchCouncil = (asctId: string) => {
        return useApiFetch<CouncilDetail>(`${BASE}/${asctId}`);
    };

    /**
     * 협의회 신청 (신규 생성)
     *
     * 소관부서 담당자(ITPZZ001)가 타당성검토표 작성 전 협의회를 신청합니다.
     * 초기 상태 DRAFT로 생성됩니다.
     *
     * @param payload 협의회 신청 정보 (프로젝트관리번호, 순번, 심의유형)
     * @returns 생성된 협의회ID (예: ASCT-2026-0001)
     */
    const createCouncil = async (payload: CreateCouncilRequest): Promise<string> => {
        return await $apiFetch<string>(BASE, {
            method: 'POST',
            body: payload,
        });
    };

    // =========================================================================
    // 타당성검토표 (Step 1)
    // =========================================================================

    /**
     * 타당성검토표 조회
     *
     * 사업개요 + 타당성 자체점검(6개) + 성과지표 목록을 통합 반환합니다.
     *
     * @param asctId 협의회ID
     * @returns useFetch 반환값
     */
    const fetchFeasibility = (asctId: string) => {
        return useApiFetch<import('~/types/council').FeasibilityData>(
            `${BASE}/${asctId}/feasibility`
        );
    };

    /**
     * 타당성검토표 저장 (임시저장 / 작성완료)
     *
     * kpnTp=TEMP: 임시저장 (상태 DRAFT 유지)
     * kpnTp=COMPLETE: 작성완료 (상태 SUBMITTED 전이, 첨부파일 필수)
     *
     * @param asctId  협의회ID
     * @param payload 타당성검토표 저장 요청
     * @param isUpdate true이면 PUT, false이면 POST
     */
    const saveFeasibility = async (
        asctId: string,
        payload: import('~/types/council').FeasibilityData,
        isUpdate: boolean = false
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/feasibility`, {
            method: isUpdate ? 'PUT' : 'POST',
            body: payload,
        });
    };

    // =========================================================================
    // 전자결재 연동 (Step 1)
    // =========================================================================

    /**
     * 타당성검토표 결재 요청 (소관부서 담당자 → 팀장)
     *
     * SUBMITTED 상태인 협의회에 대해 팀장 결재를 요청합니다.
     *
     * @param asctId      협의회ID
     * @param approverEno 결재자(팀장) 사번
     * @param rqsOpnn     신청의견 (선택)
     * @returns 생성된 신청관리번호 (APF_... 형식)
     */
    const requestApproval = async (
        asctId: string,
        approverEno: string,
        rqsOpnn?: string
    ): Promise<{ apfMngNo: string }> => {
        return await $apiFetch(`${BASE}/${asctId}/approval`, {
            method: 'POST',
            body: { approverEno, rqsOpnn },
        });
    };

    // =========================================================================
    // 평가위원 선정 (Step 2)
    // =========================================================================

    /**
     * 기본 평가위원 목록 조회 (심의유형별 당연위원)
     *
     * IT관리자가 심의유형을 선택하면 해당 유형의 당연위원을 자동으로 불러옵니다.
     *
     * @param asctId 협의회ID
     * @param dbrTp  심의유형 (INFO_SYS / INFO_SEC / ETC)
     */
    const fetchDefaultCommittee = (asctId: string, dbrTp: string) => {
        return useApiFetch<CommitteeList>(`${BASE}/${asctId}/committee/default`, {
            query: { dbrTp },
        });
    };

    /**
     * 현재 확정된 평가위원 목록 조회
     *
     * @param asctId 협의회ID
     */
    const fetchCommittee = (asctId: string) => {
        return useApiFetch<CommitteeList>(`${BASE}/${asctId}/committee`);
    };

    /**
     * 평가위원 저장 (전체 교체)
     *
     * 당연위원 + 소집위원 + 간사를 한 번에 저장합니다.
     * 기존 데이터를 삭제 후 신규 저장하는 전체 교체 방식입니다.
     *
     * @param asctId    협의회ID
     * @param payload   위원 목록 (mandatory/call/secretary 분류)
     */
    const saveCommittee = async (
        asctId: string,
        payload: CommitteeList
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/committee`, {
            method: 'PUT',
            body: payload,
        });
    };

    // =========================================================================
    // 일정 취합/확정 (Step 2)
    // =========================================================================

    /**
     * 일정 입력 현황 조회 (IT관리자용)
     *
     * 위원별 가능 일정 응답 현황을 반환합니다.
     * respondedCount === totalCount 이면 전원 입력 완료입니다.
     *
     * @param asctId 협의회ID
     */
    const fetchScheduleStatus = (asctId: string) => {
        return useApiFetch<ScheduleStatusResponse>(`${BASE}/${asctId}/schedule`);
    };

    /**
     * 일정 확정 (IT관리자)
     *
     * 협의회 날짜/시간/장소를 확정하여 상태를 SCHEDULED로 전이합니다.
     *
     * @param asctId  협의회ID
     * @param cnrcDt  회의일자 (yyyy-MM-dd)
     * @param cnrcTm  회의시간 (HH:mm)
     * @param cnrcPlc 회의장소
     */
    const confirmSchedule = async (
        asctId: string,
        cnrcDt: string,
        cnrcTm: string,
        cnrcPlc: string
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/schedule/confirm`, {
            method: 'PUT',
            body: { cnrcDt, cnrcTm, cnrcPlc },
        });
    };

    // =========================================================================
    // 사전질의응답 (Step 2)
    // =========================================================================

    /**
     * 사전질의응답 목록 조회
     *
     * @param asctId 협의회ID
     */
    const fetchQnaList = (asctId: string) => {
        return useApiFetch<import('~/types/council').QnaItem[]>(
            `${BASE}/${asctId}/qna`
        );
    };

    /**
     * 사전질의 답변 등록 (추진부서 담당자)
     *
     * @param asctId  협의회ID
     * @param qtnId   질의응답ID
     * @param repCone 답변 내용
     */
    const replyQna = async (
        asctId: string,
        qtnId: string,
        repCone: string
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/qna/${qtnId}`, {
            method: 'PUT',
            body: { repCone },
        });
    };

    // =========================================================================
    // 일정 입력 (Step 2 — 평가위원)
    // =========================================================================

    /**
     * 평가위원 일정 입력 제출
     *
     * 평가위원이 날짜×시간대 체크박스에서 선택한 가능 일정을 서버에 전송합니다.
     *
     * @param asctId 협의회ID
     * @param slots  가능 일정 목록 (dsdDt, dsdTm, psbYn)
     */
    const submitSchedule = async (
        asctId: string,
        slots: ScheduleSlot[]
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/schedule`, {
            method: 'POST',
            body: { availableSlots: slots },
        });
    };

    // =========================================================================
    // 평가의견 (Step 3 — 평가위원)
    // =========================================================================

    /**
     * 평가의견 전체 현황 조회 (IT관리자용)
     *
     * 위원별 평가의견 + 항목별 평균점수를 반환합니다.
     *
     * @param asctId 협의회ID
     */
    const fetchEvaluationSummary = (asctId: string) => {
        return useApiFetch<EvaluationSummary>(`${BASE}/${asctId}/evaluation`);
    };

    /**
     * 평가의견 저장 (평가위원)
     *
     * 타당성 점검 6항목별 점수(1~5)와 의견을 저장합니다.
     * 1~2점 시 의견(ckgOpnn) 필수 — 유효성 검사는 UI에서 처리합니다.
     *
     * @param asctId  협의회ID
     * @param items   6항목별 점수+의견 목록
     */
    const saveEvaluation = async (
        asctId: string,
        items: Array<{ ckgItmC: string; ckgRcrd: number; ckgOpnn: string }>
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/evaluation`, {
            method: 'POST',
            body: { items },
        });
    };

    // =========================================================================
    // 결과서 (Step 3 — IT관리자)
    // =========================================================================

    /**
     * 결과서 조회
     *
     * 종합의견 + 타당성검토의견 + 항목별 평균점수를 반환합니다.
     *
     * @param asctId 협의회ID
     */
    const fetchResult = (asctId: string) => {
        return useApiFetch<ResultData>(`${BASE}/${asctId}/result`);
    };

    /**
     * 결과서 저장/수정 (IT관리자)
     *
     * @param asctId   협의회ID
     * @param payload  결과서 데이터
     * @param isUpdate true이면 PUT, false이면 POST
     */
    const saveResult = async (
        asctId: string,
        payload: Pick<ResultData, 'synOpnn' | 'ckgOpnn' | 'flMngNo'>,
        isUpdate: boolean = false
    ): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/result`, {
            method: isUpdate ? 'PUT' : 'POST',
            body: payload,
        });
    };

    /**
     * 결과서 검토 확인 (평가위원)
     *
     * 평가위원 전원 확인 시 상태가 RESULT_REVIEW → FINAL_APPROVAL로 전이됩니다.
     *
     * @param asctId 협의회ID
     */
    const confirmResult = async (asctId: string): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/result/confirm`, {
            method: 'PUT',
        });
    };

    return {
        fetchCouncilList,
        fetchCouncil,
        createCouncil,
        fetchFeasibility,
        saveFeasibility,
        requestApproval,
        fetchDefaultCommittee,
        fetchCommittee,
        saveCommittee,
        fetchScheduleStatus,
        confirmSchedule,
        fetchQnaList,
        replyQna,
        submitSchedule,
        fetchEvaluationSummary,
        saveEvaluation,
        fetchResult,
        saveResult,
        confirmResult,
    };
};
