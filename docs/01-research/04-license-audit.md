# 04. 에셋 라이선스 — **전량 자유 사용 확인됨**

> ## ✅ 프로젝트 방침
> **`FE/asset/` 의 모든 에셋(7,845개 파일 전체)은 자유롭게 사용 가능하다.**
> 상업적 사용·수정·배포에 제약이 없으며, 프로젝트 오너가 이를 확인했다.
> — 확인일: 2026-08-02 / 근거: 프로젝트 오너 선언
>
> **따라서 에셋 라이선스는 출시 블로커가 아니다.** 이전 조사에서 "미확인"으로 분류했던 항목들은 전부 해소된 것으로 처리한다.

이 문서는 이제 **감사 문서가 아니라 참조 문서**다. 각 팩에 동봉된 라이선스 파일의 내용과 원작자 정보를 기록해 두어, 게임 내 크레딧 화면(`설정 > 라이선스`)을 만들 때 활용한다.

---

## 1. 요약

| 항목 | 상태 |
|---|---|
| 상업적 사용 | ✅ 전 팩 가능 |
| 수정 | ✅ 전 팩 가능 |
| 게임에 빌드해 배포 | ✅ 전 팩 가능 |
| 출시 블로커 여부 | **❌ 아님** |
| 남은 작업 | 크레딧 표기 목록(`docs/legal/ATTRIBUTIONS.md`) 작성 — 의무가 아니라 예의 |

---

## 2. 팩별 정보 (크레딧 화면 작성용)

동봉 라이선스 파일이 있는 팩은 그 내용을 그대로 기록한다. 없는 팩은 원작자만 기재한다.

### 2.1 동봉 라이선스 파일이 있는 팩

| 팩 | 원작자 | 동봉 문서 내용 |
|---|---|---|
| `bosses/EVil Wizard 2` | — | **CC-0 (퍼블릭 도메인 헌정).** 상업·비상업 모두 사용 가능, 크레딧 불필요 |
| `tilemap/` | **Szadi art** | **퍼블릭 도메인** (`public-license.txt`). 상업 OK, 수정 OK, 크레딧 권장 |
| `bosses/Bringer-Of-Death` | **Clembod** | 개인·상업 사용 OK, 수정 OK, 크레딧 선택 (`License.txt`) |
| `bosses/FREE_Samurai 2D Pixel Art v1.2` | — | 개인·상업 프로젝트 사용 OK, 수정 OK, 크레딧 선택 |
| `character/FREE_Adventurer 2D Pixel Art` | — | 위와 동일 조항 |
| `bosses/MainCharacter(FreePack)` | **KBPixelArt** | 수정 및 개인·상업 게임 사용 허용, 크레딧 선택 |

### 2.2 원작자 정보가 확인되는 팩

| 팩 | 원작자 / 출처 추정 | 규모 |
|---|---|---|
| `icons/Free - Raven Fantasy Icons` | **Caio / Clockwork Raven Studios** (동봉 txt에 감사 메시지) | 2,192종 |
| `bosses/Necromancer_creativekind-Sheet.png` | **creativekind** | 보스 1 |
| `bosses/NightBorne` | **Diamond / CreativeKind** (itch.io) | 보스 1 |
| `bgm/` | **Pixabay Audio** (파일명 패턴 `<작가>-<제목>-<ID>.mp3`) | 20곡 |
| `fonts/base_font.woff2` | **물마루 모노 (Mulmaru Mono)** — Mushsooni, © 2025, [github.com/mushsooni/mulmaru](https://github.com/mushsooni/mulmaru) | 한글 11,172자 전체 |

### 2.3 원작자 정보가 파일에 남아 있지 않은 팩

크레딧 화면에는 팩 이름으로 기재한다.

| 팩 | 규모 |
|---|---|
| `monsters/` (Basic Asset Pack 시리즈 10팩) | 크리처 150종 |
| `npcs/Lively_NPCs_v3.1` | 49종 |
| `effect/Free` | 252 시트 (색상 변형 포함 2,268) |
| `item/` | 시트 7장 (~448 아이콘) |
| `projectile/` | 시트 8장 (~200 애니메이션) |
| `bosses/Mecha-stone Golem 0.1` | 보스 1 |
| `bosses/Undead executioner` | 보스 1 + 소환수 |

---

## 3. 크레딧 화면 (`docs/legal/ATTRIBUTIONS.md`)

크레딧이 **의무가 아닌 팩도 전부 기재한다.** 비용이 0이고, 원작자에 대한 예의이며, 커뮤니티 인상에도 좋다.

**형식 예시**

```markdown
# 사용된 에셋

## 아트
- Bringer of Death — Clembod
- Evil Wizard 2 — CC-0
- Dungeon Tileset — Szadi art (Public Domain)
- Samurai 2D Pixel Art, Adventurer 2D Pixel Art
- Main Character Free Pack — KBPixelArt
- Raven Fantasy Icons — Caio / Clockwork Raven Studios
- NightBorne — Diamond / CreativeKind
- Necromancer — creativekind
- Basic Asset Pack Series (Monsters / Animals / Holy / Undead / Demons /
  Dragons / Vermin / Magical / Humanoid / Humanoid II)
- Lively NPCs v3.1
- Mecha-stone Golem, Undead Executioner
- Effect Pack, Item Icons, Projectile Pack

## 폰트
- 물마루 모노 (Mulmaru Mono) — Mushsooni

## 음악
- Pixabay Audio 수록곡 (개별 곡명·작가는 아래 표 참조)

## 효과음
- (P3-14에서 소싱 후 추가)
```

**게임 내 노출 위치:** `설정 > 라이선스` (`02-design/18-ux-ui.md` §3 화면 흐름에 이미 포함됨)

---

## 4. 앞으로 추가되는 에셋의 규칙

기존 `FE/asset/` 는 전량 자유 사용이 확인됐지만, **새로 도입하는 에셋은 다르다.**

| 항목 | 상태 | 조치 |
|---|---|---|
| **SFX (효과음)** | **에셋에 0개. 새로 소싱 필요** | CC0 우선([Kenney](https://kenney.nl/assets/category:Audio) · [Freesound CC0](https://freesound.org) · [ZapSplat](https://zapsplat.com)). 라이선스 확인 후 `docs/legal/` 에 기록 |
| ~~한글 픽셀 폰트~~ | ✅ **이미 보유** — 물마루 모노 (`asset/fonts/`) | 추가 도입 불필요 |
| UI 키트 (9-slice, 버튼) | 자체 제작 예정 | 해당 없음 |
| 배경 레이어 | 기존 타일셋 조합 + 자체 제작 | 해당 없음 |

**규칙: 새 에셋을 프로젝트에 추가할 때는 출처와 라이선스를 `docs/legal/ATTRIBUTIONS.md` 에 함께 기록한다.** 나중에 크레딧 화면을 만들 때 다시 찾아다니지 않기 위해서다.

---

## 5. 유지되는 설계 원칙

라이선스 리스크가 해소됐어도 **아래 원칙은 그대로 유지한다.** 원래 라이선스 대응으로 도입했지만, 그와 무관하게 좋은 설계이기 때문이다.

| 원칙 | 라이선스와 무관한 이유 |
|---|---|
| **에셋 참조를 데이터 필드로 유지** (`unit.holy_crusader` 같은 논리 키) | 아트 교체·리스킨·이벤트 스킨·A/B 테스트가 코드 변경 없이 가능 |
| **아틀라스 추상화** — 코드가 물리 파일 경로를 모름 | 패킹 전략 변경, 해상도 티어 대응이 자유로움 |
| **거대화 엘리트 패턴** — 16×16 스프라이트를 스케일해 보스로 | 보스 스프라이트 9체로 20개 월드를 채울 수 있는 콘텐츠 레버리지 |
| **원본을 `public/` 에 복사하지 않고 아틀라스만 배포** | 드로우콜·번들 크기·로딩 시간. 성능상 필수 |

---

## 6. 이전 조사 기록

이 문서의 이전 버전은 동봉 라이선스 파일이 있는 팩(5개)과 없는 팩(11개 그룹)을 구분하고, 후자를 출시 블로커로 분류했다.
**프로젝트 오너 확인에 따라 이 구분은 무효이며, 전 팩이 자유 사용 가능한 것으로 처리한다.**

에셋의 물리적 규격·프레임 수·애니메이션 상태 등 기술적 인벤토리는 `03-asset-inventory.md` 에 그대로 유효하다.
