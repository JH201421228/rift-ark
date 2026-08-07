# 사전 과제 PDF 제출물

| 번호 | 제출물 | PDF | 편집 원본 |
|---|---|---|---|
| 3 | 게임 소개 및 설명 문서 | `03-game-introduction.pdf` | `03-game-introduction.html` |
| 4 | AI 활용 기술 문서 | `04-ai-usage-technical-document.pdf` | `04-ai-usage-technical-document.html` |

## PDF 다시 만들기

Windows에서 Google Chrome을 설치한 뒤 저장소 루트에서 실행한다.

```powershell
node submission/render-pdfs.mjs
```

Chrome이 기본 위치에 없다면 `CHROME_PATH` 환경 변수에 실행 파일 경로를 지정한다.

## 제출 전 필수 수정

`03-game-introduction.html`의 다음 자리표시자를 실제 주소로 교체하고 PDF를 다시 만든다.

- GitHub Pages 또는 APK 테스트 배포 플레이 링크
- 30~60초 YouTube 플레이 영상 링크

PDF는 위 HTML과 `assets/submission.css`에서 생성한다. PDF만 직접 편집하지 않는다.
