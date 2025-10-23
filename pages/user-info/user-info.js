// pages/user-info/user-info.js
const storage = require('../../utils/storage.js');
const { dataSyncManager } = require('../../utils/data-sync.js');
const { authManager } = require('../../utils/auth.js');
const { ExcelExporter } = require('../../utils/excel-export.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    isLoggedIn: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = storage.getItem('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isLoggedIn: true
      });
    } else {
      this.setData({
        userInfo: {},
        isLoggedIn: false
      });
    }
  },

  /**
   * 选择头像
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    const userInfo = { ...this.data.userInfo, avatarUrl };
    this.setData({
      userInfo: userInfo
    });
    
    wx.showToast({
      title: '头像已更新',
      icon: 'success'
    });
  },

  /**
   * 昵称输入变化
   */
  onNicknameChange(e) {
    const nickName = e.detail.value;
    
    const userInfo = { ...this.data.userInfo, nickName };
    this.setData({
      userInfo: userInfo
    });
  },

  /**
   * 保存用户信息
   */
  saveUserInfo() {
    const { userInfo } = this.data;
    
    if (!userInfo.nickName || !userInfo.avatarUrl) {
      wx.showToast({
        title: '请完善头像和昵称',
        icon: 'none'
      });
      return;
    }
    
    // 添加创建时间
    const completeUserInfo = {
      ...userInfo,
      createTime: new Date().toLocaleDateString('zh-CN')
    };
    
    // 保存用户信息到本地存储
    storage.setItem('userInfo', completeUserInfo);
    
    this.setData({
      userInfo: completeUserInfo,
      isLoggedIn: true
    });
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  /**
   * 编辑用户信息
   */
  editUserInfo() {
    this.setData({
      isLoggedIn: false
    });
    
    wx.showToast({
      title: '可以重新编辑信息',
      icon: 'none'
    });
  },

  /**
   * 查看数据统计
   */
  viewStatistics() {
    wx.navigateTo({
      url: '/pages/statistics/statistics'
    });
  },

  /**
   * 数据导出功能
   */
  exportData() {
    const storage = require('../../utils/storage');
    const util = require('../../utils/util');
    
    // 获取当前班级数据
    const currentClassId = storage.getCurrentClassId();
    if (!currentClassId) {
      wx.showToast({
        title: '请先选择班级',
        icon: 'none'
      });
      return;
    }
    
    const classes = storage.getClasses();
    const currentClass = classes.find(c => c.id === currentClassId);
    const assignments = storage.getAssignmentsByClassId(currentClassId);
    const students = storage.getStudentsByClassId(currentClassId);
    const scores = storage.getScores();
    
    // 显示导出选项
    wx.showActionSheet({
      itemList: ['导出班级成绩单', '导出作业统计', '导出学生名单'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.exportClassScores(currentClass, assignments, students, scores);
            break;
          case 1:
            this.exportAssignmentStats(currentClass, assignments, students, scores);
            break;
          case 2:
            this.exportStudentList(currentClass, students);
            break;
        }
      }
    });
  },

  /**
   * 导出班级成绩单
   */
  exportClassScores(currentClass, assignments, students, scores) {
    try {
      const excelExporter = new ExcelExporter();
      const data = [];
      
      // 添加班级信息
      data.push(['班级名称', currentClass.name]);
      data.push(['学生人数', students.length]);
      data.push(['作业数量', assignments.length]);
      data.push(['导出时间', new Date().toLocaleString()]);
      data.push([]); // 空行
      
      // 添加表头
      const headers = ['学号', '姓名'];
      assignments.forEach(assignment => {
        headers.push(assignment.name);
      });
      headers.push('平均分');
      data.push(headers);
      
      // 添加学生成绩数据
      students.forEach(student => {
        const row = [student.studentNumber, student.name];
        let totalScore = 0;
        let completedCount = 0;
        
        assignments.forEach(assignment => {
          const score = scores.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
          if (score) {
            row.push(score.totalScore || 0);
            totalScore += score.totalScore || 0;
            completedCount++;
          } else {
            row.push('未完成');
          }
        });
        
        const avgScore = completedCount > 0 ? Math.round((totalScore / completedCount) * 100) / 100 : 0;
        row.push(avgScore);
        data.push(row);
      });

      // 处理成绩数据，添加questions字段
      const processedScores = scores.map(score => {
        const assignment = assignments.find(a => a.id === score.assignmentId);
        if (!assignment) return score;
        
        // 复制成绩对象
        const processedScore = { ...score };
        
        // 根据数据类型处理questions字段
        if (score.hierarchicalScores && Array.isArray(score.hierarchicalScores) && score.hierarchicalScores.length > 0) {
          // 使用hierarchicalScores数据
          processedScore.questions = this.convertHierarchicalScores(score.hierarchicalScores);
        } else if (assignment.questionStructure && Array.isArray(assignment.questionStructure)) {
          // 使用作业结构和旧的分数数据
          processedScore.questions = this.convertQuestionStructure(assignment.questionStructure, score);
        } else {
          // 兼容旧版本数据结构
          processedScore.questions = this.generateCompatibleQuestions(assignment, score);
        }
        
        return processedScore;
      });
      
      // 生成错题汇总数据
      const wrongQuestionsData = excelExporter.generateWrongQuestionsData(processedScores, assignments, students);
      
      // 准备多工作表数据
      const sheetsData = {
        '班级成绩单': data,
        '错题汇总': wrongQuestionsData
      };
      
      // 生成文件名
      const fileName = `${currentClass.name}_成绩单_${new Date().toISOString().slice(0, 10)}.csv`;
      
      // 保存包含多个工作表的Excel文件
      excelExporter.saveMultiSheetExcelFile(sheetsData, fileName);
      
    } catch (error) {
      console.error('导出班级成绩单失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'error'
      });
    }
  },

  /**
   * 导出作业统计
   */
  exportAssignmentStats(currentClass, assignments, students, scores) {
    try {
      const excelExporter = new ExcelExporter();
      const data = [];
      
      // 添加班级信息
      data.push(['班级名称', currentClass.name]);
      data.push(['统计时间', new Date().toLocaleString()]);
      data.push([]); // 空行
      
      // 添加表头
      data.push(['作业名称', '作业类型', '总分', '已批改人数', '平均分', '最高分', '最低分']);
      
      // 添加作业统计数据
      assignments.forEach(assignment => {
        const assignmentScores = scores.filter(s => s.assignmentId === assignment.id);
        const gradedCount = assignmentScores.length;
        
        let avgScore = 0, maxScore = 0, minScore = 0;
        if (gradedCount > 0) {
          const totalScore = assignmentScores.reduce((sum, s) => sum + (s.totalScore || 0), 0);
          avgScore = Math.round((totalScore / gradedCount) * 100) / 100;
          maxScore = Math.max(...assignmentScores.map(s => s.totalScore || 0));
          minScore = Math.min(...assignmentScores.map(s => s.totalScore || 0));
        }
        
        data.push([
          assignment.name,
          assignment.type,
          assignment.totalScore || '未设置',
          `${gradedCount}/${students.length}`,
          avgScore,
          maxScore,
          minScore
        ]);
      });
      
      // 处理成绩数据，添加questions字段
      const processedScores = scores.map(score => {
        const assignment = assignments.find(a => a.id === score.assignmentId);
        if (!assignment) return score;
        
        // 复制成绩对象
        const processedScore = { ...score };
        
        // 根据数据类型处理questions字段
        if (score.hierarchicalScores && Array.isArray(score.hierarchicalScores) && score.hierarchicalScores.length > 0) {
          // 使用hierarchicalScores数据
          processedScore.questions = this.convertHierarchicalScores(score.hierarchicalScores);
        } else if (assignment.questionStructure && Array.isArray(assignment.questionStructure)) {
          // 使用作业结构和旧的分数数据
          processedScore.questions = this.convertQuestionStructure(assignment.questionStructure, score);
        } else {
          // 兼容旧版本数据结构
          processedScore.questions = this.generateCompatibleQuestions(assignment, score);
        }
        
        return processedScore;
      });
      
      // 生成错题汇总数据
      const wrongQuestionsData = excelExporter.generateWrongQuestionsData(processedScores, assignments, students);
      
      // 准备多工作表数据
      const sheetsData = {
        '作业统计': data,
        '错题汇总': wrongQuestionsData
      };
      
      // 生成文件名
      const fileName = `${currentClass.name}_作业统计_${new Date().toISOString().slice(0, 10)}.csv`;
      
      // 保存包含多个工作表的Excel文件
      excelExporter.saveMultiSheetExcelFile(sheetsData, fileName);
      
    } catch (error) {
      console.error('导出作业统计失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'error'
      });
    }
  },

  /**
   * 导出学生名单
   */
  exportStudentList(currentClass, students) {
    try {
      const excelExporter = new ExcelExporter();
      const data = [];
      
      // 添加班级信息
      data.push(['班级名称', currentClass.name]);
      data.push(['学生人数', students.length]);
      data.push(['导出时间', new Date().toLocaleString()]);
      data.push([]); // 空行
      
      // 添加表头
      data.push(['序号', '学号', '姓名']);
      
      // 添加学生数据
      students.forEach((student, index) => {
        data.push([index + 1, student.studentNumber, student.name]);
      });
      
      // 生成文件名
      const fileName = `${currentClass.name}_学生名单_${new Date().toISOString().slice(0, 10)}.csv`;
      
      // 保存Excel文件
      excelExporter.saveExcelFile(data, fileName, '学生名单');
      
    } catch (error) {
      console.error('导出学生名单失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'error'
      });
    }
  },



  /**
   * 使用帮助功能
   */
  showHelp() {
    wx.showActionSheet({
      itemList: [
        '📚 基础功能指南',
        '🆕 Markdown导入功能',
        '🤖 AI提示词模板',
        '📊 数据管理',
        '❓ 常见问题'
      ],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.showBasicHelp();
            break;
          case 1:
            this.showMarkdownHelp();
            break;
          case 2:
            this.showAIPromptHelp();
            break;
          case 3:
            this.showDataHelp();
            break;
          case 4:
            this.showFAQ();
            break;
        }
      }
    });
  },

  showBasicHelp() {
    wx.showModal({
      title: '基础功能指南',
      content: `班级管理：
在"班级"页面创建和管理班级，切换当前工作班级

作业管理：
在"作业"页面创建作业模板，支持多层级题目结构，设置分值和评分方式

学生管理：
在"学生"页面添加学生信息，支持批量导入学生名单

成绩录入：
选择作业后进行成绩录入，支持分题评分和评语，自动统计错题和分析

注意：
当前版本只可以在本地使用，暂不支持真实登录和数据同步`,

      showCancel: false,
      confirmText: '我知道了'
    });
  },

  showMarkdownHelp() {
    wx.showModal({
      title: 'Markdown导入功能',
      content: `新功能介绍：
支持从Markdown文件快速创建作业模板

使用方法：
1. 将试卷图片发送给元宝、deepseek等AI,输入提示词，生成markdown文件或将生成的内容保存为markdown文件；
2.在作业页面点击"从Markdown导入"；
3. 选择符合格式的Markdown文件

支持格式：
## 一、选择题 (30分)
### 1. 函数定义域 (10分)
**知识点：函数**

功能特点：
• 自动识别题目层级和分数
• 自动提取知识点标记
• 导入前可预览题目结构
• 自动计算总分统计`,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  showAIPromptHelp() {
    wx.showActionSheet({
      itemList: [
        '📝 基础版本提示词',
        '🎯 专业版本提示词',
        '📖 使用说明'
      ],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.showBasicPrompt();
            break;
          case 1:
            this.showProfessionalPrompt();
            break;
          case 2:
            this.showPromptUsage();
            break;
        }
      }
    });
  },

  showBasicPrompt() {
    const basicPrompt = `请分析这张试卷照片，按照以下格式生成Markdown文件：
1. 大题用 # 标题，小题用 ## 标题，细分题用 ### 标题
2. 分数用括号标注，如 (10分)
3. 知识点用 **知识点：xxx** 格式标记
4. 严格按照格式输出，不要添加其他内容`;

    wx.showModal({
      title: '基础版本提示词',
      content: basicPrompt,
      showCancel: true,
      cancelText: '返回',
      confirmText: '复制',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: basicPrompt,
            success: () => {
              wx.showToast({
                title: '提示词已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  showProfessionalPrompt() {
    const professionalPrompt = `请分析这张数学试卷照片，生成符合教学系统导入的Markdown格式：

分析要求：
1. 识别试卷的完整题目结构（大题-小题-细分题）
2. 准确提取每道题的分值
3. 根据题目内容准确标记数学知识点
4. 按照标准Markdown层级格式输出

格式规范：
- 一级标题(#)：大题，如 # 一、选择题 (30分)
- 二级标题(##)：小题，如 ## 1. 函数题 (5分)  
- 三级标题(###)：细分题，如 ### (1) 子问题 (2分)
- 知识点标记：**知识点：函数的单调性、导数应用**
- 分数格式：(数字分)，确保各级分数相加等于总分

数学知识点参考：
- 函数：定义域、值域、单调性、奇偶性
- 导数：基本公式、几何意义、应用
- 积分：不定积分、定积分、应用
- 几何：立体几何、解析几何、平面几何
- 代数：方程、不等式、数列、概率统计

请输出完整的Markdown格式文件，不要包含任何解释文字。`;

    wx.showModal({
      title: '专业版本提示词',
      content: professionalPrompt,
      showCancel: true,
      cancelText: '返回',
      confirmText: '复制',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: professionalPrompt,
            success: () => {
              wx.showToast({
                title: '提示词已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  showPromptUsage() {
    wx.showModal({
      title: 'AI提示词使用说明',
      content: `使用步骤：
1. 拍摄或准备试卷照片
2. 选择合适的提示词版本：
   • 基础版本：适用于简单试卷
   • 专业版本：适用于复杂数学试卷
3. 复制提示词到AI工具（如元宝、DeepSeek等）
4. 上传试卷照片并发送提示词
5. 将AI生成的Markdown内容保存为.md文件
6. 在作业页面使用"从Markdown导入"功能

注意事项：
• 确保试卷照片清晰可读
• 检查AI生成的格式是否正确
• 导入前可预览题目结构`,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  showDataHelp() {
    wx.showModal({
      title: '数据管理',
      content: `数据统计：
查看班级整体表现，分析学生个人进步，导出各类统计报告

数据导出：
支持导出班级成绩单、作业统计、学生名单等

数据同步：
登录后可在不同设备间同步数据

数据备份：
建议定期导出重要数据进行备份`,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  showFAQ() {
    wx.showModal({
      title: '常见问题',
      content: `数据存储：
数据存储在本地，请定期备份重要信息

Markdown格式：
格式要求严格，请参考示例文件
需要提示词可联系技术支持

技术支持：
如遇问题请联系
微信：cxyf1688
QQ：2322512912

使用建议：
建议定期清理无用数据，保持应用流畅运行`,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 清除数据
   */
  clearData() {
    const that = this;
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地数据吗？此操作不可恢复。',
      success(res) {
        if (res.confirm) {
          // 清除所有本地存储数据
          wx.clearStorageSync();
          
          that.setData({
            userInfo: {},
            isLoggedIn: false
          });
          
          wx.showToast({
            title: '数据已清除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 退出登录
   */
  logout() {
    const that = this;
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success(res) {
        if (res.confirm) {
          // 清除用户信息
          storage.removeItem('userInfo');
          
          that.setData({
            userInfo: {},
            isLoggedIn: false
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 数据同步功能
   */
  syncData() {
    const that = this;
    
    // 检查用户是否已登录
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 显示同步选项
    wx.showActionSheet({
      itemList: ['立即同步', '查看同步状态', '同步设置'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            that.performSync();
            break;
          case 1:
            that.showSyncStatus();
            break;
          case 2:
            that.showSyncSettings();
            break;
        }
      }
    });
  },

  /**
   * 执行数据同步
   */
  async performSync() {
    try {
      // 检查用户是否已登录
      if (!authManager.isLoggedIn()) {
        const loginResult = await authManager.showLoginDialog();
        if (!loginResult.success) {
          return;
        }
      }

      // 初始化同步管理器（自动使用当前登录用户）
      dataSyncManager.init();

      // 检查网络状态
      const isNetworkAvailable = await dataSyncManager.checkNetworkStatus();
      if (!isNetworkAvailable) {
        wx.showToast({
          title: '网络不可用',
          icon: 'none'
        });
        return;
      }

      // 验证认证令牌
      const isTokenValid = await authManager.validateToken();
      if (!isTokenValid) {
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none'
        });
        authManager.logout();
        this.loadUserInfo();
        return;
      }

      // 执行同步
      const results = await dataSyncManager.syncAllData();
      
      // 显示同步结果详情
      const successCount = results.success.length;
      const failedCount = results.failed.length;
      
      let message = `同步完成\n成功: ${successCount}项`;
      if (failedCount > 0) {
        message += `\n失败: ${failedCount}项`;
      }
      
      wx.showModal({
        title: '同步结果',
        content: message,
        showCancel: false
      });
      
    } catch (error) {
      console.error('数据同步失败:', error);
      wx.showModal({
        title: '同步失败',
        content: error.message || '网络连接异常，请稍后重试',
        showCancel: false
      });
    }
  },

  /**
   * 显示同步状态
   */
  showSyncStatus() {
    if (!authManager.isLoggedIn()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const lastSyncTime = authManager.getUserData('lastSyncTime');
    
    let statusMessage = '同步状态信息：\n\n';
    
    if (lastSyncTime) {
      const lastSyncDate = new Date(lastSyncTime);
      statusMessage += `上次同步时间：\n${lastSyncDate.toLocaleString()}\n\n`;
      
      const timeDiff = Date.now() - lastSyncTime;
      const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
      
      if (hoursDiff < 1) {
        statusMessage += '状态：数据已是最新';
      } else if (hoursDiff < 24) {
        statusMessage += `状态：${hoursDiff}小时前同步`;
      } else {
        const daysDiff = Math.floor(hoursDiff / 24);
        statusMessage += `状态：${daysDiff}天前同步`;
      }
    } else {
      statusMessage += '状态：尚未同步\n建议立即进行数据同步';
    }
    
    // 添加数据统计信息
    const assignments = storage.getAssignments();
    const students = storage.getStudents();
    const scores = storage.getScores();
    const classes = storage.getClasses();
    
    statusMessage += `\n\n本地数据统计：\n`;
    statusMessage += `班级：${classes.length}个\n`;
    statusMessage += `学生：${students.length}人\n`;
    statusMessage += `作业：${assignments.length}项\n`;
    statusMessage += `成绩记录：${scores.length}条`;
    
    wx.showModal({
      title: '同步状态',
      content: statusMessage,
      showCancel: false
    });
  },

  /**
   * 显示同步设置
   */
  showSyncSettings() {
    if (!authManager.isLoggedIn()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const autoSyncEnabled = authManager.getUserData('autoSyncEnabled', true);
    
    wx.showActionSheet({
      itemList: [
        autoSyncEnabled ? '关闭自动同步' : '开启自动同步',
        '清除同步记录',
        '同步帮助'
      ],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.toggleAutoSync();
            break;
          case 1:
            this.clearSyncRecords();
            break;
          case 2:
            this.showSyncHelp();
            break;
        }
      }
    });
  },

  /**
   * 切换自动同步设置
   */
  toggleAutoSync() {
    const currentSetting = authManager.getUserData('autoSyncEnabled', true);
    const newSetting = !currentSetting;
    
    authManager.setUserData('autoSyncEnabled', newSetting);
    
    wx.showToast({
      title: newSetting ? '已开启自动同步' : '已关闭自动同步',
      icon: 'success'
    });
  },

  /**
   * 清除同步记录
   */
  clearSyncRecords() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有同步记录吗？这不会影响本地数据。',
      success: (res) => {
        if (res.confirm) {
          authManager.removeUserData('lastSyncTime');
          
          wx.showToast({
            title: '同步记录已清除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 显示同步帮助
   */
  showSyncHelp() {
    const helpContent = `数据同步功能说明：

1. 立即同步：手动执行数据同步，将本地数据与云端数据进行双向同步。

2. 自动同步：开启后，应用会在启动时自动检查并同步数据（每小时最多一次）。

3. 同步范围：
   • 班级信息
   • 学生名单
   • 作业记录
   • 成绩数据
   • 用户设置

4. 冲突处理：当本地和云端数据存在差异时，系统会智能合并，优先保留最新的数据。

5. 网络要求：同步功能需要网络连接，建议在WiFi环境下使用。

注意：首次使用需要配置云端服务器地址。`;

    wx.showModal({
      title: '同步帮助',
      content: helpContent,
      showCancel: false
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 数据转换方法（从student-scores.js复制）
  convertHierarchicalScores: function(hierarchicalScores) {
    return hierarchicalScores.map(question => {
      const convertedQuestion = {
        id: question.id || question.title,
        title: question.title,
        maxScore: question.maxScore || 0,
        calculatedScore: question.score || 0,
        score: question.score || 0,
        expanded: false,
        subQuestions: []
      };

      // 处理子题
      if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
        convertedQuestion.subQuestions = question.subQuestions.map(subQuestion => {
          const convertedSubQuestion = {
            id: subQuestion.id || subQuestion.title,
            title: subQuestion.title,
            maxScore: subQuestion.maxScore || 0,
            calculatedScore: subQuestion.score || 0,
            score: subQuestion.score || 0,
            expanded: false,
            subQuestions: []
          };

          // 处理三级子题
          if (subQuestion.subQuestions && Array.isArray(subQuestion.subQuestions) && subQuestion.subQuestions.length > 0) {
            convertedSubQuestion.subQuestions = subQuestion.subQuestions.map(subSubQuestion => ({
              id: subSubQuestion.id || subSubQuestion.title,
              title: subSubQuestion.title,
              maxScore: subSubQuestion.maxScore || 0,
              calculatedScore: subSubQuestion.score || 0,
              score: subSubQuestion.score || 0,
              expanded: false,
              subQuestions: []
            }));
          }

          return convertedSubQuestion;
        });
      }

      return convertedQuestion;
    });
  },

  // 转换题目结构并计算分数
  convertQuestionStructure: function(questionStructure, scoreRecord) {
    const questions = [];
    let globalSubScoreIndex = 0;
    
    // 获取成绩数据
    const subScores = scoreRecord ? (scoreRecord.subScores || []) : [];
    const questionScores = scoreRecord ? (scoreRecord.questionScores || []) : [];

    questionStructure.forEach((question, questionIndex) => {
      const convertedQuestion = {
        id: question.id || question.title,
        title: question.title,
        maxScore: question.maxScore || 0,
        calculatedScore: 0,
        score: 0,
        expanded: false,
        subQuestions: []
      };

      // 处理子题
      if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
        question.subQuestions.forEach((subQuestion, subIndex) => {
          const convertedSubQuestion = {
            id: subQuestion.id || subQuestion.title,
            title: subQuestion.title,
            maxScore: subQuestion.maxScore || 0,
            calculatedScore: 0,
            score: 0,
            expanded: false,
            subQuestions: []
          };

          // 处理三级子题
          if (subQuestion.subQuestions && Array.isArray(subQuestion.subQuestions) && subQuestion.subQuestions.length > 0) {
            subQuestion.subQuestions.forEach((subSubQuestion, subSubIndex) => {
              const subSubQuestionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
              
              convertedSubQuestion.subQuestions.push({
                id: subSubQuestion.id || subSubQuestion.title,
                title: subSubQuestion.title,
                maxScore: subSubQuestion.maxScore || 0,
                calculatedScore: subSubQuestionScore,
                score: subSubQuestionScore,
                expanded: false,
                subQuestions: []
              });
              
              convertedSubQuestion.calculatedScore += subSubQuestionScore;
              globalSubScoreIndex++;
            });
          } else {
            // 没有三级子题的情况
            const subQuestionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
            convertedSubQuestion.calculatedScore = subQuestionScore;
            globalSubScoreIndex++;
          }
          
          convertedSubQuestion.score = convertedSubQuestion.calculatedScore;
          convertedQuestion.subQuestions.push(convertedSubQuestion);
          convertedQuestion.calculatedScore += convertedSubQuestion.calculatedScore;
        });
      } else {
        // 没有子题的情况
        const questionScore = subScores[globalSubScoreIndex] !== undefined ? subScores[globalSubScoreIndex] : 0;
        convertedQuestion.calculatedScore = questionScore;
        globalSubScoreIndex++;
      }
      
      convertedQuestion.score = convertedQuestion.calculatedScore;
      questions.push(convertedQuestion);
    });

    return questions;
  },

  // 生成兼容旧版本的题目结构
  generateCompatibleQuestions: function(assignment, scoreRecord) {
    const questions = [];
    const questionCount = assignment.questionCount || 5; // 默认5题
    
    // 获取成绩数据
    const subScores = scoreRecord ? (scoreRecord.subScores || []) : [];
    const questionScores = scoreRecord ? (scoreRecord.questionScores || []) : [];

    for (let i = 0; i < questionCount; i++) {
      // 对于兼容模式，优先使用questionScores，如果没有则使用subScores
      const questionScore = questionScores[i] !== undefined ? questionScores[i] : 
                           (subScores[i] !== undefined ? subScores[i] : 0);
      
      questions.push({
        id: i + 1,
        title: `第${i + 1}题`,
        maxScore: assignment.scoringOptions?.customScores?.[i] || 10,
        calculatedScore: questionScore,
        score: questionScore,
        expanded: false,
        subQuestions: []
      });
    }

    return questions;
  }
})