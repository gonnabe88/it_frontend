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
import { ref, computed } from 'vue';
import type {
  ReviewSession,
  ReviewComment,
  Reviewer,
} from '~/types/review';

/**
 * 다음 버전 번호 계산
 * 현재 버전에서 0.1을 증가시켜 소수점 1자리 문자열로 반환합니다.
 *
 * @param current - 현재 버전 번호 (예: '0.1')
 * @returns 다음 버전 번호 (예: '0.2')
 */
const nextVersion = (current: string): string => {
  const num = Number.parseFloat(current);
  return (num + 0.01).toFixed(2);
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

export const useReviewStore = defineStore('review', () => {
  /** 현재 세션 */
  const session = ref<ReviewSession | null>(null);
  /** 현재 보고 있는 버전 (null이면 최신) */
  const viewingVersion = ref<string | null>(null);
  /** 활성 코멘트 ID (팝오버 표시용) */
  const activeCommentId = ref<string | null>(null);

  /** 현재 문서 내용 — 과거 버전 열람 시 해당 스냅샷, 현재 버전이거나 viewingVersion이 null이면 편집 중 draftContent */
  const currentContent = computed<string>(() => {
    if (!session.value) return '';
    if (viewingVersion.value && viewingVersion.value !== session.value.currentVersion) {
      const ver = session.value.versions.find(v => v.version === viewingVersion.value);
      return ver?.content ?? '';
    }
    return session.value.draftContent;
  });

  /** 시간순 정렬된 코멘트 목록 */
  const sortedComments = computed<ReviewComment[]>(() => {
    if (!session.value) return [];
    return [...session.value.comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  /** 인라인 코멘트만 */
  const inlineComments = computed<ReviewComment[]>(() =>
    sortedComments.value.filter(c => c.type === 'inline')
  );

  /** 전체 검토 완료 여부 */
  const allReviewCompleted = computed<boolean>(() =>
    !!session.value && session.value.reviewers.every(r => r.status === 'completed')
  );

  /** 버전 목록 (표시용) */
  const versionList = computed<{ label: string; value: string }[]>(() => {
    if (!session.value) return [];
    return session.value.versions.map(v => ({ label: `v${v.version}`, value: v.version }));
  });

  /** 이전 버전 열람 중 여부 */
  const isViewingHistory = computed<boolean>(() =>
    !!session.value && !!viewingVersion.value && viewingVersion.value !== session.value.currentVersion
  );

  /** 세션 로드 (매 진입 시 새로 생성) */
  async function loadSession(docMngNo: string, docTitle: string, initialContent: string, docVrs: number = 0) {
    viewingVersion.value = null;
    activeCommentId.value = null;

    const currentVersion = docVrs > 0 ? docVrs.toFixed(2) : '0.00';

    session.value = {
      docMngNo,
      docTitle,
      status: 'draft',
      currentVersion,
      draftContent: '',
      versions: [],
      reviewers: [...defaultReviewers.map(r => ({ ...r }))],
      comments: [],
    };

    if (initialContent) {
      _setDraftContent(initialContent);
    }

    // 서버에서 버전 히스토리 로드 (드롭다운 목록 구성)
    try {
      const { fetchVersionHistory } = useDocuments();
      const history = await fetchVersionHistory(docMngNo);
      if (history.length > 0) {
        // 서버 응답은 버전 내림차순 → 오름차순으로 변환
        session.value.versions = [...history].reverse().map(h => ({
          version: (h.docVrs as number).toFixed(2),
          content: h.docVrs === docVrs ? initialContent : '',
          createdAt: h.fstEnrDtm,
          createdBy: 'AUTHOR',
        }));
      }
    } catch {
      // 히스토리 로드 실패 시 _setDraftContent가 추가한 현재 버전만 유지
    }

    // 서버에서 해당 버전의 기존 코멘트 로드
    if (docVrs > 0) {
      try {
        const api = useReviewCommentApi();
        const serverComments = await api.fetchComments(docMngNo, docVrs);
        session.value.comments = serverComments;
      } catch {
        // 코멘트 로드 실패 시 빈 목록으로 유지
      }
    }
  }

  /** 편집 중 내용을 draftContent에 설정 (버전 스냅샷은 건드리지 않음) */
  function _setDraftContent(content: string) {
    if (!session.value) return;
    session.value.draftContent = content;
    if (session.value.versions.length === 0) {
      session.value.versions.push({
        version: session.value.currentVersion,
        content,
        createdAt: new Date().toISOString(),
        createdBy: 'AUTHOR',
      });
    }
  }

  /** 본문 내용 업데이트 (draftContent만 변경, 버전 스냅샷 보존) */
  function updateContent(content: string) {
    if (!session.value) return;
    if (viewingVersion.value && viewingVersion.value !== session.value.currentVersion) return;
    session.value.draftContent = content;
  }

  /** 검토요청 (draftContent를 스냅샷으로 찍어 새 버전 생성) */
  function submitForReview() {
    if (!session.value) return;
    const content = session.value.draftContent;
    const newVer = session.value.currentVersion === '0.00'
      ? '1.00'
      : nextVersion(session.value.currentVersion);

    session.value.versions.push({
      version: newVer,
      content,
      createdAt: new Date().toISOString(),
      createdBy: 'AUTHOR',
    });

    session.value.currentVersion = newVer;
    session.value.status = 'reviewing';

    session.value.reviewers.forEach(r => {
      r.status = 'pending';
      r.completedAt = undefined;
    });

    viewingVersion.value = null;
  }

  /** 코멘트 추가 (서버 API 연동) */
  async function addComment(
    comment: Omit<ReviewComment, 'id' | 'createdAt'>,
  ): Promise<ReviewComment | undefined> {
    if (!session.value) return;

    // useReviewCommentApi: /api/documents/{docMngNo}/review-comments POST 호출
    const api = useReviewCommentApi();
    // 현재 버전을 숫자형 docVrs로 변환 (예: "0.1" → 0.1)
    const docVrs = Number.parseFloat(session.value.currentVersion);

    // 서버에 저장 후 UI 타입으로 변환된 코멘트 반환
    const saved = await api.createComment(session.value.docMngNo, {
      docVrs,
      ivgTp: comment.type === 'inline' ? 'I' : 'G',
      ivgCone: comment.text,
      markId: comment.markId,
      qtdCone: comment.quotedText,
    });

    session.value.comments.push(saved);
    return saved;
  }

  /** 코멘트 해결 처리 (서버 API 연동) */
  async function resolveComment(commentId: string): Promise<void> {
    if (!session.value) return;

    // 서버에 rslvYn='Y'로 업데이트 후 로컬 상태 반영
    const api = useReviewCommentApi();
    await api.resolveComment(session.value.docMngNo, commentId);

    const comment = session.value.comments.find(c => c.id === commentId);
    if (comment) comment.resolved = true;
  }

  /** 검토완료 처리 */
  function completeReview(reviewerEno: string) {
    if (!session.value) return;
    const reviewer = session.value.reviewers.find(r => r.eno === reviewerEno);
    if (reviewer) {
      reviewer.status = 'completed';
      reviewer.completedAt = new Date().toISOString();
    }

    if (allReviewCompleted.value) {
      session.value.status = 'completed';
    }
  }

  /** 특정 버전 보기 (본문·코멘트 모두 해당 버전으로 갱신, null이면 현재 버전으로 복귀) */
  async function viewVersion(version: string | null) {
    viewingVersion.value = version;
    if (!session.value) return;

    // null이면 현재(최신) 버전으로 복귀
    const targetVersion = version ?? session.value.currentVersion;

    // 과거 버전 본문 온디맨드 조회
    if (version) {
      const ver = session.value.versions.find(v => v.version === version);
      if (ver && !ver.content) {
        try {
          const { $apiFetch } = useNuxtApp();
          const config = useRuntimeConfig();
          const base = `${config.public.apiBase}/api/documents`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = await ($apiFetch as any)<{ reqCone: string }>(
            `${base}/${session.value.docMngNo}?version=${parseFloat(version)}`,
          );
          ver.content = doc.reqCone ?? '';
        } catch {
          // 해당 버전 내용 조회 실패 시 빈 내용 유지
        }
      }
    }

    // 해당 버전의 코멘트 로드 (버전 복귀 시 현재 버전 코멘트로 재조회)
    try {
      const api = useReviewCommentApi();
      const comments = await api.fetchComments(session.value.docMngNo, parseFloat(targetVersion));
      session.value.comments = comments;
    } catch {
      session.value.comments = [];
    }
  }

  /** 활성 코멘트 설정 */
  function setActiveComment(commentId: string | null) {
    activeCommentId.value = commentId;
  }

  return {
    session,
    viewingVersion,
    activeCommentId,
    currentContent,
    sortedComments,
    inlineComments,
    allReviewCompleted,
    versionList,
    isViewingHistory,
    loadSession,
    _setDraftContent,
    updateContent,
    submitForReview,
    addComment,
    resolveComment,
    completeReview,
    viewVersion,
    setActiveComment,
  };
});
