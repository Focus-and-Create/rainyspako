# Spanish Rain - 개발 지침

## 프로젝트 구조

단일 페이지 웹앱 (SPA). 모든 로직이 소수의 파일에 집중되어 있음:

| 파일 | 역할 |
|------|------|
| `index.html` | 전체 UI (모든 화면, 모달, 컴포넌트) |
| `main.js` | 앱 진입점 (화면 전환, 이벤트 바인딩, DOM 캐싱) |
| `style.css` | 전역 스타일 |
| `game.js` | 게임 루프, 물리 엔진, 채점 |
| `stage-map.js` | 월드맵 캔버스 렌더링 |
| `storage.js` | localStorage 래퍼 (진행도, 설정, 프로필) |
| `config.js` | 게임 상수, 월드 설정 |
| `word-manager.js` | 단어 데이터 로드/관리 |
| `world*.json` | 월드별 단어 데이터 |

## 머지 충돌 방지 규칙 (필수)

이 프로젝트는 `index.html`, `main.js`, `style.css` 세 파일에 변경이 집중되어
머지 충돌이 자주 발생합니다. 반드시 아래 규칙을 따르세요:

### 1. 작업 시작 전 반드시 최신 main을 pull할 것

```bash
git fetch origin main
git checkout -b <브랜치명> origin/main
```

기존 브랜치에서 작업할 경우에도 먼저 rebase:

```bash
git fetch origin main
git rebase origin/main
```

### 2. 커밋 전 main과 충돌 여부를 확인할 것

```bash
git fetch origin main
git merge --no-commit --no-ff origin/main
# 충돌이 있으면 해결 후 커밋
# 충돌이 없으면 git merge --abort
```

### 3. DOM 요소 ID 변경/이동 시 전체 참조를 확인할 것

이 프로젝트는 `index.html`에서 ID를 정의하고 `main.js`의 `cacheElements()`에서
참조합니다. 요소를 이동하거나 이름을 바꿀 때 반드시 아래를 모두 수정하세요:

- `index.html` - 요소 정의
- `main.js` → `App.elements` 선언부 (상단)
- `main.js` → `cacheElements()` - getElementById 호출
- `main.js` → `bindEvents()` - 이벤트 리스너
- `main.js` → 해당 요소를 사용하는 모든 메서드
- `style.css` - 관련 스타일

### 4. 이미 삭제/이동된 코드를 다시 추가하지 말 것

작업 전에 현재 main의 상태를 확인하세요. 이전 PR에서 의도적으로 제거하거나
다른 위치로 이동한 코드를 옛날 브랜치 기준으로 되살리면 충돌이 발생합니다.

대표적인 사례:
- `mode-select` 드롭다운: 스테이지 모달에서 **통계 모달로 이동됨** (PR #24).
  스테이지 모달에 다시 추가하지 마세요.

### 5. 같은 브랜치 이름을 재사용하지 말 것

이미 머지된 브랜치 이름으로 새 PR을 만들면 GitHub에서 혼선이 생깁니다.
새 기능은 반드시 새 브랜치 이름을 사용하세요.
