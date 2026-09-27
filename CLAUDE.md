# Web Collector - 개인용 웹 북마크 매니저

## 프로젝트 개요
사용자가 로그인하여 개인화된 웹사이트 바로가기를 카테고리별로 관리하는 웹 애플리케이션

## 기술 스택
- **Frontend**: Next.js 14 (App Router)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Auth**: JWT + httpOnly Cookie
- **Drag & Drop**: @dnd-kit

---

## V1 기능 목록
- [x] 설계 완료
- [ ] 로그인/회원가입
- [ ] 링크 저장 (무제한)
- [ ] 카테고리 분류
- [ ] 파비콘 자동 표시
- [ ] 드래그 앤 드롭 정렬
- [ ] 검색
- [ ] 반응형 디자인
- [ ] 다크모드

## V2 (나중에)
- 브라우저 확장
- 공유 기능
- 썸네일 미리보기
- 북마크 임포트
- 메모 추가
- 태그 시스템

---

## 데이터베이스 스키마

### Users
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| username | String | Unique, 로그인용 |
| email | String | Unique |
| password_hash | String | bcrypt 해시 |
| theme | String | dark/light |
| created_at | DateTime | 생성일 |
| updated_at | DateTime | 수정일 |

### Categories
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| user_id | UUID | FK → Users |
| name | String | 카테고리명 |
| color | String | HEX 색상 |
| order_index | Int | 정렬 순서 |
| created_at | DateTime | 생성일 |
| updated_at | DateTime | 수정일 |

### Links
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| user_id | UUID | FK → Users |
| category_id | UUID? | FK → Categories (nullable) |
| title | String | 링크 제목 |
| url | String | URL |
| favicon_url | String? | 파비콘 URL |
| order_index | Int | 정렬 순서 |
| created_at | DateTime | 생성일 |
| updated_at | DateTime | 수정일 |

---

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 카테고리
- `GET /api/categories` - 목록 조회
- `POST /api/categories` - 생성
- `PUT /api/categories/:id` - 수정
- `DELETE /api/categories/:id` - 삭제
- `PUT /api/categories/reorder` - 순서 변경

### 링크
- `GET /api/links` - 목록 조회 (쿼리: categoryId)
- `POST /api/links` - 생성
- `PUT /api/links/:id` - 수정
- `DELETE /api/links/:id` - 삭제
- `PUT /api/links/reorder` - 순서 변경

---

## 개발 Phase

### Phase 1: 프로젝트 초기 설정
- [ ] 폴더 구조 생성
- [ ] Backend 설정 (Express + TypeScript + Prisma)
- [ ] Frontend 설정 (Next.js + Tailwind + shadcn)
- [ ] PostgreSQL 연결 및 마이그레이션
- [ ] 환경변수 설정

### Phase 2: 인증 시스템
- [ ] User 모델 생성
- [ ] 회원가입 API
- [ ] 로그인 API + JWT
- [ ] 인증 미들웨어
- [ ] 프론트엔드 로그인/회원가입 UI

### Phase 3: 카테고리 기능
- [ ] Category 모델
- [ ] 카테고리 CRUD API
- [ ] 프론트엔드 카테고리 UI

### Phase 4: 링크 기능
- [ ] Link 모델
- [ ] 링크 CRUD API
- [ ] 파비콘 자동 가져오기
- [ ] 프론트엔드 링크 UI

### Phase 5: 고급 기능
- [ ] 드래그 앤 드롭 정렬
- [ ] 검색 기능
- [ ] 다크모드

### Phase 6: 마무리
- [ ] 반응형 디자인 최적화
- [ ] 에러 처리 개선
- [ ] 테스트
- [ ] 각 Phase별 테스트 진행 및 오류 수정

---

## 폴더 구조

```
V1_collector/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── dashboard/page.tsx
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── layout/
│   │   │   ├── links/
│   │   │   └── categories/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── tailwind.config.js
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── .env
│
└── CLAUDE.md
```

---

## 포트 설정
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- PostgreSQL: localhost:5432

---

## 개발 규칙
1. 각 Phase 완료 후 테스트 진행
2. 오류 발생 시 해당 Phase에서 수정
3. 커밋 메시지는 한글로 작성
4. 환경변수는 .env.example 파일로 관리
