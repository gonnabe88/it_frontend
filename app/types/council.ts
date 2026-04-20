/**
 * ============================================================================
 * [types/council.ts] 정보화실무협의회 TypeScript 타입 정의
 * ============================================================================
 * 협의회 도메인 전반에서 공유하는 타입을 정의합니다.
 *
 * [포함 타입]
 *  - CouncilStatus       : 협의회 진행상태 (12단계)
 *  - HearingType         : 심의유형 (INFO_SYS / INFO_SEC / ETC)
 *  - CommitteeType       : 위원유형 (MAND / CALL / SECR)
 *  - CheckItemCode       : 타당성 자체점검 항목코드 (6개)
 *  - CouncilListItem     : 협의회 목록 항목 (index.vue 용)
 *  - CouncilDetail       : 협의회 상세 정보
 *  - FeasibilityData     : 타당성검토표 전체 데이터
 *  - CheckItem           : 자체점검 항목
 *  - PerformanceItem     : 성과지표
 *  - CommitteeMember     : 평가위원
 *  - CommitteeList       : 위원유형별 분류 목록
 *  - ScheduleItem        : 일정 슬롯
 *  - ScheduleStatusResponse : 일정 입력 현황
 *  - EvaluationItem      : 평가의견 항목
 *  - ResultData          : 결과서 데이터
 * ============================================================================
 */

/** 협의회 진행상태 (12단계 + 생략 + 초기값) */
export type CouncilStatus =
  | 'DRAFT'           // 작성 중
  | 'SUBMITTED'       // 작성 완료
  | 'APPROVAL_PENDING' // 결재 대기
  | 'APPROVED'        // 결재 완료 (팀장 승인)
  | 'SKIPPED'         // 협의회 생략 (IT관리자 판단)
  | 'PREPARING'       // 개최 준비 (평가위원 선정 완료)
  | 'SCHEDULED'       // 일정 확정
  | 'IN_PROGRESS'     // 협의회 진행 중
  | 'EVALUATING'      // 평가의견 작성 중
  | 'RESULT_WRITING'  // 결과서 작성 중
  | 'RESULT_REVIEW'   // 결과서 검토 중
  | 'FINAL_APPROVAL'  // 결과보고 결재 중
  | 'COMPLETED';      // 완료

/** 심의유형 (CCODEM DBR_TP 기준 5개) */
export type HearingType = 'MID_PLAN' | 'IT_PLAN' | 'INFO_SYS' | 'INFO_SEC' | 'ETC';

/** 위원유형 */
export type CommitteeType = 'MAND' | 'CALL' | 'SECR';

/** 타당성 자체점검 항목코드 */
export type CheckItemCode =
  | 'MGMT_STR'  // 경영전략/계획 부합
  | 'FIN_EFC'   // 재무 효과
  | 'RISK_IMP'  // 리스크 개선 효과
  | 'REP_IMP'   // 평판/이미지 개선 효과
  | 'DUP_SYS'   // 유사/중복 시스템 유무
  | 'ETC';      // 기타

/**
 * 협의회 목록 항목 (GET /api/council 응답)
 * index.vue 사업목록 표출 및 라우팅 처리에 사용합니다.
 *
 * applied=false 이면 결재완료 사업이지만 아직 협의회를 신청하지 않은 건입니다.
 * 이 경우 asctId/asctSts/dbrTp/cnrcDt 는 null 입니다.
 */
export interface CouncilListItem {
  /** 협의회ID. 신청 전이면 null */
  asctId: string | null;
  /** 프로젝트관리번호 */
  prjMngNo: string;
  /** 프로젝트순번 */
  prjSno: number;
  /** 사업명 */
  prjNm: string | null;
  /** 협의회 진행상태. 신청 전이면 null */
  asctSts: CouncilStatus | null;
  /** 심의유형. 신청 전이면 null */
  dbrTp: HearingType | null;
  /** 회의일자. 신청 전이면 null */
  cnrcDt: string | null;
  /** 협의회 신청 여부 (false = 결재완료이지만 아직 미신청) */
  applied: boolean;
  /** 사업연도 */
  prjYy: string | null;
  /** 사업유형 */
  prjTp: string | null;
  /** 주관부서코드 */
  svnDpm: string | null;
  /** 사업예산 */
  prjBg: number | null;
  /** 사업시작일 */
  sttDt: string | null;
  /** 사업종료일 */
  endDt: string | null;
  /** IT담당부서 */
  itDpm: string | null;
  /** 사업설명 */
  prjDes: string | null;
}

/**
 * 협의회 단건 상세 (GET /api/council/{asctId} 응답)
 */
export interface CouncilDetail {
  asctId: string;
  prjMngNo: string;
  prjSno: number;
  asctSts: CouncilStatus;
  dbrTp: HearingType | null;
  cnrcDt: string | null;
  cnrcTm: string | null;
  cnrcPlc: string | null;
  /** 사업명 (BPROJM.PRJ_NM) */
  prjNm: string | null;
  /** 전결권자 (BPROJM.EDRT) */
  edrt: string | null;
  /** 사업기간 시작일 (BPROJM.STT_DT) */
  sttDt: string | null;
  /** 사업기간 종료일 (BPROJM.END_DT) */
  endDt: string | null;
  /** 필요성 (BPROJM.NCS) */
  ncs: string | null;
  /** 소요예산 (BPROJM.PRJ_BG) */
  prjBg: number | null;
  /** 사업내용 (BPROJM.PRJ_DES) */
  prjDes: string | null;
  /** 기대효과 (BPROJM.XPT_EFF) */
  xptEff: string | null;
}

/**
 * 타당성검토표 조회/저장 데이터
 */
export interface FeasibilityData {
  prjNm: string;
  prjTrm: string;
  ncs: string;
  prjBg: number | null;
  edrt: string;
  prjDes: string;
  lglRglYn: 'Y' | 'N';
  lglRglNm: string | null;
  xptEff: string;
  kpnTp: 'TEMP' | 'COMPLETE';
  checkItems: CheckItemData[];
  performances: PerformanceItem[];
  flMngNo: string | null;
}

/**
 * 자체점검 항목 (조회 응답용)
 */
export interface CheckItemData {
  ckgItmC: CheckItemCode;
  ckgItmNm: string;
  ckgCone: string;
  ckgRcrd: 1 | 2 | 3 | 4 | 5 | null;
}

/**
 * 성과지표 항목
 */
export interface PerformanceItem {
  dtpSno: number;
  dtpNm: string;
  dtpCone: string;
  msmManr: string;
  clf: string;
  glNv: string;
  msmSttDt: string | null;
  msmEndDt: string | null;
  msmTpm: string;
  msmCle: string;
}

/**
 * 평가위원 단건
 */
export interface CommitteeMember {
  eno: string;
  usrNm: string | null;
  bbrNm: string | null;
  ptCNm: string | null;
  vlrTp: CommitteeType;
}

/**
 * 평가위원 목록 (위원유형별 분류)
 */
export interface CommitteeList {
  mandatory: CommitteeMember[];
  call: CommitteeMember[];
  secretary: CommitteeMember[];
}

/**
 * 일정 슬롯 응답
 */
export interface ScheduleSlot {
  dsdDt: string;
  dsdTm: string;
  psbYn: 'Y' | 'N';
}

/**
 * 위원별 일정 응답 현황
 */
export interface MemberScheduleStatus {
  eno: string;
  usrNm: string | null;
  /** 부서명 */
  bbrNm: string | null;
  /** 직책명 */
  ptCNm: string | null;
  vlrTp: CommitteeType;
  responded: boolean;
  slots: ScheduleSlot[];
}

/**
 * 일정 입력 전체 현황 (IT관리자용)
 */
export interface ScheduleStatusResponse {
  totalCount: number;
  respondedCount: number;
  pendingCount: number;
  memberStatuses: MemberScheduleStatus[];
  /**
   * 일정 확정 가능 여부 (필수 응답자 기준)
   * INFO_SYS: 예산팀장(12004) + IT기획팀장(18001) 응답 완료 시 true
   * 기타 타입: 전원 응답 완료 시 true
   */
  allRequiredResponded: boolean;
}

/**
 * 사전질의응답 항목
 */
export interface QnaItem {
  qtnId: string;
  qtnEno: string;
  qtnNm: string | null;
  qtnCone: string;
  repEno: string | null;
  repNm: string | null;
  repCone: string | null;
  repYn: 'Y' | 'N';
}

/**
 * 평가의견 항목 응답
 */
export interface EvaluationItem {
  eno: string;
  usrNm: string | null;
  ckgItmC: CheckItemCode;
  ckgItmNm: string;
  ckgRcrd: number | null;
  ckgOpnn: string | null;
}

/**
 * 점검항목별 평균점수
 */
export interface CheckItemAvgScore {
  ckgItmC: CheckItemCode;
  ckgItmNm: string;
  avgScore: number;
}

/**
 * 평가의견 전체 현황 (IT관리자 조회용)
 */
export interface EvaluationSummary {
  evaluations: EvaluationItem[];
  avgScores: CheckItemAvgScore[];
}

/**
 * 결과서 데이터
 */
export interface ResultData {
  synOpnn: string | null;
  ckgOpnn: string | null;
  flMngNo: string | null;
  avgScores: CheckItemAvgScore[];
}
