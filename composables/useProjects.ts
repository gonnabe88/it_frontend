
// Type Definition for Project
export interface Manager {
    name: string;
    position: string;
}

export interface ProjectManagers {
    major_expr: Manager; // 주관 부서 담당 팀장
    major_mng: Manager;  // 주관 부서 담당자
    it_expr: Manager;    // IT 부서 담당 팀장
    it_mng: Manager;     // IT 부서 담당자
}

export interface Milestone {
    title: string;
    date: string;
    status: string;
}

export interface Risk {
    title: string;
    severity: string;
    status: string;
    mitigation: string;
}

export interface ProjectItem {
    category: '기계장치' | '기타무형자산' | '개발비' | '임차료' | '유지보수료';
    name: string;
    quantity: number;
    amount: number;
    currency: string;
    description: string;
}

export interface Project {
    id: number;
    name: string;
    prj_type: string;
    major_department: string; // 주관부서
    it_department: string;    // IT 실행부서
    sta_date: string;
    end_date: string;
    budget: number;
    status: string;
    managers: ProjectManagers;
    description: string;
    background: string;
    effect?: string;
    risks?: Risk[];
    milestones: Milestone[];
    items: ProjectItem[];
}

// Global state outside the function to persist data in memory
const projects = ref<Project[]>([
    { 
        id: 1, 
        name: '차세대 정보시스템 구축', 
        prj_type:'신규', 
        major_department:'글로벌사업부문', 
        it_department: '정보전략팀', 
        budget: 1500000000, 
        status: '예산 신청', 
        sta_date: '2026-01-15', 
        end_date: '2026-12-31',
        managers: {
            major_expr: { name: '김주관', position: '팀장' },
            major_mng: { name: '이사업', position: '대리' },
            it_expr: { name: '박테크', position: '수석' },
            it_mng: { name: '최개발', position: '선임' }
        },
        description: `
            <p class="mb-2">노후화된 기존 정보시스템을 최신 기술 기반(Cloud Native)으로 재구축하여 업무 효율성을 극대화하고, 글로벌 비즈니스 확장을 위한 유연한 IT 인프라를 마련합니다.</p>
            <ul class="list-disc pl-5 mb-2">
                <li>레거시 시스템 마이그레이션 및 MSA 전환</li>
                <li>대용량 트래픽 처리를 위한 아키텍처 설계</li>
                <li>사용자 경험(UX) 중심의 UI 개편</li>
            </ul>
        `,
        background: '기존 시스템의 노후화로 인한 유지보수 비용 증가 및 신규 비즈니스 대응 속도 저하',
        effect: '운영 비용 30% 절감, 시스템 안정성 99.99% 확보, 신규 서비스 배포 주기 단축',
        milestones: [
            { title: '착수 보고', date: '2026-01-20', status: '예정' },
            { title: '요구사항 정의', date: '2026-03-31', status: '예정' },
            { title: '중간 보고', date: '2026-07-15', status: '예정' },
            { title: '오픈', date: '2026-12-31', status: '예정' }
        ],
        items: []
    },
    { 
        id: 2, 
        name: '전사적 자원관리(ERP) 고도화', 
        prj_type:'신규', 
        major_department:'경영지원부문', 
        it_department: '경영지원팀', 
        budget: 504000100, 
        status: '사전 협의', 
        sta_date: '2026-03-01', 
        end_date: '2026-12-31',
        managers: {
            major_expr: { name: '오경영', position: '부장' },
            major_mng: { name: '한재무', position: '과장' },
            it_expr: { name: '정시스템', position: '차장' },
            it_mng: { name: '신ERP', position: '대리' }
        },
        description: '기존 ERP 시스템의 기능을 개선하고, 인사/재무/물류 데이터를 통합 관리하여 의사결정 속도를 높이고 경영 투명성을 확보합니다.',
        background: '데이터 사일로 현상 심화 및 수작업 리포팅 업무 과부하',
        effect: '월 마감 시간 5일 -> 2일 단축, 실시간 경영 지표 대시보드 제공',
        milestones: [],
        items: []
    },
    { 
        id: 3, 
        name: '클라우드 인프라 전환', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'IT운영팀', 
        budget: 3000000, 
        status: '정실협 진행중', 
        sta_date: '2026-02-10', 
        end_date: '2026-12-31',
        managers: {
            major_expr: { name: '채운영', position: '팀장' },
            major_mng: { name: '송서버', position: '대리' },
            it_expr: { name: '임클라우드', position: '수석' },
            it_mng: { name: '장인프라', position: '선임' }
        },
        description: '온프레미스 환경의 서버를 클라우드로 전환하여 운영 비용을 절감하고, 시스템의 가용성과 확장성을 확보합니다.',
        background: '물리 서버 노후화 및 IDC 상면 부족',
        effect: 'TCO 20% 절감, 유연한 오토스케일링 환경 구성',
        milestones: [],
        items: []
    },
    { 
        id: 4, 
        name: '정보보호 관리체계(ISMS) 인증', 
        prj_type:'신규', 
        major_department:'정보보호부문', 
        it_department: '정보보호팀', 
        budget: 120000000, 
        status: '요건 상세화', 
        sta_date: '2025-12-20', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '안보안', position: '팀장' },
            major_mng: { name: '김해킹', position: '과장' },
            it_expr: { name: '이방화벽', position: '차장' },
            it_mng: { name: '박백신', position: '대리' }
        },
        description: '법적 컴플라이언스 준수', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 5, 
        name: '임직원용 모바일 앱 개발', 
        prj_type:'신규', 
        major_department:'디지털혁신부문', 
        it_department: '디지털혁신팀', 
        budget: 200000000, 
        status: '소요예산 산정', 
        sta_date: '2026-01-05', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '황디지털', position: '팀장' },
            major_mng: { name: '윤모바일', position: '대리' },
            it_expr: { name: '서앱', position: '수석' },
            it_mng: { name: '조안드로이드', position: '선임' }
        },
        description: '스마트 워크 환경 조성', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 6, 
        name: '네트워크 장비 노후화 교체', 
        prj_type:'계속', 
        major_department:'IT운영부문', 
        it_department: 'IT운영팀', 
        budget: 80000000, 
        status: '과심위 진행중', 
        sta_date: '2026-04-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '류네트워크', position: '팀장' },
            major_mng: { name: '권랜선', position: '과장' },
            it_expr: { name: '허스위치', position: '차장' },
            it_mng: { name: '배공유기', position: '대리' }
        },
        description: '네트워크 안정성 확보', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 7, 
        name: 'AI 기반 챗봇 서비스 도입', 
        prj_type:'계속', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '입찰/계약 진행중', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '남상담', position: '팀장' },
            major_mng: { name: '문고객', position: '대리' },
            it_expr: { name: '고AI', position: '수석' },
            it_mng: { name: '방챗봇', position: '선임' }
        },
        description: '고객 응대 자동화', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 8, 
        name: 'AI 기반 챗봇 서비스 도입#2', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '사업 진행중', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '홍길동', position: '팀장' },
            major_mng: { name: '김철수', position: '대리' },
            it_expr: { name: '이영희', position: '수석' },
            it_mng: { name: '박민수', position: '선임' }
        },
        description: 'IT 헬프데스크 챗봇', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 9, 
        name: 'AI 기반 챗봇 서비스 도입#3', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '사업 완료', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '홍길동', position: '팀장' },
            major_mng: { name: '김철수', position: '대리' },
            it_expr: { name: '이영희', position: '수석' },
            it_mng: { name: '박민수', position: '선임' }
        },
        description: '사업 완료', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 10, 
        name: 'AI 기반 챗봇 서비스 도입#4', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '대금지급 완료', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '홍길동', position: '팀장' },
            major_mng: { name: '김철수', position: '대리' },
            it_expr: { name: '이영희', position: '수석' },
            it_mng: { name: '박민수', position: '선임' }
        },
        description: '대금 지급 완료', 
        background: '', 
        effect: '',  
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 11, 
        name: 'AI 기반 챗봇 서비스 도입#5', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '성과평가(대기)', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '홍길동', position: '팀장' },
            major_mng: { name: '김철수', position: '대리' },
            it_expr: { name: '이영희', position: '수석' },
            it_mng: { name: '박민수', position: '선임' }
        },
        description: '성과 평가 대기', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
    { 
        id: 12, 
        name: 'AI 기반 챗봇 서비스 도입#6', 
        prj_type:'신규', 
        major_department:'IT운영부문', 
        it_department: 'CS팀', 
        budget: 150000000, 
        status: '성과평가(완료)', 
        sta_date: '2026-05-01', 
        end_date: '2026-12-31', 
        managers: {
            major_expr: { name: '홍길동', position: '팀장' },
            major_mng: { name: '김철수', position: '대리' },
            it_expr: { name: '이영희', position: '수석' },
            it_mng: { name: '박민수', position: '선임' }
        },
        description: '성과 평가 완료', 
        background: '', 
        effect: '', 
        risks: [],
        milestones: [],
        items: []
    },
]);

export const useProjects = () => {
    
    const getProjectById = (id: number) => {
        return projects.value.find(p => p.id === id);
    };

    const addProject = (project: Omit<Project, 'id'>) => {
        const newId = Math.max(...projects.value.map(p => p.id), 0) + 1;
        const newProject = { ...project, id: newId };
        projects.value.push(newProject as Project);
        return newProject;
    };

    const updateProject = (id: number, updatedFields: Partial<Project>) => {
        const index = projects.value.findIndex(p => p.id === id);
        if (index !== -1) {
            projects.value[index] = { ...projects.value[index], ...updatedFields };
            return projects.value[index];
        }
        return null;
    };

    const deleteProject = (id: number) => {
        const index = projects.value.findIndex(p => p.id === id);
        if (index !== -1) {
            projects.value.splice(index, 1);
            return true;
        }
        return false;
    };

    const exchangeRates = {
        'KRW(원)': 1,
        'USD($)': 1450,
        'EUR(€)': 1550
    };

    const getApprovalAuthority = (items: ProjectItem[]) => {
        let maxAuthorityLevel = 0;
        let authority = '부점장 전결'; 
        let reason = '기본 전결';

        // Thresholds
        // Capital: 기계장치, 기타무형자산, 개발비
        // General: 임차료, 유지보수료
        
        // Caclulate totals per category group
        let capitalTotal = 0;
        let generalTotal = 0;

        items.forEach(item => {
            const currency = item.currency || 'KRW(원)';
            const rate = exchangeRates[currency as keyof typeof exchangeRates] || 1;
            const krwAmount = (item.amount || 0) * (item.quantity || 1) * rate;

            if (['기계장치', '기타무형자산', '개발비'].includes(item.category)) {
                capitalTotal += krwAmount;
            } else if (['임차료', '유지보수료'].includes(item.category)) {
                generalTotal += krwAmount;
            }
        });

        // Determine Level based on Capital
        let capitalLevel = 0;
        let capitalReason = '';
        if (capitalTotal >= 2000000000) { capitalLevel = 5; capitalReason = '자본예산 20억원 이상'; }
        else if (capitalTotal >= 1500000000) { capitalLevel = 4; capitalReason = '자본예산 15억원 이상'; }
        else if (capitalTotal >= 1000000000) { capitalLevel = 3; capitalReason = '자본예산 10억원 이상'; }
        else if (capitalTotal >= 500000000) { capitalLevel = 2; capitalReason = '자본예산 5억원 이상'; }
        else if (capitalTotal >= 200000000) { capitalLevel = 1; capitalReason = '자본예산 2억원 이상'; }
        
        // Determine Level based on General
        let generalLevel = 0;
        let generalReason = '';
        if (generalTotal >= 1000000000) { generalLevel = 5; generalReason = '일반관리비 10억원 이상'; }
        else if (generalTotal >= 500000000) { generalLevel = 4; generalReason = '일반관리비 5억원 이상'; }
        else if (generalTotal >= 300000000) { generalLevel = 3; generalReason = '일반관리비 3억원 이상'; }
        else if (generalTotal >= 200000000) { generalLevel = 2; generalReason = '일반관리비 2억원 이상'; }
        else if (generalTotal >= 100000000) { generalLevel = 1; generalReason = '일반관리비 1억원 이상'; }

        const finalLevel = Math.max(capitalLevel, generalLevel);
        
        if (finalLevel === 0) {
            return { authority: '-', reason: '-' };
        }

        if (capitalLevel >= generalLevel) {
            reason = capitalReason;
        } else {
            reason = generalReason;
        }

        switch (finalLevel) {
            case 5: return { authority: '회장', reason };
            case 4: return { authority: '전무이사', reason };
            case 3: return { authority: '부행장', reason };
            case 2: return { authority: '본부장', reason };
            case 1: return { authority: '부점장', reason };
            default: return { authority: '부점장', reason };
        }
    };

    return {
        projects,
        getProjectById,
        addProject,
        updateProject,
        deleteProject,
        getApprovalAuthority
    };
};
