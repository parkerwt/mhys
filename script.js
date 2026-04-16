/**
 * 业务逻辑层与视图控制层 (Controller & View)
 */

// --- 易理引擎 (纯逻辑，无副作用) ---
class DivinationEngine {
  static FUXI_BINARIES = [
    "",
    "111",
    "110",
    "101",
    "100",
    "011",
    "010",
    "001",
    "000",
  ];

  static getWordNumber(str) {
    return Array.from(str).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  static getChineseHourNumber() {
    const hour = new Date().getHours();
    return hour === 23 || hour === 0 ? 1 : Math.ceil(hour / 2) + 1;
  }

  // 校验输入
  static validateWish(text) {
    const value = text.trim();
    if (!value) return { valid: false, msg: "请输入至少1个字符" };
    if (value.length > 50) return { valid: false, msg: "输入不能超过50个字符" };
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/.test(value))
      return { valid: false, msg: "只能输入中英文、数字和空格" };
    return { valid: true, cleanValue: value.replace(/<[^>]*>/g, "") };
  }
}

// --- 转盘渲染器 (Canvas 封装) ---
class DiskRenderer {
  constructor(canvasId, isOuter) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.isOuter = isOuter;
    this.rotation = 22.5; // 初始偏移
    this.bases = [];
    this.selectedIndex = -1;
  }

  setBases(bases) {
    this.bases = bases;
  }

  resize(containerSize) {
    const dpr = window.devicePixelRatio || 1;
    // 外盘占满，内盘占 60%
    const size = this.isOuter ? containerSize : containerSize * 0.6;

    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;

    this.ctx.scale(dpr, dpr);
    this.renderProps = {
      centerX: size / 2,
      centerY: size / 2,
      radius: size / 2 - 2, // 留出边框余量
      sectorAngle: Math.PI / 4,
    };

    this.draw();
  }

  setRotation(deg) {
    this.rotation = deg;
    this.canvas.style.transform = `translate(-50%, -50%) rotate(${this.rotation}deg)`;
  }

  rotateTo(targetIndex, onComplete) {
    const targetAngle = 360 - targetIndex * 45;
    const addDeg = 2160 + targetAngle - (this.rotation % 360); // 转6圈并对准
    this.setRotation(this.rotation + addDeg);

    this.canvas.addEventListener(
      "transitionend",
      () => {
        this.selectedIndex = targetIndex;
        this.draw();
        if (onComplete) onComplete();
      },
      { once: true },
    );
  }

  draw() {
    if (!this.renderProps || this.bases.length === 0) return;
    const { centerX, centerY, radius, sectorAngle } = this.renderProps;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 内盘绘制水平渐变色背景
    if (!this.isOuter) {
      const gradient = ctx.createLinearGradient(
        centerX - radius,
        centerY,
        centerX + radius,
        centerY,
      );
      // 水平渐变：左淡鎏金 → 中宣纸 → 右淡朱砂
      gradient.addColorStop(0, "#e8dcc8"); // 淡鎏金
      gradient.addColorStop(0.5, "#fdfaf5"); // 宣纸色
      gradient.addColorStop(1, "#e8d0c8"); // 淡朱砂

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    this.bases.forEach((g, i) => {
      const startAngle = -Math.PI / 2 - sectorAngle / 2 + i * sectorAngle;
      const endAngle = startAngle + sectorAngle;
      const isSelected = i === this.selectedIndex;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      if (isSelected && window.dataProvider.isLoaded) {
        const trigram = window.dataProvider.getTrigram(g.b);
        ctx.fillStyle = trigram ? `${trigram.ui_style.hex}40` : "transparent";
      } else {
        ctx.fillStyle = "transparent";
      }
      ctx.fill();

      ctx.strokeStyle = "rgba(26,26,26,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 文字渲染
      const textAngle = startAngle + sectorAngle / 2;
      const textRadius = this.isOuter ? radius * 0.75 : radius * 0.65;
      ctx.save();
      ctx.translate(
        centerX + Math.cos(textAngle) * textRadius,
        centerY + Math.sin(textAngle) * textRadius,
      );
      ctx.rotate(textAngle + Math.PI / 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `bold ${this.isOuter ? Math.max(16, radius * 0.12) : Math.max(12, radius * 0.15)}px "Noto Serif SC", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(g.n, 0, 0);
      ctx.restore();
    });

    // 外圈线
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(26,26,26,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// --- 应用总控制器 ---
class IChingApp {
  constructor() {
    this.state = {
      step: 1, // 1: 待起内卦, 2: 待起外卦, 3: 卦成
      wish: "",
      lowerNum: 0,
      upperNum: 0,
      movingLine: 0,
      innerGua: null,
      outerGua: null,
    };

    this.ui = {
      wishInput: document.getElementById("wish"),
      errorHint: document.getElementById("inputError"),
      spinBtn: document.getElementById("spinBtn"),
      wrapper: document.getElementById("diskWrapper"),
      hintText: document.getElementById("hint"),
      copyBtn: document.getElementById("copyBtn"),
    };

    this.diskOuter = new DiskRenderer("diskOuter", true);
    this.diskInner = new DiskRenderer("diskInner", false);

    this.init();
  }

  async init() {
    this.renderLoadingBagua(); // 绘制 CSS 八卦 Loading
    this.bindEvents();

    try {
      await window.dataProvider.loadAllData();
      const bases = window.dataProvider.getBaseTrigrams();
      this.diskOuter.setBases(bases);
      this.diskInner.setBases(bases);

      this.initResponsiveCanvas();
      this.hideLoader();
      this.setRandomQuote();

      this.ui.spinBtn.disabled = false;
      this.ui.spinBtn.innerText = "启 卦";
    } catch (err) {
      this.ui.spinBtn.innerText = "加载失败";
      alert("核心易理数据加载失败，请刷新重试。");
    }
  }

  // 利用 ResizeObserver 监听容器尺寸，实现无级缩放
  initResponsiveCanvas() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const size = entry.contentRect.width;
        this.diskOuter.resize(size);
        this.diskInner.resize(size);
      }
    });
    resizeObserver.observe(this.ui.wrapper);
  }

  bindEvents() {
    this.ui.spinBtn.addEventListener("click", () => this.handleSpin());
    this.ui.copyBtn.addEventListener("click", () => this.copyResult());

    // 输入框交互与验证
    let isComposing = false;
    this.ui.wishInput.addEventListener("compositionstart", () => {
      isComposing = true;
      this.clearError();
    });
    this.ui.wishInput.addEventListener("compositionend", (e) => {
      isComposing = false;
      this.checkInput(e.target.value);
    });
    this.ui.wishInput.addEventListener("input", (e) => {
      if (!isComposing) this.checkInput(e.target.value);
    });

    // 监听屏幕旋转等更新箭头符号
    window.addEventListener("resize", this.updateArrowDirection.bind(this));
    this.updateArrowDirection();
  }

  clearError() {
    this.ui.wishInput.classList.remove("error", "success");
    this.ui.errorHint.classList.remove("show");
  }

  checkInput(val) {
    this.clearError();
    if (!val.trim()) return;
    const res = DivinationEngine.validateWish(val);
    if (!res.valid) {
      this.ui.wishInput.classList.add("error");
      this.ui.errorHint.textContent = res.msg;
      this.ui.errorHint.classList.add("show");
    } else {
      this.ui.wishInput.classList.add("success");
    }
  }

  handleSpin() {
    const wishVal = this.ui.wishInput.value;
    if (this.state.step === 1) {
      const res = DivinationEngine.validateWish(wishVal);
      if (!res.valid) {
        alert(res.msg || "请输入有效内容");
        return;
      }
      this.state.wish = res.cleanValue;

      // 若已起过卦，重置状态
      if (this.state.innerGua) this.resetDisks();
    }

    this.ui.spinBtn.disabled = true;
    this.ui.wrapper.classList.add("active");

    if (this.state.step === 1) this.processLowerGua();
    else this.processUpperGua();
  }

  processLowerGua() {
    const wordNum = DivinationEngine.getWordNumber(this.state.wish);
    this.state.lowerNum = wordNum % 8 === 0 ? 8 : wordNum % 8;

    const binary = DivinationEngine.FUXI_BINARIES[this.state.lowerNum];
    const idx = this.diskInner.bases.findIndex((g) => g.b === binary);

    this.diskInner.rotateTo(idx, () => {
      this.state.innerGua = this.diskInner.bases[idx];
      const color = window.dataProvider.getTrigram(binary).ui_style.hex;
      this.ui.hintText.innerHTML = `内卦已得【<span style="color:${color};font-weight:bold">${this.state.innerGua.n}</span>】，再启外卦完成六爻`;
      this.state.step = 2;
      this.ui.spinBtn.disabled = false;
      this.ui.wrapper.classList.remove("active");
    });
  }

  processUpperGua() {
    const timeNum = Date.now() % 999;
    this.state.upperNum = timeNum % 8 === 0 ? 8 : timeNum % 8;

    const hourNum = DivinationEngine.getChineseHourNumber();
    const sum = this.state.lowerNum + this.state.upperNum + hourNum;
    this.state.movingLine = sum % 6 === 0 ? 6 : sum % 6;

    const binary = DivinationEngine.FUXI_BINARIES[this.state.upperNum];
    const idx = this.diskOuter.bases.findIndex((g) => g.b === binary);

    this.diskOuter.rotateTo(idx, () => {
      this.state.outerGua = this.diskOuter.bases[idx];
      this.state.step = 3;
      this.renderResult();
      this.ui.spinBtn.disabled = false;
      this.ui.wrapper.classList.remove("active");

      // 准备下一轮
      this.state.step = 1;
      this.ui.hintText.innerHTML = `已成卦，详见解读。可再次输入起新卦。`;
    });
  }

  resetDisks() {
    this.diskInner.selectedIndex = -1;
    this.diskOuter.selectedIndex = -1;
    this.diskInner.draw();
    this.diskOuter.draw();
    this.state.innerGua = null;
    this.state.outerGua = null;
  }

  renderResult() {
    const dp = window.dataProvider;
    const code = this.state.outerGua.b + this.state.innerGua.b;
    const movingIdx = this.state.movingLine - 1; // 0-5 (自下而上)

    // 1. 本卦
    const benGua = dp.getHexagram(code) || { name: "未知", judgment: "-" };

    // 2. 互卦 (取本卦二三四爻为下，三四五爻为上)
    const interCode =
      code[4] + code[3] + code[2] + (code[3] + code[2] + code[1]);

    // 3. 之卦 (翻转变爻)
    let codeArr = code.split("");
    const targetIdx = 5 - movingIdx; // 字符串是自上而下 (0为上爻)
    codeArr[targetIdx] = codeArr[targetIdx] === "1" ? "0" : "1";
    const zhiCode = codeArr.join("");
    const zhiGua = dp.getHexagram(zhiCode) || { name: "未知", judgment: "-" };

    // 保存供复制使用
    this.currentResult = { benGua, zhiGua, code, movingIdx };

    // UI 更新
    document.getElementById("welcome").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");
    document.getElementById("wishDisplay").innerText = this.state.wish;
    document.getElementById("gName").innerHTML =
      `${benGua.name} <small>(现状)</small>`;
    document.getElementById("gMeta").innerText =
      `${benGua.pinyin || ""} (下${this.state.innerGua.n}上${this.state.outerGua.n})`;
    document.getElementById("gJudge").innerText = benGua.judgment;
    document.getElementById("mText").innerText =
      `第 ${movingIdx + 1} 爻发动 → 变卦为「${zhiGua.name}」`;
    document.getElementById("zhiGuaDetails").innerHTML = `
      <div class="text-block">
        <span class="badge zhi-badge">之卦结局：${zhiGua.name}</span>
        <div class="text-body">${zhiGua.judgment}</div>
      </div>
    `;

    // 绘制爻象 DOM
    this.drawHexagramDOM("gGraphic", code, movingIdx);
    this.drawHexagramDOM("iGraphic", interCode, -1);
    this.drawHexagramDOM("zGraphic", zhiCode, -1);

    // 动态配色与下划线
    this.updateThemingColors(code, interCode, zhiCode);

    // 移动端自动滚屏
    if (window.innerWidth <= 768) {
      setTimeout(
        () =>
          document
            .getElementById("display")
            .scrollIntoView({ behavior: "smooth", block: "start" }),
        300,
      );
    }

    setTimeout(() => {
      this.ui.wishInput.value = "";
    }, 500);
  }

  drawHexagramDOM(containerId, code, movingIdx) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    // 从初爻(下)往上画，反转字符串
    code
      .split("")
      .reverse()
      .forEach((bit, i) => {
        const line = document.createElement("div");
        line.className = `line ${bit === "1" ? "yang" : "yin"} ${i === movingIdx ? "moving-line" : ""}`;
        container.appendChild(line);
      });
  }

  updateThemingColors(code, interCode, zhiCode) {
    const dp = window.dataProvider;
    const c1 =
      (dp.getTrigram(code.substring(0, 3))?.ui_style.hex || "#FFD700") + "CC";
    const c2 =
      (dp.getTrigram(interCode.substring(0, 3))?.ui_style.hex || "#FFD700") +
      "CC";
    const c3 =
      (dp.getTrigram(zhiCode.substring(0, 3))?.ui_style.hex || "#FFD700") +
      "CC";

    const labels = document.querySelectorAll(".sub-label");
    if (labels.length === 3) {
      labels[0].style.color = c1;
      labels[1].style.color = c2;
      labels[2].style.color = c3;
    }

    const arrows = document.querySelectorAll(".icon-arrow");
    if (arrows.length === 2) {
      arrows[0].style.background = `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`;
      arrows[1].style.background = `linear-gradient(90deg, ${c2} 0%, ${c3} 100%)`;
      arrows.forEach((a) => {
        a.style.webkitBackgroundClip = "text";
        a.style.color = "transparent";
      });
    }

    // 更新动态注入的样式
    let styleEl = document.getElementById("dynamic-gua-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-gua-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .gua-box:nth-child(1) .sub-label::after { background: ${c1}; }
      .gua-box:nth-child(3) .sub-label::after { background: ${c2}; }
      .gua-box:nth-child(5) .sub-label::after { background: ${c3}; }
    `;
  }

  updateArrowDirection() {
    const isMobile = window.innerWidth <= 768;
    document.querySelectorAll(".icon-arrow").forEach((el) => {
      el.textContent = isMobile ? "⬇" : "➔";
      el.style.transform = "rotate(0deg)";
    });
    const sub = document.getElementById("welcomeSubtitle");
    if (sub)
      sub.textContent = isMobile
        ? "请于上方输入所求之事，拨动转盘以窥天机"
        : "请于左侧输入所求之事，拨动转盘以窥天机";
  }

  copyResult() {
    if (!this.currentResult) return this.showToast("❌ 请先完成起卦");
    const { benGua, zhiGua, code, movingIdx } = this.currentResult;

    let lineInfo = { pos: `动在第${movingIdx + 1}爻`, text: "无" };
    const detail = window.dataProvider.getDetailedLines(benGua.id);
    if (detail && detail.lines) {
      const l = detail.lines.find((x) => x.pos === movingIdx + 1);
      if (l) {
        lineInfo.pos = `动在${l.title}爻`;
        lineInfo.text = l.text;
      }
    }

    const text = `# 易经占卜完整信息
- **所求之事**: ${this.state.wish || "未输入"}
- **本卦(现状)**: ${benGua.name} - ${benGua.judgment}
- **动爻(变数)**: ${lineInfo.pos} - ${lineInfo.text}
- **之卦(走向)**: ${zhiGua.name} - ${zhiGua.judgment}

ROLE: 资深周易占卜师 (深谙《梅花易数》理气象数之法)
请严格按此格式解卦：【核心卦意】、【变爻推演】、【最终走向】、【决策建议(明确能做/不能做)】、【50字总结】。`;

    navigator.clipboard.writeText(text).then(() => {
      this.ui.copyBtn.classList.add("copied");
      this.ui.copyBtn.innerText = "✅ 信息已复制";
      this.showToast("📋 已存入剪贴板，可粘贴给AI求解");
      setTimeout(() => {
        this.ui.copyBtn.classList.remove("copied");
        this.ui.copyBtn.innerText = "✅ 一键复制卦辞";
      }, 2000);
    });
  }

  showToast(msg) {
    const t = document.createElement("div");
    t.className = "copy-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  hideLoader() {
    const overlay = document.getElementById("loadingOverlay");
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 1000); // Wait for CSS transition
  }

  setRandomQuote() {
    const quotes = [
      "「天行健，君子以自强不息。」",
      "「地势坤，君子以厚德载物。」",
      "「穷则变，变则通，通则久。」",
      "「君子居则观其象而玩其辞。」",
      "「无平不陂，无往不复。」",
    ];
    document.getElementById("quoteText").innerText =
      quotes[Math.floor(Math.random() * quotes.length)];
  }

  // 利用 DOM 动态生成精简版 Loader
  renderLoadingBagua() {
    const loader = document.getElementById("loaderBagua");
    if (!loader) return;
    const lines = [
      [1, 1, 1],
      [0, 1, 1],
      [1, 0, 1],
      [0, 0, 1],
      [1, 1, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 0],
    ];
    lines.forEach((trigramArr, i) => {
      const wrap = document.createElement("div");
      wrap.className = `bagua-trigram pos-${i}`;
      trigramArr.forEach((bit) => {
        const line = document.createElement("div");
        line.className = `bagua-line ${bit === 0 ? "broken" : ""}`;
        wrap.appendChild(line);
      });
      loader.appendChild(wrap);
    });
  }
}

// 启动应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new IChingApp();
});
