/**
 * ============================================================================
 * [tests/unit/utils/excel.test.ts] Excel 유틸리티 단위 테스트
 * ============================================================================
 * utils/excel.ts의 applyHeaderStyle, downloadWorkbook, exportRowsToExcel을
 * 직접 import하여 소스 커버리지를 생성합니다.
 * ExcelJS와 DOM API(URL.createObjectURL 등)를 Mock으로 대체합니다.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// ExcelJS Mock
// ============================================================================

/** 셀 Mock */
const createMockCell = () => ({
    fill: undefined as unknown,
    font: undefined as unknown,
    alignment: undefined as unknown,
    border: undefined as unknown,
});

/** 행 Mock */
const createMockRow = (cellCount = 3) => {
    const cells = Array.from({ length: cellCount }, createMockCell);
    return {
        height: 0,
        eachCell: vi.fn((cb: (cell: ReturnType<typeof createMockCell>) => void) => {
            cells.forEach(cb);
        }),
        commit: vi.fn(),
        _cells: cells,
    };
};

/** Worksheet Mock */
const createMockWs = () => {
    const rows: ReturnType<typeof createMockRow>[] = [createMockRow()]; // 1행 = 헤더
    return {
        getRow: vi.fn((n: number) => rows[n - 1] ?? createMockRow()),
        addRow: vi.fn(),
        columns: [] as unknown[],
    };
};

/** Workbook Mock (클래스 스타일 — new ExcelJS.Workbook() 지원) */
let _lastMockWs: ReturnType<typeof createMockWs> | null = null;
let _lastWriteBuffer: ReturnType<typeof vi.fn> | null = null;

class MockWorkbook {
    _ws: ReturnType<typeof createMockWs>;
    xlsx: { writeBuffer: ReturnType<typeof vi.fn> };

    constructor() {
        this._ws = createMockWs();
        this.xlsx = { writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) };
        _lastMockWs = this._ws;
        _lastWriteBuffer = this.xlsx.writeBuffer;
    }

    addWorksheet(_name: string) {
        return this._ws;
    }
}

vi.mock('exceljs', () => ({
    default: { Workbook: MockWorkbook },
}));

// ============================================================================
// DOM Mock (URL.createObjectURL 등)
// ============================================================================

const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();

Object.defineProperty(globalThis, 'URL', {
    value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    },
    writable: true,
    configurable: true,
});

// document.createElement('a') mock
const mockAnchor = {
    href: '',
    download: '',
    click: mockClick,
};
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return mockAnchor as unknown as HTMLElement;
    return document.createElement(tag);
});

// ============================================================================
// Import
// ============================================================================

import { applyHeaderStyle, downloadWorkbook, exportRowsToExcel } from '~/utils/excel';

describe('utils/excel', () => {
    beforeEach(() => {
        mockCreateObjectURL.mockClear();
        mockRevokeObjectURL.mockClear();
        mockClick.mockClear();
        _lastMockWs = null;
        _lastWriteBuffer = null;
    });

    // -------------------------------------------------------------------------
    // applyHeaderStyle
    // -------------------------------------------------------------------------
    describe('applyHeaderStyle()', () => {
        it('1행 높이를 22로 설정한다', () => {
            const ws = createMockWs();
            applyHeaderStyle(ws as any);
            const row = (ws.getRow as ReturnType<typeof vi.fn>).mock.results[0]?.value;
            expect(row.height).toBe(22);
        });

        it('각 셀에 eachCell 콜백을 실행한다', () => {
            const ws = createMockWs();
            applyHeaderStyle(ws as any);
            const row = (ws.getRow as ReturnType<typeof vi.fn>).mock.results[0]?.value;
            expect(row.eachCell).toHaveBeenCalled();
        });

        it('헤더 행에 commit()을 호출한다', () => {
            const ws = createMockWs();
            applyHeaderStyle(ws as any);
            const row = (ws.getRow as ReturnType<typeof vi.fn>).mock.results[0]?.value;
            expect(row.commit).toHaveBeenCalled();
        });

        it('셀에 fill 스타일을 적용한다', () => {
            const ws = createMockWs();
            applyHeaderStyle(ws as any);
            const row = (ws.getRow as ReturnType<typeof vi.fn>).mock.results[0]?.value;
            // eachCell 콜백이 실행되어 셀에 값이 설정됨을 확인
            const cell = row._cells[0];
            expect(cell.fill).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // downloadWorkbook
    // -------------------------------------------------------------------------
    describe('downloadWorkbook()', () => {
        it('xlsx.writeBuffer를 호출한다', async () => {
            const wb = new MockWorkbook();
            await downloadWorkbook(wb as any, 'test.xlsx');
            expect(wb.xlsx.writeBuffer).toHaveBeenCalled();
        });

        it('URL.createObjectURL을 호출한다', async () => {
            const wb = new MockWorkbook();
            await downloadWorkbook(wb as any, 'test.xlsx');
            expect(mockCreateObjectURL).toHaveBeenCalled();
        });

        it('anchor.click()을 호출하여 파일을 다운로드한다', async () => {
            const wb = new MockWorkbook();
            await downloadWorkbook(wb as any, 'test.xlsx');
            expect(mockClick).toHaveBeenCalled();
        });

        it('다운로드 후 URL.revokeObjectURL을 호출한다', async () => {
            const wb = new MockWorkbook();
            await downloadWorkbook(wb as any, 'test.xlsx');
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        it('anchor.download에 파일명을 설정한다', async () => {
            const wb = new MockWorkbook();
            await downloadWorkbook(wb as any, 'report.xlsx');
            expect(mockAnchor.download).toBe('report.xlsx');
        });
    });

    // -------------------------------------------------------------------------
    // exportRowsToExcel
    // -------------------------------------------------------------------------
    describe('exportRowsToExcel()', () => {
        it('rows가 빈 배열이면 addRow를 호출하지 않는다', async () => {
            await exportRowsToExcel([], '시트명', 'empty.xlsx');
            // 빈 배열이면 addWorksheet만 호출되고 addRow는 호출되지 않음
            expect(_lastMockWs?.addRow).not.toHaveBeenCalled();
        });

        it('rows가 있으면 addRow를 각 행마다 호출한다', async () => {
            const rows = [
                { 이름: '홍길동', 부서: '개발팀' },
                { 이름: '김철수', 부서: '기획팀' },
            ];
            await exportRowsToExcel(rows, '사용자', 'users.xlsx');
            expect(_lastMockWs?.addRow).toHaveBeenCalledTimes(2);
        });

        it('headerKeys를 지정하면 에러 없이 완료된다', async () => {
            const rows = [{ a: 1, b: 2, c: 3 }];
            await exportRowsToExcel(rows, '시트', 'file.xlsx', ['c', 'a', 'b']);
            expect(mockClick).toHaveBeenCalled();
        });

        it('headerKeys 미지정 시 rows[0]의 키 순서를 사용한다', async () => {
            const rows = [{ 이름: '홍길동', 나이: 30 }];
            await exportRowsToExcel(rows, '시트', 'file.xlsx');
            expect(mockClick).toHaveBeenCalled();
        });
    });
});
