# Guidelines for AI Coding Agents / AI 코딩 에이전트 지침

> This document provides strict rules for AI coding agents (Codex, Claude Code, Copilot, etc.) working on this codebase. Violating these rules can break critical game mechanics.
>
> 이 문서는 AI 코딩 에이전트(Codex, Claude Code, Copilot 등)가 이 코드베이스에서 작업할 때 반드시 따라야 할 규칙을 제공합니다. 이 규칙을 위반하면 핵심 게임 로직이 깨질 수 있습니다.

---

## Rule 1: DO NOT modify game logic files / 게임 로직 파일을 수정하지 마세요

**Do not modify `match-game.js` or `game.js` unless you are explicitly asked to fix a bug in those files.** These files contain carefully tuned game mechanics that are easy to break and hard to debug.

**명시적으로 해당 파일의 버그 수정을 요청받지 않는 한 `match-game.js` 또는 `game.js`를 수정하지 마세요.** 이 파일들은 세심하게 조정된 게임 메커니즘을 포함하고 있으며, 쉽게 깨지고 디버깅하기 어렵습니다.

---

## Rule 2: Critical functions that MUST NOT be changed / 절대 변경해서는 안 되는 핵심 함수들

The following functions are the backbone of the game. Do not modify, rewrite, or refactor them unless explicitly fixing a reported bug within that specific function.

다음 함수들은 게임의 핵심입니다. 해당 함수 내의 보고된 버그를 명시적으로 수정하는 경우가 아니면 수정, 재작성 또는 리팩터링하지 마세요.

| Function / 함수 | Purpose / 역할 |
|---|---|
| `MatchGame._refill()` | Flow refill logic - replaces only matched card slots while keeping remaining cards in their original positions / 플로우 리필 로직 - 매칭된 카드 슬롯만 교체하고 나머지 카드는 원래 위치에 유지 |
| `MatchGame._render()` | Full DOM rebuild from `this._cards` array; card order must match array index / `this._cards` 배열로부터 전체 DOM 재구성; 카드 순서는 배열 인덱스와 일치해야 함 |
| `MatchGame.handleClick()` | Card matching logic using `pairId` / `pairId`를 사용한 카드 매칭 로직 |
| `MatchGame._deal()` | Initial card dealing / 초기 카드 배분 |
| `Game.update()` | Core game loop / 핵심 게임 루프 |
| `Game.checkAnswer()` | Answer validation / 정답 검증 |

---

## Rule 3: Card order invariant / 카드 순서 불변 규칙

**In flow refill mode, when 5 pairs are matched, ONLY the matched slots get new cards. The remaining 10 cards MUST stay in their exact same positions (same array index).** Never shuffle or reorder unmatched cards during refill.

**플로우 리필 모드에서 5쌍이 매칭되면, 매칭된 슬롯만 새 카드를 받습니다. 나머지 10장의 카드는 반드시 정확히 같은 위치(같은 배열 인덱스)에 유지되어야 합니다.** 리필 중에 매칭되지 않은 카드를 절대 섞거나 재정렬하지 마세요.

Example / 예시:
```
Before refill / 리필 전:  [A, _, B, _, C, D, _, E, F, G, _, H, _, I, J, _, K, L, _, M]
                           (underscores = matched slots / 밑줄 = 매칭된 슬롯)

After refill / 리필 후:   [A, X, B, X, C, D, X, E, F, G, X, H, X, I, J, X, K, L, X, M]
                           (X = new cards / X = 새 카드)

Cards A,B,C,D,E,F,G,H,I,J,K,L,M remain at their ORIGINAL indices.
카드 A,B,C,D,E,F,G,H,I,J,K,L,M은 원래 인덱스에 그대로 유지됩니다.
```

---

## Rule 4: DOM/Data sync / DOM과 데이터 동기화

`data-idx` attributes on card DOM elements must always correspond to `this._cards[idx]`. Any render function must iterate `this._cards` in order and set `data-idx` to the array index.

카드 DOM 요소의 `data-idx` 속성은 항상 `this._cards[idx]`에 대응해야 합니다. 모든 렌더 함수는 `this._cards`를 순서대로 순회하며 `data-idx`를 배열 인덱스로 설정해야 합니다.

```
this._cards[0] → DOM element with data-idx="0"
this._cards[1] → DOM element with data-idx="1"
...
this._cards[n] → DOM element with data-idx="n"
```

Breaking this mapping will cause clicks to match the wrong cards.
이 매핑이 깨지면 클릭 시 잘못된 카드가 매칭됩니다.

---

## Rule 5: CSS-only changes are safe / CSS만 변경하는 것은 안전합니다

Visual styling changes in `style.css` (colors, borders, border-radius, shadows, fonts, spacing, animations) **do not affect game logic** and are safe to make.

`style.css`의 시각적 스타일 변경(색상, 테두리, 모서리 둥글기, 그림자, 글꼴, 간격, 애니메이션)은 **게임 로직에 영향을 주지 않으며** 안전하게 수정할 수 있습니다.

---

## Rule 6: HTML element IDs are sacred / HTML 요소 ID는 변경 불가

`main.js` caches elements by ID in `cacheElements()`. If you rename or remove an ID in `index.html`, you **MUST** update all references:

`main.js`는 `cacheElements()`에서 ID로 요소를 캐싱합니다. `index.html`에서 ID를 변경하거나 제거하면 **반드시** 모든 참조를 업데이트해야 합니다:

- `index.html` - element definition / 요소 정의
- `main.js` → `App.elements` declaration (top of file) / 선언부 (파일 상단)
- `main.js` → `cacheElements()` - `getElementById` calls / 호출
- `main.js` → `bindEvents()` - event listeners / 이벤트 리스너
- `main.js` → all methods that reference the element / 해당 요소를 참조하는 모든 메서드
- `style.css` - related styles / 관련 스타일

---

## Rule 7: When in doubt, don't touch it / 확신이 없으면 건드리지 마세요

**If a task only requires CSS or HTML changes, do NOT modify any JS files.** Unnecessary JS changes are the #1 cause of broken game mechanics in this project.

**CSS나 HTML 변경만 필요한 작업이라면 JS 파일을 수정하지 마세요.** 불필요한 JS 변경이 이 프로젝트에서 게임 메커니즘이 깨지는 가장 큰 원인입니다.

---

## Quick reference: Safe vs. Dangerous changes / 빠른 참고: 안전한 변경 vs. 위험한 변경

| Safe / 안전 | Dangerous / 위험 |
|---|---|
| Editing `style.css` (any visual change) | Modifying `game.js` or `match-game.js` |
| Adding new HTML elements with new IDs | Renaming or removing existing HTML IDs |
| Editing `config.js` constants (when asked) | Changing card render or refill logic |
| Updating word data in `world*.json` | Reordering `this._cards` array elements |
| Adding new event listeners in `main.js` | Modifying `_refill()`, `_render()`, `handleClick()` |
