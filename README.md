개발 진척도 : 약 80% (2025.7.15 기준)


# wiseband_vue

- Slack Clone 개발 건 (Vue.js + Nest.js + MySql + socket.io)
- 팀 개발서버 배포 : 8월 예정 (현재 localhost 개발/테스트중)
- 일단 data polling 적용. 10월부터 socket.io 적용


# 개요

1. 인증

    - 임직원은 사내시스템인 WiSE에 이미 로그인이 된 것을 전제로 하므로 아래 화면이 필요없으나<br>
      개발자 편의상 로그인을 지원해 주는 것으로 함 (WiSE 사용자 아이디 비번 이용)

    - 외부인은 아래 그림처럼 메일을 통한 OTP 인증으로 처리

![image](https://github.com/hushsbay/wiseband_vue/blob/master/PT_01_authentication.png)












