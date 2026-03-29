# Design: guide-editor-enhancement

> **Feature**: 가이드 에디터 기능 강화 (Tiptap 확장)
> **Phase**: Do (module-3 진행 중)
> **Started**: 2026-03-25
> **Architecture**: Option C — Pragmatic Balance (기존 확장 패턴 재사용)

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Tiptap 기반 리치에디터에서 Quill 수준 이상의 편집 기능 제공 |
| **WHO** | IT Portal 내부 임직원 (~3,000명), 가이드 문서 작성자 |
| **RISK** | Tiptap v3 breaking changes / 패키지 호환성 / 백엔드 sanitizer 누락 |
| **SUCCESS** | 모든 FR(01~07) 기능이 저장/로드 시 데이터 손실 없이 동작 |
| **SCOPE** | TiptapEditor.vue + TiptapToolbar.vue + extensions/ + HtmlSanitizer.java |

---

## 1. Overview

TiptapEditor를 단계적으로 강화합니다. 6개 모듈로 분리하여 세션별 구현합니다.

| Module | FR | 내용 | 상태 |
|--------|-----|------|------|
| module-1 | FR-01, FR-02 | 표 정렬 저장 / 체크박스→불릿 버그 | ✅ 완료 (백엔드 sanitizer 수정) |
| module-2 | 리팩토링 | TiptapEditor 3파일 분리 | ✅ 완료 |
| **module-3** | **FR-03, FR-04** | **CodeBlock Lowlight + FontSize** | **🔄 진행 중** |
| module-4 | FR-06 | 표 고급 기능 (배경색·헤더 토글) | ⏳ 대기 |
| module-5 | FR-05 | 파일 첨부 | ⏳ 대기 |
| module-6 | FR-07 | LaTeX 수식 (mathlive) | ✅ 완료 |

---

## 2. Architecture

### 파일 구조 (module-3 기준)

```
app/components/
├── TiptapEditor.vue              ← extensions 등록 (import 추가)
├── TiptapToolbar.vue             ← FontSize UI (select/버튼) + CodeBlock 버튼
└── extensions/
    └── tiptap-extensions.ts      ← FontSize 커스텀 확장 추가
```

---

## 11. Implementation Guide

### 11.1 Session Guide

#### Module Map

| Module | 파일 | 변경 내용 |
|--------|------|-----------|
| module-3 | `package.json` | `@tiptap/extension-code-block-lowlight`, `lowlight` 설치 |
| module-3 | `extensions/tiptap-extensions.ts` | `FontSize` 커스텀 확장 추가 |
| module-3 | `TiptapEditor.vue` | `CodeBlockLowlight`, `FontSize` 확장 등록 |
| module-3 | `TiptapToolbar.vue` | FontSize Select + CodeBlock 버튼 추가 |

#### module-3 상세 구현 계획

**FR-03: CodeBlock Lowlight (syntax highlighting)**

- 패키지: `@tiptap/extension-code-block-lowlight@^3.x`, `lowlight@^3.x`
- `StarterKit`의 기본 `codeBlock`을 비활성화하고 `CodeBlockLowlight`로 대체
- 지원 언어: javascript, typescript, python, java, sql, bash, css, html, json, xml
- 언어 선택 UI: 코드블록 내 드롭다운 (NodeView 활용 또는 floating select)
- 백엔드 sanitizer: `pre`, `code` 태그에 `class` 속성 허용 (lowlight가 `language-xxx` class 주입)

**FR-04: FontSize (글자 크기)**

- Tiptap v3 공식 FontSize 확장 없음 → TextStyle 기반 커스텀 확장
- `addAttributes()`: `fontSize` (CSS `font-size` 값, 예: `"14px"`, `"18px"`)
- `renderHTML`: `{ style: \`font-size: ${fontSize}\` }`
- `parseHTML`: `element.style.fontSize || null`
- 툴바 UI: Select 드롭다운 (8px ~ 32px, 4px 단위)
- 백엔드 sanitizer: `span`의 `style` 허용 (이미 허용됨 ✓)

### 11.2 Implementation Order

1. 패키지 설치 (`npm install`)
2. `tiptap-extensions.ts`: `FontSize` 확장 추가
3. `TiptapEditor.vue`: 확장 등록 (StarterKit codeBlock 비활성화, CodeBlockLowlight + FontSize 추가)
4. `TiptapToolbar.vue`: FontSize Select + CodeBlock 버튼 추가
5. `HtmlSanitizer.java`: `pre`, `code` 태그 `class` 속성 허용 추가
6. CSS: CodeBlock 언어 라벨 스타일 추가 (선택)
