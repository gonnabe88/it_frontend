# 정보화실무협의회 Planning Document

> **Summary**: 소관부서 담당자의 타당성검토표 작성부터 IT관리자의 협의회 운영, 평가위원의 의견 작성까지 정보화실무협의회 전 과정을 온라인으로 처리하는 기능
>
> **Project**: IT Portal System (IT 포털 시스템)
> **Version**: 1.0.0
> **Author**: ssuno
> **Date**: 2026-03-31
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 정보화실무협의회 관련 타당성검토표 작성, 평가위원 선정, 일정 취합, 협의회 개최 등 전 과정이 오프라인/수작업으로 진행되어 업무 효율이 낮고 이력 추적이 어렵다 |
| **Solution** | IT 포털 내 `/council` 메뉴를 신설하여 타당성검토표 작성(소관부서) → 팀장 결재 → 평가위원 선정/일정취합(IT관리자) → 평가의견 작성 → 결과서 결재까지 전 과정을 시스템화 |
| **Function/UX Effect** | 권한별(일반사용자/IT관리자/평가위원) 맞춤 화면으로 각 단계 진행상태를 실시간 확인 가능하며, 사업별 협의회 진행 이력이 자동 누적된다 |
| **Core Value** | IT업무지침 제7조 준수를 시스템으로 보장하고, 협의회 전 과정의 디지털화로 행정 부담을 절감한다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 오프라인/수작업 협의회 운영의 비효율 해소 및 IT업무지침 제7조 준수 보장 |
| **WHO** | 소관부서 담당자(타당성검토표 작성), IT관리자(협의회 운영), 평가위원(의견 작성), 팀장(결재) |
| **RISK** | 복잡한 상태 전이(작성중→작성완료→결재→평가→완료), 평가위원 자동매핑 데이터 의존성 |
| **SUCCESS** | Step 1~3 전 과정 온라인 처리 가능, 사업별 진행상태 실시간 조회, 기존 프로젝트/사용자 데이터 정상 연동 |
| **SCOPE** | 1차: 일반 사용자 흐름(Step 1~3) / Out of Scope: 2차 개발(관리자 중장기계획), 메일 알림, 그룹웨어 전자결재 연동 |

---

## 1. Overview

### 1.1 Purpose

IT업무지침 제7조(정보화실무협의회) 및 제44조(타당성 검토)에 따른 협의회 업무 전 과정을 IT 포털에서 처리할 수 있도록 한다. 소관부서 담당자의 타당성검토표 작성부터 IT관리자의 협의회 개최 준비, 평가위원의 평가의견 작성, 결과서 결재까지 단일 메뉴에서 완결한다.

### 1.2 Background

현재 정보화포털에 `정보화실무협의회 신청` 메뉴가 존재하나, 협의회 운영 전 과정을 커버하지 못하고 있다. IT업무지침 제7조 제1항 제3·4·5호 대상 사업의 타당성 검토 절차를 시스템화하여 행정 효율을 높이고 이력 관리를 강화한다.

### 1.3 Related Documents

- 근거: IT업무지침 제7조(정보화실무협의회), 제44조(타당성 검토)
- 참고: `# 설계 학습자료_260331.md`
- 현행 메뉴: 정보화포털 > 정보화사업 > 정보화실무협의회 신청

---

## 2. Scope

### 2.1 In Scope (1차 개발)

**Step 1. 타당성검토표 작성 (소관부서 담당자)**
- [ ] 접속자 소속부서 기준 사업명 목록 표출 (프로젝트 테이블 주관부서 매핑)
- [ ] 사업별 정보화실무협의회 진행상태 표출 (타당성검토표 작성중/완료, 협의회 개최준비/완료)
- [ ] 타당성검토표 작성 폼 (사업개요 8항목, 타당성 자체점검 6항목, 성과관리 자체계획)
- [ ] 성과지표 동적 추가/삭제 (기본 1개, 사용자가 추가 가능)
- [ ] 임시저장 / 작성완료 버튼
- [ ] 사업계획서 첨부파일 (hwp, hwpx, pdf 필수)
- [ ] 작성완료 후 팀장 결재 프로세스 (전자결재 연동은 추후, 포털 내 결재로 구현)

**Step 2. 협의회 개최 준비 (IT관리자)**
- [ ] 타당성검토표 작성완료(+결재완료) 사업 목록 표출
- [ ] 심의 유형 선택 (정보시스템/정보보호/기타) → 당연위원 자동 매핑
- [ ] 소집위원 및 간사 추가 (직원검색 팝업)
- [ ] 평가위원 확정 / 수정 기능
- [ ] 일정 취합 (평가위원선정일로부터 2주 이내 평일, 10·14·15·16시 중 선택)
- [ ] 평가위원 일정 입력 현황 조회, 일정 확정 (회의장소 포함)
- [ ] 일정공지 화면 (안건, 회의개요, 진행순서, 관련자료)
- [ ] 사전질의응답 (참석위원 질의 작성 → 추진부서 담당자 답변)

**Step 3. 협의회 개최 (평가위원/IT관리자)**
- [ ] 평가의견 작성 (타당성 점검 6항목 점수 + 타당성 검토 의견)
- [ ] 결과서 작성 (IT기획부 담당자, 1page: 일정공지 내용, 2page: 평균점수/종합의견)
- [ ] 결과서 검토 확인 (평가위원 확인 버튼)
- [ ] 결과보고 결재 (IT기획팀장 → IT기획부장, 포털 내 결재)
- [ ] 결과 통보 (추진부서 담당자 완료 확인)

**백엔드 API**
- [ ] 타당성검토표 CRUD API (`/api/council/feasibility`)
- [ ] 성과지표 CRUD API (`/api/council/feasibility/performance`)
- [ ] 평가위원 관리 API (`/api/council/committee`)
- [ ] 일정 취합 API (`/api/council/schedule`)
- [ ] 사전질의응답 API (`/api/council/qna`)
- [ ] 평가의견 API (`/api/council/evaluation`)
- [ ] 결과서 API (`/api/council/result`)
- [ ] 결재 처리 API (기존 전자결재 모듈 활용)

### 2.2 Out of Scope

- 2차 개발: 관리자 흐름 (매년도 정보기술부문계획, 중장기 정보화 전략계획)
- 메일 알림 발송 (추후 개발)
- 그룹웨어 전자결재 시스템 연동 (추후 결정)
- 소요예산에 따른 전결권자 자동 산출 (추후 개발)
- 실무협의회 생략 여부 자동 판단 (제44조 제3항 조건)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 접속자 소속부서(BBR_C)와 프로젝트 테이블의 주관부서 일치 사업만 표출 | High | Pending |
| FR-02 | 타당성검토표 임시저장 (언제든지 이어서 작성 가능) | High | Pending |
| FR-03 | 타당성검토표 작성완료 시 상태 전이 및 팀장 결재 요청 | High | Pending |
| FR-04 | 사업계획서 첨부파일 필수 (hwp, hwpx, pdf만 허용) | High | Pending |
| FR-05 | 심의 유형 선택에 따른 당연위원 자동 매핑 (직원정보 테이블 TEM_C, PT_C 기준) | High | Pending |
| FR-06 | 직원검색 팝업으로 소집위원/간사 추가 | Medium | Pending |
| FR-07 | 평가위원 일정 입력 (평가위원선정일+2주 이내 평일, 4개 시간대 중 선택) | High | Pending |
| FR-08 | 평가위원 전원 일정 입력 완료 시 IT관리자에게 일정확정 버튼 활성화 | Medium | Pending |
| FR-09 | 일정공지 화면 (안건/회의개요/진행순서/관련자료) | Medium | Pending |
| FR-10 | 사전질의응답 (참석위원 질의 → 추진부서 답변) | Medium | Pending |
| FR-11 | 평가의견 작성 (타당성 점검 6항목, 1~2점 시 검토의견 필수) | High | Pending |
| FR-12 | 결과서 2page: 전체 평가위원 점수 평균 자동 계산 | High | Pending |
| FR-13 | 결과서 검토: 평가위원 전원 확인 버튼 클릭 필요 | Medium | Pending |
| FR-14 | 결과보고 결재 (IT기획팀장 → IT기획부장 순차 결재) | High | Pending |
| FR-15 | 전 단계 진행상태 사업 목록에서 실시간 표출 | Medium | Pending |
| FR-16 | 성과지표 동적 추가/삭제 (최소 1개 필수) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | 기준 | 측정방법 |
|----------|------|---------|
| 성능 | 사업목록 조회 응답 < 1초 | 브라우저 Network 탭 |
| 보안 | 타인 부서 데이터 접근 불가 (소속부서 기준 필터) | 수동 테스트 |
| 보안 | 파일 업로드 확장자 검증 (hwp, hwpx, pdf) | 수동 테스트 |
| 권한 | ITPAD001(관리자)만 Step 2 화면 접근 | 수동 테스트 |
| 접근성 | 기존 포털 UI 일관성 유지 (PrimeVue Aura Theme) | UI 리뷰 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01~FR-16 모든 기능 요구사항 구현 완료
- [ ] 소관부서 담당자 → 팀장 결재 → IT관리자 → 평가위원 → IT관리자 결재까지 E2E 흐름 동작
- [ ] 기존 프로젝트 테이블, 사용자 테이블 데이터 정상 연동 확인
- [ ] 파일 업로드/다운로드 정상 동작 (hwp, hwpx, pdf)
- [ ] 단위 테스트 작성 (핵심 서비스 로직)

### 4.2 Quality Criteria

- [ ] 빌드 성공 (`npm run build`, `./gradlew build`)
- [ ] 기존 테스트 전부 통과 (`npm test`, `./gradlew test`)
- [ ] TypeScript 오류 없음
- [ ] 한글 주석 필수 (CLAUDE.md 4.1 준수)

---

## 5. Risks and Mitigation

| 리스크 | 영향도 | 발생가능성 | 대응방안 |
|--------|--------|-----------|---------|
| 복잡한 상태 전이 구현 (작성중→완료→결재→평가→결과→완료) | High | High | 상태 Enum 중앙화, 상태 전이표 설계 문서화 |
| 당연위원 자동매핑 데이터 없음 (TEM_C·PT_C 해당자 없을 경우) | Medium | Medium | 해당자 없음 표출 + 수동 추가 허용 |
| 팀장 결재 기능: 기존 전자결재 모듈과의 통합 복잡성 | High | Medium | 기존 ApplicationController/전자결재 흐름 사전 분석 |
| 평가위원 일정 취합 UI 복잡성 (다수 위원 × 다수 날짜) | Medium | High | 달력형 UI 대신 날짜 목록 체크박스 방식 채택 |
| 성과지표 동적 추가/삭제 데이터 모델 | Low | Medium | 1:N 별도 테이블로 설계 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | 변경 내용 |
|----------|------|---------|
| 프로젝트 테이블 (BPROJM 등) | DB (READ) | 사업명/주관부서 조회용 READ 추가 |
| 사용자 테이블 (TAAABB_CUSERI) | DB (READ) | 당연위원 자동매핑, 직원검색 팝업 READ 추가 |
| 파일 관리 테이블 (CFILEM) | DB (READ/WRITE) | 타당성검토표 첨부파일, 관련자료 파일 업로드 |
| 전자결재 모듈 (ApplicationController) | API (연동) | 팀장 결재, 결과보고 결재 요청 |
| council 신규 테이블 (다수) | DB (CREATE) | 타당성검토표, 성과지표, 평가위원, 일정, QnA, 평가의견, 결과서 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| 프로젝트 테이블 | READ | `composables/useProjects.ts` → `/api/projects` | None (추가 조회만) |
| 사용자 테이블 | READ | `composables/useOrganization.ts` → `/api/users` | None (추가 조회만) |
| 파일 모듈 | WRITE | `infra/file/FileController` → `/api/files` | None (기존 업로드 API 재사용) |
| 전자결재 | WRITE | `common/approval/ApplicationController` | 검토 필요 (결재 흐름 분석 후 확정) |

### 6.3 Verification

- [ ] 기존 프로젝트 목록/상세 페이지 정상 동작 유지
- [ ] 기존 파일 업로드 기능 정상 동작 유지
- [ ] 기존 전자결재 흐름 영향 없음 확인

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | 특징 | 적합 대상 | 선택 |
|-------|------|---------|:----:|
| **Starter** | 단순 구조 | 정적 사이트 | ☐ |
| **Dynamic** | 기능 모듈 기반, BaaS 연동 | 웹앱, 풀스택 | ☑ |
| **Enterprise** | 엄격한 레이어 분리 | 대규모 시스템 | ☐ |

→ **Dynamic** 선택: 기존 프로젝트 구조와 동일

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Nuxt 4 | Nuxt 4 | 기존 프로젝트와 동일 |
| 상태관리 | Pinia | Pinia | 기존 프로젝트와 동일 |
| API Client | useApiFetch / $apiFetch | 기존 패턴 유지 | CLAUDE.md 4.2 준수 |
| 스타일링 | PrimeVue + Tailwind | PrimeVue + Tailwind | 기존 UI 일관성 |
| 백엔드 구조 | 도메인 기반 패키지 | `domain/council/` 신설 | 기존 `domain/budget/` 패턴 동일하게 |
| DB 설계 | JPA Entity | JPA + Oracle 21c | 기존 프로젝트와 동일 |

### 7.3 폴더 구조 (신규 추가)

```
it_frontend/app/
└── pages/
    └── info/
        └── council/               ← 신규
            ├── index.vue          (사업목록 + 진행상태)
            ├── [id].vue           (타당성검토표 작성/조회)
            ├── prepare/
            │   └── [id].vue       (협의회 개최준비 - IT관리자)
            └── result/
                └── [id].vue       (협의회 개최 - 평가의견/결과서)

it_backend/src/main/java/com/kdb/it/
└── domain/
    └── council/                   ← 신규
        ├── controller/
        │   └── CouncilController.java
        ├── service/
        │   └── CouncilService.java
        ├── repository/
        ├── entity/
        │   ├── Basctm.java        (협의회 기본정보 Master)
        │   ├── Brevwm.java        (타당성검토표 Review Master)
        │   ├── Bperfm.java        (성과지표 Performance Master)
        │   ├── Bcmmtm.java        (평가위원 Committee Master)
        │   ├── Bschdm.java        (일정 Schedule Master)
        │   ├── Bpqnam.java        (사전질의응답 Pre-Qna Master)
        │   ├── Bevalm.java        (평가의견 Eval Opinion Master)
        │   └── Brsltm.java        (결과서 Result Master)
        └── dto/
            └── CouncilDto.java
```

---

## 8. API 설계 (개요)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/council` | 내 부서 사업목록 + 협의회 진행상태 | ITPZZ001+ |
| POST | `/api/council/{projectId}/feasibility` | 타당성검토표 저장(임시/완료) | ITPZZ001 |
| GET | `/api/council/{councilId}/feasibility` | 타당성검토표 조회 | ITPZZ001+ |
| POST | `/api/council/{councilId}/committee` | 평가위원 선정 | ITPAD001 |
| GET | `/api/council/{councilId}/committee/default` | 심의유형별 당연위원 조회 | ITPAD001 |
| POST | `/api/council/{councilId}/schedule` | 일정 입력 (평가위원) | 위원 |
| PUT | `/api/council/{councilId}/schedule/confirm` | 일정 확정 (IT관리자) | ITPAD001 |
| POST | `/api/council/{councilId}/qna` | 사전질의 등록/답변 | ITPZZ001+ |
| POST | `/api/council/{councilId}/evaluation` | 평가의견 작성 | 위원 |
| POST | `/api/council/{councilId}/result` | 결과서 작성 | ITPAD001 |
| PUT | `/api/council/{councilId}/result/confirm` | 결과서 확인 (평가위원) | 위원 |

---

## 9. Convention Prerequisites

### 9.1 Existing Project Conventions

- [x] `CLAUDE.md` 코딩 컨벤션 존재
- [x] TypeScript (`tsconfig.json`) 존재
- [x] 한글 주석 필수 (CLAUDE.md 4.1)
- [x] `<script setup lang="ts">` 구조 필수
- [x] `useApiFetch` / `$apiFetch` 패턴 (CLAUDE.md 4.2)
- [x] `isomorphic-dompurify` v-html 보안 (CLAUDE.md 4.4)

### 9.2 추가 환경변수

신규 환경변수 불필요 — 기존 `NUXT_PUBLIC_API_BASE` 재사용

---

## 10. DB 스키마 설계 (개요)

### 주요 테이블

| 테이블명 | 설명 | 핵심 컬럼 |
|---------|------|---------|
| `TAAABB_BASCTM` | 협의회 기본정보 | ASCT_ID(PK), PRJ_ID(FK), ASCT_STS(상태), DBR_TP(심의유형) |
| `TAAABB_BPOVWM` | 타당성검토표 | ASCT_ID(FK), PRJ_NM, PRJ_TRM, NCS_MTA, SRP_BDT, DCS_YN, XPT_EFF, KPN_TP(임시/완료) |
| `TAAABB_BCHKLC` | 타당성 자체점검 | ASCT_ID(FK), CKG_ITM_C(점검항목코드), CKG_CONE(점검내용), CKG_RCRD(점수1~5) |
| `TAAABB_BPERFM` | 성과지표 | ASCT_ID(FK), DTP_SNO(순번), DTP_NM, DTP_CONE, MSM_MANR, MSM_STT_DT, MSM_END_DT, MSM_CYC |
| `TAAABB_BCMMTM` | 평가위원 | ASCT_ID(FK), ENO(FK), CM_TP(당연/소집/간사), USE_YN |
| `TAAABB_BSCHDM` | 일정 | ASCT_ID(FK), ENO(FK), DSD_DT, DSD_TM, PSB_YN(가능여부) |
| `TAAABB_BPQNAM` | 사전질의응답 | ASCT_ID(FK), QNA_SNO, QTN_ENO(FK), QTN_CONE, REP_ENO(FK), REP_CONE |
| `TAAABB_BEVALM` | 평가의견 | ASCT_ID(FK), ENO(FK), CKG_ITM_C, CKG_RCRD, CKG_OPNN |
| `TAAABB_BRSLTM` | 결과서 | ASCT_ID(FK), SYN_OPNN, CKG_OPNN, DWU_STS |

### 협의회 상태 전이

```
DRAFT(작성중) → SUBMITTED(작성완료) → APPROVAL_PENDING(결재대기)
→ APPROVED(결재완료) → PREPARING(개최준비) → SCHEDULED(일정확정)
→ IN_PROGRESS(진행중) → EVALUATING(평가중) → RESULT_WRITING(결과서작성)
→ RESULT_REVIEW(결과서검토) → FINAL_APPROVAL(결과결재) → COMPLETED(완료)
```

---

## 11. Next Steps

1. [ ] Design 문서 작성 (`/pdca design council`)
2. [ ] DB 테이블 DDL 작성 및 생성
3. [ ] 백엔드 Entity/Repository/Service/Controller 구현
4. [ ] 프론트엔드 페이지/컴포넌트 구현
5. [ ] E2E 테스트 (소관부서→결재→관리자→평가위원→완료 흐름)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-31 | Initial draft (IT업무지침 제7조 기반, 1차 개발 스코프) | ssuno |
