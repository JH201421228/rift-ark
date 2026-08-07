# RIFT ARK — 개발 문서 인덱스

> **가로형 모바일 레인 디펜스** (팔라독 · 카툰워즈 계보)
> React 19 + Vite 7 + Zustand 5 + Phaser 3.90 + Capacitor 7 + Tiled

| 항목 | 값 |
|---|---|
| 프로젝트 코드명 | `superdimension` (appId `com.superdimension.app`) |
| 게임 가제 | **RIFT ARK / 리프트 아크** (한국어 부제: *균열의 방주*) — 확정 전 |
| 장르 | 사이드스크롤 레인 디펜스 + 로그라이트 각인 드래프트 |
| 타깃 | 한국 선행 → 글로벌. 미드코어 깊이 / 캐주얼 접근성 |
| 화면 | 가로 고정, 디자인 해상도 **1280×720** (16:9 픽셀아트 베이스) |
| 문서 작성일 | 2026-08-01 (범위 절삭 2026-08-04) |

---

> ### ★★ 범위 절삭 (2026-08-04) — **팔라독으로 돌아간다**
>
> 만들려던 것은 팔라독 · 카툰워즈 계보의 **라이트한 레인 디펜스**였는데, 그 위에
> 2026년식 F2P 운영 게임이 통째로 얹혀 있었다. **가챠 · 상점 · 배틀패스 · 광고 ·
> 출석 · 일일/주간 퀘스트 · 방치 · 파견 · 던전 · 탑 · 시험 · 도감 · 계측**을 전부 걷어냈다.
>
> **재화는 골드 하나 · 성장은 세 갈래 · 전투 모드는 둘.**
> 그리고 절삭이 비운 자리에는 **타이틀 + 세이브 슬롯 3 · 가이드 오버레이 19주제 ·
> 홈 대시보드**가 들어갔다 (라우트 7개).
> **단계별 튜토리얼(FTUE)은 같은 날 삭제됐다** — 설명은 가이드가 한다.
>
> **단일 출처: [`04-plan/34-scope-cut.md`](04-plan/34-scope-cut.md).**
> 다른 문서와 그 문서가 다르면 **그 문서가 맞다.** 영향받는 문서에는 상단에 배너가 붙어 있다.

---

> ### ★ 방침 전환 (2026-08-03) — **게임 완성이 먼저다**
>
> 외부 테스터 · 실제 플레이어 · 스토어 계정이 **없다.** 그것을 요구하는 게이트
> (외부 5명 플레이테스트 · D1/D7/D30 지표 판정 · 크래시 프리 세션)는 영원히 열리지
> 않으므로 계획에서 **걷어냈다.** 모든 게이트는 이 저장소 안에서 재현 가능해야 한다.
>
> **게임을 완성한 뒤, 사용자가 직접 플레이하며 하나씩 고친다.**
>
> ⚠ `01-research/` 의 D1/D7/D30 수치는 여전히 **설계 목표의 기록**이다. 게이트가 아니다.
>
> 상세: `04-plan/30-roadmap.md` §0 · `04-plan/32-definition-of-done.md` §3

---

## 읽는 순서

**처음 합류했다면** → `01-research/01-genre-analysis.md` → `02-design/10-GDD.md` → `03-tech/20-architecture.md` 순서로 읽으세요.

**바로 개발을 시작한다면** → **`04-plan/34-scope-cut.md` 를 먼저 읽고**,
그다음 `04-plan/33-execution-plan.md` 의 남은 티켓으로.
`03-tech/28-coding-conventions.md`를 옆에 두고 진행하세요.

---

## 1. 리서치 (`01-research/`)

근거 자료입니다. 설계 문서에서 내린 모든 결정은 여기에 출처가 있습니다.

| 문서 | 내용 |
|---|---|
| [`01-genre-analysis.md`](01-research/01-genre-analysis.md) | 팔라독·카툰워즈 코어루프 해부, 실패 원인 5가지, 2024–2026 장르 현황, 혁신 기회 15선 |
| [`02-market-retention.md`](01-research/02-market-retention.md) | D1/D7/D30 벤치마크, FTUE 설계, BM 구조, 확률형 아이템 규제, 경제 설계, 한국·글로벌 시장 |
| [`03-asset-inventory.md`](01-research/03-asset-inventory.md) | `FE/asset` 7,845개 파일 전수 인벤토리 — 규격·프레임 수·애니메이션 상태 |
| [`04-license-audit.md`](01-research/04-license-audit.md) | **에셋 전량 자유 사용 확인됨.** 팩별 원작자 정보와 크레딧 표기 목록 |

## 2. 게임 설계 (`02-design/`)

| 문서 | 내용 |
|---|---|
| [`10-GDD.md`](02-design/10-GDD.md) | 마스터 기획서. 컨셉·세계관·핵심 재미·전체 시스템 지도 |
| [`11-core-loop.md`](02-design/11-core-loop.md) | 전투 시스템 상세 — 레인, 자원, 소환, 영웅 오라, 데미지 타입, 템포 |
| [`12-unit-roster.md`](02-design/12-unit-roster.md) | 유닛·적·보스 로스터 설계와 실제 에셋 매핑 |
| [`13-progression-meta.md`](02-design/13-progression-meta.md) | 방주 시설 4종, 별 경제 (방치·파견·승급·장비는 삭제됨) |
| [`14-economy-balance.md`](02-design/14-economy-balance.md) | 재화 구조, 스케일링 수식, 벽 방지 설계, 파워 커브 |
| [`15-content-plan.md`](02-design/15-content-plan.md) | 월드 계획 (상시 콘텐츠·주간 로테이션은 삭제됨) |
| [`16-ftue.md`](02-design/16-ftue.md) | ⛔ **역사 기록** — 단계별 튜토리얼은 2026-08-04 삭제. 설명은 가이드 오버레이가 한다 |
| [`17-liveops-monetization.md`](02-design/17-liveops-monetization.md) | **수익화는 없다** — 무엇을 왜 지웠는지, 규제 표면이 어떻게 사라졌는지 |
| [`18-ux-ui.md`](02-design/18-ux-ui.md) | 가로형 레이아웃, 세이프에어리어, 터치 타깃, 화면 흐름 |
| [`19-art-audio-direction.md`](02-design/19-art-audio-direction.md) | HD 픽셀 아트 디렉션, 4프레임 제약 극복법, BGM 매핑 |
| [`20-commander-combat.md`](02-design/20-commander-combat.md) | **지휘관 평타와 스킬** — "싸울 수 있다"고 써 놓고 없던 공격을, 오라 운영을 망가뜨리지 않게 붙이는 방법 (2026-08-04) |
| [`21-commander-growth.md`](02-design/21-commander-growth.md) | **지휘관 성장** — 레벨 · 장구 · 성소 (2026-08-05) |
| **[`22-nightmare.md`](02-design/22-nightmare.md)** | **나이트메어 난이도 설계** — 월드별 신규 메커니즘 3종 · 해금 · 보상 · 게이트 BN1–BN8 · 티켓 P11 (2026-08-05, **설계 확정 · 미구현**) |

> ★ 02-design 의 10–19 가 모두 차서 **20 부터 이어 붙인다.** 폴더가 다르므로
> `03-tech/20-architecture.md` 와 번호가 같아도 충돌하지 않는다.

## 3. 기술 (`03-tech/`)

| 문서 | 내용 |
|---|---|
| [`20-architecture.md`](03-tech/20-architecture.md) | 전체 아키텍처, React↔Phaser 경계, 씬 구조, 폴더 구조 |
| [`21-state-management.md`](03-tech/21-state-management.md) | Zustand 슬라이스 설계, Phaser 브리지, 재렌더 폭풍 방지 |
| [`22-simulation-spec.md`](03-tech/22-simulation-spec.md) | Phaser 비의존 결정론적 시뮬레이션 스펙 (30Hz 고정 틱) |
| [`23-asset-pipeline.md`](03-tech/23-asset-pipeline.md) | 아틀라스 패킹, 오디오 인코딩, 지연 로딩, 번들 예산 |
| [`24-data-schema.md`](03-tech/24-data-schema.md) | 유닛·적·스테이지·각인·세이브 JSON 스키마 |
| [`25-capacitor-mobile.md`](03-tech/25-capacitor-mobile.md) | 가로 고정, 세이프에어리어, 생명주기, 저장, 뒤로가기 |
| [`26-performance-budget.md`](03-tech/26-performance-budget.md) | 프레임/메모리/드로우콜 예산, 품질 티어, 측정 방법 |
| [`27-testing-balance-harness.md`](03-tech/27-testing-balance-harness.md) | Vitest, 헤드리스 밸런스 시뮬레이터, 디버그 오버레이 |
| [`28-coding-conventions.md`](03-tech/28-coding-conventions.md) | 네이밍, 파일 구조, 커밋, 리뷰 기준 |
| [`29-i18n.md`](03-tech/29-i18n.md) | **한국어·영어 이중 언어** — 결정과 그 이유. 작업 절차는 `.claude/skills/i18n/SKILL.md`, 강제는 `npm run check:i18n` |

## 4. 계획 (`04-plan/`)

| 문서 | 내용 |
|---|---|
| [`30-roadmap.md`](04-plan/30-roadmap.md) | 마일스톤 지도 (M0~M6), 크리티컬 패스, 범위 축소 우선순위 |
| [`31-risk-register.md`](04-plan/31-risk-register.md) | 리스크 등록부 (라이선스·기술·설계·시장) |
| [`32-definition-of-done.md`](04-plan/32-definition-of-done.md) | DoD, QA 체크리스트, 출시 전 게이트 |
| **[`33-execution-plan.md`](04-plan/33-execution-plan.md)** | **★ 티켓 단위 실행 계획.** 게임을 만드는 130 티켓 — 사실상 완료. 이제 역사 문서에 가깝다 |
| **[`34-scope-cut.md`](04-plan/34-scope-cut.md)** | **★★ 2026-08-04 범위 절삭 — 무엇이 사라졌는지의 단일 출처** |
| **[`35-remaining-work-roadmap.md`](04-plan/35-remaining-work-roadmap.md)** | **★★ 2026-08-06 현재 남은 것 전부 + 출시까지의 로드맵.** 33 과 다르면 이 문서가 맞다 |

## 5. 아트 브리프 (`05-art-briefs/`)

| 문서 | 내용 |
|---|---|
| [`40-image-production-brief.md`](05-art-briefs/40-image-production-brief.md) | **외주/Codex 전달용 자립 사양서.** 배경 레이어 40장, 방주·균열, UI 키트. **스토어 이미지(§6)는 절삭 이전 기준이라 `06-release/52` 가 맞다** |

## 6. 출시 (`06-release/`)

| 문서 | 내용 |
|---|---|
| [`50-google-play-paid-codemagic.md`](06-release/50-google-play-paid-codemagic.md) | **개인 계정으로 유료 앱 등록 — Google Play.** 계정·서명·CI·클로즈드 테스트 14일 관문 |
| [`51-app-store-paid-codemagic.md`](06-release/51-app-store-paid-codemagic.md) | **개인 계정으로 유료 앱 등록 — App Store.** Mac 없이 Codemagic 으로 빌드·서명·TestFlight |
| [`52-store-image-codex-prompts.md`](06-release/52-store-image-codex-prompts.md) | **스토어 배포 이미지 전량의 Codex 프롬프트·작업 지시서.** 아이콘·스플래시·로고·피처그래픽 + 스크린샷 캡처 파이프라인 |
| **[`53-english-market-paid-release.md`](06-release/53-english-market-paid-release.md)** | **★ 영어권 유료앱 출시 — 미국·영국·캐나다·호주·EU.** 가격·통화 · 세금(W-8BEN·조세조약·수수료) · 판매 국가 · 연령 등급(**Apple 2025 신규 체계**·IARC) · 법무(영문 방침 · Data safety · App Privacy · **Privacy Manifest** · **EU DSA 거래자 지위** · COPPA 회피) · 리스팅 현지화와 ASO · 환불 · 출시 순서 (2026-08-07) |
| **[`54-english-store-art-codex-prompts.md`](06-release/54-english-store-art-codex-prompts.md)** | **★ 영어권 스토어 이미지·카피의 Codex 프롬프트.** 자산 사양표(Play·App Store) · 아이콘 3안 · 피처 그래픽 · 스크린샷 오버레이 카피(**No ads. No IAP. No gacha.**) · 이름/짧은설명/긴설명 · 하지 말 것 · 체크리스트 (2026-08-07) |
| **[`55-monetization-decision.md`](06-release/55-monetization-decision.md)** | **★ 수익화 모델 판정 — 유료 vs 무료+보상형 광고.** 설치당 기대수익 계산 · 손익분기 설치 배수 · "클리어 골드 2배" 가 경제 곡선에 하는 일 · 가격 전략 · **이 결론을 뒤집는 조건** (2026-08-07) |
| **[`56-admob-rewarded-integration.md`](06-release/56-admob-rewarded-integration.md)** | **★★ 보상형 광고(AdMob) 붙이는 법 — 현재 개발 방향.** 계정·앱ID vs 광고단위ID · 플러그인/네이티브 설정 · **UMP 동의·ATT** · 스토어 제출물 대조(Data safety · App Privacy · 방침 전문) · **경제 재보정과 실측 스윕** · 테스트 · 출시 순서 (2026-08-07) |

> ★★ **수익화는 2026-08-07 에 무료 + 보상형 광고로 결정됐다.** 50 · 51 · 53 의 유료
> 절차는 참고로 유효하지만 실제 출시는 무료 앱이다 — 판정 경위는 **55**, 구현과
> 절차는 **56** 이다. **무료 → 유료 전환은 불가능**하므로 순서를 주의할 것.
>
> ★ 50 · 51 은 **한국 기준**이다. 영어권으로 확대할 때 답이 달라지는 지점은 전부
> 53 에 있고, 50 · 51 의 해당 절에 상호 참조가 걸려 있다.
> 특히 **App Store 연령 등급은 2025년에 개편**됐으므로 51 §4 가 아니라 **53 §4.3** 이 최신이다.

## 부록

| 문서 | 내용 |
|---|---|
| [`WORKING-STYLE.md`](WORKING-STYLE.md) | **다음 프로젝트의 AI 에이전트에게 넘길 작업 성향 참조.** 이 저장소 밖으로 복사해 쓰는 용도 |

---

## 이 프로젝트를 관통하는 5개 원칙

1. **바깥 루프의 기울기가 모든 것을 결정한다.**
   리서치에서 수집한 모든 플레이어 불만은 전투(내부 루프)가 아니라 **성장 곡선(외부 루프)** 을 향했다. 전투는 재미로 만들고, 성장은 2년 차 플레이어가 아직 남아 있을 것을 전제로 설계한다.

2. **벽은 항상 조합 퍼즐이어야 하고, 절대 경제 벽이면 안 된다.**
   막힌 스테이지는 "지금 파워로도 올바른 편성이면 뚫린다"가 성립해야 한다. 반복 노가다나 결제로만 뚫리는 구간은 이 장르를 죽인 원인이다.

3. **60fps는 기능이다.**
   초당 10회 넘게 변하는 값은 Zustand에 넣지 않는다. 콜드 스타트 3초 이내. WebView는 58fps가 현실적 상한이므로 그 기준으로 예산을 짠다.

4. **전투 로직에 Phaser를 import 하지 않는다.**
   `src/game/logic/`은 순수 함수와 시드 PRNG만 사용한다. 결정론 → 밸런스 자동 검증 → 리플레이 → 백그라운드 복귀 안전성이 전부 여기서 나온다.

5. **확률형 요소를 만들지 않는다. 하나도.**
   2026-08-04 절삭으로 가챠가 사라지면서 이 게임에는 확률형이 **한 개도 없다.**
   한국 게임산업법의 확률 공개 의무와 강화형 규제가 **적용 대상 없음**이 된 상태이고,
   그 상태를 지키는 것이 붙였다 뗐다 하는 것보다 싸다.
