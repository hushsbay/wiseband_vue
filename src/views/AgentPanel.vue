<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import GeneralStore from '/src/stores/GeneralStore.js'
import hush from '/src/stores/Common.js'
import S_CATE from '/src/testdata/S_CATE.json'

const gst = GeneralStore()
const router = useRouter()

const kind = ref('개인')
const cate = ref([])
const SEL_KEY = 'wiseband_selected_cateid'

onMounted(async () => {
	// testdata load - 처음 로드시 트리는 모두 펼치기
	console.log('[AgentPanel] onMounted restore start')
	const saved = localStorage.getItem(SEL_KEY)
	cate.value = S_CATE.map(item => ({ ...item, exploded: true, sel: false, hover: false }))
	if (saved) {
		console.log('[AgentPanel] found saved selection', saved)
		const idx = cate.value.findIndex(x => x.CATEID == saved)
		if (idx !== -1) {
			cate.value[idx].sel = true
			// if saved node is a leaf, simulate click to trigger navigation/behavior
			if (!hasChild(idx)) {
					await nextTick()
					try { nodeClick(cate.value[idx], true) } catch (e) {}
			}
		}
	}
})

function procExpCol(type) {
	const exploded = (type == 'E') ? true : false
	for (let i = 0; i < cate.value.length; i++) {
		cate.value[i].exploded = exploded
	}
}

async function refreshPanel() {
	// simple reload from testdata, preserve selection from localStorage
	const saved = localStorage.getItem(SEL_KEY)
	cate.value = S_CATE.map(item => ({ ...item, exploded: true, sel: false, hover: false }))
	if (saved) {
		const idx = cate.value.findIndex(x => x.CATEID == saved)
		if (idx !== -1) {
			cate.value[idx].sel = true
			// if saved node is a leaf, simulate click to trigger navigation/behavior
			if (!hasChild(idx)) {
					await nextTick()
					try { nodeClick(cate.value[idx], true) } catch (e) {}
			}
		}
	}
	gst.util.setToast('트리가 새로고침되었습니다.')
}

const visibleNodes = computed(() => {
	return cate.value.map((row, idx) => ({ row, idx })).filter(x => isVisible(x.idx))
})

function changeKind() {
	// currently only 개인
}

function nodeClick(row, forceReload = false) {
	const idx = cate.value.findIndex(x => x.CATEID == row.CATEID)
	if (idx === -1) return

	// If node has children, toggle expanded state only (don't change selection)
	if (hasChild(idx)) {
		cate.value[idx].exploded = !cate.value[idx].exploded
		return
	}

	// Leaf node: make it selected (exclusive)
	cate.value.forEach((it) => { it.sel = false })
	cate.value[idx].sel = true
	try { localStorage.setItem(SEL_KEY, row.CATEID) } catch (e) {}

	// ensure Main.vue's side menu state reflects Agent so it doesn't auto-switch away
	try { gst.selSideMenu = 'mnuAgent'; localStorage.wiseband_lastsel_menu = 'mnuAgent' } catch (e) {}

	if (!row.CATEID) return
	console.log('[AgentPanel] nodeClick', { cateid: row.CATEID, forceReload })
	// navigate to DocList with cateid
	// when forceReload is true add a timestamp query so Vue Router treats it as a new navigation
	if (forceReload) {
		router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: '0' }, query: { _r: Date.now() } })
	} else {
		router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: '0' } })
	}
}

function mouseEnter(row) {
	if (row.sel) return
	row.hover = true
}

function mouseLeave(row) {
	if (row.sel) return
	row.hover = false
}

function hasChild(idx) {
	const arr = cate.value
	if (!arr[idx]) return false
	const cur = arr[idx]
	for (let i = idx + 1; i < arr.length; i++) {
		if (arr[i].DEPTH <= cur.DEPTH) break
		if (arr[i].DEPTH === cur.DEPTH + 1) return true
	}
	return false
}

function isVisible(idx) {
	const arr = cate.value
	if (!arr[idx]) return false
	const curDepth = arr[idx].DEPTH
	if (curDepth === 0) return true
	let needDepth = curDepth
	for (let i = idx - 1; i >= 0; i--) {
		const p = arr[i]
		if (p && p.DEPTH < needDepth) {
			// p is an ancestor
			if (!p.exploded) return false
			needDepth = p.DEPTH
			if (needDepth === 0) break
		}
	}
	return true
}

function allowDrop(e) { e.preventDefault() }

function handleDrop(e, row) {
	e.preventDefault()
	// two drop sources: draggedDoc (doc id) or dragged_tag (from DocList)
	const draggedDoc = localStorage.getItem('wiseband_dragged_doc')
	if (draggedDoc) {
		// navigate to agent_list with docid to indicate classification
		router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: draggedDoc } })
		localStorage.removeItem('wiseband_dragged_doc')
		return
	}
	const draggedTag = localStorage.getItem('wiseband_dragged_tag')
	if (draggedTag) {
		try {
			const obj = JSON.parse(draggedTag)
			// navigate to agent_list with cateid (target) and docid so DocList can update the doc's category
			router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: obj.docid } })
			gst.util.setToast('분류가 트리에 적용되었습니다.')
		} catch (err) {
			// ignore
		}
		localStorage.removeItem('wiseband_dragged_tag')
		return
	}

	// support drag requests coming from DocList drop_tag when user wants to pick a node
	const dragRequest = localStorage.getItem('wiseband_drag_request')
	if (dragRequest) {
		try {
			const req = JSON.parse(dragRequest)
			// req.docid contains the doc that requested a node — apply this node to that doc
			router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: req.docid } })
			gst.util.setToast('분류가 트리에 적용되었습니다.')
		} catch (err) {
			// ignore
		}
		localStorage.removeItem('wiseband_drag_request')
		return
	}
}

function nodeDragStart(e, row, idx) {
    // Build a simple path like 'Parent > Child' by walking cate backwards
    let path = row.CATENM
    if (row.DEPTH && row.DEPTH > 0) {
        // find ancestors
        for (let i = idx - 1; i >= 0; i--) {
            const p = cate.value[i]
            if (p && p.DEPTH < row.DEPTH) {
                path = p.CATENM + ' > ' + path
                // for multi-level, continue walking
                if (p.DEPTH > 0) {
                    // continue to find higher ancestors
                    let curDepth = p.DEPTH
                    for (let j = i - 1; j >= 0; j--) {
                        const pp = cate.value[j]
                        if (pp && pp.DEPTH < curDepth) {
                            path = pp.CATENM + ' > ' + path
                            curDepth = pp.DEPTH
                            if (curDepth == 0) break
                        }
                    }
                }
                break
            }
        }
    }
    const payload = { cateid: row.CATEID, path: path }
    try { localStorage.setItem('wiseband_dragged_node', JSON.stringify(payload)) } catch (e) {}
}
</script>

<template>
	<div class="agent_panel">
		<div class="agent_side">
			<div class="agent_side_top">
				<div class="agent_side_top_left">
					<select v-model="kind" @change="changeKind" class="kind_select">
						<option>개인</option>
						<option>공유</option>
						<option>전체</option>
					</select>
				</div>
				<div class="agent_side_top_right">
					<div style="padding:5px;border-radius:8px" @click="refreshPanel">
						<img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침">
					</div>
					<div style="padding:5px;border-radius:8px" @click="procExpCol('C')">
						<img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'collapseall.png')" title="모두접기">
					</div>
					<div style="padding:5px;border-radius:8px" @click="procExpCol('E')">
						<img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'expandall.png')" title="모두펼치기">
					</div>
				</div>
			</div>
			<div class="agent_side_main coScrollable">
				<div v-for="item in visibleNodes" :key="item.row.CATEID" class="node_wrap">
					<!-- Reserve a fixed slot for the expand icon so nodes align even when icon is absent -->
					<div class="node" :class="[item.row.DEPTH == 0 ? 'nodeRoot' : 'nodeLeaf', item.row.sel ? 'nodeSel' : '', item.row.hover ? 'nodeHover' : '']" @click="nodeClick(item.row)" @mouseenter="() => mouseEnter(item.row)" @mouseleave="() => mouseLeave(item.row)" @dragover.prevent="allowDrop" @drop="(e) => handleDrop(e, item.row)" draggable="true" @dragstart="(e) => nodeDragStart(e, item.row, item.idx)" :style="{ paddingLeft: (item.row.DEPTH * 16) + 'px' }">
						<span class="exp_icon">{{ hasChild(item.idx) ? (item.row.exploded ? '▾' : '▸') : '' }}</span>
						<img class="coImg14" :src="gst.html.getImageUrl(hasChild(item.idx) ? 'white_home.png' : (item.row.sel ? 'violet_channel.png' : 'white_channel.png'))">
						<span style="margin-left:5px">{{ item.row.CATENM }}</span>
					</div>
				</div>
			</div>
		</div>
		<div class="agent_body">
			<router-view />
		</div>
	</div>
</template>

<style scoped>
.agent_panel { display:flex;height:100% }
.agent_side { width:320px;background:var(--second-color);border-right:1px solid #ddd;display:flex;flex-direction:column }
.agent_side_top { width:100%;height:50px;display:flex;justify-content:space-between;align-items:center }
.agent_side_top_left { width:auto;height:100%;padding-left:8px;display:flex;align-items:center }
.agent_side_top_right { width:auto;height:100%;padding-right:8px;display:flex;justify-content:flex-end;align-items:center }
.kind_select { display:inline-block;padding:6px;border-radius:6px;border:none;background:var(--second-color);color:var(--second-select-color);min-width:40px }
.agent_side_main { flex:1;padding:8px;overflow:auto }
	.node { display:flex;align-items:center;padding:8px;border-radius:6px;cursor:pointer }
.nodeRoot { font-weight:700;color:var(--second-select-color) }
.nodeLeaf { color:var(--second-select-color) }
	.node:not(.nodeSel):hover { background:var(--second-hover-color) }
.nodeHover { background:var(--second-hover-color) }
.nodeSel { background:var(--second-select-color); color:var(--primary-color) }
.agent_body { flex:1; padding:12px; overflow:auto }
.exp_icon { display:inline-flex; width:24px; height:24px; justify-content:center; align-items:center; color:var(--second-select-color); font-size:14px }
.coImg20:hover { background:var(--second-hover-color); }
.coImg20:active { background:var(--active-color);border-radius:9px }
</style>