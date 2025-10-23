/**
 * 用户身份验证模块
 * 提供用户登录、注册、数据隔离等功能
 */

// 认证配置
const AUTH_CONFIG = {
  baseUrl: 'https://your-auth-api.com/api', // 替换为实际的认证API地址
  tokenKey: 'authToken',
  userKey: 'currentUser',
  timeout: 10000
};

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.authToken = null;
    this.init();
  }

  /**
   * 初始化认证管理器
   */
  init() {
    this.authToken = wx.getStorageSync(AUTH_CONFIG.tokenKey);
    this.currentUser = wx.getStorageSync(AUTH_CONFIG.userKey);
  }

  /**
   * 用户注册
   * @param {Object} userInfo 用户信息
   * @returns {Promise} 注册结果
   */
  async register(userInfo) {
    try {
      const registerData = {
        username: userInfo.username,
        password: userInfo.password,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        deviceType: 'miniprogram',
        timestamp: Date.now()
      };

      const response = await this.makeRequest('POST', '/auth/register', registerData);
      
      if (response.success) {
        // 保存用户信息和令牌
        this.authToken = response.token;
        this.currentUser = response.user;
        
        wx.setStorageSync(AUTH_CONFIG.tokenKey, this.authToken);
        wx.setStorageSync(AUTH_CONFIG.userKey, this.currentUser);
        
        return { success: true, user: this.currentUser };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 用户登录
   * @param {string} username 用户名
   * @param {string} password 密码
   * @returns {Promise} 登录结果
   */
  async login(username, password) {
    try {
      const loginData = {
        username,
        password,
        deviceType: 'miniprogram',
        timestamp: Date.now()
      };

      const response = await this.makeRequest('POST', '/auth/login', loginData);
      
      if (response.success) {
        // 保存用户信息和令牌
        this.authToken = response.token;
        this.currentUser = response.user;
        
        wx.setStorageSync(AUTH_CONFIG.tokenKey, this.authToken);
        wx.setStorageSync(AUTH_CONFIG.userKey, this.currentUser);
        
        return { success: true, user: this.currentUser };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  /**
   * 微信授权登录
   * @returns {Promise} 登录结果
   */
  async wxLogin() {
    try {
      // 获取微信登录凭证
      const loginRes = await this.getWxLoginCode();
      
      // 获取用户信息
      const userProfile = await this.getWxUserProfile();
      
      const wxLoginData = {
        code: loginRes.code,
        userInfo: userProfile.userInfo,
        deviceType: 'miniprogram',
        timestamp: Date.now()
      };

      const response = await this.makeRequest('POST', '/auth/wx-login', wxLoginData);
      
      if (response.success) {
        // 保存用户信息和令牌
        this.authToken = response.token;
        this.currentUser = response.user;
        
        wx.setStorageSync(AUTH_CONFIG.tokenKey, this.authToken);
        wx.setStorageSync(AUTH_CONFIG.userKey, this.currentUser);
        
        return { success: true, user: this.currentUser };
      } else {
        throw new Error(response.message || '微信登录失败');
      }
    } catch (error) {
      console.error('微信登录失败:', error);
      throw error;
    }
  }

  /**
   * 获取微信登录凭证
   * @returns {Promise} 登录凭证
   */
  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  }

  /**
   * 获取微信用户信息
   * @returns {Promise} 用户信息
   */
  getWxUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject
      });
    });
  }

  /**
   * 用户登出
   */
  logout() {
    this.authToken = null;
    this.currentUser = null;
    
    wx.removeStorageSync(AUTH_CONFIG.tokenKey);
    wx.removeStorageSync(AUTH_CONFIG.userKey);
    
    // 清除用户相关的本地数据
    this.clearUserData();
  }

  /**
   * 检查用户是否已登录
   * @returns {boolean} 是否已登录
   */
  isLoggedIn() {
    return !!(this.authToken && this.currentUser);
  }

  /**
   * 获取当前用户信息
   * @returns {Object|null} 用户信息
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 获取认证令牌
   * @returns {string|null} 认证令牌
   */
  getAuthToken() {
    return this.authToken;
  }

  /**
   * 验证令牌有效性
   * @returns {Promise<boolean>} 令牌是否有效
   */
  async validateToken() {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await this.makeRequest('GET', '/auth/validate');
      return response.valid === true;
    } catch (error) {
      console.error('令牌验证失败:', error);
      return false;
    }
  }

  /**
   * 刷新认证令牌
   * @returns {Promise} 刷新结果
   */
  async refreshToken() {
    try {
      const response = await this.makeRequest('POST', '/auth/refresh');
      
      if (response.success) {
        this.authToken = response.token;
        wx.setStorageSync(AUTH_CONFIG.tokenKey, this.authToken);
        return { success: true, token: this.authToken };
      } else {
        throw new Error(response.message || '令牌刷新失败');
      }
    } catch (error) {
      console.error('令牌刷新失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户专属的存储键
   * @param {string} key 原始键名
   * @returns {string} 用户专属键名
   */
  getUserStorageKey(key) {
    if (!this.currentUser) {
      return key;
    }
    return `${this.currentUser.id}_${key}`;
  }

  /**
   * 设置用户专属数据
   * @param {string} key 键名
   * @param {any} value 值
   */
  setUserData(key, value) {
    const userKey = this.getUserStorageKey(key);
    wx.setStorageSync(userKey, value);
  }

  /**
   * 获取用户专属数据
   * @param {string} key 键名
   * @param {any} defaultValue 默认值
   * @returns {any} 数据值
   */
  getUserData(key, defaultValue = null) {
    const userKey = this.getUserStorageKey(key);
    return wx.getStorageSync(userKey) || defaultValue;
  }

  /**
   * 删除用户专属数据
   * @param {string} key 键名
   */
  removeUserData(key) {
    const userKey = this.getUserStorageKey(key);
    wx.removeStorageSync(userKey);
  }

  /**
   * 清除当前用户的所有数据
   */
  clearUserData() {
    if (!this.currentUser) {
      return;
    }

    const userPrefix = `${this.currentUser.id}_`;
    
    try {
      const storageInfo = wx.getStorageInfoSync();
      const keysToRemove = storageInfo.keys.filter(key => key.startsWith(userPrefix));
      
      keysToRemove.forEach(key => {
        wx.removeStorageSync(key);
      });
    } catch (error) {
      console.error('清除用户数据失败:', error);
    }
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
        url: AUTH_CONFIG.baseUrl + url,
        method,
        timeout: AUTH_CONFIG.timeout,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // 认证失败，清除本地认证信息
            this.logout();
            reject(new Error('认证失败，请重新登录'));
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (error) => {
          reject(new Error(`网络请求失败: ${error.errMsg}`));
        }
      };

      // 添加认证头
      if (this.authToken) {
        requestData.header['Authorization'] = `Bearer ${this.authToken}`;
      }

      if (method === 'POST' || method === 'PUT') {
        requestData.data = data;
      } else if (data) {
        requestData.data = data;
      }

      wx.request(requestData);
    });
  }

  /**
   * 检查网络连接状态
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
   * 显示登录界面
   * @returns {Promise} 登录结果
   */
  async showLoginDialog() {
    return new Promise((resolve, reject) => {
      wx.showActionSheet({
        itemList: ['微信快速登录', '账号密码登录', '新用户注册'],
        success: async (res) => {
          try {
            switch(res.tapIndex) {
              case 0:
                const wxResult = await this.wxLogin();
                resolve(wxResult);
                break;
              case 1:
                // 跳转到登录页面
                wx.navigateTo({
                  url: '/pages/login/login'
                });
                resolve({ success: false, message: '跳转到登录页面' });
                break;
              case 2:
                // 跳转到注册页面
                wx.navigateTo({
                  url: '/pages/register/register'
                });
                resolve({ success: false, message: '跳转到注册页面' });
                break;
            }
          } catch (error) {
            reject(error);
          }
        },
        fail: () => {
          resolve({ success: false, message: '用户取消登录' });
        }
      });
    });
  }
}

// 导出单例实例
const authManager = new AuthManager();

module.exports = {
  AuthManager,
  authManager
};