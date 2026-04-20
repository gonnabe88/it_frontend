# 프로젝트 백로그 (Project Backlog)

> 마지막 갱신일: 2026-04-09

## 🔴 우선순위 높음

### 에러 처리 강화
- [x] `composables/useApiFetch.ts` — 네트워크 오류 시 사용자 친화적 에러 UI 제공
- [x] 전역 에러 핸들러 구현 (Nuxt `error.vue` 또는 에러 바운더리)

## 🟡 우선순위 중간

### 기능 개선
- [x] `pages/info/projects/form.vue` — 주관부문(`majorHdqs`) 목록을 하드코딩 배열에서 API 조회로 전환
- [ ] `components/common/EmployeeSearchDialog.vue` — 사원 이름 검색 기능 구현 (현재 부서 트리 선택 후 목록에서만 검색 가능)
- [ ] `pages/budget/index.vue` — 경상사업 카드의 "준비 중" 상태를 실제 기능으로 구현
- [ ] `pages/info/cost/form.vue` — 행 삭제 시 기존 DB 데이터에 대한 삭제 API 연동 정책 결정
- [x] `pages/info/cost/index.vue` — `filteredCosts` 실제 검색 기능 구현 (5개 필드 통합)

### 코드 품질
- [x] `pages/approval/index.vue` — 컴포넌트 분리 완료 (`ApprovalTimeline.vue`)
- [ ] `pages/info/projects/[id].vue` (769줄) — 섹션별 서브 컴포넌트 분리 검토
- [ ] `composables/usePdfReport.ts` (638줄) — PDF 빌더 패턴 도입 또는 모듈 분리 검토
- [ ] `pages/budget/list.vue` (560줄) — 탭별 콘텐츠를 별도 컴포넌트로 분리 검토
- [x] `components/TiptapEditor.vue` — 툴바 섹션, 표 조작 로직 분리 및 최적화
- [ ] `components/TiptapEditor.vue` — Excalidraw 디버그 `console.log` 제거 (상용 배포 전)
- [x] `pages/info/projects/form.vue` — 타입 안전한 방식으로 리팩토링 완료

### 타입 안전성
- [x] `pages/approval/index.vue` — `timelineApprovers` 전용 인터페이스 정의
- [x] `pages/info/projects/report.vue` — `onEmployeeSelect` 타입 명시 완료

## 🟢 우선순위 낮음

### UX 개선
- [x] 다크모드 전환 시 트랜지션 애니메이션 추가
- [ ] DataTable 페이지네이션 크기 사용자 설정 기능
- [ ] PDF 보고서 프리뷰 시 로딩 진행률 표시

### 인프라/DevOps
- [ ] 환경별(`.env.development`, `.env.production`) 설정 분리
- [x] E2E 테스트 환경 구축 및 안정화 완료 (Playwright)

---

## ✅ 완료 항목 (2026-04-09)

| 항목 | 완료일 |
|------|--------|
| Playwright E2E 테스트 안정화 및 API 모킹 개선 | 2026-04-02 |
| Tiptap 수식 지원, 표 정렬, 파일첨부 다이얼로그 연동 | 2026-03-30 |
| 프로젝트 작성 폼 UX 검증 및 다크모드 대응 개선 | 2026-03-28 |
| 전체 소스 코드 주석 리프레시 (E2E 테스트 포함) | 2026-04-09 |
| README.md / TASK.md 최신 정보 업데이트 | 2026-04-09 |
| `app.vue` — 전역 `<Toast />` 컴포넌트 추가 | 2026-03-02 |
| `pages/info/projects/[id].vue` — 삭제 실패 시 Toast 표시 | 2026-03-02 |
| `composables/useApprovals.ts` — API 응답 `any` → 명시적 인터페이스 | 2026-03-02 |
| `composables/usePdfReport.ts` — `any[]` → `ProjectDetail[]` 타입 명시 | 2026-03-02 |
| `pages/info/projects/form.vue` — `resourceItems: any[]` → `ResourceItem` 인터페이스 | 2026-03-04 |
| `components/common/EmployeeSearchDialog.vue` — `computed` import 누락 수정 | 2026-03-04 |
| `components/RichEditor.vue` — IME 이벤트 리스너 메모리 누수 수정 | 2026-03-04 |
| `components/RichEditor.vue` — 중복 조건 단순화 | 2026-03-04 |
| `pages/info/projects/form.vue` — `employeeDialogHeader` computed 전환 | 2026-03-04 |
| `pages/info/projects/form.vue` — switch → FIELD_CONFIG 맵 리팩토링 | 2026-03-04 |
| 사이드바 축소 상태 localStorage 영구 저장 | 2026-03-02 |
| `composables/useApiFetch.ts` — 네트워크/서버 오류 Toast UI (403·404·5xx·연결오류) | 2026-03-05 |
| `app/error.vue` — 전역 에러 핸들러 페이지 신규 생성 | 2026-03-05 |
| `pages/info/projects/form.vue` — `(form.value as any)` 타입 단언 → 타입 안전 setter 맵 | 2026-03-05 |
| `pages/approval/index.vue` — `timelineApprovers` `TimelineApprover` 인터페이스 정의 | 2026-03-05 |
| `pages/info/projects/report.vue` — `onEmployeeSelect` `any` → `EmployeeSelectResult` 타입 명시 | 2026-03-05 |
| `pages/info/cost/index.vue` — `filteredCosts` 실제 검색 기능 구현 (5개 필드 통합) | 2026-03-05 |
| `stores/auth.ts` — localStorage 토큰 저장 → httpOnly Cookie 전환 | 2026-03-04 |
| Rich Text 입력 필드 서버 측 XSS 필터링 추가 (jsoup) | 2026-03-04 |
| `pages/info/projects/form.vue` — 주관부문·주관부서·IT부서 담당팀장 선택 시 `/api/users/{eno}` API 자동 세팅 | 2026-03-08 |
| `components/AppHeader.vue` + `main.css` — View Transition API 기반 애니메이션 | 2026-03-08 |
| `pages/approval/index.vue` — 결재 타임라인 `ApprovalTimeline.vue` 컴포넌트 분리 (110줄 감소) | 2026-03-08 |

| 전체 소스 코드 주석 전수 점검 (60개 파일) — 한글 JSDoc/인라인 주석 표준 충족 확인 | 2026-03-25 |
| `README.md` 최신화 — Tiptap/Excalidraw/HWPX/GeminiChat, httpOnly 쿠키 인증, 새 모듈 반영 | 2026-03-25 |
| E2E 테스트 안정화 및 API 모킹 개선 사항 반영 | 2026-04-02 |
| Tiptap 수식 지원, 표 정렬, 파일첨부 다이얼로그 연동 등 컴포넌트 완성 | 2026-03-30 |
| 프로젝트 작성 폼 UX 검증 및 다크모드 대응 개선 완료 | 2026-03-28 |
