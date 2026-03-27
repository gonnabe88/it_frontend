# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "megamenu-demo" [ref=e8]
      - heading "IT Portal" [level=1] [ref=e9]
      - paragraph [ref=e10]: 정보화사업 관리 시스템
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: 사원번호
        - textbox "사원번호" [ref=e14]:
          - /placeholder: 사원번호를 입력하세요
          - text: E001
      - generic [ref=e15]:
        - generic [ref=e16]: 비밀번호
        - generic [ref=e17]:
          - textbox "비밀번호" [ref=e18]:
            - /placeholder: 비밀번호를 입력하세요
            - text: wrongpassword
          - img [ref=e19]
      - button "로그인" [active] [ref=e21] [cursor=pointer]:
        - generic [ref=e22]: 
        - generic [ref=e23]: 로그인
    - paragraph [ref=e25]: 문의사항은 IT 담당자에게 연락해주세요.
  - paragraph [ref=e27]: © 2024 IT Portal. All rights reserved.
```