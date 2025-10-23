// assignment-edit.js
const storage = require('../../utils/storage');

Page({
  data: {
    assignment: null,
    originalAssignment: null, // 保存原始数据用于比较
    editPermission: {
      canEdit: true,
      hasPartialScores: false,
      hasCompleteScores: false
    },
    hasChanges: false,
    showConfirmDialog: false,
    confirmDialog: {
      title: '',
      message: '',
      action: null
    }
  },

  onLoad(options) {
    const assignmentId = options.id;
    if (assignmentId) {
      this.loadAssignment(assignmentId);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载作业数据
  loadAssignment(assignmentId) {
    const assignments = storage.getAssignments();
    const assignment = assignments.find(a => a.id === assignmentId);
    
    if (!assignment) {
      wx.showToast({
        title: '作业不存在',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 深拷贝作业数据
    const assignmentCopy = JSON.parse(JSON.stringify(assignment));
    
    // 确保questionStructure字段存在并初始化
    if (!assignmentCopy.questionStructure) {
      assignmentCopy.questionStructure = [];
    }
    
    // 检查编辑权限
    const editPermission = this.checkEditPermission(assignment);
    
    this.setData({
      assignment: assignmentCopy,
      originalAssignment: JSON.parse(JSON.stringify(assignment)),
      editPermission: editPermission
    });
  },

  // 检查编辑权限
  checkEditPermission(assignment) {
    const students = storage.getStudents();
    const scores = storage.getScores();
    
    let hasPartialScores = false;
    let hasCompleteScores = false;
    let totalStudents = students.filter(s => s.classId === assignment.classId).length;
    let scoredStudents = 0;

    // 检查已批改的学生数量
    students.forEach(student => {
      if (student.classId === assignment.classId) {
        const studentScores = scores.filter(s => 
          s.assignmentId === assignment.id && s.studentId === student.id
        );
        if (studentScores.length > 0) {
          scoredStudents++;
        }
      }
    });

    hasPartialScores = scoredStudents > 0 && scoredStudents < totalStudents;
    hasCompleteScores = scoredStudents === totalStudents && totalStudents > 0;

    return {
      canEdit: !hasCompleteScores, // 完全批改后不可编辑
      hasPartialScores: hasPartialScores,
      hasCompleteScores: hasCompleteScores
    };
  },

  // 检查是否有修改
  checkForChanges() {
    const hasChanges = JSON.stringify(this.data.assignment) !== JSON.stringify(this.data.originalAssignment);
    this.setData({ hasChanges });
    return hasChanges;
  },

  // 一级题目标题修改
  onLevel1TitleChange(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const assignment = this.data.assignment;
    
    assignment.questionStructure[index].title = value;
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 二级题目标题修改
  onLevel2TitleChange(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex } = e.currentTarget.dataset;
    const value = e.detail.value;
    const assignment = this.data.assignment;
    
    assignment.questionStructure[index].subQuestions[subIndex].title = value;
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 三级题目标题修改
  onLevel3TitleChange(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex, subSubIndex } = e.currentTarget.dataset;
    const value = e.detail.value;
    const assignment = this.data.assignment;
    
    assignment.questionStructure[index].subQuestions[subIndex].subQuestions[subSubIndex].title = value;
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 三级题目分数修改
  onLevel3ScoreChange(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex, subSubIndex } = e.currentTarget.dataset;
    const value = parseFloat(e.detail.value) || 0;
    const assignment = this.data.assignment;
    
    assignment.questionStructure[index].subQuestions[subIndex].subQuestions[subSubIndex].score = value;
    
    // 重新计算分数
    this.recalculateScores();
  },

  // 重新计算分数
  recalculateScores() {
    const assignment = this.data.assignment;
    let totalScore = 0;

    assignment.questionStructure.forEach(q1 => {
      let q1Score = 0;
      
      if (q1.subQuestions && q1.subQuestions.length > 0) {
        q1.subQuestions.forEach(q2 => {
          let q2Score = 0;
          
          if (q2.subQuestions && q2.subQuestions.length > 0) {
            q2.subQuestions.forEach(q3 => {
              q2Score += q3.score || 0;
            });
          } else {
            q2Score = q2.score || 0;
          }
          
          q2.totalScore = q2Score;
          q1Score += q2Score;
        });
      } else {
        q1Score = q1.score || 0;
      }
      
      q1.totalScore = q1Score;
      totalScore += q1Score;
    });

    assignment.totalScore = totalScore;
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 添加一级题目
  addLevel1Question() {
    if (!this.data.editPermission.canEdit) return;
    
    const assignment = this.data.assignment;
    const newQuestion = {
      id: Date.now().toString(),
      title: '',
      score: 0,
      totalScore: 0,
      subQuestions: []
    };
    
    assignment.questionStructure.push(newQuestion);
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 添加二级题目
  addLevel2Question(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const index = e.currentTarget.dataset.index;
    const assignment = this.data.assignment;
    
    if (!assignment.questionStructure[index].subQuestions) {
      assignment.questionStructure[index].subQuestions = [];
    }
    
    const newSubQuestion = {
      id: Date.now().toString(),
      title: '',
      score: 0,
      totalScore: 0,
      subQuestions: []
    };
    
    assignment.questionStructure[index].subQuestions.push(newSubQuestion);
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 添加三级题目
  addLevel3Question(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex } = e.currentTarget.dataset;
    const assignment = this.data.assignment;
    
    if (!assignment.questionStructure[index].subQuestions[subIndex].subQuestions) {
      assignment.questionStructure[index].subQuestions[subIndex].subQuestions = [];
    }
    
    const newSubSubQuestion = {
      id: Date.now().toString(),
      title: '',
      score: 0
    };
    
    assignment.questionStructure[index].subQuestions[subIndex].subQuestions.push(newSubSubQuestion);
    
    this.setData({ assignment });
    this.checkForChanges();
  },

  // 删除一级题目
  deleteLevel1Question(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const index = e.currentTarget.dataset.index;
    const assignment = this.data.assignment;
    const question = assignment.questionStructure[index];
    
    this.showConfirmDialog(
      '删除确认',
      `确定要删除题目"${question.title || '未命名题目'}"吗？此操作不可撤销。`,
      () => {
        assignment.questionStructure.splice(index, 1);
        this.setData({ assignment });
        this.recalculateScores();
      }
    );
  },

  // 删除二级题目
  deleteLevel2Question(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex } = e.currentTarget.dataset;
    const assignment = this.data.assignment;
    const subQuestion = assignment.questionStructure[index].subQuestions[subIndex];
    
    this.showConfirmDialog(
      '删除确认',
      `确定要删除小题"${subQuestion.title || '未命名小题'}"吗？此操作不可撤销。`,
      () => {
        assignment.questionStructure[index].subQuestions.splice(subIndex, 1);
        this.setData({ assignment });
        this.recalculateScores();
      }
    );
  },

  // 删除三级题目
  deleteLevel3Question(e) {
    if (!this.data.editPermission.canEdit) return;
    
    const { index, subIndex, subSubIndex } = e.currentTarget.dataset;
    const assignment = this.data.assignment;
    const subSubQuestion = assignment.questionStructure[index].subQuestions[subIndex].subQuestions[subSubIndex];
    
    this.showConfirmDialog(
      '删除确认',
      `确定要删除细分题"${subSubQuestion.title || '未命名细分题'}"吗？此操作不可撤销。`,
      () => {
        assignment.questionStructure[index].subQuestions[subIndex].subQuestions.splice(subSubIndex, 1);
        this.setData({ assignment });
        this.recalculateScores();
      }
    );
  },





  // 预览结构
  previewStructure() {
    // 可以跳转到预览页面或显示预览弹窗
    wx.showModal({
      title: '题目结构预览',
      content: this.generateStructurePreview(),
      showCancel: false
    });
  },

  // 生成结构预览文本
  generateStructurePreview() {
    const assignment = this.data.assignment;
    let preview = `总分：${assignment.totalScore}分\n\n`;
    
    assignment.questionStructure.forEach((q1, i) => {
      preview += `${i + 1}. ${q1.title || '未命名题目'} (${q1.totalScore}分)\n`;
      
      if (q1.subQuestions && q1.subQuestions.length > 0) {
        q1.subQuestions.forEach((q2, j) => {
          preview += `  (${j + 1}) ${q2.title || '未命名小题'} (${q2.totalScore}分)\n`;
          
          if (q2.subQuestions && q2.subQuestions.length > 0) {
            q2.subQuestions.forEach((q3, k) => {
              preview += `    ${k + 1}) ${q3.title || '未命名细分题'} (${q3.score}分)\n`;
            });
          }
        });
      }
      preview += '\n';
    });
    
    return preview;
  },

  // 保存修改
  saveChanges() {
    if (!this.data.editPermission.canEdit || !this.data.hasChanges) return;
    
    this.showConfirmDialog(
      '保存确认',
      '确定要保存对题目结构的修改吗？',
      () => {
        const assignments = storage.getAssignments();
        const index = assignments.findIndex(a => a.id === this.data.assignment.id);
        
        if (index !== -1) {
          // 添加编辑历史记录
          const editHistory = {
            timestamp: new Date().toISOString(),
            changes: this.getChangesSummary(),
            editor: 'current_user' // 可以从用户信息获取
          };
          
          if (!this.data.assignment.editHistory) {
            this.data.assignment.editHistory = [];
          }
          this.data.assignment.editHistory.push(editHistory);
          
          assignments[index] = this.data.assignment;
          storage.saveAssignments(assignments);
          
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 更新原始数据
          this.setData({
            originalAssignment: JSON.parse(JSON.stringify(this.data.assignment)),
            hasChanges: false
          });
        }
      }
    );
  },

  // 获取修改摘要
  getChangesSummary() {
    // 简单的修改摘要，可以根据需要扩展
    return {
      totalScore: this.data.assignment.totalScore,
      questionCount: this.data.assignment.questionStructure.length,
      modifiedAt: new Date().toISOString()
    };
  },

  // 取消编辑
  cancelEdit() {
    if (this.data.hasChanges) {
      this.showConfirmDialog(
        '取消确认',
        '您有未保存的修改，确定要取消编辑吗？',
        () => {
          wx.navigateBack();
        }
      );
    } else {
      wx.navigateBack();
    }
  },

  // 显示确认对话框
  showConfirmDialog(title, message, action) {
    this.setData({
      showConfirmDialog: true,
      confirmDialog: {
        title: title,
        message: message,
        action: action
      }
    });
  },

  // 隐藏确认对话框
  hideConfirmDialog() {
    this.setData({
      showConfirmDialog: false,
      confirmDialog: {
        title: '',
        message: '',
        action: null
      }
    });
  },

  // 确认操作
  confirmAction() {
    if (this.data.confirmDialog.action) {
      this.data.confirmDialog.action();
    }
    this.hideConfirmDialog();
  }
});