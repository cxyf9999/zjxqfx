/**
 * 数据同步管理模块
 * 支持手机端和电脑端数据同步，集成用户身份验证
 */

const { authManager } = require('./auth.js');

// 云端API配置
const SYNC_CONFIG = {
  baseUrl: 'https://your-cloud-api.com/api', // 替换为实际的云端API地址
  timeout: 10000,
  retryTimes: 3
};

// 数据类型定义
const DATA_TYPES = {
  ASSIGNMENTS: 'assignments',
  STUDENTS: 'students', 
  SCORES: 'scores',
  CLASSES: 'classes',
  USER_INFO: 'userInfo'
};

class DataSyncManager {
  constructor() {
    this.userId = null;
    this.lastSyncTime = null;
    this.syncInProgress = false;
  }

  /**
   * 初始化同步管理器
   * @param {string} userId 用户ID（可选，如果不提供则使用当前登录用户）
   */
  init(userId = null) {
    // 如果没有提供userId，尝试从认证管理器获取当前用户
    if (!userId && authManager.isLoggedIn()) {
      const currentUser = authManager.getCurrentUser();
      this.userId = currentUser ? currentUser.id : null;
    } else {
      this.userId = userId;
    }
    
    if (this.userId) {
      this.lastSyncTime = authManager.getUserData(`lastSyncTime`, 0);
    }
  }

  /**
   * 获取本地数据
   * @param {string} dataType 数据类型
   * @returns {Object} 本地数据
   */
  getLocalData(dataType) {
    try {
      // 使用用户隔离的数据存储
      const data = authManager.getUserData(dataType, {});
      const timestamp = authManager.getUserData(`${dataType}_timestamp`, Date.now());
      return {
        data,
        timestamp,
        type: dataType
      };
    } catch (error) {
      console.error(`获取本地数据失败: ${dataType}`, error);
      return { data: {}, timestamp: Date.now(), type: dataType };
    }
  }

  /**
   * 保存本地数据
   * @param {string} dataType 数据类型
   * @param {Object} data 数据内容
   */
  saveLocalData(dataType, data) {
    try {
      // 使用用户隔离的数据存储
      authManager.setUserData(dataType, data);
      authManager.setUserData(`${dataType}_timestamp`, Date.now());
    } catch (error) {
      console.error(`保存本地数据失败: ${dataType}`, error);
      throw error;
    }
  }

  /**
   * 上传数据到云端
   * @param {string} dataType 数据类型
   * @param {Object} data 数据内容
   * @returns {Promise} 上传结果
   */
  async uploadData(dataType, data) {
    if (!authManager.isLoggedIn()) {
      throw new Error('用户未登录');
    }

    const uploadData = {
      userId: this.userId,
      dataType,
      data,
      timestamp: Date.now(),
      deviceType: 'miniprogram'
    };

    try {
      const response = await this.makeRequest('POST', '/sync/upload', uploadData);
      return response;
    } catch (error) {
      console.error(`数据上传失败: ${dataType}`, error);
      throw error;
    }
  }

  /**
   * 从云端下载数据
   * @param {string} dataType 数据类型
   * @param {number} lastSyncTime 上次同步时间
   * @returns {Promise} 下载的数据
   */
  async downloadData(dataType, lastSyncTime = 0) {
    if (!authManager.isLoggedIn()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await this.makeRequest('GET', `/sync/download`, {
        userId: this.userId,
        dataType,
        lastSyncTime
      });
      
      return response.data;
    } catch (error) {
      console.error(`数据下载失败: ${dataType}`, error);
      throw error;
    }
  }

  /**
   * 执行完整数据同步
   * @returns {Promise} 同步结果
   */
  async syncAllData() {
    if (this.syncInProgress) {
      throw new Error('同步正在进行中');
    }

    this.syncInProgress = true;
    const syncResults = {
      success: [],
      failed: [],
      conflicts: []
    };

    try {
      // 显示同步进度
      wx.showLoading({
        title: '数据同步中...',
        mask: true
      });

      // 同步各类数据
      for (const dataType of Object.values(DATA_TYPES)) {
        try {
          const result = await this.syncDataType(dataType);
          syncResults.success.push({ dataType, result });
        } catch (error) {
          syncResults.failed.push({ dataType, error: error.message });
        }
      }

      // 更新最后同步时间
      this.lastSyncTime = Date.now();
      authManager.setUserData('lastSyncTime', this.lastSyncTime);

      wx.hideLoading();
      
      // 显示同步结果
      this.showSyncResult(syncResults);
      
      return syncResults;
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '同步失败',
        icon: 'error'
      });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 同步单个数据类型
   * @param {string} dataType 数据类型
   * @returns {Promise} 同步结果
   */
  async syncDataType(dataType) {
    const localData = this.getLocalData(dataType);
    
    // 下载云端数据
    const cloudData = await this.downloadData(dataType, this.lastSyncTime);
    
    if (!cloudData || cloudData.timestamp <= localData.timestamp) {
      // 云端数据较旧或不存在，上传本地数据
      await this.uploadData(dataType, localData.data);
      return { action: 'uploaded', timestamp: localData.timestamp };
    } else if (cloudData.timestamp > localData.timestamp) {
      // 云端数据较新，下载并合并
      const mergedData = this.mergeData(localData.data, cloudData.data, dataType);
      this.saveLocalData(dataType, mergedData);
      return { action: 'downloaded', timestamp: cloudData.timestamp };
    }
    
    return { action: 'no_change', timestamp: localData.timestamp };
  }

  /**
   * 合并数据（处理冲突）
   * @param {Object} localData 本地数据
   * @param {Object} cloudData 云端数据
   * @param {string} dataType 数据类型
   * @returns {Object} 合并后的数据
   */
  mergeData(localData, cloudData, dataType) {
    // 简单的合并策略：云端数据优先，但保留本地新增的数据
    const merged = { ...cloudData };
    
    // 对于数组类型的数据，合并唯一项
    if (Array.isArray(localData) && Array.isArray(cloudData)) {
      const localIds = new Set(localData.map(item => item.id));
      const cloudIds = new Set(cloudData.map(item => item.id));
      
      // 添加本地独有的数据
      localData.forEach(item => {
        if (!cloudIds.has(item.id)) {
          merged.push(item);
        }
      });
    }
    
    return merged;
  }

  /**
   * 发起网络请求
   * @param {string} method 请求方法
   * @param {string} url 请求路径
   * @param {Object} data 请求数据
   * @returns {Promise} 请求结果
   */
  async makeRequest(method, url, data) {
    return new Promise((resolve, reject) => {
      const requestData = {
        url: SYNC_CONFIG.baseUrl + url,
        method,
        timeout: SYNC_CONFIG.timeout,
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (error) => {
          reject(new Error(`网络请求失败: ${error.errMsg}`));
        }
      };

      if (method === 'POST' || method === 'PUT') {
        requestData.data = data;
      } else {
        requestData.data = data;
      }

      wx.request(requestData);
    });
  }

  /**
   * 获取认证令牌
   * @returns {string} 认证令牌
   */
  getAuthToken() {
    return authManager.getAuthToken() || '';
  }

  /**
   * 显示同步结果
   * @param {Object} results 同步结果
   */
  showSyncResult(results) {
    const successCount = results.success.length;
    const failedCount = results.failed.length;
    
    if (failedCount === 0) {
      wx.showToast({
        title: `同步完成 (${successCount}项)`,
        icon: 'success'
      });
    } else {
      wx.showModal({
        title: '同步完成',
        content: `成功: ${successCount}项\n失败: ${failedCount}项`,
        showCancel: false
      });
    }
  }

  /**
   * 检查网络状态
   * @returns {Promise<boolean>} 网络是否可用
   */
  async checkNetworkStatus() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve(res.networkType !== 'none');
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  }

  /**
   * 自动同步（在应用启动时调用）
   */
  async autoSync() {
    const isNetworkAvailable = await this.checkNetworkStatus();
    if (!isNetworkAvailable) {
      return;
    }

    const autoSyncEnabled = authManager.getUserData('autoSyncEnabled', true);
    if (!autoSyncEnabled) {
      return;
    }

    // 检查是否需要同步（距离上次同步超过1小时）
    const now = Date.now();
    const syncInterval = 60 * 60 * 1000; // 1小时
    
    if (now - this.lastSyncTime > syncInterval) {
      try {
        await this.syncAllData();
      } catch (error) {
        console.error('自动同步失败:', error);
      }
    }
  }
}

// 导出单例实例
const dataSyncManager = new DataSyncManager();

module.exports = {
  DataSyncManager,
  dataSyncManager,
  DATA_TYPES
};