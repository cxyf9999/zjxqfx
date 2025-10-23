// utils/excel-export.js
// Excel导出工具类

class ExcelExporter {
  constructor() {
    // 简化的Excel生成器，不依赖外部库
    this.workbook = {
      SheetNames: [],
      Sheets: {}
    };
  }

  /**
   * 创建工作表
   */
  createWorksheet(data, sheetName = 'Sheet1') {
    const worksheet = {};
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

    for (let R = 0; R < data.length; ++R) {
      for (let C = 0; C < data[R].length; ++C) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;

        const cell = { v: data[R][C] };
        if (cell.v == null) continue;

        const cellRef = this.encodeCell({ c: C, r: R });
        
        if (typeof cell.v === 'number') {
          cell.t = 'n';
        } else if (typeof cell.v === 'boolean') {
          cell.t = 'b';
        } else {
          cell.t = 's';
        }

        worksheet[cellRef] = cell;
      }
    }

    if (range.s.c < 10000000) worksheet['!ref'] = this.encodeRange(range);
    
    this.workbook.SheetNames.push(sheetName);
    this.workbook.Sheets[sheetName] = worksheet;
    
    return worksheet;
  }

  /**
   * 编码单元格引用
   */
  encodeCell(cell) {
    return this.encodeCol(cell.c) + this.encodeRow(cell.r);
  }

  /**
   * 编码列
   */
  encodeCol(col) {
    let s = '';
    for (++col; col; col = Math.floor((col - 1) / 26)) {
      s = String.fromCharCode(((col - 1) % 26) + 65) + s;
    }
    return s;
  }

  /**
   * 编码行
   */
  encodeRow(row) {
    return (row + 1).toString();
  }

  /**
   * 编码范围
   */
  encodeRange(range) {
    return this.encodeCell(range.s) + ':' + this.encodeCell(range.e);
  }

  /**
   * 将工作簿转换为CSV格式（作为Excel的简化替代）
   */
  writeCSV(worksheet) {
    const range = worksheet['!ref'] ? this.decodeRange(worksheet['!ref']) : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
    let csv = '\uFEFF'; // BOM for UTF-8

    for (let R = range.s.r; R <= range.e.r; ++R) {
      let row = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = this.encodeCell({ c: C, r: R });
        const cell = worksheet[cellRef];
        let cellValue = '';
        
        if (cell) {
          cellValue = cell.v;
          if (typeof cellValue === 'string' && (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n'))) {
            cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
          }
        }
        
        row.push(cellValue);
      }
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 解码范围
   */
  decodeRange(range) {
    const parts = range.split(':');
    return {
      s: this.decodeCell(parts[0]),
      e: this.decodeCell(parts[1])
    };
  }

  /**
   * 解码单元格
   */
  decodeCell(cellRef) {
    const match = cellRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { c: 0, r: 0 };
    
    return {
      c: this.decodeCol(match[1]),
      r: parseInt(match[2]) - 1
    };
  }

  /**
   * 解码列
   */
  decodeCol(col) {
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  /**
   * 导出为Excel格式的CSV文件
   */
  exportToExcel(data, filename, sheetName = 'Sheet1') {
    try {
      // 创建工作表
      const worksheet = this.createWorksheet(data, sheetName);
      
      // 转换为CSV格式
      const csvContent = this.writeCSV(worksheet);
      
      // 生成文件名（CSV格式）
      const csvFilename = filename.replace(/\.xlsx$/i, '.csv');
      
      return {
        content: csvContent,
        filename: csvFilename,
        mimeType: 'text/csv'
      };
    } catch (error) {
      console.error('Excel导出失败:', error);
      throw error;
    }
  }

  /**
   * 生成错题汇总数据
   * @param {Array} scores - 成绩数据
   * @param {Array} assignments - 作业数据
   * @param {Array} students - 学生数据
   * @returns {Array} 错题汇总的二维数组数据
   */
  generateWrongQuestionsData(scores, assignments, students) {
    const wrongQuestionsData = [];
    
    // 添加标题
    wrongQuestionsData.push(['错题汇总统计']);
    wrongQuestionsData.push(['统计时间', new Date().toLocaleString()]);
    wrongQuestionsData.push([]); // 空行
    
    // 添加表头
    wrongQuestionsData.push(['学号', '姓名', '作业名称', '错题路径', '错误原因', '失分']);
    
    // 遍历成绩数据，提取错题信息
    scores.forEach(score => {
      const student = students.find(s => s.id === score.studentId);
      const assignment = assignments.find(a => a.id === score.assignmentId);
      
      if (student && assignment && score.questions) {
        // 使用extractWrongQuestions逻辑提取错题
        const wrongQuestions = this.extractWrongQuestions(score.questions);
        
        wrongQuestions.forEach(wrongQ => {
          wrongQuestionsData.push([
            student.studentNumber || '',
            student.name || '',
            assignment.name || '',
            wrongQ.questionPath || '',
            wrongQ.reason || '',
            wrongQ.lostScore || 0
          ]);
        });
      }
    });
    
    // 如果没有错题数据，添加提示信息
    if (wrongQuestionsData.length <= 4) {
      wrongQuestionsData.push(['暂无错题数据', '', '', '', '', '']);
    }
    
    return wrongQuestionsData;
  }

  /**
   * 提取错题信息（复制自student-scores.js的逻辑）
   * @param {Array} questions - 题目数据
   * @returns {Array} 错题数组
   */
  extractWrongQuestions(questions) {
    const wrongQuestions = [];

    questions.forEach(question => {
      // 检查是否有子题
      if (question.subQuestions && question.subQuestions.length > 0) {
        // 有子题的情况，不统计一级题目，检查子题
        question.subQuestions.forEach(subQuestion => {
          // 检查二级题目是否有三级子题
          if (subQuestion.subQuestions && subQuestion.subQuestions.length > 0) {
            // 有三级子题的情况，不统计二级题目，只统计三级题目
            subQuestion.subQuestions.forEach(subSubQuestion => {
              const lostScore = subSubQuestion.maxScore - subSubQuestion.score;
              if (lostScore > 0) {
                wrongQuestions.push({
                  questionPath: `${question.title} - ${subQuestion.title} - ${subSubQuestion.title}`,
                  reason: subSubQuestion.score === 0 ? '完全错误' : '不完全错误',
                  lostScore: lostScore
                });
              }
            });
          } else {
            // 没有三级子题的情况，统计二级题目
            const lostScore = subQuestion.maxScore - subQuestion.score;
            if (lostScore > 0) {
              wrongQuestions.push({
                questionPath: `${question.title} - ${subQuestion.title}`,
                reason: subQuestion.score === 0 ? '完全错误' : '不完全错误',
                lostScore: lostScore
              });
            }
          }
        });
      } else {
        // 没有子题的情况，统计一级题目
        const lostScore = question.maxScore - question.score;
        if (lostScore > 0) {
          wrongQuestions.push({
            questionPath: question.title,
            reason: question.score === 0 ? '完全错误' : '不完全错误',
            lostScore: lostScore
          });
        }
      }
    });

    return wrongQuestions;
  }

  /**
   * 保存包含多个工作表的Excel文件
   * @param {Object} sheetsData - 工作表数据对象 {sheetName: data}
   * @param {String} fileName - 文件名
   */
  saveMultiSheetExcelFile(sheetsData, fileName) {
    try {
      // 生成多工作表的CSV内容（简化处理，用分隔符区分工作表）
      let csvContent = '\uFEFF'; // BOM for UTF-8
      
      Object.keys(sheetsData).forEach((sheetName, index) => {
        if (index > 0) {
          csvContent += '\n\n=== ' + sheetName + ' ===\n\n';
        }
        // 创建工作表并转换为CSV
        const worksheet = this.createWorksheet(sheetsData[sheetName], sheetName);
        csvContent += this.writeCSV(worksheet);
      });
      
      // 在小程序环境中保存文件
      const fs = wx.getFileSystemManager();
      const csvFilename = fileName.replace(/\.xlsx$/i, '.csv');
      const filePath = `${wx.env.USER_DATA_PATH}/${csvFilename}`;
      
      // 将CSV内容写入文件
      fs.writeFileSync(filePath, csvContent, 'utf8');
      
      // 分享文件
      wx.shareFileMessage({
        filePath: filePath,
        fileName: csvFilename,
        success: () => {
          wx.showToast({
            title: 'CSV文件已生成',
            icon: 'success'
          });
        },
        fail: (error) => {
          console.error('分享文件失败:', error);
          // 降级到复制到剪贴板
          wx.setClipboardData({
            data: csvContent,
            success: () => {
              wx.showToast({
                title: '数据已复制到剪贴板，请手动保存为CSV文件',
                icon: 'success',
                duration: 3000
              });
            }
          });
        }
      });
      
    } catch (error) {
      console.error('保存多工作表Excel文件失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  }

  /**
   * 保存Excel文件（小程序环境）
   */
  saveExcelFile(data, filename, sheetName = 'Sheet1') {
    try {
      const result = this.exportToExcel(data, filename, sheetName);
      
      // 在小程序环境中，使用文件系统API保存文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${result.filename}`;
      
      // 将CSV内容写入文件
      fs.writeFileSync(filePath, result.content, 'utf8');
      
      // 分享文件
      wx.shareFileMessage({
        filePath: filePath,
        fileName: result.filename,
        success: () => {
          wx.showToast({
            title: 'CSV文件已生成',
            icon: 'success'
          });
        },
        fail: (error) => {
          console.error('分享文件失败:', error);
          // 降级到复制到剪贴板
          wx.setClipboardData({
            data: result.content,
            success: () => {
              wx.showToast({
                title: '数据已复制到剪贴板，请手动保存为CSV文件',
                icon: 'success',
                duration: 3000
              });
            }
          });
        }
      });
      
      return result;
    } catch (error) {
      console.error('保存Excel文件失败:', error);
      throw error;
    }
  }
}

module.exports = {
  ExcelExporter
};