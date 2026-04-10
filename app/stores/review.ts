/**
 * ============================================================================
 * [stores/review.ts] 사전협의(문서 검토) Pinia 스토어
 * ============================================================================
 * 사전협의 세션 상태를 전역으로 관리하는 Pinia 스토어입니다.
 * 문서 검토 프로세스의 핵심 상태(세션, 버전, 코멘트, 검토자)를 담당합니다.
 *
 * [상태 관리 전략]
 *  - 세션 내 메모리 전용: 새로고침 시 초기화됩니다 (localStorage 미사용).
 *  - 문서 전환 시 loadSession()으로 새 세션을 생성합니다.
 *
 * [버전 관리]
 *  - v0.0: 초안 (문서 진입 시 자동 생성)
 *  - v0.1~: 검토요청 시마다 draftContent를 불변 스냅샷으로 저장
 *  - draftContent: 편집 중인 본문 (버전 스냅샷과 분리)
 *
 * [사용처]
 *  - composables/useReview.ts를 통해 컴포넌트에서 사용
 *
 * TODO: 서버 API 연동 시 세션/코멘트를 서버에 저장하도록 개선 필요
 * FIXME: defaultReviewers가 하드코딩된 모의 데이터로 구성되어 있어
 *        실서비스에서는 프로젝트별 검토자를 동적으로 조회해야 함
 * ============================================================================
 */
import { defineStore } from 'pinia';
import type {
  ReviewSession,
  ReviewComment,
  ReviewVersion,
  Reviewer,
  ReviewSessionStatus,
} from '~/types/review';

/**
 * UUID 생성 (간이)
 * crypto.randomUUID가 지원되지 않는 환경에서는 타임스탬프 기반 대체 ID를 생성합니다.
 */
const generateId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 다음 버전 번호 계산
 * 현재 버전에서 0.1을 증가시켜 소수점 1자리 문자열로 반환합니다.
 *
 * @param current - 현재 버전 번호 (예: '0.1')
 * @returns 다음 버전 번호 (예: '0.2')
 */
const nextVersion = (current: string): string => {
  const num = parseFloat(current);
  return (num + 0.1).toFixed(1);
};

/**
 * 기본 검토자 목록 (모의 데이터)
 * FIXME: 실서비스에서는 프로젝트별 검토자를 서버 API로 조회해야 합니다.
 */
const defaultReviewers: Reviewer[] = [
  { eno: 'R001', empNm: '홍길동', team: '개발/운영팀', status: 'pending' },
  { eno: 'R002', empNm: '김영희', team: '계약팀', status: 'pending' },
  { eno: 'R003', empNm: '이철수', team: '기획팀', status: 'pending' },
  { eno: 'R004', empNm: '박지원', team: 'PMO팀', status: 'pending' },
];

export const useReviewStore = defineStore('review', {
  state: () => ({
    /** 현재 세션 */
    session: null as ReviewSession | null,
    /** 현재 보고 있는 버전 (null이면 최신) */
    viewingVersion: null as string | null,
    /** 활성 코멘트 ID (팝오버 표시용) */
    activeCommentId: null as string | null,
  }),

  getters: {
    /** 현재 문서 내용 — 과거 버전 열람 시 해당 스냅샷, 현재 버전이거나 viewingVersion이 null이면 편집 중 draftContent */
    currentContent(): string {
      if (!this.session) return '';
      // 현재 버전과 다른 버전을 열람 중인 경우에만 스냅샷 반환
      if (this.viewingVersion && this.viewingVersion !== this.session.currentVersion) {
        const ver = this.session.versions.find(v => v.version === this.viewingVersion);
        return ver?.content ?? '';
      }
      // viewingVersion이 null이거나 현재 버전을 선택한 경우: 편집 중인 draftContent 반환
      return this.session.draftContent;
    },

    /** 시간순 정렬된 코멘트 목록 */
    sortedComments(): ReviewComment[] {
      if (!this.session) return [];
      return [...this.session.comments].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    },

    /** 인라인 코멘트만 */
    inlineComments(): ReviewComment[] {
      return this.sortedComments.filter(c => c.type === 'inline');
    },

    /** 전체 검토 완료 여부 */
    allReviewCompleted(): boolean {
      if (!this.session) return false;
      return this.session.reviewers.every(r => r.status === 'completed');
    },

    /** 버전 목록 (표시용) */
    versionList(): { label: string; value: string }[] {
      if (!this.session) return [];
      return this.session.versions.map(v => ({
        label: `v${v.version}`,
        value: v.version,
      }));
    },

    /** 이전 버전 열람 중 여부 */
    isViewingHistory(): boolean {
      if (!this.session || !this.viewingVersion) return false;
      return this.viewingVersion !== this.session.currentVersion;
    },
  },

  actions: {
    /** 세션 로드 (매 진입 시 새로 생성) */
    loadSession(docMngNo: string, docTitle: string, initialContent: string) {
      // 문서 전환 시 이전 상태 초기화
      this.viewingVersion = null;
      this.activeCommentId = null;

      // 새 세션 생성 (매번 초기화 — localStorage 미사용)
      this.session = {
        docMngNo,
        docTitle,
        status: 'draft',
        currentVersion: '0.0',
        draftContent: '',
        versions: [],
        reviewers: [...defaultReviewers.map(r => ({ ...r }))],
        comments: [],
      };

      // 초안 내용이 있으면 저장
      if (initialContent) {
        this._setDraftContent(initialContent);
      }
    },

    /** 편집 중 내용을 draftContent에 설정 (버전 스냅샷은 건드리지 않음) */
    _setDraftContent(content: string) {
      if (!this.session) return;
      this.session.draftContent = content;
      // 초기 원본 스냅샷이 없으면 v0.0으로 저장 (불변)
      if (this.session.versions.length === 0) {
        this.session.versions.push({
          version: '0.0',
          content,
          createdAt: new Date().toISOString(),
          createdBy: 'AUTHOR',
        });
      }
    },

    /** 본문 내용 업데이트 (draftContent만 변경, 버전 스냅샷 보존) */
    updateContent(content: string) {
      if (!this.session) return;
      // 이전 버전 열람 중에는 draftContent를 건드리지 않음
      // (에디터 내용 변경 이벤트가 draftContent를 덮어쓰는 것을 방지)
      if (this.viewingVersion && this.viewingVersion !== this.session.currentVersion) return;
      this.session.draftContent = content;
    },

    /** 검토요청 (draftContent를 스냅샷으로 찍어 새 버전 생성) */
    submitForReview() {
      if (!this.session) return;
      const content = this.session.draftContent;
      const newVer = this.session.versions.length === 1 && this.session.currentVersion === '0.0'
        ? '0.1'
        : nextVersion(this.session.currentVersion);

      // draftContent를 불변 스냅샷으로 새 버전에 저장
      this.session.versions.push({
        version: newVer,
        content,
        createdAt: new Date().toISOString(),
        createdBy: 'AUTHOR',
      });

      this.session.currentVersion = newVer;
      this.session.status = 'reviewing';

      // 검토자 상태 초기화 (재검토 시)
      this.session.reviewers.forEach(r => {
        r.status = 'pending';
        r.completedAt = undefined;
      });

      this.viewingVersion = null;
    },

    /** 코멘트 추가 */
    addComment(comment: Omit<ReviewComment, 'id' | 'createdAt'>) {
      if (!this.session) return;

      const newComment: ReviewComment = {
        ...comment,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };

      this.session.comments.push(newComment);

      return newComment;
    },

    /** 코멘트 해결 처리 */
    resolveComment(commentId: string) {
      if (!this.session) return;
      const comment = this.session.comments.find(c => c.id === commentId);
      if (comment) {
        comment.resolved = true;
      }
    },

    /** 검토완료 처리 */
    completeReview(reviewerEno: string) {
      if (!this.session) return;
      const reviewer = this.session.reviewers.find(r => r.eno === reviewerEno);
      if (reviewer) {
        reviewer.status = 'completed';
        reviewer.completedAt = new Date().toISOString();
      }

      // 전원 검토 완료 시 세션 상태 변경
      if (this.allReviewCompleted) {
        this.session.status = 'completed';
      }
    },

    /** 특정 버전 보기 */
    viewVersion(version: string | null) {
      this.viewingVersion = version;
    },

    /** 활성 코멘트 설정 */
    setActiveComment(commentId: string | null) {
      this.activeCommentId = commentId;
    },

  },
});
