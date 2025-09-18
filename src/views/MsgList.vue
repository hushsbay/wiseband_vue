<script setup>
    import { ref, onMounted, nextTick, useTemplateRef, onActivated, onDeactivated, onUnmounted } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import PopupImage from "/src/components/PopupImage.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"
    import PopupChanDm from "/src/components/PopupChanDm.vue"
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import MediaSearch from "/src/components/MediaSearch.vue"
    import MemberList from '/src/components/MemberList.vue'

    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    defineExpose({ procFromParent, procMainToMsglist })
    const emits = defineEmits(["ev-to-parent", "ev-to-panel"]) 
    const props = defineProps({ data: Object }) //자식에서만 사용 : props update 문제 유의
    
    let observerTop = ref(null), observerTopTarget = ref(null), observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false), showTopObserver = ref(true), showBottomObserver = ref(true), scrollDir

    const MAX_PICTURE_CNT = 4, adminShowID = ref(false)
    const g_userid = gst.auth.getCookie("userid"), g_usernm = gst.auth.getCookie("usernm")
    let mounting = true, appType //appType은 거의 패널타입인데 msglist도 들어 있어 panelType으로 정의하지 않음 (WS/GS 구분은 chanType을 사용)
    
    let widthChanCenter = ref('calc(100% - 20px)')
    let widthChanRight = ref('0px') //MsgList가 부모나 자식상태 모두 기본적으로 가지고 있을 넓이
    const scrollArea = ref(null), msgRow = ref({}) //msgRow는 element를 동적으로 할당

    let popupRefKind = ref('') //아래 ~PopupRef의 종류 설정
    const imgPopupRef = ref(null), imgParam = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련
    const linkPopupRef = ref(null), linkText = ref(''), linkUrl = ref('')
    const mediaPopupRef = ref(null), popupChanDmRef = ref(null), memberlistRef = ref(null)
        
    let subTitle = '', sideMenu, chanId, msgidInChan
    let grid = ref(''), chanNm = ref(''), chanMasterId = ref(''), chanMasterNm = ref(''), chanImg = ref('') //grnm = ref(''), 
    let vipStr = ref(''), pageData = ref('')
    let chandtl = ref([]), chanmemUnder = ref([]), chandtlObj = ref({}), chanmemFullExceptMe = ref([]), chanType = ref('WS')
    let msglist = ref([]), threadReply = ref({}), tabForNewWin = ref('')

    let editMsgId = ref(''), prevEditData = "", showHtml = ref(false)
    let msgbody = ref('') //ref("<p>강나루 \"건너서\" <span style='font-weight:bold;text-decoration:line-through'>밀밭 <b>길이</b></span> <span style='text-decoration:line-through'>구름에</span> 달 <del>가듯이</del> 가는 나그네<span style='font-weight:800'><br>길은 외줄기</span> 남도 삼백리 술익는 <span style='color:blue'>마을마다</span> <span style='color:red;font-weight:bold'>타는 저녁놀</span> 구름에 \"달 <strong>가듯이</Strong>\" 가는 나그네</p>")
    let uploadFileProgress = ref([]), uploadImageProgress = ref([]) //파일, 이미지 업로드시 진행바 표시 (현재는 용량 작게 제한하므로 거의 보이지도 않음)
    let linkArr = ref([]), fileBlobArr = ref([]), imgBlobArr = ref([]) //파일객체(ReadOnly)가 아님. hover 속성 등 추가 관리 가능

    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 올라갈 때마다 점점 이전의 작은 일시가 저장됨
    let savNextMsgMstCdt = hush.cons.cdtAtFirst //가장 작은 일시(1111-11-11)로부터 시작해서 스크롤이 내려갈 때마다 점점 다음의 큰 일시가 저장됨   
    let onGoingGetList = false, prevScrollY = 0, prevScrollHeight //, getAlsoWhenDown = ""

    //dm 보내기 (신규)
    let showUserSearch = ref(false), userSearchedRef = useTemplateRef('userSearchedRef')
    let userSearched = ref([]), userAdded = ref([]), dmChanIdAlready = ref('')
    let searchInput = ref('searchInput'), searchedResultTop = ref(85)
    let searchUser = '', searchText = ref('') //keyup 이벤트의 한글 문제때문에 searchuser 사용(현재는 keyup마다 axios호출안함). searchText는 procClearSearch에만 사용

    //실시간 반영
    let realLastCdt = '', pageShown = 'Y'
    let newParentAdded = ref([]), newChildAdded = ref([]), memIdTyping = ref([]), memNmTyping = ref([])
    let bc2, fifo = [], fifoLen = ref(0) //fifoLen은 화면 표시용 (나중에 제거)
    let timerChkTyping

    //멘션 
    const showMentionDropdown = ref(false), mentionQuery = ref('')
    const mentionPosition = ref({ top: 0, left: 0 }), userToSearch = ref(''), userToSearchFocused = ref(false), userToSearchRef = useTemplateRef('userToSearchInput')
    const selectedMentionIndex = ref(0), filteredUsers = ref([])

    //##0 웹에디터 https://ko.javascript.info/selection-range
    //https://velog.io/@longroadhome/%EB%AA%A8%EB%8D%98JS-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-Range%EC%99%80-Selection
    //https://stefan.petrov.ro/inserting-an-element-at-cursor-position-in-a-content-editable-div/ => 목적이 다르고 헛점도 많이 보이지만 참고할 만한 내용도 많음
    //아래 변수는 storeCursorPosition()의 주석 참조
    let prevRange //let cursorPos = { node: null, startOffset: 0, endOffset: 0 } curPos 말고 prevRange로 기억하면 훨씬 간편해서 막음 (코딩은 그대로 둠)
    let editorIn = ref(false), editorBlurDt = Date.now()
    let inEditor = useTemplateRef('editorRef') //editor = document.getElementById(editorId) editor 대신 inEditor (템플릿 참조) 사용
    let stateBold = ref(false), stateStrike = ref(false)

    //라우팅 관련 정리 : 현재는 부모(Main) > 자식(각종Panel) > 손자(MsgList) 구조임 : 스레드(댓글)용으로 손자안에 동일한 손자(MsgList)가 있는데 그건 컴포넌트로 바로 처리 (라우팅 아님)

    const observerTopScroll = () => { //위로 스크롤하는 경우
        observerTop.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {
                showTopObserver.value = true
                if (scrollDir == 'up') { 
                    await getList({ prevMsgMstCdt: savPrevMsgMstCdt })
                }
                setTimeout(function() { showTopObserver.value = false }, 500)
            } else {
                return
            }
        }) //아래 observerTopTarget이 null로 나와서 오류 발생하는 것은 ##34처럼 vipStr에 데이터 담을 때 오류가 발생해 멈췄기 때문에 
        observerTop.value.observe(observerTopTarget.value) //observerTopTarget 랜더링까지 실행이 되지 않아 발생하는 것일 수 있음
    }

    const observerBottomScroll = () => { //아래로 스크롤하는 경우 : https://0422.tistory.com/349
        observerBottom.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {                
                showBottomObserver.value = true
                if (scrollDir == 'down') { //하단에서 위로 스크롤시 자꾸 getList()를 호출해서 down일 떄만 호출하도록 체크하는 것임
                    await getList({ nextMsgMstCdt: savNextMsgMstCdt }) //현재 두번 호출되는 문제 해결 필요
                }
                setTimeout(function() { showBottomObserver.value = false }, 500)
            } else {
                return
            }
        }, /*{ 
            threshold: 0, (default 0)
            root: document.querySelector("#chan_center_body")
        }*/) //처음 가져와서 데이터가 딱 아래까지만 찼을 때 맨 아래 스크롤시 계속 빠르게 깜빡임 : 바로 위 getList() 계속 실행함 => 상단/하단 무한 스크롤 있는 MsgList.vue에서만 나타나는 현상
        observerBottom.value.observe(observerBottomTarget.value)
    }

    onMounted(async () => {
        try { //console.log(hasProp() + "MsgList Mounted.. " + route.fullPath) //if (!gst.util.chkOnMountedTwice(route, 'MsgList')) return
            subTitle = hush.util.getRnd() + 'M'
            const arr = route.fullPath.split("/") //무조건 길이는 2이상임 => /main/dm/dm_body
            appType = arr[2] //home,dm,later,msglist..
            if (appType == "msglist" && route.query.appType) appType = route.query.appType //새창에서열기 또는 링크복사시 arr[2]는 msglist이므로 appType을 다시 가져와야 함
            if (hasProp()) {
                setBasicInfoInProp()
                await getList({ msgid: msgidInChan, kind: "withReply" })
            } else {   
                if (route.fullPath == "/main/dm/dm_body_new") {
                    showUserSearch.value = true
                } else {
                    setBasicInfo() //여기는 패널로부터 호출되기도 하지만 새로고침시 (캐시제거 등) 비동기로 패널보다 MsgList가 먼저 호출되기도 할 수도 있을 것에 대비 (예: 패널의 선택 색상)
                    if (msgidInChan) { //예) 새창에서 열기하면서 메시지아이디가 붙어 있으면 atHome이 되는 것임
                        await getList({ msgid: msgidInChan, kind: "atHome" })
                        inEditor.value.focus() 
                    } else if (tabForNewWin.value != "") {
                        listMsg(tabForNewWin.value)
                    } else {
                        console.log("getList Start - onMounted")
                        await getList({ prevMsgMstCdt: savPrevMsgMstCdt }) //기본적인 조회 패턴임
                        console.log("getList End - onMounted")
                        inEditor.value.focus()               
                    }
                    observerTopScroll()
                    observerBottomScroll()
                }
                if (route.fullPath.includes('/body/msglist')) { //Main.vue가 있는 곳은 이미 아래 이벤트가 처리되고 있으므로 없는 곳에서만 추가 (onMounted만 발생하고 onActivated는 없음)
                    document.addEventListener("visibilitychange", () => {
                        pageShown = (document.hidden) ? 'N' : 'Y'
                        pageShownChanged(pageShown)
                    }) //아래 2개는 듀얼 모니터로 테스트시에는 다른쪽에서 누르면 또 다른 한쪽은 항상 blur 상태이므로 관련 테스트가 제대로 안될 것임 (제대로 테스트하려면 2대를 놓고 해야 함)
                    window.addEventListener('focus', function() {
                        pageShown = 'Y' 
                        pageShownChanged(pageShown)                        
                    })
                    window.addEventListener('blur', function() {
                        pageShown = 'N' 
                        pageShownChanged(pageShown)
                    })
                    pageShownChanged(pageShown)
                    procRsObj()
                    window.focus() //focus()해야 blur()도 발생함
                }                
            }
            if (route.fullPath.includes('/body/msglist')) {
                bc2 = new BroadcastChannel("wbRealtime2") //각 탭의 Main.vue <=> MsgList.vue : Main.vue의 onMounted 주석 참조   
                bc2.onmessage = (e) => { getBroadcast2(e.data) }
            }
            chkMultiState()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => { // 초기 마운트 또는 캐시상태에서 다시 삽입될 때마다 호출 : onMounted -> onActivated 순으로 호출됨
        try { //Main.vue가 없는 MsgList.vue는 keepalive가 안되므로 여기 onActivated 거치지 않음을 유의
            if (!route.fullPath.includes("_body/")) return //MsgList인데 route.fullPath가 /main/home인 경우가 가끔 발생. 원인 파악 안되어 일단 차단
            //console.log("MsgList Activated.. " + route.fullPath+'..'+mounting)
            gst.chanIdActivted = chanId //리얼타임 반영을 위해 Main.vue로 전달하는 값으로, 현재 화면에 떠 있는 채널아이디를 의미
            if (mounting) { //맨 처음 onMounted직후 여기로 들어오게 됨 (mounting = true)
                mounting = false
            } else { //여기 else는 onMounted 직후 따라오는 onActivated에서는 실행이 안되고 onActivated 단독으로 실행될 때 처리되는 루틴임
                subTitle = subTitle.replace("M", "A")
                if (hasProp()) {
                    setBasicInfoInProp()
                } else {
                    setBasicInfo()
                    //observerTopScroll()
                    //observerBottomScroll()
                    pageShownChanged('Y')      
                } //아래는 (mounting=true일 때도 할 필요없고 onMounted 거치지 않고 onActivated때만 실행해야 하는 (예: Back() 눌렀을 때) 루틴임 (그래서 아래 부분은 onMounted()에도 없음)
                //Main.vue가 없는 MsgList.vue는 keepalive가 안되고 Back()도 불가능하므로 여기 onActivated를 아예 거치지 않음을 유의
                const key = msgidInChan ? msgidInChan : sideMenu + chanId
                if (gst.objSaved[key]) {
                    if (scrollArea.value) scrollArea.value.scrollTop = gst.objSaved[key].scrollY
                }
                if (gst.routedToSamePanelFromMsgList) { //아래는 사이드 메뉴 같은 경우만 실행됨 : 사용자가 방내 범위내에서 노드를 클릭하거나 뒤로가기를 눌렀는데 사이드 메뉴가 안바뀌고 해당 패널내에서 라우팅하는 경우
                    //console.log("MsgList Activated selectRow.." + appType + "==="+ chanId)
                    if (appType == "home" || appType == "dm") {
                        evToPanel({ kind: "selectRow", chanid: chanId })
                    } else if (appType == "activity" || appType == "later" || appType == "fixed") {
                        evToPanel({ kind: "selectRow", msgid: msgidInChan })
                    }
                }
                //chkMultiState()
            }            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onDeactivated(() => {
        pageShownChanged('N')
        clearTimeout(timerChkTyping)
    })

    onUnmounted(() => {
        if (observerTop && observerTop.value) observerTop.value.disconnect()
        if (observerBottom && observerBottom.value) observerBottom.value.disconnect()
        pageShownChanged('N')
        clearTimeout(timerChkTyping)
        if (bc2) bc2.close()
    })

    function setBasicInfo() {
        sideMenu = gst.selSideMenu
        if (!sideMenu) sideMenu = "mnu" + appType.substring(0, 1).toUpperCase() + appType.substring(1)
        if (route.params.chanid) chanId = route.params.chanid
        const pMsgid = route.params.msgid        
        if (pMsgid == hush.cons.state_nodata) {
            pageData.value = pMsgid
        } else if (pMsgid == "notyet" || pMsgid == "unread") { //스레드에서는 미사용
            tabForNewWin.value = pMsgid //현재 열린 MsgList.vue에서 처리시 다시 메시지 탭을 누르면 처음부터 조회되는 등 문제가 많아 별도 창으로 분리
        } else if (pMsgid == "0" || pMsgid == "nocache") { //현재 nocache는 사용처 없음
            //skip
        } else if (pMsgid) {
            msgidInChan = pMsgid //댓글의 msgid일 수도 있음
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////
    //스레드(댓글) 관련 : 부모 MsgList와 자식 MsgList가 혼용되어 코딩되어 있으므로
    //네이밍 규칙을 정해서, thread라는 단어가 들어가면 거의 부모 / prop이라는 단어가 들어가면 거의 자식
    //부모,자식 동시에 떠 있는 경우 문제되는 element는 파일업로드(file_upload)와 웹에디터(msgContent) 2개인데 hasProp() 맟 childbody로 구분해 사용

    //const hasProp = computed(() => { if (props.data && props.data.msgid) return true; return false; }) //값이 변할때만 계산하므로 효율적이나
    //computed대신 바로 아래 함수 사용. computed는 템플리트 밖<script setup>에선 반드시 true/false로만 비교해야 함. if (hasProp)으로 비교하면 안됨
    function hasProp() { //props 사용하는 것은 자식이므로 hasProp으로 명명. 위 computed 이용해 처리하고자 했으나 동작 이상 포기 : 캐싱없이 매번 계산하나 이 함수 사용
        if (props.data && props.data.msgid) return true //자식이 열린 상태임을 의미
        return false
    }

    const msglistRef = ref(null) //MsgList(부모)가 MsgList(자식)의 procFromParent()를 호출하기 위함
    let listMsgSel = ref('all')
    let thread = ref({ msgid: null, msgidChild: null }) //부모에서만 사용 (컴포넌트에서 자식에게 data로 전달함)
    const editorId = hasProp() ? "msgContent_prop" : "msgContent"

    function openThread(msgid, msgidChild) { //부모에서만 사용. 라우터로 열지 않고 컴포넌트로 바로 열기
        if (hasProp()) return
        if (thread.value.msgid) handleEvFromChild({ type: "close" })
        setTimeout(function() {
            thread.value.msgid = msgid //메시지아이디를 전달해 자식에게 화면을 open하라고 전달하는 것임
            thread.value.msgidChild = msgidChild //부모 아래 있는 댓글아이디를 찾을 때만 사용)
            setWidthForThread()
        }, 100)
    }

    async function handleEvFromChild(obj) { //부모에서만 사용. 자식에게서 전달받아 이벤트 처리하는 것임
        if (obj.type == "close") {
            thread.value.msgid = null //메시지아이디를 null로 해서 자식에게 close하라고 전달하는 것임
            setWidthForThread(null, obj.type)
        }
    }

    function setWidthForThread(openWith, type) { //openWith : 향후 마우스 드래그나 버튼 방식으로 넓이 조정 가능하도록 하기 위함
        if (type == "close") {
            widthChanRight.value = '0px'
            widthChanCenter.value = 'calc(100% - 20px)'            
        } else {
            if (openWith) {
                //위 설명 참조
            } else {
                widthChanRight.value = '500px'
                widthChanCenter.value = 'calc(100% - 520px)'                
            }
        }
    }

    function setBasicInfoInProp() {
        if (route.params.chanid) {
            chanId = route.params.chanid
        }
        if (props.data.msgid) { //route가 아님을 유의
            msgidInChan = props.data.msgid //댓글의 msgid일 수도 있음
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////

    async function chkDataLogEach(obj) { //전제조건은 logdt/realLastCdt 모두 같은 시계를 사용(여기서는, db datetime을 공유해 시각이 동기화)해야 하는데
        try { //서버의 chanmsg/qry()를 읽을 때 logdt(최초만)/realLastCdt가 동시에 정해지므로 아래에서 사용해도 로직에 문제가 없을 것임
            //logdt을 쓰는 이유는 1) 삭제된 데이터도 리얼타임에 반영해야 하고 2) qry()가 읽어 오는 데이터가 마지막까지 항상 읽어오지 않고 중간 데이터만 읽어 오는 상황이 있기 때문임
            //MsgList에서 이 chkDataLogEach()를 타이머로 돌리면 각 라우팅에 해당하는 현재 채널에 대해 모두 처리가 되므로 그게 장점보다는 백에 있는 채로 데이터를 계속 가져오는 모습이 되므로 바람직하지는 않을 것임
            //대신에 Main.vue(타이머) > 각 패널.vue > MagList로 전달되는 흐름에서는 MsgList가 라우팅되어 백단으로 가더라도 타이머가 없으니 데이터가 전달되지 않고 현재 패널과 연결되어 있는 MsgList의 
            //라우팅 채널으로만 (리얼타임반영 데이터가) 전달되므로 훨씬 효율적임 (onActivated/Deactivated에서 타이머를 끄고 켤 필요가 없음)
            const arr = obj.list
            const len = arr.length
            let cdtBottom
            const eleBottom = getBottomMsgBody() //화면이 뒤로 가 있으면 undefined
            if (eleBottom) {
                const idxBottom = gst.util.getKeyIndex(msgRow, eleBottom.id)
                if (idxBottom > -1) cdtBottom = msglist.value[idxBottom].CDT
            }
            ////////////////////////////////////////////////////////////////
            let realShown
            const objChanid = gst.objByChanId[chanId]
            if (!objChanid) {
                realShown = 'N' //pageShown
            } else {
                realShown = (objChanid.realShown == 'Y') ? 'Y' : 'N'
            }
            //넘어오는 항목(SELECT) : MSGID, REPLYTO, CUD, MAX(CDT) MAX_CDT : 본문에서의 MAX_CDT는 C,D는 유일하게 1개일 것이며 U정도만 효용성이 있음
            //따라서, 아래 C,X의 경우 MAX_CDT를 해당 메시지의 CDT(생성일시)로 봐도 무방함
            let cdtAtFirst = hush.cons.cdtAtLast, msgidAtFirst = '', cdtAtFirstForChild = hush.cons.cdtAtLast, msgidAtFirstForChild = ''
            let panelUpdateNotyetCnt = false, panelRefreshRow = false, panelProcAll = false
            for (let i = 0; i < len; i++) {
                const row = arr[i] //원칙직으로 스레드에서는 리얼타임 반영을 위한 polling이 없고 row.msgItem.data에는 부모메시지 정보만 담는 것으로 되어 있음 (스레드로는 아이디만 넘겨서 서버 호출)
                if (row.CHANID == chanId) {
                    if (row.SUBKIND == 'readall') { //서버 chanmsg>updateAllWithNewKind() 참조
                        newParentAdded.value = []
                        newChildAdded.value = []
                        const len = msglist.value.length                        
                        for (let i = 0; i < len; i++) {
                            const item = msglist.value[i]
                            await refreshMsgDtlWithQryAction(item.MSGID)
                            item.replyinfo[0].MYNOTYETCNT = 0
                        }
                        if (appType == "home" || appType == "dm") {
                            panelUpdateNotyetCnt = true
                        } else if (appType == "activity") {
                            panelProcAll = true
                        } //나머지는 여기서 처리할 필요없음
                    } else if (row.TYP == "read" || row.TYP == "react" || row.TYP == "user") {
                        const parentMsgid = (row.REPLYTO == "") ? row.MSGID : row.REPLYTO
                        const idx = gst.util.getKeyIndex(msgRow, parentMsgid)
                        if (idx > -1) {
                            refreshWithGetMsg(row.msgItem.data, null, idx) //부모 메시지
                            if (msglistRef.value) {
                                if (row.REPLYTO == "") { //유사코딩이 3개나 되지만 부모자식 헷갈리지 않게 코딩 축약하지 말고 이해하기 쉽게 쓰기
                                    msglistRef.value.procFromParent("refreshMsg", { msgid: row.MSGID }) //스레드 부모 메시지 업데이트
                                } else {
                                    msglistRef.value.procFromParent("refreshMsg", { msgid: row.REPLYTO }) //스레드 부모 메시지 업데이트
                                    msglistRef.value.procFromParent("refreshMsg", { msgid: row.MSGID }) //스레드 자식 메시지 업데이트
                                }
                            }
                        }
                        if (row.TYP == "read" && row.CUD == "D") deleteFromNewAdded(row) 
                        //아래는 패널 업데이트
                        if (row.TYP == "read") {
                            if (appType == "home" || appType == "dm") { //DM패널에 안읽음 체크시 처리하는 것은 아래 evToPanel({ kind: "updateNotyetCnt", chanid: chanId })에서 전달받아 패널에서 처리
                                panelUpdateNotyetCnt = true
                            } else if (appType == "activity") { //패널에 안읽음 체크시 처리하는 것은 패널에서 전달받아 처리
                                panelProcAll = true
                            } //나머지는 여기서 처리할 필요없음
                        } else if (row.TYP == "react") {
                            if (appType == "activity") {
                                panelProcAll = true
                            } //나머지는 여기서 처리할 필요없음
                        } else if (row.TYP == "user") {
                            if (appType == "later" || appType == "fixed") {
                                panelProcAll = true
                            } //나머지는 여기서 처리할 필요없음
                        }
                    } else if (row.TYP == "msg") {
                        if (row.CUD == "C") {
                            if (row.KIND == "parent") { //서버로부터 이미 업데이트된 데이터를 가져온 상태가 아님 (row.msgItem 없음)
                                //중간에 이빨 빠진 메시지가 있는 상태에서 새로운 메시지가 오면 사용자 입장에서는 무조건 자동으로 화면에 뿌리지 말고 표시만 하다가 사용자가 누르면 표시하기
                                console.log(row.BODYTEXT+"==="+savNextMsgMstCdt+"==="+realLastCdt+"==="+cdtBottom+"==="+realLastCdt+"==="+realShown )
                                if (savNextMsgMstCdt < realLastCdt || (cdtBottom && cdtBottom < realLastCdt) || realShown != 'Y') {
                                    //맨 마지막까지 읽어온 경우라도 사용자가 내용보려고 위로 스크롤링 했을 때도 새로운 메시지 온다고 해서 내리면 불편하므로 여기로 와야 함
                                    if (row.USERID != g_userid) {
                                        newParentAdded.value.push({ MSGID: row.MSGID, REPLYTO: row.REPLYTO, CDT: row.CDT })
                                    }
                                } else if (realLastCdt && savNextMsgMstCdt > realLastCdt) {
                                    //savNextMsgMstCdt은 1111-11-11이고 realLastCdt은 빈칸이면 최초 생성 데이터이므로 여기로 오면 안되고 scrollToBottom으로 처리
                                } else { //qry()로 데이터 끝까지 읽어온 상태이므로 리얼타임으로 화면에 바로 반영해도 됨 (배열에 추가)
                                    if (row.CDT < cdtAtFirst) { //건건이 뿌리는 것이 아닌 한번에 처리하기 위함
                                        cdtAtFirst = row.CDT
                                        msgidAtFirst = row.MSGID
                                    }
                                } //신규 부모메시지 생성시엔 스레드가 없는 상태이므로 스레드에 대한 리얼타임 반영은 필요없음
                            } else { //child : 무조건 부모메시지(row.REPLYTO)로 아래 로직 처리되고 있음
                                if (row.USERID != g_userid) {
                                    newChildAdded.value.push({ MSGID: row.MSGID, REPLYTO: row.REPLYTO, CDT: row.CDT })
                                }
                                const idx = gst.util.getKeyIndex(msgRow, row.REPLYTO)
                                if (idx > -1) { //이미 내려받은 부모메시지 정보인 row.msgItem.data가 있으므로 서버 호출안해도 됨
                                    refreshWithGetMsg(row.msgItem.data, row.REPLYTO) //화면에 있는 부모메시지 업데이트
                                    if (msglistRef.value) { //스레드 열려 있으면 (다른 스레드일 수도 있지만 찾으면) 부모메시지 업데이트하고 자식메시지는 추가함
                                        msglistRef.value.procFromParent("refreshMsg", { msgid: row.REPLYTO })
                                        if (row.CDT < cdtAtFirstForChild) { //건건이 뿌리는 것이 아닌 한번에 처리하기 위함
                                            cdtAtFirstForChild = row.CDT
                                            msgidAtFirstForChild = row.REPLYTO
                                        }
                                    }
                                }
                            }
                            if (realShown != 'Y' && row.USERID != g_userid) {
                                gst.realtime.procNoti(row)
                            }
                        } else if (row.CUD == "U") { //메시지 수정 : 수정된 메시지는 새로운 메시지가 아닌 안읽은 메시지로만 정의함
                            const parentMsgid = (row.REPLYTO == "") ? row.MSGID : row.REPLYTO
                            const idx = gst.util.getKeyIndex(msgRow, parentMsgid)
                            if (idx > -1) { //자식메시지 아닌 부모메시지는 이미 row.msgItem.data에 업데이트된 정보가 있으므로 그걸 바로 적용하면 됨
                                refreshWithGetMsg(row.msgItem.data, null, idx) //자식 수정시 안읽음으로 되고 안읽은갯수가 업데이트되어야 하므로 부모자식 구분없이 업데이트하기
                                if (msglistRef.value) {
                                    if (row.REPLYTO == "") { //유사코딩이 3개나 되지만 부모자식 헷갈리지 않게 코딩 축약하지 말고 이해하기 쉽게 쓰기
                                        msglistRef.value.procFromParent("refreshMsg", { msgid: row.MSGID }) //스레드 부모 메시지 업데이트
                                    } else {
                                        msglistRef.value.procFromParent("refreshMsg", { msgid: row.REPLYTO }) //스레드 부모 메시지 업데이트
                                        msglistRef.value.procFromParent("refreshMsg", { msgid: row.MSGID }) //스레드 자식 메시지 업데이트
                                    }
                                }
                            }
                        } else if (row.CUD == "D") { 
                            const parentMsgid = (row.REPLYTO == "") ? row.MSGID : row.REPLYTO
                            const idx = gst.util.getKeyIndex(msgRow, parentMsgid) //부모아이디로 찾으면 됨
                            if (idx > -1) {                            
                                if (row.REPLYTO == "") {
                                    const lastIndex = msglist.value.length - 1
                                    msglist.value.splice(idx, 1) //const item = msglist.value[idx]
                                    if (idx < lastIndex) { //삭제한 메시지의 바로 다음 메시지는 무조건 메시지 작성자의 이미지와 이름이 무조건 보여야 그 위 메시지의 작성자와 혼동되지 않음
                                        const item = msglist.value[idx]
                                        item.stickToPrev = false
                                        item.hasSticker = false
                                    }
                                } else { //삭제한 MSGID가 댓글일 경우
                                    refreshWithGetMsg(row.msgItem.data, null, idx) //row.msgItem.data에 부모메시지 정보 들어 있음
                                    if (msglistRef.value) {
                                        msglistRef.value.procFromParent("refreshMsg", { msgid: parentMsgid })
                                        msglistRef.value.procFromParent("deleteMsg", { msgid: row.MSGID })
                                    }
                                }
                                await nextTick() //배열삭제된 부분이므로 동기 처리 필요
                            }
                            deleteFromNewAdded(row)
                        }
                        if (appType == "home") {
                            panelUpdateNotyetCnt = true
                        } else if (appType == "dm") { //dm은 채널이고 나머지는 메시지를 업데이트하는 것임
                            panelRefreshRow = true //본문이 수정되고 안읽음+1이 되므로 행 새로고침
                        } else if (appType == "activity" || appType == "later" || appType == "fixed") {
                            panelProcAll = true
                        }
                    } else if (row.TYP == "chan") { //이미 모든 패널에는 Main.vue에서 처리하므로 여기선 MsgList 상단 채널명과 멤버이미지만 처리하면 됨
                        if (row.KIND == 'mst' && row.CUD == 'D') { //삭제이므로 정보 없음
                            pageData.value = hush.cons.state_nodata
                        } else if (row.KIND == 'mem') { //채널관리에서 멤버추가든 삭제인 경우 패널에 해당 노드 반영 (반영후 소켓 join/leave 추가 실행)
                            panelProcAll = true
                        } else {
                            setChanMstDtl(row.chanmst, row.chandtl)
                        }
                    } else if (row.TYP == "group") { //이미 모든 패널에는 Main.vue에서 처리하므로 여기선 MsgList 상단 그룹명만 처리하면 됨
                        if (row.KIND == 'mst' && row.CUD == 'D') { //삭제이므로 정보 없음
                            pageData.value = hush.cons.state_nodata
                        } else {
                            //grnm.value = row.grnm
                        }
                    }
                } else { //채널이 다른 경우
                    //1) 위너에서는 MsgList에 열려 있지 않은 채널데이터들에 대한 리얼타임 반영은 Main.vue에서 처리되므로 여기로 들어오는 일은 없음
                    //2) 그러나, 새창에서 열린 MsgList 단독에서는 해당 채널 데이터든 아니든 여기로 모두 들어오므로 자기 채널이 아닌 것은 여기서 그냥 skip하면 됨
                }
            }
            if (cdtAtFirst < hush.cons.cdtAtLast) { //loop에서 C 케이스가 있으면 신규로 들어온 맨 처음 메시지부터 끝까지 추가 (X는 아님)
                chkProcScrollToBottom(cdtAtFirst, msgidAtFirst) //여기서는 부모메시지만 있으므로 특정 싯점 이후로 추가해도 순서가 흐트러지지 않고 문제없음
            }
            if (cdtAtFirstForChild < hush.cons.cdtAtLast) {
                if (msglistRef.value) msglistRef.value.procFromParent("addChildFromBody", { msgidReply: msgidAtFirstForChild })
            }
            //아래 2행은 home,dm에 대해서만 패널로 전달해 처리하는 것인데 이 2개만 채널을 단위로 처리하는 것임. 나머지 패널인 activity,later,fixed는 msgid 단위이므로 여기서 처리안됨
            if (panelRefreshRow) evToPanel({ kind: "refreshRow", chanid: chanId, appType: appType }) //dm만 해당
            if (panelUpdateNotyetCnt) evToPanel({ kind: "updateNotyetCnt", chanid: chanId }) //안읽은 처리는 워낙 빈도가 높아서 행 새로고침에서 별도로 뺀 것임. 나머지는 왠만하면 refeshRow로 처리
            if (panelProcAll) evToPanel({ kind: "procRows" }) //home,dm도 procRows로 할 수는 있으나 부하, 효율성 등을 고려해 일단 activity,later,fixed만 여기서 처리함
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function sendSockObjToMain(obj) { //###01
        if (bc2) {
            bc2.postMessage(obj)
        } else {
            gst.sockToSend.push(obj)
        }
    }

    function chkMultiState() { //###01
        try {
            //1) chkTyping :  뒤늦게 온라인으로 들어오는 멤버 고려하면 매번 소켓으로 전송하는 수 밖에 없어 보임 (원래는 입력중인데 멤버에 들어 있거나 입력중이지 않는데 멤버에도 들어 있지 않으면 굳이 알릴 필요없음)
            let body = document.getElementById(editorId).innerText.trim() //innerHtml로 하면 다 지워도 <br>이 남아 있어서 innerText로 처리
            let data = { ev: "chkTyping", roomid: chanId, userid: g_userid, usernm: g_usernm, typing: null, from: "chkMultiState" }
            data.typing = (body.length > 0) ? true : false
            sendSockObjToMain({ sendTo: "room", data: data })
            //2) ckhAlive
            const userids = chandtl.value.map(item => item.USERID)
            let data1 = { ev: "chkAlive", userids: userids, from: "chkMultiState" }
            sendSockObjToMain({ sendTo: "myself", data: data1 })
        } catch (ex) {
            console.log("chkMultiState: " + ex.message) //skip
        } finally {
            timerChkTyping = setTimeout(function() { chkMultiState() }, 3000)
        }
    }

    async function procRsObj() { //넘어오는 양에 비해 여기서 (오류발생 등으로) 처리가 안되면 계속 쌓여갈 수 있으므로 그 경우 경고가 필요함
        let gap
        try {            
            if (fifo.length > 0) {
                const rsObj = { list: fifo[0] }
                await chkDataLogEach(rsObj)
                fifo.splice(0, 1)
                gap = 100
            } else {
                gap = 500
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        } finally {
            setTimeout(function() { procRsObj() }, gap)
        }
    }

    function pageShownChanged(ps) { //ps=pageShown
        if (chanId) gst.realtime.setObjToChan(chanId, "realShown", ps)
    }

    function getBroadcast2(data) { //if (route.fullPath.includes('/body/msglist')) 일 경우만 채널 생성
        if (data.kind && data.data && data.data.ev) { //소켓통신 관련
            if (data.data.ev == "chkTyping") {
                handleTypingInfo(data.data)
            } else if (data.data.ev == "chkAlive") { //console.log(JSON.stringify(data))
                handleAliveInfo(data.data)
            } else {
                //여기로 오지 않고 Main.vue에서 data polling으로 처리 완료되는 경우임
            }
        } else {
            if (data.code == 'pollingToMsgList') { //별도 창의 Main.vue로부터 polling된 data를 받아 서버호출없이 탭내에서 리얼타임 처리하는 것임
                //chkDataLogEach(data.obj) //data.obj=rs <= bc.postMessage({ code: 'polling', obj: rs })
                //그런데, chkDataLogEach() 바로 호출시 (동기화가 되어 있지 않기 때문에) 그 뒤에 따라오는 다음 순번 객체에 침해당할 수 있으므로, 막고 별도 배열에 추가하고 처리후 제거하는 아래 루틴 필요
                fifo.push(data.obj) //data.obj(Array) => 배열에 다시 배열이 추가되는 모습으로서 그렇지 않으면 first in first out이 쉽지 않음
                fifoLen.value = fifo.length
            }
        }
    }

    function saveCurScrollY(posY) {
        if (!sideMenu || !chanId) return
        const key = msgidInChan ? msgidInChan : sideMenu + chanId
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = posY
    }

    function chanCtxMenu(e) {
        gst.ctx.data.header = ""
        let disableStr1 = false
        let disableStr2 = (chanMasterId.value == g_userid) ? false : true
        if (route.fullPath.includes('/body/msglist')) {
            disableStr1 = true
            disableStr2 = true
        }
        gst.ctx.menu = [
            { nm: "방 나가기", disable: disableStr1, func: async function(item, idx) { //MemberList.vue에서 삭제(퇴장)시 순서에 관한 주석 참조 요망
                try {
                    if (!confirm("퇴장후 방 관리자의 초대가 없으면 다시 들어올 수 없습니다. 계속할까요?")) return
                    const rq = { CHANID: chanId, USERID: g_userid, chkOnly: true } //chkOnly: true 중요
                    const res = await axios.post("/chanmsg/deleteChanMember", rq) //순서는 MemberList.vue의 deleteChanMember() 참조
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    let body = hush.cons.roomLeftPrefix + g_usernm
                    const rq1 = { crud: "C", chanid: chanId, msgid: null, replyto: null, body: body, bodytext: body }
                    const res1 = await axios.post("/chanmsg/saveMsg", rq1)
                    const rs1 = gst.util.chkAxiosCode(res1.data)
                    if (!rs1) return
                    const rq2 = { CHANID: chanId, USERID: g_userid }
                    const res2 = await axios.post("/chanmsg/deleteChanMember", rq2)
                    const rs2 = gst.util.chkAxiosCode(res2.data)
                    if (!rs2) return
                    gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomLeave", roomid: chanId, memberIdLeft: [g_userid], memberNmLeft: [g_usernm], from: "deleteMember" }})
                    gst.sockToSend.push({ sendTo: "room", data: { ev: "deleteChanMember", roomid: chanId, from: "deleteMember" }})
                    await router.replace({ name: appType + "_dumskel" }) //DummySkeleton.vue 설명 참조 
                    evToPanel({ kind: "refreshPanel" })
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }},
            // { nm: "방 삭제", disable: disableStr2, func: async function(item, idx) { //소켓통신 데이터 전달 및 UI 측면에서도 여기서는 지원하지 않기로 함
            //     try {
            //         if (!confirm("방 전체 삭제를 진행합니다. 계속할까요?")) return
            //         const rq = { CHANID: chanId }
            //         const res = await axios.post("/chanmsg/deleteChan", rq)
            //         const rs = gst.util.chkAxiosCode(res.data)
            //         if (!rs) return //evToPanel({ kind: "delete", chanid: chanId })
            //         gst.sockToSend.push({ sendTo: "room", data: { ev: "deleteChan", roomid: chanId, from: "chanCtxMenu" }})
            //         await router.replace({ name: appType + "_dumskel" }) //DummySkeleton.vue 설명 참조                    
            //         evToPanel({ kind: "refreshPanel" })
            //     } catch (ex) { 
            //         gst.util.showEx(ex, true)
            //     }
            // }}
        ]
        gst.ctx.show(e)
    }

    async function listMsg(kind) {
        listMsgSel.value = 'all' //kind
        //msglist.value = []
        if (kind == 'all') { //kind == unread일 경우 현재 막아 두었는데 향후 필요시 사용하게 될 수도 있음
            //savPrevMsgMstCdt = hush.cons.cdtAtLast
            //await getList({ prevMsgMstCdt: savPrevMsgMstCdt })
        } else { //아래는 새창에서 수행됨을 유의. setBasicInfo()dml tabForNewWin 설명 참조
            if (tabForNewWin.value != '') { //if (route.fullPath.includes('/body/msglist')) { //체크 안하면 윈도우 오픈 (무한)
                await getList({ kind: kind })
            } else {
                const url = gst.util.getUrlForBodyListNewWin(chanId, kind)
                window.open(url)
            }
        }
    }

    let test_idx = 0
    async function stressTest(start) { //서버 chanmsg>qry 참조 : curdtObj.DT.replace('2025-', '1111-')
        if (start) test_idx = 0
        msgbody.value = test_idx.toString()
        await nextTick()
        await saveMsg()
        test_idx++
        if (test_idx >= 100) return
        setTimeout(function() { stressTest() }, 1)
    }

    function openSearchInchan(tab) {
        mediaPopupRef.value.open(tab, chanId, chanNm.value, chanImg.value, "")
    }

    function chkWithinTime(dt1, dt2) {
        const secondDiff = hush.util.getDateTimeDiff(dt1, dt2)
        const minuteDiff = parseInt(secondDiff / 60)
        return (minuteDiff <= 1) ? true : false
    }

    function setChanMstDtl(chanmstParam, chandtlParam) {
        try {
            document.title = chanmstParam.CHANNM + " [채널-" + subTitle + "]"
            grid.value = chanmstParam.GR_ID
            //grnm.value = chanmstParam.GR_NM
            chanNm.value = chanmstParam.CHANNM
            chanMasterId.value = chanmstParam.MASTERID
            chanMasterNm.value = chanmstParam.MASTERNM
            chanImg.value = gst.util.getChanImg(chanmstParam.TYP, chanmstParam.STATE)
            chanType.value = chanmstParam.TYP
            chanmemUnder.value = [] //예) 11명 멤버인데 4명만 보여주기. 대신에 <div v-for="idx in MAX_PICTURE_CNT" chandtl[idx-1]로 사용가능한데 null 발생해 일단 대안으로 사용중
            chanmemFullExceptMe.value = []
            const len = chandtlParam.length
            for (let i = 0; i < len; i++) {
                const row = chandtlParam[i]
                if (row.USERID != g_userid) chanmemFullExceptMe.value.push(row.USERNM)
                /* 이미지는 아래 비동기콜백으로 처리해야 속도 이슈 없음
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                if (i < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: row.url })*/
                chandtlObj.value[row.USERID] = row //chandtl은 array로 쓰이는 곳이 훨씬 많을테고 메시지작성자의 blobUrl은 object로 관리하는 것이 효율적이므로 별도 추가함                
                gst.realtime.getUserImg(row, function(uid, data) {
                    const url = (data.PICTURE) ? hush.util.getImageBlobUrl(data.PICTURE.data) : null
                    chandtlObj.value[uid].url = url
                    if (chanmemUnder.value.length < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: url })
                })
            }
            chandtl.value = chandtlParam
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    //1) prevMsgMstCdt : EndlessScroll 관련 (가장 오래된 일시를 저장해서 그것보다 더 이전의 데이터를 가져 오기 위함. 화면에서 위로 올라가는 경우임)
    //2) nextMsgMstCdt : EndlessScroll 관련 (가장 최근 일시를 저장해서 그것보다 더 최근의 데이터를 가져 오기 위함. 화면에서 아래로 내려가는 경우임)
    //3) nextMsgMstCdt + kind(scrollToBottom) : 발송 이후 작성자 입장에서는 맨 아래로 스크롤되어야 함 (리얼타임 반영시에도 특정 싯점 아래 모두 읽어와 보여주는데 싯점이 여러가지 있음)
    //4) nextMsgMstCdt + kind(scrollToBottom) + msgidReply : 스레드에서 발송 이후 작성자 입장에서는 맨 아래로 스크롤되어야 함 (리얼타임 반영시에도 특정 싯점 아래 모두 읽어와 보여줌)
    //5) msgid + kind(atHome) : 홈메뉴에서 메시지 하나 전후로 가져와서 보여 주는 UI (from 나중에..내활동..) : 조회후 스크롤링 위아래로 움직이는 무한스크롤 1), 2)를 지원함
    //6) msgid + kind(withReply) : 홈메뉴에서 댓글보기 누르면 오른쪽에 부모글+댓글 리스트로 보여 주는 UI : 조회하면 끝이며 무한스크롤 없음
    //7) kind(all, notyet, unread, msg, file, image) : msgid 없음
    async function getList(addedParam) {
        try {
            if (onGoingGetList || pageData.value == hush.cons.state_nodata) return
            onGoingGetList = true
            let param = { chanid: chanId } //chanid는 기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const prevMsgMstCdt = param.prevMsgMstCdt
            const nextMsgMstCdt = param.nextMsgMstCdt
            const msgid = param.msgid
            const kind = param.kind
            const msgidReply = param.msgidReply //읽어서 스레드에 댓글 추가
            if (msgid && (kind == "atHome" || kind == "withReply")) {
                savNextMsgMstCdt = hush.cons.cdtAtFirst
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            //console.log("getList 000 : " + JSON.stringify(param))
            const res = await axios.post("/chanmsg/qry", param)
            //console.log("getList 111")
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) {
                onGoingGetList = false                
                return
            }
            vipStr.value = ("," + rs.data.vipStr + ",") ?? "none" //데이터 없어서 null일 수도 있음 ##34
            if (savNextMsgMstCdt == hush.cons.cdtAtFirst || (msgid && kind == "atHome")) {
                setChanMstDtl(rs.data.chanmst, rs.data.chandtl) //2)중에서도 맨처음만 처리 그리고 5) 경우에도 처리함 : 다른 경우에도 처리시 유저이미지가 계속 번쩍거리게 될 것임
            }
            if (msgid && (kind == "atHome" || kind == "withReply")) {
                msglist.value = [] //홈에서 열기를 선택해서 열린 것이므로 목록을 초기화함
                //MsgList내에서 이 목록 배열을 초기화하면 고통이 따르는데 MsgList.vue가 onMounted() 된다는 것임 : 아직 동작 원리는 이해하지 못함
                //따라서, 패널에서 호출한 경우가 아니면 MsgList에서 바로 배열 초기화하는 것은 극도로 유의해서 처리하기로 함
            }
            const msgArr = rs.data.msglist
            if (msgArr.length == 0) {
                onGoingGetList = false
                afterScrolled.value = false
                return 
            }
            const msgidParent = rs.data.msgidParent //atHome만 사용함 (댓글인 경우는 부모 아이디)
            const msgidChild = rs.data.msgidChild //atHome만 사용함 (msgidParent와 다르면 이건 댓글의 msgid임)
            for (let i = 0; i < msgArr.length; i++) { //msgArr[0]가 가장 최근일시임 (CDT 내림차순 조회 결과)
                const row = msgArr[i]
                const idx = gst.util.getKeyIndex(msgRow, row.MSGID)
                if (idx > -1) { //리얼타임 반영시 기존에 있는 메시지를 추가하면 안되므로 찾아서 업데이트하는 것임
                    refreshWithGetMsg(row, null, idx)
                } else {
                    if (kind == "withReply") {
                        if (i == 0) {
                            row.background = "beige"
                        } else if (row.MSGID == props.data.msgidChild) {
                            row.background = hush.cons.color_athome
                        }
                    } else {
                        if (msgidParent && row.MSGID == msgidParent) {
                            row.background = hush.cons.color_athome
                        }
                    }
                    gst.util.handleMsgSub(row)
                    //동일한 작성자가 1분이내 작성한 메시지는 프로필없이 바로 위 메시지에 붙이기 (자식/부모 각각 입장) - 구현하긴 했지만 과연 이게 더 깔끔하고 사용자 친화적인가 의문
                    //stickToPrev = 이전 메시지에 현재 메시지가 붙어 있는 모습 (1분이내 같은 사용자)
                    //hasSticker = 이전 메시지 입장에서 아래에 1분이내 같은 사용자가 붙어 있는 모습
                    const curAuthorId = row.AUTHORID
                    const curCdt = row.CDT.substring(0, 19)
                    if (nextMsgMstCdt || kind == "withReply") { //오름차순으로 일부를 읽어옴
                        if (i == 0) { //제일 오래된 메시지므로 false
                            row.stickToPrev = false //nextMsgMstCdt + scrollToBottom의 경우 한 행만 존재해서 항상 i == 0 여길 타게 되어 stickToPrev = false로 나타나나 새로고침하면 제대로 보일 것임 (일단 경미한 사안)
                        } else {
                            if (curAuthorId != msgArr[i - 1].AUTHORID) { //현재 메시지의 작성자와 직전(더 오래된 i - 1)의 메시지 작성자가 다르면 false
                                row.stickToPrev = false
                            } else {
                                const prevCdt = msgArr[i - 1].CDT.substring(0, 19)
                                row.stickToPrev = chkWithinTime(prevCdt, curCdt) //같은데 1분이내면 true
                            }
                        }
                        if (i == msgArr.length - 1) { //제일 최근 메시지이므로 false
                            row.hasSticker = false
                        } else {
                            if (curAuthorId != msgArr[i + 1].AUTHORID) { //현재 메시지의 작성자와 직후(더 최신인 i + 1)의 메시지 작성자가 다르면 false
                                row.hasSticker = false
                            } else {
                                const nextCdt = msgArr[i + 1].CDT.substring(0, 19)
                                row.hasSticker = chkWithinTime(curCdt, nextCdt) //같은데 1분이내면 true
                            }
                        } //예) 기존 메시지리스트 = [26일데이터, 27일데이터, 28일데이터] / 새로 읽어온 리스트 = [29일, 30일, 31일]
                        msglist.value.push(row) //기존 메시지리스트 맨 아래에 추가
                    } else { //내림차순
                        if (i == msgArr.length - 1) { //제일 오래된 메시지므로 false
                            row.stickToPrev = false
                        } else {
                            if (curAuthorId != msgArr[i + 1].AUTHORID) { //현재 메시지의 작성자와 직전(더 오래된 i + 1)의 메시지 작성자가 다르면 false
                                row.stickToPrev = false
                            } else {
                                const prevCdt = msgArr[i + 1].CDT.substring(0, 19)
                                row.stickToPrev = chkWithinTime(prevCdt, curCdt) //같은데 1분이내면 true
                            }
                        }
                        if (i == 0) {
                            row.hasSticker = false //제일 최근 메시지이므로 false
                        } else {
                            if (curAuthorId != msgArr[i - 1].AUTHORID) { //현재 메시지의 작성자와 직후(더 최신인 i - 1)의 메시지 작성자가 다르면 false
                                row.hasSticker = false
                            } else {
                                const nextCdt = msgArr[i - 1].CDT.substring(0, 19)
                                row.hasSticker = chkWithinTime(curCdt, nextCdt) //같은데 1분이내면 true
                            }
                        } //예) 기존 메시지리스트 = [26일데이터, 27일데이터, 28일데이터] / 새로 읽어온 리스트 = [25일, 24일, 23일]
                        msglist.value.splice(0, 0, row) //jQuery prepend와 동일 (메시지리스트 맨 위에 삽입)
                    }
                }
                if (row.CDT > savNextMsgMstCdt) savNextMsgMstCdt = row.CDT
                if (row.CDT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.CDT
            }            
            realLastCdt = rs.list.length > 0 ? rs.list[0].CDT : "" //SELECT MSGID, CDT FROM S_MSGMST_TBL WHERE CHANID = ? AND REPLYTO = '' ORDER BY CDT DESC LIMIT 1
            imgBlobArr.value = []
            for (let item of rs.data.tempimagelist) {
                const blobUrl = hush.util.getImageBlobUrl(item.BUFFER.data)
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: item.CDT })
            }
            fileBlobArr.value = []
            for (let item of rs.data.tempfilelist) {
                fileBlobArr.value.push({ hover: false, name: item.BODY, size: item.FILESIZE, cdt: item.CDT })
            }
            linkArr.value = []
            for (let item of rs.data.templinklist) {
                let text, url
                const arr = item.BODY.split(hush.cons.deli)
                if (arr.length == 1) {
                    text = item.BODY
                    url = item.BODY
                } else {
                    text = arr[0]
                    url = arr[1]
                }
                linkArr.value.push({ hover: false, text: text, url: url, cdt: item.CDT })
            }
            //console.log("getList 222")
            await nextTick()
            const tagArr = document.querySelectorAll(".clickable")
            tagArr.forEach(item => {
                const zuserid = item.getAttribute("data-userid")
                const zusernm = item.getAttribute("data-usernm")
                const user = { USERID: zuserid, USERNM: zusernm }
                if (item._mentionClickHandler) item.removeEventListener('click', item._mentionClickHandler)
                item._mentionClickHandler = (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    memProfile(e, user)
                }
                item.addEventListener('click', item._mentionClickHandler)
            })
            if (msgidParent && kind == "atHome") { //msgid가 댓글인 경우 부모의 msgid가 필요함 (msgidParent)
                if (msgRow.value[msgidParent]) { //자식에서는 atHome에서는 1개이므로 문제가 없고 withReply에서는 msgid가 화면에 2개 중복될 수도 있으나 맨위로 가므로 문제없을 것임
                    msgRow.value[msgidParent].scrollIntoView()
                }
                if (msgidParent != msgidChild) { //atHome만 해당. 예) 댓글에 '나중에'가 있어서 열어서 표시 필요
                    setTimeout(function() { openThread(msgidParent, msgidChild) }, 100) //setTimeout() 크게 문제되어 보이지 않음
                }
            } else if (msgid && (kind == "withReply")) { //이미 openThread()되어 있는 상태
                if (msgRow.value[props.data.msgidChild]) {
                    msgRow.value[props.data.msgidChild].scrollIntoView()
                }
                threadReply.value = msglist.value[0]
            } else if (prevMsgMstCdt == hush.cons.cdtAtLast || kind == "notyet" || kind == "unread") { //notyet, unreadsms 내림차순으로 예를 들어, 1000개만 가져옴
                if (scrollArea.value) scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (prevMsgMstCdt) { //위로 스크롤링 할 때
                if (msgArr.length > 0) { //스크롤이전에 prevScrollY + 새로 더해진 scrollHeight (scrollArea.value.scrollHeight - prevScrollHeight)을 더해서 scrollArea의 scrollTop을 구하면 됨
                    if (scrollArea.value) scrollArea.value.scrollTop = prevScrollY + (scrollArea.value.scrollHeight - prevScrollHeight)
                } else {
                    //스크롤 위치는 그대로임 //scrollArea.value.scrollTop = prevScrollY
                }
            } else if (nextMsgMstCdt && kind == "scrollToBottom" && !msgidReply) { //스크롤 맨 아래로 위치
                if (scrollArea.value) scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
                setTimeout(function() { readMsgToBeSeen() }, 500) //스크롤 이벤트와 충돌 날수도..하지만 맨 아래 데이터 가져와서 읽음 처리 안되는 경우가 생겨 추가한 것임
            } else if (nextMsgMstCdt) {
                //그냥 두면 됨
            }
            setTimeout(function() { //초기데이터 말고는 getList + onScroll이 readMsgToBeSeen()을 두번 실행하게 하는데 이 경우 msgdtl에 read kind 필드값이 2개 이상 insert됨
                //방안: afterScrolled이 true이면 이미 스크롤 된 것이므로 여기서 readMsgToBeSeen() 호출하지 말고 true가 아닐 경우(갯수가 작아 스크롤이 안되는 경우)만 호출하기로 함
                if (!afterScrolled.value) readMsgToBeSeen()
            }, 1000) //클릭해도 읽음 처리됨
            onGoingGetList = false
            console.log("getList 333")
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    async function getMsg(addedParam, verbose) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryMsg", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                if (verbose) gst.util.setToast(rs.msg)
                return null
            }
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function refreshWithGetMsg(rs, msgid, idx) {
        try {
            let item = msgid ? msglist.value.find(function(row) { return row.MSGID == msgid }) : msglist.value[idx]
            if (item) {                 
                item.BODY = rs.msgmst ? rs.msgmst.BODY : rs.BODY
                item.UDT = rs.msgmst ? rs.msgmst.UDT : rs.UDT
                item.act_later = rs.act_later
                item.act_fixed = rs.act_fixed
                item.msgdtl = rs.msgdtl
                //item.msgdtlmention = rs.msgdtlmention //지우지는 말고 참고로 두기로 함
                item.msgfile = rs.msgfile
                item.msgimg = rs.msgimg
                item.msglink = rs.msglink
                item.reply = rs.reply
                item.replyinfo = rs.replyinfo
                gst.util.handleMsgSub(item)
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function qryActionForUser(addedParam) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryActionForUser", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function memProfile(e, row) { //mention시 넘어오는 user.USERID와 user.USERNM을 이 함수에서도 받아 같이 사용함
        const zid = row.AUTHORID ? row.AUTHORID : row.USERID
        const znm = row.AUTHORNM ? row.AUTHORNM : row.USERNM
        const userObj = chandtlObj.value[zid]
        const imgUrl = (userObj && userObj.url) ? userObj.url : gst.html.getImageUrl('user.png')
        gst.ctx.data.header = "<img src='" + imgUrl + "' class='coImg32' style='margin-right:5px;border-radius:16px'>" + znm
        const displayStr = vipStr.value.includes(',' + zid + ',') ? "해제" : "설정"
        const bool = vipStr.value.includes(',' + zid + ',') ? false : true
        gst.ctx.menu = [
            { nm: "DM 보내기", func: async function() { //1대1은 새창에서 여는 게 효율적일 수도 ..
                //1) DM의 newDm()을 호출하려면 dm 라우팅을 타야 함 2) 홈패널의 MsgList에서 DM 라우팅하면 MsgList가 수회 반복되는 문제 발생함 (Dm 패널로 가서 처리하려면 Main.vue까지 가서 Dm을 불러야 함)
                try {
                    const res = await axios.post("/menu/qryDmChkExist", { member: [zid] })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return null
                    let chanid = rs.data.chanid
                    if (!chanid) { //둘만의 방이 없으므로 새로 추가해야 함
                        const SYNC = chandtlObj.value[zid] ? chandtlObj.value[zid].SYNC : "Y"
                        const rq = { CHANID: "new", MEMBER: [{ USERID: zid, USERNM: znm, SYNC: SYNC }] } //신규 DM방 생성 (멤버도 함께 생성)
                        const res = await axios.post("/chanmsg/saveChan", rq)
                        const rs = gst.util.chkAxiosCode(res.data)
                        if (!rs) return
                        chanid = rs.data.chanid
                        localStorage.wiseband_lastsel_dmchanid = chanid
                    }
                    openDmRoom(chanid, true) //window.open("/body/msglist/" + chanid + "/0?appType=dm")
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }},
            { nm: "VIP " + displayStr, func: async function(item, idx) {
                try {
                    const res = await axios.post("/user/setVip", { 
                        list: [{ USERID: zid, USERNM: znm }], bool: bool
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    gst.sockToSend.push({ sendTo: "user", data: { ev: "setVip", userid: g_userid, from: "setVip" }})
                    if (bool) { //위 소켓으로 커버되나 일단 그대로 둠
                        vipStr.value += zid + ","
                    } else {                    
                        vipStr.value = vipStr.value.replace(zid + ",", "")
                    }
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        let textRead, oldKind, newKind
        const url = gst.util.getUrlForBodyListNewWin(chanId, row.MSGID, appType)
        const msgdtlRow = row.msgdtl.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
        if (msgdtlRow) {
            oldKind = msgdtlRow.KIND
            if (msgdtlRow.KIND == "read") {
                textRead = "다시읽지않음으로 처리"
                newKind = "unread"
            } else {
                textRead = "읽음으로 처리"
                newKind = "read"
            }
        } else {
            oldKind = "notyet"
            textRead = "읽음으로 처리"
            newKind = "read"
        }
        const disableStr = (hasProp() && index == 0) ? true : false
        const colorStr = (hasProp() && index == 0) ? "" : "red"
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                window.open(url)
            }},
            { nm: textRead, disable: disableStr, func: async function(item, idx) {
                if (oldKind == "notyet" && newKind == "read") {
                    await updateNotyetToRead(row.MSGID)
                } else {
                    await updateWithNewKind(row.MSGID, oldKind, newKind)
                }
            }},
            { nm: "채널로 메시지 전달", disable: disableStr, func: function(item, idx) {
                forwardMsg("home", row.MSGID)
            }},
            { nm: "DM으로 메시지 전달", disable: disableStr, func: function(item, idx) {
                forwardMsg("dm", row.MSGID)
            }},
            { nm: "메시지 링크로 복사", disable: disableStr, func: function(item, idx) {
                navigator.clipboard.writeText(url).then(() => { //http://localhost:5173/body/msglist/20250122084532918913033403/0
                    gst.util.setToast("메시지 링크가 복사되었습니다.")
                }).catch(() => {
                    gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                })
            }},
            { nm: "메시지 편집", disable: disableStr, func: function(item, idx) {
                editMsgId.value = row.MSGID
                prevEditData = document.getElementById(editorId).innerHTML
                if (prevEditData.trim() != "") {
                    gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
                    return
                }
                msgbody.value = row.BODY
                inEditor.value.focus()
            }},
            { nm: "메시지 삭제", disable: disableStr, color: colorStr, func: async function(item, idx) {
                try {
                    if (!window.confirm("삭제후 복구가 불가능합니다. 진행할까요?")) return
                    const res = await axios.post("/chanmsg/delMsg", { 
                        msgid: row.MSGID, chanid: chanId
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    gst.sockToSend.push({ sendTo: "room", data: { ev: "delMsg", roomid: chanId, msgid: row.MSGID, from: "rowRight" }})
                    //gst.realtime.emit("room", { ev: "delMsg", roomid: chanId, msgid: row.MSGID, from: "delMsg" })
                    //msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    async function rowClick(row) { //msglist가 크면 클수록 바쁘게 랜더링이 돌아갈텐데 단순 클릭으로 행 위치 알려 주는 정도인 아래 코딩에서는 부담없을 것임
        msglist.value.forEach(item => item.background = '')
        row.background = hush.cons.color_athome //setTimeout(function() { row.background = "" }, 1000) //1초후에 적용되지 않고 row.hover해서 렌더링한 후에 바로 적용됨
        for (let i = 0; i < row.msgdtl.length; i++) {
            const item = row.msgdtl[i]
            if (item.KIND == 'notyet') { //스크롤 없을 때 읽음처리하기 => 내가 아직 안읽은 메시지라면 클릭하면 읽음 처리됨 (향후 대안 더 생각해보기)
                if ((', ' + item.ID + ',').includes(', ' + g_userid + ',')) {
                    await updateNotyetToRead(row.MSGID)
                }
                break
            }
        } //gst.realtime.closeNoti(chanId)
    }

    const onScrolling = (e) => { //패널에 있는 onScrolling()에서와는 달리 여기서는 계속 onScrolling 반복되지 않아서 패널처럼 굳이 false 조건을 넣지 않음
        //패널에서는 안내문구가 들어 갔는데 여기서는 안내문구 없음 (무한스크롤 위아래방향 모두 처리. 안내문구 들어 가면 나중에 hide안되는 등 꼬이게 되므로 넣지 말기)
        if (!afterScrolled.value) {
            afterScrolled.value = true
            showBottomObserver.value = true
        }
        if (!scrollArea.value) return //오류 만났을 때
        if (scrollArea.value.scrollTop > prevScrollY) {
            scrollDir = 'down'
        } else if (scrollArea.value.scrollTop < prevScrollY) {
            scrollDir = 'up'
        }
        prevScrollY = scrollArea.value.scrollTop //자식에서도 prevScrollY는 필요함
        prevScrollHeight = scrollArea.value.scrollHeight
        if (hasProp()) return //자식에서는 한번에 모든 데이터 가져오므로 EndlessScroll 필요없음
        saveCurScrollY(prevScrollY)
    }

    const onScrollEnd = () => {
        readMsgToBeSeen() //사용자별 데이터지만 읽음 처리를 onScrolling에 두면 스크롤링하면서 초당 4~5회의 동일 데이터를 서버로 요청해서 업데이트를 시도하려 함 (table lock 체크 이전에 일단 스크롤종료시만 호출하는 것으로 변경함)
    }

    async function deleteFromNewAdded(row, parentMsgid, childMsgid) {
        try {
            let isParent, msgidToProc
            if (row) {
                isParent = (row.REPLYTO == "") ? true : false
                msgidToProc = row.MSGID
            } else {
                isParent = parentMsgid ? true : false
                msgidToProc = parentMsgid ? parentMsgid : childMsgid
            }
            if (isParent) { //부모메시지
                const idxFound = newParentAdded.value.findIndex(item => item.MSGID == msgidToProc)
                if (idxFound > -1) newParentAdded.value.splice(idxFound, 1)
                //아래는 원래 없었는데 다음과 같은 문제해결을 위해 추가된 것임. 창이 2개 이상 같은 채널이 열려 있을 때 하나만이라도 pageShown일 경우는 다른 창이 숨겨져 있어도 pageShown=Y로 보기로 함
                //그렇지 않으면, '도착 메시지'는 수동으로만 제거 가능하고 pageShown을 각 탭별로 별도로 인지하면 각각 관리가 되긴 하지만 이 경우는 읽음처리후 자동으로 숨기는 기능 구현이 어렵게 됨
                //첫행의 원안대로 하면, 동일 채널 창이 둘 다 숨겨져 있는 상태에서 메시지가 가서 하나를 열면 다른 하나의 '도착 메시지'버튼이 사라지면서 메시지가 추가되지 않는데 그걸 아래로 해결함
                //대신, 중간에 보려고 스크롤하는데 톡이 오면 아래로 내려가 버리는 현상이 생길 것임 - 동일 채널일 경우 해결 필요. 다만, 다른 채널끼리 열려 있으면 아무 문제없이 사용 가능함
                if (newParentAdded.value.length == 0) { //이 방안은 문제가 많아 개선이 필요함 : '메시지 도착'이 나타났다가 바로 사라지는 원인도 되므로 일단 막고 고민
                    //console.log('has to be fixed out.')
                    //await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom" }) //특정 싯점 다음부터 현재까지 새로 도착한 메시지를 가져옴
                }
            } else { //자식메시지
                const idxFound = newChildAdded.value.findIndex(item => item.MSGID == msgidToProc)
                if (idxFound > -1) newChildAdded.value.splice(idxFound, 1)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    //async function refreshMsgDtlWithQryAction(msgid, msgdtl) { //msgdtl 없으면 서버호출하는 것임
    async function refreshMsgDtlWithQryAction(msgid) { //서버의 updateNotyetToRead() 설명 참조 msgdtl 인자 막음
        try {
            const item = msglist.value.find(function(row) { return row.MSGID == msgid })
            if (!item) return
            //if (msgdtl) { //굳이 서버호출없어도 됨
            //    console.log(JSON.stringify(item.msgdtl)+"$$$$$$$"+JSON.stringify(msgdtl))
            //    item.msgdtl = msgdtl //해당 msgid 찾아 msgdtl을 통째로 업데이트
            //} else {
                const res = await axios.post("/chanmsg/qryAction", { msgid: msgid, chanid: chanId })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return null
                item.msgdtl = rs.list //해당 msgid 찾아 msgdtl을 통째로 업데이트
            //}
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function updateWithNewKind(msgid, oldKind, newKind) { //현재는 read<->unread 처리만 하므로 로킹 필요없으나 향후 추가시 로깅 처리 여부 체크 필요
        try {
            const rq = { chanid: chanId, msgid: msgid, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "user", data: { ev: "updateWithNewKind", userid: g_userid, from: "updateWithNewKind" }})
            //await refreshMsgDtlWithQryAction(msgid) //await refreshMsgDtlWithQryAction(msgid, rs.data.msgdtl)
            if (oldKind == "read" || oldKind == "unread") {
                if (listMsgSel.value == "notyet" || listMsgSel.value == "unread") { //notyet은 실제로는 사용자가 이미 읽은 상태이므로 read로 변경되어 있을 것임
                    const idx = msglist.value.findIndex((item) => item.MSGID == msgid)
                    if (idx > -1) msglist.value.splice(idx, 1)
                }
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function updateNotyetToRead(msgid) { //읽음처리중 notyet -> read 처리 전용 (워낙 빈도수가 많으므로 별도 구현)
        try {
            const rq = { chanid: chanId, msgid: msgid, oldKind: "notyet", newKind: "read" }
            const res = await axios.post("/chanmsg/updateNotyetToRead", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "room", data: { ev: "readMsg", roomid: chanId, msgid: msgid, from: "updateNotyetToRead" }})
            //await refreshMsgDtlWithQryAction(msgid) //await refreshMsgDtlWithQryAction(msgid, rs.data.msgdtl)
            if (hasProp()) { //스레드에서 내가 안읽은 갯수를 Parent에도 전달해서 새로고침해야 함
                deleteFromNewAdded(null, null, msgid)
            } else { 
                deleteFromNewAdded(null, msgid, null)
            }
            gst.realtime.closeNoti(chanId)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function updateAllWithNewKind(oldKind, newKind) { //현재는 읽기 관련 처리만 하므로 로킹 필요없으나 향후 추가시 로깅 처리 여부 체크 필요
        try { //새창에서 수행되고 있음 
            const rq = { chanid: chanId, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateAllWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "room", data: { ev: "readMsg", roomid: chanId, from: "updateAllWithNewKind" }})
            await listMsg('notyet')
            setTimeout(function() { window.close() }, 1000)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function chkProcScrollToBottom(cdtAtFirst, msgid) { //스레드(댓글) 아닌 부모글에만 사용함
        /* 1안) 지우지 말 것 (향후 소스 참고)
        if (newParentAdded.value.length > hush.cons.scrollToBottomMaxCount || (appType != "home" && appType != "dm")) {
            window.open("/body/msglist/" + chanId + "/" + msgid + "?appType=" + appType)
            //evToPanel({ kind: "getMsgListFromMsgid", chanid: chanId, msgid: msgid }, true) 
            //HomePanel에 소스 참조. 지우지 말 것 (향후 사용가능성) 패널로부터 라우팅 처리보다는 위 방법(window.open)으로
        } else { //home/dm이 아니면 scrollToBottom으로 처리시 순서 흐트러질 것임
            //원래 최초 개발시 savNextMsgMstCdt가 쓰였는데 savNextMsgMstCdt 다음부터 읽어오는 컨셉이었음
            //따라서, 아래 cdtAtFirst로 추가개발한 것을 조회하면 cdtAtFirst보다 큰 걸 조회하므로 cdtAtFirst가 cdt인 것은 누락되므로
            //cdtAtFirst보다 마이크로섹 작은 것으로 조회시 cdtAtFirst가 포함된 메시지는 누락안될 것임
            const modifiedCdt = cdtAtFirst.substring(0, cdtAtFirst.length - 1)
            console.log(modifiedCdt+"==="+cdtAtFirst)
            await getList({ nextMsgMstCdt: modifiedCdt, kind: "scrollToBottom" }) //getList() 안에 nextTick() 있음
        } 아래는 2안) */
        await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom" }) //getList() 안에 nextTick() 있음
    }

    async function addAllNew(strKind) { //home,dm에서만 버튼 보임
        try {
            let msgid, cdtAtFirst
            if (strKind == "P") { //Parent : 신규 부모글
                //if (newParentAdded.value.length == 0) return //사실 0이면 버튼이 안보일 것임
                msgid = newParentAdded.value[0].MSGID //가장 오래된 부모메시지부터 조회하도록 해야 사용자가 안놓침
                cdtAtFirst = newParentAdded.value[0].CDT
                chkProcScrollToBottom(cdtAtFirst, msgid) //여기서는 부모메시지만 있으므로 특정 싯점 이후로 추가해도 순서가 흐트러지지 않고 문제없음
                gst.realtime.closeNoti(chanId)
                newParentAdded.value = []
            } else { //Child : 신규 댓글
                //if (newChildAdded.value.length == 0) return //사실 0이면 버튼이 안보일 것임
                //가장 오래된 자식메시지의 부모아이디부터 조회하도록 해야 사용자가 안놓침
                const arr = newChildAdded.value //그런데, 그게 인덱스 0가 아닐 수도 있으므로 아래처럼 처리하고자 함
                arr.sort((a, b) => a.CDT.localeCompare(b.CDT)) //오름차순 정렬
                msgid = arr[0].REPLYTO //자식의 부모아이디
                cdtAtFirst = arr[0].CDT //여기선 msgid로 사용
                const url = gst.util.getUrlForBodyListNewWin(chanId, msgid, appType)
                const newWin = window.open(url)
                newWin.onload = function() {
                    //const arr = newWin.document.querySelectorAll(".chan_center_body")
                    //vue.js로 랜더링하는 바로 아래 class는 안읽혀서 vue.js 아녀도 바로 뿌려주는 class(chan_center_body)로 잡음
                    //하지만, 굳이 onload 필요없는게 newChildAdded.length가 0이면 어차피 안보이게 될 것이므로 있으면 보이고 없으면 안보이는게 더 좋음
                }
                newChildAdded.value = []
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function getElementsInViewportByClass(className) { //클래스에 해당하는 element가 너무 많으면 루프 돌리는데 부담이 될 것임
        const elements = document.querySelectorAll(`.${className}`)
        const elementsInViewport = []
        elements.forEach(element => {
            const rect = element.getBoundingClientRect()
            const isVisible = (
                rect.top >= 0 && //rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) //&& rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            )
            if (isVisible) elementsInViewport.push(element)
        })
        return elementsInViewport
    }

    async function readMsgToBeSeen() { //메시지가 사용자 눈에 (화면에) 보이면 읽음 처리하는 것임
        const eleInView = getElementsInViewportByClass("msg_body")
        for (let ele of eleInView) {
            const idx = gst.util.getKeyIndex(msgRow, ele.id)
            if (idx > -1) {
                const msgdtlArr = msglist.value[idx].msgdtl
                const msgdtlRow = msgdtlArr.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
                if (msgdtlRow) { //사용자인 내가 이미 읽은 메시지이므로 읽음처리할 것이 없음
                    //console.log(ele.id + " already read")
                } else {
                    const msgid = msglist.value[idx].MSGID
                    await updateNotyetToRead(msgid)
                    console.log(ele.id + " notyet")
                }
            }
        }        
    }

    // async function readMsgToBeSeen() { //getTopMsgBody()를 사용하면 id가 msgid인 element를 정확하게 가져와야 하는데 많은 노력이 필요함
    //     try {
    //         if (showUserSearch.value) return //DM방 만들기에서는 무시
    //         const eleTop = getTopMsgBody() //메시지 목록 맨 위에 육안으로 보이는 첫번째 row 가져오기 
    //         if (!eleTop) {
    //             return
    //         } else if (!eleTop.id) { //토스트메시지가 덮고 있을 경우일 수 있는데 엎어질 때까지 계속 Try하는데 스레드에서 try하면 Parent의 ele로 getTopMsgBody() 찾음
    //             setTimeout(function() { readMsgToBeSeen() }, 500) //토스트를 bottomMsg로 대체해서 여기 올 경우는 없을 것이나 그대로 둠
    //         } else {
    //             const idTop = eleTop.id
    //             const idx = gst.util.getKeyIndex(msgRow, idTop) //let idx = msglist.value.findIndex(function(row) { return row.MSGID == idTop })
    //             if (idx > -1) { //오름차순/내림차순 혼재되어 있는 상황이므로 단순화해서 그냥 앞뒤로 20개씩 전후로 모두 읽어서 화면에 보이는 것만 읽음 처리 (이미 읽었으면 처리할 필요 없음)
    //                 const len = msglist.value.length
    //                 const start = (idx - 10 < 0) ? 0 : idx - 10
    //                 const end = (idx + 10 > len - 1) ? len - 1 : idx + 10
    //                 const childbodyAttr = hasProp() ? true : false
    //                 const eleParent = document.querySelector("#chan_center_body[childbody=" + childbodyAttr + "]")
    //                 const eleHeader = document.getElementById("header") //Main.vue 참조 //높이 고정이므로 onMounted()로 빼도 됨
    //                 const eleHeaderHeight = eleHeader ? eleHeader.offsetHeight : 0 //Main.vue가 없는 msglist 라우팅의 경우도 있을 수 있음
    //                 const eleHeader1 = document.getElementById("chan_center_header") //높이 고정이므로 onMounted()로 빼도 됨
    //                 const eleNav = document.getElementById("chan_center_nav") //높이 고정이므로 onMounted()로 빼도 됨 (스레드에서는 안보임)
    //                 const topFrom = eleHeader1.offsetHeight + eleHeaderHeight + (hasProp() ? 0 : eleNav.offsetHeight)
    //                 for (let i = start; i <= end; i++) {
    //                     const msgdtlArr = msglist.value[i].msgdtl
    //                     const msgdtlRow = msgdtlArr.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
    //                     const msgid = msglist.value[i].MSGID
    //                     if (msgdtlRow) { 
    //                         //사용자인 내가 이미 읽은 메시지이므로 읽음처리할 것이 없음
    //                     } else {
    //                         const ele = msgRow.value[msgid]
    //                         if (ele) {
    //                             const rect = ele.getBoundingClientRect()
    //                             if ((rect.top - topFrom + 60) >= 0 && (rect.top - topFrom + 70) <= eleParent.offsetHeight) {
    //                                 await updateNotyetToRead(msgid) //알파값 60만큼 위에서 더 내려오거나 70만큼은 아래에서 더 올라와야 육안으로 보인다고 할 수 있음
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     } catch (ex) {
    //         console.log("readMsgToBeSeen ex: " + ex.message) //오류나도 넘어가기로 함
    //     }
    // }

    // const getTopMsgBody = () => { //육안으로 보이는 맨 위 MSGID의 div (msgbody 및 procMenu 클래스 보유) 찾기
    //     try {
    //         const childbodyAttr = hasProp() ? true : false
    //         const rect = hush.util.getRect("#chan_center_body[childbody=" + childbodyAttr + "]")
    //         if (!rect) return null
    //         const xx = rect.left + 100 //MSGID를 갖고 있는 div는 margin 및 좌표 고려해 xx, yy에 그 안의 값을 더하면 구할 수 있음
    //         let yy = rect.top + 60
    //         const ele = document.elementFromPoint(xx, yy)
    //         return ele
    //     } catch (ex) {
    //         gst.util.showEx(ex, true)
    //     }
    // }

    const getBottomMsgBody = () => { //육안으로 보이는 맨 아래 MSGID의 div 찾기
        try {
            if (hasProp()) return null
            const rect = hush.util.getRect(".chan_center_footer")
            if (!rect) return null
            const xx = rect.left + 1 //MSGID를 갖고 있는 div는 margin/padding이 각각 5px이므로 xx, yy에 그 안의 값을 더하면 구할 수 있음
            let yy = rect.top - 10
            const ele = document.elementFromPoint(xx, yy)
            return ele
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function delBlob(kind, msgid, idx, index) { //msgid = temp or real msgid
        try { //index는 메시지 배열의 항목 인덱스. idx는 그 항목내 file or image or link array의 인덱스
            let cdt = ""
            if (kind == "F") {
                cdt = (msgid == "temp") ? fileBlobArr.value[idx].cdt : msglist.value[index].msgfile[idx].cdt
            } else if (kind == "I") {
                cdt = (msgid == "temp") ? imgBlobArr.value[idx].cdt : msglist.value[index].msgimg[idx].cdt
            } else if (kind == "L") {
                cdt = (msgid == "temp") ? linkArr.value[idx].cdt : msglist.value[index].msglink[idx].cdt
            }
            const res = await axios.post("/chanmsg/delBlob", { 
                msgid: msgid, chanid: chanId, kind: kind, cdt: cdt
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (kind == "F") {
                if (msgid == "temp") {
                    fileBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgfile.splice(idx, 1)
                }
            } else if (kind == "I") {
                if (msgid == "temp") {
                    imgBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgimg.splice(idx, 1)
                }
            } else if (kind == "L") {
                if (msgid == "temp") {
                    linkArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msglink.splice(idx, 1)
                }
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function imgLoaded(e, row) {
        row.realWidth = e.currentTarget.naturalWidth
        row.readHeight = e.currentTarget.naturalHeight
    }

    async function pasteData(e) { //from paste event
        try {
            e.preventDefault() //tage의 .prevent가 안먹혀서 여기서 처리
            const pastedData = e.clipboardData.items //e.originalEvent.clipboardData.items
            if (pastedData.length == 0) return
            if (pastedData[0].type.includes("image")) { //예) image/png
                if (appType == "dm" && showUserSearch.value) {
                    gst.util.setSnack("DM방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                    return
                }
                if (editMsgId.value) {
                    gst.util.setToast("편집중인 메시지에는 이미지 붙이기가 불가능합니다.", 3)
                    return
                }
                const clipboardItem = pastedData[0]
                const blob = clipboardItem.getAsFile() //서버에 보낼 데이터
                const blobUrl = URL.createObjectURL(blob) //화면에 보여줄 데이터
                if (blob.size > hush.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 이미지 크기 제한은 " + hush.util.formatBytes(hush.cons.uploadLimitSize) + "입니다.\n" + "현재 => " + hush.util.formatBytes(blob.size), true)
                    return
                }
                const fd = new FormData()
                fd.append("chanid", chanId)
                fd.append("kind", "I")
                fd.append("body", "") //width x height 미리 넣을 필요없어 보이며 대신 빈칸으로 넣어야 함
                fd.append("filesize", blob.size)
                fd.append("file", blob)
                uploadImageProgress.value = { url: blobUrl, percent : 0 }
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => {
                        const percent = (e.loaded * 100) / e.total                        
                        uploadImageProgress.value.percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: rs.data.cdt })
            } else if (pastedData[0].type == "text/plain" || (pastedData.length >= 2 && pastedData[1].type == "text/html")) {
                const idx = (pastedData.length >= 2 && pastedData[1].type == "text/html") ? 1 : 0
                //1 : 클립보드에 text뿐만 아니라 html 데이터를 제공하므로 기본적으로 html을 적용시키는 것이 맞을 것임 
                //0 : html이 아닌 순수 text라고 봐야 함
                const clipboardItem = pastedData[idx]
                const type = clipboardItem.type
                clipboardItem.getAsString(function(str) { //const html = sanitizeHTML(str) //document.execCommand('insertHTML', false, (html))
                    insertPastedToEditor(type, str) //여기에 clipboardItem.type으로 참조하면 안읽히므로 위에서 미리 get
                })
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    } 
    
    function showImage(row, msgid) { //msgid = temp or real msgid
        try {
            imgParam.value = row
            imgParam.value.msgid = msgid
            imgParam.value.chanid = chanId
            imgPopupUrl.value = row.url
            imgPopupStyle.value = { width: row.realWidth + "px", height: row.realHeight + "px" }
            imgPopupRef.value.open()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    //function keyDownEnter(e) { //keyUpEnter가 아님
    //    if (e.shiftKey) {
    //        //나중에 옵션 주기
    //    } else {
    //        saveMsg() //일단 줄바꿈으로 동작하게 하기
    //    }
    //}

    // function getCaretPos(editableDiv) {
    //     var caretPos = 0, sel, range;
    //     if (window.getSelection) {
    //         sel = window.getSelection();
    //         if (sel.rangeCount) {
    //             range = sel.getRangeAt(0)
    //             if (range.commonAncestorContainer.parentNode == editableDiv) {
    //                 caretPos = range.endOffset
    //             }
    //         }
    //     // } else if (document.selection && document.selection.createRange) {
    //     //     range = document.selection.createRange();
    //     //     if (range.parentElement() == editableDiv) {
    //     //         var tempEl = document.createElement("span")
    //     //         editableDiv.insertBefore(tempEl, editableDiv.firstChild)
    //     //         var tempRange = range.duplicate()
    //     //         tempRange.moveToElementText(tempEl)
    //     //         tempRange.setEndPoint("EndToEnd", range)
    //     //         caretPos = tempRange.text.length
    //     //     }
    //     }
    //     return caretPos
    // }

    // function setCaretPos(el, sPos) {
    //     var charIndex = 0, range = document.createRange()
    //     range.setStart(el, 0)
    //     range.collapse(true)
    //     var nodeStack = [el], node, foundStart = false, stop = false
    //     while (!stop && (node = nodeStack.pop())) {
    //         if (node.nodeType == 3) {
    //             var nextCharIndex = charIndex + node.length
    //             if (!foundStart && sPos >= charIndex && sPos <= nextCharIndex) {
    //                 range.setStart(node, sPos - charIndex)
    //                 foundStart = true
    //             }
    //             if (foundStart && sPos >= charIndex && sPos <= nextCharIndex) {
    //                 range.setEnd(node, sPos - charIndex)
    //                 stop = true
    //             }
    //             charIndex = nextCharIndex
    //         } else {
    //             var i = node.childNodes.length
    //             while (i--) {
    //                 nodeStack.push(node.childNodes[i])
    //             }
    //         }
    //     }
    //     let selection = window.getSelection()
    //     selection.removeAllRanges()
    //     selection.addRange(range)
    // }

    // function whenKeyPress(e) { //한개는 OK. 여러개 실패함 => @ 프람프트는 포기하고 saveMsg()때 @이상병, @정일영영턱스 등을 읽어서 사용자로 하여금 @이상병, @정일영으로 처리하도록 팝업을 주는 것으로 하기
    //     if (e.key == "@") {
    //         const pos = getCaretPosition(e.target)
    //         let selection = window.getSelection() //let offset = selection.focusOffset //let focus = selection.focusNode
    //         const range = selection.getRangeAt(0)
    //         let node = document.createElement('span')
    //         node.style.color = "steelblue"
    //         node.style.background = "yellow"
    //         node.append("@이상병")
    //         range.insertNode(node)
    //         range.collapse(true)
    //         setTimeout(function() { //const pos = getCaretPosition(e.target) //위에서 미리 set pos해야 함
    //             //keypress때 넣은 @가 setTimeout이전에는 노출되지 않아 여기서 @빼고 커서 그 다음으로 넣음
    //             e.target.innerHTML = e.target.innerHTML.substring(0, pos) + e.target.innerHTML.substring(pos + 1) + "<span color:black;background:white>&nbsp</span>"
    //             let newPos = pos + 5
    //             setTimeout(function() { setCaretPos(e.target, newPos) }, 500)
    //         }, 100)
    //     }
    // }

    function keyDown(e) { //keyUpEnter가 아님
        if (e.key == "Enter") {
            if (e.shiftKey) {
                //나중에 옵션 주기
            } else {
                saveMsg() //일단 줄바꿈으로 동작하게 하기
            }
        } else if (e.key == "@") {
            setTimeout(() => { checkForMention() }, 10)
        } else { //if (e.key == "Escape") {
            if (!e.shiftKey) closeMentionDropdown() //@는 shiftKey가 먼저 발생함
            if (e.ctrlKey && (e.key == "x" || e.key == "v" || e.key == "X" || e.key == "V")) chkWordStyle()
        } 
    }

    function keyUp(e) { //keyDown에서 Bold, Strike 처리하니 제대로 안먹혀 keyUp으로 처리함. ctrl+X/ctrl+V는 또 여기서 안되서 keyup에서 처리
        if (e.key == "ArrowUp" || e.key == "ArrowRight" || e.key == "ArrowDown" || e.key == "ArrowLeft" || e.key == "Delete" || e.key == "Backspace") {
            chkWordStyle()
        }
    }

    const checkForMention = () => {  
        storeCursorPosition() //@를 누를 때만 나오도록 되어 있으므로 그전에 window.getSelection()을 가져올 필요없음
        //console.log('checkForMention: Mention query:', mentionQuery.value)
        procSearch("")
        showMentionDropdown.value = true
        selectedMentionIndex.value = 0
        updateMentionPosition()
        setTimeout(function() { 
            userToSearchRef.value.focus() 
        }, 500)
        //console.log('checkForMention: Dropdown shown, filtered users:', filteredUsers.value.length)
    }

    const closeMentionDropdown = () => {
        setTimeout(() => {
            if (userToSearchFocused.value) return
            if (showMentionDropdown.value) {
                showMentionDropdown.value = false
                selectedMentionIndex.value = 0
                userToSearchFocused.value = false
                filteredUsers.value = []
            }
        }, 10)
    }

    async function procSearch(searchText) {
        try {
            let res, rs
            if (searchText.trim() == "") {
                res = await axios.post("/chanmsg/qryChanMstDtl", { chanid: chanId }) //세군데 사용 + MemberList.vue에서도 사용
                //setChanMstDtl(rs.data.chanmst, rs.data.chandtl)
            } else {
                const param = { searchText: searchText, onlyAllUsers: true }
                res = await axios.post("/user/procOrgSearch", param)
            }
            rs = gst.util.chkAxiosCode(res.data, true) //오류시 No Action
            if (!rs) return
            if (searchText.trim() == "") rs.list = rs.data.chandtl
            filteredUsers.value = []            
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                let orgnm, toporgnm, job //row.EMAIL
                if (row.ORG) {
                    orgnm = row.ORG.trim()
                    toporgnm = ""
                } else {
                    orgnm = row.ORG_NM ? row.ORG_NM + "/" : ""
                    toporgnm = row.TOP_ORG_NM ?? ""
                }
                job = row.JOB ? row.JOB.trim() + "/" : ""
                row.userInfo = job + orgnm + toporgnm
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                filteredUsers.value.push(row)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    const updateMentionPosition = () => {
        const selection = window.getSelection()
        if (!selection.rangeCount) return        
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect() //const editorRect = inEditor.value.getBoundingClientRect()   
        mentionPosition.value = {
            top: rect.bottom - 240, //editorRect.top - 200, //rect.bottom - editorRect.top + 350,
            left: rect.left + 20 //- editorRect.left
        }
    }

    const selectMention = (user) => {
        if (!user) return
        inEditor.value.focus()    
        const range = restoreCursorPosition()
        const node1 = range.startContainer
        if (node1.nodeType === Node.TEXT_NODE) { //@가 반드시 한칸앞에 존재하므로 @를 포함해 select해서 replace하는 것임
            range.setStart(node1, range.startOffset - 1)
        }
        let node = document.createElement('span')
        node.classList.add("mention", "clickable")
        node.setAttribute("data-userid", user.USERID)
        node.setAttribute("data-usernm", user.USERNM)
        node.setAttribute("contenteditable", "false") //node.setAttribute("data-click-attached", "true")
        if (node._mentionClickHandler) node.removeEventListener('click', node._mentionClickHandler)
        node._mentionClickHandler = (e) => {
            e.preventDefault()
            e.stopPropagation()
            memProfile(e, user)
        }
        node.addEventListener('click', node._mentionClickHandler)
        node.append("@" + user.USERNM)
        range.deleteContents()
        range.insertNode(node)
        range.collapse(false)        
        closeMentionDropdown()
        userToSearch.value = ""
    }

    function procUserToSearchFocused(bool) {
        //setTimeout(function() {
            userToSearchFocused.value = bool
        //}, 100) //closeMentionDropdown()가 500이므로 더 작게 설정
    }

    function handleInput(e) {
        const inputText = e.target.value
        procSearch(inputText)
    }

    const keydownInput = (e) => { //@keydown="keydownInput" => 바로 위 handleInput 옆에 두었던 이벤트 메소드인데 (키보딩이 안되어서 일단 막음)
        if (!showMentionDropdown.value) return
        e.preventDefault()
        if (e.key == 'ArrowDown') {
            selectedMentionIndex.value = Math.min(selectedMentionIndex.value + 1, filteredUsers.value.length - 1)
        } else if (e.key == 'ArrowUp') {
            selectedMentionIndex.value = Math.max(selectedMentionIndex.value - 1, 0)
        } else if (e.key == 'Enter') {
            selectMention(filteredUsers.value[selectedMentionIndex.value])
        } else if (e.key == 'Escape') {
            userToSearchFocused.value = false
            closeMentionDropdown()
        }
    }

    async function saveMsg() { //파일 및 이미지 업로드만 FormData 사용하고 nest.js에서는 multer npm으로 처리
        try { //파일,이미지,링크가 있다면 미리 업로드된 상태이며 crud가 C일 때만 업로드 되며 U일 때는 슬랙과 동일하게 업로드되지 않음 (본문만 수정저장됨)
            if (appType == "dm" && showUserSearch.value) { //DM방 새로 만들기
                if (dmChanIdAlready.value) {
                    gst.util.setSnack("위 '기존 DM방 열기' 버튼을 이용하시기 바랍니다.")
                    return
                }
                const member = [], brr = [], crr = []
                userAdded.value.forEach(item => { 
                    member.push({ USERID: item.USERID, USERNM: item.USERNM, SYNC: item.ORG_NM ? "Y" : "" }) 
                    brr.push(item.USERID)
                    crr.push(item.USERNM)
                })
                const rq = { CHANID: "new", MEMBER: member } //신규 DM방 생성 (멤버도 함께 생성)
                const res = await axios.post("/chanmsg/saveChan", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                chanId = rs.data.chanid
                localStorage.wiseband_lastsel_dmchanid = chanId
                gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomJoin", roomid: chanId, memberIdAdded: brr, memberNmAdded: crr, from: "saveMsg" }})
            }
            let body1 = document.getElementById(editorId).innerText.trim()
            if (body1 == "") return
            let body = document.getElementById(editorId).innerHTML.trim()
            let bodytext = document.getElementById(editorId).innerText.trim()
            const reg = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z가-힣0-9@:%_\+.~#(){}?&//=]*)/
            const result = reg.exec(body)
            if (result != null && !body.includes("<a href=\"" + result[0] + "\" target=\"_blank\" ")) { //웹에디터에서 이미 링크로 변환한 데이터는 또 변환하면 안됨
                let node = document.createElement('a')
                node.setAttribute("href", result[0])
                node.setAttribute("target", "_blank")
                node.style.color = "steelblue"
                node.append(result[0])
                body = body.replace(result[0], node.outerHTML)
                node.remove()
            }
            msgbody.value = body //document.getElementById(editorId).innerHTML //이 행이 없으면 발송 2회차부터 msgbody가 계속 본문에 남아 있음
            let crud = (editMsgId.value) ? "U" : "C"
            const rq = { 
                crud: crud, chanid: chanId, msgid: editMsgId.value, replyto: hasProp() ? props.data.msgid : null,
                body: body, bodytext: bodytext, //body: msgbody.value, bodytext: bodytext,
                num_file: (editMsgId.value) ? 0 : fileBlobArr.value.length, 
                num_image: (editMsgId.value) ? 0 : imgBlobArr.value.length, 
                num_link: (editMsgId.value) ? 0 : linkArr.value.length
            }
            const res = await axios.post("/chanmsg/saveMsg", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (crud == "C") {
                if (hasProp()) { //댓글 전송후엔 작성자 입장에서는 맨아래로 스크롤하기
                    await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom", msgidReply: rs.data.replyto })
                    if (scrollArea.value) scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })                  
                } else {
                    if (newParentAdded.value.length == 0) {
                        await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom" }) //특정 싯점 다음부터 현재까지 새로 도착한 메시지를 가져옴
                    } else {
                        const strMsgid = newParentAdded.value[0].MSGID //가장 오래된 부모메시지부터 조회하도록 해야 사용자가 안놓침
                        const cdtAtFirst = newParentAdded.value[0].CDT
                        chkProcScrollToBottom(cdtAtFirst, strMsgid)
                    }
                }
            } else {
                const rs = await getMsg({ msgid: editMsgId.value }, true)
                if (rs == null) return
                refreshWithGetMsg(rs, editMsgId.value)
            }    
            if (appType == "dm") {
                if (showUserSearch.value) { //DM방 새로 만들기
                    showUserSearch.value = false
                    dmChanIdAlready.value = ""
                    userAdded.value = []
                    dmChanIdAlready.value = false                
                    evToPanel({ kind: "refreshPanel" })
                }
            }
            msgbody.value = ""
            setTimeout(function() { gst.sockToSend.push({ sendTo: "room", data: { ev: "sendMsg", roomid: chanId, msgid: editMsgId.value, from: "saveMsg" }}) }, 500) 
            editMsgId.value = null            
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function cancelMsg() {
        msgbody.value = prevEditData
        editMsgId.value = null
    }

    function msgCopied(e) { //procMenu:hover 때문에 메시지를 복사하면 바탕색이 변하는데 아래에서 그걸 원래 배경색으로 환원시킴
        e.currentTarget.style.background = "white"
    }

    async function uploadLink(kind, text) {
        try {
            if (appType == "dm" && showUserSearch.value) {
                gst.util.setSnack("DM방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                return
            }
            popupRefKind.value = kind
            linkText.value = text ?? ""
            linkPopupRef.value.open()
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function editorFocused(bool) {
        editorIn.value = bool
        if (!bool) editorBlurDt = Date.now()
        closeMentionDropdown()
    }

    function chkEditorFocus() {
        const ms = Date.now() - editorBlurDt
        if (ms <= 250) return true //에디터 포커스 상태에서 이모티, B, S 등의 이미지(버튼)을 누르면 그 차이가 100단위의 MiliSec 나오는데 여유있게 250으로 줌
        return false //250 넘어가면 에디터 포커스 상태에서 이미지(버튼)을 바로 누른 게 아니라는 의미임
        //위와 같이 체크하는 이유는 selection or range에서는 현재 커서가 있는 노드를 찾을 수 없음 (parentNode를 모두 뒤져도 없음)
        //1) 그래서, 에디터의 focusin/blur event로 하고자 했으나 그 상태값만으로는 체크가 어려움 : 이미지(버튼)을 누르는 순간 blur됨
        //2) blur되어도 클릭하는 순간의 갭이 짧기때문에 그걸 체크해서 disabled/enabled 효과를 내는 것임
        //참고로, let currentNode = window.getSelection().focusNode에서 parent로 올라가면 에디터 노드를 만날 수 있음
    }

    function makeLink() { //문자를 링크로 변환하는 것이며 addlink(별도 추가)와는 다름
        try {
            if (!chkEditorFocus()) return
            let selection = window.getSelection()
            if (selection.rangeCount == 0) return
            const range = selection.getRangeAt(0) 
            let content = range.cloneContents()
            let node = document.createElement('span')
            node.append(content) //content에 html로 읽어오는 메소드는 없고 cloneContents()로만 가능한데 append 하지 않으면 읽지 못함
            const text = node.innerHTML
            node.remove()
            storeCursorPosition()
            uploadLink('makelink', text)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    async function okPopup(kind) {
        try {
            if (kind == "addlink" || kind == "makelink") {
                const regexp = new RegExp("^https?://")
                if (regexp.test(linkText.value) || regexp.test(linkUrl.value)) { //2개 필드중 하나라도 링크가 있으면 OK
                    if (linkText.value.trim() == "") {
                        linkText.value = linkUrl.value.trim()
                    } else if (linkUrl.value.trim() == "") {
                        linkUrl.value = linkText.value.trim()
                    } else {
                        if (regexp.test(linkText.value) && !regexp.test(linkUrl.value)) {
                            gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                            return
                        }
                    }
                } else {
                    gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                    return
                }
                if (kind == "addlink") {
                    const rq = { chanid: chanId, kind: "L", body: linkText.value + hush.cons.deli + linkUrl.value }
                    const res = await axios.post("/chanmsg/uploadBlob", rq)
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    linkArr.value.push({ hover: false, text: linkText.value, url: linkUrl.value, cdt: rs.data.cdt })
                } else {
                    inEditor.value.focus()
                    const range = restoreCursorPosition()
                    let node = document.createElement('a')
                    node.setAttribute("href", linkUrl.value)
                    node.setAttribute("target", "_blank")
                    node.style.color = "steelblue"
                    node.append(linkText.value)
                    range.deleteContents()
                    range.insertNode(node)
                    range.collapse(false)
                    //msgbody.value = document.getElementById(editorId).innerHTML //데이터가 필요시 처리하면 됨
                }
                linkText.value = ""
                linkUrl.value = ""
                linkPopupRef.value.close()
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    //parentNode.childNodes는 text 및 tag를 모두 가져오는 NodeList (배열) : 읽기전용임
    //parentNode.children은 tag만 가져오는 HTMLCollection (배열) : 읽기전용임
    //따라서, 처음 시작은 childInnerHtml으로 처리하기로 함 (document.execCommand-deprecated로 처리하는 것이 아님)
    //##############아래에서 bold는 문제없는데 line-through(취소선)는 중첩시 해제가 안됨
    async function procWordStyle(kind) { //kind=B(Bold),kind=S(Strike,Del)
        try {
            if (!chkEditorFocus()) return
            let selection = window.getSelection()
            if (selection.rangeCount == 0) return
            const range = selection.getRangeAt(0)
            const parentNode = range.startContainer.parentNode 
            const commonParentNode = range.commonAncestorContainer //단일 노드 체크 정도에만 사용함
            let parentInnerHtml = parentNode.innerHTML
            let parentOuterHtml = parentNode.outerHTML
            let content = range.cloneContents() //range.extract~로 처리하면 코딩이 복잡해져서 clone~으로 대체함 (아래에서 deleteContents()해야 할 경우와 하지 않아야 할 경우가 있음)         
            let node = document.createElement('span')
            node.append(content) //content에 html로 읽어오는 메소드는 없고 cloneContents()로만 가능한데 append 하지 않으면 읽지 못함
            let childInnerHtml = node.innerHTML
            console.log("parentInnerHtml---- " + parentInnerHtml)
            console.log("parentOuterHtml---- " + parentOuterHtml)
            console.log("childInnerHtml ---- " + childInnerHtml)
            console.log("commonParentNode.innerHTML @@ " + commonParentNode.innerHTML) //아래 s는 줄바꿈에서도 매칭 찾음
            const expBold = /font\-weight\s*:[\s(\w|\d)]*;?/gis //font-weight:bold,font-weight:500,font-weight:;font-weight : normal ; 등 모두 찾기
            const expBold1 = /(<b>|<strong>).*?(<\/b>|<\/strong>)/gis //<b>~</b> 등 모두 찾기
            const expStrike = /text\-decoration((\-line)?)\s*:[\s(\w|\d|\-)]*;?/gis //text-decoration:line-through red,text-decoration-line:line-through 등 모두 찾기
            const expStrike1 = /(<s>|<del>).*?(<\/s>|<\/edl>)/gis //<s>~</s> 등 모두 찾기
            //const xxx = "span style='text-decoration:none; zzzzz text-decoration-line:none;'"
            //const matchTest = [...xxx.matchAll(expStrike)] debugger
            if (kind == 'B') {
                stateBold.value = !stateBold.value
            } else if (kind == 'S') {
                stateStrike.value = !stateStrike.value
            }
            if (!commonParentNode.innerHTML) { //if (!/</.test(childInnerHtml)과 동일한 케이스 (<br>도 제외시켜야 함)
                //commonParentNode.innerHTML이 undefined면 선택된 노드는 단일 노드(Text or Html)이며 tag는 안 들어가 있으므로 크게 어려운 부분 없음
                if (childInnerHtml != parentInnerHtml) { //1) <span>타는 저녁놀</span>중에 '저녁놀'만 선택 2) '나그네'처럼 아예 Text => ## 가비지도 없고 추가 태그도 발생하지 않음
                    if (kind == 'B') {
                        node.style.fontWeight = stateBold.value ? 'bold' : 'normal'
                    } else if (kind == 'S') {
                        node.style.textDecoration = stateStrike.value ? 'line-through' : 'none'
                    }
                    storeCursorPosition()
                    inEditor.value.focus()
                    const range1 = restoreCursorPosition()
                    range1.deleteContents()
                    range1.insertNode(node)
                    range1.collapse(false)
                } else { //이 경우는 parentOuterHtml이 <span style="color:red;font-weight:bold">타는 저녁놀</span>이나 <b>가듯이</b> 등으로 되어 있는 경우인데
                    //range.startContainer와 range.endContainer의 parentNode가 동일한 상황이므로 parentOuterHtml로 핸들링해도 문제없을 것임
                    //parentOuterHtml을 RegEx로 stateBold.value에 따라 모두 찾아 업데이트하면 될 것임 => ## 가비지도 없고 추가 태그도 발생하지 않음
                    /*지우지말것 parentOuterHtml = parentOuterHtml.replaceAll(expBold, "font-weight:" + (stateBold.value ? 'bold' : 'normal'))
                    const matchArr = [...parentOuterHtml.matchAll(expBold1)]
                    for (let matchBrr of matchArr) {
                        const srcStr = matchBrr[0]
                        const destStr = matchBrr[0].replace(matchBrr[1], (stateBold.value ? '<b>' : '')).replace(matchBrr[2], (stateBold.value ? '</b>' : ''))
                        parentOuterHtml = parentOuterHtml.replace(srcStr, destStr)
                    }
                    parentNode.outerHTML = parentOuterHtml 위처럼 정규식으로 하면 style이 없는 경우까지 고려해야 하는 복잡한 코딩이 되므로 아래 2행으로 커버하기로 함 */
                    if (kind == 'B') {
                        parentNode.style.fontWeight = 'normal' //parentNode를 감싸는 부분이 bold일 수도 있음을 고려
                        if (stateBold.value) parentNode.style.fontWeight = 'bold'
                    } else if (kind == 'S') {
                        parentNode.style.textDecoration = 'none' //parentNode를 감싸는 부분이 bold일 수도 있음을 고려
                        if (stateStrike.value) parentNode.style.textDecoration = 'line-through'
                    }
                    inEditor.value.focus()
                    range.collapse(false) //끝점으로 접는데 끝점이 없어져서 안먹혀 처음으로 접히는데 크게 문제는 없을 것임
                    node.remove()
                    return //중요
                }
            } else { //다중 노드가 들어 있는 상태이며 무조건 childInnerHtml을 처리해야 하므로 위 node 객체로 핸들링하면 됨 
                //node에 있는 모든 관련 스타일을 제거후 마지막에 node.style로 처리 => ## 가비지 및 추가 태그 처리해야 함
                //예1) <span style="font-weight:bold">밑밭 <b>길을</b></span> => '밭 <b>길'만 bold 해제하면 마지막 '을'에 대해서는 자동으로 '<b>을</을>'로 만들어줌 
                //예2) <span style="color:blue">마을마다</span> <span style="color:red;font-weight:bold">타는 저녁놀</span> 둘 다 선택시
                if (kind == 'B') {
                    childInnerHtml = childInnerHtml.replaceAll(expBold, "")
                    const matchArr = [...childInnerHtml.matchAll(expBold1)]
                    for (let matchBrr of matchArr) {
                        const srcStr = matchBrr[0]
                        const destStr = matchBrr[0].replace(matchBrr[1], "").replace(matchBrr[2], "")
                        childInnerHtml = childInnerHtml.replace(srcStr, destStr)
                    }
                } else if (kind == 'S') {
                    childInnerHtml = childInnerHtml.replaceAll(expStrike, "")
                    const matchArr = [...childInnerHtml.matchAll(expStrike1)]
                    for (let matchBrr of matchArr) {
                        const srcStr = matchBrr[0]
                        const destStr = matchBrr[0].replace(matchBrr[1], "").replace(matchBrr[2], "")
                        childInnerHtml = childInnerHtml.replace(srcStr, destStr)
                    }
                }
                node.innerHTML = childInnerHtml
                node.id = "wiseband" + hush.util.getRnd()
                if (kind == 'B') {
                    node.style.fontWeight = stateBold.value ? 'bold' : 'normal'
                } else if (kind == 'S') {
                    node.style.textDecoration = stateStrike.value ? 'line-through' : 'none'
                    //##2 문제는 아래와 같이 중첩시 bold는 해제되는데 line-through는 해제되지 않고 그대로 취소선이 표시되고 있음 (테스트 완료)
                    //<span style="font-weight:bold;text-decoration:line-through">
                    //  <span style="font-weight:normal;text-decoration:none">통합검색으로이동</span>일부만적용
                    //</span>
                }
                storeCursorPosition()
                inEditor.value.focus()
                const range1 = restoreCursorPosition()
                range1.deleteContents()
                range1.insertNode(node)
                range1.collapse(false)
                const ele = document.querySelector("#" + node.id)
                if (ele && ele.parentNode) { //다중 노드의 경우 insertNode(node)가 실행되어서 같은 범위를 선택해서 계속 처리할 경우
                    //동일 tag로 계속 추가로 감싸게 되는데 미리 막지 못해 insertNode(node)이후 여기서 방금 추가한 ele의 부모node를 찾아
                    //거기에 wiseband 아이디가 있으면 innerHTML을 이용해 제거하면 계속 작업해도 한개의 wisebnd id만 존재하게 되므로 그나마 OK
                    const pNode = ele.parentNode
                    if (pNode.id.startsWith("wiseband")) {
                        pNode.outerHTML = pNode.innerHTML
                    } //아래는 가비지 정리 (태그의 일부를 선택해 deleteContents()하면 innerHTML이 없는 ParentNode가 남는 경우가 있는데 그걸 제거하는 것임)
                    if (parentNode.innerHTML == "") parentNode.remove() 
                    const sNode = ele.nextSibling //아래는 가비지 정리 (태그의 일부를 선택해 deleteContents()하면 innerHTML이 없는 SiblingNode가 남는 경우가 있는데 그걸 제거하는 것임)
                    if (sNode && sNode.innerHTML == "") sNode.remove()
                }
            } /* 아래는 가비지 정리인데 정리후 커서 위치 기억이 쉽지 않아 바로 위에서 해결함 (지우지 말 것)
            await nextTick()
            const ele = document.getElementById(editorId)
            selection = window.getSelection()
            if (selection.rangeCount == 0) return
            const pos = getCaretPos(ele) //storeCursorPosition()
            let str = ele.innerHTML
            const expBlank = /<span[^>]*?><\/span>/gi 
            str = str.replaceAll(expBlank, "") //const blankArr = [...str.matchAll(expBlank)]
            msgbody.value = str
            await nextTick()
            inEditor.value.focus()
            //const range1 = restoreCursorPosition()
            //range1.collapse()
            setCaretPos(ele, pos)
            range.collapse(true)*/
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function chkWordStyle() {
        const selection = window.getSelection()
        const range = selection.getRangeAt(0)
        const currentNode = range.startContainer.parentNode
        const computedStyle = window.getComputedStyle(currentNode)
        //1) B 체크
        const fontWeight = computedStyle.fontWeight
        if (fontWeight == 'bold' || fontWeight == 'bolder' || parseInt(fontWeight) >= 700) {
            if (!stateBold.value) stateBold.value = true
        } else {
            if (stateBold.value) stateBold.value = false
        }
        //2) S 체크
        const textDecoration = computedStyle.textDecoration
        if (textDecoration.includes('line-through')) { //line-through rgb(0, 0, 0) / text-decoration: underline wavy blue 2px / text-decoration-line: line-through;
            if (!stateStrike.value) stateStrike.value = true
        } else {
            if (stateStrike.value) stateStrike.value = false
        }
    }

    function htmlView() {
        showHtml.value = true
        msgbody.value = document.getElementById(editorId).innerHTML
    }

    function openLink(url) { 
        window.open(url, "_blank") //popup not worked for 'going back' navigation
    }

    async function uploadFile(e) {
        try {
            if (appType == "dm" && showUserSearch.value) {
                gst.util.setSnack("DM방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                return
            }            
            const files = e.target.files
            if (fileBlobArr.value.length + files.length > hush.cons.uploadMaxCount) {
                gst.util.setToast("업로드 파일 갯수는 메시지별로 " + hush.cons.uploadMaxCount + "개(기존 파일 포함)까지만 가능합니다.", 5, true)
                return
            }            
            for (let i = 0; i < files.length; i++) {
                const size = files[i].size
                if (size > hush.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 파일 크기 제한은 " + hush.util.formatBytes(hush.cons.uploadLimitSize) + "입니다.\n" + files[i].name + " => " + hush.util.formatBytes(size), true)
                    return
                }
                const exist = fileBlobArr.value.filter(x => x.name == files[i].name)
                if (exist.length > 0) {
                    gst.util.setToast("이미 같은 이름의 파일이 존재합니다.\n" + files[i].name, 5, true)
                    return
                }                
            }
            uploadFileProgress.value = []
            const filesToUpload = []            
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData()
                fd.append("chanid", chanId)
                fd.append("kind", "F")
                fd.append("body", files[i].name)
                fd.append("filesize", files[i].size)
                fd.append("file", files[i])
                uploadFileProgress.value.push({ name: files[i].name, size: files[i].size, percent : 0 }) //실패시 filesToUpload에 추가된 걸 빼지 않으려고 별도로 만든 것임
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => { //파일이 작으면 보이지도 않는데 나중에 파일시스템으로 이관하면 필요할 것임 (현재 구현 및 테스트 완료 상태임)
                        const percent = (e.loaded * 100) / e.total                        
                        uploadFileProgress.value[i].percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                filesToUpload.push({ hover: false, name: files[i].name, size: files[i].size, cdt: rs.data.cdt })
            }
            fileBlobArr.value = [...fileBlobArr.value, ...filesToUpload]
            e.target.value = '' //clear하지 않으면 동일한 파일명이 바로 올라가지 않음 (change event 관련)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function downloadFile(msgid, row) { //msgid = temp or real msgid
        try { //cdt는 msgmst가 아닌 msgsub 테이블의 필드값이여야 함
            gst.util.downloadBlob("F", msgid, chanId, row.cdt, row.name)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function toggleReaction(msgid, kind) { //toggleReaction은 보안상 크게 문제없는 액션만 처리하기로 함
        try {
            const typ = gst.util.getTypeForMsgDtl(kind)
            if (typ != "react") return //if (kind == "notyet") return //react typ = checked, done, watching
            const rq = { chanid: chanId, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/toggleReaction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "room", data: { ev: "toggleReact", roomid: chanId, msgid: msgid, from: "toggleReaction" }})
            //await refreshMsgDtlWithQryAction(msgid) //await refreshMsgDtlWithQryAction(msgid, rs.data.msgdtl)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function okChanDmPopup(kind, strChanid, strMsgid) { //바로 아래 forwardMsg()에서 연결됨 : strChanid(새로 선택한 채널(DM)방), strMsgid(전달하려고 하는 기존 메시지)
        try {
            popupChanDmRef.value.close()
            const rq = { kind, chanid: chanId, msgid: strMsgid, targetChanid: strChanid } //선택한 채널의 메시지를 targetChanid에 복사
            const res = await axios.post("/chanmsg/forwardToChan", rq) //새로운 방으로 select and insert
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "room", data: { ev: "forwardToChan", roomid: strChanid, msgid: rs.data.newMsgid, from: "okChanDmPopup" }})
            const url = gst.util.getUrlForBodyListNewWin(strChanid, rs.data.newMsgid, kind)
            window.open(url)
            /* 1안은 바로 위 window.open인데 사용자 입장에서도 무리없어 보임 (개발 관점에서 효율적이기도 함)
            다만 슬랙은 새창을 띄우지 않아서 아래 2안으로 노력했는데 2안시 마지막 단계인 MsgList의 캐시제거가 살짝 구현이 안되었음. 필요시 2안으로 노력을 더 기울여도 되나 각 패널에 추가해야 하는 것이 번거로울 것임
            if (kind == appType) {
                evToPanel({ kind: "refreshPanel" })
            } else { //home->dm or dm->home 등등
                evToPanel({ kind: "forwardToSide", menu: kind })
            }*/
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function forwardMsg(kind, msgid) { //내가 편집(발송)가능한 채널과 DM방중에서 1개를 선택해 table에 insert후 해당 패널의 방으로 이동해 바로 보여주기
        popupChanDmRef.value.open(kind, msgid) //바로 위 okChanDmPopup()으로 연결됨
    }

    async function changeAction(msgid, kind, newKind) { //changeAction은 보안상 크게 문제없는 액션만 처리하기로 함 : newKind 없으면 서버에서 kind로만 판단해 처리
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            let jobIfExist = "" //데이터가 있을 경우에 한해 delete면 지우고 delete가 아닌 값이면 그 값으로 update하면 됨
            if (kind == 'later' || kind == 'stored' || kind == 'finished' || kind == 'fixed') {
                jobIfExist = (!newKind) ? "delete" : newKind
            } //else 체크 필요함
            const rq = { chanid: chanId, msgid: msgid, kind: kind, job: jobIfExist }
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "user", data: { ev: "changeAction", userid: g_userid, from: "changeAction" }})
            rs = await qryActionForUser({ msgid: msgid })
            if (rs == null) return
            const obj = msglist.value.find((item) => item.MSGID == msgid)
            if (obj) {
                obj.act_later = rs.act_later
                obj.act_fixed = rs.act_fixed
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function blobSetting(e, row, idx, row5, idx5) { //row와 idx는 메시지 배열 항목 및 인덱스. row5와 idx5는 file,image,link의 배열 항목 및 인덱스
        gst.ctx.data.header = ""
        if (row5.KIND == "F") {
            gst.ctx.menu = [ //파일,이미지,링크의 에디터에 붙이는 기능은 채널내에서는 딱히 의미 없으므로 향후 드랙드랍으로 다른 채널로 바로 복사하도록 하기
                //{ nm: "복사후 에디터에 붙이기", func: function() {}}, 
                { nm: "파일 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        } else if (row5.KIND == "I") { //클릭시 레이어팝업 메뉴 1) 회전 2) 줌인/줌아웃 3) 클릭시 50%/200% 4) 파일로 다운로드 5) 새창에서 열기 6) 삭제
            gst.ctx.menu = [
                { nm: "파일 다운로드", func: function() {
                    try {
                        gst.util.downloadBlob("I", row.MSGID, chanId, row5.CDT, row.MSGID + "_" + row5.CDT + ".png")
                    } catch (ex) {
                        gst.util.showEx(ex, true)
                    }
                }},
                { nm: "이미지 복사", func: function() {
                    try {
                        gst.util.downloadBlob("I", row.MSGID, chanId, row5.CDT, "copyImage")
                    } catch (ex) {
                        gst.util.showEx(ex, true)
                    }
                }},
                { nm: "이미지 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        } else if (row5.KIND == "L") {
            gst.ctx.menu = [
                { nm: "URL링크 복사", func: function() {
                    navigator.clipboard.writeText(row5.url).then(() => {
                        gst.util.setToast("URL링크가 복사되었습니다.")
                    }).catch(() => {
                        gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                    })
                }},
                { nm: "링크 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        }
        gst.ctx.show(e)
    }

    function adminJob() {
        adminShowID.value = !adminShowID.value
    }

    function openMemberList() {
        if (chanType == 'WS') {
            memberlistRef.value.open("chan", grid.value, chanId, chanNm.value, chanImg.value)
        } else { //GS
            memberlistRef.value.open("dm", null, chanId)
        }
    }

    //https://velog.io/@msdio/window%EC%9D%98-Selection%EA%B3%BC-range%EC%97%90-%EB%8C%80%ED%95%B4%EC%84%9C-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
    //selection 타입 : none, range, caret. range는 유저가 선택한(드래그한) 범위 / caret은 범위가 아닌 특정 위치의 커서
    //collapse : 선택된 상태에서 선택해제 (range 상태에서 caret 상태로 변경)
    //anchorNode / anchorOffset : selection이 시작되는 위치의 노드/offset을 반환. 일반 텍스트의 노드 이름은 "text"
    //focusNode / focusOffset : selection이 끝나는 위치의 노드/offset을 반환
    //anchor는 시작점, focus는 끝나는 지점을 나타냄. 드래그를 앞→뒤가 아니라 뒤→앞으로 했다면, anchor와 focus는 반대가 됨

    //B(Bold), S(Strike) 등은 팝업이 없어 cursorPos를 기억할 필요가 없으므로 editorIn과 editorBlurDt를 이용해 처리하고
    //팝업이 있어 selection을 잃어버리는 makelink(링크로변환) 등은 prevRange를 사용해야 함 (with storeCursorPosition/restoreCursorPosition)
    function storeCursorPosition() {
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) //크롬은 텍스트 드래그가 한번만 가능. 파폭은 Ctrl+드래그(윈도우)로 여러 개 범위 선택
        //cursorPos.node = range.startContainer
        //cursorPos.startOffset = range.startOffset
        //cursorPos.endOffset = range.endOffset
        prevRange = range
    }
                
    function restoreCursorPosition() {
        //let range = null //document.createRange()
        //range.setStart(cursorPos.node, cursorPos.startOffset)
        //range.setEnd(cursorPos.node, cursorPos.endOffset)
        const range = prevRange
        let selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        return range
    }

    function insertPastedToEditor(type, str) {
        let selection = window.getSelection() //현재 커서 위치나 선택한 범위를 나타냄
        if (selection.rangeCount == 0) return //이 함수가 에디터에 붙이기할 때만을 전제로 하므로 체크는 의미없으나 그대로 두기로 함 
        const range = selection.getRangeAt(0) 
        if (type == "text/html") {
            let node = document.createElement('span')
            node.innerHTML = str
            range.deleteContents()
            range.insertNode(node)
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById(editorId).innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else if (type == "text/plain") {
            range.deleteContents()
            range.insertNode(document.createTextNode(str))
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById(editorId).innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else {
            gst.util.setToast("복사/붙이기는 Text/Html/Image만 지원 가능합니다.", 3)
            return false
        }
    }

    async function procClearSearch() {
        if (searchText.value == "") userSearched.value = []
    }

    async function procClearSearchWhenFocus() {
        searchText.value = ""
        procClearSearch()
    }

    async function procInput(e) {
        if (e.keyCode == 13) { //Enter
            try {
                const param = { searchText: searchUser, onlyAllUsers: true }
                const res = await axios.post("/user/procOrgSearch", param)
                const rs = gst.util.chkAxiosCode(res.data) 
                if (!rs) return
                userSearched.value = []
                const arr = []
                for (let i = 0; i < rs.list.length; i++) {
                    const row = rs.list[i]
                    if (row.ORG_NM == "" & row.TOP_ORG_NM == "") {
                        row.userInfo = row.USERNM + "/" + row.EMAIL
                    } else {
                        row.userInfo = row.USERNM + "/" + row.JOB.trim() + "/" + row.ORG_NM + "/" + row.TOP_ORG_NM
                    }
                    row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                    arr.push(row)
                }
                if (rs.list.length == 1) {
                    addUserToDm(rs.list[0])
                    searchText.value = ""
                } else {
                    userSearched.value = arr
                }
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        } else if (e.keyCode == 40) { //Arrow Down (focus to result list)
            userSearchedRef.value.focus() //tabIndex를 사용해 포커싱은 되는데 해당 div에서 화살표 위아래 누를 때 선택행이 변경되도록 해야 함 (향후 도전)
        } else if (e.keyCode == 8 || e.keyCode == 46) { //BackSpace, Del
            userSearched.value = []
        } else {
            searchUser = e.target.value
        }
    }

    async function addUserToDm(row) {
        try {
            const found = userAdded.value.findIndex(item => item.USERID == row.USERID)
            if (found > -1) {
                userAdded.value[found].found = true //기존 중복 표시임
                setTimeout(function() { userAdded.value[found].found = false }, 1000)
                return
            }
            if (row.USERID == g_userid) {
                gst.util.setSnack("본인 아이디는 추가하지 않습니다.")
                return
            }
            userAdded.value.push(row)
            userAdded.value[userAdded.value.length - 1].found = true //기존 중복이 아닌 새로운 추가 표시임
            setTimeout(function() { userAdded.value[userAdded.value.length - 1].found = false }, 500)
            await nextTick()
            const topVal = document.getElementById("divAddedUser").offsetHeight + document.getElementById("divAddUser").offsetHeight
            searchedResultTop.value = topVal + 5
            ///////////////////////////////////////////////////////////
            const member = [] //기존 DM방 여부 체크
            userAdded.value.forEach(item => { member.push(item.USERID) })
            const res = await axios.post("/menu/qryDmChkExist", { member: member })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            dmChanIdAlready.value = rs.data.chanid
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function delUserItem(idx) {
        userAdded.value.splice(idx, 1)
    }

    function openDmRoom(chanid, newWin) {
        try {
            if (newWin) {
                const url = gst.util.getUrlForBodyListNewWin(chanid, "0", "dm")
                window.open(url)
            } else {
                let obj = { name : "dm_body", params : { chanid: chanid, msgid: "0" }} //DM 패널이 아니라면 MsgList Mounted 반복되는 문제 발생
                router.push(obj)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    //1) 왼쪽 Panel -> MsgList 2) MsgList(부모) -> MsgList(자식)
    async function procMainToMsglist(kind, obj) {
        if (kind == "realtime") {
            chkDataLogEach(obj)
        } else if (kind == "updateProfile") { //console.log(obj.userid+"@@@@") 
            if (!chandtlObj.value[obj.userid]) return //소켓 'all'을 통해 수신된 것이므로 해당 사용자아이디가 있는 경우만 처리하면 됨
            const res = await axios.post("/chanmsg/qryChanMstDtl", { chanid: chanId }) //세군데 사용 + MemberList.vue에서도 사용
            const rs = gst.util.chkAxiosCode(res.data, true) //오류시 No Action 
            if (!rs) return
            setChanMstDtl(rs.data.chanmst, rs.data.chandtl)
        } else if (kind == "setVip") {
            const res = await axios.post("/user/getVip", null)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            vipStr.value = ("," + rs.data.vipStr + ",") ?? "none" //데이터 없어서 null일 수도 있음 ##34
        } else if (kind == "chkTyping") { //###05
            handleTypingInfo(obj)
        } else if (kind == "chkAlive") { //###05
            handleAliveInfo(obj)
            if (memberlistRef.value) memberlistRef.value.handleAliveInfo(obj) //home과 dm에도 memberlistRef handleAliveInfo 호출하는 것 있음
        }
    }

    async function procFromParent(kind, obj) { //리얼타임 반영시에도 아래를 호출하므로 아래는 지우지 말 것
        if (kind == "refreshMsg") {
            const rs = await getMsg({ msgid: obj.msgid })
            if (rs == null) return
            refreshWithGetMsg(rs, obj.msgid)
        } else if (kind == "deleteMsg") {
            const idx = msglist.value.findIndex((item) => item.MSGID == obj.msgid)
            if (idx > -1) {
                msglist.value.splice(idx, 1)
                if (idx == 0) handleEvFromChild({ type: "close" }) //부모글이 삭제된다는 것은 자식글이 없으므로 닫아도 된다는 것임 
            }
        } else if (kind == "addChildFromBody") {
            await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom", msgidReply: obj.msgidReply })
        } else if (kind == "forwardToBody") { //from HomePanel or DmPanel : 예) MemberList.vue에서 applyToBody() 
            const res = await axios.post("/chanmsg/qryChanMstDtl", { chanid: chanId }) //세군데 사용 + MemberList.vue에서도 사용
            const rs = gst.util.chkAxiosCode(res.data, true) //오류시 No Action 
            if (!rs) return
            setChanMstDtl(rs.data.chanmst, rs.data.chandtl)
        }
    }

    function evToPanel(param) { //말 그대로 패널에게 호출하는 것임 (자식에게 하는 것이 아님)
        if (route.fullPath.includes('/body/msglist')) return //패널이 없는 경우임
        emits("ev-to-panel", param)
    }   

    function evToParent(obj) { //자식에서만 사용됨
        emits('ev-to-parent', obj)
    }

    function handleTypingInfo(obj) {
        if (obj.roomid == chanId) {
            if (obj.typing) {
                if (!memIdTyping.value.includes(obj.userid)) {
                    memIdTyping.value.push(obj.userid)
                    memNmTyping.value.push(obj.usernm)
                }
            } else {
                const idx = memIdTyping.value.indexOf(obj.userid)
                if (idx > -1) {
                    memIdTyping.value.splice(idx, 1)
                    memNmTyping.value.splice(idx, 1)
                }
            }
        }
    }

    function handleAliveInfo(obj) {
        //console.log(JSON.stringify(obj), '##handleAliveInfo')
        //if (obj.roomid == chanId) {
            const len = chandtl.value.length
            for (let i = 0; i < len; i++) {
                const row = chandtl.value[i]
                if (obj.userids.includes(row.USERID)) {
                    chandtlObj.value[row.USERID].alive = true
                } else {
                    chandtlObj.value[row.USERID].alive = false
                }
            }
        //}
    }
</script>

<template>
    <div class="chan_main">
        <div v-if="!hasProp() && pageData==hush.cons.state_nodata" 
            style="top:0;left:0;width:100%;height:100%;margin-right:-10000px;padding:30px 0 0 30px;background:white;z-index:999">
            <span>데이터가 없습니다.<br>왼쪽 패널에서 노드를 클릭하시기 바랍니다.</span>
        </div>
        <div class="chan_center" :style="{ width: widthChanCenter }">
            <div v-if="showUserSearch" style="position:relative;width:100%;display:flex;flex-direction:column">
                <div id="divAddedUser" style="min-height:50px;margin-top:3px;display:flex">
                    <div style="min-width:40px;display:flex;align-items:center;font-weight:bold">대상 :</div>
                    <div class="msg_body_blob">
                        <div v-for="(row, idx) in userAdded" class="msg_file_each" @click="delUserItem(idx)" :style="{ background: row.found ? 'var(--hover-color)' : '' }">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div><span style="margin:0 3px;color:#005192">{{ row.userInfo }}</span></div>
                            <div class="msg_file_del">
                                <img class="coImg14" :src="gst.html.getImageUrl('close.png')">
                            </div>
                        </div>
                    </div>
                </div>
                <div id="divAddUser" style="min-height:30px;margin-top:3px;display:flex">
                    <div style="min-width:48px;display:flex;align-items:center;font-weight:bold">추가 :</div>
                    <div>
                        <input type="search" ref="searchInput" v-model="searchText"  spellcheck="false" style="width:402px" placeholder="이름을 넣고 Enter를 누르십시오."
                               @keyup="(e) => procInput(e)" @input="procClearSearch" @focus="procClearSearchWhenFocus" />
                    </div>
                    <div style="margin-left:10px;display:flex;align-items:center">(멤버 : {{ userAdded.length }})</div>
                </div>
                <div style="margin-top:20px;display:flex;align-items:center">
                    <div v-show="dmChanIdAlready" class="coImgBtn" @click="openDmRoom(dmChanIdAlready)">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">기존 DM방 열기</span>
                    </div>
                    <div v-show="dmChanIdAlready" class="coImgBtn" @click="openDmRoom(dmChanIdAlready, true)">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">기존 DM방 새창으로 열기</span>
                    </div>
                </div>
                <div style="margin-top:20px">1. DM방을 새로 만듭니다.</div>
                <div style="margin-top:20px">2. 임직원 또는 등록된 외부인의 이름(일부)을 넣고 Enter를 누르면 가져옵니다.</div>
                <div style="margin-top:20px">3. 추가된 이름(대상)을 확인하고 최초 메시지를 보내고 나면 방이 만들어집니다.</div>
                <div v-show="userSearched.length > 0" style="position:absolute;left:0;margin-top:3px;display:flex" :style="{ top: searchedResultTop + 'px' }">
                    <div style="width:48px"></div>
                    <div ref="userSearchedRef" tabindex="1" 
                        style="width:390px;min-height:60px;max-height:180px;padding:5px;border:1px solid dimgray;background:whitesmoke;z-index:1000;overflow-y:scroll;overflow-x:hidden">
                        <div v-for="(row, idx) in userSearched" @click="addUserToDm(row)" class="coHover" style="width:100%;min-height:30px;display:flex;align-items:center">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div class="coDotDot" :title="row.userInfo" style="margin-left:5px">{{ row.userInfo }}</div>
                        </div>                            
                    </div>
                </div>
            </div>
            <div v-if="!showUserSearch" class="chan_center_header" id="chan_center_header">
                <div class="chan_center_header_left">
                    <img class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px" @click="adminJob">
                    <span v-if="adminShowID" style="margin-right:5px">{{ chanId }}</span>
                    <div v-if="hasProp()" style="margin-right:5px" @click="adminJob">스레드</div>
                    <div v-else style="width:100%;display:flex;align-items:center">                    
                        <div v-if="chanType=='GS'" class="coDotDot">{{ chanmemFullExceptMe.length >= 1 ? chanmemFullExceptMe.join(", ") : "나에게" }}</div>
                        <!-- <div v-else class="coDotDot"><span>{{ chanNm }} {{ grnm ? "[" + grnm+ "]" : "" }}</span></div> 그룹명 변경시 소켓 적용 난항-->
                         <div v-else class="coDotDot"><span>{{ chanNm }}</span></div>
                    </div>
                </div>
                <div class="chan_center_header_right">
                    <div v-if="!hasProp()" class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                        <!-- <span style="min-width:36px;margin:0 5px 5px 10px;color:dimgray">관리 :</span><span class="coDotDot" style="min-width:80px;margin:0 5px 5px 5px">{{ chanMasterNm }}</span> -->
                    </div>
                    <div v-if="!hasProp()" class="topMenu" style="padding:3px;display:flex;align-items:center;border:1px solid lightgray;border-radius:5px;font-weight:bold" @click="openMemberList">
                        <div v-for="(row, idx) in chanmemUnder" style="width:24px;height:24px;display:flex;align-items:center;margin-right:2px">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                        </div>
                        <span>{{ chandtl.length }}</span>
                    </div>
                    <div v-if="!hasProp()" class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                        <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click="chanCtxMenu">
                    </div>
                    <div v-if="hasProp()" class="replyAct" style="font-size:13px">
                        <div style="margin:0 5px;display:flex;align-items:center" v-if="threadReply.replyinfo && threadReply.replyinfo[0].CDT_MAX">
                            <span style="margin-right:4px;color:steelblue;font-weight:bold">댓글 </span>
                            <span style="color:steelblue;font-weight:bold">{{ threadReply.replyinfo[0].CNT_EACH }}개</span>
                            <span style="margin:0 4px;color:dimgray">최근:</span>
                            <span style="color:dimgray">{{ hush.util.displayDt(threadReply.replyinfo[0].CDT_MAX) }}</span>
                            <span v-show="threadReply.replyinfo[0].MYNOTYETCNT > 0" class="coMyNotYet">{{ threadReply.replyinfo[0].MYNOTYETCNT }}</span>
                        </div>
                        <div style="margin:0 5px;display:flex;align-items:center" v-else>
                            <span style="margin-right:4px;color:steelblue;font-weight:bold">댓글이 없습니다.</span>
                        </div>
                    </div>
                    <div v-if="hasProp()" class="topMenu" style="padding:5px;margin-top:3px;margin-left:0px">
                        <img class="coImg24" :src="gst.html.getImageUrl('close.png')" @click="() => evToParent({ type: 'close' })">
                    </div>
                </div>
            </div>
            <div v-if="!hasProp() && !showUserSearch" class="chan_center_nav" id="chan_center_nav">
                <div v-if="tabForNewWin==''" class="topMenu" :class="listMsgSel == 'all' ? 'list_msg_sel' : 'list_msg_unsel'" @click="listMsg('all')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                    <span style="margin-left:5px;font-weight:bold">메시지</span> 
                </div>                
                <!-- <div v-if="tabForNewWin=='' || tabForNewWin=='unread'" class="topMenu" :class="listMsgSel == 'unread' ? 'list_msg_sel' : 'list_msg_unsel'"  @click="listMsg('unread')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg_unread.png')">
                    <span style="margin-left:5px;font-weight:bold">다시안읽음</span> 
                </div> -->
                <div v-show="!thread.msgid && !tabForNewWin" class="topMenu" :class="listMsgSel == 'msg' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('msg')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_msg.png')">
                    <span style="margin-left:5px;font-weight:bold">검색</span>
                </div>
                <div v-show="!thread.msgid && !tabForNewWin" class="topMenu" :class="listMsgSel == 'file' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('file')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_file.png')">
                    <span style="margin-left:5px;font-weight:bold">파일</span> 
                </div>
                <div v-show="!thread.msgid && !tabForNewWin" class="topMenu" :class="listMsgSel == 'image' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('image')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_image.png')">
                    <span style="margin-left:5px;font-weight:bold">이미지</span> 
                </div>
                <span v-if="adminShowID" style="color:darkblue;font-weight:bold;margin-left:20px">{{ msglist.length }}개</span>
                <div v-if="tabForNewWin=='' || tabForNewWin=='notyet'" class="topMenu list_msg_unsel" @click="listMsg('notyet')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg_notyet.png')">
                    <span style="margin-left:5px;font-weight:bold">아직안읽음</span> 
                </div>
                <div v-if="tabForNewWin=='notyet'"class="coImgBtn" @click="updateAllWithNewKind('notyet', 'read')" style="margin:0 0 4px 12px">
                    <span class="coImgSpn">모두읽음처리</span>
                </div>
                <!-- <div v-show="!thread.msgid && tabForNewWin==''" class="topMenu list_msg_unsel" @click="stressTest(true)"><span style="margin-left:5px;font-weight:bold">StressTest</span></div> -->
                <span v-show="route.fullPath.includes('/body/msglist')">
                    <span style="margin-left:20px">fifoLen : {{ fifoLen }}</span>
                </span>
            </div>
            <div class="chan_center_body" id="chan_center_body" :childbody="hasProp() ? true : false" ref="scrollArea" @scroll="onScrolling" @scrollend="onScrollEnd">
                <div v-show="afterScrolled" ref="observerTopTarget" class="coObserverTarget" :style="{ minHeight: showTopObserver ? '10px' : '0px', color:'transparent' }">{{ hush.cons.startOfData }}</div>
                <!--바로 아래 id는 읽음처리(readMsgToBeSeen)에 필요한 부분이므로 제거하면 안됨. 위 id(chan_center_body)도 그대로 두기-->
                <div v-for="(row, idx) in msglist" :id="row.MSGID" :key="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }" :keyidx="idx" class="msg_body procMenu"
                    :style="{ borderBottom: row.hasSticker ? '' : '1px solid lightgray', background: row.background ? row.background : '' }"
                    @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)" @click="rowClick(row)">
                    <div style="width:100%;padding-left:8px;display:flex;align-items:center;cursor:pointer" v-show="!row.stickToPrev">
                        <img v-if="chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].url" :src="chandtlObj[row.AUTHORID].url" 
                            class="coImg32 maintainContextMenu" style="border-radius:16px" @click="(e) => memProfile(e, row)"><!--, chandtlObj[row.AUTHORID].url-->
                        <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32 maintainContextMenu" @click="(e) => memProfile(e, row)"><!--, gst.html.getImageUrl('user.png')-->
                        <img :src="gst.html.getImageUrl(chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].alive ? 'online.png' : 'offline.png')" style="margin-top:-25px;margin-left:-8px">
                        <span style="margin-left:9px;font-weight:bold">{{ row.AUTHORNM }}</span>
                        <span v-if="vipStr.includes(',' + row.AUTHORID + ',')" class="vipMark">VIP</span>
                        <span v-if="adminShowID" style="margin-left:9px;color:dimgray">{{ row.MSGID }}</span>
                        <span style="margin-left:9px;color:dimgray">{{ hush.util.displayDt(row.CDT) }}</span>
                    </div>
                    <div style="width:100%;display:flex;margin:10px 0">
                        <div style="width:50px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:dimgray;cursor:pointer">
                            <span v-show="row.stickToPrev" style="color:lightgray">{{ hush.util.displayDt(row.CDT, true) }}</span>
                        </div>
                        <div class="msgHtml" style="width:calc(100% - 50px);overflow-x:auto">
                            <div v-html="row.BODY" @copy="(e) => msgCopied(e)"></div>
                        </div>
                    </div>
                    <div v-if="row.UDT && row.CDT != row.UDT" style="margin-bottom:10px;margin-left:50px;color:dimgray"><span>(편집: </span><span>{{ row.UDT.substring(0, 19) }})</span></div>
                    <div class="msg_body_react_read"><!-- 반응, 댓글 -->
                        <div style="min-width:50px;display:flex;justify-content:center;align-items:center">
                            <img v-if="row.act_later=='later'" class="coImg18"  style="margin-top:0px" :src="gst.html.getImageUrl('violet_later.png')" title="나중에">
                            <img v-if="row.act_fixed=='fixed'" class="coImg18"  style="margin-top:0px" :src="gst.html.getImageUrl('violet_fixed.png')" title="고정">
                        </div>
                        <div v-for="(row1, idx1) in row.msgdtl">
                            <div v-if="(row1.KIND == 'read' || row1.KIND == 'unread')">
                                <div v-if="row1.KIND == 'unread' && (', ' + row1.ID + ',').includes(', ' + g_userid + ',')" class="msg_body_sub1" :title="'['+row1.KIND+ ']'" @click="toggleReaction(row.MSGID, row1.KIND)">
                                    <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                                </div>
                            </div>
                            <div v-else class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleReaction(row.MSGID, row1.KIND)">
                                <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                                <span v-if="row1.KIND == 'notyet' && (', ' + row1.ID + ',').includes(', ' + g_userid + ',')" style="margin-left:3px;color:red;font-weight:bold">{{ row1.CNT}}</span>
                                <span v-else style="margin-left:3px">{{ row1.CNT}}</span>
                            </div>
                        </div>
                        <!-- <div v-if="row.msgdtl.length > 0" class="msg_body_sub1">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘">
                        </div>      -->
                        <div v-if="row.reply.length > 0" class="replyAct" @click="openThread(row.MSGID)">
                            <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center">
                                <img v-if="chandtlObj[row2.AUTHORID] && chandtlObj[row2.AUTHORID].url" :src="chandtlObj[row2.AUTHORID].url" 
                                    class="coImg18" style="border-radius:9px">
                                <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg18">
                            </div>
                            <div v-if="row.reply.length < row.replyinfo[0].CNT_BY_USER" style="display:flex;align-items:center;margin-left:2px">
                                ..{{ row.replyinfo[0].CNT_BY_USER }}명
                            </div>
                            <div style="margin:0 5px;display:flex;align-items:center">
                                <span style="margin-right:4px;color:steelblue;font-weight:bold">댓글 </span>
                                <span style="color:steelblue;font-weight:bold">{{ row.replyinfo[0].CNT_EACH }}개</span>
                                <span style="margin:0 4px;color:dimgray">최근:</span>
                                <span style="color:dimgray">{{ hush.util.displayDt(row.replyinfo[0].CDT_MAX) }}</span>
                                <span v-show="row.replyinfo[0].MYNOTYETCNT > 0" class="coMyNotYet">{{ row.replyinfo[0].MYNOTYETCNT }}</span>
                            </div>
                        </div>
                    </div>
                    <!-- <div class="msg_body_sub">
                        <div v-for="(row1, idx1) in row.msgdtlmention" style="margin-top:10px">
                            <span class="maintainContextMenu" style="margin-right:5px;padding:3px;font-weight:bold;color:steelblue;background:beige" 
                            @mouseenter="mentionEnter(row, row1)" @mouseleave="mentionLeave(row, row1)" @click="(e) => procMention(e, row1)">
                                @{{ row1.USERNM }}
                            </span>
                        </div>
                    </div> -->
                    <div v-if="row.msgimg.length > 0" class="msg_body_sub"><!-- 이미지 -->
                        <div v-for="(row5, idx5) in row.msgimg" class="msg_image_each" 
                            @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="showImage(row5, row.MSGID)">
                            <img :src="row5.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row5)">
                            <div v-show="row5.hover" class="msg_file_seemore">
                                <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                            </div>
                        </div>                
                    </div>
                    <div v-if="row.msgfile.length > 0" class="msg_body_sub"><!-- 파일 -->
                        <div v-for="(row5, idx5) in row.msgfile" class="msg_file_each" 
                            @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="downloadFile(row.MSGID, row5)">
                            <div style="height:100%;display:flex;align-items:center">
                                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_download.png')">
                                <span style="margin:0 3px">{{ row5.name }}</span>(<span>{{ hush.util.formatBytes(row5.size) }}</span>)
                            </div>
                            <div v-show="row5.hover" class="msg_file_seemore">
                                <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                            </div>
                        </div>
                    </div>
                    <div v-if="row.msglink.length > 0" class="msg_body_sub"><!-- 링크 -->
                        <div v-for="(row5, idx5) in row.msglink" class="msg_file_each"
                            @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="openLink(row5.url)">
                            <div style="height:100%;display:flex;align-items:center">
                                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_addlink.png')">
                                <span style="margin:0 3px;color:#005192">{{ row5.text }}</span>
                            </div>
                            <div v-show="row5.hover" class="msg_file_seemore">
                                <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                            </div>
                        </div>
                    </div>
                    <div v-show="row.hover" class="msg_proc">
                        <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_watching.png')" title="알아보는중" @click="toggleReaction(row.MSGID, 'watching')"></span>
                        <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_checked.png')" title="접수완료" @click="toggleReaction(row.MSGID, 'checked')"></span>
                        <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_done.png')" title="완료" @click="toggleReaction(row.MSGID, 'done')"></span>
                        <!-- <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘" @click="openEmoti(row.MSGID)"></span> -->
                        <span v-if="!hasProp()" class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드열기" @click="openThread(row.MSGID)"></span>
                        <span class="procAct">
                            <img class="coImg18" :src="gst.html.getImageUrl(!row.act_later ? 'dimgray_later.png' : 'violet_later.png')" title="나중에" @click="changeAction(row.MSGID, 'later')">
                        </span>
                        <span class="procAct">
                            <img class="coImg18" :src="gst.html.getImageUrl(!row.act_fixed ? 'dimgray_fixed.png' : 'violet_fixed.png')" title="고정" @click="changeAction(row.MSGID, 'fixed')">
                        </span>
                        <span class="procAct">
                            <img class="coImg18 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기" @click="(e) => rowRight(e, row)">
                        </span>                    
                    </div>
                </div>
                <div v-if="msglist.length == 0" style="height:100%;display:flex;justify-content:center;align-items:center" @click="procClearSearchWhenFocus">
                    <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
                </div><!--observerBottomTarget은 color 및 minHeight 유의-->
                <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget" style="min-height:0px;color:transparent">{{ hush.cons.endOfData }}</div>
            </div>
            <div v-if="tabForNewWin==''" class="chan_center_footer">
                <div style="width:100%;height:40px;display:flex;overflow-x:hidden;background:whitesmoke">
                    <div style="width:300px;height:100%;display:flex;align-items:center">
                        <div v-if="editMsgId" style="margin-left:10px;display:flex;align-items:center">
                            <div class="btn" @click="saveMsg" style="margin-right:10px">저장</div>
                            <div class="btn" @click="cancelMsg">취소</div>
                        </div>
                        <div v-else class="saveMenu" @click="saveMsg">
                            <img class="coImg20" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                        </div>
                        <img v-if="!editMsgId" class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_addlink.png')" 
                            title="링크추가" @click="uploadLink('addlink')">
                        <span v-if="hasProp()">
                            <input v-if="!editMsgId" id="file_upload_prop" type=file multiple hidden @change="uploadFile" />
                            <label v-if="!editMsgId" for="file_upload_prop">
                                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일추가">
                            </label>
                        </span>
                        <span v-else>
                            <input v-if="!editMsgId" id="file_upload" type=file multiple hidden @change="uploadFile" />
                            <label v-if="!editMsgId" for="file_upload">
                                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일추가">
                            </label>
                        </span>
                        <div style="width:8px;height:20px;margin-left:12px;border-left:1px solid dimgray"></div>
                        <!-- <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘추가" 
                            :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="addEmoti()"> -->
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_makelink.png')" title="링크로변환"
                            :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="makeLink()">
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_bold.png')" title="굵게"
                            :style="{ border: stateBold ? '1px solid dimgray' : '1px solid whitesmoke' }" @click="procWordStyle('B')">
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_strike.png')" title="취소"
                            :style="{ border: stateStrike ? '1px solid dimgray' : '1px solid whitesmoke' }" @click="procWordStyle('S')">
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_html.png')" title="HTMLView" 
                            @click="htmlView()"><!--개발자 사용-->
                    </div>
                    <div style="height:100%;margin-left:10px;display:flex;align-items:center">
                        <div v-show="listMsgSel == 'all' && newParentAdded.length > 0" class="coImgBtn" @click="addAllNew('P')" style="width:70px">
                            <span class="coImgSpn">메시지</span>
                            <span class="coMyNotYet">{{ newParentAdded.length }}</span> 
                        </div>
                        <div v-show="listMsgSel == 'all' && newChildAdded.length > 0" class="coImgBtn" @click="addAllNew('C')" style="width:80px">
                            <span class="coImgSpn">댓글</span>
                            <span class="coMyNotYet">{{ newChildAdded.length }}</span>
                        </div>
                    </div>
                    <div style="width:100%;height:100%;margin-left:10px;display:flex;align-items:center" class="coDotDot">
                        <div class="coDotDot">
                            <span v-show="memNmTyping.length > 0">{{ memNmTyping.join(',') }}</span>
                            <span v-show="memNmTyping.length == 0">줄바꿈 : Shift+Enter</span>
                        </div>
                    </div>
                </div><!--향후 tiptap editor npm for vue.js 사용도 고려해보기로 함-->
                <div v-if="hasProp()" id="msgContent_prop" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef"
                    @paste="pasteData" @keydown="keyDown" @keyup="keyUp" @focusin="editorFocused(true)" @blur="editorFocused(false)" @mousedown="editorFocused(true)" @mouseup="chkWordStyle">
                </div> <!--@keyup.enter="keyUpEnter" 로 처리시 prevent는 필요없지만 newline이 생김 : @keydown.enter.prevent로 대체-->
                <div v-else id="msgContent" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef"
                    @paste="pasteData" @keydown="keyDown" @keyup="keyUp" @focusin="editorFocused(true)" @blur="editorFocused(false)" @mousedown="editorFocused(true)" @mouseup="chkWordStyle">
                </div>
                <div v-if="showHtml" class="editor_body" style="background:beige">{{ msgbody }}</div>
                <div v-if="imgBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                    <div v-for="(row, idx) in imgBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="showImage(row, 'temp')" class="msg_image_each">
                        <img :src="row.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row)">
                        <div v-show="row.hover" class="msg_file_del">
                            <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('I', 'temp', idx)">
                        </div>
                    </div>                
                </div>
                <div v-if="fileBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                    <div v-for="(row, idx) in fileBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="downloadFile('temp', row)" class="msg_file_each">
                        <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ hush.util.formatBytes(row.size) }}</span>)</div>
                        <div v-show="row.hover" class="msg_file_del">
                            <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('F', 'temp', idx)">
                        </div>
                    </div><!-- 아래 진행바는 db에 파일저장시엔 용량제한이 있으므로 실제 육안으로는 보이지 않고 파일시스템 저장 적용시 대용량에 한해서 보이게 될 것임 -->
                    <div v-for="(row, idx) in uploadFileProgress" v-show="row.percent > 0 && row.percent < 100" class="msg_file_each">
                        <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ row.size }}</span>)</div>
                        <div class="msg_file_seemore">
                            <span style="padding:0 5px;color:red">{{ row.percent }}%</span>
                        </div>
                    </div>
                </div>
                <div v-if="linkArr.length > 0 && !editMsgId" class="msg_body_blob">
                    <div v-for="(row, idx) in linkArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="openLink(row.url)" class="msg_file_each">
                        <div><span style="margin-right:3px;color:#005192">{{ row.text }}</span></div>
                        <div v-show="row.hover" class="msg_file_del">
                            <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('L', 'temp', idx)">
                        </div>
                    </div>
                </div>
            </div>            
        </div>
        <div class="chan_right" v-if="thread.msgid" :style="{ width: widthChanRight }">
            <msg-list :data="thread" @ev-to-parent="handleEvFromChild" ref="msglistRef"></msg-list>
        </div>        
    </div>
    <div v-if="showMentionDropdown" class="mention-popup" :style="{ top: mentionPosition.top + 'px', left: mentionPosition.left + 'px' }">
        <div style="width:100%;display:flex;justify-content:space-between;align-items:center;border:1px solid lightgray">
            <input v-model="userToSearch" ref="userToSearchInput" @focus="procUserToSearchFocused(true)" @blur="procUserToSearchFocused(false)" @input="handleInput"
                style="width:calc(100% - 30px);height:28px;padding-left:5px;border:0px solid lightgray" placeholder="사용자 검색" spellcheck="false" />
            <img class="coImg24" :src="gst.html.getImageUrl('close.png')" @click.stop="closeMentionDropdown" style="margin:0 3px">
        </div>
        <div class="mention-dropdown" style="display:flex">
            <div v-for="(user, index) in filteredUsers" :key="user.USERID" class="mention-item" :class="{ selected: index == selectedMentionIndex }" @click="selectMention(user)">
                <div class="mention-avatar">{{ user.USERNM.charAt(0).toUpperCase() }}</div>
                <div class="mention-info">
                    <div class="mention-name">{{ user.USERNM }}</div>
                    <div class="mention-userinfo">{{ user.userInfo }}</div>
                </div>
            </div>
        </div>
    </div>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
    <popup-image ref="imgPopupRef" :param="imgParam">
        <img :src="imgPopupUrl" :style='imgPopupStyle'>
    </popup-image>
    <popup-common ref="linkPopupRef" :kind="popupRefKind" @ev-click="okPopup">
        <div style="display:flex;flex-direction:column">
            <input v-model="linkText" style="width:300px;height:24px;border:1px solid dimgray" placeholder="표시 텍스트" />
            <input v-model="linkUrl" style="width:300px;height:24px;margin-top:15px;border:1px solid dimgray" placeholder="링크 http(s)://" />
        </div>
    </popup-common>
    <popup-chan-dm ref="popupChanDmRef" @ev-click-chandm="okChanDmPopup"></popup-chan-dm> 
    <media-search ref="mediaPopupRef"></media-search>
    <member-list ref="memberlistRef"></member-list>
</template>

<style scoped>  
    input:focus { outline:1px solid lightgray }
    .chan_main { /* 원래는 각 패널에 있다가 msglist 라우팅(새창에서열기) 때문에 여기로 이동 - 댓글 관련 */
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
    .chan_center {
        height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;overflow:hidden
    }
    .chan_center_header_left {
        width:calc(100% - 320px);height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:320px;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_nav {
        width:100%;min-height:30px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .list_msg_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black;cursor:pointer }
    .list_msg_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white;cursor:pointer }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        position:relative;width:calc(100% - 20px);display:flex;flex-direction:column;margin:5px 0 0 0;cursor:pointer /*position:relative는 floating menu에 필요*/
    }
    .msg_body_react_read {
        min-height:30px;margin:0 0 0 0px;display:flex;flex-wrap:wrap;justify-content:flex-start;cursor:pointer
    }
    .msg_body_sub {
        margin:0 0 0 50px;display:flex;flex-wrap:wrap;justify-content:flex-start;cursor:pointer
    }
    .msg_body_sub1 {
        margin-right:10px;padding:4px 8px;display:flex;align-items:center;background:#e6e7eb;border:1px solid #e6e7eb;border-radius:12px
    }
    .msg_body_sub1:hover {
        background:whitesmoke;border:1px solid dimgray
    }
    .msg_body_sub1:active {
        background:lightsteelblue;border:1px solid lightsteelblue
    }
    .msg_body_blob {
        margin-bottom:5px;padding-left:8px;display:flex;flex-wrap:wrap;justify-content:flex-start
    }
    .msg_file_each { /*position:relative는 floating menu에 필요*/
        position:relative;min-width:100px;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_file_each:hover { background:var(--hover-color) }
    .msg_file_each:active { background:lightsteelblue }
    .msg_file_seemore {
        position:absolute;top:0;right:0;padding:0 3px;height:30px;display:flex;align-items:center;background:whitesmoke;border-radius:0px
    }
    .msg_file_del {
        position:absolute;top:-10px;right:-10px;width:18px;height:18px;border-radius:9px;display:flex;align-items:center;background:beige
    }
    .msg_image_each {/*position:relative는 floating menu에 필요*/
        position:relative;width:80px;height:80px;margin:10px 10px 0 0;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_proc {
        position:absolute;height:20px;right:3px;top:1px;padding:5px 0 5px 10px;z-index:8888;
        display:flex;align-items:center;
        background:white;border:1px solid lightgray;border-radius:5px
    }
    .chan_center_footer {
        width:100%;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border:1px solid lightgray;border-radius:5px;
    }
    .editor_body {
        width:calc(100% - 10px);min-height:40px;max-height:300px;padding:5px;overflow-y:scroll
    }
    .chan_right {
        height:100%;border-left:var(--border-lg) /* 여기에 다시 MsgList.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .replyAct { display:flex;align-items:center;cursor:pointer }
    .replyAct:hover { background:#e6e7eb;border-radius:12px }
    .replyAct:active { background:var(--active-color) }
    .procMenu { padding:5px 5px 5px 0;margin-right:10px;border-radius:5px;cursor:text }
    .procMenu:hover { background:whitesmoke }
    .procAct { padding:4px;margin-right:10px;border-radius:5px;background:white;cursor:pointer }
    .procAct:hover { background:lightgray }
    .procAct:active { background:var(--active-color) }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:var(--active-color) }
    .saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:#3B693B;border-radius:5px }
    .saveMenu:hover { opacity:0.8 }
    .saveMenu:active { opacity:0.6 }
    .btn { padding:3px 6px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer }
    .btn:hover { background:lightgray}
    .btn:active { background:var(--active-color)}
    .vipMark { margin-left:5px;padding:2px;font-size:10px;background:black;color:white;border-radius:5px }
    .mention-popup {
        position:absolute;width:300px;height:240px;display:flex;flex-direction:column;
        background:white;border:1px solid #ddd;border-radius:8px;/*box-shadow:0 4px 12px rgba(0, 0, 0, 0.15);*/
        z-index:1000;
    }
    .mention-dropdown {
        width:100%;height:100%;display:flex;flex-direction:column; /* position:absolute;min-width:200px;max-height:200px; */
        background:white;
        /* border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 12px rgba(0, 0, 0, 0.15); */
        /* z-index:1000; */
        overflow-y:scroll /*overflow-y:auto; */
    }
    .mention-item { 
        min-height:40px;max-height:40px;display:flex;padding:8px 12px;cursor:pointer;transition: background-color 0.2s;
        flex:1;overflow-x:hidden /* 추가 */
    }
    .mention-item:hover, .mention-item.selected { background:#f8f9fa }
    .mention-avatar { 
        width:32px;height:32px;margin-right:12px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        border-radius:50%;background:#007bff;color:white;font-weight:bold;font-size:14px 
    }
    /* .mention-info { flex:1;min-width:0 } */
    .mention-name { font-weight:500;color:#333;font-size:14px;margin-bottom:2px }
    .mention-userinfo { color:#6c757d;font-size:12px }
    /* 아래 deep은 원해 하위컴포넌트에 영향을 주기 위한 vue3.0의 기법으로 이해하고 있는데 
    MsgList.vue에서 사용하지 않으면 mention clickable 클래스가 먹히지 않고 있음 */
    .editor_body:deep(.mention), .msgHtml:deep(.mention) {
        margin:0 1px;padding:2px 6px;
        background:#e3f2fd;color:#1976d2;border-radius:4px;font-weight:500;display:inline-block;transition:all 0.2s ease
    }
    .editor_body:deep(.mention.clickable), .msgHtml:deep(.mention.clickable) { cursor:pointer;user-select:none }
    .editor_body:deep(.mention.clickable:hover), .msgHtml:deep(.mention.clickable:hover) {
        background:#bbdefb;color:#0d47a1 /*transform:translateY(-1px)*/
    }
</style>
