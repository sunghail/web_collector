# V3 작업 상태

2026-09-22. 사용자 요청으로 V2_collector의 현재 파일을 V3_collector로 복사함. 미커밋 소스 변경과 새 파일도 포함. V2 원본은 변경하지 않음.

- V3가 향후 업데이트 작업 위치임. 이번 작업은 복사와 검증까지이며 기능 수정, 실행, 의존성 설치, 외부 배포는 아직 하지 않음.
- 소스, 설정, 환경파일, Supabase SQL, local-backups의 데이터 원본/검증 기록/ZIP을 복사함.
- 제외: .git, .claude, node_modules, .next, dist, dist-electron, dist-installer, standalone-build, _remote_repo_check, 로그와 TypeScript 빌드 캐시.
- 기존 Git 기록과 원격 연결은 V2에 남아 있음. V3에는 아직 Git 저장소를 초기화하지 않음.
- 환경파일은 기존 운영 Supabase 연결을 그대로 포함함. 새 환경으로 변경하기 전 V3에서 저장/수정/삭제 기능을 실행하면 기존 DB에 영향을 줄 수 있음. 이번에는 실행하지 않음.
- 복사한 데이터 백업은 BACKUP_STATUS.md 및 local-backups 내부 README.md 참조. 원본 백업 범위와 한계는 그대로 적용됨.
- 복사 직후 모든 복사 대상 파일의 SHA-256이 V2 원본과 일치함을 확인함.
- 다음 업데이트 내용은 사용자 지시를 받아 진행. 새 Supabase/Vercel 생성이나 배포는 별도 요청 없이 진행하지 않음.
