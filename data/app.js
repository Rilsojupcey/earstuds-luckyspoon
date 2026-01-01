const FRUITS = ["草莓","樱桃","柠檬","葡萄","桃子","菠萝","蓝莓","苹果"]

const SIZES = ["4mm","6mm","8mm"]

const XLSX_FILES = {
  "华子": "data/swaro.xlsx",
  "锆石": "data/zircon.xlsx",
  "锆石异形": "data/zircon_special.xlsx",
}

const COMBOS = [
  ["华子","4mm"],["华子","6mm"],["华子","8mm"],
  ["锆石","4mm"],["锆石","6mm"],["锆石","8mm"],
  ["锆石异形","4mm"],["锆石异形","6mm"],["锆石异形","8mm"],
]

function el(id){ return document.getElementById(id) }

function logLine(box, s){
  box.textContent += s + "\n"
  box.scrollTop = box.scrollHeight
}

function delay(ms){ return new Promise(r=>setTimeout(r, ms)) }

function randint(n){ return Math.floor(Math.random() * n) }

function choice(arr){ return arr[randint(arr.length)] }

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = randint(i+1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function initUI(){
  const wish = el("wishFruit")
  FRUITS.forEach(x=>{
    const opt=document.createElement("option")
    opt.value=x
    opt.textContent=x
    wish.appendChild(opt)
  })

  const comboBox = el("comboBox")
  COMBOS.forEach(([t,s])=>{
    const lab=document.createElement("label")
    lab.className="tag"
    const cb=document.createElement("input")
    cb.type="checkbox"
    cb.checked=true
    cb.value = t + "||" + s
    const span=document.createElement("span")
    span.textContent = t + " " + s
    lab.appendChild(cb)
    lab.appendChild(span)
    comboBox.appendChild(lab)
  })
}

const workbookCache = new Map()

async function loadWorkbook(typeName){
  const path = XLSX_FILES[typeName]
  if(!path) throw new Error("未知类型 " + typeName)

  if(workbookCache.has(path)) return workbookCache.get(path)

  const resp = await fetch(path)
  if(!resp.ok) throw new Error("读取失败 " + path + " " + resp.status)

  const buf = await resp.arrayBuffer()
  const wb = XLSX.read(buf, {type:"array"})
  workbookCache.set(path, wb)
  return wb
}

function sheetToItems(wb, sheetName, typeName){
  const ws = wb.Sheets[sheetName]
  if(!ws) throw new Error("找不到sheet " + sheetName + " in " + typeName)

  const a1 = (ws["A1"] && ws["A1"].v) ? String(ws["A1"].v).trim() : ""
  const b1 = (ws["B1"] && ws["B1"].v) ? String(ws["B1"].v).trim() : ""

  const items = []

  if(a1 === "商品分类" && b1 === "商品名称"){
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})
    for(let i=1;i<rows.length;i++){
      const cat = String(rows[i][0] ?? "").trim()
      const name = String(rows[i][1] ?? "").trim()
      if(!name) continue
      items.push({类型:typeName, 规格:sheetName, 分类:cat, 名称:name})
    }
  }else{
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})
    for(let i=0;i<rows.length;i++){
      const name = String(rows[i][1] ?? "").trim()
      if(!name) continue
      items.push({类型:typeName, 规格:sheetName, 分类:"", 名称:name})
    }
  }

  return items
}

async function buildPoolFromCombos(comboList){
  const pool = []
  const seen = new Set()

  for(const [t, s] of comboList){
    const wb = await loadWorkbook(t)
    const items = sheetToItems(wb, s, t)

    for(const it of items){
      const key = it.类型 + "||" + it.规格 + "||" + it.名称
      if(seen.has(key)) continue
      seen.add(key)
      pool.push(it)
    }
  }

  return pool
}

async function drawEarstuds(drawTimes, comboList, logBox){
  const pool = await buildPoolFromCombos(comboList)
  const poolSize = pool.length

  logLine(logBox, "抽耳钉开始")
  logLine(logBox, "池子总数 " + poolSize)

  const allowRepeat = drawTimes > poolSize
  if(allowRepeat) logLine(logBox, "抽取次数大于池子总数 将允许重复抽取")

  const used = new Set()

  for(let i=1;i<=drawTimes;i++){
    let it

    if(allowRepeat){
      it = pool[randint(pool.length)]
    }else{
      while(true){
        it = pool[randint(pool.length)]
        const key = it.类型 + "||" + it.规格 + "||" + it.名称
        if(!used.has(key)){
          used.add(key)
          break
        }
      }
    }

    logLine(logBox, "耳钉第 " + i + " 抽：抽到 " + it.名称)
    await delay(120)
  }
}

async function runMatchGame(initialDraws, wishFruit, logBox){
  let wishTriggered = false
  let totalDraws = 0
  let pairCount = 0
  let wishBonusCount = 0

  const activeCards = []
  const indexOfUnpaired = new Map()

  function rebuildIndex(){
    indexOfUnpaired.clear()
    for(let i=0;i<activeCards.length;i++){
      indexOfUnpaired.set(activeCards[i], i)
    }
  }

  function listLine(){
    return activeCards.join(" ")
  }

  logLine(logBox, "—— 抽卡开始 ——")
  logLine(logBox, "初始抽数 " + initialDraws)
  logLine(logBox, "许愿种类 " + wishFruit)
  logLine(logBox, "")

  const initialList = Array.from({length:initialDraws}, ()=>choice(FRUITS))
  totalDraws = initialDraws

  logLine(logBox, "初始抽完")
  logLine(logBox, initialList.join(" "))
  logLine(logBox, "")

  let bonusDraws = 0

  for(let i=0;i<initialList.length;i++){
    const draw = initialList[i]

    if(draw === wishFruit && !wishTriggered){
      wishTriggered = true
      wishBonusCount += 1
      bonusDraws += 1
      logLine(logBox, "初始第 " + (i+1) + " 抽 许愿命中 " + draw + " +1抽")
    }

    if(indexOfUnpaired.has(draw)){
      pairCount += 1
      bonusDraws += 1
      logLine(logBox, "初始阶段 " + draw + " 和 " + draw + " 对对碰成功 +1抽")

      const prevIdx = indexOfUnpaired.get(draw)
      activeCards.splice(prevIdx, 1)
      rebuildIndex()
    }else{
      activeCards.push(draw)
      indexOfUnpaired.set(draw, activeCards.length - 1)
    }
  }

  logLine(logBox, "合计 +" + bonusDraws + "抽")
  logLine(logBox, "")
  logLine(logBox, listLine())
  logLine(logBox, "加抽开始")
  logLine(logBox, "")

  let remainingDraws = bonusDraws

  while(remainingDraws > 0){
    remainingDraws -= 1
    totalDraws += 1

    const draw = choice(FRUITS)
    logLine(logBox, "第 " + totalDraws + " 抽：抽到 " + draw)
    await delay(250)

    const wishHitNow = (draw === wishFruit && !wishTriggered)
    const pairHitNow = indexOfUnpaired.has(draw)

    activeCards.push(draw)
    if(!pairHitNow) indexOfUnpaired.set(draw, activeCards.length - 1)

    logLine(logBox, listLine() + "｜剩余抽数 " + remainingDraws)
    await delay(250)

    let anyEvent = false

    if(wishHitNow){
      wishTriggered = true
      wishBonusCount += 1
      remainingDraws += 1
      anyEvent = true
      logLine(logBox, "→ 许愿命中 " + draw + " +1抽")
      await delay(150)
    }

    if(pairHitNow){
      pairCount += 1
      remainingDraws += 1
      anyEvent = true
      logLine(logBox, "→ " + draw + " 和 " + draw + " 对对碰成功 +1抽")
      await delay(150)

      activeCards.pop()
      const prevIdx = indexOfUnpaired.get(draw)
      activeCards.splice(prevIdx, 1)
      rebuildIndex()
    }

    if(anyEvent){
      logLine(logBox, listLine() + "｜剩余抽数 " + remainingDraws)
      await delay(250)
    }
  }

  logLine(logBox, "")
  logLine(logBox, "—— 结果汇总 ——")
  logLine(logBox, "总抽数 " + totalDraws)
  logLine(logBox, "完成对对碰数量 " + pairCount)
  logLine(logBox, "许愿奖励触发次数 " + wishBonusCount)

  if(activeCards.length > 0){
    logLine(logBox, "未配对残留 " + listLine())
  }else{
    logLine(logBox, "未配对残留 无")
  }

  return totalDraws
}

async function start(){
  const log1 = el("log1")
  const log2 = el("log2")
  log1.textContent = ""
  log2.textContent = ""

  const initialDraws = Number(el("initialDraws").value || 0)
  const wishFruit = el("wishFruit").value

  const picked = Array.from(document.querySelectorAll("#comboBox input[type=checkbox]"))
    .filter(x=>x.checked)
    .map(x=>x.value)

  if(picked.length === 0){
    logLine(log1, "至少选择一个耳钉组合")
    return
  }

  const comboList = picked.map(v=>{
    const [t, s] = v.split("||")
    return [t, s]
  })

  const totalDraws = await runMatchGame(initialDraws, wishFruit, log1)
  await delay(200)
  await drawEarstuds(totalDraws, comboList, log2)
}

initUI()
el("startBtn").addEventListener("click", start)const FRUITS = ["草莓","樱桃","柠檬","葡萄","桃子","菠萝","蓝莓","苹果"]

const SIZES = ["4mm","6mm","8mm"]

const XLSX_FILES = {
  "华子": "data/swaro.xlsx",
  "锆石": "data/zircon.xlsx",
  "锆石异形": "data/zircon_special.xlsx",
}

const COMBOS = [
  ["华子","4mm"],["华子","6mm"],["华子","8mm"],
  ["锆石","4mm"],["锆石","6mm"],["锆石","8mm"],
  ["锆石异形","4mm"],["锆石异形","6mm"],["锆石异形","8mm"],
]

function el(id){ return document.getElementById(id) }

function logLine(box, s){
  box.textContent += s + "\n"
  box.scrollTop = box.scrollHeight
}

function delay(ms){ return new Promise(r=>setTimeout(r, ms)) }

function randint(n){ return Math.floor(Math.random() * n) }

function choice(arr){ return arr[randint(arr.length)] }

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = randint(i+1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function initUI(){
  const wish = el("wishFruit")
  FRUITS.forEach(x=>{
    const opt=document.createElement("option")
    opt.value=x
    opt.textContent=x
    wish.appendChild(opt)
  })

  const comboBox = el("comboBox")
  COMBOS.forEach(([t,s])=>{
    const lab=document.createElement("label")
    lab.className="tag"
    const cb=document.createElement("input")
    cb.type="checkbox"
    cb.checked=true
    cb.value = t + "||" + s
    const span=document.createElement("span")
    span.textContent = t + " " + s
    lab.appendChild(cb)
    lab.appendChild(span)
    comboBox.appendChild(lab)
  })
}

const workbookCache = new Map()

async function loadWorkbook(typeName){
  const path = XLSX_FILES[typeName]
  if(!path) throw new Error("未知类型 " + typeName)

  if(workbookCache.has(path)) return workbookCache.get(path)

  const resp = await fetch(path)
  if(!resp.ok) throw new Error("读取失败 " + path + " " + resp.status)

  const buf = await resp.arrayBuffer()
  const wb = XLSX.read(buf, {type:"array"})
  workbookCache.set(path, wb)
  return wb
}

function sheetToItems(wb, sheetName, typeName){
  const ws = wb.Sheets[sheetName]
  if(!ws) throw new Error("找不到sheet " + sheetName + " in " + typeName)

  const a1 = (ws["A1"] && ws["A1"].v) ? String(ws["A1"].v).trim() : ""
  const b1 = (ws["B1"] && ws["B1"].v) ? String(ws["B1"].v).trim() : ""

  const items = []

  if(a1 === "商品分类" && b1 === "商品名称"){
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})
    for(let i=1;i<rows.length;i++){
      const cat = String(rows[i][0] ?? "").trim()
      const name = String(rows[i][1] ?? "").trim()
      if(!name) continue
      items.push({类型:typeName, 规格:sheetName, 分类:cat, 名称:name})
    }
  }else{
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""})
    for(let i=0;i<rows.length;i++){
      const name = String(rows[i][1] ?? "").trim()
      if(!name) continue
      items.push({类型:typeName, 规格:sheetName, 分类:"", 名称:name})
    }
  }

  return items
}

async function buildPoolFromCombos(comboList){
  const pool = []
  const seen = new Set()

  for(const [t, s] of comboList){
    const wb = await loadWorkbook(t)
    const items = sheetToItems(wb, s, t)

    for(const it of items){
      const key = it.类型 + "||" + it.规格 + "||" + it.名称
      if(seen.has(key)) continue
      seen.add(key)
      pool.push(it)
    }
  }

  return pool
}

async function drawEarstuds(drawTimes, comboList, logBox){
  const pool = await buildPoolFromCombos(comboList)
  const poolSize = pool.length

  logLine(logBox, "抽耳钉开始")
  logLine(logBox, "池子总数 " + poolSize)

  const allowRepeat = drawTimes > poolSize
  if(allowRepeat) logLine(logBox, "抽取次数大于池子总数 将允许重复抽取")

  const used = new Set()

  for(let i=1;i<=drawTimes;i++){
    let it

    if(allowRepeat){
      it = pool[randint(pool.length)]
    }else{
      while(true){
        it = pool[randint(pool.length)]
        const key = it.类型 + "||" + it.规格 + "||" + it.名称
        if(!used.has(key)){
          used.add(key)
          break
        }
      }
    }

    logLine(logBox, "耳钉第 " + i + " 抽：抽到 " + it.名称)
    await delay(120)
  }
}

async function runMatchGame(initialDraws, wishFruit, logBox){
  let wishTriggered = false
  let totalDraws = 0
  let pairCount = 0
  let wishBonusCount = 0

  const activeCards = []
  const indexOfUnpaired = new Map()

  function rebuildIndex(){
    indexOfUnpaired.clear()
    for(let i=0;i<activeCards.length;i++){
      indexOfUnpaired.set(activeCards[i], i)
    }
  }

  function listLine(){
    return activeCards.join(" ")
  }

  logLine(logBox, "—— 抽卡开始 ——")
  logLine(logBox, "初始抽数 " + initialDraws)
  logLine(logBox, "许愿种类 " + wishFruit)
  logLine(logBox, "")

  const initialList = Array.from({length:initialDraws}, ()=>choice(FRUITS))
  totalDraws = initialDraws

  logLine(logBox, "初始抽完")
  logLine(logBox, initialList.join(" "))
  logLine(logBox, "")

  let bonusDraws = 0

  for(let i=0;i<initialList.length;i++){
    const draw = initialList[i]

    if(draw === wishFruit && !wishTriggered){
      wishTriggered = true
      wishBonusCount += 1
      bonusDraws += 1
      logLine(logBox, "初始第 " + (i+1) + " 抽 许愿命中 " + draw + " +1抽")
    }

    if(indexOfUnpaired.has(draw)){
      pairCount += 1
      bonusDraws += 1
      logLine(logBox, "初始阶段 " + draw + " 和 " + draw + " 对对碰成功 +1抽")

      const prevIdx = indexOfUnpaired.get(draw)
      activeCards.splice(prevIdx, 1)
      rebuildIndex()
    }else{
      activeCards.push(draw)
      indexOfUnpaired.set(draw, activeCards.length - 1)
    }
  }

  logLine(logBox, "合计 +" + bonusDraws + "抽")
  logLine(logBox, "")
  logLine(logBox, listLine())
  logLine(logBox, "加抽开始")
  logLine(logBox, "")

  let remainingDraws = bonusDraws

  while(remainingDraws > 0){
    remainingDraws -= 1
    totalDraws += 1

    const draw = choice(FRUITS)
    logLine(logBox, "第 " + totalDraws + " 抽：抽到 " + draw)
    await delay(250)

    const wishHitNow = (draw === wishFruit && !wishTriggered)
    const pairHitNow = indexOfUnpaired.has(draw)

    activeCards.push(draw)
    if(!pairHitNow) indexOfUnpaired.set(draw, activeCards.length - 1)

    logLine(logBox, listLine() + "｜剩余抽数 " + remainingDraws)
    await delay(250)

    let anyEvent = false

    if(wishHitNow){
      wishTriggered = true
      wishBonusCount += 1
      remainingDraws += 1
      anyEvent = true
      logLine(logBox, "→ 许愿命中 " + draw + " +1抽")
      await delay(150)
    }

    if(pairHitNow){
      pairCount += 1
      remainingDraws += 1
      anyEvent = true
      logLine(logBox, "→ " + draw + " 和 " + draw + " 对对碰成功 +1抽")
      await delay(150)

      activeCards.pop()
      const prevIdx = indexOfUnpaired.get(draw)
      activeCards.splice(prevIdx, 1)
      rebuildIndex()
    }

    if(anyEvent){
      logLine(logBox, listLine() + "｜剩余抽数 " + remainingDraws)
      await delay(250)
    }
  }

  logLine(logBox, "")
  logLine(logBox, "—— 结果汇总 ——")
  logLine(logBox, "总抽数 " + totalDraws)
  logLine(logBox, "完成对对碰数量 " + pairCount)
  logLine(logBox, "许愿奖励触发次数 " + wishBonusCount)

  return totalDraws
}

async function start(){
  const log1 = el("log1")
  const log2 = el("log2")
  log1.textContent = ""
  log2.textContent = ""

  const initialDraws = Number(el("initialDraws").value || 0)
  const wishFruit = el("wishFruit").value

  const picked = Array.from(document.querySelectorAll("#comboBox input[type=checkbox]"))
    .filter(x=>x.checked)
    .map(x=>x.value)

  if(picked.length === 0){
    logLine(log1, "至少选择一个耳钉组合")
    return
  }

  const comboList = picked.map(v=>{
    const [t, s] = v.split("||")
    return [t, s]
  })

  const totalDraws = await runMatchGame(initialDraws, wishFruit, log1)
  await delay(200)
  await drawEarstuds(totalDraws, comboList, log2)
}

initUI()
el("startBtn").addEventListener("click", start)