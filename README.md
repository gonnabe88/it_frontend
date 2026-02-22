# IT Portal System

IT 포털 시스템은 프로젝트 관리, 전자 결재, 감사, 진단 기능을 제공하는 통합 관리 시스템입니다.

## 기술 스택 (Tech Stack)

- **Framework**: [Nuxt 4](https://nuxt.com)
- **UI Library**: [PrimeVue](https://primevue.org) (Aura Theme)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **State Management**: [Pinia](https://pinia.vuejs.org)
- **Language**: [TypeScript](https://www.typescriptlang.org)

## 주요 기능 (Features)

- **프로젝트 관리 (Project Management)**
  - 사업 정보 등록 및 수정 (`/info/projects`)
  - 예산 및 추진 일정 관리
  - 소요 자원 상세 내역 관리

- **전자 결재 (Approval)**
  - 결재 요청 및 승인 프로세스 (`/approval`)

- **감사 및 진단 (Audit & Diagnosis)**
  - 시스템 감사 (`/audit`)
  - 자가 진단 (`/diagnosis`)

## 개발 환경 설정 (Setup)

프로젝트 실행을 위해 Node.js가 설치되어 있어야 합니다.

### 1. 의존성 설치 (Install Dependencies)

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install
```

### 2. 타입 정의 생성 (Type Generation)

Nuxt의 자동 생성 타입(`.nuxt/`)을 최신 상태로 유지하려면 아래 명령어를 실행하세요.
IDE에서 타입 오류(예: `vue` 모듈을 찾을 수 없음)가 발생할 때 유용합니다.

```bash
npm run postinstall
# 또는
npx nuxt prepare
```

### 3. 개발 서버 실행 (Development Server)

```bash
npm run dev
```
브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 확인합니다.

## 배포 (Production Build)

운영 환경 배포를 위한 빌드 명령어입니다.

```bash
npm run build
```

---
자세한 내용은 [Nuxt Documentation](https://nuxt.com/docs)을 참고하세요.
