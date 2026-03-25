/**
 * 数据提供者 - 统一数据加载器
 * 负责异步加载所有JSON数据文件并提供统一接口
 */
/**
 * DataProvider 类 - 用于管理和提供八卦、六十四卦及爻辞数据
 */
class DataProvider {
  /**
   * 构造函数 - 初始化数据存储变量和加载状态
   */
  constructor() {
    // 八卦数据
    this.eightTrigrams = null;
    // 六十四卦数据
    this.hexagrams = null;
    // 详细爻辞数据
    this.detailedLines = null;
    // 数据加载状态标志
    this.isLoaded = false;
    // 数据加载Promise对象，用于实现单例加载
    this.loadPromise = null;
  }

  /**
   * 异步加载所有数据文件
   * @returns {Promise} 返回包含所有数据的Promise对象
   */
  async loadAllData() {
    // 如果已有加载中的Promise，直接返回
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // 创建新的Promise来加载数据
    this.loadPromise = Promise.all([
      this.fetchJSON("8db.json"), // 加载八卦数据
      this.fetchJSON("64db.json"), // 加载六十四卦数据
      this.fetchJSON("384db.json"), // 加载爻辞数据
    ])
      .then(([eightTrigramsData, hexagramsData, detailedLinesData]) => {
        // 存储加载的数据
        this.eightTrigrams = eightTrigramsData.eight_trigrams;
        this.hexagrams = hexagramsData.data;
        this.detailedLines = detailedLinesData;
        this.isLoaded = true;

        // 建立索引映射以提高查询性能
        this.buildIndexes();

        return {
          eightTrigrams: this.eightTrigrams,
          hexagrams: this.hexagrams,
          detailedLines: this.detailedLines,
        };
      })
      .catch((error) => {
        console.error("数据加载失败:", error);
        throw error;
      });

    return this.loadPromise;
  }

  /**
   * 获取JSON文件数据
   * @param {string} filename - 要加载的JSON文件名
   * @returns {Promise} 返回包含JSON数据的Promise
   */
  async fetchJSON(filename) {
    try {
      const response = await fetch(filename);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`加载 ${filename} 失败:`, error);
      throw error;
    }
  }

  /**
   * 建立索引映射以提高查询性能
   */
  buildIndexes() {
    // 八卦索引 - 以二进制为键
    this.trigramIndex = {};
    this.eightTrigrams.forEach((trigram) => {
      this.trigramIndex[trigram.binary] = trigram;
    });

    // 六十四卦索引 - 以二进制为键
    this.hexagramIndex = {};
    this.hexagrams.forEach((hexagram) => {
      this.hexagramIndex[hexagram.binary] = hexagram;
    });

    // 详细爻辞索引 - 以id为键
    this.lineIndex = {};
    this.detailedLines.forEach((lineData) => {
      this.lineIndex[lineData.id] = lineData;
    });
  }

  /**
   * 根据二进制码获取八卦信息
   * @param {string} binary - 八卦的二进制码
   * @returns {Object|null} 返回八卦数据对象，如果不存在则返回null
   */
  getTrigram(binary) {
    this.ensureLoaded();
    return this.trigramIndex[binary];
  }

  /**
   * 根据二进制码获取六十四卦信息
   * @param {string} binary - 六十四卦的二进制码
   * @returns {Object|null} 返回六十四卦数据对象，如果不存在则返回null
   */
  getHexagram(binary) {
    this.ensureLoaded();
    return this.hexagramIndex[binary];
  }

  /**
   * 根据ID获取详细爻辞
   * @param {string} id - 爻辞的ID
   * @returns {Object|null} 返回爻辞数据对象，如果不存在则返回null
   */
  getDetailedLines(id) {
    this.ensureLoaded();
    return this.lineIndex[id];
  }

  /**
   * 根据上下卦二进制码组合获取六十四卦
   * @param {string} upperBinary - 上卦的二进制码
   * @param {string} lowerBinary - 下卦的二进制码
   * @returns {Object|null} 返回组合后的六十四卦数据对象，如果不存在则返回null
   */
  getHexagramByComposition(upperBinary, lowerBinary) {
    this.ensureLoaded();
    const combinedBinary = upperBinary + lowerBinary;
    return this.hexagramIndex[combinedBinary];
  }

  /**
   * 获取八卦的UI样式
   * @param {string} binary - 八卦的二进制码
   * @returns {Object|null} 返回UI样式对象，如果不存在则返回null
   */
  getTrigramStyle(binary) {
    const trigram = this.getTrigram(binary);
    return trigram ? trigram.ui_style : null;
  }

  /**
   * 获取六十四卦的主题色
   * @param {string} binary - 六十四卦的二进制码
   * @returns {string|null} 返回主题色值，如果不存在则返回null
   */
  getHexagramTheme(binary) {
    const hexagram = this.getHexagram(binary);
    return hexagram ? hexagram.mix_hex : null;
  }

  /**
   * 确保数据已加载
   * @throws {Error} 如果数据尚未加载完成，抛出错误
   */
  ensureLoaded() {
    if (!this.isLoaded) {
      throw new Error("数据尚未加载完成，请先调用 loadAllData()");
    }
  }

  /**
   * 获取加载状态
   * @returns {boolean} 返回数据是否已加载完成
   */
  isDataLoaded() {
    return this.isLoaded;
  }

  /**
   * 获取八卦基础数据（用于转盘）
   * @returns {Array} 返回包含八卦名称和二进制码的数组，顺序已反转
   */
  getBaseTrigrams() {
    this.ensureLoaded();
    return this.eightTrigrams
      .map((trigram) => ({
        n: trigram.name, // 名称
        b: trigram.binary,
      }))
      .reverse(); // 反转以匹配转盘顺序
  }
}

// 创建全局数据提供者实例
window.dataProvider = new DataProvider();
