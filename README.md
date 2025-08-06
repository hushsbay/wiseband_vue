- 개발 진척도 : 약 90% (2025.8.6 현재 소켓 관련 코딩중)<br>
- 개발자 : 이상병 (hushsbay@gmail.com)<br>
- 테스트 서버 : https://hushsbay.com:446/login (테스트용 아이디 제공)

# wiseband_vue (프론트엔드) + wiseband_nest (백엔드)

- Slack Clone 개발 건입니다. (Vue.js + Nest.js + MySql + socket.io)
- 현재 개발 서버에 배포/테스트중인 단계입니다.
- 1차 개발 마지막 단계인 socket.io 및 에디터 적용은 8월~9월 동안 진행될 예정입니다.
- 이 시기에 사내 ERP인 WiSE에 인사/조직 데이터 및 포털 임베딩 작업도 진행될 예정입니다.


# Structure / Flow

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_01_structure_flow.png)


# DB Table 구조

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_02_db_table.png)


# 인증

- 임직원은 사내시스템인 WiSE에 이미 로그인이 된 것을 전제로 하므로 별도 로그인 페이지가 필요없으나<br>
  외부에서 유입되는 테스트 사용자를 위한 로그인을 아래 그림과 같이 지원해 주는 것으로 함
- 아울러, 외부인은 아래 그림처럼 메일을 통한 OTP 인증으로 처리

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_03_authentication.png)
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_04_auth_membership.png)


# Layout

- 사내시스템에 들어오는 것이므로 슬랙과는 달리 채널에 대해서는 모든 워크스페이스를 통합해 보여주기로 함
- SPA Nested Routing (중첩 라우팅) : Main > Panel > MsgList / KeepAlive (캐싱)
- Multi Window / Multi Channel / Multi DM

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_05_layout.png)


# 안읽은 메시지 관리

- 안읽은 메시지는 아래와 같이 도착 및 표시됨

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_11_notyet.png)


# Context Menu

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_12_contextmenu.png)


# 리얼타임 데이터 반영 (socket.io/redis)

- 동일한 브라우저내 (Same Domain) 단 하나의 접속 포인트만 유지하도록 함
- 브라우저탭간에는 Broadcast Channel API 및 LocalStorage를 이용, 경합을 통해 마스터를 설정
- 마스터가 닫히면 다른 탭이 마스터 역할을 이어 받음
- 마스터에서만 데이터를 받아 나머지 탭들에게 데이터 전달
- 실시간 데이터 반영을 위한 로깅 테이블 운영 (S_DATALOG_TBL)

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_06_realtime.png)
    
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_07_logdata.png)    


# 메시지 권한

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_08_acl.png)
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_09_acl.png)


# 컴포넌트간 함수호출 관련 정리

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_10_컴포넌트간_호출함수명_정리.png)


# 개발 완료 주요 항목 (슬랙 기능 구현)

- 사이드 메뉴<br>
    . '더보기' 기능 (메뉴 개인화는 아직 미개발)<br>
- 메뉴별 패널<br>
    . 홈(채널) 워크스페이스(사용자그룹 통합 트리)<br>
    . DM<br>
    . 내활동 : VIP/스레드/반응 탭 (맨션은 나중 에디터 개발시 같이 진행 예정)<br>
    . 나중에(later)<br>
    . 고정(fixed)<br>
    . WS(워크스페이스)<br>
- 메시지 리스트<br>
    . 파일/이미지/링크 업로드<br>
    . 심플 이미지 뷰어<br>
    . 안읽은 메시지 및 읽음 처리<br>


# 추가 개발 예정 항목 (슬랙 기능 구현 - 10월말까지)

- Major<br>
    . 소켓 통신<br>
    . 에디터<br>
    . 멘션<br>
    . MP4 스트리밍<br>
    . FFMPEG / OpenGraph<br>
    . 사용자/조직 데이터 연동<br>
    . 포털 페이지내 임베딩<br>

- Minor<br>
    . MySql Indexing 및 메모리 확장<br>
    . 사용자옵션 : 자리비움 설정, 알림 설정<br>


# 미개발 항목 (향후 2차 개발시 검토 - 인수인계시 협의)

- 설문 / 리마인더<br>
- 워크플로(자동화)<br>
- 캔버스<br>
- 리스트<br>
- 템플릿<br>
- AI 지원<br>
