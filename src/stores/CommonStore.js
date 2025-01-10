import { ref } from 'vue'

//CommonStore.js는 pinia 모듈을 사용하지 않음 (GeneralStore.vue와 분리해 편리/명확하게 관리하고자 함)

//MenuLoader.vue에서 사용 : 비동기로 호출한 list와 doc처럼 sibling 사이의 함수 호출 목적 (basicRef는 향후 호출을 위한 Reserve) 
export let listRef = ref(null), docRef = ref(null), basicRef = ref(null)

