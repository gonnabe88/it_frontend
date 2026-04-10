// Design Ref: §3 Data Model — 사전협의 도메인 타입 정의

/** 검토자 팀 유형 */
export type ReviewerTeam = '개발/운영팀' | '계약팀' | '기획팀' | 'PMO팀';

/** 사전협의 세션 상태 */
export type ReviewSessionStatus = 'draft' | 'reviewing' | 'revised' | 'completed';

/** 검토 문서 버전 */
export interface ReviewVersion {
  /** 버전 번호 ("0.1", "0.2" 등) */
  version: string;
  /** 문서 본문 (HTML) */
  content: string;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 작성자 사번 */
  createdBy: string;
}

/** 검토자 정보 */
export interface Reviewer {
  /** 사번 */
  eno: string;
  /** 이름 */
  empNm: string;
  /** 소속 팀 */
  team: ReviewerTeam;
  /** 검토 상태 */
  status: 'pending' | 'completed';
  /** 검토 완료 시각 */
  completedAt?: string;
}

/** 코멘트 첨부파일 */
export interface CommentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** 코멘트 (인라인 + 전반) */
export interface ReviewComment {
  /** UUID */
  id: string;
  /** 인라인(특정 영역) vs 전반(전체) */
  type: 'inline' | 'general';
  /** 코멘트 내용 */
  text: string;
  /** 첨부파일 목록 */
  attachments: CommentAttachment[];
  /** 작성자 사번 */
  authorEno: string;
  /** 작성자 이름 */
  authorName: string;
  /** 작성자 팀 */
  authorTeam: ReviewerTeam;
  /** 작성 시각 (ISO 8601) */
  createdAt: string;
  /** Tiptap Mark 식별자 (인라인 코멘트 전용) */
  markId?: string;
  /** 드래그한 원문 텍스트 스냅샷 */
  quotedText?: string;
  /** 해결 여부 */
  resolved: boolean;
}

/** 사전협의 세션 전체 상태 */
export interface ReviewSession {
  /** 문서 관리번호 */
  docMngNo: string;
  /** 문서 제목 */
  docTitle: string;
  /** 세션 상태 */
  status: ReviewSessionStatus;
  /** 현재 버전 */
  currentVersion: string;
  /** 편집 중인 본문 (버전 스냅샷과 분리) */
  draftContent: string;
  /** 버전 이력 (각 버전은 검토요청 시점의 불변 스냅샷) */
  versions: ReviewVersion[];
  /** 검토자 목록 */
  reviewers: Reviewer[];
  /** 전체 코멘트 */
  comments: ReviewComment[];
}
