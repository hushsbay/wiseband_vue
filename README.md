- 개발 진척도 : 약 90% (2025.8.19 현재 소켓 통신 로직 적용 완료 및 소스 정리중)<br>
- 개발자 : 이상병 (hushsbay@gmail.com)<br>
- 테스트 서버 : https://hushsbay.com:446/login (테스트용 아이디 제공)

# wiseband_vue (프론트엔드) + wiseband_nest (백엔드)

- Slack Clone 개발 건입니다. (Vue.js + Nest.js + MySql + Socket.io + Redis)
- 현재 개발 서버에 배포/테스트중인 단계입니다.
- 9월 이후 WiSE 인사/조직 데이터 및 포털 임베딩 작업 진행 예정입니다.


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

- 현재는 테스트 용도로 소켓접속 여부 표시 
- 각 탭의 Main.vue에서만 소켓 접속 (다른 vue로는 각 함수로 데이터 주고 받음)
- 아래 표는 소켓통신시 업무로직이 적용되는 3가지 방식에 대해 표시하고 있음
    . 방멤버들에게 전송 (예: 메시지 전송)
    . 브로드캐스트 (예: 사용자의 접속 여부는 전체 멤버에게 전송)
    . 특정 사용자에게만 전송 (예: 특정 사용자에 대한 VIP 설정 여부는 설정한 사용자에게만 표시하면 됨)
- 가능한 한 소켓통신시 업무로직을 넣지 않고 소켓으로는 단지 알림의 역할만 하고 알림을 받은 클라이언트는
  axios를 통해 데이터를 읽어오려 했음 (소켓공통루틴적용)
- 하지만, '온라인 여부'와 같은 로직은 서버에서 해당 사용자의 소켓이 접속되어 있는지를 읽어서 처리해야 
  하므로 별도의 소켓 코딩이 필요한 경우였음 (별도소켓코딩)

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_06_realtime1.png)
![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_07_realtime2.png)
    

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
    . 에디터<br>
    . 멘션<br>
    . MP4 스트리밍<br>
    . FFMPEG / OpenGraph<br>
    . 사용자/조직 데이터 연동<br>
    . 포털 페이지내 임베딩<br>

- Minor<br>
    . MySql Indexing 및 메모리 확장<br>


# 미개발 항목 (향후 2차 개발시 검토 - 인수인계시 협의)

- 설문 / 리마인더<br>
- 워크플로(자동화)<br>
- 캔버스<br>
- 리스트<br>
- 템플릿<br>
- AI 지원<br>
