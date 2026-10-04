# 할 일 관리 앱 프로젝트 계획 (MVP · P0)

> 기준 문서: `./PRD.md`
> 범위: P0 핵심 기능만. P1은 MVP 완료 후 별도 계획
> 상태: **MVP 구현 완료** (2026-10-04)

## 0. 확정 사항
- 플랫폼: 웹 앱 (데스크톱 브라우저 우선)
- 저장소: 로컬 저장 (localStorage), 로그인·서버 없음, 1인 사용
- 범위: P0 (CRUD / 상태 관리 / 드래그 앤 드롭 / 기간 구조)

## 1. 기술 스택
- React 19 + TypeScript (strict) + Vite
- 런타임 의존성: React만 사용
  - 드래그 앤 드롭: HTML5 Drag and Drop + 키보드 이동 (← →)
  - 상태 관리: `useSyncExternalStore` 기반 최소 store (`src/lib/createStore.ts`)
  - 날짜 계산: `src/domain/period.ts` 직접 구현
- 테스트: Vitest
- 변경 이력: dnd-kit / Zustand / date-fns 제외 (구현 환경에서 설치 불가 → 검증 가능한 범위로 축소)

## 2. 가정 (변경 시 알려주세요)
- 주 시작일: 월요일
- 기간 값 기준: 사용자 로컬 시간대
- `id`: `crypto.randomUUID()` (보안 컨텍스트가 아니면 대체 생성)
- 삭제: 확인 다이얼로그 후 영구 삭제 (휴지통 없음)

## 3. 아키텍처
- UI (components) → Store → Repository → localStorage
- UI는 Repository 직접 접근 금지
- 상태 변경은 낙관적 업데이트 → 저장 실패 시 이전 상태로 롤백
- localStorage 키: `todo-app:tasks:v1` (스키마 버전 포함)
- 손상 데이터: 원본을 `todo-app:tasks:backup`에 보관, 복구 전까지 쓰기 차단
- localStorage 사용 불가 시 메모리 저장 + 경고 배너

## 4. 디렉터리 구조
```
src/
  domain/
    task.ts             # Task 타입, Status, PeriodType, 검증
    period.ts           # 기간 값 계산·정규화 (오늘/이번 주/올해, 이전/다음)
  repository/
    taskRepository.ts   # 인터페이스, 오류 타입
    localTaskRepository.ts
  lib/
    createStore.ts      # 최소 store
    useStore.ts         # React 연결 훅
  store/
    taskStore.ts        # CRUD, 상태 이동, order, 롤백
    periodStore.ts      # 선택 기간 유형·값
    index.ts            # 앱 인스턴스
  components/
    PeriodTabs.tsx  PeriodNavigator.tsx
    Board.tsx  Column.tsx  TaskCard.tsx
    TaskFormModal.tsx  Modal.tsx  ConfirmDialog.tsx
    Toast.tsx  StorageBanner.tsx
  App.tsx  main.tsx  styles.css
tests/
  period.test.ts  repository.test.ts  taskStore.test.ts
```

## 5. 데이터 모델
- Task
  - `id`: string
  - `title`: string (필수, 1~100자)
  - `description`: string (선택)
  - `status`: `todo` | `doing` | `done` (기본 `todo`)
  - `period_type`: `daily` | `weekly` | `yearly`
  - `period_value`: `YYYY-MM-DD`(daily) / 주 시작일 `YYYY-MM-DD`(weekly) / `YYYY`(yearly)
  - `order`: number
  - `created_at`, `updated_at`: ISO 문자열

## 6. 작업 분해

### M1 - 프로젝트 기반
- [x] T1. Vite + React + TS 프로젝트 구성, Vitest 설정
- [x] T2. `domain/task.ts` 타입 정의
- [x] T3. `domain/period.ts` 기간 계산 함수 + 단위 테스트
  - 오늘/이번 주(월요일)/올해 값 생성
  - 이전/다음 기간 값 계산
  - 연말·연초, 윤년 경계 테스트
  - `normalizePeriodValue`: 주간 날짜 → 월요일, 날짜 → 연도, 잘못된 값 거부
- [x] T4. Repository 인터페이스 + localStorage 구현 + 단위 테스트
  - `list`, `create`, `update`, `delete`
  - 손상 데이터: 원본 백업 키에 보관 + 쓰기 차단 + 초기화 기능

### M2 - 할 일 CRUD + 상태 관리
- [x] T5. `taskStore` 구현 + 단위 테스트
  - 생성 시 `status = todo`, `order` = 컬럼 마지막
  - 컬럼(상태·기간) 변경 시 대상 컬럼 마지막 `order`로 배치
  - 컬럼 내 표시는 `order` 오름차순
  - 수정 시 `updated_at` 갱신
  - 저장 실패 시 롤백
- [x] T6. `TaskFormModal` (생성/수정 공용)
  - 제목 필수 검증, 기간 유형·값 선택
  - 기본값: 현재 보고 있는 탭·기간, 저장 기간 미리보기
- [x] T7. `TaskCard` (제목·설명 표시, 클릭 시 수정, 삭제 버튼)
- [x] T8. `ConfirmDialog` 삭제 확인

### M3 - 기간 구조
- [x] T9. `periodStore` (선택 유형, 탭별 선택 값, 기본: 일일·오늘)
- [x] T10. `PeriodTabs` (일일 / 주간 / 1년)
- [x] T11. `PeriodNavigator` (이전 / 현재 기간 표시 / 다음 / 오늘로)
- [x] T12. 선택 기간 기준 목록 필터링, 다른 기간에 저장 시 해당 보드로 이동

### M4 - 칸반 보드 + 드래그 앤 드롭
- [x] T13. `Board` + `Column` 3컬럼 (todo / doing / done), 컬럼별 개수 표시
- [x] T14. 컬럼 간 이동 → `status` 변경 + 즉시 저장
- [x] T15. 드래그 중 드롭 대상 컬럼 하이라이트, 드래그 카드 반투명
- [x] T16. 저장 실패 시 카드 원위치 + 에러 토스트
- [x] T17. 키보드 이동 (← → 상태 변경, Enter 수정, Delete 삭제)

### M5 - 마무리
- [x] T18. 빈 상태 UI (기간에 할 일 없음)
- [x] T19. 통합 점검: 생성 → 드래그 → 새로고침 후 유지 (브라우저 자동화로 확인)
- [ ] T20. 수동 점검 (Chrome / Edge / Safari 최신) — 사용자 환경에서 확인 필요

## 7. 완료 기준 (MVP)
- [x] 할 일 생성/수정/삭제 동작, 새로고침 후 유지
- [x] 생성 시 기본 상태 `todo`
- [x] 드래그 앤 드롭으로 상태 변경 + 즉시 저장
- [x] 저장 실패 시 롤백 동작
- [x] 일일/주간/1년 탭 전환 및 이전/다음 기간 이동
- [x] `period.ts`, Repository, Store 단위 테스트 통과 (30건)
- [ ] `npm run build` 타입 체크 에러 0 — 사용자 환경에서 `npm install` 후 확인 필요

## 8. 리스크 및 대응
- 기간 경계 계산 오류 (주 시작, 연말) → 경계 테스트로 검증
- localStorage 용량 초과·손상 → 실패 시 롤백 + 알림, 손상 시 백업·쓰기 차단
- 시간대 차이로 날짜 어긋남 → 로컬 날짜 문자열 기준으로만 비교
- 모바일 터치 드래그 미지원 (HTML5 DnD 한계) → 수정 화면의 상태 선택으로 대체

## 9. 범위 외 (P1 · 후속)
- 같은 컬럼 내 순서 변경
- 기간 간 연결 (`parent_id`)
- 기간별 진행률
- 미완료 할 일 이월
- 검색 및 상태 필터
- 모바일 터치 드래그
