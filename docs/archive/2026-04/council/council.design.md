# 정보화실무협의회 Design Document

> **Project**: IT Portal System
> **Feature**: council
> **Author**: ssuno
> **Date**: 2026-03-31
> **Status**: Draft
> **Architecture**: Option B — Clean Architecture

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 오프라인/수작업 협의회 운영의 비효율 해소 및 IT업무지침 제7조 준수 보장 |
| **WHO** | 소관부서 담당자(타당성검토표 작성), IT관리자(협의회 운영), 평가위원(의견 작성), 팀장(결재) |
| **RISK** | 복잡한 상태 전이(12단계), 평가위원 자동매핑 데이터 의존성, 전자결재 모듈 통합 복잡성 |
| **SUCCESS** | Step 1~3 전 과정 온라인 처리, 사업별 진행상태 실시간 조회, 기존 데이터 정상 연동 |
| **SCOPE** | 1차: 일반 사용자 흐름(Step 1~3) / Out: 메일 알림, 그룹웨어 연동, 2차 개발 |

---

## 1. Overview

### 1.1 Architecture Decision

**Option B — Clean Architecture** 채택

Step별로 서비스를 분리하여 각 도메인 책임을 명확히 한다:
- `CouncilService`: 협의회 목록 조회, 상태 전이 관리
- `FeasibilityService`: 타당성검토표 CRUD (Step 1)
- `CommitteeService`: 평가위원 선정/관리 (Step 2)
- `ScheduleService`: 일정 취합/확정 (Step 2)
- `EvaluationService`: 평가의견 작성 (Step 3)
- `ResultService`: 결과서 작성/검토/결재 (Step 3)

### 1.2 Architecture Option Comparison

| 항목 | A (Minimal) | B (Clean) ✅ | C (Pragmatic) |
|------|------------|------------|--------------|
| 파일 수 | 적음 | 많음 | 중간 |
| 유지보수 | 어려움 | 쉬움 | 보통 |
| 테스트 용이성 | 낮음 | 높음 | 보통 |
| 기존 패턴 유사도 | 높음 | 중간 | 높음 |
| 초기 구현 속도 | 빠름 | 느림 | 보통 |

---

## 2. Backend Architecture

### 2.1 패키지 구조

```
it_backend/src/main/java/com/kdb/it/
└── domain/
    └── council/
        ├── controller/
        │   └── CouncilController.java          // 전체 API 엔드포인트
        ├── service/
        │   ├── CouncilService.java             // 협의회 목록 조회, 상태 전이
        │   ├── FeasibilityService.java         // 타당성검토표 CRUD (Step 1)
        │   ├── CommitteeService.java           // 평가위원 선정/관리 (Step 2)
        │   ├── ScheduleService.java            // 일정 취합/확정 (Step 2)
        │   ├── EvaluationService.java          // 평가의견 작성 (Step 3)
        │   └── ResultService.java              // 결과서 작성/검토/결재 (Step 3)
        ├── repository/
        │   ├── CouncilRepository.java          // TAAABB_BASCTM
        │   ├── ProjectOverviewRepository.java      // TAAABB_BPOVWM
        │   ├── FeasibilityCheckRepository.java // TAAABB_BCHKLC
        │   ├── PerformanceRepository.java      // TAAABB_BPERFM
        │   ├── CommitteeRepository.java        // TAAABB_BCMMTM
        │   ├── ScheduleRepository.java         // TAAABB_BSCHDM
        │   ├── QnaRepository.java              // TAAABB_BPQNAM
        │   ├── EvaluationRepository.java       // TAAABB_BEVALM
        │   └── ResultRepository.java           // TAAABB_BRSLTM
        ├── entity/
        │   ├── Basctm.java                     // 협의회 기본정보 Master
        │   ├── Bpovwm.java                     // 협의회 사업개요 Project Overview Master
        │   ├── Bchklc.java                     // 타당성 자체점검 Checklist
        │   ├── Bperfm.java                     // 성과지표 Performance Master
        │   ├── Bcmmtm.java                     // 평가위원 Committee Master
        │   ├── Bschdm.java                     // 일정 Schedule Master
        │   ├── Bpqnam.java                     // 사전질의응답 Pre-Qna Master
        │   ├── Bevalm.java                     // 평가의견 Eval Opinion Master
        │   └── Brsltm.java                     // 결과서 Result Master
        └── dto/
            └── CouncilDto.java                 // 전체 DTO 중앙 관리
```

### 2.2 Entity 상세 설계

#### Basctm (협의회 기본정보)
```java
// TAAABB_BASCTM
@Table(name = "TAAABB_BASCTM")
public class Basctm extends BaseEntity {
    @Id
    @Column(name = "ASCT_ID", length = 32)      // 협의회ID: CNCL-{연도}-{4자리} 형식
    private String cnclId;

    @Column(name = "PRJ_MNG_NO", length = 32)   // 프로젝트관리번호 (FK → TAAABB_BPROJM)
    private String prjMngNo;

    @Column(name = "PRJ_SNO")                   // 프로젝트순번 (FK)
    private Integer prjSno;

    @Column(name = "ASCT_STS", length = 20)     // 협의회상태 (Enum: DRAFT~COMPLETED)
    private String asctSts;

    @Column(name = "DBR_TP", length = 20)       // 심의유형 (INFO_SYS/INFO_SEC/ETC)
    private String dbrTp;

    @Column(name = "CNRC_DT")                    // 회의일자
    private LocalDate cnrcDt;

    @Column(name = "CNRC_TM", length = 10)       // 회의시간 (10:00/14:00/15:00/16:00)
    private String cnrcTm;

    @Column(name = "CNRC_PLC", length = 200)    // 회의장소
    private String cnrcPlc;
}
```

#### Bpovwm (협의회 사업개요)
```java
// TAAABB_BPOVWM
@Table(name = "TAAABB_BPOVWM")
public class Bpovwm extends BaseEntity {
    @Id
    @Column(name = "ASCT_ID", length = 32)      // 협의회ID (FK → BASCTM, 1:1)
    private String asctId;

    @Column(name = "PRJ_NM", length = 200)      // 사업명 (수정 가능)
    private String prjNm;

    @Column(name = "PRJ_TRM", length = 100)     // 사업기간
    private String prjTrm;

    @Column(name = "NCS", length = 1000)         // 필요성 (BPROJM.NCS 동일)
    private String ncs;

    @Column(name = "PRJ_BG")                    // 소요예산 (BPROJM.PRJ_BG 동일)
    private Long prjBg;

    @Column(name = "EDRT", length = 32)         // 전결권자 (BPROJM.EDRT 동일)
    private String edrt;

    @Column(name = "PRJ_DES", length = 1000)    // 사업내용 (BPROJM.PRJ_DES 동일)
    private String prjDes;

    @Column(name = "LGL_RGL_YN", length = 1)    // 법률규제대응여부 (Y/N)
    private String lglRglYn;

    @Column(name = "LGL_RGL_NM", length = 500)  // 관련법률규제명
    private String lglRglNm;

    @Column(name = "XPT_EFF", length = 1000)    // 기대효과 (BPROJM.XPT_EFF 동일)
    private String xptEff;

    @Column(name = "KPN_TP", length = 10)      // 저장유형 (TEMP/COMPLETE)
    private String kpnTp;

    @Column(name = "FL_MNG_NO", length = 32)    // 첨부파일관리번호 (FK → TAAABB_CFILEM)
    private String flMngNo;
}
```

#### Bchklc (타당성 자체점검)
```java
// TAAABB_BCHKLC — 6개 고정 항목, 1:N (ASCT_ID + CKG_ITM_C 복합키)
@Table(name = "TAAABB_BCHKLC")
public class Bchklc extends BaseEntity {
    @EmbeddedId
    private BchklcId id;                        // 복합키: ASCT_ID + CKG_ITM_C

    @Column(name = "CKG_CONE", length = 2000)   // 점검내용 (텍스트 입력)
    private String ckgCone;

    @Column(name = "CKG_RCRD")                   // 점검점수 (1~5)
    private Integer ckgRcrd;
}
// 점검항목코드(CKG_ITM_C): MGMT_STR / FIN_EFC / RISK_IMP / REP_IMP / DUP_SYS / ETC
```

#### Bperfm (성과지표)
```java
// TAAABB_BPERFM — 1:N (ASCT_ID + DTP_SNO 복합키)
@Table(name = "TAAABB_BPERFM")
public class Bperfm extends BaseEntity {
    @EmbeddedId
    private BperfmId id;                        // 복합키: ASCT_ID + DTP_SNO

    @Column(name = "DTP_NM", length = 200)       // 성과지표명
    private String dtpNm;

    @Column(name = "DTP_CONE", length = 1000)    // 성과지표정의
    private String dtpCone;

    @Column(name = "MSM_MANR", length = 1000)    // 측정방법
    private String msmManr;

    @Column(name = "CLF", length = 1000)         // 산식
    private String clf;

    @Column(name = "GL_NV", length = 200)        // 목표치
    private String glNv;

    @Column(name = "MSM_STT_DT")                 // 측정시작일
    private LocalDate msmSttDt;

    @Column(name = "MSM_END_DT")                 // 측정종료일
    private LocalDate msmEndDt;

    @Column(name = "MSM_TPM", length = 100)      // 측정시점
    private String msmTpm;

    @Column(name = "MSM_CLE", length = 100)      // 측정주기
    private String msmCle;
}
```

#### Bcmmtm (평가위원)
```java
// TAAABB_BCMMTM — 1:N (ASCT_ID + ENO 복합키)
@Table(name = "TAAABB_BCMMTM")
public class Bcmmtm extends BaseEntity {
    @EmbeddedId
    private BcmmtmId id;                        // 복합키: ASCT_ID + ENO

    @Column(name = "VLR_TP", length = 32)       // 위원유형 (MAND/CALL/SECR: 당연/소집/간사, CCODEM VLR_TP)
    private String vlrTp;

}
```

#### Bschdm (일정)
```java
// TAAABB_BSCHDM — 1:N (ASCT_ID + ENO + DSD_DT + DSD_TM 복합키)
@Table(name = "TAAABB_BSCHDM")
public class Bschdm extends BaseEntity {
    @EmbeddedId
    private BschdmId id;                        // 복합키: ASCT_ID + ENO + DSD_DT + DSD_TM

    @Column(name = "PSB_YN", length = 1)        // 가능여부 (Y/N)
    private String psbYn;
}
```

#### Bpqnam (사전질의응답)
```java
// TAAABB_BPQNAM — 1:N
@Table(name = "TAAABB_BPQNAM")
public class Bpqnam extends BaseEntity {
    @Id
    @Column(name = "QTN_ID", length = 32)       // 질의응답ID (PK)
    private String qtnId;

    @Column(name = "ASCT_ID", length = 32)      // 협의회ID (FK)
    private String cnclId;

    @Column(name = "QTN_ENO", length = 32)      // 질의자사번 (FK → CUSERI)
    private String qtnEno;

    @Column(name = "QTN_CONE", length = 4000)   // 질의내용
    private String qtnCone;

    @Column(name = "REP_ENO", length = 32)      // 답변자사번 (FK → CUSERI)
    private String repEno;

    @Column(name = "REP_CONE", length = 4000)   // 답변내용
    private String repCone;

    @Column(name = "REP_YN", length = 1)        // 답변여부 (Y/N)
    private String repYn;
}
```

#### Bevalm (평가의견)
```java
// TAAABB_BEVALM — 1:N (ASCT_ID + ENO + CKG_ITM_C 복합키)
@Table(name = "TAAABB_BEVALM")
public class Bevalm extends BaseEntity {
    @EmbeddedId
    private BevalmId id;                        // 복합키: ASCT_ID + ENO + CKG_ITM_C

    @Column(name = "CKG_RCRD")                   // 점검점수 (1~5)
    private Integer ckgRcrd;

    @Column(name = "CKG_OPNN", length = 2000)    // 점검의견 (1~2점 시 필수)
    private String ckgOpnn;
}
```

#### Brsltm (결과서)
```java
// TAAABB_BRSLTM — 1:1 (ASCT_ID PK)
@Table(name = "TAAABB_BRSLTM")
public class Brsltm extends BaseEntity {
    @Id
    @Column(name = "ASCT_ID", length = 32)      // 협의회ID (FK, PK)
    private String cnclId;

    @Column(name = "SYN_OPNN", length = 4000)    // 종합의견
    private String synOpnn;

    @Column(name = "CKG_OPNN", length = 4000)    // 타당성검토의견
    private String ckgOpnn;

    @Column(name = "FL_MNG_NO", length = 32)    // 관련자료 첨부파일관리번호
    private String flMngNo;
}
```

### 2.3 협의회 상태 전이 (CouncilStatus Enum)

```java
public enum CouncilStatus {
    DRAFT,              // 작성중 (타당성검토표 임시저장)
    SUBMITTED,          // 작성완료 (작성완료 버튼 클릭)
    APPROVAL_PENDING,   // 결재대기 (팀장에게 결재 요청)
    APPROVED,           // 결재완료 (팀장 승인)
    PREPARING,          // 개최준비 (IT관리자 평가위원 선정 진행 중)
    SCHEDULED,          // 일정확정 (IT관리자 일정 확정)
    IN_PROGRESS,        // 진행중 (회의 당일)
    EVALUATING,         // 평가중 (평가위원 의견 작성 중)
    RESULT_WRITING,     // 결과서작성 (IT기획부 담당자 작성 중)
    RESULT_REVIEW,      // 결과서검토 (평가위원 확인 중)
    FINAL_APPROVAL,     // 결과결재 (IT기획팀장→부장 결재 중)
    COMPLETED           // 완료 (모든 절차 종료)
}
```

### 2.4 심의유형 (HearingType Enum)

```java
public enum HearingType {
    INFO_SYS,   // 정보시스템 사업 타당성 검토
    INFO_SEC,   // 정보보호시스템 사업 타당성 검토
    ETC         // 기타 위원장이 필요하다고 인정하는 사항
}
// 당연위원 매핑 (TEM_C 기준)
// INFO_SYS: 예산(12004), PMO(18010), 디지털기획(18501), 정보보호기획(18301)
// INFO_SEC: 예산(12004), IT기획(18001), PMO(18010), 디지털기획(18501)
// ETC:      예산(12004), PMO(18010), 디지털기획(18501)
```

### 2.5 API 설계 (상세)

| Method | Endpoint | Service | 설명 | 권한 |
|--------|----------|---------|------|------|
| GET | `/api/council` | CouncilService | 내 부서 사업목록 + 협의회 진행상태 | ITPZZ001+ |
| POST | `/api/council` | CouncilService | 협의회 신청 (신규 생성) | ITPZZ001 |
| GET | `/api/council/{cnclId}` | CouncilService | 협의회 단건 조회 | ITPZZ001+ |
| GET | `/api/council/{cnclId}/feasibility` | FeasibilityService | 타당성검토표 조회 | ITPZZ001+ |
| POST | `/api/council/{cnclId}/feasibility` | FeasibilityService | 타당성검토표 저장 (임시/완료) | ITPZZ001 |
| PUT | `/api/council/{cnclId}/feasibility` | FeasibilityService | 타당성검토표 수정 | ITPZZ001 |
| GET | `/api/council/{cnclId}/committee/default` | CommitteeService | 심의유형별 당연위원 조회 | ITPAD001 |
| POST | `/api/council/{cnclId}/committee` | CommitteeService | 평가위원 선정/확정 | ITPAD001 |
| PUT | `/api/council/{cnclId}/committee` | CommitteeService | 평가위원 수정 | ITPAD001 |
| GET | `/api/council/{cnclId}/schedule` | ScheduleService | 일정 입력 현황 조회 | ITPAD001 |
| POST | `/api/council/{cnclId}/schedule` | ScheduleService | 일정 입력 (평가위원) | 위원 |
| PUT | `/api/council/{cnclId}/schedule/confirm` | ScheduleService | 일정 확정 (회의장소 포함) | ITPAD001 |
| GET | `/api/council/{cnclId}/qna` | CouncilService | 사전질의응답 목록 조회 | 위원+담당자 |
| POST | `/api/council/{cnclId}/qna` | CouncilService | 사전질의 등록 | 위원 |
| PUT | `/api/council/{cnclId}/qna/{qtnId}` | CouncilService | 사전질의 답변 | ITPZZ001 |
| POST | `/api/council/{cnclId}/evaluation` | EvaluationService | 평가의견 작성 | 위원 |
| GET | `/api/council/{cnclId}/evaluation` | EvaluationService | 평가의견 전체 조회 (평균 포함) | ITPAD001 |
| GET | `/api/council/{cnclId}/result` | ResultService | 결과서 조회 | ITPZZ001+ |
| POST | `/api/council/{cnclId}/result` | ResultService | 결과서 작성 | ITPAD001 |
| PUT | `/api/council/{cnclId}/result` | ResultService | 결과서 수정 | ITPAD001 |
| PUT | `/api/council/{cnclId}/result/confirm` | ResultService | 결과서 확인 (평가위원) | 위원 |

### 2.6 CouncilDto 구조

```java
public class CouncilDto {

    /** 협의회 목록 응답 (사업목록 화면용) */
    public record ListResponse(
        String cnclId, String prjMngNo, String prjNm,
        String asctSts, String dbrTp, LocalDate cnrcDt
    ) {}

    /** 타당성검토표 요청 */
    public record FeasibilityRequest(
        String prjNm, String prjTrm, String ncsMta,
        String srpBdt, String dcspe, String prjCone,
        String lglRglYn, String lglRglNm, String xptEff,
        String kpnTp,                              // TEMP or COMPLETE
        List<CheckItemRequest> checkItems,          // 6개 자체점검
        List<PerformanceRequest> performances,      // 1~N개 성과지표
        String flMngNo                              // 첨부파일관리번호
    ) {}

    /** 타당성 자체점검 항목 */
    public record CheckItemRequest(
        String ckgItmC,     // 점검항목코드
        String ckgCone,     // 점검내용
        Integer ckgRcrd      // 점수 1~5
    ) {}

    /** 성과지표 */
    public record PerformanceRequest(
        Integer dtpSno,      // 순번 (클라이언트 관리)
        String dtpNm, String dtpCone, String msmManr,
        LocalDate msmSttDt, LocalDate msmEndDt, String msmCyc
    ) {}

    /** 평가위원 선정 요청 */
    public record CommitteeRequest(
        String dbrTp,                               // 심의유형 선택
        List<CommitteeMemberRequest> members        // 위원 목록 (당연+소집+간사)
    ) {}

    /** 위원 항목 */
    public record CommitteeMemberRequest(
        String eno, String cmTp                     // 사번, 위원유형
    ) {}

    /** 일정 입력 요청 (평가위원) */
    public record ScheduleRequest(
        List<ScheduleItem> availableSlots           // 가능한 일정 목록
    ) {}

    /** 일정 항목 */
    public record ScheduleItem(
        LocalDate dsdDt, String dsdTm, String psbYn
    ) {}

    /** 일정 확정 요청 (IT관리자) */
    public record ScheduleConfirmRequest(
        LocalDate cnrcDt, String cnrcTm, String cnrcPlc
    ) {}

    /** 평가의견 요청 */
    public record EvaluationRequest(
        List<EvaluationItem> items                  // 6개 점검항목별 점수+의견
    ) {}

    /** 평가의견 항목 */
    public record EvaluationItem(
        String ckgItmC, Integer ckgRcrd, String ckgOpnn
    ) {}

    /** 결과서 요청 */
    public record ResultRequest(
        String synOpnn,      // 종합의견
        String ckgOpnn,      // 타당성검토의견
        String flMngNo      // 관련자료 첨부파일
    ) {}
}
```

---

## 3. Frontend Architecture

### 3.1 페이지 구조

```
app/pages/info/council/
├── index.vue               // 사업목록 + 협의회 진행상태 (공통 진입점)
├── [id].vue                // 타당성검토표 작성/조회 (Step 1)
├── prepare/
│   └── [id].vue            // 협의회 개최준비 (Step 2, IT관리자)
└── result/
    └── [id].vue            // 협의회 개최 (Step 3, 평가위원/IT관리자)
```

### 3.2 컴포넌트 구조

```
app/components/council/
├── CouncilStatusBadge.vue          // 협의회 진행상태 뱃지
├── feasibility/
│   ├── FeasibilityForm.vue         // 타당성검토표 전체 폼
│   ├── FeasibilityOverview.vue     // 1. 사업개요 섹션
│   ├── FeasibilityChecklist.vue    // 2. 타당성 자체점검 6항목
│   └── FeasibilityPerformance.vue  // 3. 성과관리 자체계획 (동적 추가/삭제)
├── committee/
│   ├── CommitteeSelector.vue       // 심의유형 선택 + 당연위원 자동표출
│   └── CommitteeList.vue           // 평가위원 목록 (수정 가능)
├── schedule/
│   ├── ScheduleInput.vue           // 평가위원 일정 입력 (날짜×시간대 체크박스)
│   └── ScheduleStatus.vue          // 일정 입력 현황 + 확정 버튼
├── notice/
│   └── CouncilNotice.vue           // 일정공지 (안건/회의개요/진행순서/자료)
├── qna/
│   └── CouncilQna.vue              // 사전질의응답 목록 + 입력
├── evaluation/
│   └── EvaluationForm.vue          // 평가의견 작성 (6항목, 조건부 필수)
└── result/
    ├── ResultForm.vue              // 결과서 작성 (1page + 2page)
    └── ResultReview.vue            // 결과서 검토 확인 버튼
```

### 3.3 Composable 설계

```
app/composables/
└── useCouncil.ts                   // 협의회 전체 데이터 조회/관리
```

```typescript
// composables/useCouncil.ts
export const useCouncil = () => {
  // 내 부서 협의회 목록 조회
  const { data: councils, pending, refresh } =
    useApiFetch<CouncilListResponse[]>('/api/council');

  return { councils, pending, refresh };
};
```

### 3.4 Pinia Store 설계

```
app/stores/
└── council.ts                      // 협의회 작성 중 상태 관리 (임시저장 포함)
```

```typescript
// stores/council.ts
export const useCouncilStore = defineStore('council', () => {
  // 현재 작성 중인 타당성검토표 임시 상태
  const draftFeasibility = ref<FeasibilityRequest | null>(null);

  // 성과지표 목록 (동적 추가/삭제)
  const performances = ref<PerformanceRequest[]>([defaultPerformance()]);

  const addPerformance = () => { /* 성과지표 1개 추가 */ };
  const removePerformance = (index: number) => { /* 성과지표 삭제 */ };

  return { draftFeasibility, performances, addPerformance, removePerformance };
});
```

### 3.5 TypeScript 타입 정의

```typescript
// types/council.ts

/** 협의회 진행상태 */
export type CouncilStatus =
  | 'DRAFT' | 'SUBMITTED' | 'APPROVAL_PENDING' | 'APPROVED'
  | 'PREPARING' | 'SCHEDULED' | 'IN_PROGRESS' | 'EVALUATING'
  | 'RESULT_WRITING' | 'RESULT_REVIEW' | 'FINAL_APPROVAL' | 'COMPLETED';

/** 심의유형 */
export type HearingType = 'INFO_SYS' | 'INFO_SEC' | 'ETC';

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

/** 협의회 목록 항목 */
export interface CouncilListItem {
  cnclId: string;
  prjMngNo: string;
  prjNm: string;
  asctSts: CouncilStatus;
  dbrTp: HearingType | null;
  cnrcDt: string | null;
}

/** 타당성검토표 */
export interface FeasibilityData {
  prjNm: string;
  prjTrm: string;
  ncsMta: string;
  srpBdt: string;
  dcspe: string;
  prjCone: string;
  lglRglYn: 'Y' | 'N';
  lglRglNm: string;
  xptEff: string;
  kpnTp: 'TEMP' | 'COMPLETE';
  checkItems: CheckItem[];
  performances: PerformanceItem[];
  flMngNo: string | null;
}

/** 자체점검 항목 */
export interface CheckItem {
  ckgItmC: CheckItemCode;
  chkItmNm: string;     // 화면 표출용 한글명
  ckgCone: string;
  ckgRcrd: 1 | 2 | 3 | 4 | 5 | null;
}

/** 성과지표 */
export interface PerformanceItem {
  dtpSno: number;
  dtpNm: string;
  dtpCone: string;
  msmManr: string;
  msmSttDt: string | null;
  msmEndDt: string | null;
  msmCyc: string;
}
```

---

## 4. 화면 설계

### 4.1 index.vue — 사업목록 + 진행상태

```
┌─────────────────────────────────────────────────────────┐
│  정보화실무협의회                                           │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │ 사업명: OO시스템 구축                               │   │
│  │ [타당성검토표: 작성완료] [협의회: 개최준비]            │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 사업명: XX시스템 개선                               │   │
│  │ [타당성검토표: 작성중]                               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- 권한별 표출: ITPZZ001은 내 부서 사업만, ITPAD001은 전체 사업
- `CouncilStatusBadge` 컴포넌트로 상태 표출
- 사업 클릭 → 해당 협의회 단계 페이지로 라우팅

### 4.2 [id].vue — 타당성검토표 (Step 1)

```
┌─────────────────────────────────────────────────────────┐
│  타당성검토표 작성                                          │
├─────────────────────────────────────────────────────────┤
│  ▼ 1. 사업 개요                                           │
│    사업명 [ OO시스템 구축              ]                   │
│    사업기간 [ 2026.01 ~ 2026.12       ]                   │
│    필요성 [ 텍스트 입력...             ]                   │
│    소요예산 [ 150,000,000원           ]                   │
│    전결권자 [ 부점장                   ]                   │
│    사업내용 [ 텍스트 입력...           ]                   │
│    법률규제 ○ 해당 ● 해당없음                              │
│    기대효과 [ 텍스트 입력...           ]                   │
├─────────────────────────────────────────────────────────┤
│  ▼ 2. 타당성 자체점검                                      │
│    경영전략/계획 부합 | [내용입력] | ○1 ○2 ●3 ○4 ○5       │
│    재무 효과         | [내용입력] | ○1 ○2 ○3 ●4 ○5       │
│    ...                                                  │
├─────────────────────────────────────────────────────────┤
│  ▼ 3. 성과관리 자체계획                                    │
│    [성과지표 1]                          [삭제]            │
│      지표명 / 정의 / 측정방법 / 기간 / 주기                  │
│    [+ 성과지표 추가]                                       │
├─────────────────────────────────────────────────────────┤
│  첨부파일: [파일선택] (hwp/hwpx/pdf 필수)                  │
├─────────────────────────────────────────────────────────┤
│                    [임시저장]  [작성완료]                   │
└─────────────────────────────────────────────────────────┘
```

### 4.3 prepare/[id].vue — 협의회 개최준비 (Step 2, IT관리자)

탭 구조로 구성:
- **탭1: 평가위원 선정** — 심의유형 선택 → 당연위원 자동표출 → 소집위원/간사 추가 → 확정
- **탭2: 일정 취합** — 위원별 가능 일정 현황, 전원 입력 시 일정확정 버튼 활성화
- **탭3: 일정공지** — 안건/회의개요/진행순서/관련자료 표출 (수정 가능)
- **탭4: 사전질의응답** — 질의 목록 + 추진부서 담당자 답변

### 4.4 result/[id].vue — 협의회 개최 (Step 3)

권한별 표출:
- **평가위원**: 평가의견 작성 폼 (6항목 점수+의견, 1~2점 시 의견 필수) + 결과서 확인 버튼
- **IT관리자(ITPAD001)**: 결과서 작성 폼 (1page: 일정공지 내용, 2page: 평균점수+종합의견) + 결과보고 결재 요청

---

## 5. 보안 설계

### 5.1 접근 제어

| 화면/API | ITPZZ001 (일반) | ITPAD001 (관리자) | 평가위원 |
|---------|:--------------:|:---------------:|:-------:|
| 사업목록 | 내 부서만 | 전체 | 배정된 것만 |
| 타당성검토표 작성 | ✅ (내 부서) | ✅ | ❌ |
| 평가위원 선정 | ❌ | ✅ | ❌ |
| 일정 입력 | ❌ | ❌ | ✅ |
| 평가의견 작성 | ❌ | ❌ | ✅ |
| 결과서 작성 | ❌ | ✅ | ❌ |
| 결과서 확인 | ❌ | ❌ | ✅ |

### 5.2 데이터 접근 필터

```java
// CouncilService에서 소속부서 기준 필터링
public List<CouncilDto.ListResponse> getCouncilList(String eno) {
    // 일반사용자: 접속자 소속부서(BBR_C) = 프로젝트 주관부서인 것만 조회
    // 관리자: 전체 조회
    // 평가위원: FCMMTM에 ENO가 있는 협의회만 조회
}
```

### 5.3 파일 업로드 보안

```java
// FeasibilityService에서 확장자 검증
private static final Set<String> ALLOWED_EXTENSIONS = Set.of("hwp", "hwpx", "pdf");
// 기존 FileService 재사용 + 추가 확장자 제한 적용
```

---

## 6. DB 설계 (DDL)

```sql
-- 협의회 기본정보
CREATE TABLE TAAABB_BASCTM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,  -- 협의회ID (ASCT-{연도}-{4자리})
    PRJ_MNG_NO     VARCHAR2(32),             -- 프로젝트관리번호 (FK)
    PRJ_SNO        NUMBER(10),               -- 프로젝트순번 (FK)
    ASCT_STS       VARCHAR2(20)   NOT NULL,  -- 협의회상태
    DBR_TP         VARCHAR2(20),             -- 심의유형
    CNRC_DT         DATE,                     -- 회의일자
    CNRC_TM         VARCHAR2(10),             -- 회의시간
    CNRC_PLC       VARCHAR2(200),            -- 회의장소
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BASCTM PRIMARY KEY (ASCT_ID)
);

-- 타당성검토표
CREATE TABLE TAAABB_BPOVWM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    PRJ_NM         VARCHAR2(200),             -- 사업명 (BPROJM.PRJ_NM 동일)
    PRJ_TRM        VARCHAR2(100),             -- 사업기간
    NCS            VARCHAR2(1000),            -- 필요성 (BPROJM.NCS 동일)
    PRJ_BG         NUMBER,                    -- 소요예산 (BPROJM.PRJ_BG 동일)
    EDRT           VARCHAR2(32),              -- 전결권자 (BPROJM.EDRT 동일)
    PRJ_DES        VARCHAR2(1000),            -- 사업내용 (BPROJM.PRJ_DES 동일)
    LGL_RGL_YN     VARCHAR2(1)    DEFAULT 'N',-- 법률규제대응여부 (Y/N)
    LGL_RGL_NM     VARCHAR2(500),             -- 관련법률규제명
    XPT_EFF        VARCHAR2(1000),            -- 기대효과 (BPROJM.XPT_EFF 동일)
    KPN_TP         VARCHAR2(32)   DEFAULT 'TEMP', -- 저장유형 (CCODEM KPN_TP)
    FL_MNG_NO      VARCHAR2(32),
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BPOVWM PRIMARY KEY (ASCT_ID),
    CONSTRAINT FK_BPOVWM_ASCT FOREIGN KEY (ASCT_ID) REFERENCES TAAABB_BASCTM(ASCT_ID)
);

-- 타당성 자체점검
CREATE TABLE TAAABB_BCHKLC (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    CKG_ITM_C      VARCHAR2(20)   NOT NULL,  -- MGMT_STR/FIN_EFC/RISK_IMP/REP_IMP/DUP_SYS/ETC
    CKG_CONE       VARCHAR2(2000),
    CKG_RCRD        NUMBER(1),                -- 1~5
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BCHKLC PRIMARY KEY (ASCT_ID, CKG_ITM_C)
);

-- 성과지표
CREATE TABLE TAAABB_BPERFM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    DTP_SNO        NUMBER(10)     NOT NULL,   -- 지표순번 (1부터 시작)
    DTP_NM         VARCHAR2(200),             -- 지표명
    DTP_CONE       VARCHAR2(1000),            -- 지표정의
    MSM_MANR       VARCHAR2(1000),            -- 측정방법
    CLF            VARCHAR2(1000),            -- 산식
    GL_NV          VARCHAR2(200),             -- 목표치
    MSM_STT_DT     DATE,                      -- 측정시작일
    MSM_END_DT     DATE,                      -- 측정종료일
    MSM_TPM        VARCHAR2(100),             -- 측정시점
    MSM_CLE        VARCHAR2(100),             -- 측정주기
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BPERFM PRIMARY KEY (ASCT_ID, DTP_SNO)
);

-- 평가위원
CREATE TABLE TAAABB_BCMMTM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    ENO            VARCHAR2(32)   NOT NULL,
    VLR_TP         VARCHAR2(32)   NOT NULL,   -- 위원유형 (CCODEM VLR_TP: MAND/CALL/SECR)
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BCMMTM PRIMARY KEY (ASCT_ID, ENO)
);

-- 일정
CREATE TABLE TAAABB_BSCHDM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    ENO            VARCHAR2(32)   NOT NULL,
    DSD_DT         DATE           NOT NULL,
    DSD_TM         VARCHAR2(10)   NOT NULL,  -- 10:00/14:00/15:00/16:00
    PSB_YN         VARCHAR2(1)    DEFAULT 'N',
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BSCHDM PRIMARY KEY (ASCT_ID, ENO, DSD_DT, DSD_TM)
);

-- 사전질의응답
CREATE TABLE TAAABB_BPQNAM (
    QTN_ID         VARCHAR2(32)   NOT NULL,
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    QTN_ENO        VARCHAR2(32),
    QTN_CONE       VARCHAR2(4000),
    REP_ENO        VARCHAR2(32),
    REP_CONE       VARCHAR2(4000),
    REP_YN         VARCHAR2(1)    DEFAULT 'N',
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BPQNAM PRIMARY KEY (QTN_ID)
);

-- 평가의견
CREATE TABLE TAAABB_BEVALM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    ENO            VARCHAR2(32)   NOT NULL,
    CKG_ITM_C      VARCHAR2(20)   NOT NULL,
    CKG_RCRD        NUMBER(1),
    CKG_OPNN        VARCHAR2(2000),
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BEVALM PRIMARY KEY (ASCT_ID, ENO, CKG_ITM_C)
);

-- 결과서
CREATE TABLE TAAABB_BRSLTM (
    ASCT_ID        VARCHAR2(32)   NOT NULL,
    SYN_OPNN        VARCHAR2(4000),
    CKG_OPNN        VARCHAR2(4000),
    FL_MNG_NO      VARCHAR2(32),
    DEL_YN         VARCHAR2(1)    DEFAULT 'N',
    GUID           VARCHAR2(38),
    GUID_PRG_SNO   NUMBER(10)     DEFAULT 1,
    FST_ENR_DTM    TIMESTAMP,
    FST_ENR_USID   VARCHAR2(14),
    LST_CHG_DTM    TIMESTAMP,
    LST_CHG_USID   VARCHAR2(14),
    CONSTRAINT PK_BRSLTM PRIMARY KEY (ASCT_ID),
    CONSTRAINT FK_BRSLTM_ASCT FOREIGN KEY (ASCT_ID) REFERENCES TAAABB_BASCTM(ASCT_ID)
);
```

---

## 7. 구현 순서

### Module Map

| Module | 내용 | 의존성 |
|--------|------|--------|
| M1 | DB 테이블 생성 (DDL 실행) | - |
| M2 | 백엔드 Entity/Repository | M1 |
| M3 | CouncilService + API (목록/상태) | M2 |
| M4 | FeasibilityService + API (Step 1) | M3 |
| M5 | 전자결재 연동 (팀장 결재) | M4 |
| M6 | CommitteeService + ScheduleService + API (Step 2) | M3 |
| M7 | EvaluationService + ResultService + API (Step 3) | M6 |
| M8 | 프론트엔드 index.vue (사업목록) | M3 |
| M9 | 프론트엔드 [id].vue (타당성검토표) | M4, M5 |
| M10 | 프론트엔드 prepare/[id].vue (개최준비) | M6 |
| M11 | 프론트엔드 result/[id].vue (개최) | M7 |

### 11.3 Session Guide

| Session | Modules | 설명 |
|---------|---------|------|
| Session 1 | M1, M2, M3 | DB + 기본 인프라 |
| Session 2 | M4, M5 | Step 1 백엔드 (타당성검토표 + 결재) |
| Session 3 | M8, M9 | Step 1 프론트엔드 |
| Session 4 | M6, M10 | Step 2 백엔드 + 프론트엔드 |
| Session 5 | M7, M11 | Step 3 백엔드 + 프론트엔드 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-31 | Initial design (Option B — Clean Architecture) | ssuno |
