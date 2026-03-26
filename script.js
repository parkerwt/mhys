/**
 * 周易·数字通行本 2.0 专业版
 * 核心逻辑重构 - 引入《梅花易数》起卦原理
 */

// 全局状态
let isDataLoaded = false;
let currentTheme = null;

// 八卦基础数据 - 将从数据提供者动态获取
let BASES = [];

// ==========================================
// 易理算法引擎 (数字梅花易数)
// ==========================================

/**
 * 字符串转数字（模拟“测字起卦”取数）
 * 易理：万物皆数。将用户输入转化为确定性的数值，作为起卦的“先天机缘”。
 */
function getWordNumber(str) {
  let num = 0;
  for (let i = 0; i < str.length; i++) {
    num += str.charCodeAt(i);
  }
  return num;
}

/**
 * 获取当前的地支时辰数 (1-12)
 * 易理：子时为1，丑时为2...亥时为12。用于计算动爻，引入天时变量。
 */
function getChineseHourNumber() {
  const hour = new Date().getHours();
  if (hour === 23 || hour === 0) return 1; // 子时
  return Math.ceil(hour / 2) + 1;
}

/**
 * 伏羲先天八卦数映射表
 * 易理：乾一，兑二，离三，震四，巽五，坎六，艮七，坤八
 * 数组索引 1-8 对应相应的二进制码
 */
const FUXI_BINARIES = [
  "", // 占位
  "111", // 1: 乾
  "110", // 2: 兑
  "101", // 3: 离
  "100", // 4: 震
  "011", // 5: 巽
  "010", // 6: 坎
  "001", // 7: 艮
  "000", // 8: 坤
];

let guaState = {
  lowerNumber: 0, // 下卦数
  upperNumber: 0, // 上卦数
  movingLine: 0, // 动爻数 (1-6)
};

// ==========================================
// 初始化与转盘控制
// ==========================================

function initializeBaseData() {
  if (window.dataProvider && window.dataProvider.isDataLoaded()) {
    BASES = window.dataProvider.getBaseTrigrams();

    // 数据加载完成后重新绘制转盘
    const diskOuter = document.getElementById("diskOuter");
    const diskInner = document.getElementById("diskInner");
    if (diskOuter && diskInner) {
      resizeCanvasForMobile();
      initDisk(diskOuter);
      initDisk(diskInner);
    }
  }
}

const quotes = [
  "「天行健，君子以自强不息。」",
  "「地势坤，君子以厚德载物。」",
  "「穷则变，变则通，通则久。」",
  "「君子居则观其象而玩其辞。」",
  "「无平不陂，无往不复。」",
  "「谦谦君子，卑以自牧也。」",
];

let step = 1,
  innerGua = null,
  outerGua = null,
  rotInner = 22.5, // 初始偏移22.5度，使分割线对准指针
  rotOuter = 22.5; // 初始偏移22.5度，使分割线对准指针
let lastWish = "",
  movingLineIndex = -1,
  currentGuaData = null,
  zhiGuaData = null,
  currentBinary = ""; // 当前卦象的二进制码

function initDisk(canvas) {
  const ctx = canvas.getContext("2d");
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 5;
  const sectorAngle = Math.PI / 4; // 45度

  canvas.ctx = ctx;
  canvas.centerX = centerX;
  canvas.centerY = centerY;
  canvas.radius = radius;
  canvas.sectorAngle = sectorAngle;

  drawDisk(canvas);
}

function drawDisk(canvas, selectedIndex = -1) {
  const ctx = canvas.ctx;
  const centerX = canvas.centerX;
  const centerY = canvas.centerY;
  const radius = canvas.radius;
  const sectorAngle = canvas.sectorAngle;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  BASES.forEach((g, i) => {
    // 调整角度：sector中心对准上方指针(-90度方向)
    const startAngle = -Math.PI / 2 - sectorAngle / 2 + i * sectorAngle;
    const endAngle = startAngle + sectorAngle;
    const isSelected = i === selectedIndex;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    if (
      isSelected &&
      window.dataProvider &&
      window.dataProvider.isDataLoaded()
    ) {
      const trigram = window.dataProvider.getTrigram(g.b);
      ctx.fillStyle = trigram ? trigram.ui_style.hex + "40" : "transparent";
    } else {
      ctx.fillStyle = "transparent";
    }
    ctx.fill();

    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.stroke();

    const textAngle = startAngle + sectorAngle / 2;
    const textRadius = canvas.id === "diskOuter" ? radius * 0.8 : radius * 0.65;
    const textX = centerX + Math.cos(textAngle) * textRadius;
    const textY = centerY + Math.sin(textAngle) * textRadius;

    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate(textAngle + Math.PI / 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.font =
      canvas.id === "diskOuter" ? "bold 24px serif" : "bold 18px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.n, 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "var(--ink)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function highlightSector(canvas, index) {
  drawDisk(canvas, index);
}

function resizeCanvasForMobile() {
  const diskOuter = document.getElementById("diskOuter");
  const diskInner = document.getElementById("diskInner");
  const wrapper = document.getElementById("diskWrapper");

  if (window.innerWidth <= 768) {
    if (window.innerWidth <= 320) {
      diskOuter.width = 220;
      diskOuter.height = 220;
      diskInner.width = 132;
      diskInner.height = 132;
      wrapper.style.width = "220px";
      wrapper.style.height = "220px";
    } else if (window.innerWidth <= 360) {
      diskOuter.width = 240;
      diskOuter.height = 240;
      diskInner.width = 144;
      diskInner.height = 144;
      wrapper.style.width = "240px";
      wrapper.style.height = "240px";
    } else if (window.innerWidth <= 480) {
      diskOuter.width = 260;
      diskOuter.height = 260;
      diskInner.width = 156;
      diskInner.height = 156;
      wrapper.style.width = "260px";
      wrapper.style.height = "260px";
    } else {
      diskOuter.width = 280;
      diskOuter.height = 280;
      diskInner.width = 168;
      diskInner.height = 168;
      wrapper.style.width = "280px";
      wrapper.style.height = "280px";
    }
  } else {
    diskOuter.width = 350;
    diskOuter.height = 350;
    diskInner.width = 210;
    diskInner.height = 210;
    wrapper.style.width = "350px";
    wrapper.style.height = "350px";
  }
  initDisk(diskOuter);
  initDisk(diskInner);
}

window.addEventListener("resize", () => {
  resizeCanvasForMobile();
  updateArrowDirection();
  updateWelcomeSubtitle();
});

function updateArrowDirection() {
  const arrows = document.querySelectorAll(".gua-arrow");
  const isMobile = window.innerWidth <= 768;
  const arrowSymbol = isMobile ? "⬇" : "➔";
  const rotation = isMobile ? "rotate(0deg)" : "rotate(90deg)";

  arrows.forEach((arrow) => {
    arrow.textContent = arrowSymbol;
    arrow.style.transform = rotation;
  });
}

function updateWelcomeSubtitle() {
  const subtitle = document.getElementById("welcomeSubtitle");
  if (subtitle) {
    const isMobile = window.innerWidth <= 768;
    subtitle.textContent = isMobile
      ? "请于上方输入所求之事，拨动转盘以窥天机"
      : "请于左侧输入所求之事，拨动转盘以窥天机";
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 2500);
}

updateArrowDirection();
updateWelcomeSubtitle();

document.getElementById("diskOuter").style.transform = `rotate(${rotOuter}deg)`;
document.getElementById("diskInner").style.transform = `rotate(${rotInner}deg)`;

window.onload = () => {
  const qEl = document.getElementById("quoteText");
  const today = new Date();
  const dateSeed = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
  // 用简单的字符串哈希决定今日格言
  let hash = 5381;
  for (let i = 0; i < dateSeed.length; i++) {
    hash = (hash << 5) + hash + dateSeed.charCodeAt(i);
  }
  const quoteIndex = Math.abs(hash) % quotes.length;
  qEl.innerText = quotes[quoteIndex];

  const wishInput = document.getElementById("wish");
  const errorDiv = document.getElementById("inputError");
  let isComposing = false;

  function handleCompositionStart() {
    isComposing = true;
    wishInput.classList.remove("error", "success");
    errorDiv.classList.remove("show");
  }

  function handleCompositionEnd() {
    isComposing = false;
    validateInput();
  }

  function validateInput() {
    const value = wishInput.value.trim();
    wishInput.classList.remove("error", "success");
    errorDiv.classList.remove("show");

    if (value.length === 0) return;
    if (value.length < 1) {
      showError("请输入至少1个字符");
      return;
    }
    if (value.length > 50) {
      showError("输入不能超过50个字符");
      return;
    }

    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/;
    if (!validPattern.test(value)) {
      showError("只能输入中文、英文、数字和空格");
      return;
    }

    const cleanValue = value
      .replace(/<[^>]*>/g, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+=/gi, "");
    if (cleanValue !== value) {
      showError("输入包含不允许的字符");
      return;
    }

    wishInput.classList.add("success");
  }

  wishInput.addEventListener("compositionstart", handleCompositionStart);
  wishInput.addEventListener("compositionend", handleCompositionEnd);
  wishInput.addEventListener("input", function () {
    if (!isComposing) validateInput();
  });

  function showError(message) {
    wishInput.classList.add("error");
    errorDiv.textContent = message;
    errorDiv.classList.add("show");
  }
};

function updateGuaColors() {
  if (!window.dataProvider.isDataLoaded()) return;

  const guaTitles = document.querySelectorAll(".sub-label");
  const arrows = document.querySelectorAll(".gua-arrow");

  const outerTrigram = window.dataProvider.getTrigram(outerGua.b);
  const benGuaColor = outerTrigram ? outerTrigram.ui_style.hex : "#FFD700";
  const benGuaColorDeep = benGuaColor + "CC";
  guaTitles[0].style.color = benGuaColorDeep;

  const code = outerGua.b + innerGua.b;
  const interCode = code[4] + code[3] + code[2] + (code[3] + code[2] + code[1]);
  const interTrigramBinary = interCode.substring(0, 3);
  const interTrigram = window.dataProvider.getTrigram(interTrigramBinary);
  const huGuaColor = interTrigram ? interTrigram.ui_style.hex : "#FFD700";
  const huGuaColorDeep = huGuaColor + "CC";
  guaTitles[1].style.color = huGuaColorDeep;

  let zhiGuaColorDeep = benGuaColorDeep;
  if (zhiGuaData && zhiGuaData.name !== "未知") {
    const zhiCode = code.split("");
    const targetIdx = 5 - movingLineIndex;
    zhiCode[targetIdx] = zhiCode[targetIdx] === "1" ? "0" : "1";
    const zhiUpperBinary = zhiCode.join("").substring(0, 3);
    const zhiUpperTrigram = window.dataProvider.getTrigram(zhiUpperBinary);
    const zhiGuaColor = zhiUpperTrigram
      ? zhiUpperTrigram.ui_style.hex
      : "#FFD700";
    zhiGuaColorDeep = zhiGuaColor + "CC";
  }
  guaTitles[2].style.color = zhiGuaColorDeep;

  arrows.forEach((arrow, index) => {
    const isMobile = window.innerWidth <= 768;
    const arrowSymbol = isMobile ? "⬇" : "➔";
    const rotation = isMobile ? "rotate(0deg)" : "rotate(90deg)";

    arrow.textContent = arrowSymbol;
    arrow.style.transform = rotation;

    if (index === 0) {
      arrow.style.background = `linear-gradient(90deg, ${benGuaColor} 0%, ${huGuaColor} 100%)`;
      arrow.style.webkitBackgroundClip = "text";
      arrow.style.webkitTextFillColor = "transparent";
      arrow.style.backgroundClip = "text";
      arrow.style.color = "transparent";
    } else if (index === 1) {
      const endColor =
        zhiGuaData && zhiGuaData.name !== "未知"
          ? zhiGuaColorDeep
          : benGuaColorDeep;
      arrow.style.background = `linear-gradient(90deg, ${huGuaColor} 0%, ${endColor} 100%)`;
      arrow.style.webkitBackgroundClip = "text";
      arrow.style.webkitTextFillColor = "transparent";
      arrow.style.backgroundClip = "text";
      arrow.style.color = "transparent";
    }
  });

  const style = document.createElement("style");
  style.textContent = `
    .gua-box .sub-label { position: relative; padding-bottom: 8px; }
    .gua-box .sub-label::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 60%; height: 2px; background: currentColor; opacity: 0.6; }
    .gua-box:nth-child(1) .sub-label::after { background: ${benGuaColorDeep}; }
    .gua-box:nth-child(3) .sub-label::after { background: ${huGuaColorDeep}; }
    .gua-box:nth-child(5) .sub-label::after { background: ${zhiGuaColorDeep}; }
  `;

  const oldStyle = document.getElementById("gua-title-underline-style");
  if (oldStyle) oldStyle.remove();

  style.id = "gua-title-underline-style";
  document.head.appendChild(style);
}

function resetToInitial() {
  drawDisk(document.getElementById("diskInner"), -1);
  drawDisk(document.getElementById("diskOuter"), -1);
  innerGua = null;
  outerGua = null;
  guaState = { lowerNumber: 0, upperNumber: 0, movingLine: 0 };
  document.getElementById("hint").innerText =
    "凝神静虑，输入所求，启卦获取内卦（下卦）";
}

function run() {
  const inputEl = document.getElementById("wish");
  const inputValue = inputEl.value.trim();

  if (!inputValue && step === 1) {
    alert("请先输入心中所求之事");
    return;
  }

  if (step === 1) {
    if (inputValue.length < 1) {
      alert("请输入至少1个字符");
      return;
    }
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/;
    if (!validPattern.test(inputValue)) {
      alert("只能输入中文、英文、数字和空格");
      return;
    }
    const cleanValue = inputValue
      .replace(/<[^>]*>/g, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+=/gi, "");
    if (cleanValue !== inputValue) {
      alert("输入包含不允许的字符");
      return;
    }
  }

  const btn = document.getElementById("spinBtn");
  const wrapper = document.getElementById("diskWrapper");
  btn.disabled = true;
  wrapper.classList.add("active");

  if (step === 1 && (innerGua !== null || outerGua !== null)) {
    resetToInitial();
    setTimeout(() => {
      startDivination();
    }, 300);
    return;
  }

  startDivination();
}

function startDivination() {
  const inputEl = document.getElementById("wish");
  const btn = document.getElementById("spinBtn");
  const wrapper = document.getElementById("diskWrapper");

  if (step === 1) {
    lastWish = inputEl.value.trim();

    // 【梅花易数 - 物数取下卦】
    const wordNum = getWordNumber(lastWish);
    // 先天八卦数：1-8。如果余数为0，则取8（坤）
    guaState.lowerNumber = wordNum % 8 === 0 ? 8 : wordNum % 8;

    // 找到盘面上对应的八卦索引
    const targetBinary = FUXI_BINARIES[guaState.lowerNumber];
    const targetIndex = BASES.findIndex((g) => g.b === targetBinary);

    // 换算需要旋转的角度，使得选中的扇区恰好停在正上方
    const targetAngle = 360 - targetIndex * 45;
    const addDeg = 2160 + targetAngle - (rotInner % 360); // 基础6圈

    rotInner += addDeg;
    const disk = document.getElementById("diskInner");
    disk.style.transform = `rotate(${rotInner}deg)`;
    disk.addEventListener(
      "transitionend",
      () => {
        innerGua = BASES[targetIndex];
        highlightSector(document.getElementById("diskInner"), targetIndex);

        const innerTrigram = window.dataProvider.getTrigram(innerGua.b);
        const innerGuaColor = innerTrigram
          ? innerTrigram.ui_style.hex
          : "#FFD700";

        document.getElementById("hint").innerHTML =
          `内卦已得【<span style="color: ${innerGuaColor}; font-weight: bold;">${innerGua.n}</span>】，再启外卦完成六爻`;
        step = 2;
        btn.disabled = false;
        wrapper.classList.remove("active");
      },
      { once: true },
    );
  } else {
    // 【梅花易数 - 随机数与时辰取上卦与动爻】
    // 取毫秒数的尾数作为天机变量，增加每次占卜的灵动性
    const timeNum = Date.now() % 999;
    guaState.upperNumber = timeNum % 8 === 0 ? 8 : timeNum % 8;

    // 获取传统地支时辰数 (1-12)
    const hourNum = getChineseHourNumber();

    // 动爻算法：(下卦数 + 上卦数 + 时辰数) / 6 的余数
    const totalSum = guaState.lowerNumber + guaState.upperNumber + hourNum;
    guaState.movingLine = totalSum % 6 === 0 ? 6 : totalSum % 6;

    // 寻找外盘目标索引
    const targetBinary = FUXI_BINARIES[guaState.upperNumber];
    const targetIndex = BASES.findIndex((g) => g.b === targetBinary);

    const targetAngle = 360 - targetIndex * 45;
    const addDeg = 2160 + targetAngle - (rotOuter % 360);

    rotOuter += addDeg;
    const disk = document.getElementById("diskOuter");
    disk.style.transform = `rotate(${rotOuter}deg)`;
    disk.addEventListener(
      "transitionend",
      () => {
        outerGua = BASES[targetIndex];
        drawDisk(document.getElementById("diskOuter"), targetIndex);

        const innerTrigram = window.dataProvider.getTrigram(innerGua.b);
        const outerTrigram = window.dataProvider.getTrigram(outerGua.b);

        document.getElementById("hint").innerHTML =
          `卦象已成：下<span style="color: ${innerTrigram.ui_style.hex}; font-weight: bold;">${innerGua.n}</span>上<span style="color: ${outerTrigram.ui_style.hex}; font-weight: bold;">${outerGua.n}</span>，详见${window.innerWidth <= 768 ? "下方" : "右侧"}解读`;

        // 动爻索引 (数组的索引为 0~5，分别对应 初爻~上爻)
        movingLineIndex = guaState.movingLine - 1;

        render();
        step = 1;
        btn.disabled = false;
        wrapper.classList.remove("active");
      },
      { once: true },
    );
  }
}

function render() {
  if (!window.dataProvider.isDataLoaded()) {
    console.error("数据尚未加载完成");
    return;
  }

  // 1. 组合本卦二进制码
  const code = outerGua.b + innerGua.b;
  currentBinary = code;
  currentGuaData = window.dataProvider.getHexagram(code) || {
    name: "未知",
    pinyin: "wēizhī",
    symbol: "？",
    judgment: "需进一步研判。",
    mix_hex: "#999999",
  };

  // 2. 截取生成互卦（二三四爻为下卦，三四五爻为上卦）
  const interCode = code[4] + code[3] + code[2] + (code[3] + code[2] + code[1]);
  const interGuaData = window.dataProvider.getHexagram(interCode) || {
    name: "--",
  };

  document.getElementById("welcome").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("wishDisplay").innerText = lastWish || "未填写";

  document.getElementById("gName").innerHTML =
    `${currentGuaData.name} <small style="color:#999; font-weight:normal;">(现状)</small>`;
  document.getElementById("gMeta").innerText =
    `${currentGuaData.pinyin} (下${innerGua.n}上${outerGua.n})`;
  document.getElementById("gJudge").innerText = currentGuaData.judgment;

  updateGuaColors();

  // 绘制本卦、互卦
  drawGua("gGraphic", code, movingLineIndex);
  drawGua("iGraphic", interCode, -1);

  // 3. 翻转动爻生成之卦 (变卦)
  let codeArr = code.split("");
  // 数组是自上而下 (0是上爻，5是初爻)，而 movingLineIndex 是自下而上 (0是初爻，5是上爻)
  let targetIdx = 5 - movingLineIndex;
  codeArr[targetIdx] = codeArr[targetIdx] === "1" ? "0" : "1";
  const zhiCode = codeArr.join("");
  zhiGuaData = window.dataProvider.getHexagram(zhiCode) || {
    name: "未知",
    judgment: "-",
  };

  document.getElementById("mText").innerText =
    `第 ${movingLineIndex + 1} 爻发动 → 变卦为「${zhiGuaData.name}」`;
  drawGua("zGraphic", zhiCode, -1);

  document.getElementById("zhiGuaDetails").innerHTML =
    `<div class="text-block"><span class="badge zhi-badge">之卦结局：${zhiGuaData.name}</span><div class="text-body">${zhiGuaData.judgment}</div></div>`;

  setTimeout(() => {
    const originalGua = document.getElementById("gGraphic");
    const changedGua = document.getElementById("zGraphic");
    originalGua.style.opacity = "1";
    changedGua.style.opacity = "1";
  }, 100);

  setTimeout(() => {
    document.getElementById("wish").value = "";
  }, 500);
}

// 渲染爻线DOM
function drawGua(id, code, movingIdx) {
  const draw = document.getElementById(id);
  draw.innerHTML = "";
  // 反转代码使之从初爻往上渲染
  const lines = code.split("").reverse();
  lines.forEach((bit, i) => {
    const line = document.createElement("div");
    line.className = bit === "1" ? "line yang" : "line yin";
    if (i === movingIdx) line.classList.add("moving-line");
    draw.appendChild(line);
  });
}

/**
 * 复制卦辞到剪贴板的函数
 * 将当前的易学成果作为高级 Prompt 发送给大模型进行解读
 */
function copyToClipboard() {
  if (!currentGuaData || !window.dataProvider) {
    showToast("❌ 请先完成起卦");
    return;
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

  const upperBinary = currentBinary.substring(0, 3);
  const trigramInfo = window.dataProvider.getTrigram(upperBinary);

  let movingLineDetail = {
    POSITION: `动在${movingLineIndex + 1}爻`,
    TEXT: "无变爻",
  };

  const detailedData = window.dataProvider.getDetailedLines(currentGuaData.id);
  if (detailedData && detailedData.lines) {
    const line = detailedData.lines.find((l) => l.pos === movingLineIndex + 1);
    if (line) {
      movingLineDetail.POSITION = `动在${line.title}爻`;
      movingLineDetail.TEXT = line.text;
    }
  }

  let aiText = `# 易经占卜完整信息\n\n`;
  aiText += `## 基本信息\n`;
  aiText += `- **占卜时间**: ${timestamp}\n`;
  aiText += `- **起卦方式**: 数字梅花易数算法 (先天数起卦法)\n`;
  aiText += `- **所求之事**: ${lastWish || "未输入"}\n`;
  aiText += `- **用户画像**: 请结合此人的心意和当前时机进行个性化分析\n\n`;

  aiText += `## 完整卦象信息\n`;
  aiText += `### 本卦（现状）\n`;
  aiText += `- **卦名**: ${currentGuaData.name} (${currentGuaData.pinyin})\n`;
  aiText += `- **卦辞**: ${currentGuaData.judgment}\n`;
  if (trigramInfo) {
    aiText += `- **外卦属性**: ${trigramInfo.name}（${trigramInfo.element}性，${trigramInfo.nature}）\n`;
  }

  aiText += `\n### 动爻（变化）\n`;
  aiText += `- **动爻位置**: ${movingLineDetail.POSITION}\n`;
  aiText += `- **爻辞**: ${movingLineDetail.TEXT}\n`;
  aiText += `- **变化性质**: 第${movingLineIndex + 1}爻发动，预示重要转机，代表事物发展的拐点\n`;

  if (zhiGuaData) {
    aiText += `\n### 之卦（未来）\n`;
    aiText += `- **卦名**: ${zhiGuaData.name}\n`;
    aiText += `- **卦辞**: ${zhiGuaData.judgment}\n`;
    aiText += `- **发展趋势**: 变卦后事物发展的最终定局和终极走向\n`;
  }

  aiText += `\n## AI解卦风格要求\n`;
  aiText += `### 角色定位\n`;
  aiText += `ROLE: 资深周易占卜师 (深谙《梅花易数》理气象数之法)\n\n`;

  aiText += `### 解卦格式（严格遵循）\n`;
  aiText += `**【核心卦意】** 卦名：针对"${lastWish || "未输入"}"事项，用大白话解析当前状态的本质。\n\n`;
  aiText += `**【变爻推演】** 爻位动：深度解析爻辞。分析转折点的关键因素，以及时机把握。\n\n`;
  aiText += `**【最终走向】** 结果卦：解析之卦的寓意，客观描述客观走向和结局。\n\n`;
  aiText += `**【决策建议】** 针对性指导：给出符合当代人生活逻辑的切实建议，明确"能做"与"不能做"。\n\n`;
  aiText += `**【总结】** 总结解卦意思不超过50字。\n\n`;

  const protocolText = aiText;

  navigator.clipboard
    .writeText(protocolText)
    .then(() => {
      const copyBtn = document.getElementById("copyBtn");
      if (copyBtn) {
        copyBtn.classList.add("copied");
        copyBtn.innerText = "✅ 信息已复制";
        showToast("📋 完整的AI解卦信息已存入剪贴板");
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerText = "✅ 一键复制卦辞";
        }, 2000);
      }
    })
    .catch((error) => {
      console.error("复制失败:", error);
      const copyBtn = document.getElementById("copyBtn");
      if (copyBtn) {
        copyBtn.innerText = "❌ 复制失败";
        copyBtn.style.background =
          "linear-gradient(135deg, #dc3545 0%, #c82333 100%)";
        showToast("❌ 复制失败，请重试");
        setTimeout(() => {
          copyBtn.innerText = "✅ 一键复制卦辞";
          copyBtn.style.background = "";
        }, 2000);
      }
    });
}

// 找到脚本中的 .then(() => { ... }) 块
window.dataProvider.loadAllData().then(() => {
  // 1. 原有的初始化逻辑
  initializeBaseData();
  isDataLoaded = true;

  const spinBtn = document.getElementById("spinBtn");
  spinBtn.innerText = "启卦（下卦）";
  spinBtn.disabled = false;

  // 2. 添加移除遮罩逻辑
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    // 动画结束后从 DOM 中彻底移除，优化性能
    setTimeout(() => {
      overlay.style.display = "none";
    }, 800);
  }
});
