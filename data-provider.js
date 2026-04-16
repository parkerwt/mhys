/**
 * DataProvider - 数据层 (Model)
 * 职责：异步拉取JSON，构建内存索引，提供查询接口
 */
class DataProvider {
  constructor() {
    this.eightTrigrams = null;
    this.hexagrams = null;
    this.detailedLines = null;
    this.isLoaded = false;
    this.loadPromise = null;
    this.indexes = {};
  }

  async loadAllData() {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = Promise.all([
      this.fetchJSON("8db.json"),
      this.fetchJSON("64db.json"),
      this.fetchJSON("384db.json"),
    ])
      .then(([eight, hexagrams, lines]) => {
        this.eightTrigrams = eight.eight_trigrams;
        this.hexagrams = hexagrams.data;
        this.detailedLines = lines;
        this.buildIndexes();
        this.isLoaded = true;
        return true;
      })
      .catch((error) => {
        console.error("[DataProvider] 加载失败:", error);
        throw error;
      });

    return this.loadPromise;
  }

  async fetchJSON(filename) {
    const response = await fetch(filename);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }

  buildIndexes() {
    this.indexes.trigramByBinary = new Map(
      this.eightTrigrams.map((t) => [t.binary, t]),
    );
    this.indexes.hexagramByBinary = new Map(
      this.hexagrams.map((h) => [h.binary, h]),
    );
    this.indexes.linesById = new Map(this.detailedLines.map((l) => [l.id, l]));
  }

  _checkLoaded() {
    if (!this.isLoaded) throw new Error("Data not fully loaded.");
  }

  getTrigram(binary) {
    this._checkLoaded();
    return this.indexes.trigramByBinary.get(binary) || null;
  }

  getHexagram(binary) {
    this._checkLoaded();
    return this.indexes.hexagramByBinary.get(binary) || null;
  }

  getDetailedLines(id) {
    this._checkLoaded();
    return this.indexes.linesById.get(id) || null;
  }

  getBaseTrigrams() {
    this._checkLoaded();
    // 反转以匹配界面转盘顺时针渲染逻辑
    return [...this.eightTrigrams]
      .reverse()
      .map((t) => ({ n: t.name, b: t.binary }));
  }
}

// 挂载单例
window.dataProvider = new DataProvider();
