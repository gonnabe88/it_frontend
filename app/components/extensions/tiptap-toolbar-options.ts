/**
 * TiptapToolbar에서 사용하는 선택지와 팔레트 상수입니다.
 * UI 로직과 정적 옵션 데이터를 분리해 툴바 컴포넌트의 책임을 줄입니다.
 */

/**
 * 프리셋 색상 팔레트 (8열 × 6행 = 48색)
 * 열: 흑백/회색, 빨강, 주황, 노랑/녹색, 청록/파랑, 남색/보라, 분홍
 * 행: 짙은색 → 옅은색 순
 */
export const COLOR_PALETTE: string[][] = [
    ['#000000', '#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#FFFFFF'],
    ['#7F1D1D', '#B91C1C', '#EF4444', '#F97316', '#FB923C', '#FCA5A5', '#FED7AA', '#FFF7ED'],
    ['#78350F', '#B45309', '#D97706', '#EAB308', '#FCD34D', '#FDE68A', '#FEF08A', '#FEFCE8'],
    ['#14532D', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7'],
    ['#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
    ['#4C1D95', '#6D28D9', '#8B5CF6', '#A855F7', '#EC4899', '#F472B6', '#F9A8D4', '#FCE7F3'],
];

/** 폰트 패밀리 선택지 */
export const fontOptions = [
    { label: '기본 폰트', value: '' },
    { label: '나눔고딕', value: "'NanumGothic', sans-serif" },
    { label: '맑은 고딕', value: "'Malgun Gothic', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Courier New', value: "'Courier New', monospace" }
];

/** 글자 크기 선택지 */
export const fontSizeOptions = [
    { label: '기본', value: '' },
    { label: '8px', value: '8px' },
    { label: '10px', value: '10px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
];
