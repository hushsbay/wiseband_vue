개발 진척도 : 약 80% (2025.7.15 기준) => 현재 팀내 브리핑 자료 작성중


# wiseband_vue

- Slack Clone 개발 건 (Vue.js + Nest.js + MySql + socket.io)
- 팀 개발서버 배포 : 8월 예정 (현재 localhost 개발/테스트중)
- 일단 data polling 적용. 10월부터 socket.io 적용


# Layout

- 사내시스템에 들어오는 것이므로 슬랙과는 달리 채널에 대해서는 모든 워크스페이스를 통합해 보여주기로 함
- SPA Nested Routing (중첩 라우팅) : Main > Panel > MsgList / KeepAlive (캐싱)
- Multi Window / Multi Channel / Multi DM

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_02_layout.png)


# Data Polling

- 동일한 브라우저내 (Same Domain) 단 하나의 Polling만 운영하도록 함
- 브라우저탭간에는 Broadcast Channel API 및 LocalStorage를 이용, 경합을 통해 마스터를 설정
- 마스터가 닫히면 다른 탭이 마스터 역할을 이어 받음
- 마스터에서만 Polling 데이터를 받아 나머지 탭들에게 데이터 전달
- 실시간 데이터 반영을 위한 로깅 테이블 운영 (S_DATALOG_TBL)

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_03_datapolling.png)
    
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_04_logdata.png)    


# DB Table 구조

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_05_dbtable.png)


# 인증

- 임직원은 사내시스템인 WiSE에 이미 로그인이 된 것을 전제로 하므로 아래 화면이 필요없으나<br>
  개발자 편의상 로그인을 지원해 주는 것으로 함 (WiSE 사용자 아이디 비번 이용)
- 외부인은 아래 그림처럼 메일을 통한 OTP 인증으로 처리

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_01_authentication.png)
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_06_auth_membership.png)


# 메시지 권한

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_07_acl01.png)
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_08_acl02.png)


# 개발 완료 항목 (슬랙 기능 구현)

- 사이드 메뉴<br>
    . '더보기' 기능 (메뉴 개인화는 아직 미개발)<br>
- 메뉴별 패널<br>
    . 홈(채널) 워크스페이스(사용자그룹 통합 트리) : 슬랙은 워크스페이스별 별도 화면<br>
    . DM<br>
    . 내활동 : VIP/스레드/반응 탭 (맨션은 나중 웹에디터 개발시 같이 진행 예정)<br>
    . 나중에(later)<br>
    . 고정(fixed)<br>
    . 그룹<br>
- 메시지 리스트<br>
    . 파일/이미지/링크 업로드<br>
    . 심플 이미지 뷰어<br>
    . 안읽은 메시지 및 읽음 처리 : 여기 샘플 이미지 붙이기<br>


