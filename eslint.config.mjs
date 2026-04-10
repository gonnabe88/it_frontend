import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    // TypeScript 타입 정보 기반의 엄격 검사 활성화
    // vue-tsc가 잡지 못하는 런타임 타입 불일치를 ESLint 레벨에서 추가 검출합니다.
    typescript: {
      strict: true,
    },
  },
}).append({
  rules: {
    // 선언되지 않은 변수/식별자 사용 금지
    // utils/common.ts에 없는 함수를 import할 경우 즉시 오류로 표시됩니다.
    'no-undef': 'off', // TypeScript가 더 정확하므로 기본 no-undef는 비활성화
    '@typescript-eslint/no-unused-vars': ['warn', {
      // 사용하지 않는 import 변수 경고 (오탈자로 인한 import 실수 조기 감지)
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    // type-only import 강제: 런타임에 필요 없는 타입은 import type으로 분리
    // 빌드 시 tree-shaking이 더 잘 되고, 순환 참조 위험을 줄입니다.
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      disallowTypeAnnotations: false,
    }],
  },
})
