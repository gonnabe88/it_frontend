# IT Portal - 프로젝트 개선 과제 (Backlog)

> 코드 리뷰 및 문서화 작업 중 식별된 개선 과제 목록입니다.

## 🔴 우선순위 높음

### 보안 개선
- [ ] `stores/auth.ts` - localStorage에 토큰 직접 저장 방식을 httpOnly Cookie로 전환 검토
- [ ] Rich Text 입력 필드 서버 측 XSS 필터링 추가 (현재 클라이언트 DOMPurify만 적용)

### 에러 처리 강화
- [ ] `pages/info/projects/[id].vue` - 삭제 실패 시 Toast 메시지 표시 (현재 console.error만 출력)
- [ ] `composables/useApiFetch.ts` - 네트워크 오류 시 사용자 친화적 에러 UI 제공
- [ ] 전역 에러 핸들러 구현 (Nuxt error.vue 또는 에러 바운더리)

## 🟡 우선순위 중간

### 기능 개선
- [ ] `pages/audit/index.vue` - 현재 정적 더미 데이터 → API 연동 필요
- [ ] `pages/info/projects/form.vue` - 부서 목록을 하드코딩 배열에서 API 조회로 전환
- [ ] `components/common/EmployeeSearchDialog.vue` - 사원 검색 기능 구현 (현재 부서 트리 선택만 가능)
- [ ] `pages/budget/index.vue` - 경상사업 카드의 "준비 중" 상태를 실제 기능으로 구현
- [ ] `pages/info/cost/form.vue` - 행 삭제 시 기존 DB 데이터에 대한 삭제 API 연동 정책 결정

### 코드 품질
- [ ] `pages/approval/index.vue` (494줄) - 컴포넌트 분리 검토 (타임라인, 결재 목록, 상세)
- [ ] `pages/info/projects/[id].vue` (769줄) - 섹션별 서브 컴포넌트 분리 검토
- [ ] `composables/usePdfReport.ts` (638줄) - PDF 빌더 패턴 도입 또는 모듈 분리 검토
- [ ] `pages/budget/list.vue` (560줄) - 탭별 콘텐츠를 별도 컴포넌트로 분리 검토

### 타입 안전성
- [ ] `composables/useApprovals.ts` - API 응답에 `any` 타입 사용 → 명시적 응답 인터페이스 정의
- [ ] `composables/usePdfReport.ts` - `any[]` 대신 `ProjectDetail[]` 타입 명시
- [ ] `pages/info/projects/form.vue` - `resourceItems: any[]` → 전용 인터페이스 정의

## 🟢 우선순위 낮음

### UX 개선
- [ ] 다크모드 전환 시 트랜지션 애니메이션 추가
- [ ] DataTable 페이지네이션 크기 사용자 설정 기능
- [ ] 사이드바 축소 상태를 localStorage에 영구 저장 (현재 새로고침 시 초기화)
- [ ] PDF 보고서 프리뷰 시 로딩 진행률 표시

### 인프라/DevOps
- [ ] 환경별(.env.development, .env.production) 설정 분리
- [ ] CI/CD 파이프라인 구성 (빌드 + 배포 자동화)
- [ ] E2E 테스트 환경 구축 (Playwright 또는 Cypress)
