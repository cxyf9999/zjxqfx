// markdown-parser.js
// Markdown文件解析模块，用于从Markdown文件中提取题目结构和知识点

/**
 * 解析Markdown内容，提取题目结构
 * @param {string} markdownContent - Markdown文件内容
 * @returns {Object} 解析结果
 */
function parseMarkdownToQuestionStructure(markdownContent) {
  if (!markdownContent || typeof markdownContent !== 'string') {
    throw new Error('Markdown内容不能为空')
  }

  const lines = markdownContent.split('\n').map(line => line.trim()).filter(line => line)
  const questionStructure = []
  let currentLevel1 = null
  let currentLevel2 = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 解析一级题目（大题）- ## 开头
    if (line.startsWith('## ')) {
      const level1Info = parseLevel1Title(line)
      if (level1Info) {
        currentLevel1 = {
          title: level1Info.title,
          score: level1Info.score || 0,
          calculatedScore: 0,
          knowledgePoints: level1Info.knowledgePoints || [],
          subQuestions: []
        }
        questionStructure.push(currentLevel1)
        currentLevel2 = null
      }
    }
    // 解析二级题目（小题）- ### 开头
    else if (line.startsWith('### ') && currentLevel1) {
      const level2Info = parseLevel2Title(line)
      if (level2Info) {
        currentLevel2 = {
          title: level2Info.title,
          score: level2Info.score || 0,
          calculatedScore: 0,
          knowledgePoints: level2Info.knowledgePoints || [],
          subQuestions: []
        }
        currentLevel1.subQuestions.push(currentLevel2)
      }
    }
    // 解析三级题目（细分题）- #### 开头
    else if (line.startsWith('#### ') && currentLevel2) {
      const level3Info = parseLevel3Title(line)
      if (level3Info) {
        const level3Question = {
          title: level3Info.title,
          score: level3Info.score || 0,
          calculatedScore: 0,
          knowledgePoints: level3Info.knowledgePoints || []
        }
        currentLevel2.subQuestions.push(level3Question)
      }
    }
    // 解析知识点 - **知识点：** 开头
    else if (line.includes('**知识点：**') || line.includes('**知识点:**')) {
      const knowledgePoints = parseKnowledgePoints(line)
      if (knowledgePoints.length > 0) {
        // 将知识点添加到当前最深层级的题目
        if (currentLevel2 && currentLevel2.subQuestions.length > 0) {
          // 添加到最后一个三级题目
          const lastLevel3 = currentLevel2.subQuestions[currentLevel2.subQuestions.length - 1]
          lastLevel3.knowledgePoints = [...(lastLevel3.knowledgePoints || []), ...knowledgePoints]
        } else if (currentLevel2) {
          // 添加到当前二级题目
          currentLevel2.knowledgePoints = [...(currentLevel2.knowledgePoints || []), ...knowledgePoints]
        } else if (currentLevel1) {
          // 添加到当前一级题目
          currentLevel1.knowledgePoints = [...(currentLevel1.knowledgePoints || []), ...knowledgePoints]
        }
      }
    }
  }

  // 计算分数
  calculateScores(questionStructure)

  return {
    success: true,
    questionStructure,
    totalScore: questionStructure.reduce((sum, q) => sum + (q.calculatedScore || 0), 0),
    summary: generateSummary(questionStructure)
  }
}

/**
 * 解析一级题目标题
 * @param {string} line - 标题行
 * @returns {Object|null} 解析结果
 */
function parseLevel1Title(line) {
  // 匹配多种格式：
  // ## 一、选择题 (30分)
  // ## 第一大题：基础知识 (20分)
  // ## 基础知识 (20分)
  // ## 1. 选择题 (30分)
  const match = line.match(/^##\s*(?:第?\d*[、.]?\s*|[一二三四五六七八九十]+[、.]?\s*)?(.+?)(?:\s*\((\d+)分\))?$/)
  if (match) {
    const title = match[1].trim()
    const score = match[2] ? parseInt(match[2]) : 0
    return { title, score }
  }
  return null
}

/**
 * 解析二级题目标题
 * @param {string} line - 标题行
 * @returns {Object|null} 解析结果
 */
function parseLevel2Title(line) {
  // 匹配多种格式：
  // ### 1. 函数定义域 (10分)
  // ### 第1小题：填空题 (10分)
  // ### 填空题 (10分)
  // ### (1) 计算题 (5分)
  const match = line.match(/^###\s*(?:第?\d*[、.]?\s*|\(\d+\)\s*|[一二三四五六七八九十]+[、.]?\s*)?(.+?)(?:\s*\((\d+)分\))?$/)
  if (match) {
    const title = match[1].trim()
    const score = match[2] ? parseInt(match[2]) : 0
    return { title, score }
  }
  return null
}

/**
 * 解析三级题目标题
 * @param {string} line - 标题行
 * @returns {Object|null} 解析结果
 */
function parseLevel3Title(line) {
  // 匹配多种格式：
  // #### (1) 计算题 (5分)
  // #### 第1细分题 (5分)
  // #### 分数乘整数 (5分)
  // #### 1. 基础题 (5分)
  const match = line.match(/^####\s*(?:第?\d*[、.]?\s*|\(\d+\)\s*|[一二三四五六七八九十]+[、.]?\s*)?(.+?)(?:\s*\((\d+)分\))?$/)
  if (match) {
    const title = match[1].trim()
    const score = match[2] ? parseInt(match[2]) : 0
    return { title, score }
  }
  return null
}

/**
 * 解析知识点
 * @param {string} line - 包含知识点的行
 * @returns {Array} 知识点数组
 */
function parseKnowledgePoints(line) {
  // 匹配 **知识点：** 或 **知识点:** 后面的内容
  const match = line.match(/\*\*知识点[：:]\*\*\s*(.+)/)
  if (match) {
    const pointsText = match[1].trim()
    // 按逗号、顿号、分号分割知识点
    const points = pointsText.split(/[，,、；;]/).map(p => p.trim()).filter(p => p)
    return points
  }
  return []
}

/**
 * 计算各级题目分数
 * @param {Array} questionStructure - 题目结构
 */
function calculateScores(questionStructure) {
  questionStructure.forEach(level1 => {
    let level1CalculatedScore = 0

    if (level1.subQuestions && level1.subQuestions.length > 0) {
      // 一级题目有二级题目，计算二级题目的分数
      level1.subQuestions.forEach(level2 => {
        let level2CalculatedScore = 0

        if (level2.subQuestions && level2.subQuestions.length > 0) {
          // 二级题目有三级题目，计算三级题目分数之和
          level2.subQuestions.forEach(level3 => {
            level2CalculatedScore += level3.score || 0
          })
          level2.calculatedScore = level2CalculatedScore
        } else {
          // 二级题目没有三级题目，使用手动输入的分数
          level2CalculatedScore = level2.score || 0
          level2.calculatedScore = level2CalculatedScore
        }

        level1CalculatedScore += level2CalculatedScore
      })
      level1.calculatedScore = level1CalculatedScore
    } else {
      // 一级题目没有二级题目，使用手动输入的分数
      level1CalculatedScore = level1.score || 0
      level1.calculatedScore = level1CalculatedScore
    }
  })
}

/**
 * 生成解析摘要
 * @param {Array} questionStructure - 题目结构
 * @returns {Object} 摘要信息
 */
function generateSummary(questionStructure) {
  let level1Count = questionStructure.length
  let level2Count = 0
  let level3Count = 0
  let totalKnowledgePoints = new Set()

  questionStructure.forEach(level1 => {
    // 收集一级题目的知识点
    if (level1.knowledgePoints) {
      level1.knowledgePoints.forEach(point => totalKnowledgePoints.add(point))
    }

    if (level1.subQuestions) {
      level2Count += level1.subQuestions.length
      level1.subQuestions.forEach(level2 => {
        // 收集二级题目的知识点
        if (level2.knowledgePoints) {
          level2.knowledgePoints.forEach(point => totalKnowledgePoints.add(point))
        }

        if (level2.subQuestions) {
          level3Count += level2.subQuestions.length
          level2.subQuestions.forEach(level3 => {
            // 收集三级题目的知识点
            if (level3.knowledgePoints) {
              level3.knowledgePoints.forEach(point => totalKnowledgePoints.add(point))
            }
          })
        }
      })
    }
  })

  return {
    level1Count,
    level2Count,
    level3Count,
    totalQuestions: level1Count + level2Count + level3Count,
    knowledgePointsCount: totalKnowledgePoints.size,
    knowledgePoints: Array.from(totalKnowledgePoints)
  }
}

/**
 * 转换为小程序作业系统的题目结构格式
 * @param {Array} questionStructure - 解析的题目结构
 * @returns {Object} 包含题目结构和总分的对象
 */
function convertToAssignmentFormat(questionStructure) {
  const formattedQuestions = questionStructure.map(level1 => ({
    score: level1.score || 0,
    calculatedScore: level1.calculatedScore || 0,
    title: level1.title,
    knowledgePoints: level1.knowledgePoints || [],
    subQuestions: (level1.subQuestions || []).map(level2 => ({
      score: level2.score || 0,
      calculatedScore: level2.calculatedScore || 0,
      title: level2.title,
      knowledgePoints: level2.knowledgePoints || [],
      subQuestions: (level2.subQuestions || []).map(level3 => ({
        score: level3.score || 0,
        calculatedScore: level3.calculatedScore || 0,
        title: level3.title,
        knowledgePoints: level3.knowledgePoints || []
      }))
    }))
  }))

  // 计算总分
  let totalScore = 0
  questionStructure.forEach(level1 => {
    totalScore += level1.calculatedScore || level1.score || 0
  })

  return {
    questionStructure: formattedQuestions,
    totalScore: totalScore
  }
}

/**
 * 验证Markdown文件格式
 * @param {string} markdownContent - Markdown内容
 * @returns {Object} 验证结果
 */
function validateMarkdownFormat(markdownContent) {
  const errors = []
  const warnings = []

  if (!markdownContent || typeof markdownContent !== 'string') {
    errors.push('Markdown内容不能为空')
    return { valid: false, errors, warnings }
  }

  const lines = markdownContent.split('\n').map(line => line.trim()).filter(line => line)
  
  // 检查是否有一级题目
  const hasLevel1 = lines.some(line => line.startsWith('## '))
  if (!hasLevel1) {
    errors.push('未找到一级题目（## 开头的标题）')
  }

  // 检查是否有知识点
  const hasKnowledgePoints = lines.some(line => line.includes('**知识点：**') || line.includes('**知识点:**'))
  if (!hasKnowledgePoints) {
    warnings.push('未找到知识点标记（**知识点：**）')
  }

  // 检查分数格式
  const scorePattern = /\(\d+分\)/
  const hasScores = lines.some(line => scorePattern.test(line))
  if (!hasScores) {
    warnings.push('未找到分数标记（如：(10分)）')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

module.exports = {
  parseMarkdownToQuestionStructure,
  convertToAssignmentFormat,
  validateMarkdownFormat,
  generateSummary
}